/**
 * Roblox value types, stored as plain JSON.
 *
 * UDim2 is [xScale, xOffset, yScale, yOffset] and UDim is [scale, offset]. Offsets are whole
 * pixels, as in Roblox. Colors are [r, g, b] from 0 to 255. Transparency runs 0 to 1.
 */

export type UDim = readonly [scale: number, offset: number];
export type UDim2 = readonly [xScale: number, xOffset: number, yScale: number, yOffset: number];
export type Vector2 = readonly [x: number, y: number];
export type Color3 = readonly [r: number, g: number, b: number];

export interface ColorSequenceKeypoint {
  readonly time: number;
  readonly value: Color3;
}
export interface NumberSequenceKeypoint {
  readonly time: number;
  readonly value: number;
}
export type ColorSequence = readonly ColorSequenceKeypoint[];
export type NumberSequence = readonly NumberSequenceKeypoint[];

/** An image in the project's image library (see assets.ts): `img_` plus a hash of its bytes. */
export type AssetId = string;
export const ASSET_ID_PATTERN = /^img_[0-9a-z]+$/;

/** Where a link goes: a page of the site (optionally a section on it), or an outside address. */
export type Link =
  | {
      readonly kind: 'page';
      readonly page: string;
      readonly section?: string;
      readonly newTab?: true;
    }
  | { readonly kind: 'url'; readonly url: string; readonly newTab?: true };

/** The value each property type holds. */
export interface ValueTypes {
  string: string;
  int: number;
  number: number;
  bool: boolean;
  /** A transparency, 0 (opaque) to 1 (invisible). */
  alpha: number;
  color: Color3;
  vec2: Vector2;
  udim: UDim;
  udim2: UDim2;
  enum: string;
  /** An asset id such as rbxassetid://123. */
  image: string;
  colorseq: ColorSequence;
  numseq: NumberSequence;
  /** An image from the project's library, or '' for none. Web only. */
  asset: AssetId;
  /** A link target, or null for none. Web only. */
  link: Link | null;
}
export type PropType = keyof ValueTypes;
export type PropValue = ValueTypes[PropType];

/** Limits a property type can carry. Only the number-like types use min and max. */
export interface ValueLimits {
  min?: number;
  max?: number;
  options?: readonly string[];
}

/** Roblox caps ColorSequence and NumberSequence at 20 keypoints. */
export const MAX_KEYPOINTS = 20;

export function colorSequence(...colors: Color3[]): ColorSequence {
  const last = Math.max(1, colors.length - 1);
  return colors.map((value, i) => ({ time: i / last, value }));
}
export function numberSequence(...values: number[]): NumberSequence {
  const last = Math.max(1, values.length - 1);
  return values.map((value, i) => ({ time: i / last, value }));
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, v));
const numbers = (v: unknown, length: number): number[] | undefined =>
  Array.isArray(v) && v.length === length && v.every(isFiniteNumber) ? [...v] : undefined;

function normalizeColor(v: unknown): Color3 | undefined {
  const c = numbers(v, 3);
  return c && (c.map((x) => clamp(Math.round(x), 0, 255)) as unknown as Color3);
}

function normalizeKeypoints<T>(
  v: unknown,
  value: (raw: unknown) => T | undefined,
): { time: number; value: T }[] | undefined {
  if (!Array.isArray(v) || v.length < 2 || v.length > MAX_KEYPOINTS) return undefined;
  const out: { time: number; value: T }[] = [];
  for (const k of v as unknown[]) {
    if (typeof k !== 'object' || k === null) return undefined;
    const { time, value: raw } = k as { time?: unknown; value?: unknown };
    const val = value(raw);
    if (!isFiniteNumber(time) || time < 0 || time > 1 || val === undefined) return undefined;
    const prev = out[out.length - 1];
    if (prev && time < prev.time) return undefined;
    out.push({ time, value: val });
  }
  // Roblox requires the first keypoint at time 0 and the last at time 1.
  if (out[0]?.time !== 0 || out[out.length - 1]?.time !== 1) return undefined;
  return out;
}

/**
 * Coerces a value to a valid value of the given type: rounds offsets, integers and colors,
 * and clamps to the limits. Returns undefined when the value can't be read as that type.
 */
export function normalizeValue<T extends PropType>(
  type: T,
  v: unknown,
  limits: ValueLimits = {},
): ValueTypes[T] | undefined {
  return normalize(type, v, limits) as ValueTypes[T] | undefined;
}

function normalize(type: PropType, v: unknown, { min, max, options }: ValueLimits): unknown {
  switch (type) {
    case 'string':
    case 'image':
      return typeof v === 'string' ? v : undefined;
    case 'bool':
      return typeof v === 'boolean' ? v : undefined;
    case 'int':
      return isFiniteNumber(v) ? clamp(Math.round(v), min, max) : undefined;
    case 'number':
      return isFiniteNumber(v) ? clamp(v, min, max) : undefined;
    case 'alpha':
      return isFiniteNumber(v) ? clamp(v, 0, 1) : undefined;
    case 'enum':
      return typeof v === 'string' && (!options || options.includes(v)) ? v : undefined;
    case 'color':
      return normalizeColor(v);
    case 'vec2':
      return numbers(v, 2);
    case 'udim': {
      const u = numbers(v, 2);
      return u && [u[0], Math.round(u[1]!)];
    }
    case 'udim2': {
      const u = numbers(v, 4);
      return u && [u[0], Math.round(u[1]!), u[2], Math.round(u[3]!)];
    }
    case 'colorseq':
      return normalizeKeypoints(v, normalizeColor);
    case 'numseq':
      return normalizeKeypoints(v, (x) => (isFiniteNumber(x) ? clamp(x, min, max) : undefined));
    case 'asset':
      return typeof v === 'string' && (v === '' || ASSET_ID_PATTERN.test(v)) ? v : undefined;
    case 'link':
      return normalizeLink(v);
  }
}

const URL_PATTERN = /^(https?:\/\/|mailto:|tel:)\S+$/i;
const SECTION_PATTERN = /^[A-Za-z][\w-]*$/;

function normalizeLink(v: unknown): Link | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) return undefined;
  const { kind, page, section, url, newTab } = v as Record<string, unknown>;
  if (newTab !== undefined && typeof newTab !== 'boolean') return undefined;
  const tab = newTab ? { newTab: true as const } : {};
  if (kind === 'page') {
    if (typeof page !== 'string' || !page) return undefined;
    if (section !== undefined && (typeof section !== 'string' || !SECTION_PATTERN.test(section)))
      return undefined;
    return { kind, page, ...(section === undefined ? {} : { section }), ...tab };
  }
  if (kind === 'url') {
    if (typeof url !== 'string' || !URL_PATTERN.test(url.trim())) return undefined;
    return { kind, url: url.trim(), ...tab };
  }
  return undefined;
}

/** Deep equality for property values (plain JSON: primitives, arrays and objects). */
export function valueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    valueEquals((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}
