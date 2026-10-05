/**
 * Property values as text, the way the Properties panel shows them and reads them back.
 * Scale and Offset read as one length: a percent of the parent plus pixels, such as `50%`,
 * `200px` or `50% + 20px`. Fields also take Studio's shorthand: `0.25,40,0.1,20` is a full
 * UDim2, and a lone number of 1 or less is Scale, a larger one Offset.
 */
import { fmtNum, roundTo } from '../export/format.ts';
import type { Color3, UDim, UDim2, Vector2 } from '../model/values.ts';

/** The numbers in a piece of text, ignoring braces and brackets; null if anything else is there. */
export function parseNums(s: string): number[] | null {
  const parts = s
    .replace(/[{}[\]()]/g, ' ')
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map(Number);
  return nums.every(Number.isFinite) ? nums : null;
}

/** One number as a field takes it, or null. */
export function parseNumber(s: string): number | null {
  const a = parseNums(s);
  return a && a.length === 1 ? a[0]! : null;
}

/** A lone number: 1 or less (and not 0) is Scale, anything else is whole pixels of Offset. */
export const inferUDim = (v: number): UDim =>
  v !== 0 && Math.abs(v) <= 1 ? [v, 0] : [0, Math.round(v)];

/** `{0.5, 0},{0.5, 0}`, `0.5,0,0.5,0`, `0.5` (Scale both ways), `200` (Offset), or `x, y`. */
export function parseUDim2(s: string): UDim2 | null {
  const a = parseNums(s);
  if (!a) return null;
  if (a.length === 4) return [a[0]!, Math.round(a[1]!), a[2]!, Math.round(a[3]!)];
  if (a.length === 1) {
    const u = inferUDim(a[0]!);
    return [u[0], u[1], u[0], u[1]];
  }
  if (a.length === 2) {
    const x = inferUDim(a[0]!);
    const y = inferUDim(a[1]!);
    return [x[0], x[1], y[0], y[1]];
  }
  return null;
}

/** One term of a length: an optional sign, a number and an optional unit. */
const TERM = /\s*([+-])?\s*(\d+(?:\.\d*)?|\.\d+)\s*(%|px)?\s*/y;

/**
 * A length typed into a field: percents of the parent and pixels, added or subtracted, such
 * as `50%`, `200px`, `50% + 20px` or `100% - 40px`. A number without a unit is pixels, unless
 * it stands alone at 1 or less, which Studio reads as Scale. `0.5, 20` is Scale and Offset.
 */
export function parseLength(s: string): UDim | null {
  const nums = parseNums(s);
  if (nums) {
    if (nums.length === 1) return inferUDim(nums[0]!);
    return nums.length === 2 ? [nums[0]!, Math.round(nums[1]!)] : null;
  }
  const t = s.trim().toLowerCase();
  let scale = 0;
  let offset = 0;
  for (let at = 0, n = 0; at < t.length; n++) {
    TERM.lastIndex = at;
    const m = TERM.exec(t);
    // After the first term, each one needs its + or -.
    if (!m || (n > 0 && !m[1])) return null;
    const v = Number(m[2]) * (m[1] === '-' ? -1 : 1);
    if (m[3] === '%') scale += v / 100;
    else offset += v;
    at = TERM.lastIndex;
  }
  return t ? [roundTo(scale, 4), Math.round(offset)] : null;
}

/** A length as fields show it: `50%`, `200px`, `50% + 20px`, or `0px`. */
export function fmtLength([scale, offset]: UDim): string {
  const pct = `${fmtNum(scale * 100, 2)}%`;
  if (!offset) return scale ? pct : '0px';
  if (!scale) return `${offset}px`;
  return `${pct} ${offset < 0 ? '-' : '+'} ${Math.abs(offset)}px`;
}

/** `0.5, 1`, or one number for both. */
export function parseVec2(s: string): Vector2 | null {
  const a = parseNums(s);
  if (!a) return null;
  if (a.length === 1) return [a[0]!, a[0]!];
  return a.length === 2 ? [a[0]!, a[1]!] : null;
}

/** `#RRGGBB` or `#RGB` to a color, or null. */
export function fromHex(s: string): Color3 | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * `#RRGGBB`, `#RGB`, `[r, g, b]` from 0 to 255, or one number for a gray, as in Studio: `255`
 * is white and `0` black. Three digits are a number, not a color code without its `#`.
 */
export function parseColor(s: string): Color3 | null {
  const hex = /^\s*\d{1,3}\s*$/.test(s) ? null : fromHex(s);
  if (hex) return hex;
  const a = parseNums(s);
  if (!a || (a.length !== 1 && a.length !== 3)) return null;
  const c = a.map((v) => Math.min(255, Math.max(0, Math.round(v))));
  return (c.length === 1 ? [c[0], c[0], c[0]] : c) as unknown as Color3;
}

export const hex = (c: Color3): string =>
  '#' +
  c
    .map((v) =>
      Math.min(255, Math.max(0, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

export const fmtVec2 = (v: Vector2) => `${fmtNum(v[0])}, ${fmtNum(v[1])}`;
export const fmtColor = (c: Color3) => `[${c[0]}, ${c[1]}, ${c[2]}]`;
