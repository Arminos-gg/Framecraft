/**
 * Text contrast, as WCAG measures it: how far the text's color is from the color behind it.
 * Body text needs 4.5:1 and large text (24 px, or 19 px bold) 3:1. What's behind the text is
 * worked out from the scene: every object drawn below it that covers its middle, blended from
 * the bottom up over the page's background. On the Roblox screens the game shows through, so
 * text there can only be checked over something solid.
 */
import { isGui, strokesText, type Gui } from '../export/html.ts';
import { classDef } from '../model/classes.ts';
import { FONT_WEIGHTS } from '../model/fonts.ts';
import {
  childOfClass,
  childrenOf,
  getInstance,
  resolveProps,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import type { Color3 } from '../model/values.ts';
import type { Scene } from './editor.ts';

/** WCAG's relative luminance of a color from 0 to 255. */
export function luminance([r, g, b]: Color3): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The contrast ratio of two colors, from 1 (the same) to 21 (black on white). */
export function contrastRatio(a: Color3, b: Color3): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` drawn over `bottom` with an opacity from 0 to 1. */
export function blend(top: Color3, opacity: number, bottom: Color3): Color3 {
  return [0, 1, 2].map((i) => top[i]! * opacity + bottom[i]! * (1 - opacity)) as never;
}

/** A gradient's color at each keypoint multiplies the background, as Roblox draws it. */
const multiply = (a: Color3, b: Color3): Color3 =>
  [0, 1, 2].map((i) => (a[i]! * b[i]!) / 255) as never;

/** WCAG's large text: 24 px, or 18.66 px when bold. */
export const isLargeText = (size: number, weight: number) =>
  size >= 24 || (size >= 18.66 && weight >= 700);

export interface TextContrast {
  /** The ratio, at the point where the background is least different from the text. */
  readonly ratio: number;
  /** What WCAG AA asks for at this size: 4.5 or 3. */
  readonly needed: number;
  readonly text: Color3;
  readonly background: Color3;
}

type TextGui = Instance<'TextLabel' | 'TextButton' | 'TextBox'> & AnyInstance;

const WHITE: Color3 = [255, 255, 255];

/**
 * The objects of a scene in the order they're drawn, bottom first: each object, then its
 * children by ZIndex, as ZIndexBehavior Sibling draws them.
 */
function drawOrder(doc: Doc, scene: Scene): Gui[] {
  const out: Gui[] = [];
  const zOf = (g: Gui) =>
    (resolveProps(doc, g as Instance, scene.breakpoint) as Gui['props']).ZIndex;
  const walk = (id: InstanceId) => {
    const kids = childrenOf(doc, id)
      .filter(isGui)
      .map((c, i) => ({ c, i, z: zOf(c) }))
      .sort((a, b) => a.z - b.z || a.i - b.i);
    for (const { c } of kids) {
      out.push(c);
      walk(c.id);
    }
  };
  for (const root of scene.roots) walk(root);
  return out;
}

/** The layers under a point, bottom first: a color, or the colors a gradient spreads over. */
type Layer = { readonly colors: readonly Color3[]; readonly opacity: number } | 'unknown';

/**
 * How the text of a TextLabel, TextButton or TextBox contrasts with what's behind it in the
 * scene, or undefined when it can't be told: no text, hidden, a picture or the game behind it.
 */
export function textContrast(doc: Doc, scene: Scene, id: InstanceId): TextContrast | undefined {
  const inst = getInstance(doc, id);
  if (!inst || !classDef(inst.className).text) return undefined;
  const t = inst as TextGui;
  const box = scene.layout.get(id);
  if (!box || !box.visible) return undefined;
  const props = <I extends AnyInstance>(i: I) =>
    resolveProps(doc, i as Instance, scene.breakpoint) as I['props'];
  const p = props(t);
  if (!p.Text.trim() || p.TextTransparency >= 1) return undefined;

  // The middle of the text's area.
  const x = box.content.x + box.content.w / 2;
  const y = box.content.y + box.content.h / 2;
  const order = drawOrder(doc, scene);
  const layers: Layer[] = [];
  for (const g of order.slice(0, order.indexOf(t as Gui) + 1)) {
    const b = scene.layout.get(g.id);
    if (!b?.visible || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
    const gp = props(g);
    if (gp.BackgroundTransparency < 1) {
      const gradient = childOfClass(doc, g.id, 'UIGradient');
      const base = gp.BackgroundColor3;
      layers.push({
        colors: gradient ? props(gradient).Color.map((k) => multiply(base, k.value)) : [base],
        opacity: 1 - gp.BackgroundTransparency,
      });
    }
    // A picture's colors are unknown; one that shows makes the background unknown.
    if (g.className === 'ImageLabel' || g.className === 'ImageButton') {
      const ip = props(g as Instance<'ImageLabel'> & AnyInstance);
      if (ip.ImageTransparency < 1 && (g.preview || ip.Image)) layers.push('unknown');
    }
  }

  // Below the topmost solid layer nothing shows; blend the layers above it from the bottom up.
  const solid = layers.findLastIndex((l) => l === 'unknown' || l.opacity >= 1);
  const bottom = layers[solid];
  if (bottom === 'unknown') return undefined;
  let below: Color3[];
  if (bottom) below = [...bottom.colors];
  else if (scene.view.kind === 'page') {
    // Nothing solid: the page's background shows, over the browser's white.
    const page = getInstance(doc, scene.view.pageId) as Instance<'Page'> & AnyInstance;
    const pp = props(page);
    below = [blend(pp.BackgroundColor3, 1 - pp.BackgroundTransparency, WHITE)];
  } else return undefined; // The game shows through a Roblox screen.
  for (const l of layers.slice(solid + 1) as Exclude<Layer, 'unknown'>[])
    below = below.flatMap((b) => l.colors.map((c) => blend(c, l.opacity, b)));

  // Text drawn see-through mixes with the background too.
  const size = p.TextScaled ? Math.min(100, box.content.h) : p.TextSize;
  const needed = isLargeText(size, FONT_WEIGHTS[p.FontWeight]) ? 3 : 4.5;
  let worst: TextContrast | undefined;
  for (const bg of below) {
    const text = blend(p.TextColor3, 1 - p.TextTransparency, bg);
    let ratio = contrastRatio(text, bg);
    // A solid outline around the letters stands between them and the background.
    for (const s of childrenOf(doc, id)) {
      if (s.className !== 'UIStroke') continue;
      const stroke = s as Instance<'UIStroke'> & AnyInstance;
      const sp = props(stroke);
      if (!strokesText(t, stroke) || sp.Thickness < 1 || sp.Transparency > 0.5) continue;
      ratio = Math.max(ratio, contrastRatio(text, blend(sp.Color, 1 - sp.Transparency, bg)));
    }
    if (!worst || ratio < worst.ratio) worst = { ratio, needed, text, background: bg };
  }
  return worst;
}

/** A ratio as people write it, such as 4.5:1, rounded down so 4.49 never reads as passing. */
export const fmtRatio = (r: number) => `${Math.floor(r * 10) / 10}:1`;
