/**
 * Commands: the only way to change a document. Each one returns the new document and the
 * command that reverses it, which is what undo and redo replay.
 */
import { canParent, classDef, normalizeProp, type ClassName, type PropsOf } from './classes.ts';
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
import { valueEquals } from './values.ts';

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
  /** Change properties. `preview` sets (string) or clears (null) an image's preview picture. */
  | {
      readonly type: 'setProps';
      readonly id: InstanceId;
      readonly props: Readonly<Record<string, unknown>>;
      readonly preview?: string | null;
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
/** Typed property edit: the property names and value types come from the instance's class. */
export function setProps<C extends ClassName>(
  target: Instance<C>,
  props: Partial<PropsOf<C>>,
): Command {
  return { type: 'setProps', id: target.id, props };
}
export const setPreview = (id: InstanceId, preview: string | null): Command => ({
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
      return applySetProps(doc, cmd.id, cmd.props, cmd.preview);
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
  const changes: Record<InstanceId, AnyInstance> = {};
  for (const [id, inst] of Object.entries(subtree.instances)) {
    if (getInstance(doc, id)) throw new ModelError(`An instance with id ${id} already exists`);
    changes[id] = inst;
  }
  changes[root.id] = { ...root, parent: parentId };
  changes[parentId] = { ...parent, children: withChild(parent.children, root.id, index) };
  return { doc: patch(doc, changes), inverse: remove(root.id), changed: true };
}

function applyDelete(doc: Doc, id: InstanceId): Applied {
  const inst = requireInstance(doc, id);
  if (inst.parent === null) throw new ModelError(`The ${inst.className} root can't be deleted`);
  const parent = requireInstance(doc, inst.parent);
  const index = parent.children.indexOf(id);
  const subtree = extractSubtree(doc, id);
  const changes: Record<InstanceId, AnyInstance | undefined> = {};
  for (const i of subtreeIds(doc, id)) changes[i] = undefined;
  changes[parent.id] = { ...parent, children: parent.children.filter((c) => c !== id) };
  return { doc: patch(doc, changes), inverse: insert(parent.id, subtree, index), changed: true };
}

function applyMove(doc: Doc, id: InstanceId, parentId: InstanceId, index?: number): Applied {
  const inst = requireInstance(doc, id);
  const target = requireInstance(doc, parentId);
  if (inst.parent === null) throw new ModelError(`The ${inst.className} root can't be moved`);
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
  preview: string | null | undefined,
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

  let oldPreview: string | null | undefined;
  if (preview !== undefined && preview !== (inst.preview ?? null)) {
    if (!classDef(inst.className).image)
      throw new ModelError(`A ${inst.className} can't have a preview picture`);
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
