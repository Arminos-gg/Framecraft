/**
 * Project files: saving a document as JSON and opening files, including the prototype's.
 *
 * Version 1 is the prototype's format. It names the class `cls` and stores UIGradient's
 * properties as GradColor, GradTransparency and GradRotation with two stops. Version 2 uses
 * `className` and the real UIGradient names with keypoint sequences.
 */
import { classDef, defaultProps, isClassName, normalizeProp, type ClassName } from './classes.ts';
import {
  ModelError,
  validateDoc,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from './document.ts';
import { colorSequence, numberSequence, type Color3 } from './values.ts';

export const FILE_FORMAT = 'framecraft';
export const FILE_VERSION = 2;

export function serializeProject(doc: Doc): string {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, doc }, null, 2) + '\n';
}

/** Reads project JSON text. Throws a ModelError with a message fit to show the user. */
export function parseProject(text: string): Doc {
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
 * Turns parsed JSON into a document. Accepts a version 1 or 2 project file, or a bare
 * version 1 document (what the prototype autosaves). Properties that are missing or invalid
 * fall back to their defaults; a broken tree is refused.
 */
export function loadProject(data: unknown): Doc {
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

  const instances: Record<InstanceId, AnyInstance> = {};
  for (const [id, r] of Object.entries(rawInstances)) {
    instances[id] = readInstance(id, r, version);
  }
  const doc: Doc = { rootId: raw.rootId, instances };
  const problems = validateDoc(doc);
  if (problems.length) throw new ModelError(`This project file is damaged: ${problems[0]}.`);
  return doc;
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
  if (typeof r.preview === 'string' && classDef(className as ClassName).image)
    inst.preview = r.preview;
  return inst as unknown as AnyInstance;
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
