/**
 * The document: a tree of Roblox instances held in a flat map by id. Documents are immutable;
 * every change goes through a command (commands.ts), which returns a new document.
 */
import { upgradeFont } from './fonts.ts';
import {
  canParent,
  classDef,
  defaultProps,
  isClassName,
  isOverridable,
  normalizeProp,
  propNames,
  type ClassName,
  type PropsOf,
} from './classes.ts';
import { ASSET_ID_PATTERN, valueEquals, type AssetId } from './values.ts';

export type InstanceId = string;

export interface Instance<C extends ClassName = ClassName> {
  readonly id: InstanceId;
  readonly className: C;
  readonly parent: InstanceId | null;
  readonly children: readonly InstanceId[];
  /** Base values: what Desktop shows, and what every breakpoint starts from. */
  readonly props: PropsOf<C>;
  /**
   * Values changed for a breakpoint, keyed by the Breakpoint's id. Only overridable
   * properties, and only the ones changed there. Absent when there are none.
   */
  readonly overrides?: Readonly<Record<InstanceId, Partial<PropsOf<C>>>>;
  /** ImageLabel and ImageButton: a picture from the image library, shown in place of the Roblox asset. */
  readonly preview?: AssetId;
  /**
   * In a linked copy of a component: which component, and which of its objects this one is
   * (`key`, an id in the component's own tree). The copy's root has the component's root key.
   */
  readonly copyOf?: CopyOf;
}

export type ComponentId = string;

export interface CopyOf {
  readonly component: ComponentId;
  readonly key: InstanceId;
}

/**
 * A component: the tree every linked copy follows, kept once in the document. Its instances
 * are keyed by their own ids (the keys copies point at) and have no `copyOf`. Copies are
 * ordinary instances in the tree, so layout and the exports read them like anything else.
 */
export interface Component extends Subtree {
  readonly id: ComponentId;
}

/** An instance of any class; checking `className` narrows `props`. */
export type AnyInstance = { [C in ClassName]: Instance<C> }[ClassName];

export interface Doc {
  readonly rootId: InstanceId;
  readonly instances: Readonly<Record<InstanceId, AnyInstance>>;
  /** The project's linked components, by id. Absent when there are none. */
  readonly components?: Readonly<Record<ComponentId, Component>>;
}

/** A detached copy of part of a tree, ready to insert. Its root has no parent. */
export interface Subtree {
  readonly rootId: InstanceId;
  readonly instances: Readonly<Record<InstanceId, AnyInstance>>;
}

/** A change that breaks the document's rules, or a file that can't be read. */
export class ModelError extends Error {
  override name = 'ModelError';
}

let idSeq = 0;
/** A new instance id, unique within a session and very unlikely to clash with loaded files. */
export const newId = (): InstanceId =>
  'n' + (++idSeq).toString(36) + Math.random().toString(36).slice(2, 8);

/** A new, detached instance with default properties, overridden by `props`. */
export function createInstance<C extends ClassName>(
  className: C,
  props: Partial<PropsOf<C>> = {},
  id: InstanceId = newId(),
): Instance<C> {
  const merged: Record<string, unknown> = defaultProps(className);
  for (const [key, value] of Object.entries(upgradeFont(props))) {
    const v = normalizeProp(className, key, value);
    if (v === undefined)
      throw new ModelError(`${className} can't take ${key} = ${JSON.stringify(value)}`);
    merged[key] = v;
  }
  return { id, className, parent: null, children: [], props: merged as PropsOf<C> };
}

/** A subtree holding one new instance. */
export const single = (instance: AnyInstance): Subtree => ({
  rootId: instance.id,
  instances: { [instance.id]: instance },
});

export const getInstance = (doc: Doc, id: InstanceId): AnyInstance | undefined =>
  Object.hasOwn(doc.instances, id) ? doc.instances[id] : undefined;

export function requireInstance(doc: Doc, id: InstanceId): AnyInstance {
  const inst = getInstance(doc, id);
  if (!inst) throw new ModelError(`No instance with id ${id}`);
  return inst;
}

export function childrenOf(doc: Doc, id: InstanceId): AnyInstance[] {
  const inst = getInstance(doc, id);
  return inst ? inst.children.map((c) => requireInstance(doc, c)) : [];
}

/** The first child of a given class, such as an object's UICorner. */
export function childOfClass<C extends ClassName>(
  doc: Doc,
  id: InstanceId,
  className: C,
): Instance<C> | undefined {
  return childrenOf(doc, id).find((c) => c.className === className) as Instance<C> | undefined;
}

/**
 * The objects that draw inside `id`, in tree order, with the objects in its Folders (and in
 * theirs) where the Folder is: Roblox draws them as if they sat in `id` itself.
 */
export function drawnChildren(doc: Doc, id: InstanceId): AnyInstance[] {
  return childrenOf(doc, id).flatMap((c) => {
    const kind = classDef(c.className).kind;
    return kind === 'gui' ? [c] : kind === 'folder' ? drawnChildren(doc, c.id) : [];
  });
}

/** The instance itself, or the nearest one above it that isn't a Folder: where its objects draw. */
export function drawnParent(doc: Doc, id: InstanceId): AnyInstance | undefined {
  let inst = getInstance(doc, id);
  while (inst && classDef(inst.className).kind === 'folder')
    inst = inst.parent === null ? undefined : getInstance(doc, inst.parent);
  return inst;
}

/** The objects that draw inside `id` through its Folders only, in tree order. */
export const folderObjects = (doc: Doc, id: InstanceId): AnyInstance[] =>
  childrenOf(doc, id).flatMap((c) =>
    classDef(c.className).kind === 'folder' ? drawnChildren(doc, c.id) : [],
  );

/** Whether an instance is a web page or inside one, where web-only objects work. */
export function onPage(doc: Doc, id: InstanceId): boolean {
  for (
    let p = getInstance(doc, id);
    p;
    p = p.parent === null ? undefined : getInstance(doc, p.parent)
  )
    if (p.className === 'Page') return true;
  return false;
}

/** The Form an object is in, if any: its TextBoxes are the form's fields and its buttons send it. */
export function formOf(doc: Doc, id: InstanceId): Instance<'Form'> | undefined {
  const inst = getInstance(doc, id);
  for (
    let p = inst?.parent == null ? undefined : getInstance(doc, inst.parent);
    p;
    p = p.parent === null ? undefined : getInstance(doc, p.parent)
  )
    if (p.className === 'Form') return p as Instance<'Form'>;
  return undefined;
}

/** Objects only a web page can hold, such as a Form or an Embed: Roblox has nothing like them. */
export const pageOnly = (className: ClassName): boolean => {
  const def = classDef(className);
  return !!def.web && def.kind === 'gui';
};

/** Is `ancestorId` a parent, grandparent and so on of `id`? */
export function isAncestor(doc: Doc, ancestorId: InstanceId, id: InstanceId): boolean {
  let p = getInstance(doc, id)?.parent ?? null;
  while (p !== null) {
    if (p === ancestorId) return true;
    p = getInstance(doc, p)?.parent ?? null;
  }
  return false;
}

/** The ids of an instance and everything inside it, parents before children. */
export function subtreeIds(doc: Doc, id: InstanceId): InstanceId[] {
  const out: InstanceId[] = [];
  const walk = (i: InstanceId) => {
    out.push(i);
    requireInstance(doc, i).children.forEach(walk);
  };
  walk(id);
  return out;
}

/** A detached copy of an instance and everything inside it, keeping their ids. */
export function extractSubtree(doc: Doc, id: InstanceId): Subtree {
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const i of subtreeIds(doc, id)) instances[i] = requireInstance(doc, i);
  const root = requireInstance(doc, id);
  instances[id] = { ...root, parent: null };
  return { rootId: id, instances };
}

/** The same subtree with fresh ids, so one copy can be pasted many times. */
export function reIdSubtree(subtree: Subtree, makeId: () => InstanceId = newId): Subtree {
  const map = new Map<InstanceId, InstanceId>();
  for (const id of Object.keys(subtree.instances)) map.set(id, makeId());
  const to = (id: InstanceId) => map.get(id) ?? id;
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const inst of Object.values(subtree.instances)) {
    instances[to(inst.id)] = {
      ...inst,
      id: to(inst.id),
      parent: inst.parent === null ? null : to(inst.parent),
      children: inst.children.map(to),
    };
  }
  return { rootId: to(subtree.rootId), instances };
}

/** The breakpoints a new project starts with. Desktop is the base, so it has none. */
export const DEFAULT_BREAKPOINTS = [
  { Name: 'Tablet', MaxWidth: 1199, PreviewWidth: 810, PreviewHeight: 1080 },
  { Name: 'Phone', MaxWidth: 809, PreviewWidth: 390, PreviewHeight: 844 },
] as const;

/**
 * A new project: the DataModel root (Roblox scripts call it `game`) holding StarterGui for
 * Roblox screens, Site for web pages, and the default breakpoints. `starterGui` brings in an
 * existing StarterGui tree, which is how older files open.
 */
export function emptyProject(makeId: () => InstanceId = newId, starterGui?: Subtree): Doc {
  const taken = starterGui ? starterGui.instances : {};
  const rootId = Object.hasOwn(taken, 'game') ? makeId() : 'game';
  const instances: Record<InstanceId, AnyInstance> = { ...taken };
  const children: InstanceId[] = [];
  const add = (inst: AnyInstance) => {
    instances[inst.id] = { ...inst, parent: rootId };
    children.push(inst.id);
  };
  const sg = starterGui?.instances[starterGui.rootId];
  add(sg ?? createInstance('StarterGui', {}, makeId()));
  add(createInstance('Site', {}, makeId()));
  for (const bp of DEFAULT_BREAKPOINTS) add(createInstance('Breakpoint', bp, makeId()));
  instances[rootId] = { ...createInstance('DataModel', {}, rootId), children };
  return { rootId, instances };
}

/** The first child of the root with a given class: the StarterGui or Site service. */
export function serviceOf<C extends 'StarterGui' | 'Site'>(doc: Doc, className: C): Instance<C> {
  const s = childOfClass(doc, doc.rootId, className);
  if (!s) throw new ModelError(`The project has no ${className}`);
  return s;
}

/** The project's breakpoints, widest first: the order their changes apply in. */
export function breakpointsOf(doc: Doc): Instance<'Breakpoint'>[] {
  return childrenOf(doc, doc.rootId)
    .filter((c): c is Instance<'Breakpoint'> & AnyInstance => c.className === 'Breakpoint')
    .sort((a, b) => b.props.MaxWidth - a.props.MaxWidth);
}

/** The breakpoint a window of this width shows: the narrowest one it fits, or none (Desktop). */
export function breakpointForWidth(doc: Doc, width: number): Instance<'Breakpoint'> | undefined {
  return breakpointsOf(doc).findLast((b) => width <= b.props.MaxWidth);
}

/**
 * An instance's values at a breakpoint: its base values, then the changes made for each
 * breakpoint from the widest down to this one. So Phone shows Tablet's changes unless it has
 * its own. Without a breakpoint, the base values. Layout and the exporters read through this.
 */
export function resolveProps<C extends ClassName>(
  doc: Doc,
  inst: Instance<C>,
  breakpointId?: InstanceId,
): PropsOf<C> {
  if (breakpointId === undefined) return inst.props;
  if (getInstance(doc, breakpointId)?.className !== 'Breakpoint')
    throw new ModelError(`No breakpoint with id ${breakpointId}`);
  if (!inst.overrides) return inst.props;
  let props = inst.props;
  // Widest first, so everything before the target is a wider breakpoint.
  for (const bp of breakpointsOf(doc)) {
    const changes = inst.overrides[bp.id];
    if (changes) props = { ...props, ...changes };
    if (bp.id === breakpointId) break;
  }
  return props;
}

/**
 * Checks every rule a document must follow and returns the problems found (none when valid):
 * links between parents and children, which classes may sit inside which, no cycles, and
 * a complete, valid set of properties on every instance.
 */
export function validateDoc(doc: Doc): string[] {
  const problems: string[] = [];
  const root = getInstance(doc, doc.rootId);
  if (!root) return [`The root ${doc.rootId} is missing`];
  if (classDef(root.className).kind !== 'root') problems.push(`The root is a ${root.className}`);
  if (root.parent !== null) problems.push('The root has a parent');

  for (const [key, inst] of Object.entries(doc.instances)) {
    const where = `${inst.className} ${key}`;
    if (inst.id !== key) problems.push(`${where} is stored under the wrong id`);
    if (!isClassName(inst.className)) {
      problems.push(`${key} has an unknown class ${String(inst.className)}`);
      continue;
    }
    if (inst.parent !== null) {
      const parent = getInstance(doc, inst.parent);
      if (!parent) problems.push(`${where} has a missing parent`);
      else if (!parent.children.includes(key))
        problems.push(`${where} is not in its parent's children`);
      else if (!canParent(inst.className, parent.className))
        problems.push(`${where} can't sit inside a ${parent.className}`);
    } else if (key !== doc.rootId) problems.push(`${where} has no parent`);

    if (new Set(inst.children).size !== inst.children.length)
      problems.push(`${where} lists a child twice`);
    for (const c of inst.children) {
      if (getInstance(doc, c)?.parent !== key)
        problems.push(`${where} lists ${c}, which isn't its child`);
    }

    const props: Record<string, unknown> = inst.props;
    const names = propNames(inst.className);
    for (const p of names) {
      if (!Object.hasOwn(props, p)) problems.push(`${where} is missing ${p}`);
      else if (!valueEquals(normalizeProp(inst.className, p, props[p]), props[p]))
        problems.push(`${where} has an invalid ${p}`);
    }
    for (const p of Object.keys(props)) {
      if (!names.includes(p as never)) problems.push(`${where} has an unknown property ${p}`);
    }
    if (inst.preview !== undefined) {
      if (!classDef(inst.className).image)
        problems.push(`${where} has a preview picture but isn't an image`);
      else if (!ASSET_ID_PATTERN.test(inst.preview))
        problems.push(`${where} has an invalid preview id`);
    }
    if (inst.overrides !== undefined) problems.push(...overrideProblems(doc, where, inst));
    if (classDef(inst.className).unique && inst.parent !== null) {
      const twins = getInstance(doc, inst.parent)?.children.filter(
        (c) => getInstance(doc, c)?.className === inst.className,
      );
      if (twins && twins[0] !== key) problems.push(`${where} is a second ${inst.className}`);
    }
  }

  problems.push(...linkProblems(doc));

  if (root.className === 'DataModel') {
    for (const service of ['StarterGui', 'Site'] as const) {
      if (!childOfClass(doc, doc.rootId, service)) problems.push(`The project has no ${service}`);
    }
  }

  // Everything must hang off the root exactly once: no cycles and no orphans.
  const seen = new Set<InstanceId>();
  const stack = [doc.rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) {
      problems.push(`${id} is reachable twice`);
      continue;
    }
    seen.add(id);
    const inst = getInstance(doc, id);
    if (inst) stack.push(...inst.children);
  }
  for (const id of Object.keys(doc.instances)) {
    if (!seen.has(id)) problems.push(`${id} is not connected to the root`);
  }
  return problems;
}

/**
 * Linked components: each one a valid tree of its own, and each copy following its
 * component's tree, with no copy inside another.
 */
function linkProblems(doc: Doc): string[] {
  const problems: string[] = [];
  const comps = doc.components ?? {};
  for (const [id, c] of Object.entries(comps)) {
    const where = `Component ${id}`;
    if (c.id !== id) problems.push(`${where} is stored under the wrong id`);
    const root = Object.hasOwn(c.instances, c.rootId) ? c.instances[c.rootId] : undefined;
    if (!root) {
      problems.push(`${where} has no root`);
      continue;
    }
    if (root.parent !== null) problems.push(`${where}'s root has a parent`);
    if (classDef(root.className).kind !== 'gui') problems.push(`${where}'s root isn't an object`);
    const seen = new Set<InstanceId>();
    const walk = (key: InstanceId) => {
      if (seen.has(key)) return problems.push(`${where} reaches ${key} twice`);
      seen.add(key);
      const inst = c.instances[key]!;
      if (inst.id !== key) problems.push(`${where} stores ${key} under the wrong id`);
      if (inst.copyOf) problems.push(`${where}'s ${key} is marked as a copy`);
      const names = propNames(inst.className);
      for (const p of names)
        if (
          !valueEquals(
            normalizeProp(inst.className, p, (inst.props as Record<string, unknown>)[p]),
            (inst.props as Record<string, unknown>)[p],
          )
        )
          problems.push(`${where}'s ${key} has an invalid ${p}`);
      for (const ch of inst.children) {
        const child = Object.hasOwn(c.instances, ch) ? c.instances[ch] : undefined;
        if (!child || child.parent !== key)
          problems.push(`${where}'s ${key} lists ${ch}, which isn't its child`);
        else if (!canParent(child.className, inst.className))
          problems.push(`${where}'s ${child.className} can't sit inside a ${inst.className}`);
        else walk(ch);
      }
    };
    walk(c.rootId);
    if (seen.size !== Object.keys(c.instances).length)
      problems.push(`${where} has objects outside its tree`);
  }

  // Each copy: one object for each of its component's, in the same places.
  const walk = (id: InstanceId, inCopy: { c: Component; keys: Set<InstanceId> } | null) => {
    const inst = doc.instances[id];
    if (!inst) return;
    let next = inCopy;
    const link = inst.copyOf;
    const where = `${inst.className} ${id}`;
    if (link) {
      const c = Object.hasOwn(comps, link.component) ? comps[link.component] : undefined;
      const source = c && Object.hasOwn(c.instances, link.key) ? c.instances[link.key] : undefined;
      if (!c || !source) problems.push(`${where} is a copy of something the project doesn't have`);
      else if (source.className !== inst.className)
        problems.push(`${where} isn't the class it copies`);
      else if (link.key === c.rootId) {
        if (inCopy) problems.push(`${where} is a copy inside another copy`);
        next = { c, keys: new Set([link.key]) };
      } else if (inCopy?.c.id !== c.id) problems.push(`${where} is outside its copy`);
      else {
        const parentKey = doc.instances[inst.parent!]?.copyOf?.key;
        if (source.parent !== parentKey) problems.push(`${where} isn't where its component has it`);
        if (inCopy.keys.has(link.key)) problems.push(`${where} is in its copy twice`);
        inCopy.keys.add(link.key);
      }
    } else if (inCopy) problems.push(`${where} is in a copy but isn't part of it`);
    for (const ch of inst.children) walk(ch, next);
    if (next && next !== inCopy && next.keys.size !== Object.keys(next.c.instances).length)
      problems.push(`${where} is missing objects of its component`);
  };
  walk(doc.rootId, null);
  return problems;
}

function overrideProblems(doc: Doc, where: string, inst: AnyInstance): string[] {
  const problems: string[] = [];
  const overrides: Readonly<Record<string, Readonly<Record<string, unknown>>>> =
    inst.overrides ?? {};
  if (!Object.keys(overrides).length) problems.push(`${where} has an empty overrides map`);
  for (const [bp, changes] of Object.entries(overrides)) {
    if (getInstance(doc, bp)?.className !== 'Breakpoint')
      problems.push(`${where} has changes for ${bp}, which isn't a breakpoint`);
    if (!Object.keys(changes).length) problems.push(`${where} has an empty change list for ${bp}`);
    for (const [p, v] of Object.entries(changes)) {
      if (!isOverridable(inst.className, p))
        problems.push(`${where} can't change ${p} per breakpoint`);
      else if (!valueEquals(normalizeProp(inst.className, p, v), v))
        problems.push(`${where} has an invalid ${p} for ${bp}`);
    }
  }
  return problems;
}
