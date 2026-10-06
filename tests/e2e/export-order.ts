import { classDef } from '../../src/model/classes.ts';
import {
  childOfClass,
  childrenOf,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';

/**
 * The objects under `id` in the order the exporters write them: parents first, and children
 * in LayoutOrder where a UIListLayout arranges them (at the base values).
 */
export function exportOrder(doc: Doc, id: InstanceId): AnyInstance[] {
  const items = childrenOf(doc, id).filter((c) => classDef(c.className).kind === 'gui');
  const list = childOfClass(doc, id, 'UIListLayout');
  const order = list
    ? items
        .map((c, i) => ({ c, i }))
        .sort(
          (a, b) =>
            (a.c.props as { LayoutOrder: number }).LayoutOrder -
              (b.c.props as { LayoutOrder: number }).LayoutOrder || a.i - b.i,
        )
        .map((o) => o.c)
    : items;
  return order.flatMap((c) => [c, ...exportOrder(doc, c.id)]);
}
