import { expect } from 'vitest';
import { validateDoc, type Doc, type InstanceId } from '../../../src/model/document.ts';
import { sampleDoc } from '../../../src/model/sample.ts';

/** Predictable ids: i1, i2, ... */
export function counterIds(prefix = 'i'): () => InstanceId {
  let n = 0;
  return () => `${prefix}${++n}`;
}

/** The sample game menu with predictable ids. */
export const sample = (): Doc => sampleDoc(counterIds());

/** Looks up an instance by Name; fails the test when there isn't exactly one. */
export function byName(doc: Doc, name: string) {
  const found = Object.values(doc.instances).filter((i) => i.props.Name === name);
  expect(found, `instances named ${name}`).toHaveLength(1);
  return found[0]!;
}

export const childNames = (doc: Doc, id: InstanceId) =>
  doc.instances[id]!.children.map((c) => doc.instances[c]!.props.Name);

export function expectValid(doc: Doc) {
  expect(validateDoc(doc)).toEqual([]);
}

/** The tree without ids, for comparing documents built with different ids. */
export function shape(doc: Doc, id: InstanceId = doc.rootId): unknown {
  const inst = doc.instances[id]!;
  return {
    className: inst.className,
    props: inst.props,
    preview: inst.preview,
    children: inst.children.map((c) => shape(doc, c)),
  };
}
