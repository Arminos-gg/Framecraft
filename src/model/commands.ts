/**
 * Commands: the only way to change a document. Each one returns the new document and the
 * command that reverses it, which is what undo and redo replay.
 */
import {
  canParent,
  classDef,
  isOverridable,
  normalizeProp,
  type ClassName,
  type PropsOf,
} from './classes.ts';
import {
  extractSubtree,
  getInstance,
  isAncestor,
  ModelError,
  requireInstance,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
  type Subtree,
} from './document.ts';
import { ASSET_ID_PATTERN, valueEquals, type AssetId } from './values.ts';

export type Command =
  /** Put a detached subtree inside `parentId`, at `index` among its children (default: last). */
  | {
      readonly type: 'insert';
      readonly parentId: InstanceId;
      readonly index?: number;
      readonly subtree: Subtree;
    }
  /** Remove an instance and everything inside it. */
  | { readonly type: 'delete'; readonly id: InstanceId }
  /** Reparent or reorder: `index` is the position among the new parent's other children. */
  | {
      readonly type: 'move';
      readonly id: InstanceId;
      readonly parentId: InstanceId;
      readonly index?: number;
    }
  /**
   * Change properties. With `breakpoint`, changes that breakpoint's values instead of the base
   * ones, and `clear` drops its changes to some properties so they show the inherited value
   * again. `preview` sets (an image id) or clears (null) an image's preview picture.
   */
  | {
      readonly type: 'setProps';
      readonly id: InstanceId;
      readonly props: Readonly<Record<string, unknown>>;
      readonly breakpoint?: InstanceId;
      readonly clear?: readonly string[];
      readonly preview?: AssetId | null;
    }
  /** Several commands as one step. */
  | { readonly type: 'batch'; readonly commands: readonly Command[] };

export interface Applied {
  readonly doc: Doc;
  /** Applying this to `doc` gives back the original document. */
  readonly inverse: Command;
  /** False when the command left the document as it was. */
  readonly changed: boolean;
}

export const insert = (parentId: InstanceId, subtree: Subtree, index?: number): Command => ({
  type: 'insert',
  parentId,
  subtree,
  index,
});
export const remove = (id: InstanceId): Command => ({ type: 'delete', id });
export const move = (id: InstanceId, parentId: InstanceId, index?: number): Command => ({
  type: 'move',
  id,
  parentId,
  index,
});
/**
 * Typed property edit: the property names and value types come from the instance's class.
 * With a breakpoint, only that breakpoint (and narrower ones that don't change it) shows it.
 */
export function setProps<C extends ClassName>(
  target: Instance<C>,
  props: Partial<PropsOf<C>>,
  breakpoint?: InstanceId,
): Command {
  return breakpoint === undefined
    ? { type: 'setProps', id: target.id, props }
    : { type: 'setProps', id: target.id, props, breakpoint };
}
/** Puts properties back to what a breakpoint inherits, dropping its own changes. */
export const resetOverrides = (
  id: InstanceId,
  breakpoint: InstanceId,
  keys: readonly string[],
): Command => ({ type: 'setProps', id, props: {}, breakpoint, clear: keys });
export const setPreview = (id: InstanceId, preview: AssetId | null): Command => ({
  type: 'setProps',
  id,
  props: {},
  preview,
});
export const batch = (...commands: Command[]): Command => ({ type: 'batch', commands });

/**
 * Applies a command. Throws a ModelError, leaving nothing changed, when the command breaks
 * the document's rules: a missing instance, a class that can't sit in that parent, a move
 * into its own descendant, or an invalid property value.
 */
export function applyCommand(doc: Doc, cmd: Command): Applied {
  switch (cmd.type) {
    case 'insert':
      return applyInsert(doc, cmd.parentId, cmd.subtree, cmd.index);
    case 'delete':
      return applyDelete(doc, cmd.id);
    case 'move':
      return applyMove(doc, cmd.id, cmd.parentId, cmd.index);
    case 'setProps':
      if (cmd.breakpoint === undefined) {
        if (cmd.clear?.length) throw new ModelError('Only a breakpoint has changes to reset');
        return applySetProps(doc, cmd.id, cmd.props, cmd.preview);
      }
      if (cmd.preview !== undefined)
        throw new ModelError('A preview picture is the same at every breakpoint');
      return applySetOverrides(doc, cmd.id, cmd.breakpoint, cmd.props, cmd.clear ?? []);
    case 'batch': {
      let current = doc;
      let changed = false;
      const inverses: Command[] = [];
      for (const c of cmd.commands) {
        const r = applyCommand(current, c);
        current = r.doc;
        changed ||= r.changed;
        inverses.unshift(r.inverse);
      }
      return { doc: current, inverse: { type: 'batch', commands: inverses }, changed };
    }
  }
}

/** A new document with some instances replaced (an instance) or removed (undefined). */
function patch(doc: Doc, changes: Record<InstanceId, AnyInstance | undefined>): Doc {
  const instances = { ...doc.instances };
  for (const [id, inst] of Object.entries(changes)) {
    if (inst) instances[id] = inst;
    else delete instances[id];
  }
  return { ...doc, instances };
}

const clampIndex = (index: number | undefined, length: number) =>
  index === undefined ? length : Math.min(length, Math.max(0, Math.trunc(index)));

const withChild = (list: readonly InstanceId[], id: InstanceId, index?: number) => {
  const out = [...list];
  out.splice(clampIndex(index, out.length), 0, id);
  return out;
};

function applyInsert(doc: Doc, parentId: InstanceId, subtree: Subtree, index?: number): Applied {
  const parent = requireInstance(doc, parentId);
  const root = subtree.instances[subtree.rootId];
  if (!root) throw new ModelError('The subtree has no root');
  if (!canParent(root.className, parent.className))
    throw new ModelError(`A ${root.className} can't go inside a ${parent.className}`);
  if (
    classDef(root.className).unique &&
    parent.children.some((c) => doc.instances[c]?.className === root.className)
  )
    throw new ModelError(`There is already a ${root.className}`);
  const changes: Record<InstanceId, AnyInstance> = {};
  for (const [id, inst] of Object.entries(subtree.instances)) {
    if (getInstance(doc, id)) throw new ModelError(`An instance with id ${id} already exists`);
    for (const bp of Object.keys(inst.overrides ?? {})) {
      if (getInstance(doc, bp)?.className !== 'Breakpoint')
        throw new ModelError(
          `${inst.props.Name} has changes for a breakpoint this project doesn't have`,
        );
    }
    if (inst.preview !== undefined && !ASSET_ID_PATTERN.test(inst.preview))
      throw new ModelError(`${inst.props.Name} has an invalid preview picture id`);
    changes[id] = inst;
  }
  changes[root.id] = { ...root, parent: parentId };
  changes[parentId] = { ...parent, children: withChild(parent.children, root.id, index) };
  return { doc: patch(doc, changes), inverse: remove(root.id), changed: true };
}

const isFixed = (inst: AnyInstance) => {
  const { kind } = classDef(inst.className);
  return kind === 'root' || kind === 'service';
};

function applyDelete(doc: Doc, id: InstanceId): Applied {
  const inst = requireInstance(doc, id);
  if (inst.parent === null || isFixed(inst))
    throw new ModelError(`The ${inst.className} can't be deleted`);
  const parent = requireInstance(doc, inst.parent);
  const index = parent.children.indexOf(id);
  const subtree = extractSubtree(doc, id);
  const changes: Record<InstanceId, AnyInstance | undefined> = {};
  for (const i of subtreeIds(doc, id)) changes[i] = undefined;
  changes[parent.id] = { ...parent, children: parent.children.filter((c) => c !== id) };
  const inverse = insert(parent.id, subtree, index);
  if (inst.className !== 'Breakpoint') return { doc: patch(doc, changes), inverse, changed: true };

  // A deleted breakpoint takes its changes with it; undo puts them back.
  const restore: Command[] = [];
  for (const other of Object.values(doc.instances)) {
    const own = other.overrides?.[id];
    if (!own) continue;
    restore.push({ type: 'setProps', id: other.id, props: own, breakpoint: id });
    changes[other.id] = withOverrides(other, id, undefined);
  }
  return {
    doc: patch(doc, changes),
    inverse: restore.length ? batch(inverse, ...restore) : inverse,
    changed: true,
  };
}

function applyMove(doc: Doc, id: InstanceId, parentId: InstanceId, index?: number): Applied {
  const inst = requireInstance(doc, id);
  const target = requireInstance(doc, parentId);
  if (inst.parent === null || isFixed(inst))
    throw new ModelError(`The ${inst.className} can't be moved`);
  if (id === parentId || isAncestor(doc, id, parentId))
    throw new ModelError(`${inst.props.Name} can't go inside itself`);
  if (!canParent(inst.className, target.className))
    throw new ModelError(`A ${inst.className} can't go inside a ${target.className}`);

  const oldParent = requireInstance(doc, inst.parent);
  const oldIndex = oldParent.children.indexOf(id);
  const inverse = move(id, oldParent.id, oldIndex);
  const without = (p: AnyInstance) => p.children.filter((c) => c !== id);
  const children = withChild(without(target), id, index);

  if (oldParent.id === parentId) {
    if (children.indexOf(id) === oldIndex) return { doc, inverse, changed: false };
    return { doc: patch(doc, { [parentId]: { ...target, children } }), inverse, changed: true };
  }
  const changes = {
    [oldParent.id]: { ...oldParent, children: without(oldParent) },
    [parentId]: { ...target, children },
    [id]: { ...inst, parent: parentId },
  };
  return { doc: patch(doc, changes), inverse, changed: true };
}

function applySetProps(
  doc: Doc,
  id: InstanceId,
  props: Readonly<Record<string, unknown>>,
  preview: AssetId | null | undefined,
): Applied {
  const inst = requireInstance(doc, id);
  const current: Record<string, unknown> = inst.props;
  const next: Record<string, unknown> = {};
  const old: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const v = normalizeProp(inst.className, key, value);
    if (v === undefined)
      throw new ModelError(`${inst.className} can't take ${key} = ${JSON.stringify(value)}`);
    if (!valueEquals(v, current[key])) {
      next[key] = v;
      old[key] = current[key];
    }
  }

  let oldPreview: AssetId | null | undefined;
  if (preview !== undefined && preview !== (inst.preview ?? null)) {
    if (!classDef(inst.className).image)
      throw new ModelError(`A ${inst.className} can't have a preview picture`);
    if (preview !== null && !ASSET_ID_PATTERN.test(preview))
      throw new ModelError(`${preview} isn't an image library id`);
    oldPreview = inst.preview ?? null;
  }

  const inverse: Command = { type: 'setProps', id, props: old, preview: oldPreview };
  if (!Object.keys(next).length && oldPreview === undefined)
    return { doc, inverse, changed: false };

  const updated: Record<string, unknown> = { ...inst, props: { ...current, ...next } };
  if (oldPreview !== undefined) {
    if (preview === null) delete updated.preview;
    else updated.preview = preview;
  }
  return { doc: patch(doc, { [id]: updated as unknown as AnyInstance }), inverse, changed: true };
}

/** The instance with one breakpoint's changes replaced, or removed when there are none. */
function withOverrides(
  inst: AnyInstance,
  breakpoint: InstanceId,
  changes: Readonly<Record<string, unknown>> | undefined,
): AnyInstance {
  const overrides: Record<InstanceId, unknown> = { ...inst.overrides };
  if (changes && Object.keys(changes).length) overrides[breakpoint] = changes;
  else delete overrides[breakpoint];
  const updated: Record<string, unknown> = { ...inst, overrides };
  // Keep documents canonical: no empty maps, so equal documents compare equal.
  if (!Object.keys(overrides).length) delete updated.overrides;
  return updated as unknown as AnyInstance;
}

function applySetOverrides(
  doc: Doc,
  id: InstanceId,
  breakpoint: InstanceId,
  props: Readonly<Record<string, unknown>>,
  clear: readonly string[],
): Applied {
  const inst = requireInstance(doc, id);
  if (getInstance(doc, breakpoint)?.className !== 'Breakpoint')
    throw new ModelError(`No breakpoint with id ${breakpoint}`);
  const current: Record<string, unknown> = inst.overrides?.[breakpoint] ?? {};
  const next: Record<string, unknown> = { ...current };
  const old: Record<string, unknown> = {};
  const oldClear: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (!isOverridable(inst.className, key))
      throw new ModelError(`${inst.className} can't change ${key} per breakpoint`);
    if (clear.includes(key)) throw new ModelError(`${key} can't be set and reset at once`);
    const v = normalizeProp(inst.className, key, value);
    if (v === undefined)
      throw new ModelError(`${inst.className} can't take ${key} = ${JSON.stringify(value)}`);
    // A breakpoint keeps a value set on it even when it matches the inherited one, so a
    // later change to the base doesn't reach it.
    if (Object.hasOwn(current, key)) {
      if (valueEquals(v, current[key])) continue;
      old[key] = current[key];
    } else oldClear.push(key);
    next[key] = v;
  }
  for (const key of new Set(clear)) {
    if (!Object.hasOwn(current, key)) continue;
    old[key] = current[key];
    delete next[key];
  }

  const inverse: Command = oldClear.length
    ? { type: 'setProps', id, props: old, breakpoint, clear: oldClear }
    : { type: 'setProps', id, props: old, breakpoint };
  if (!Object.keys(old).length && !oldClear.length) return { doc, inverse, changed: false };
  return {
    doc: patch(doc, { [id]: withOverrides(inst, breakpoint, next) }),
    inverse,
    changed: true,
  };
}
