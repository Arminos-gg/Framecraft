/**
 * Project files: saving a project as JSON and opening files, including the prototype's.
 *
 * Version 1 is the prototype's format. It names the class `cls` and stores UIGradient's
 * properties as GradColor, GradTransparency and GradRotation with two stops. Version 2 uses
 * `className` and the real UIGradient names with keypoint sequences. Both have a StarterGui
 * root and keep preview pictures on the object. Version 3 has the DataModel root, per
 * breakpoint changes, and an image library next to the document.
 */
import { addAsset, isAssetId, isImageDataUrl, usedAssets, type Assets } from './assets.ts';
import {
  classDef,
  defaultProps,
  isClassName,
  isOverridable,
  normalizeProp,
  type ClassName,
} from './classes.ts';
import {
  emptyProject,
  ModelError,
  validateDoc,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from './document.ts';
import { colorSequence, numberSequence, type Color3 } from './values.ts';

export const FILE_FORMAT = 'framecraft';
export const FILE_VERSION = 3;

/** What a project file holds: the document and the images it uses. */
export interface Project {
  readonly doc: Doc;
  readonly assets: Assets;
}

/** The project as file text. Only the images the document uses are written. */
export function serializeProject(doc: Doc, assets: Assets = {}): string {
  const used = usedAssets(doc);
  const kept = Object.fromEntries(
    Object.entries(assets)
      .filter(([id]) => used.has(id))
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const file = { format: FILE_FORMAT, version: FILE_VERSION, doc, assets: kept };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Reads project JSON text. Throws a ModelError with a message fit to show the user. */
export function parseProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ModelError("This file isn't valid JSON.");
  }
  return loadProject(data);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Turns parsed JSON into a project. Accepts a version 1, 2 or 3 project file, or a bare
 * version 1 document (what the prototype autosaves). Properties that are missing or invalid
 * fall back to their defaults, and changes for a breakpoint that's gone are dropped; a broken
 * tree is refused. Older files open with their screens in StarterGui, an empty Site, the
 * default breakpoints, and their preview pictures moved into the image library.
 */
export function loadProject(data: unknown): Project {
  let raw: unknown = data;
  let version = 1;
  if (isObject(data) && data.format === FILE_FORMAT) {
    if (typeof data.version !== 'number' || data.version < 1)
      throw new ModelError("This project file doesn't say which version it is.");
    if (data.version > FILE_VERSION)
      throw new ModelError('This project was saved by a newer version of Framecraft.');
    version = data.version;
    raw = data.doc;
  }
  if (!isObject(raw) || typeof raw.rootId !== 'string')
    throw new ModelError("This file isn't a Framecraft project.");
  const rawInstances = version === 1 ? raw.nodes : raw.instances;
  if (!isObject(rawInstances)) throw new ModelError("This file isn't a Framecraft project.");

  let assets: Assets = {};
  if (version >= 3 && isObject(data) && isObject(data.assets)) {
    for (const [id, url] of Object.entries(data.assets))
      if (isAssetId(id) && isImageDataUrl(url)) assets = { ...assets, [id]: url };
  }

  const instances: Record<InstanceId, AnyInstance> = {};
  for (const [id, r] of Object.entries(rawInstances)) {
    const inst = readInstance(id, r, version);
    // Older files kept the picture itself on the object; it moves into the library.
    if (version < 3 && isObject(r) && isImageDataUrl(r.preview) && classDef(inst.className).image) {
      const added = addAsset(assets, r.preview);
      assets = added.assets;
      instances[id] = { ...inst, preview: added.id };
    } else instances[id] = inst;
  }
  dropStaleOverrides(instances);

  let doc: Doc = { rootId: raw.rootId, instances };
  if (version < 3) {
    if (instances[raw.rootId]?.className !== 'StarterGui')
      throw new ModelError("This file isn't a Framecraft project.");
    doc = emptyProject(undefined, doc);
  }
  const problems = validateDoc(doc);
  if (problems.length) throw new ModelError(`This project file is damaged: ${problems[0]}.`);
  return { doc, assets };
}

/** Changes kept for a breakpoint that's no longer in the file are dropped. */
function dropStaleOverrides(instances: Record<InstanceId, AnyInstance>) {
  for (const [id, inst] of Object.entries(instances)) {
    if (!inst.overrides) continue;
    const kept = Object.entries(inst.overrides).filter(
      ([bp]) => instances[bp]?.className === 'Breakpoint',
    );
    const updated: Record<string, unknown> = { ...inst, overrides: Object.fromEntries(kept) };
    if (!kept.length) delete updated.overrides;
    instances[id] = updated as unknown as AnyInstance;
  }
}

function readInstance(id: InstanceId, r: unknown, version: number): AnyInstance {
  if (!isObject(r)) throw new ModelError(`This project file is damaged: ${id} is not an object.`);
  const className = version === 1 ? r.cls : r.className;
  if (!isClassName(className))
    throw new ModelError(
      `This project uses a class Framecraft doesn't know: ${String(className)}.`,
    );

  const rawProps = isObject(r.props) ? r.props : {};
  const given = version === 1 && className === 'UIGradient' ? upgradeGradient(rawProps) : rawProps;
  const props: Record<string, unknown> = defaultProps(className);
  for (const key of Object.keys(props)) {
    if (!Object.hasOwn(given, key)) continue;
    const v = normalizeProp(className, key, given[key]);
    if (v !== undefined) props[key] = v;
  }

  const inst: Record<string, unknown> = {
    id,
    className,
    parent: typeof r.parent === 'string' ? r.parent : null,
    children: Array.isArray(r.children) ? r.children.filter((c) => typeof c === 'string') : [],
    props,
  };
  if (version >= 3 && isAssetId(r.preview) && classDef(className as ClassName).image)
    inst.preview = r.preview;
  if (version >= 3 && isObject(r.overrides)) {
    const overrides = readOverrides(className, r.overrides);
    if (Object.keys(overrides).length) inst.overrides = overrides;
  }
  return inst as unknown as AnyInstance;
}

/** A breakpoint's changes, keeping only valid values of properties that may differ. */
function readOverrides(className: ClassName, raw: Json): Record<InstanceId, Json> {
  const out: Record<InstanceId, Json> = {};
  for (const [bp, changes] of Object.entries(raw)) {
    if (!isObject(changes)) continue;
    const kept: Json = {};
    for (const [key, value] of Object.entries(changes)) {
      if (!isOverridable(className, key)) continue;
      const v = normalizeProp(className, key, value);
      if (v !== undefined) kept[key] = v;
    }
    if (Object.keys(kept).length) out[bp] = kept;
  }
  return out;
}

/** Version 1 stored two gradient stops in GradColor and GradTransparency. */
function upgradeGradient(p: Json): Json {
  const out: Json = { Name: p.Name };
  const pair = (v: unknown): [unknown, unknown] | undefined =>
    Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : undefined;
  const colors = pair(p.GradColor);
  if (colors) out.Color = colorSequence(colors[0] as Color3, colors[1] as Color3);
  const alphas = pair(p.GradTransparency);
  if (alphas) out.Transparency = numberSequence(alphas[0] as number, alphas[1] as number);
  if (p.GradRotation !== undefined) out.Rotation = p.GradRotation;
  return out;
}
