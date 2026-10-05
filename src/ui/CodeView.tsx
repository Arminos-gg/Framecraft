/** Exported code with line numbers, Luau or HTML lightly highlighted, Scale and Offset in their colors. */
import { useEffect, useRef, type ReactNode, type Ref } from 'react';

export type CodeLang = 'luau' | 'html';

export function CodeView({
  text,
  lang,
  label,
  mark,
  ref,
}: {
  text: string;
  lang: CodeLang;
  label: string;
  /** A line to point out and scroll to, counted from 0. */
  mark?: number;
  ref?: Ref<HTMLPreElement>;
}) {
  const lines = text.replace(/\n$/, '').split('\n');
  const highlight = lang === 'luau' ? luauLine : htmlLine;
  const marked = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    marked.current?.scrollIntoView({ block: 'center' });
  }, [mark, lang]);
  return (
    <pre className="code" ref={ref} tabIndex={0} aria-label={label}>
      {lines.map((l, i) => (
        <span className={i === mark ? 'ln hi' : 'ln'} key={i} ref={i === mark ? marked : undefined}>
          <i>{i + 1}</i>
          <code>{l ? highlight(l) : ' '}</code>
        </span>
      ))}
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
