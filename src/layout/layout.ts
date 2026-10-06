/**
 * The layout engine: where every object sits on screen, worked out the way Roblox does it.
 * Pure functions from a document, a window size and a breakpoint to boxes in pixels, the
 * same numbers Roblox reports as AbsolutePosition and AbsoluteSize (rotation ignored).
 *
 * Per axis: AbsSize = ParentSize * Scale + Offset, and
 * AbsPos = ParentPos + ParentSize * Scale + Offset - AnchorPoint * AbsSize.
 * A UIPadding shrinks the parent's area first. Under a UIListLayout, children ignore
 * Position, AnchorPoint and Rotation, and invisible children take no space.
 *
 * AutomaticSize grows an object to fit its text and its children, padding included; Size is
 * then the smallest it gets. The content is measured with the object at its Size, so Scale in
 * its children and padding is a share of that; then the children are placed in the grown box.
 * Text sizes come from a text measurer (see text.ts).
 */
import { automaticSizeOf, classDef } from '../model/classes.ts';
import {
  getInstance,
  resolveProps,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import type { UDim, UDim2 } from '../model/values.ts';
import { measureText, type TextMeasurer } from './text.ts';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Box extends Rect {
  /** The object's own Rotation in degrees; 0 under a UIListLayout. */
  readonly rotation: number;
  /** Its own Visible (Enabled for a ScreenGui). A hidden parent hides it too. */
  readonly visible: boolean;
  /** Placed by a UIListLayout in its parent, so Position and AnchorPoint don't apply. */
  readonly listItem: boolean;
  /** The parent's area it was placed in: Scale values are fractions of this. */
  readonly area: Rect;
  /** The area its children are placed in: the box, or the canvas, minus any UIPadding. */
  readonly content: Rect;
  /** A ScrollingFrame's or Page's whole scrollable canvas, at least as big as the box. */
  readonly canvas?: Rect;
}

/** Boxes by instance id, for the containers laid out and every object inside them. */
export type Layout = ReadonlyMap<InstanceId, Box>;

/** The window: the device size for a ScreenGui, the browser window for a page. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export const udimPx = (u: UDim, length: number): number => u[0] * length + u[1];

/** Lays out one document at one breakpoint; `props` gives the values at that breakpoint. */
class Engine {
  readonly boxes = new Map<InstanceId, Box>();
  readonly doc: Doc;
  readonly breakpoint: InstanceId | undefined;
  readonly measure: TextMeasurer;
  constructor(doc: Doc, breakpoint: InstanceId | undefined, measure: TextMeasurer) {
    this.doc = doc;
    this.breakpoint = breakpoint;
    this.measure = measure;
  }

  props<C extends AnyInstance>(inst: C): C['props'] {
    return resolveProps(this.doc, inst as Instance, this.breakpoint) as C['props'];
  }

  children(id: InstanceId): AnyInstance[] {
    const inst = getInstance(this.doc, id);
    return inst ? inst.children.flatMap((c) => getInstance(this.doc, c) ?? []) : [];
  }

  /** The objects that draw, without modifiers. */
  guiChildren(id: InstanceId): GuiInstance[] {
    return this.children(id).filter(isGui);
  }

  modifier<C extends 'UIPadding' | 'UIListLayout' | 'UIAspectRatioConstraint'>(
    id: InstanceId,
    className: C,
  ): Instance<C> | undefined {
    return this.children(id).find((c) => c.className === className) as Instance<C> | undefined;
  }

  sizeOf(inst: AnyInstance, size: UDim2, area: Rect): { w: number; h: number } {
    let w = size[0] * area.w + size[1];
    let h = size[2] * area.h + size[3];
    const aspect = this.modifier(inst.id, 'UIAspectRatioConstraint');
    if (aspect) {
      // FitWithinMaxSize: the largest box of this ratio that fits inside Size.
      const ratio = Math.max(0.01, this.props(aspect).AspectRatio);
      if (h > 0 && w / h > ratio) w = h * ratio;
      else h = w / ratio;
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  }

  /**
   * The size an object takes in `area`: its Size (and aspect ratio), grown by AutomaticSize
   * to fit its content. Width grows first, so wrapped text then knows how wide it may be.
   */
  boxSize(inst: GuiInstance, area: Rect): { w: number; h: number } {
    const p = this.props(inst);
    const size = this.sizeOf(inst, p.Size, area);
    const auto = automaticSizeOf(p);
    if (auto === 'None') return size;
    let { w, h } = size;
    if (auto !== 'Y') w = Math.max(w, this.contentLength(inst, w, h, area, 'x'));
    if (auto !== 'X') h = Math.max(h, this.contentLength(inst, w, h, area, 'y'));
    return { w, h };
  }

  /**
   * How long an object of `w` × `h` must be on one axis to hold its children and its text,
   * padding included. Children are measured in the box at that size. Text that wraps grows
   * the width only up to the width of the parent's area, then wraps.
   */
  contentLength(inst: GuiInstance, w: number, h: number, area: Rect, axis: 'x' | 'y'): number {
    const x = axis === 'x';
    const pad = this.paddingOf(inst.id, { w, h });
    const padding = x ? pad.left + pad.right : pad.top + pad.bottom;
    const content = this.padded(inst.id, { x: 0, y: 0, w, h });
    const shown = this.guiChildren(inst.id).filter((c) => this.props(c).Visible);
    const list = this.modifier(inst.id, 'UIListLayout');
    let length = 0;
    if (list) {
      const lp = this.props(list);
      const vertical = lp.FillDirection === 'Vertical';
      const sizes = shown.map((c) => this.boxSize(c, content)).map((s) => (x ? s.w : s.h));
      if (x !== vertical) {
        const gap = udimPx(lp.Padding, vertical ? content.h : content.w);
        length = sizes.reduce((sum, s) => sum + s, gap * Math.max(0, sizes.length - 1));
      } else length = Math.max(0, ...sizes);
    } else
      for (const c of shown) {
        const cp = this.props(c);
        const s = this.boxSize(c, content);
        const size = x ? s.w : s.h;
        const start = x
          ? udimPx([cp.Position[0], cp.Position[1]], content.w)
          : udimPx([cp.Position[2], cp.Position[3]], content.h);
        length = Math.max(length, start - cp.AnchorPoint[x ? 0 : 1] * size + size);
      }
    const need = length + padding;

    if (!classDef(inst.className).text) return need;
    const t = this.props(inst) as TextProps;
    if (t.TextScaled) return need;
    // An empty TextBox shows its placeholder.
    const request = { text: t.Text || (t.PlaceholderText ?? ''), font: t.Font, size: t.TextSize };
    if (x) {
      const width = this.measure(request).w + padding;
      return Math.max(need, t.TextWrapped ? Math.min(width, area.w) : width);
    }
    const wrap = t.TextWrapped ? { wrap: content.w } : {};
    return Math.max(need, this.measure({ ...request, ...wrap }).h + padding);
  }

  /** The instance's UIPadding in pixels for a box of this size; zeros without one. */
  paddingOf(id: InstanceId, box: { w: number; h: number }) {
    const padding = this.modifier(id, 'UIPadding');
    if (!padding) return { left: 0, right: 0, top: 0, bottom: 0 };
    const p = this.props(padding);
    return {
      left: udimPx(p.PaddingLeft, box.w),
      right: udimPx(p.PaddingRight, box.w),
      top: udimPx(p.PaddingTop, box.h),
      bottom: udimPx(p.PaddingBottom, box.h),
    };
  }

  /** The rect inside `box` after the instance's UIPadding, if it has one. */
  padded(id: InstanceId, box: Rect): Rect {
    if (!this.modifier(id, 'UIPadding')) return box;
    const { left, right, top, bottom } = this.paddingOf(id, box);
    return {
      x: box.x + left,
      y: box.y + top,
      w: Math.max(0, box.w - left - right),
      h: Math.max(0, box.h - top - bottom),
    };
  }

  /** Places a child by its own Position, Size and AnchorPoint. */
  placeFree(inst: GuiInstance, area: Rect, listItem = false) {
    const p = this.props(inst);
    const { w, h } = this.boxSize(inst, area);
    const x = area.x + udimPx([p.Position[0], p.Position[1]], area.w) - p.AnchorPoint[0] * w;
    const y = area.y + udimPx([p.Position[2], p.Position[3]], area.h) - p.AnchorPoint[1] * h;
    const box = { x, y, w, h, area, listItem };
    this.boxes.set(inst.id, { ...box, rotation: p.Rotation, visible: p.Visible, content: box });
  }

  layoutList(list: Instance<'UIListLayout'>, items: GuiInstance[], area: Rect) {
    const p = this.props(list);
    const vertical = p.FillDirection === 'Vertical';
    const shown = items.filter((c) => this.props(c).Visible);
    const order = shown.map((c, i) => ({ c, i, props: this.props(c) }));
    if (p.SortOrder === 'Name')
      order.sort(
        (a, b) => a.props.Name.localeCompare(b.props.Name, 'en', { numeric: true }) || a.i - b.i,
      );
    else order.sort((a, b) => a.props.LayoutOrder - b.props.LayoutOrder || a.i - b.i);

    const gap = udimPx(p.Padding, vertical ? area.h : area.w);
    const sizes = order.map(({ c }) => this.boxSize(c, area));
    const mainLength = vertical ? area.h : area.w;
    const crossLength = vertical ? area.w : area.h;
    const total =
      sizes.reduce((sum, s) => sum + (vertical ? s.h : s.w), 0) +
      gap * Math.max(0, sizes.length - 1);
    const mainAlign = vertical ? p.VerticalAlignment : p.HorizontalAlignment;
    const crossAlign = vertical ? p.HorizontalAlignment : p.VerticalAlignment;
    let cursor = alignOffset(mainAlign, mainLength - total);

    order.forEach(({ c }, k) => {
      const { w, h } = sizes[k]!;
      const cross = alignOffset(crossAlign, crossLength - (vertical ? w : h));
      const x = area.x + (vertical ? cross : cursor);
      const y = area.y + (vertical ? cursor : cross);
      const box = { x, y, w, h, area, listItem: true };
      this.boxes.set(c.id, { ...box, rotation: 0, visible: true, content: box });
      cursor += (vertical ? h : w) + gap;
    });
    // Hidden items take no space; they keep a box where they would sit on their own.
    for (const c of items) if (!this.props(c).Visible) this.placeFree(c, area, true);
  }

  /** Places the children of `parentId` inside `area`, then their children, and so on. */
  layoutChildren(parentId: InstanceId, area: Rect) {
    const items = this.guiChildren(parentId);
    const list = this.modifier(parentId, 'UIListLayout');
    if (list) this.layoutList(list, items, area);
    else for (const c of items) this.placeFree(c, area);

    for (const c of items) {
      const box = this.boxes.get(c.id)!;
      let base: Rect = box;
      let canvas: Rect | undefined;
      if (c.className === 'ScrollingFrame') {
        const size = this.props(c).CanvasSize;
        canvas = {
          x: box.x,
          y: box.y,
          w: Math.max(box.w, udimPx([size[0], size[1]], box.w)),
          h: Math.max(box.h, udimPx([size[2], size[3]], box.h)),
        };
        base = canvas;
      }
      const content = this.padded(c.id, rect(base));
      this.boxes.set(c.id, canvas ? { ...box, canvas, content } : { ...box, content });
      this.layoutChildren(c.id, content);
    }
  }

  layoutScreenGui(sg: Instance<'ScreenGui'>, viewport: Viewport) {
    const area = { x: 0, y: 0, w: viewport.width, h: viewport.height };
    const box = { ...area, area, rotation: 0, listItem: false };
    this.boxes.set(sg.id, { ...box, visible: this.props(sg).Enabled, content: area });
    this.layoutChildren(sg.id, area);
  }

  /**
   * A page is as wide as the window and scrolls down. Scale values inside it are fractions of
   * the window, as in a full-window ScrollingFrame with AutomaticCanvasSize on Y. The canvas
   * grows to fit what's on the page, so stacked sections push the page longer.
   */
  layoutPage(page: Instance<'Page'>, viewport: Viewport) {
    const area = { x: 0, y: 0, w: viewport.width, h: viewport.height };
    const content = this.padded(page.id, area);
    this.layoutChildren(page.id, content);
    const bottomPadding = area.y + area.h - (content.y + content.h);
    let bottom = area.h;
    for (const c of this.guiChildren(page.id)) {
      const b = this.boxes.get(c.id)!;
      if (b.visible) bottom = Math.max(bottom, b.y + b.h + bottomPadding);
    }
    const canvas = { ...area, h: bottom };
    const box = { ...area, area, rotation: 0, visible: true, listItem: false };
    this.boxes.set(page.id, { ...box, canvas, content });
  }
}

type GuiInstance = Extract<AnyInstance, { props: { Size: UDim2; Visible: boolean } }>;
type TextProps = Instance<'TextLabel'>['props'] & { readonly PlaceholderText?: string };
const isGui = (inst: AnyInstance): inst is GuiInstance => classDef(inst.className).kind === 'gui';

const alignOffset = (align: string, free: number) =>
  align === 'Center' ? free / 2 : align === 'Right' || align === 'Bottom' ? free : 0;

const rect = (r: Rect): Rect => ({ x: r.x, y: r.y, w: r.w, h: r.h });

/**
 * Lays out a ScreenGui or a Page and everything inside it. `breakpoint` picks which values
 * apply (see resolveProps); leave it out for the base (Desktop) values.
 */
export function layoutContainer(
  doc: Doc,
  id: InstanceId,
  viewport: Viewport,
  breakpoint?: InstanceId,
  measure: TextMeasurer = measureText,
): Layout {
  const engine = new Engine(doc, breakpoint, measure);
  const inst = getInstance(doc, id);
  if (inst?.className === 'ScreenGui') engine.layoutScreenGui(inst, viewport);
  else if (inst?.className === 'Page') engine.layoutPage(inst, viewport);
  else throw new TypeError(`${id} is not a ScreenGui or a Page`);
  return engine.boxes;
}

/** Lays out every ScreenGui in the StarterGui, as Roblox shows them all at once. */
export function layoutScreenGuis(
  doc: Doc,
  starterGuiId: InstanceId,
  viewport: Viewport,
  breakpoint?: InstanceId,
  measure: TextMeasurer = measureText,
): Layout {
  const engine = new Engine(doc, breakpoint, measure);
  for (const c of engine.children(starterGuiId))
    if (c.className === 'ScreenGui') engine.layoutScreenGui(c, viewport);
  return engine.boxes;
}

/** Where an object really sits on screen: its center, size and angle after every rotation. */
export interface Quad {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  /** Degrees, its own Rotation plus its ancestors'. */
  readonly angle: number;
}

/**
 * Applies the object's own rotation and its ancestors' around their centers, as Roblox draws
 * them. Layout ignores rotation, so this is what hit testing and the selection outline use.
 */
export function screenQuad(doc: Doc, layout: Layout, id: InstanceId): Quad | undefined {
  const b = layout.get(id);
  if (!b) return undefined;
  let cx = b.x + b.w / 2;
  let cy = b.y + b.h / 2;
  let angle = b.rotation;
  for (const a of rotatingAncestors(doc, layout, id)) {
    if (!a.rotation) continue;
    const ox = a.x + a.w / 2;
    const oy = a.y + a.h / 2;
    const r = (a.rotation * Math.PI) / 180;
    const dx = cx - ox;
    const dy = cy - oy;
    cx = ox + dx * Math.cos(r) - dy * Math.sin(r);
    cy = oy + dx * Math.sin(r) + dy * Math.cos(r);
    angle += a.rotation;
  }
  return { cx, cy, w: b.w, h: b.h, angle };
}

/** The sum of the ancestors' rotations, in degrees. */
export function ancestorAngle(doc: Doc, layout: Layout, id: InstanceId): number {
  return rotatingAncestors(doc, layout, id).reduce((sum, a) => sum + a.rotation, 0);
}

/** The boxes of the gui objects above `id`, nearest first. */
function rotatingAncestors(doc: Doc, layout: Layout, id: InstanceId): Box[] {
  const out: Box[] = [];
  let p = getInstance(doc, id)?.parent ?? null;
  while (p !== null) {
    const inst = getInstance(doc, p);
    const box = layout.get(p);
    if (!inst || !box || classDef(inst.className).kind !== 'gui') break;
    out.push(box);
    p = inst.parent;
  }
  return out;
}
