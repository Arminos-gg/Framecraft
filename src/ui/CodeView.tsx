/**
 * Exported code with line numbers, Luau, HTML or CSS lightly highlighted, Scale and Offset in
 * their colors. The live code view also passes each line's object: lines of the selection are
 * marked, a click on a line selects its object, and lines that change flash for a moment.
 */
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import type { InstanceId } from '../model/document.ts';

export type CodeLang = 'luau' | 'html' | 'css';

/** Lines that are new or changed since the last text, unless most of it changed. */
function changedLines(before: string, after: string): ReadonlySet<number> {
  const count = new Map<string, number>();
  for (const l of before.split('\n')) count.set(l, (count.get(l) ?? 0) + 1);
  const out = new Set<number>();
  after.split('\n').forEach((l, i) => {
    const n = count.get(l) ?? 0;
    if (n) count.set(l, n - 1);
    else if (l.trim()) out.add(i);
  });
  return out.size * 2 > after.split('\n').length ? new Set() : out;
}

export function CodeView({
  text,
  lines: given,
  lang,
  label,
  mark,
  owners,
  marked,
  folded,
  onPick,
  onHover,
  ref,
}: {
  text: string;
  /** The lines to show, when they aren't simply the text's. */
  lines?: readonly string[];
  lang: CodeLang;
  label: string;
  /** A line to point out and scroll to, counted from 0. */
  mark?: number;
  /** The object each line belongs to. */
  owners?: readonly (InstanceId | null)[];
  /** The object whose lines are marked; the view scrolls to them when it changes. */
  marked?: InstanceId;
  /** Lines standing for a block left out. */
  folded?: ReadonlySet<number>;
  onPick?: (id: InstanceId) => void;
  onHover?: (id: InstanceId | null) => void;
  ref?: Ref<HTMLPreElement>;
}) {
  const lines = given ?? text.replace(/\n$/, '').split('\n');
  const highlight = lang === 'luau' ? luauLine : lang === 'css' ? cssLine : htmlLine;
  const first = owners && marked !== undefined ? owners.indexOf(marked) : (mark ?? -1);
  const isMarked = (i: number) =>
    owners && marked !== undefined ? owners[i] === marked : i === mark;
  // What changed since the last text, and a count that restarts the flash on those lines.
  const shown = lines.join('\n');
  const [seen, setSeen] = useState({
    shown,
    changed: new Set<number>() as ReadonlySet<number>,
    n: 0,
  });
  if (seen.shown !== shown)
    setSeen({
      shown,
      changed: owners ? changedLines(seen.shown, shown) : new Set(),
      n: seen.n + 1,
    });
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const line = marker.current;
    const box = line?.closest('.code');
    if (!line || !(box instanceof HTMLElement)) return;
    // Within the code only, so nothing around it scrolls.
    if (box.scrollHeight > box.clientHeight) box.scrollTop = line.offsetTop - box.clientHeight / 3;
    else line.scrollIntoView({ block: 'center' });
  }, [mark, marked, lang]);
  // After an edit, bring a changed line into view if none shows.
  const box = useRef<HTMLPreElement | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !seen.changed.size || el.scrollHeight <= el.clientHeight) return;
    const changed = [...el.querySelectorAll<HTMLElement>('.ln.chg')];
    const top = el.scrollTop;
    const shows = (l: HTMLElement) =>
      l.offsetTop + l.offsetHeight > top && l.offsetTop < top + el.clientHeight;
    if (changed[0] && !changed.some(shows))
      el.scrollTop = changed[0].offsetTop - el.clientHeight / 3;
  }, [seen]);
  const lineOf = (e: { target: EventTarget }) => {
    const i = Number((e.target as HTMLElement).closest<HTMLElement>('.ln')?.dataset.i);
    return Number.isNaN(i) ? null : (owners?.[i] ?? null);
  };
  return (
    <pre
      className={owners ? 'code live' : 'code'}
      ref={(el) => {
        box.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      tabIndex={0}
      aria-label={label}
      onClick={
        onPick &&
        ((e) => {
          const id = lineOf(e);
          // Selecting text to copy it isn't a click on a line.
          if (id && !window.getSelection()?.toString()) onPick(id);
        })
      }
      onMouseMove={onHover && ((e) => onHover(lineOf(e)))}
      onMouseLeave={onHover && (() => onHover(null))}
    >
      {lines.map((l, i) => {
        const changed = seen.changed.has(i);
        const cls = [
          'ln',
          isMarked(i) && 'hi',
          changed && 'chg',
          owners?.[i] && 'own',
          folded?.has(i) && 'fold',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span
            className={cls}
            key={changed ? `${i}.${seen.n}` : i}
            data-i={i}
            ref={i === first ? marker : undefined}
          >
            <i>{i + 1}</i>
            <code>{l ? highlight(l) : ' '}</code>
          </span>
        );
      })}
    </pre>
  );
}

type Piece = string | { cls: string; text: string };

/** Splits text by a pattern, turning each match into pieces. */
function split(text: string, re: RegExp, on: (m: RegExpExecArray) => Piece[]): Piece[] {
  const out: Piece[] = [];
  let at = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    out.push(...on(m as RegExpExecArray));
    at = m.index + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** Runs a further pass over the plain-text pieces only. */
const refine = (pieces: Piece[], re: RegExp, on: (m: RegExpExecArray) => Piece[]): Piece[] =>
  pieces.flatMap((p) => (typeof p === 'string' ? split(p, re, on) : [p]));

const render = (pieces: Piece[]): ReactNode[] =>
  pieces.map((p, i) =>
    typeof p === 'string' ? (
      p
    ) : (
      <span key={i} className={p.cls}>
        {p.text}
      </span>
    ),
  );

const tok = (cls: string, text: string): Piece => ({ cls, text });

/** Scale and Offset arguments in teal and amber, as everywhere in the editor. */
function udimArgs(name: string, args: string, kinds: readonly string[]): Piece[] {
  const parts = args.split(/,\s*/);
  const out: Piece[] = [`${name}(`];
  parts.forEach((a, i) => {
    if (i) out.push(', ');
    out.push(tok(kinds[i % kinds.length]!, a));
  });
  out.push(')');
  return out;
}

function luauLine(line: string): ReactNode {
  let pieces: Piece[] = split(line, /"(?:[^"\\]|\\.)*"|--.*$/g, (m) => [
    tok(m[0].startsWith('--') ? 'cm' : 'st', m[0]),
  ]);
  pieces = refine(
    pieces,
    /\b(UDim2\.new|UDim2\.fromScale|UDim2\.fromOffset|UDim\.new)\(([^)]*)\)/g,
    (m) => {
      const kinds =
        m[1] === 'UDim2.fromScale' ? ['s'] : m[1] === 'UDim2.fromOffset' ? ['o'] : ['s', 'o'];
      return udimArgs(m[1]!, m[2]!, kinds);
    },
  );
  pieces = refine(
    pieces,
    /\b(local|function|end|return|if|then|else|for|in|do|game|Instance|Enum|true|false|nil)\b/g,
    (m) => [tok('kw', m[0])],
  );
  return render(pieces);
}

const LENGTH_PROPS = /^(\s*)(left|top|right|bottom|width|height|gap|padding(?:-\w+)?|inset)(\s*:)/;

function htmlLine(line: string): ReactNode {
  if (/^\s*(\/\*.*\*\/|<!--.*-->)\s*$/.test(line)) return render([tok('cm', line)]);
  let pieces: Piece[] = split(line, /"[^"]*"/g, (m) => [tok('st', m[0])]);
  pieces = refine(pieces, /<\/?[a-zA-Z][\w-]*|\/?>/g, (m) => [tok('tg', m[0])]);
  if (LENGTH_PROPS.test(line))
    pieces = refine(pieces, /-?\d*\.?\d+(%|px)/g, (m) => [tok(m[1] === '%' ? 's' : 'o', m[0])]);
  return render(pieces);
}

/** CSS one declaration per line: selectors, property names, and lengths in their colors. */
function cssLine(line: string): ReactNode {
  const t = line.trim();
  if (t.startsWith('/*') || !/[{};]$/.test(t)) return render([tok('cm', line)]);
  const decl = /^(\s*)(--?[\w-]+|[\w-]+)(:\s)(.*)$/.exec(line);
  if (!decl) return render([tok('tg', line)]);
  const [, ind, name, colon, value] = decl as unknown as [string, string, string, string, string];
  let pieces: Piece[] = split(value, /"[^"]*"/g, (m) => [tok('st', m[0])]);
  if (LENGTH_PROPS.test(`${name}:`) || /^(min|max)-(width|height)$/.test(name))
    pieces = refine(pieces, /-?\d*\.?\d+(%|px)/g, (m) => [tok(m[1] === '%' ? 's' : 'o', m[0])]);
  return render([ind, tok('kw', name), colon, ...pieces]);
}
