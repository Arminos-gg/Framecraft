import { expect } from 'vitest';
import {
  breakpointsOf,
  subtreeIds,
  validateDoc,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../../../src/model/document.ts';
import type { ClassName } from '../../../src/model/classes.ts';
import { sampleDoc, sampleSite } from '../../../src/model/sample.ts';

/** Predictable ids: i1, i2, ... */
export function counterIds(prefix = 'i'): () => InstanceId {
  let n = 0;
  return () => `${prefix}${++n}`;
}

/** The sample game menu with predictable ids. */
export const sample = (): Doc => sampleDoc(counterIds());

/** The sample website with predictable ids. */
export const site = (): Doc => sampleSite(counterIds());

/**
 * Looks up an instance by Name, anywhere or inside the instance named `within`; fails the test
 * when there isn't exactly one.
 */
export function byName(doc: Doc, name: string, within?: string): AnyInstance {
  const scope =
    within === undefined ? Object.keys(doc.instances) : subtreeIds(doc, byName(doc, within).id);
  const found = scope.map((id) => doc.instances[id]!).filter((i) => i.props.Name === name);
  expect(found, `instances named ${name}`).toHaveLength(1);
  return found[0]!;
}

/** Narrows an instance to its class, so typed commands such as setProps accept it. */
export function ofClass<C extends ClassName>(inst: AnyInstance, className: C): Instance<C> {
  expect(inst.className).toBe(className);
  return inst as unknown as Instance<C>;
}

/** A breakpoint's id by its Name. */
export function bp(doc: Doc, name: string): InstanceId {
  const found = breakpointsOf(doc).find((b) => b.props.Name === name);
  expect(found, `breakpoint ${name}`).toBeDefined();
  return found!.id;
}

export const childNames = (doc: Doc, id: InstanceId) =>
  doc.instances[id]!.children.map((c) => doc.instances[c]!.props.Name);

export function expectValid(doc: Doc) {
  expect(validateDoc(doc)).toEqual([]);
}

/**
 * The tree without ids, for comparing documents built with different ids. Changes per
 * breakpoint are keyed by the breakpoint's Name.
 */
export function shape(doc: Doc, id: InstanceId = doc.rootId): unknown {
  const inst = doc.instances[id]!;
  const overrides = inst.overrides
    ? Object.fromEntries(
        Object.entries(inst.overrides).map(([b, v]) => [doc.instances[b]!.props.Name, v]),
      )
    : undefined;
  return {
    className: inst.className,
    props: inst.props,
    overrides,
    preview: inst.preview,
    children: inst.children.map((c) => shape(doc, c)),
  };
}
