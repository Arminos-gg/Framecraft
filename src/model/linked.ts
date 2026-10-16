/**
 * Linked components, which work like Roblox Packages: an object made into a component keeps
 * its tree once in the document (`Doc.components`), and every linked copy follows it. An edit
 * to any copy changes the component and then every other copy, objects added or deleted
 * inside it included. Each copy keeps its own words, pictures and links, and its root keeps
 * its own place, size and name (`isOwnProp`).
 *
 * Copies are ordinary instances in the tree, each marked with `copyOf`, so layout, the Stage
 * and the exports read them like anything else. `syncCopies` runs after every command (see
 * `applyCommand`) and spreads what changed in a copy to the component and the other copies.
 * Copies don't nest: a copy put inside another copy becomes part of that one.
 */
import { classDef, propNames, propSpec, type ClassName } from './classes.ts';
import {
  breakpointsOf,
  getInstance,
  ModelError,
  newId,
  requireInstance,
  subtreeIds,
  type AnyInstance,
  type Component,
  type ComponentId,
  type Doc,
  type InstanceId,
  type Subtree,
} from './document.ts';
import { valueEquals } from './values.ts';

/** What every object in a copy keeps for itself: its words, pictures and links. */
export const CONTENT_PROPS: readonly string[] = [
  'Text',
  'PlaceholderText',
  'Image',
  'AltText',
  'Link',
  'Source',
  'Title',
];
/** What a copy's root keeps for itself as well: where it sits, how big it is, and its name. */
export const PLACE_PROPS: readonly string[] = [
  'Name',
  'Position',
  'Size',
  'AnchorPoint',
  'Rotation',
  'LayoutOrder',
  'ZIndex',
  'Visible',
  'Pinned',
];

/** Whether each copy keeps its own value of a property (an image's picture goes with Image). */
export function isOwnProp(className: ClassName, key: string, root: boolean): boolean {
  if (!propSpec(className, key)) return false;
  return CONTENT_PROPS.includes(key) || (root && PLACE_PROPS.includes(key));
}

/** A set of instances and components to put in place as they are; null removes one. */
export interface Patch {
  readonly instances: Readonly<Record<InstanceId, AnyInstance | null>>;
  readonly components?: Readonly<Record<ComponentId, Component | null>>;
}

type Overrides = Readonly<Record<InstanceId, Readonly<Record<string, unknown>>>>;
type Mutable = Record<string, unknown>;

export const componentList = (doc: Doc): Component[] => Object.values(doc.components ?? {});

export const getComponent = (doc: Doc, id: ComponentId): Component | undefined =>
  doc.components && Object.hasOwn(doc.components, id) ? doc.components[id] : undefined;

/** A component's name: its root's name when it was made. */
export const componentName = (c: Component): string =>
  c.instances[c.rootId]?.props.Name ?? 'Component';

/** Whether an instance is the root of a linked copy. */
export function isCopyRoot(doc: Doc, inst: AnyInstance | undefined): boolean {
  if (!inst?.copyOf) return false;
  return getComponent(doc, inst.copyOf.component)?.rootId === inst.copyOf.key;
}

/** The root of the linked copy an instance is in (itself, when it's the root), if any. */
export function copyRootOf(doc: Doc, id: InstanceId): AnyInstance | undefined {
  for (
    let inst = getInstance(doc, id);
    inst;
    inst = inst.parent === null ? undefined : getInstance(doc, inst.parent)
  )
    if (isCopyRoot(doc, inst)) return inst;
  return undefined;
}

/** The roots of a component's copies, in tree order. */
export function copiesOf(doc: Doc, componentId: ComponentId): AnyInstance[] {
  const c = getComponent(doc, componentId);
  if (!c) return [];
  return subtreeIds(doc, doc.rootId)
    .map((id) => doc.instances[id]!)
    .filter((i) => i.copyOf?.component === componentId && i.copyOf.key === c.rootId);
}

/** The component's own object that a copy's object follows. */
export function sourceOf(doc: Doc, inst: AnyInstance): AnyInstance | undefined {
  if (!inst.copyOf) return undefined;
  const c = getComponent(doc, inst.copyOf.component);
  const d =
    c && Object.hasOwn(c.instances, inst.copyOf.key) ? c.instances[inst.copyOf.key] : undefined;
  return d?.className === inst.className ? d : undefined;
}

/**
 * The properties a copy's object has changed from its component: its own properties whose
 * value, at any breakpoint, isn't the component's.
 */
export function ownChanges(doc: Doc, inst: AnyInstance): string[] {
  const d = sourceOf(doc, inst);
  if (!d) return [];
  const root = inst.copyOf!.key === getComponent(doc, inst.copyOf!.component)!.rootId;
  const p: Mutable = inst.props;
  const q: Mutable = d.props;
  return (propNames(inst.className) as string[]).filter((k) => {
    if (!isOwnProp(inst.className, k, root)) return false;
    if (root && PLACE_PROPS.includes(k)) return false;
    if (!valueEquals(p[k], q[k])) return true;
    if (k === 'Image' && inst.preview !== d.preview) return true;
    const mine = overridesOf(inst, k);
    const theirs = overridesOf(d, k);
    return !valueEquals(mine, theirs);
  });
}

function overridesOf(inst: AnyInstance, key: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [bp, changes] of Object.entries((inst.overrides ?? {}) as Overrides))
    if (Object.hasOwn(changes, key)) out[bp] = changes[key];
  return out;
}

/** Whether any object in a copy has its own words, pictures or links. */
export const copyHasChanges = (doc: Doc, rootId: InstanceId): boolean =>
  subtreeIds(doc, rootId).some((id) => ownChanges(doc, doc.instances[id]!).length > 0);

const withoutCopyOf = (inst: AnyInstance): AnyInstance => {
  if (!inst.copyOf) return inst;
  const { copyOf: _gone, ...rest } = inst;
  void _gone;
  return rest as AnyInstance;
};

/**
 * Makes an object a component: its tree becomes the component, and the object its first
 * copy. Copies inside it stop following their component and become part of the new one.
 */
export function makeComponent(
  doc: Doc,
  id: InstanceId,
  makeId: () => InstanceId = newId,
): { patch: Patch; componentId: ComponentId } {
  const inst = requireInstance(doc, id);
  if (classDef(inst.className).kind !== 'gui')
    throw new ModelError('Only an object, such as a Frame or a button, can be a component.');
  const outer = inst.parent === null ? undefined : copyRootOf(doc, inst.parent);
  if (outer)
    throw new ModelError(
      `${inst.props.Name} is inside a copy of ${componentName(getComponent(doc, outer.copyOf!.component)!)}. Detach that copy first.`,
    );
  const componentId = makeId();
  const ids = subtreeIds(doc, id);
  const keyOf = new Map(ids.map((i) => [i, makeId()]));
  const own: Record<InstanceId, AnyInstance> = {};
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const i of ids) {
    const it = withoutCopyOf(requireInstance(doc, i));
    const key = keyOf.get(i)!;
    own[key] = {
      ...it,
      id: key,
      parent: i === id ? null : keyOf.get(it.parent!)!,
      children: it.children.map((c) => keyOf.get(c)!),
    };
    instances[i] = { ...it, copyOf: { component: componentId, key } };
  }
  const component: Component = { id: componentId, rootId: keyOf.get(id)!, instances: own };
  return { patch: { instances, components: { [componentId]: component } }, componentId };
}

/** Turns a copy back into plain objects that no longer follow the component. */
export function detachCopy(doc: Doc, id: InstanceId): Patch {
  const root = copyRootOf(doc, id);
  if (!root) return { instances: {} };
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const i of subtreeIds(doc, root.id)) instances[i] = withoutCopyOf(doc.instances[i]!);
  return { instances };
}

/** Deletes a component; its copies stay as plain objects. */
export function deleteComponent(doc: Doc, componentId: ComponentId): Patch {
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const root of copiesOf(doc, componentId))
    Object.assign(instances, detachCopy(doc, root.id).instances);
  return { instances, components: { [componentId]: null } };
}

/**
 * Puts a copy's own words, pictures and links back to the component's: `keys` on one
 * object, or every one of them (place and name aside) on every object in the copy.
 */
export function resetCopy(doc: Doc, id: InstanceId, keys?: readonly string[]): Patch {
  const instances: Record<InstanceId, AnyInstance> = {};
  const targets = keys ? [id] : subtreeIds(doc, copyRootOf(doc, id)?.id ?? id);
  for (const i of targets) {
    const inst = doc.instances[i]!;
    const d = sourceOf(doc, inst);
    if (!d) continue;
    const reset = keys ?? ownChanges(doc, inst);
    if (!reset.length) continue;
    const props: Mutable = { ...inst.props };
    for (const k of reset) props[k] = (d.props as Mutable)[k];
    const next: Mutable = { ...inst, props };
    const overrides = mixOverrides(inst.overrides, d.overrides, (k) => reset.includes(k));
    if (overrides) next.overrides = overrides;
    else delete next.overrides;
    if (reset.includes('Image')) {
      if (d.preview === undefined) delete next.preview;
      else next.preview = d.preview;
    }
    instances[i] = next as unknown as AnyInstance;
  }
  return { instances };
}

/** A new linked copy of a component, ready to insert. */
export function newCopy(
  doc: Doc,
  componentId: ComponentId,
  makeId: () => InstanceId = newId,
): Subtree {
  const c = getComponent(doc, componentId);
  if (!c) throw new ModelError('That component is gone.');
  const idOf = new Map(Object.keys(c.instances).map((k) => [k, makeId()]));
  const bps = new Set(breakpointsOf(doc).map((b) => b.id));
  const instances: Record<InstanceId, AnyInstance> = {};
  for (const [key, d] of Object.entries(c.instances)) {
    const node: Mutable = {
      ...d,
      id: idOf.get(key)!,
      parent: d.parent === null ? null : idOf.get(d.parent)!,
      children: d.children.map((k) => idOf.get(k)!),
      copyOf: { component: componentId, key },
    };
    const overrides = mixOverrides(
      d.overrides,
      undefined,
      () => false,
      (bp) => bps.has(bp),
    );
    if (overrides) node.overrides = overrides;
    else delete node.overrides;
    instances[node.id as InstanceId] = node as unknown as AnyInstance;
  }
  return { rootId: idOf.get(c.rootId)!, instances };
}

/**
 * One set of breakpoint changes from two: the shared properties from `shared`, the ones
 * `isOwn` picks from `own`, for the breakpoints `keep` allows.
 */
function mixOverrides(
  shared: Overrides | undefined,
  own: Overrides | undefined,
  isOwn: (key: string) => boolean,
  keep: (bp: InstanceId) => boolean = () => true,
): Overrides | undefined {
  const out: Record<InstanceId, Record<string, unknown>> = {};
  const bps = new Set([...Object.keys(shared ?? {}), ...Object.keys(own ?? {})]);
  for (const bp of bps) {
    if (!keep(bp)) continue;
    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(shared?.[bp] ?? {})) if (!isOwn(k)) changes[k] = v;
    for (const [k, v] of Object.entries(own?.[bp] ?? {})) if (isOwn(k)) changes[k] = v;
    if (Object.keys(changes).length) out[bp] = changes;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The component as an edited copy makes it: the copy's tree and shared properties, with the
 * component's own values of the properties each copy keeps. Objects new to the copy join the
 * component as they are. Also returns the key each of the copy's objects now follows.
 */
function mergeCopy(
  doc: Doc,
  c: Component,
  rootId: InstanceId,
): { component: Component; keys: Map<InstanceId, InstanceId> } {
  const used = new Set<InstanceId>();
  const keys = new Map<InstanceId, InstanceId>();
  const instances: Record<InstanceId, AnyInstance> = {};
  const walk = (id: InstanceId, parentKey: InstanceId | null): InstanceId => {
    const inst = requireInstance(doc, id);
    let key: InstanceId | undefined;
    if (parentKey === null) key = c.rootId;
    else if (inst.copyOf?.component === c.id) {
      const k = inst.copyOf.key;
      const old = Object.hasOwn(c.instances, k) ? c.instances[k] : undefined;
      if (k !== c.rootId && !used.has(k) && old?.className === inst.className) key = k;
    }
    // Something new, or a second copy of one object (pasted into the copy): it joins.
    key ??= newId();
    used.add(key);
    keys.set(id, key);
    const children = inst.children.map((ch) => walk(ch, key));
    const old = Object.hasOwn(c.instances, key) ? c.instances[key] : undefined;
    const root = parentKey === null;
    const node: Mutable = { ...withoutCopyOf(inst), id: key, parent: parentKey, children };
    if (old && old.className === inst.className) {
      const own = (k: string) => isOwnProp(inst.className, k, root);
      const props: Mutable = { ...inst.props };
      for (const k of propNames(inst.className)) if (own(k)) props[k] = (old.props as Mutable)[k];
      node.props = props;
      const overrides = mixOverrides(inst.overrides, old.overrides, own);
      if (overrides) node.overrides = overrides;
      else delete node.overrides;
      if (old.preview === undefined) delete node.preview;
      else node.preview = old.preview;
    }
    instances[key] = node as unknown as AnyInstance;
    return key;
  };
  walk(rootId, null);
  return { component: { id: c.id, rootId: c.rootId, instances }, keys };
}

/**
 * The changes that make a copy follow its component again: its tree and shared properties
 * become the component's, and it keeps its own values of the properties each copy keeps.
 * Objects the component lost go; ones it gained come in with its values.
 */
function rebuildCopy(
  doc: Doc,
  c: Component,
  rootId: InstanceId,
): Record<InstanceId, AnyInstance | undefined> {
  const root = requireInstance(doc, rootId);
  const ids = subtreeIds(doc, rootId);
  const existing = new Map<InstanceId, AnyInstance>([[c.rootId, root]]);
  for (const id of ids.slice(1)) {
    const inst = doc.instances[id]!;
    const k = inst.copyOf?.component === c.id ? inst.copyOf.key : undefined;
    if (
      k !== undefined &&
      k !== c.rootId &&
      !existing.has(k) &&
      Object.hasOwn(c.instances, k) &&
      c.instances[k]!.className === inst.className
    )
      existing.set(k, inst);
  }
  const bps = new Set(breakpointsOf(doc).map((b) => b.id));
  const idOf = new Map<InstanceId, InstanceId>();
  for (const key of Object.keys(c.instances)) idOf.set(key, existing.get(key)?.id ?? newId());
  const changes: Record<InstanceId, AnyInstance | undefined> = {};
  const kept = new Set<InstanceId>();
  for (const [key, d] of Object.entries(c.instances)) {
    const e = existing.get(key);
    const isRoot = key === c.rootId;
    const own = (k: string) => isOwnProp(d.className, k, isRoot);
    const src = e ?? d;
    const props: Mutable = {};
    for (const k of propNames(d.className))
      props[k] = (own(k) ? (src.props as Mutable) : (d.props as Mutable))[k];
    const id = idOf.get(key)!;
    const node: Mutable = {
      id,
      className: d.className,
      parent: isRoot ? root.parent : idOf.get(d.parent!)!,
      children: d.children.map((k) => idOf.get(k)!),
      props,
    };
    const overrides = mixOverrides(d.overrides, src.overrides, own, (bp) => bps.has(bp));
    if (overrides) node.overrides = overrides;
    if (src.preview !== undefined) node.preview = src.preview;
    node.copyOf = { component: c.id, key };
    kept.add(id);
    if (!e || !valueEquals(e, node)) changes[id] = node as unknown as AnyInstance;
  }
  for (const id of ids) if (!kept.has(id)) changes[id] = undefined;
  return changes;
}

/**
 * Spreads a command's changes to linked copies: what changed in a copy goes to its component
 * and from there to every other copy, and a new copy (pasted or duplicated) is made to follow
 * its component. Marks that no longer fit are dropped: an object taken out of its copy, a copy
 * put inside another one, or a copy of a component the project doesn't have. Returns `after`
 * itself when there's nothing to do.
 */
export function syncCopies(before: Doc, after: Doc): Doc {
  const comps = after.components ?? {};
  const changed: InstanceId[] = [];
  for (const id of Object.keys(after.instances))
    if (after.instances[id] !== before.instances[id]) changed.push(id);
  if (!changed.length) return after;
  if (!Object.keys(comps).length && !changed.some((id) => after.instances[id]!.copyOf))
    return after;

  const instances: Record<InstanceId, AnyInstance | undefined> = { ...after.instances };
  let dirty = false;
  const put = (id: InstanceId, inst: AnyInstance | undefined) => {
    instances[id] = inst;
    dirty = true;
  };
  let components: Record<ComponentId, Component> = { ...comps };
  const work = (): Doc => ({
    rootId: after.rootId,
    instances: instances as Record<InstanceId, AnyInstance>,
    components,
  });

  // Drop marks that no longer fit, walking down with the component whose copy we're in.
  const stripped: InstanceId[] = [];
  const walk = (id: InstanceId, inCopy: ComponentId | null) => {
    const inst = instances[id]!;
    let next = inCopy;
    const c = inst.copyOf;
    if (c) {
      const comp = Object.hasOwn(comps, c.component) ? comps[c.component] : undefined;
      const fits =
        comp !== undefined && (c.key === comp.rootId ? inCopy === null : inCopy === c.component);
      if (fits && c.key === comp.rootId) next = c.component;
      if (!fits) {
        put(id, withoutCopyOf(inst));
        stripped.push(id);
      }
    }
    for (const ch of inst.children) walk(ch, next);
  };
  walk(after.rootId, null);

  // The copies the command touched: edited ones, and new ones (pasted or duplicated).
  const doc = work();
  const touchedRoots = new Map<InstanceId, boolean>();
  for (const id of [...changed, ...stripped]) {
    if (!instances[id]) continue;
    const r = copyRootOf(doc, id);
    if (!r) continue;
    const prev = before.instances[r.id];
    const edit =
      prev?.copyOf?.component === r.copyOf!.component && prev.copyOf.key === r.copyOf!.key;
    touchedRoots.set(r.id, (touchedRoots.get(r.id) ?? false) || edit);
  }
  if (!touchedRoots.size && !dirty) return after;

  const order = new Map(subtreeIds(doc, doc.rootId).map((id, i) => [id, i]));
  const roots = [...touchedRoots.keys()].sort((a, b) => order.get(a)! - order.get(b)!);
  const changedComps = new Set<ComponentId>();
  for (const r of roots) {
    if (!touchedRoots.get(r)) continue;
    const cid = instances[r]!.copyOf!.component;
    const { component, keys } = mergeCopy(work(), components[cid]!, r);
    for (const [id, key] of keys) {
      const inst = instances[id]!;
      if (inst.copyOf?.component !== cid || inst.copyOf.key !== key)
        put(id, { ...inst, copyOf: { component: cid, key } });
    }
    if (!valueEquals(component, components[cid])) {
      components = { ...components, [cid]: component };
      changedComps.add(cid);
    }
  }

  const rebuild = (rootId: InstanceId) => {
    const cid = instances[rootId]!.copyOf!.component;
    for (const [id, inst] of Object.entries(rebuildCopy(work(), components[cid]!, rootId)))
      put(id, inst);
  };
  for (const cid of changedComps) for (const r of copiesOf(work(), cid)) rebuild(r.id);
  for (const r of roots) if (!changedComps.has(instances[r]!.copyOf!.component)) rebuild(r);

  if (!dirty && !changedComps.size) return after;
  for (const [id, inst] of Object.entries(instances)) if (!inst) delete instances[id];
  return { ...after, instances: instances as Record<InstanceId, AnyInstance>, components };
}
