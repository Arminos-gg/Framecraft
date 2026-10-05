/** Number and string formatting shared by the exporters. */
import type { Color3 } from '../model/values.ts';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Rounds to `digits` decimals, never giving -0. */
export function roundTo(v: number, digits = 4): number {
  const m = 10 ** digits;
  const r = Math.round(v * m) / m;
  return Object.is(r, -0) ? 0 : r;
}

export const fmtNum = (v: number, digits = 4): string => String(roundTo(v, digits));

/** Escapes text for HTML content and attribute values. */
export const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export const rgb = (c: Color3): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** A CSS color with a Roblox transparency (0 is opaque, 1 invisible). */
export const rgba = (c: Color3, transparency = 0): string =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${roundTo(1 - clamp(transparency, 0, 1), 3)})`;

/** A {Scale, Offset} pair as CSS: `calc(Scale% + Offset px)`, or the simpler form. */
export function calcU(scale: number, offset: number): string {
  const s = roundTo(scale * 100, 4);
  const o = Math.round(offset);
  if (!s) return o + 'px';
  if (!o) return s + '%';
  return `calc(${s}% + ${o}px)`;
}
