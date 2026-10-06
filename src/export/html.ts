/**
 * HTML/CSS export. `exportHtml` writes one standalone page with the Roblox screens: each
 * ScreenGui covers the window, Position and Size become `calc(Scale% + Offset px)`, and a
 * small inline script handles what needs the real box (Scale corner radii, aspect ratios and
 * TextScaled). It uses the base (Desktop) values. The website export (site.ts) uses the same
 * writer for pages, once per breakpoint. See .claude/rules/exporters.md.
 */
import type { Assets } from '../model/assets.ts';
import { automaticSizeOf, classDef, type AutomaticSize } from '../model/classes.ts';
import {
  breakpointsOf,
  childOfClass,
  childrenOf,
  resolveProps,
  serviceOf,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import { FONTS, type FontName } from '../model/fonts.ts';
import type { AssetId, Color3, ColorSequence, Link, NumberSequence } from '../model/values.ts';
import { calcU, esc, fmtNum, rgb, rgba, roundTo } from './format.ts';

/** What the page shows behind the UI, as the editor's backdrop menu offers. */
export type Backdrop = 'grid' | 'game' | 'night' | 'checker';

export interface HtmlOptions {
  readonly backdrop?: Backdrop;
  /** The image library, for ImageLabel and ImageButton previews. */
  readonly assets?: Assets;
}

const BACKDROP_CSS: Record<Backdrop, string> = {
  grid: 'linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px) 0 0 / 100px 100px, linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px) 0 0 / 100px 100px, linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 10px 10px, linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 10px 10px, #14161b',
  game: 'radial-gradient(120% 60% at 30% 108%, #5d9c46 0 34%, transparent 34.5%), radial-gradient(90% 50% at 85% 112%, #4c8a3b 0 38%, transparent 38.5%), linear-gradient(#7ec3f2 0%, #b7e0fa 58%, #e3f3fd 100%)',
  night: 'linear-gradient(#0d1424, #1b2741 70%, #24324f)',
  checker: '#f2f2f2',
};

export const ALIGN_X = { Left: 'flex-start', Center: 'center', Right: 'flex-end' } as const;
export const ALIGN_Y = { Top: 'flex-start', Center: 'center', Bottom: 'flex-end' } as const;
const FLEX = {
  Left: 'flex-start',
  Top: 'flex-start',
  Center: 'center',
  Right: 'flex-end',
  Bottom: 'flex-end',
} as const;
export const OBJECT_FIT = { Stretch: 'fill', Fit: 'contain', Crop: 'cover' } as const;

/** Google Fonts families with a single style, which take no weight list. */
const STATIC_FAMILIES = new Set(['Luckiest Guy', 'Bangers', 'Press Start 2P', 'Permanent Marker']);

/** HTML tags whose content must be phrasing content, so nothing inside may be a div. */
const PHRASING_ONLY = new Set(['h1', 'h2', 'h3', 'p']);

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
export const gradientCss = (color: ColorSequence, rotation: number) =>
  `linear-gradient(${90 + rotation}deg, ${stops<Color3>(color, rgb)})`;
export const maskCss = (transparency: NumberSequence, rotation: number) =>
  `linear-gradient(${90 + rotation}deg, ${stops<number>(transparency, (t) => `rgba(0,0,0,${roundTo(1 - t, 3)})`)})`;

/** A text outline drawn as a ring of shadows. */
export function textRing(thickness: number, color: string): string {
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

/** A {Scale, Offset} pair on a page's vertical axis, where Scale is a share of the window. */
export function calcV(scale: number, offset: number): string {
  const s = roundTo(scale, 6);
  const o = Math.round(offset);
  if (!s) return o + 'px';
  if (!o) return `calc(var(--vh) * ${s})`;
  return `calc(var(--vh) * ${s} + ${o}px)`;
}

/** A ScrollingFrame's AutomaticCanvasSize, or None for any other object. */
const canvasSizeOf = (props: object): AutomaticSize =>
  'AutomaticCanvasSize' in props ? (props.AutomaticCanvasSize as AutomaticSize) : 'None';

export type Gui = Extract<AnyInstance, { props: { Size: unknown; Visible: boolean } }>;
export const isGui = (inst: AnyInstance): inst is Gui => classDef(inst.className).kind === 'gui';

/** A UIStroke on a text object outlines the letters unless ApplyStrokeMode is Border. */
export const strokesText = (inst: AnyInstance, stroke: Instance<'UIStroke'>) =>
  !!classDef(inst.className).text && stroke.props.ApplyStrokeMode !== 'Border';

export type Decl = readonly [property: string, value: string];
export interface Rule {
  readonly sel: string;
  readonly decls: readonly Decl[];
}
export const ruleText = (r: Rule): string =>
  `${r.sel}{${r.decls.map(([k, v]) => `${k}:${v};`).join('')}}`;

const SCRIPT_OPEN = '<script>';
const SCRIPT_CLOSE = '</scr' + 'ipt>';
export const COMMENT_OPEN = '<' + '!--';

export const FIT_SCRIPT = `
${SCRIPT_OPEN}
  // Sizes that need the real box: aspect ratios, AutomaticSize, AutomaticCanvasSize, rounded
  // corners in Scale, and TextScaled
  (function () {
    function px(v) { return parseFloat(v) || 0; }
    // The exact laid-out size; offsetWidth rounds to whole pixels.
    function size(el) {
      var s = getComputedStyle(el);
      return [px(s.width), px(s.height)];
    }
    // Where a box starts: left or top, moved by its AnchorPoint's translate.
    function start(s, y) {
      var m = /matrix\\(([^)]*)\\)/.exec(s.transform);
      return px(y ? s.top : s.left) + (m ? px(m[1].split(',')[y ? 5 : 4]) : 0);
    }
    function aspect(el) {
      var st = el.style;
      st.width = st.height = st.minWidth = st.minHeight = '';
      var r = +el.dataset.ar, wh = size(el), w = wh[0], h = wh[1];
      if (h > 0 && w / h > r) w = h * r; else h = w / r;
      st.width = w + 'px'; st.height = h + 'px';
    }
    // AutomaticSize: the box grows to fit its text and children, and Size is the smallest it
    // gets. As in the editor, content is measured with the box at its Size, width first.
    function grow(el) {
      var st = el.style, c = el.querySelector(':scope > .c');
      st.minWidth = st.minHeight = '';
      var axes = getComputedStyle(el).getPropertyValue('--auto');
      if (/x/.test(axes)) { walk(c); st.minWidth = need(el, c, 0) + 'px'; }
      if (/y/.test(axes)) { walk(c); st.minHeight = need(el, c, 1) + 'px'; }
      walk(c);
    }
    // AutomaticCanvasSize: a ScrollingFrame's canvas grows the same way to fit its children.
    function canvas(el) {
      var v = el.firstElementChild, c = v && v.firstElementChild;
      if (!c) return;
      var st = v.style;
      st.minWidth = st.minHeight = '';
      var axes = getComputedStyle(el).getPropertyValue('--canvas');
      if (/x/.test(axes)) { walk(c); st.minWidth = need(v, c, 0) + 'px'; }
      if (/y/.test(axes)) { walk(c); st.minHeight = need(v, c, 1) + 'px'; }
      walk(c);
    }
    function need(el, c, y) {
      var cs = getComputedStyle(c), n = 0, items = 0;
      var pad = y ? px(cs.top) + px(cs.bottom) : px(cs.left) + px(cs.right);
      var list = cs.display === 'flex', along = list && (cs.flexDirection === 'column') === !!y;
      for (var k = c.firstElementChild; k; k = k.nextElementSibling) {
        var ks = getComputedStyle(k);
        if (!k.classList.contains('g') || ks.display === 'none') continue;
        var len = px(y ? ks.height : ks.width);
        if (along) { n += len; items++; }
        else n = Math.max(n, (list ? 0 : start(ks, y)) + len);
      }
      if (items > 1) n += (items - 1) * px(y ? cs.rowGap : cs.columnGap);
      n += pad;
      var t = el.querySelector(':scope > .t');
      if (t && t.firstElementChild && !t.hasAttribute('data-fit')) {
        var tn = text(t.firstElementChild, y) + pad;
        // Wrapped text grows the box only as wide as its parent, then wraps.
        if (!y && getComputedStyle(t.firstElementChild).whiteSpace !== 'pre')
          tn = Math.min(tn, px(getComputedStyle(el.parentElement).width));
        n = Math.max(n, tn);
      }
      return n;
    }
    // The text's width on one line, or its height as it wraps now. An empty TextBox shows
    // its placeholder.
    function text(s, y) {
      var input = null, len;
      if (s.tagName === 'INPUT') {
        input = s;
        input.style.display = 'none';
        s = document.createElement('span');
        s.textContent = input.value || input.placeholder;
        input.parentNode.appendChild(s);
      }
      if (y) len = px(getComputedStyle(s).height);
      else {
        s.style.whiteSpace = 'pre';
        len = px(getComputedStyle(s).width);
        s.style.whiteSpace = '';
      }
      if (input) {
        s.remove();
        input.style.display = '';
      }
      return len;
    }
    // Fits the boxes inside a node, outer ones first, to the size their parents have now.
    function walk(node) {
      for (var k = node && node.firstElementChild; k; k = k.nextElementSibling) {
        if (k.hasAttribute('data-ar')) aspect(k);
        if (k.hasAttribute('data-auto')) grow(k);
        else if (k.hasAttribute('data-canvas')) canvas(k);
        else walk(k);
      }
    }
    // A page is as long as what's on it, and boxes that grew push it longer.
    function page(pc) {
      pc.style.minHeight = '';
      var n = px(getComputedStyle(pc).minHeight);
      for (var k = pc.firstElementChild; k; k = k.nextElementSibling) {
        var ks = getComputedStyle(k);
        if (ks.display !== 'none') n = Math.max(n, start(ks, 1) + px(ks.height));
      }
      pc.style.minHeight = n + 'px';
    }
    function fit() {
      walk(document.body);
      document.querySelectorAll('[data-grow]').forEach(page);
      document.querySelectorAll('[data-r]').forEach(function (el) {
        var p = el.dataset.r.split(','), m = Math.min.apply(Math, size(el));
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
    addEventListener('input', fit);
    if (document.fonts) document.fonts.ready.then(fit);
    fit();
  })();
${SCRIPT_CLOSE}`;

/** Where things on a page point; the screens export has none of this. */
export interface WriterLinks {
  /** The `src` for a picture in the image library, if it can be shown. */
  imageSrc(id: AssetId): string | undefined;
  /** Where a Link goes, or undefined when its target is gone. */
  href?(link: Link): string | undefined;
  /** The `id` attribute an object gets because a link points at it. */
  anchor?(id: InstanceId): string | undefined;
}

interface EmitContext {
  /** Directly on a page, where vertical Scale is a share of the window. */
  readonly onPage: boolean;
  /** Inside an element that only takes phrasing content (a heading, a paragraph). */
  readonly phrasing: boolean;
  /** Inside a link, where another link isn't allowed. */
  readonly linked: boolean;
  /** CSS `order` in its list at this breakpoint, when it differs from the base order. */
  readonly order?: number;
}

/**
 * Writes the elements and CSS rules for a tree of objects with the values at one breakpoint
 * (none for the base values). Elements come out in the base order whatever the breakpoint,
 * so the same object gets the same class at every breakpoint and only the CSS differs.
 */
export class HtmlWriter {
  readonly rules: Rule[] = [];
  readonly fontsUsed = new Set<FontName>();
  needsScript = false;
  seq = 0;
  readonly doc: Doc;
  readonly breakpoint: InstanceId | undefined;
  readonly links: WriterLinks;
  constructor(doc: Doc, breakpoint: InstanceId | undefined, links: WriterLinks) {
    this.doc = doc;
    this.breakpoint = breakpoint;
    this.links = links;
  }

  props<I extends AnyInstance>(inst: I): I['props'] {
    return resolveProps(this.doc, inst as Instance, this.breakpoint) as I['props'];
  }

  rule(sel: string, decls: Decl[]) {
    this.rules.push({ sel, decls });
  }

  /**
   * Whether the object has AutomaticSize at the base or at any breakpoint. Such an object
   * gets `data-auto` and says which way it grows in `--auto`, which media queries can change.
   */
  grows(inst: AnyInstance): boolean {
    return this.atAnyBreakpoint(inst, (p) => automaticSizeOf(p) !== 'None');
  }

  /**
   * Whether a ScrollingFrame has AutomaticCanvasSize at the base or at any breakpoint. Its
   * element gets `data-canvas` and says which way the canvas grows in `--canvas`.
   */
  growsCanvas(inst: AnyInstance): boolean {
    return (
      inst.className === 'ScrollingFrame' &&
      this.atAnyBreakpoint(inst, (p) => canvasSizeOf(p) !== 'None')
    );
  }

  atAnyBreakpoint(inst: AnyInstance, test: (props: object) => boolean): boolean {
    const ids = [undefined, ...breakpointsOf(this.doc).map((b) => b.id)];
    return ids.some((bp) => test(resolveProps(this.doc, inst as Instance, bp)));
  }

  /** Insets of a content box: a UIPadding becomes insets, never CSS padding. */
  insetOf(id: InstanceId): Decl[] {
    const pad = childOfClass(this.doc, id, 'UIPadding');
    if (!pad) return [['inset', '0']];
    const p = this.props(pad);
    return [
      ['left', calcU(...p.PaddingLeft)],
      ['top', calcU(...p.PaddingTop)],
      ['right', calcU(...p.PaddingRight)],
      ['bottom', calcU(...p.PaddingBottom)],
    ];
  }

  /** A UIListLayout as flexbox. On a page, a vertical gap in Scale is a share of the window. */
  listCss(list: Instance<'UIListLayout'>, onPage = false): Decl[] {
    const p = this.props(list);
    const vertical = p.FillDirection === 'Vertical';
    const main = vertical ? p.VerticalAlignment : p.HorizontalAlignment;
    const cross = vertical ? p.HorizontalAlignment : p.VerticalAlignment;
    return [
      ['display', 'flex'],
      ['flex-direction', vertical ? 'column' : 'row'],
      ['gap', onPage && vertical ? calcV(...p.Padding) : calcU(...p.Padding)],
      ['justify-content', FLEX[main]],
      ['align-items', FLEX[cross]],
    ];
  }

  /** Gui children in list order, using the base values or this breakpoint's. */
  sortedChildren(id: InstanceId, atBreakpoint = false): Gui[] {
    const items = childrenOf(this.doc, id).filter(isGui);
    const list = childOfClass(this.doc, id, 'UIListLayout');
    if (!list) return items;
    const props = (c: Gui): Gui['props'] => (atBreakpoint ? this.props(c) : c.props);
    const order = items.map((c, i) => ({ c, i, p: props(c) }));
    if (list.props.SortOrder === 'Name')
      order.sort((a, b) => a.p.Name.localeCompare(b.p.Name, 'en', { numeric: true }) || a.i - b.i);
    else order.sort((a, b) => a.p.LayoutOrder - b.p.LayoutOrder || a.i - b.i);
    return order.map((o) => o.c);
  }

  /**
   * The children of `id` as HTML, in the base order. At a breakpoint whose list order differs,
   * each item gets a CSS `order`.
   */
  emitChildren(id: InstanceId, inList: boolean, depth: number, ctx: EmitContext): string {
    const base = this.sortedChildren(id);
    const here = this.breakpoint === undefined ? base : this.sortedChildren(id, true);
    const reordered = here.some((c, i) => c !== base[i]);
    return base
      .map((c) => this.emit(c, inList, depth, reordered ? { ...ctx, order: here.indexOf(c) } : ctx))
      .join('');
  }

  emit(inst: Gui, inList: boolean, depth: number, ctx: EmitContext): string {
    const doc = this.doc;
    const p = this.props(inst);
    const def = classDef(inst.className);
    const cls = 'e' + ++this.seq;
    const r: Decl[] = [];
    const attrs: string[] = [];
    const v = ctx.onPage ? calcV : calcU;
    if (inList) r.push(['position', 'relative'], ['flex', 'none']);
    else {
      r.push(
        ['left', calcU(p.Position[0], p.Position[1])],
        ['top', v(p.Position[2], p.Position[3])],
      );
      const t: string[] = [];
      if (p.AnchorPoint[0] || p.AnchorPoint[1])
        t.push(
          `translate(${roundTo(-p.AnchorPoint[0] * 100, 4)}%, ${roundTo(-p.AnchorPoint[1] * 100, 4)}%)`,
        );
      if (p.Rotation) t.push(`rotate(${roundTo(p.Rotation, 3)}deg)`);
      if (t.length) r.push(['transform', t.join(' ')]);
    }
    r.push(['width', calcU(p.Size[0], p.Size[1])], ['height', v(p.Size[2], p.Size[3])]);
    const grows = this.grows(inst);
    if (grows) {
      r.push(['--auto', automaticSizeOf(p).toLowerCase()]);
      attrs.push('data-auto');
      this.needsScript = true;
    }
    if (this.growsCanvas(inst)) {
      r.push(['--canvas', canvasSizeOf(p).toLowerCase()]);
      attrs.push('data-canvas');
      this.needsScript = true;
    }
    if (p.ZIndex !== 1) r.push(['z-index', String(p.ZIndex)]);
    if (!p.Visible) r.push(['display', 'none']);
    const grad = childOfClass(doc, inst.id, 'UIGradient');
    const g = grad && this.props(grad);
    if (p.BackgroundTransparency < 1) {
      r.push(['background-color', rgba(p.BackgroundColor3, p.BackgroundTransparency)]);
      if (g)
        r.push(
          ['background-image', gradientCss(g.Color, g.Rotation)],
          ['background-blend-mode', 'multiply'],
        );
    }
    if (g && g.Transparency.some((k) => k.value)) {
      const m = maskCss(g.Transparency, g.Rotation);
      r.push(['-webkit-mask-image', m], ['mask-image', m]);
    }
    const corner = childOfClass(doc, inst.id, 'UICorner');
    if (corner) {
      const [s, o] = this.props(corner).CornerRadius;
      if (s >= 0.5) r.push(['border-radius', '9999px']);
      else if (!s) r.push(['border-radius', `${Math.round(o)}px`]);
      else {
        attrs.push(`data-r="${fmtNum(s)},${Math.round(o)}"`);
        this.needsScript = true;
      }
    }
    const strokes = childrenOf(doc, inst.id).filter(
      (k): k is Instance<'UIStroke'> & AnyInstance => k.className === 'UIStroke',
    );
    const shadows: string[] = [];
    if (p.BorderSizePixel > 0 && !corner && p.BackgroundTransparency < 1)
      shadows.push(
        `0 0 0 ${p.BorderSizePixel}px ${rgba(p.BorderColor3, p.BackgroundTransparency)}`,
      );
    for (const s of strokes) {
      const sp = this.props(s);
      if (sp.Thickness > 0 && !strokesText(inst, s))
        shadows.push(`0 0 0 ${fmtNum(sp.Thickness)}px ${rgba(sp.Color, sp.Transparency)}`);
    }
    if (shadows.length) r.push(['box-shadow', shadows.join(', ')]);
    if (p.ClipsDescendants) r.push(['overflow', 'hidden']);
    if (def.scroll) r.push(['overflow', 'auto']);
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
    if (ctx.order !== undefined) r.push(['order', String(ctx.order)]);
    this.rule(`.${cls}`, r);

    // The element: a link, the chosen tag, or a div. Links and tags come from the base values.
    const href =
      inst.props.Link && !ctx.linked && inst.className !== 'TextBox'
        ? this.links.href?.(inst.props.Link)
        : undefined;
    const chosen = inst.props.HtmlTag === 'Auto' ? undefined : inst.props.HtmlTag;
    const allowed = ctx.phrasing ? (chosen && PHRASING_ONLY.has(chosen) ? 'span' : chosen) : chosen;
    const tag = href !== undefined ? 'a' : (allowed ?? (ctx.phrasing ? 'span' : 'div'));
    const phrasing = ctx.phrasing || (!!chosen && PHRASING_ONLY.has(chosen));
    const box = phrasing ? 'span' : 'div';
    const head: string[] = [];
    const anchor = this.links.anchor?.(inst.id);
    if (anchor) head.push(`id="${esc(anchor)}"`);
    if (href !== undefined) {
      head.push(`href="${esc(href)}"`);
      if (inst.props.Link?.newTab) head.push('target="_blank" rel="noopener"');
    }
    const inner = this.emitInner(
      inst,
      cls,
      depth,
      {
        onPage: false,
        phrasing,
        linked: ctx.linked || href !== undefined,
      },
      box,
    );
    const ind = '  '.repeat(depth + 2);
    const attrText = [...head, ...attrs].map((a) => ' ' + a).join('');
    return `\n${ind}<${tag} class="g ${cls}"${attrText} data-name="${esc(p.Name)}">${inner}${inner ? '\n' + ind : ''}</${tag}>`;
  }

  /** What goes inside an object's element: its picture, its text and its children. */
  emitInner(inst: Gui, cls: string, depth: number, ctx: EmitContext, box: string): string {
    const doc = this.doc;
    const ind = '  '.repeat(depth + 2);
    let inner = '';
    if (inst.className === 'ImageLabel' || inst.className === 'ImageButton') {
      const ip = this.props(inst);
      const src = inst.preview ? this.links.imageSrc(inst.preview) : undefined;
      inner += src
        ? `\n${ind}  <img class="img" src="${src}" alt="${esc(inst.props.AltText)}" style="object-fit:${OBJECT_FIT[ip.ScaleType]};opacity:${roundTo(1 - ip.ImageTransparency, 3)}">`
        : `\n${ind}  <${box} class="ph" aria-hidden="true">${esc(ip.Image || 'image')}</${box}>`;
    }
    if (
      inst.className === 'TextLabel' ||
      inst.className === 'TextButton' ||
      inst.className === 'TextBox'
    ) {
      const tp = this.props(inst);
      this.fontsUsed.add(tp.Font);
      const f = fontCss(tp.Font);
      const tc = `${cls}t`;
      const textStrokes = childrenOf(doc, inst.id)
        .filter((k): k is Instance<'UIStroke'> & AnyInstance => k.className === 'UIStroke')
        .map((s) => ({ s, sp: this.props(s) }))
        .filter(({ s, sp }) => sp.Thickness > 0 && strokesText(inst, s));
      this.rule(`.${tc}`, [
        ...this.insetOf(inst.id),
        ['justify-content', ALIGN_X[tp.TextXAlignment]],
        ['align-items', ALIGN_Y[tp.TextYAlignment]],
      ]);
      const ts: Decl[] = [
        ['font-family', f.family],
        ['font-weight', String(f.weight)],
      ];
      if (f.style !== 'normal') ts.push(['font-style', f.style]);
      ts.push(
        ['color', rgba(tp.TextColor3, tp.TextTransparency)],
        ['text-align', tp.TextXAlignment.toLowerCase()],
        ['white-space', tp.TextWrapped ? 'pre-wrap' : 'pre'],
      );
      // Roblox breaks a word too long for the line.
      if (tp.TextWrapped) ts.push(['overflow-wrap', 'anywhere']);
      if (!inst.props.TextScaled) ts.push(['font-size', `${tp.TextSize}px`]);
      if (tp.LineHeight !== 1) ts.push(['line-height', fmtNum(tp.LineHeight)]);
      if (textStrokes.length)
        ts.push([
          'text-shadow',
          textStrokes
            .map(({ sp }) =>
              textRing(
                sp.Thickness,
                rgba(sp.Color, Math.max(sp.Transparency, tp.TextTransparency)),
              ),
            )
            .join(', '),
        ]);
      this.rule(`.${tc} > *`, ts);
      if (inst.props.TextScaled) this.needsScript = true;
      const input = inst.className === 'TextBox';
      const body = input
        ? `<input value="${esc(tp.Text)}" placeholder="${esc(inst.props.PlaceholderText)}" aria-label="${esc(inst.props.PlaceholderText || tp.Name)}">`
        : `<span>${esc(tp.Text)}</span>`;
      inner += `\n${ind}  <${box} class="t ${tc}"${inst.props.TextScaled && !input ? ' data-fit' : ''}>${body}</${box}>`;
    }
    // A box that grows always has a content box: the script reads its padding there.
    if (this.sortedChildren(inst.id).length || this.grows(inst) || this.growsCanvas(inst)) {
      const list = childOfClass(doc, inst.id, 'UIListLayout');
      const cc = cls + 'c';
      const scroll = inst.className === 'ScrollingFrame';
      const kids = this.emitChildren(inst.id, !!list, depth + (scroll ? 3 : 2), ctx);
      const content: Decl[] = [...this.insetOf(inst.id), ...(list ? this.listCss(list) : [])];
      if (scroll) {
        const cs = this.props(inst).CanvasSize;
        this.rule(`.${cls}v`, [
          ['position', 'absolute'],
          ['left', '0'],
          ['top', '0'],
          ['width', `max(100%, ${calcU(cs[0], cs[1])})`],
          ['height', `max(100%, ${calcU(cs[2], cs[3])})`],
        ]);
        this.rule(`.${cc}`, content);
        inner += `\n${ind}  <${box} class="${cls}v">\n${ind}    <${box} class="c ${cc}">${kids}\n${ind}    </${box}>\n${ind}  </${box}>`;
      } else {
        this.rule(`.${cc}`, content);
        inner += `\n${ind}  <${box} class="c ${cc}">${kids}\n${ind}  </${box}>`;
      }
    }
    return inner;
  }
}

/** One standalone page with every ScreenGui in the project. */
export function exportHtml(doc: Doc, options: HtmlOptions = {}): string {
  const assets = options.assets ?? {};
  const w = new HtmlWriter(doc, undefined, { imageSrc: (id) => assets[id] });
  const screenGuis = childrenOf(doc, serviceOf(doc, 'StarterGui').id).filter(
    (c): c is Instance<'ScreenGui'> & AnyInstance => c.className === 'ScreenGui',
  );
  const top: EmitContext = { onPage: false, phrasing: false, linked: false };
  const screens = screenGuis
    .map((sg, i) => {
      const list = childOfClass(doc, sg.id, 'UIListLayout');
      const sc = 's' + (i + 1);
      w.rule(`.${sc}`, [
        ['z-index', String(i + 1)],
        ...(sg.props.Enabled ? [] : ([['display', 'none']] as Decl[])),
        ...(list ? w.listCss(list) : []),
      ]);
      const kids = w.emitChildren(sg.id, !!list, 0, top);
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
  /* A clear ring around whatever the keyboard is on. */
  a:focus-visible, input:focus-visible { outline: 2px solid #2f62ff; outline-offset: 2px; }
  .img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ph { position: absolute; inset: 0; display: grid; place-items: center; font: 12px monospace; color: #555;
        background: repeating-linear-gradient(45deg, #ddd 0 6px, #eee 6px 12px); }
  [data-btn] { cursor: pointer; }
  [data-btn]:hover { filter: brightness(0.9); }
  [data-btn]:active { filter: brightness(0.75); }
  ${w.rules.map(ruleText).join('\n  ')}
</style>
</head>
<body>${screens}${w.needsScript ? FIT_SCRIPT : ''}
</body>
</html>
`;
}
