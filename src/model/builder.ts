/**
 * Builds documents in code, through the same commands the editor uses. The samples and the
 * starter templates are made with it.
 */
import type { ClassName, PropsOf } from './classes.ts';
import { applyCommand, insert } from './commands.ts';
import {
  breakpointsOf,
  createInstance,
  emptyProject,
  newId,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from './document.ts';

/** Builds a document by inserting instances one at a time, through the same commands the editor uses. */
export class Builder {
  doc: Doc;
  readonly makeId: () => InstanceId;
  constructor(makeId: () => InstanceId) {
    this.makeId = makeId;
    this.doc = emptyProject(makeId);
  }

  get starterGui() {
    return serviceOf(this.doc, 'StarterGui').id;
  }
  get site() {
    return serviceOf(this.doc, 'Site').id;
  }
  breakpoint(name: string) {
    const bp = breakpointsOf(this.doc).find((b) => b.props.Name === name);
    if (!bp) throw new Error(`No ${name} breakpoint`);
    return bp.id;
  }

  add<C extends ClassName>(parentId: InstanceId, className: C, props: Partial<PropsOf<C>> = {}) {
    const inst = createInstance(className, props, this.makeId()) as unknown as AnyInstance;
    this.doc = applyCommand(this.doc, insert(parentId, single(inst))).doc;
    return inst.id;
  }
  addSubtree(parentId: InstanceId, subtree: Subtree) {
    this.doc = applyCommand(this.doc, insert(parentId, subtree)).doc;
    return subtree.rootId;
  }
  /** Changes base values; the command checks the names and values. */
  set(id: InstanceId, props: Readonly<Record<string, unknown>>) {
    this.doc = applyCommand(this.doc, { type: 'setProps', id, props }).doc;
  }
  /** Changes values at one breakpoint only; the command checks the names and values. */
  change(id: InstanceId, breakpoint: string, props: Readonly<Record<string, unknown>>) {
    const cmd = { type: 'setProps', id, props, breakpoint: this.breakpoint(breakpoint) } as const;
    this.doc = applyCommand(this.doc, cmd).doc;
  }
}

/**
 * A new page: a Page whose sections stack from the top, each pushing the next one down,
 * as on a web page.
 */
export function pageSubtree(
  props: Partial<PropsOf<'Page'>> = {},
  makeId: () => InstanceId = newId,
): Subtree {
  const page = createInstance('Page', props, makeId());
  const list = {
    ...createInstance('UIListLayout', { SortOrder: 'LayoutOrder' }, makeId()),
    parent: page.id,
  };
  return {
    rootId: page.id,
    instances: { [page.id]: { ...page, children: [list.id] }, [list.id]: list },
  };
}
