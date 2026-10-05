/**
 * HTML/CSS export of the Roblox screens: one standalone page where each ScreenGui covers the
 * window, Position and Size become `calc(Scale% + Offset px)`, and a small inline script
 * handles what needs the real box (Scale corner radii, aspect ratios and TextScaled).
 * It uses the base (Desktop) values. See .claude/rules/exporters.md.
 */
import type { Assets } from '../model/assets.ts';
import { classDef } from '../model/classes.ts';
import {
  childOfClass,
  childrenOf,
  serviceOf,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import { FONTS, type FontName } from '../model/fonts.ts';
import type { Color3, ColorSequence, NumberSequence } from '../model/values.ts';
import { calcU, esc, fmtNum, rgb, rgba, roundTo } from './format.ts';

/** What the page shows behind the UI, as the editor's backdrop menu offers. */
export type Backdrop = 'game' | 'night' | 'checker';

export interface HtmlOptions {
  readonly backdrop?: Backdrop;
  /** The image library, for ImageLabel and ImageButton previews. */
  readonly assets?: Assets;
}

const BACKDROP_CSS: Record<Backdrop, string> = {
  game: 'radial-gradient(120% 60% at 30% 108%, #5d9c46 0 34%, transparent 34.5%), radial-gradient(90% 50% at 85% 112%, #4c8a3b 0 38%, transparent 38.5%), linear-gradient(#7ec3f2 0%, #b7e0fa 58%, #e3f3fd 100%)',
  night: 'linear-gradient(#0d1424, #1b2741 70%, #24324f)',
  checker: '#f2f2f2',
};

const ALIGN_X = { Left: 'flex-start', Center: 'center', Right: 'flex-end' } as const;
const ALIGN_Y = { Top: 'flex-start', Center: 'center', Bottom: 'flex-end' } as const;
const FLEX = {
  Left: 'flex-start',
  Top: 'flex-start',
  Center: 'center',
  Right: 'flex-end',
  Bottom: 'flex-end',
} as const;
const OBJECT_FIT = { Stretch: 'fill', Fit: 'contain', Crop: 'cover' } as const;

/** Google Fonts families with a single style, which take no weight list. */
const STATIC_FAMILIES = new Set(['Luckiest Guy', 'Bangers', 'Press Start 2P', 'Permanent Marker']);

/** The CSS font for a Roblox font: its Google look-alike with a fallback. */
export function fontCss(name: FontName) {
  const f: { family: string; weight: number; italic?: boolean } = FONTS[name];
  const mono = /Mono/.test(f.family) || f.family === 'Press Start 2P';
  const serif = f.family === 'Merriweather';
  const fallback = mono
    ? 'ui-monospace, monospace'
    : serif
      ? 'Georgia, serif'
      : 'system-ui, sans-serif';
  return {
    family: `"${f.family}", ${fallback}`,
    weight: f.weight,
    style: f.italic ? 'italic' : 'normal',
  };
}

/** One Google Fonts stylesheet link for every font the page uses. */
export function googleFontsHref(names: readonly FontName[]): string | null {
  const families = new Map<string, Set<string>>();
  for (const name of names) {
    const f: { family: string; weight: number; italic?: boolean } = FONTS[name];
    const specs = families.get(f.family) ?? new Set<string>();
    specs.add((f.italic ? '1,' : '0,') + f.weight);
    families.set(f.family, specs);
  }
  const parts = [...families].map(([family, set]) => {
    const name = family.replace(/ /g, '+');
    if (STATIC_FAMILIES.has(family)) return 'family=' + name;
    const specs = [...set].sort();
    if (specs.some((s) => s.startsWith('1,'))) return `family=${name}:ital,wght@${specs.join(';')}`;
    const weights = specs.map((s) => s.slice(2)).sort((a, b) => +a - +b);
    return `family=${name}:wght@${weights.join(';')}`;
  });
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : null;
}

/** Two keypoints at the ends need no stop positions; more get a position each. */
function stops<T>(seq: readonly { time: number; value: T }[], css: (v: T) => string): string {
  if (seq.length === 2) return seq.map((k) => css(k.value)).join(', ');
  return seq.map((k) => `${css(k.value)} ${roundTo(k.time * 100, 2)}%`).join(', ');
}
const gradientCss = (color: ColorSequence, rotation: number) =>
  `linear-gradient(${90 + rotation}deg, ${stops<Color3>(color, rgb)})`;
const maskCss = (transparency: NumberSequence, rotation: number) =>
  `linear-gradient(${90 + rotation}deg, ${stops<number>(transparency, (t) => `rgba(0,0,0,${roundTo(1 - t, 3)})`)})`;

/** A text outline drawn as a ring of shadows. */
function textRing(thickness: number, color: string): string {
  const out: string[] = [];
  const n = thickness <= 1.5 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(
      `${roundTo(Math.cos(a) * thickness, 2)}px ${roundTo(Math.sin(a) * thickness, 2)}px 0 ${color}`,
    );
  }
  return out.join(', ');
}

type Gui = Extract<AnyInstance, { props: { Size: unknown; Visible: boolean } }>;
const isGui = (inst: AnyInstance): inst is Gui => classDef(inst.className).kind === 'gui';

/** A UIStroke on a text object outlines the letters unless ApplyStrokeMode is Border. */
const strokesText = (inst: AnyInstance, stroke: Instance<'UIStroke'>) =>
  !!classDef(inst.className).text && stroke.props.ApplyStrokeMode !== 'Border';

const SCRIPT_OPEN = '<script>';
const SCRIPT_CLOSE = '</scr' + 'ipt>';
const COMMENT_OPEN = '<' + '!--';

const FIT_SCRIPT = `
${SCRIPT_OPEN}
  // Sizes that need the real box: rounded corners in Scale, aspect ratios, and TextScaled
  (function () {
    function fit() {
      var ar = document.querySelectorAll('[data-ar]');
      ar.forEach(function (el) { el.style.width = ''; el.style.height = ''; });
      ar.forEach(function (el) {
        var r = +el.dataset.ar, w = el.offsetWidth, h = el.offsetHeight;
        if (h > 0 && w / h > r) w = h * r; else h = w / r;
        el.style.width = w + 'px'; el.style.height = h + 'px';
      });
      document.querySelectorAll('[data-r]').forEach(function (el) {
        var p = el.dataset.r.split(','), m = Math.min(el.offsetWidth, el.offsetHeight);
        el.style.borderRadius = Math.max(0, Math.min(+p[0] * m + +p[1], m / 2)) + 'px';
      });
      document.querySelectorAll('[data-fit]').forEach(function (t) {
        var s = t.firstElementChild, W = t.clientWidth, H = t.clientHeight, lo = 1, hi = 100;
        while (lo < hi) {
          var mid = (lo + hi + 1) >> 1;
          s.style.fontSize = mid + 'px';
          if (s.scrollWidth <= W + 0.5 && s.offsetWidth <= W + 0.5 && s.offsetHeight <= H + 0.5) lo = mid; else hi = mid - 1;
        }
        s.style.fontSize = lo + 'px';
      });
    }
    addEventListener('resize', fit);
    if (document.fonts) document.fonts.ready.then(fit);
    fit();
  })();
${SCRIPT_CLOSE}`;

/** Writes the page; one instance of this per export keeps its class counter and font list. */
class HtmlWriter {
  readonly css: string[] = [];
  readonly fontsUsed = new Set<FontName>();
  needsScript = false;
  seq = 0;
  readonly doc: Doc;
  readonly assets: Assets;
  constructor(doc: Doc, assets: Assets) {
    this.doc = doc;
    this.assets = assets;
  }

  /** Inset of the content box: a UIPadding becomes insets, never CSS padding. */
  insetOf(id: InstanceId): string {
    const pad = childOfClass(this.doc, id, 'UIPadding');
    if (!pad) return 'inset:0;';
    const p = pad.props;
    return `left:${calcU(...p.PaddingLeft)};top:${calcU(...p.PaddingTop)};right:${calcU(...p.PaddingRight)};bottom:${calcU(...p.PaddingBottom)};`;
  }

  listCss(list: Instance<'UIListLayout'>): string {
    const p = list.props;
    const vertical = p.FillDirection === 'Vertical';
    const main = vertical ? p.VerticalAlignment : p.HorizontalAlignment;
    const cross = vertical ? p.HorizontalAlignment : p.VerticalAlignment;
    return `display:flex;flex-direction:${vertical ? 'column' : 'row'};gap:${calcU(...p.Padding)};justify-content:${FLEX[main]};align-items:${FLEX[cross]};`;
  }

  /** Gui children, in UIListLayout order when the parent has one. */
  sortedChildren(id: InstanceId): Gui[] {
    const items = childrenOf(this.doc, id).filter(isGui);
    const list = childOfClass(this.doc, id, 'UIListLayout');
    if (!list) return items;
    const order = items.map((c, i) => ({ c, i }));
    if (list.props.SortOrder === 'Name')
      order.sort(
        (a, b) =>
          a.c.props.Name.localeCompare(b.c.props.Name, 'en', { numeric: true }) || a.i - b.i,
      );
    else order.sort((a, b) => a.c.props.LayoutOrder - b.c.props.LayoutOrder || a.i - b.i);
    return order.map((o) => o.c);
  }

  emit(inst: Gui, inList: boolean, depth: number): string {
    const doc = this.doc;
    const p = inst.props;
    const def = classDef(inst.className);
    const cls = 'e' + ++this.seq;
    const r: string[] = [];
    const attrs: string[] = [];
    if (inList) r.push('position:relative;flex:none;');
    else {
      r.push(
        `left:${calcU(p.Position[0], p.Position[1])};top:${calcU(p.Position[2], p.Position[3])};`,
      );
      const t: string[] = [];
      if (p.AnchorPoint[0] || p.AnchorPoint[1])
        t.push(
          `translate(${roundTo(-p.AnchorPoint[0] * 100, 4)}%, ${roundTo(-p.AnchorPoint[1] * 100, 4)}%)`,
        );
      if (p.Rotation) t.push(`rotate(${roundTo(p.Rotation, 3)}deg)`);
      if (t.length) r.push(`transform:${t.join(' ')};`);
    }
    r.push(`width:${calcU(p.Size[0], p.Size[1])};height:${calcU(p.Size[2], p.Size[3])};`);
    if (p.ZIndex !== 1) r.push(`z-index:${p.ZIndex};`);
    if (!p.Visible) r.push('display:none;');
    const grad = childOfClass(doc, inst.id, 'UIGradient');
    if (p.BackgroundTransparency < 1) {
      r.push(`background-color:${rgba(p.BackgroundColor3, p.BackgroundTransparency)};`);
      if (grad)
        r.push(
          `background-image:${gradientCss(grad.props.Color, grad.props.Rotation)};background-blend-mode:multiply;`,
        );
    }
    if (grad && grad.props.Transparency.some((k) => k.value)) {
      const m = maskCss(grad.props.Transparency, grad.props.Rotation);
      r.push(`-webkit-mask-image:${m};mask-image:${m};`);
    }
    const corner = childOfClass(doc, inst.id, 'UICorner');
    if (corner) {
      const [s, o] = corner.props.CornerRadius;
      if (s >= 0.5) r.push('border-radius:9999px;');
      else if (!s) r.push(`border-radius:${Math.round(o)}px;`);
      else {
        attrs.push(`data-r="${fmtNum(s)},${Math.round(o)}"`);
        this.needsScript = true;
      }
    }
    const strokes = childrenOf(doc, inst.id).filter(
      (k): k is Instance<'UIStroke'> & AnyInstance =>
        k.className === 'UIStroke' && k.props.Thickness > 0,
    );
    const shadows: string[] = [];
    if (p.BorderSizePixel > 0 && !corner && p.BackgroundTransparency < 1)
      shadows.push(
        `0 0 0 ${p.BorderSizePixel}px ${rgba(p.BorderColor3, p.BackgroundTransparency)}`,
      );
    for (const s of strokes)
      if (!strokesText(inst, s))
        shadows.push(
          `0 0 0 ${fmtNum(s.props.Thickness)}px ${rgba(s.props.Color, s.props.Transparency)}`,
        );
    if (shadows.length) r.push(`box-shadow:${shadows.join(', ')};`);
    if (p.ClipsDescendants) r.push('overflow:hidden;');
    if (def.scroll) r.push('overflow:auto;');
    const aspect = childOfClass(doc, inst.id, 'UIAspectRatioConstraint');
    if (aspect) {
      attrs.push(`data-ar="${fmtNum(aspect.props.AspectRatio)}"`);
      this.needsScript = true;
    }
    if (
      (inst.className === 'TextButton' || inst.className === 'ImageButton') &&
      inst.props.AutoButtonColor
    )
      attrs.push('data-btn');
    this.css.push(`.${cls}{${r.join('')}}`);

    const ind = '  '.repeat(depth + 2);
    let inner = '';
    if (inst.className === 'ImageLabel' || inst.className === 'ImageButton') {
      const ip = inst.props;
      const src = inst.preview ? this.assets[inst.preview] : undefined;
      inner += src
        ? `\n${ind}  <img class="img" src="${src}" alt="" style="object-fit:${OBJECT_FIT[ip.ScaleType]};opacity:${roundTo(1 - ip.ImageTransparency, 3)}">`
        : `\n${ind}  <div class="ph">${esc(ip.Image || 'image')}</div>`;
    }
    if (
      inst.className === 'TextLabel' ||
      inst.className === 'TextButton' ||
      inst.className === 'TextBox'
    ) {
      const tp = inst.props;
      this.fontsUsed.add(tp.Font);
      const f = fontCss(tp.Font);
      const tc = cls + 't';
      const textStrokes = strokes.filter((s) => strokesText(inst, s));
      this.css.push(
        `.${tc}{${this.insetOf(inst.id)}justify-content:${ALIGN_X[tp.TextXAlignment]};align-items:${ALIGN_Y[tp.TextYAlignment]};}`,
      );
      const ts = [
        `font-family:${f.family}`,
        `font-weight:${f.weight}`,
        f.style !== 'normal' ? `font-style:${f.style}` : '',
        `color:${rgba(tp.TextColor3, tp.TextTransparency)}`,
        `text-align:${tp.TextXAlignment.toLowerCase()}`,
        `white-space:${tp.TextWrapped ? 'pre-wrap' : 'pre'}`,
        tp.TextScaled ? '' : `font-size:${tp.TextSize}px`,
        textStrokes.length
          ? `text-shadow:${textStrokes.map((s) => textRing(s.props.Thickness, rgba(s.props.Color, Math.max(s.props.Transparency, tp.TextTransparency)))).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join(';');
      this.css.push(`.${tc} > *{${ts};}`);
      if (tp.TextScaled) this.needsScript = true;
      const input = inst.className === 'TextBox';
      const body = input
        ? `<input value="${esc(tp.Text)}" placeholder="${esc(inst.props.PlaceholderText)}" aria-label="${esc(tp.Name)}">`
        : `<span>${esc(tp.Text)}</span>`;
      inner += `\n${ind}  <div class="t ${tc}"${tp.TextScaled && !input ? ' data-fit' : ''}>${body}</div>`;
    }
    const children = this.sortedChildren(inst.id);
    if (children.length) {
      const list = childOfClass(doc, inst.id, 'UIListLayout');
      const cc = cls + 'c';
      const scroll = inst.className === 'ScrollingFrame';
      const kids = children.map((c) => this.emit(c, !!list, depth + (scroll ? 3 : 2))).join('');
      if (scroll) {
        const cs = inst.props.CanvasSize;
        this.css.push(
          `.${cls}v{position:absolute;left:0;top:0;width:max(100%, ${calcU(cs[0], cs[1])});height:max(100%, ${calcU(cs[2], cs[3])});}`,
        );
        this.css.push(`.${cc}{${this.insetOf(inst.id)}${list ? this.listCss(list) : ''}}`);
        inner += `\n${ind}  <div class="${cls}v">\n${ind}    <div class="c ${cc}">${kids}\n${ind}    </div>\n${ind}  </div>`;
      } else {
        this.css.push(`.${cc}{${this.insetOf(inst.id)}${list ? this.listCss(list) : ''}}`);
        inner += `\n${ind}  <div class="c ${cc}">${kids}\n${ind}  </div>`;
      }
    }
    const attrText = attrs.length ? ' ' + attrs.join(' ') : '';
    return `\n${ind}<div class="g ${cls}"${attrText} data-name="${esc(p.Name)}">${inner}${inner ? '\n' + ind : ''}</div>`;
  }
}

/** One standalone page with every ScreenGui in the project. */
export function exportHtml(doc: Doc, options: HtmlOptions = {}): string {
  const w = new HtmlWriter(doc, options.assets ?? {});
  const screenGuis = childrenOf(doc, serviceOf(doc, 'StarterGui').id).filter(
    (c): c is Instance<'ScreenGui'> & AnyInstance => c.className === 'ScreenGui',
  );
  const screens = screenGuis
    .map((sg, i) => {
      const list = childOfClass(doc, sg.id, 'UIListLayout');
      const sc = 's' + (i + 1);
      w.css.push(
        `.${sc}{z-index:${i + 1};${sg.props.Enabled ? '' : 'display:none;'}${list ? w.listCss(list) : ''}}`,
      );
      const kids = w
        .sortedChildren(sg.id)
        .map((c) => w.emit(c, !!list, 0))
        .join('');
      return `\n  <div class="screen ${sc}" data-name="${esc(sg.props.Name)}">${kids}\n  </div>`;
    })
    .join('');
  const fontsHref = googleFontsHref([...w.fontsUsed]);
  const title = esc(screenGuis[0]?.props.Name ?? 'Framecraft export');
  const backdrop = BACKDROP_CSS[options.backdrop ?? 'game'];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${COMMENT_OPEN} Built with Framecraft (prototype). Every object keeps its Roblox name in data-name. -->${fontsHref ? `\n<link rel="stylesheet" href="${fontsHref}">` : ''}
<style>
  html, body { margin: 0; height: 100%; }
  body { background: ${backdrop}; overflow: hidden; }
  /* A ScreenGui covers the window. Position and Size are {Scale, Offset} pairs: calc(Scale% + Offset px). */
  .screen { position: fixed; inset: 0; }
  .g { position: absolute; box-sizing: border-box; }
  .c, .t { position: absolute; }
  .t { display: flex; pointer-events: none; }
  .t > * { line-height: 1; }
  .t > input { pointer-events: auto; width: 100%; height: 100%; border: 0; background: transparent; outline: none; padding: 0; font-size: inherit; }
  .img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ph { position: absolute; inset: 0; display: grid; place-items: center; font: 12px monospace; color: #555;
        background: repeating-linear-gradient(45deg, #ddd 0 6px, #eee 6px 12px); }
  [data-btn] { cursor: pointer; }
  [data-btn]:hover { filter: brightness(0.9); }
  [data-btn]:active { filter: brightness(0.75); }
  ${w.css.join('\n  ')}
</style>
</head>
<body>${screens}${w.needsScript ? FIT_SCRIPT : ''}
</body>
</html>
`;
}
