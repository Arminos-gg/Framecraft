/**
 * The layout engine: where every object sits on screen, worked out the way Roblox does it.
 * Pure functions from a document, a window size and a breakpoint to boxes in pixels, the
 * same numbers Roblox reports as AbsolutePosition and AbsoluteSize (rotation ignored).
 *
 * Per axis: AbsSize = ParentSize * Scale + Offset, and
 * AbsPos = ParentPos + ParentSize * Scale + Offset - AnchorPoint * AbsSize.
 * A UIPadding shrinks the parent's area first. Under a UIListLayout, children ignore
 * Position, AnchorPoint and Rotation, and invisible children take no space.
 */
import { classDef } from '../model/classes.ts';
import {
  getInstance,
  resolveProps,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import type { UDim, UDim2 } from '../model/values.ts';

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
  constructor(doc: Doc, breakpoint: InstanceId | undefined) {
    this.doc = doc;
    this.breakpoint = breakpoint;
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

  /** The rect inside `box` after the instance's UIPadding, if it has one. */
  padded(id: InstanceId, box: Rect): Rect {
    const padding = this.modifier(id, 'UIPadding');
    if (!padding) return box;
    const p = this.props(padding);
    const left = udimPx(p.PaddingLeft, box.w);
    const right = udimPx(p.PaddingRight, box.w);
    const top = udimPx(p.PaddingTop, box.h);
    const bottom = udimPx(p.PaddingBottom, box.h);
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
    const { w, h } = this.sizeOf(inst, p.Size, area);
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
    const sizes = order.map(({ c, props }) => this.sizeOf(c, props.Size, area));
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
): Layout {
  const engine = new Engine(doc, breakpoint);
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
): Layout {
  const engine = new Engine(doc, breakpoint);
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
