/**
 * The website export: the Site's pages as files a static host serves as they are. Each page
 * becomes an HTML file at its path, pictures from the image library become files in
 * `images/`, and each breakpoint's changes become a media query. Pages lay out as the layout
 * engine does: as wide as the window, Scale on the vertical axis a share of the window, and
 * the page growing to fit its content.
 */
import type { Assets } from '../model/assets.ts';
import {
  breakpointsOf,
  childOfClass,
  childrenOf,
  serviceOf,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../model/document.ts';
import type { AssetId, Link } from '../model/values.ts';
import { calcU, esc, rgb, roundTo } from './format.ts';
import {
  calcV,
  COMMENT_OPEN,
  FIT_SCRIPT,
  googleFontsHref,
  HtmlWriter,
  isGui,
  ruleText,
  type Decl,
  type Rule,
  type WriterLinks,
} from './html.ts';

/** One file of the exported site: text for pages, bytes for pictures. */
export interface SiteFile {
  readonly path: string;
  readonly contents: string | Uint8Array;
}

type Page = Instance<'Page'>;

interface PageFile {
  /** Path of the HTML file, such as `pricing/index.html`. */
  readonly file: string;
  /** Folders between the site root and the file, for relative links. */
  readonly depth: number;
  /** The clean URL path, such as `pricing/`, for canonical links. */
  readonly url: string;
}

/** Lowercase letters, digits and dashes, as web addresses usually are. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Where each page goes. `/` is `index.html` and `/pricing` is `pricing/index.html`. A page
 * marked NotFound is `404.html`. Without a page at `/`, the first page becomes the home page.
 * Two pages with the same path get `-2`, `-3` and so on.
 */
export function pageFiles(pages: readonly Page[]): Map<InstanceId, PageFile> {
  const out = new Map<InstanceId, PageFile>();
  const taken = new Set<string>();
  const notFound = pages.find((p) => p.props.NotFound);
  if (notFound) {
    out.set(notFound.id, { file: '404.html', depth: 0, url: '404.html' });
    taken.add('404.html');
  }
  const rest = pages.filter((p) => p !== notFound);
  const segmentsOf = (p: Page) => p.props.Path.split('/').map(slug).filter(Boolean);
  const home = rest.find((p) => !segmentsOf(p).length) ?? rest[0];
  for (const page of rest) {
    const segs = page === home ? [] : segmentsOf(page);
    if (!segs.length && page !== home) segs.push(slug(page.props.Name) || 'page');
    let file = segs.length ? `${segs.join('/')}/index.html` : 'index.html';
    for (let n = 2; taken.has(file); n++) {
      const last = `${segs.at(-1) ?? 'page'}-${n}`;
      segs.splice(-1, 1, last);
      file = `${segs.join('/')}/index.html`;
    }
    taken.add(file);
    out.set(page.id, { file, depth: segs.length, url: segs.length ? `${segs.join('/')}/` : '' });
  }
  return out;
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  gif: 'gif',
  webp: 'webp',
  avif: 'avif',
  'svg+xml': 'svg',
  'x-icon': 'ico',
  'vnd.microsoft.icon': 'ico',
};

/** The file name a library picture gets, from its id and type. */
export function imageFile(id: AssetId, dataUrl: string): string {
  const type = /^data:image\/([\w.+-]+)/.exec(dataUrl)?.[1] ?? '';
  return `images/${id}.${IMAGE_TYPES[type] ?? 'img'}`;
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Values a declaration falls back to when a breakpoint drops it. */
const RESET: Record<string, string> = {
  transform: 'none',
  'z-index': 'auto',
  display: 'block',
  'background-color': 'transparent',
  'background-image': 'none',
  'background-blend-mode': 'normal',
  '-webkit-mask-image': 'none',
  'mask-image': 'none',
  'border-radius': '0',
  'box-shadow': 'none',
  overflow: 'visible',
  'font-style': 'normal',
  'text-shadow': 'none',
  order: '0',
};

/** The declarations that change from `before` to `after`, in the order `after` lists them. */
export function changedDecls(before: readonly Decl[], after: readonly Decl[]): Decl[] {
  const was = new Map(before);
  const now = new Map(after);
  const out: Decl[] = [];
  for (const [k, v] of now) if (was.get(k) !== v) out.push([k, v]);
  for (const k of was.keys()) if (!now.has(k)) out.push([k, RESET[k] ?? 'initial']);
  return out;
}

/** Page padding on the vertical axis: Scale is a share of the window height. */
function calcVh(scale: number, offset: number): string {
  const s = roundTo(scale * 100, 4);
  const o = Math.round(offset);
  if (!s) return o + 'px';
  if (!o) return s + 'vh';
  return `calc(${s}vh + ${o}px)`;
}

const STATIC_CSS = `  html, body { margin: 0; }
  body { min-height: 100vh; }
  /* A page is as wide as the window and grows with its content. On a page, Scale on the
     vertical axis is a share of the window height (--vh), as in the editor. */
  .page { display: block; overflow-x: clip; box-sizing: border-box; }
  .g { position: absolute; box-sizing: border-box; margin: 0; font-size: inherit; font-weight: inherit; }
  .c, .t { position: absolute; }
  .pc { position: relative; }
  a.g { color: inherit; text-decoration: none; }
  .t { display: flex; pointer-events: none; }
  .t > * { line-height: 1; }
  .t > input { pointer-events: auto; width: 100%; height: 100%; border: 0; background: transparent; outline: none; padding: 0; font-size: inherit; }
  .img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ph { position: absolute; inset: 0; display: grid; place-items: center; font: 12px monospace; color: #555;
        background: repeating-linear-gradient(45deg, #ddd 0 6px, #eee 6px 12px); }
  [data-btn] { cursor: pointer; }
  [data-btn]:hover { filter: brightness(0.9); }
  [data-btn]:active { filter: brightness(0.75); }`;

/** The page's own rules and its elements, with the values the writer's breakpoint gives. */
function writePage(w: HtmlWriter, page: Page): string {
  const doc = w.doc;
  const p = w.props(page);
  w.rule('body', [['background-color', rgb(p.BackgroundColor3)]]);
  const padding = childOfClass(doc, page.id, 'UIPadding');
  const pad = padding && w.props(padding);
  if (pad)
    w.rule('.page', [
      ['padding-top', calcVh(...pad.PaddingTop)],
      ['padding-right', calcU(...pad.PaddingRight)],
      ['padding-bottom', calcVh(...pad.PaddingBottom)],
      ['padding-left', calcU(...pad.PaddingLeft)],
    ]);
  const vertical = pad
    ? [pad.PaddingTop, pad.PaddingBottom].filter(([s, o]) => s || o).map((u) => calcVh(...u))
    : [];
  const vh = vertical.length ? `calc(100vh - ${vertical.join(' - ')})` : '100vh';

  // Free-placed sections grow the page through min-height; a list grows it by itself.
  const list = childOfClass(doc, page.id, 'UIListLayout');
  const bottoms: string[] = [];
  if (!list)
    for (const c of childrenOf(doc, page.id).filter(isGui)) {
      const cp = w.props(c);
      if (!cp.Visible) continue;
      const below = 1 - cp.AnchorPoint[1];
      bottoms.push(calcV(cp.Position[2] + below * cp.Size[2], cp.Position[3] + below * cp.Size[3]));
    }
  w.rule('.pc', [
    ['--vh', vh],
    ['min-height', bottoms.length ? `max(var(--vh), ${bottoms.join(', ')})` : 'var(--vh)'],
    ...(list ? w.listCss(list, true) : []),
  ]);
  return w.emitChildren(page.id, !!list, 1, { onPage: true, phrasing: false, linked: false });
}

/** Every link that points at a section, as the id its target object gets on its page. */
function sectionAnchors(doc: Doc, pages: readonly Page[]): Map<InstanceId, string> {
  const anchors = new Map<InstanceId, string>();
  const wanted = new Map<InstanceId, Set<string>>();
  for (const page of pages)
    for (const id of subtreeIds(doc, page.id)) {
      const inst = doc.instances[id]!;
      const link: Link | null | undefined = isGui(inst) ? inst.props.Link : undefined;
      if (link?.kind !== 'page' || !link.section) continue;
      const set = wanted.get(link.page) ?? new Set<string>();
      set.add(slug(link.section));
      wanted.set(link.page, set);
    }
  for (const page of pages) {
    const names = wanted.get(page.id);
    if (!names) continue;
    for (const id of subtreeIds(doc, page.id)) {
      const inst: AnyInstance = doc.instances[id]!;
      const name = slug(inst.props.Name);
      if (isGui(inst) && names.has(name)) {
        anchors.set(id, name);
        names.delete(name);
      }
    }
  }
  return anchors;
}

/**
 * The website as files: one HTML file per page and the pictures they use. Empty when the
 * Site has no pages.
 */
export function exportSite(doc: Doc, assets: Assets = {}): SiteFile[] {
  const site = serviceOf(doc, 'Site');
  const pages = childrenOf(doc, site.id).filter(
    (c): c is Page & AnyInstance => c.className === 'Page',
  );
  const files = pageFiles(pages);
  const anchors = sectionAnchors(doc, pages);
  const breakpoints = breakpointsOf(doc);
  const images = new Map<AssetId, string>();
  const imagePath = (id: AssetId) => {
    const url = assets[id];
    if (!url) return undefined;
    const path = imageFile(id, url);
    images.set(id, path);
    return path;
  };
  const sp = site.props;
  const lang = sp.Language.trim() || 'en';
  const baseUrl = /^https?:\/\/\S+$/.test(sp.BaseUrl.trim())
    ? sp.BaseUrl.trim().replace(/\/+$/, '')
    : '';

  const out: SiteFile[] = [];
  for (const page of pages) {
    const at = files.get(page.id)!;
    const up = '../'.repeat(at.depth);
    const links: WriterLinks = {
      imageSrc: (id) => {
        const path = imagePath(id);
        return path && up + path;
      },
      href: (link) => {
        if (link.kind === 'url') return link.url;
        const target = files.get(link.page);
        if (!target) return undefined;
        const hash = link.section ? '#' + slug(link.section) : '';
        return link.page === page.id && hash ? hash : up + target.file + hash;
      },
      anchor: (id) => anchors.get(id),
    };

    const base = new HtmlWriter(doc, undefined, links);
    const body = writePage(base, page);
    let previous: readonly Rule[] = base.rules;
    const media: string[] = [];
    for (const bp of breakpoints) {
      const w = new HtmlWriter(doc, bp.id, links);
      writePage(w, page);
      const before = new Map(previous.map((r) => [r.sel, r.decls]));
      const changed = w.rules
        .map((r) => ({ sel: r.sel, decls: changedDecls(before.get(r.sel) ?? [], r.decls) }))
        .filter((r) => r.decls.length);
      if (changed.length)
        media.push(
          `@media (max-width: ${bp.props.MaxWidth}px) {\n    ${changed.map(ruleText).join('\n    ')}\n  }`,
        );
      previous = w.rules;
    }

    const pp = page.props;
    const head: string[] = [`<title>${esc(pp.Title || pp.Name)}</title>`];
    if (pp.Description) head.push(`<meta name="description" content="${esc(pp.Description)}">`);
    const canonical = baseUrl && !pp.NotFound ? `${baseUrl}/${at.url}` : '';
    if (canonical) head.push(`<link rel="canonical" href="${esc(canonical)}">`);
    head.push(`<meta property="og:title" content="${esc(pp.Title || pp.Name)}">`);
    if (pp.Description)
      head.push(`<meta property="og:description" content="${esc(pp.Description)}">`);
    if (canonical) head.push(`<meta property="og:url" content="${esc(canonical)}">`);
    const social = pp.SocialImage && baseUrl ? imagePath(pp.SocialImage) : undefined;
    if (social) head.push(`<meta property="og:image" content="${esc(`${baseUrl}/${social}`)}">`);
    const favicon = sp.Favicon ? imagePath(sp.Favicon) : undefined;
    if (favicon) head.push(`<link rel="icon" href="${esc(up + favicon)}">`);
    const fontsHref = googleFontsHref([...base.fontsUsed]);
    if (fontsHref) head.push(`<link rel="stylesheet" href="${fontsHref}">`);

    const html = `<!doctype html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head.join('\n')}
${COMMENT_OPEN} Built with Framecraft. Every object keeps its Roblox name in data-name. -->
<style>
${STATIC_CSS}
  ${[...base.rules.map(ruleText), ...media].join('\n  ')}
</style>
</head>
<body>
  <main class="page" data-name="${esc(pp.Name)}">
    <div class="c pc">${body}
    </div>
  </main>${base.needsScript ? FIT_SCRIPT : ''}
</body>
</html>
`;
    out.push({ path: at.file, contents: html });
  }

  // Home first, then the other pages in Site order, the 404 page, and the pictures.
  out.sort((a, b) => rank(a.path) - rank(b.path));
  for (const [id, path] of [...images].sort(([, a], [, b]) => (a < b ? -1 : 1)))
    out.push({ path, contents: dataUrlBytes(assets[id]!) });
  return out;
}

const rank = (path: string) => (path === 'index.html' ? 0 : path === '404.html' ? 2 : 1);
