/**
 * The editor's own colors pass WCAG AA in both themes: text 4.5:1 on every surface it sits on,
 * icons and the focus ring 3:1.
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blend, contrastRatio } from '../../../src/editor/contrast.ts';
import type { Color3 } from '../../../src/model/values.ts';

/** The custom properties of the first block after `selector`. */
function tokens(selector: string): Map<string, string> {
  const start = css.indexOf('{', css.indexOf(selector)) + 1;
  const body = css.slice(start, css.indexOf('}', start));
  return new Map([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

type Rgba = [number, number, number, number];
function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/.exec(value);
  if (rgba) return rgba.slice(1).map(Number) as Rgba;
  throw new Error(`Can't read ${value}`);
}

// Read as text: Vitest hands CSS imports over empty.
const css = readFileSync(new URL('../../../src/styles/tokens.css', import.meta.url), 'utf8');

const THEMES = {
  light: tokens(':root {'),
  dark: tokens(":root[data-theme='dark']"),
};

/** Text tokens and the surfaces each is drawn on. */
const TEXT: [string, string[]][] = [
  ['fg', ['bg', 'panel', 'raised', 'field', 'pill']],
  ['muted', ['bg', 'panel', 'raised', 'field']],
  ['faint', ['panel', 'raised', 'field']],
  ['ruler-text', ['ruler']],
  ['accent', ['panel', 'raised', 'field']],
  ['on-accent', ['accent']],
  ['danger', ['panel', 'raised']],
  ['scale', ['panel', 'field']],
  ['offset', ['panel', 'field']],
  ['code-str', ['panel', 'field']],
];
/** Icons and the focus ring: 3:1. */
const GRAPHICS: [string, string[]][] = [
  ['icon', ['panel', 'raised', 'field']],
  ['accent', ['bg', 'panel', 'raised', 'field']],
  ['ico-container', ['panel']],
  ['ico-object', ['panel']],
  ['ico-mod', ['panel']],
];

describe.each(Object.entries(THEMES))('the %s theme', (_, t) => {
  const color = (name: string, on: Color3): Color3 => {
    const [r, g, b, a] = parse(t.get(name)!);
    return blend([r, g, b], a, on);
  };
  const surface = (name: string) => color(name, [255, 255, 255]);
  const check = (pairs: [string, string[]][], needed: number) => {
    const failing: string[] = [];
    for (const [fg, surfaces] of pairs)
      for (const s of surfaces) {
        // Hovered and selected rows and menu items tint the panels.
        const tints = s === 'panel' || s === 'raised' ? [null, 'hover', 'accent-soft'] : [null];
        for (const tint of tints) {
          const under = tint ? color(tint, surface(s)) : surface(s);
          const ratio = contrastRatio(color(fg, under), under);
          if (ratio < needed)
            failing.push(`${fg} on ${s}${tint ? ` + ${tint}` : ''}: ${ratio.toFixed(2)}`);
        }
      }
    return failing;
  };

  it('has text that reads at 4.5:1', () => {
    expect(check(TEXT, 4.5)).toEqual([]);
  });

  it('has icons and focus rings that show at 3:1', () => {
    expect(check(GRAPHICS, 3)).toEqual([]);
  });
});
