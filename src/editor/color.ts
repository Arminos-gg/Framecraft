/** Color math for the color picker: hue, saturation and brightness, and a project's colors. */
import type { Doc } from '../model/document.ts';
import { classDef } from '../model/classes.ts';
import type { Color3 } from '../model/values.ts';

/** Hue from 0 to 360, saturation and brightness (value) from 0 to 1. */
export type Hsv = readonly [h: number, s: number, v: number];

export function hsvToRgb([h, s, v]: Hsv): Color3 {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

/** `hue` is kept for grays, blacks and whites, which have none of their own. */
export function rgbToHsv(c: Color3, hue = 0): Hsv {
  const [r, g, b] = c.map((x) => x / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = hue;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [h, max === 0 ? 0 : d / max, max];
}

/**
 * The colors a project uses, most used first, for one-click reuse in the picker. Counts every
 * color property, per breakpoint too, and the keypoints of gradients.
 */
export function docColors(doc: Doc, limit = 16): Color3[] {
  const counts = new Map<string, { c: Color3; n: number }>();
  const add = (c: Color3) => {
    const key = c.join();
    const e = counts.get(key);
    if (e) e.n++;
    else counts.set(key, { c, n: 1 });
  };
  for (const inst of Object.values(doc.instances)) {
    const specs = classDef(inst.className).props;
    const sets: Readonly<Record<string, unknown>>[] = [
      inst.props,
      ...Object.values(inst.overrides ?? {}),
    ];
    for (const props of sets)
      for (const [key, v] of Object.entries(props)) {
        const type = specs[key]?.type;
        if (type === 'color') add(v as Color3);
        else if (type === 'colorseq') for (const k of v as { value: Color3 }[]) add(k.value);
      }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((e) => e.c);
}
