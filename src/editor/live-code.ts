/**
 * The live code view's text: the exported code for what's being edited, shaped for reading.
 * A web page splits into its HTML (with the style sheet and scripts folded away) and its CSS
 * (one declaration per line), and every line knows the object it belongs to, so the view can
 * mark the selection's code and a click on a line selects its object. Copying still takes the
 * exported file exactly as it downloads.
 */
import type { Assets } from '../model/assets.ts';
import { getInstance, type Doc, type InstanceId } from '../model/document.ts';
import { exportHtmlMapped, type Backdrop } from '../export/html.ts';
import { exportLuauMapped } from '../export/luau.ts';
import { exportSiteMapped } from '../export/site.ts';

export interface CodeText {
  readonly lines: readonly string[];
  /** The object each line belongs to, or null for the page's own boilerplate. */
  readonly owners: readonly (InstanceId | null)[];
  /** Lines that stand for a block left out here: the style sheet or a script. */
  readonly folded: ReadonlySet<number>;
}

export interface LiveWeb {
  readonly kind: 'web';
  /** The file it's exported as: `index.html`, `pricing/index.html`, or the screens' page. */
  readonly file: string;
  /** The exported file, exactly as it downloads. */
  readonly full: string;
  readonly html: CodeText;
  readonly css: CodeText;
}

export interface LiveLuau {
  readonly kind: 'luau';
  readonly full: string;
  readonly luau: CodeText;
}

/** The file name of the Roblox screens' web page, as the export dialog downloads it. */
export const SCREENS_FILE = 'framecraft-ui.html';

/** A page's file from the website export, or the Roblox screens as one web page. */
export function liveWeb(
  doc: Doc,
  assets: Assets,
  pageId: InstanceId | undefined,
  backdrop?: Backdrop,
): LiveWeb | null {
  if (pageId !== undefined) {
    const { files, classes } = exportSiteMapped(doc, assets, pageId);
    const page = files.find((f) => f.path.endsWith('.html'));
    if (!page || typeof page.contents !== 'string') return null;
    return {
      kind: 'web',
      file: page.path,
      full: page.contents,
      ...splitHtml(page.contents, classes),
    };
  }
  const { text, classes } = exportHtmlMapped(doc, { assets, backdrop });
  return { kind: 'web', file: SCREENS_FILE, full: text, ...splitHtml(text, classes) };
}

/** Every ScreenGui as Luau for Studio's command bar. */
export function liveLuau(doc: Doc): LiveLuau {
  const { text, vars } = exportLuauMapped(doc, 'command');
  const lines = text.replace(/\n$/, '').split('\n');
  const owners = lines.map((l) => {
    const v = /^local (\w+) = Instance\.new\(/.exec(l)?.[1] ?? /^(\w+)\.\w+ = /.exec(l)?.[1];
    return (v !== undefined && vars.get(v)) || null;
  });
  // An object's heading comment belongs to it too.
  lines.forEach((l, i) => {
    if (l.startsWith('-- ') && owners[i + 1]) owners[i] = owners[i + 1]!;
  });
  return { kind: 'luau', full: text, luau: { lines, owners, folded: new Set() } };
}

/**
 * The object whose code stands for `id`: itself, or the nearest object around it that has
 * code (a UICorner's CSS is its parent's rule).
 */
export function codeOwner(doc: Doc, id: InstanceId | null, code: CodeText): InstanceId | undefined {
  const owned = new Set(code.owners);
  for (let at = id === null ? undefined : getInstance(doc, id); at;) {
    if (owned.has(at.id)) return at.id;
    at = at.parent === null ? undefined : getInstance(doc, at.parent);
  }
  return undefined;
}

/** Long data URLs, such as an uploaded picture on the screens' page, shortened for reading. */
export const shortenData = (line: string): string =>
  line.replace(/data:[\w/+.-]+(?:;[\w=.-]+)*,[^"')\s]{40,}/g, (m) => m.slice(0, 48) + '…');

/** The object classes the exporters give elements: `e7`, a ScreenGui's `s1`, a page's `pc`. */
const OBJECT_CLASS = /^<([\w-]+)\b[^>]*?\bclass="(?:[^"]*\s)?(e\d+|s\d+|pc)"/;

/** Splits an exported HTML file into its markup and its style sheet. */
export function splitHtml(
  text: string,
  classes: ReadonlyMap<InstanceId, string>,
): { html: CodeText; css: CodeText } {
  const byClass = new Map([...classes].map(([id, c]) => [c, id]));
  const src = text.replace(/\n$/, '').split('\n');
  const lines: string[] = [];
  const owners: (InstanceId | null)[] = [];
  const folded = new Set<number>();
  let css = '';
  // The elements the current line sits in, by their indent, to find each closing tag.
  const open: { indent: number; id: InstanceId }[] = [];
  for (let i = 0; i < src.length; i++) {
    const line = src[i]!;
    const t = line.trim();
    const indent = line.length - line.trimStart().length;
    if (t === '<style>' || t === '<script>') {
      const close = t === '<style>' ? '</style>' : '</script>';
      let j = i + 1;
      while (j < src.length && src[j]!.trim() !== close) j++;
      if (t === '<style>') css = src.slice(i + 1, j).join('\n');
      folded.add(lines.length);
      lines.push(line.slice(0, indent) + t + '…' + close);
      owners.push(null);
      i = j;
      continue;
    }
    let owner: InstanceId | null = open.at(-1)?.id ?? null;
    const m = OBJECT_CLASS.exec(t);
    const id = m && byClass.get(m[2]!);
    if (t.startsWith('</') && open.at(-1)?.indent === indent) open.pop();
    else if (id) {
      owner = id;
      if (!t.endsWith(`</${m[1]}>`)) open.push({ indent, id });
    }
    lines.push(shortenData(line));
    owners.push(owner);
  }
  return { html: { lines, owners, folded }, css: prettyCss(css, byClass) };
}

/** The index of `ch` at the top level from `from` on: outside quotes, parentheses and comments. */
function findTop(s: string, from: number, ch: string): number {
  let depth = 0;
  let quote = '';
  for (let i = from; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === ch) return i;
  }
  return -1;
}

/** Splits declarations at their top-level semicolons. */
function splitDecls(body: string): string[] {
  const out: string[] = [];
  for (let at = 0; at <= body.length;) {
    const end = findTop(body, at, ';');
    const stop = end < 0 ? body.length : end;
    const d = body.slice(at, stop).trim();
    if (d) out.push(d);
    at = stop + 1;
  }
  return out;
}

/** `name: value`, however it was written. */
function formatDecl(d: string): string {
  const colon = findTop(d, 0, ':');
  return colon < 0 ? d : `${d.slice(0, colon).trim()}: ${d.slice(colon + 1).trim()}`;
}

/**
 * The object a rule styles, by its class. Only the exporters' generated rules count: they're
 * written with no space before the brace, unlike the page's fixed rules (`.g { … }`).
 */
function ruleClass(rawSelector: string): string | undefined {
  if (/\s$/.test(rawSelector)) return undefined;
  const sel = rawSelector.trim();
  if (sel === 'body' || sel === '.page' || sel === '.pin' || /^\.pc\b/.test(sel)) return 'pc';
  return /\.(e\d+|s\d+)(?!\d)/.exec(sel)?.[1];
}

/** The style sheet with one declaration per line, each rule's lines owned by its object. */
export function prettyCss(css: string, byClass: ReadonlyMap<string, InstanceId>): CodeText {
  const lines: string[] = [];
  const owners: (InstanceId | null)[] = [];
  let depth = 0;
  const push = (text: string, owner: InstanceId | null) => {
    lines.push('  '.repeat(Math.max(0, depth)) + shortenData(text));
    owners.push(owner);
  };
  for (let i = 0; i < css.length;) {
    while (i < css.length && /\s/.test(css[i]!)) i++;
    if (i >= css.length) break;
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i);
      const stop = end < 0 ? css.length : end + 2;
      css
        .slice(i, stop)
        .split('\n')
        .forEach((l, k) => push((k ? '   ' : '') + l.trim(), null));
      i = stop;
      continue;
    }
    if (css[i] === '}') {
      depth--;
      push('}', null);
      i++;
      continue;
    }
    const brace = findTop(css, i, '{');
    if (brace < 0) {
      push(css.slice(i).trim(), null);
      break;
    }
    const raw = css.slice(i, brace);
    const sel = raw.trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@')) {
      push(sel + ' {', null);
      depth++;
      i = brace + 1;
      continue;
    }
    const end = findTop(css, brace + 1, '}');
    const stop = end < 0 ? css.length : end;
    const cls = ruleClass(raw);
    const owner = (cls !== undefined && byClass.get(cls)) || null;
    push(sel + ' {', owner);
    for (const d of splitDecls(css.slice(brace + 1, stop))) push('  ' + formatDecl(d) + ';', owner);
    push('}', owner);
    i = stop + 1;
  }
  return { lines, owners, folded: new Set() };
}
