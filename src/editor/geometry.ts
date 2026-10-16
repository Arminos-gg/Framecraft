/**
 * Editing math for the viewport: turning a box dragged in pixels back into UDim2 values, smart
 * snapping against the parent and siblings, and resizing from a handle. Pure functions; the
 * editor (editor.ts) feeds them boxes from the layout engine.
 */
import { roundTo } from '../export/format.ts';
import type { Box, Rect } from '../layout/layout.ts';
import type { UDim, UDim2, Vector2 } from '../model/values.ts';

/**
 * Which part of a value a drag writes. Auto keeps each value's own unit: a pure Scale value
 * stays Scale, anything else changes its Offset.
 */
export type UnitMode = 'auto' | 'scale' | 'offset';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A snapping line to draw: vertical at x = `at`, or horizontal at y = `at`, from `from` to `to`. */
export interface Guide {
  readonly axis: 'v' | 'h';
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

/** Writes a length in pixels back into a {Scale, Offset} pair, keeping the other part as it is. */
export function writeAxis(u: UDim, px: number, length: number, mode: UnitMode): UDim {
  const unit = mode === 'auto' ? (u[1] === 0 && u[0] !== 0 ? 'scale' : 'offset') : mode;
  if (unit === 'scale' && length > 0) return [roundTo((px - u[1]) / length, 4), u[1]];
  return [u[0], Math.round(px - u[0] * length)];
}

/** The Position that puts a w × h box with its top left corner at (x, y) inside `area`. */
export function positionFor(
  position: UDim2,
  anchor: Vector2,
  area: Rect,
  rect: Rect,
  mode: UnitMode,
): UDim2 {
  const x = writeAxis(
    [position[0], position[1]],
    rect.x + anchor[0] * rect.w - area.x,
    area.w,
    mode,
  );
  const y = writeAxis(
    [position[2], position[3]],
    rect.y + anchor[1] * rect.h - area.y,
    area.h,
    mode,
  );
  return [x[0], x[1], y[0], y[1]];
}

/** The Size that makes a box w × h inside `area`. */
export function sizeFor(size: UDim2, area: Rect, w: number, h: number, mode: UnitMode): UDim2 {
  const x = writeAxis([size[0], size[1]], w, area.w, mode);
  const y = writeAxis([size[2], size[3]], h, area.h, mode);
  return [x[0], x[1], y[0], y[1]];
}

/** Rotates a vector by `deg` degrees, clockwise on screen as Roblox's Rotation is. */
export function rotate(dx: number, dy: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
}

/** Lines a dragged box snaps to: the edges and centers of its parent's area and of its siblings. */
export interface SnapTargets {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly area: Rect;
}

/** Rotated or hidden siblings don't offer lines. */
export function snapTargets(area: Rect, siblings: readonly Box[]): SnapTargets {
  const xs = [area.x, area.x + area.w / 2, area.x + area.w];
  const ys = [area.y, area.y + area.h / 2, area.y + area.h];
  for (const s of siblings) {
    if (!s.visible || s.rotation) continue;
    xs.push(s.x, s.x + s.w / 2, s.x + s.w);
    ys.push(s.y, s.y + s.h / 2, s.y + s.h);
  }
  return { xs, ys, area };
}

/** The closest line within `threshold` of any of `values`, as the distance to move and the line. */
export function nearest(
  values: readonly number[],
  targets: readonly number[],
  threshold: number,
): { d: number; line: number } | null {
  let best: { d: number; line: number } | null = null;
  for (const v of values)
    for (const t of targets) {
      const d = t - v;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d)))
        best = { d, line: t };
    }
  return best;
}

const guideV = (x: number, t: SnapTargets, r: Rect): Guide => ({
  axis: 'v',
  at: x,
  from: Math.min(t.area.y, r.y),
  to: Math.max(t.area.y + t.area.h, r.y + r.h),
});
const guideH = (y: number, t: SnapTargets, r: Rect): Guide => ({
  axis: 'h',
  at: y,
  from: Math.min(t.area.x, r.x),
  to: Math.max(t.area.x + t.area.w, r.x + r.w),
});

export interface Moved {
  readonly rect: Rect;
  readonly guides: readonly Guide[];
}

/** Moves a box by (dx, dy), snapping its edges or center to the nearest line within `threshold`. */
export function moveRect(
  start: Rect,
  dx: number,
  dy: number,
  snap: SnapTargets | null,
  threshold: number,
): Moved {
  let x = start.x + dx;
  let y = start.y + dy;
  const guides: Guide[] = [];
  if (snap) {
    const sx = nearest([x, x + start.w / 2, x + start.w], snap.xs, threshold);
    const sy = nearest([y, y + start.h / 2, y + start.h], snap.ys, threshold);
    if (sx) x += sx.d;
    if (sy) y += sy.d;
    const r = { x, y, w: start.w, h: start.h };
    if (sx) guides.push(guideV(sx.line, snap, r));
    if (sy) guides.push(guideH(sy.line, snap, r));
  }
  return { rect: { x, y, w: start.w, h: start.h }, guides };
}

export interface ResizeOptions {
  readonly snap: SnapTargets | null;
  readonly threshold: number;
  /** Shift on a corner handle: keep the box's proportions. */
  readonly keepRatio: boolean;
}

/** Resizes a box by dragging one handle by (dx, dy). The box never gets smaller than 1 px. */
export function resizeRect(
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  opts: ResizeOptions,
): Moved {
  let { x, y, w, h } = start;
  const east = handle.includes('e');
  const west = handle.includes('w');
  const south = handle.includes('s');
  const north = handle.includes('n');
  if (east) w = start.w + dx;
  if (west) {
    w = start.w - dx;
    x = start.x + dx;
  }
  if (south) h = start.h + dy;
  if (north) {
    h = start.h - dy;
    y = start.y + dy;
  }
  let guides: Guide[] = [];
  const t = opts.snap;
  if (t) {
    const snapEdge = (edge: number, lines: readonly number[]) =>
      nearest([edge], lines, opts.threshold);
    if (east) {
      const s = snapEdge(x + w, t.xs);
      if (s) {
        w += s.d;
        guides.push(guideV(s.line, t, { x, y, w, h }));
      }
    }
    if (west) {
      const s = snapEdge(x, t.xs);
      if (s) {
        x += s.d;
        w -= s.d;
        guides.push(guideV(s.line, t, { x, y, w, h }));
      }
    }
    if (south) {
      const s = snapEdge(y + h, t.ys);
      if (s) {
        h += s.d;
        guides.push(guideH(s.line, t, { x, y, w, h }));
      }
    }
    if (north) {
      const s = snapEdge(y, t.ys);
      if (s) {
        y += s.d;
        h -= s.d;
        guides.push(guideH(s.line, t, { x, y, w, h }));
      }
    }
  }
  if (opts.keepRatio && handle.length === 2 && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if (Math.abs(w / start.w) > Math.abs(h / start.h)) h = w / ratio;
    else w = h * ratio;
    if (west) x = start.x + start.w - w;
    if (north) y = start.y + start.h - h;
    guides = [];
  }
  if (w < 1) {
    if (west) x -= 1 - w;
    w = 1;
  }
  if (h < 1) {
    if (north) y -= 1 - h;
    h = 1;
  }
  return { rect: { x, y, w, h }, guides };
}

/** Lining objects up: by their left edges, centers or right edges, or top, middle or bottom. */
export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export const ALIGNS: readonly Align[] = ['left', 'center', 'right', 'top', 'middle', 'bottom'];

/** Which axis an alignment moves along, and where on it: 0 start, 0.5 center, 1 end. */
export function alignAxis(how: Align): { axis: 'x' | 'y'; at: 0 | 0.5 | 1 } {
  const at = how === 'left' || how === 'top' ? 0 : how === 'right' || how === 'bottom' ? 1 : 0.5;
  return { axis: how === 'left' || how === 'center' || how === 'right' ? 'x' : 'y', at };
}

/** The smallest rectangle around all of `rects`. */
export function boundsOf(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const w = Math.max(...rects.map((r) => r.x + r.w)) - x;
  const h = Math.max(...rects.map((r) => r.y + r.h)) - y;
  return { x, y, w, h };
}

/** Moves each rectangle so the chosen edge or center lines up with that of `to`. */
export function alignRects(rects: readonly Rect[], to: Rect, how: Align): Rect[] {
  const { axis, at } = alignAxis(how);
  return rects.map((r) =>
    axis === 'x' ? { ...r, x: to.x + (to.w - r.w) * at } : { ...r, y: to.y + (to.h - r.h) * at },
  );
}

/**
 * Spaces rectangles evenly along an axis: the first and last stay, and the others move so the
 * gaps between neighbours are equal. Returns them in the order given.
 */
export function distributeRects(rects: readonly Rect[], axis: 'x' | 'y'): Rect[] {
  const len = axis === 'x' ? 'w' : 'h';
  const order = rects
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r[axis] + a.r[len] / 2 - (b.r[axis] + b.r[len] / 2) || a.i - b.i);
  const out = [...rects];
  if (order.length < 3) return out;
  const first = order[0]!.r;
  const last = order.at(-1)!.r;
  const span = last[axis] + last[len] - first[axis];
  const gap = (span - order.reduce((n, o) => n + o.r[len], 0)) / (order.length - 1);
  let at = first[axis];
  for (const { r, i } of order) {
    out[i] = { ...r, [axis]: at };
    at += r[len] + gap;
  }
  return out;
}
