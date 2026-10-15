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
  WEB_OBJECT_CLASSES,
  type ClassName,
} from '../model/classes.ts';
import {
  childOfClass,
  childrenOf,
  createInstance,
  drawnParent,
  getInstance,
  newId,
  onPage,
  pageOnly,
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
  Folder: 'Groups objects; they stay where they are',
  UICorner: 'Rounds the corners',
  UIStroke: 'Adds an outline',
  UIGradient: 'Tints with a gradient',
  UIPadding: 'Adds inner spacing',
  UIListLayout: 'Stacks the children',
  UIAspectRatioConstraint: 'Keeps the shape',
  UIHover: 'Changes on mouse over',
  Form: 'Fields people fill in and send',
  Embed: 'A YouTube video or a map',
};

const isModifier = (c: ClassName) => classDef(c).kind === 'modifier';

/** Only UIStroke may appear twice on one object; a second UICorner and the like would do nothing. */
export const allowsTwins = (c: ClassName) => c === 'UIStroke';

/** What can be inserted into an instance: objects (or a layer or page) and modifiers, in ribbon order. */
export function insertableInto(doc: Doc, parentId: InstanceId) {
  const parent = getInstance(doc, parentId);
  if (!parent) return { objects: [], modifiers: [] };
  const fits = (c: ClassName) => canParent(c, parent.className);
  const web = onPage(doc, parentId);
  const objects = (
    ['ScreenGui', 'Page', ...OBJECT_CLASSES, ...WEB_OBJECT_CLASSES, 'Folder'] as ClassName[]
  ).filter((c) => fits(c) && (web || !pageOnly(c)));
  const modifiers = (MODIFIER_CLASSES as readonly ClassName[]).filter(
    (c) => fits(c) && (web || !classDef(c).web),
  );
  return { objects, modifiers };
}

export { onPage };

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
  if (isModifier(className))
    return p && canParent(className, p.className) && (!classDef(className).web || onPage(doc, p.id))
      ? p
      : undefined;
  while (p && !canParent(className, p.className))
    p = p.parent === null ? undefined : getInstance(doc, p.parent);
  // A Form or an Embed goes on the website only.
  return p && pageOnly(className) && !onPage(doc, p.id) ? undefined : p;
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
  /** Properties the new object starts with, such as a shape's Size and colors. */
  start: Readonly<Record<string, unknown>> = {},
): Subtree {
  if (className === 'Page') return pageSubtree(newPageProps(doc, parent.id), makeId);
  if (className === 'UIHover') return single(newHover(parent, makeId()));
  if (isModifier(className))
    return single(
      createInstance(className, MODIFIER_DEFAULTS[className] ?? {}, makeId()) as AnyInstance,
    );
  if (classDef(className).kind !== 'gui')
    return single(createInstance(className, {}, makeId()) as AnyInstance);

  const defaults = defaultProps(className) as unknown as { Size: UDim2 };
  // Straight in a page (or in a Folder there), an object is a section: as wide as the window.
  // A form or a video keeps its own size.
  const onPage = drawnParent(doc, parent.id)?.className === 'Page' && !pageOnly(className);
  const size: UDim2 =
    (start.Size as UDim2 | undefined) ??
    (onPage
      ? [1, 0, 0, className === 'Frame' || className === 'ScrollingFrame' ? 320 : defaults.Size[3]]
      : defaults.Size);
  const props: Record<string, unknown> = { ...start, Size: size };
  const listed = !!childOfClass(doc, parent.id, 'UIListLayout');
  // A form, video or map goes last in a list, as a component does.
  if (listed && pageOnly(className))
    props.LayoutOrder =
      Math.max(
        0,
        ...childrenOf(doc, parent.id).map(
          (c) => (c.props as { LayoutOrder?: number }).LayoutOrder ?? 0,
        ),
      ) + 1;
  // Under a UIListLayout, Position doesn't apply, so leave it at zero.
  if (!listed) {
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
  const root = createInstance(className, props, makeId()) as AnyInstance;
  return className === 'Form' ? formSubtree(root, makeId) : single(root);
}

/**
 * A new Form starts as a small contact form, ready to send once it has an Action: an email
 * field, a message box and a Send button, stacked by a UIListLayout and growing to fit.
 */
function formSubtree(form: AnyInstance, makeId: () => InstanceId): Subtree {
  const instances: Record<InstanceId, AnyInstance> = {};
  const add = (parent: AnyInstance, inst: AnyInstance) => {
    instances[inst.id] = { ...inst, parent: parent.id } as AnyInstance;
    const p = instances[parent.id] ?? parent;
    instances[parent.id] = { ...p, children: [...p.children, inst.id] } as AnyInstance;
    return inst;
  };
  const make = <C extends ClassName>(className: C, props: Record<string, unknown> = {}) =>
    createInstance(className, props as never, makeId()) as unknown as AnyInstance;
  const root = { ...form, props: { ...form.props, AutomaticSize: 'Y' } } as AnyInstance;
  instances[root.id] = root;
  const pad = (px: number) => ({
    PaddingTop: [0, px],
    PaddingBottom: [0, px],
    PaddingLeft: [0, px],
    PaddingRight: [0, px],
  });
  add(root, make('UIPadding', pad(20)));
  add(root, make('UIListLayout', { Padding: [0, 12], HorizontalAlignment: 'Center' }));
  add(root, make('UICorner', { CornerRadius: [0, 12] }));
  const text = { Font: 'Inter', TextSize: 16, TextColor3: [24, 24, 27] };
  const field = (name: string, order: number, props: Record<string, unknown>) => {
    const box = add(
      root,
      make('TextBox', {
        Name: name,
        LayoutOrder: order,
        Text: '',
        ...text,
        TextXAlignment: 'Left',
        BorderSizePixel: 0,
        Required: true,
        ...props,
      }),
    );
    add(box, make('UIPadding', { ...pad(10), PaddingLeft: [0, 12], PaddingRight: [0, 12] }));
    add(box, make('UICorner', { CornerRadius: [0, 8] }));
    add(box, make('UIStroke', { ApplyStrokeMode: 'Border', Color: [212, 212, 216] }));
  };
  field('Email', 1, { Size: [1, 0, 0, 44], PlaceholderText: 'Your email', InputType: 'Email' });
  field('Message', 2, {
    Size: [1, 0, 0, 120],
    PlaceholderText: 'Your message',
    InputType: 'LongText',
    TextWrapped: true,
    TextYAlignment: 'Top',
  });
  const send = add(
    root,
    make('TextButton', {
      Name: 'Send',
      LayoutOrder: 3,
      Size: [1, 0, 0, 44],
      Text: 'Send',
      ...text,
      FontWeight: 'SemiBold',
      TextColor3: [255, 255, 255],
      BackgroundColor3: [37, 99, 235],
      BorderSizePixel: 0,
      Cursor: 'Pointer',
    }),
  );
  add(send, make('UICorner', { CornerRadius: [0, 8] }));
  return { rootId: root.id, instances };
}

/** The colors a UIHover copies from its object, so a new one only grows it until edited. */
const HOVER_COPIES = ['BackgroundColor3', 'BackgroundTransparency', 'TextColor3'] as const;

/** A new UIHover that starts with its object's own colors, at every breakpoint. */
function newHover(parent: AnyInstance, id: InstanceId): AnyInstance {
  const own = parent.props as Readonly<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const k of HOVER_COPIES) if (k in own) props[k] = own[k];
  const hover = createInstance('UIHover', props, id);
  const overrides: Record<InstanceId, Record<string, unknown>> = {};
  for (const [bp, values] of Object.entries(parent.overrides ?? {})) {
    const o = values as Readonly<Record<string, unknown>>;
    const copied = Object.fromEntries(HOVER_COPIES.filter((k) => k in o).map((k) => [k, o[k]]));
    if (Object.keys(copied).length) overrides[bp] = copied;
  }
  return (Object.keys(overrides).length ? { ...hover, overrides } : hover) as AnyInstance;
}
