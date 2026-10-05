/**
 * Inserting: which classes can go where, where a new object lands, and what it starts as.
 * New objects sit in the middle of their parent in Offset, each a little lower and to the
 * right of the last, as in the prototype. A new page starts with a UIListLayout, so its
 * sections stack.
 */
import type { Rect } from '../layout/layout.ts';
import {
  canParent,
  classDef,
  defaultProps,
  MODIFIER_CLASSES,
  OBJECT_CLASSES,
  type ClassName,
} from '../model/classes.ts';
import {
  childOfClass,
  childrenOf,
  createInstance,
  getInstance,
  newId,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from '../model/document.ts';
import { pageSubtree } from '../model/builder.ts';
import type { UDim2 } from '../model/values.ts';

/** What a new modifier starts with, where the class default isn't useful on its own. */
export const MODIFIER_DEFAULTS: Partial<Record<ClassName, Record<string, unknown>>> = {
  UIPadding: {
    PaddingTop: [0, 8],
    PaddingBottom: [0, 8],
    PaddingLeft: [0, 8],
    PaddingRight: [0, 8],
  },
  UIStroke: { Thickness: 2 },
};

/** One line on what each class does, for the insert menu. */
export const CLASS_HINTS: Partial<Record<ClassName, string>> = {
  ScreenGui: 'A layer on the player’s screen',
  Page: 'A page of the website',
  Frame: 'Holds other objects',
  TextLabel: 'Shows text',
  TextButton: 'Clickable text',
  TextBox: 'Text people type in',
  ImageLabel: 'Shows an image',
  ImageButton: 'Clickable image',
  ScrollingFrame: 'Scrolls its content',
  UICorner: 'Rounds the corners',
  UIStroke: 'Adds an outline',
  UIGradient: 'Tints with a gradient',
  UIPadding: 'Adds inner spacing',
  UIListLayout: 'Stacks the children',
  UIAspectRatioConstraint: 'Keeps the shape',
};

const isModifier = (c: ClassName) => classDef(c).kind === 'modifier';

/** Only UIStroke may appear twice on one object; a second UICorner and the like would do nothing. */
export const allowsTwins = (c: ClassName) => c === 'UIStroke';

/** What can be inserted into an instance: objects (or a layer or page) and modifiers, in ribbon order. */
export function insertableInto(doc: Doc, parentId: InstanceId) {
  const parent = getInstance(doc, parentId);
  if (!parent) return { objects: [], modifiers: [] };
  const fits = (c: ClassName) => canParent(c, parent.className);
  const objects = (['ScreenGui', 'Page', ...OBJECT_CLASSES] as ClassName[]).filter(fits);
  const modifiers = (MODIFIER_CLASSES as readonly ClassName[]).filter(fits);
  return { objects, modifiers };
}

/** Whether the instance already has a modifier of a class it can only have one of. */
export const hasModifier = (doc: Doc, parentId: InstanceId, className: ClassName) =>
  isModifier(className) &&
  !allowsTwins(className) &&
  childOfClass(doc, parentId, className) !== undefined;

/**
 * Where an insert lands: modifiers go on `from` itself; objects go into `from` or its nearest
 * ancestor that can hold them. Undefined when nothing up the tree can.
 */
export function insertParent(
  doc: Doc,
  className: ClassName,
  from: InstanceId | null,
): AnyInstance | undefined {
  let p = from === null ? undefined : getInstance(doc, from);
  if (isModifier(className)) return p && canParent(className, p.className) ? p : undefined;
  while (p && !canParent(className, p.className))
    p = p.parent === null ? undefined : getInstance(doc, p.parent);
  return p;
}

/** A name and path for a new page that no other page uses. */
function newPageProps(doc: Doc, siteId: InstanceId) {
  const pages = childrenOf(doc, siteId).filter((c) => c.className === 'Page');
  const names = new Set(pages.map((p) => p.props.Name));
  const paths = new Set(pages.map((p) => (p.props as { Path: string }).Path));
  let n = 1;
  while (names.has(n === 1 ? 'Page' : `Page${n}`) || paths.has(n === 1 ? '/page' : `/page-${n}`))
    n++;
  return {
    Name: n === 1 ? 'Page' : `Page${n}`,
    Path: n === 1 ? '/page' : `/page-${n}`,
  };
}

/**
 * The new instance (and anything it starts with) for an insert into `parent`. `area` is the
 * part of the parent's content area to center it in, in pixels.
 */
export function newSubtree(
  doc: Doc,
  className: ClassName,
  parent: AnyInstance,
  area: Rect,
  makeId: () => InstanceId = newId,
): Subtree {
  if (className === 'Page') return pageSubtree(newPageProps(doc, parent.id), makeId);
  if (isModifier(className))
    return single(
      createInstance(className, MODIFIER_DEFAULTS[className] ?? {}, makeId()) as AnyInstance,
    );
  if (classDef(className).kind !== 'gui')
    return single(createInstance(className, {}, makeId()) as AnyInstance);

  const defaults = defaultProps(className) as unknown as { Size: UDim2 };
  // Straight in a page, an object is a section: as wide as the window.
  const onPage = parent.className === 'Page';
  const size: UDim2 = onPage
    ? [1, 0, 0, className === 'Frame' || className === 'ScrollingFrame' ? 320 : defaults.Size[3]]
    : defaults.Size;
  const props: Record<string, unknown> = { Size: size };
  // Under a UIListLayout, Position doesn't apply, so leave it at zero.
  if (!childOfClass(doc, parent.id, 'UIListLayout')) {
    const count = childrenOf(doc, parent.id).filter((c) => classDef(c.className).kind === 'gui');
    const nudge = (12 * count.length) % 96;
    const w = size[0] * area.w + size[1];
    const h = size[2] * area.h + size[3];
    props.Position = [
      0,
      Math.round(area.w / 2 - w / 2 + nudge),
      0,
      Math.round(area.h / 2 - h / 2 + nudge),
    ];
  }
  return single(createInstance(className, props, makeId()) as AnyInstance);
}
