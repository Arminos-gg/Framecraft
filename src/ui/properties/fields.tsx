/**
 * The Properties panel's editors, one per value type. Text fields keep what you type until
 * Enter or leaving the field, then apply it; a value they can't read turns the field red and
 * stays for fixing. Escape puts the value back. Up and down arrows step numbers, ten times
 * as far with Shift. Sliders and color pickers are one undo step per drag.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fmtColor,
  fmtUDim2,
  fmtVec2,
  fromHex,
  hex,
  parseColor,
  parseNumber,
  parseUDim2,
  parseVec2,
} from '../../editor/text-values.ts';
import { fmtNum, rgb, roundTo } from '../../export/format.ts';
import type {
  Color3,
  ColorSequence,
  Link,
  NumberSequence,
  UDim,
  UDim2,
  Vector2,
} from '../../model/values.ts';
import { valueEquals } from '../../model/values.ts';
import { Icon } from '../icons.tsx';
import { Popover } from '../Popover.tsx';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Starts and ends a continuous edit (slider, color picker) as one undo step. */
export interface Gesture {
  begin(): void;
  end(): void;
}

interface TextFieldProps {
  id: string;
  label: string;
  /** The current value, as text. */
  value: string;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Applies typed text. False means it can't be read: the field turns red and keeps it. */
  onCommit: (text: string) => boolean;
  /** The up and down arrows, with the text as it stands. */
  onStep?: (dir: 1 | -1, big: boolean, text: string) => void;
  /** After the text is applied or put back. */
  onDone?: () => void;
}

export function TextField({
  id,
  label,
  value,
  className,
  placeholder,
  autoFocus,
  onCommit,
  onStep,
  onDone,
}: TextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const skipBlur = useRef(false);
  const justFocused = useRef(false);
  // Text typed but not applied yet is applied when the field goes away, as when you click
  // another object without pressing Enter.
  const pending = useRef<{ draft: string | null; commit: (t: string) => boolean }>({
    draft: null,
    commit: onCommit,
  });
  useEffect(() => {
    pending.current = { draft: bad ? null : draft, commit: onCommit };
  });
  useEffect(
    () => () => {
      const p = pending.current;
      if (p.draft !== null) p.commit(p.draft);
    },
    [],
  );

  const commit = () => {
    if (draft === null) return onDone?.();
    if (!onCommit(draft)) return setBad(true);
    setDraft(null);
    setBad(false);
    onDone?.();
  };
  return (
    <input
      id={id}
      className={cx('fld', className, bad && 'bad')}
      value={draft ?? value}
      aria-label={label}
      aria-invalid={bad || undefined}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      autoFocus={autoFocus}
      onChange={(e) => {
        setDraft(e.target.value);
        setBad(false);
      }}
      onFocus={(e) => {
        e.currentTarget.select();
        justFocused.current = true;
      }}
      onMouseUp={(e) => {
        // Keep the whole value selected after a click into the field.
        if (justFocused.current) e.preventDefault();
        justFocused.current = false;
      }}
      onBlur={() => {
        if (skipBlur.current) skipBlur.current = false;
        else commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(null);
          setBad(false);
          pending.current.draft = null;
          skipBlur.current = true;
          e.currentTarget.blur();
          onDone?.();
        } else if (onStep && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onStep(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, draft ?? value);
          setDraft(null);
          setBad(false);
        }
      }}
    />
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  int?: boolean;
  step?: number;
  /** Scale (teal) or Offset (amber). */
  tone?: 's' | 'o';
  /** A unit shown at the right, such as px. */
  unit?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  int,
  step = 1,
  tone,
  unit,
}: NumberFieldProps) {
  const fit = (v: number) => {
    const c = Math.min(max, Math.max(min, v));
    return int ? Math.round(c) : roundTo(c, 4);
  };
  const apply = (v: number) => {
    const next = fit(v);
    if (next !== value) onChange(next);
  };
  const field = (
    <TextField
      id={id}
      label={label}
      value={fmtNum(value, int ? 0 : 4)}
      className={tone}
      onCommit={(text) => {
        const n = parseNumber(text);
        if (n === null) return false;
        apply(n);
        return true;
      }}
      onStep={(dir, big, text) => apply((parseNumber(text) ?? value) + dir * step * (big ? 10 : 1))}
    />
  );
  return unit ? (
    <span className="unit" data-u={unit}>
      {field}
    </span>
  ) : (
    field
  );
}

export function BoolField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span className="boolw">
      <Checkbox id={id} label={label} checked={value} onChange={onChange} />
    </span>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id?: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <span className="cbx">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <Icon name="check" />
    </span>
  );
}

export function EnumField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <span className="selw">
      <select
        id={id}
        className="fld txt"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <Icon name="chevDown" />
    </span>
  );
}

/** Transparency: a number and a slider, 0 (solid) to 1 (invisible). */
export function AlphaField({
  id,
  label,
  value,
  onChange,
  gesture,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  gesture: Gesture;
}) {
  return (
    <span className="alpha">
      <NumberField
        id={id}
        label={label}
        value={value}
        min={0}
        max={1}
        step={0.05}
        onChange={onChange}
      />
      <input
        type="range"
        className="rng"
        id={`${id}-range`}
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label={`${label} slider`}
        style={{ '--p': `${value * 100}%` } as React.CSSProperties}
        onPointerDown={() => gesture.begin()}
        onPointerUp={() => gesture.end()}
        onBlur={() => gesture.end()}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </span>
  );
}

/** A color swatch that opens the system color picker; a drag in the picker is one undo step. */
function Swatch({
  label,
  value,
  onChange,
  gesture,
  className = 'sw',
}: {
  label: string;
  value: Color3;
  onChange: (c: Color3) => void;
  gesture: Gesture;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // React's onChange fires on every move; the native change event marks the end.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const end = () => gesture.end();
    el.addEventListener('change', end);
    return () => el.removeEventListener('change', end);
  }, [gesture]);
  return (
    <label className={className} style={{ background: rgb(value) }} title="Pick a color">
      <input
        ref={ref}
        type="color"
        value={hex(value)}
        aria-label={label}
        onChange={(e) => {
          const c = fromHex(e.target.value);
          if (!c) return;
          gesture.begin();
          onChange(c);
        }}
        onBlur={() => gesture.end()}
      />
    </label>
  );
}

export function ColorField({
  id,
  label,
  value,
  onChange,
  gesture,
}: {
  id: string;
  label: string;
  value: Color3;
  onChange: (c: Color3) => void;
  gesture: Gesture;
}) {
  return (
    <span className="cfld">
      <Swatch label={`${label} picker`} value={value} onChange={onChange} gesture={gesture} />
      <TextField
        id={id}
        label={label}
        value={fmtColor(value)}
        onCommit={(text) => {
          const c = parseColor(text);
          if (!c) return false;
          if (!valueEquals(c, value)) onChange(c);
          return true;
        }}
      />
    </span>
  );
}

const ANCHORS: Vector2[] = [0, 0.5, 1].flatMap((y) => [0, 0.5, 1].map((x) => [x, y] as const));

export function Vec2Field({
  id,
  label,
  value,
  onChange,
  anchorPicker,
}: {
  id: string;
  label: string;
  value: Vector2;
  onChange: (v: Vector2) => void;
  anchorPicker?: boolean;
}) {
  const [pick, setPick] = useState<HTMLElement | null>(null);
  const field = (
    <TextField
      id={id}
      label={label}
      value={fmtVec2(value)}
      onCommit={(text) => {
        const v = parseVec2(text);
        if (!v) return false;
        if (!valueEquals(v, value)) onChange(v);
        return true;
      }}
    />
  );
  if (!anchorPicker) return field;
  return (
    <span className="vec">
      {field}
      <button
        className="ap"
        type="button"
        aria-label="Pick an AnchorPoint"
        title="Pick an AnchorPoint"
        onClick={(e) => setPick(pick ? null : e.currentTarget)}
      >
        {ANCHORS.map((a) => (
          <i key={a.join()} className={valueEquals(a, value) ? 'on' : undefined} />
        ))}
      </button>
      {pick && (
        <Popover
          anchor={pick}
          label="AnchorPoint"
          className="pop appop"
          onClose={() => setPick(null)}
        >
          <div className="apgrid">
            {ANCHORS.map((a) => (
              <button
                key={a.join()}
                type="button"
                className={valueEquals(a, value) ? 'on' : undefined}
                aria-label={`AnchorPoint ${fmtVec2(a)}`}
                title={fmtVec2(a)}
                onClick={() => {
                  setPick(null);
                  if (!valueEquals(a, value)) onChange(a);
                }}
              >
                <i />
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
  );
}

/** A UDim: Scale (teal) and Offset in pixels (amber). */
export function UDimField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: UDim;
  onChange: (v: UDim) => void;
}) {
  return (
    <span className="pair">
      <NumberField
        id={`${id}-s`}
        label={`${label} Scale`}
        value={value[0]}
        step={0.01}
        tone="s"
        onChange={(s) => onChange([s, value[1]])}
      />
      <NumberField
        id={`${id}-o`}
        label={`${label} Offset`}
        value={value[1]}
        int
        tone="o"
        unit="px"
        onChange={(o) => onChange([value[0], o])}
      />
    </span>
  );
}

/** A UDim2 as Studio writes it, with Scale teal and Offset amber. */
export function UDim2Text({ value }: { value: UDim2 }) {
  return (
    <>
      {'{'}
      <span className="s">{fmtNum(value[0])}</span>,{' '}
      <span className="o">{fmtNum(value[1], 0)}</span>
      {'},{'}
      <span className="s">{fmtNum(value[2])}</span>,{' '}
      <span className="o">{fmtNum(value[3], 0)}</span>
      {'}'}
    </>
  );
}

/**
 * A UDim2 in one line. It shows the value in color; a click turns it into a text field that
 * takes Studio shorthand.
 */
export function UDim2Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: UDim2;
  onChange: (v: UDim2) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <TextField
        id={id}
        label={label}
        value={fmtUDim2(value)}
        autoFocus
        onCommit={(text) => {
          const u = parseUDim2(text);
          if (!u) return false;
          if (!valueEquals(u, value)) onChange(u);
          return true;
        }}
        onDone={() => setEditing(false)}
      />
    );
  return (
    <button
      id={id}
      className="u2"
      type="button"
      aria-label={`${label}: ${fmtUDim2(value)}. Edit as text`}
      title="Type Studio shorthand: 0.5, or 0.25,40,0.1,20"
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
    >
      <UDim2Text value={value} />
    </button>
  );
}

/** The X and Y rows under an opened UDim2: each a Scale and Offset pair. */
export function UDim2Parts({
  id,
  label,
  value,
  onChange,
  rowClass,
}: {
  id: string;
  label: string;
  value: UDim2;
  onChange: (v: UDim2) => void;
  rowClass: string;
}) {
  const set = (i: number) => (x: number) => {
    const u = [...value] as [number, number, number, number];
    u[i] = x;
    onChange(u);
  };
  return (
    <>
      <div className={`${rowClass} subrow colh`} aria-hidden="true">
        <span />
        <span className="colhead">
          <span className="s">Scale</span>
          <span className="o">Offset</span>
        </span>
      </div>
      {(['X', 'Y'] as const).map((ax, n) => (
        <div key={ax} className={`${rowClass} subrow`}>
          <label htmlFor={`${id}-${ax}s`}>{ax}</label>
          <span className="pair">
            <NumberField
              id={`${id}-${ax}s`}
              label={`${label} ${ax} Scale`}
              value={value[n * 2]!}
              step={0.01}
              tone="s"
              onChange={set(n * 2)}
            />
            <NumberField
              id={`${id}-${ax}o`}
              label={`${label} ${ax} Offset`}
              value={value[n * 2 + 1]!}
              int
              tone="o"
              unit="px"
              onChange={set(n * 2 + 1)}
            />
          </span>
        </div>
      ))}
    </>
  );
}

const stopName = (i: number, n: number) =>
  i === 0 ? 'Start' : i === n - 1 ? 'End' : `Stop ${i + 1}`;

/** A ColorSequence: the gradient, with a swatch for each keypoint. */
export function ColorSeqField({
  label,
  value,
  onChange,
  gesture,
}: {
  label: string;
  value: ColorSequence;
  onChange: (v: ColorSequence) => void;
  gesture: Gesture;
}) {
  const bar = `linear-gradient(90deg, ${value.map((k) => `${rgb(k.value)} ${k.time * 100}%`).join(', ')})`;
  const swatch = (i: number) => (
    <Swatch
      key={i}
      className="stop"
      label={`${label} ${stopName(i, value.length).toLowerCase()} color`}
      value={value[i]!.value}
      gesture={gesture}
      onChange={(c) => onChange(value.map((k, j) => (j === i ? { ...k, value: c } : k)))}
    />
  );
  return (
    <span className="gseq">
      {swatch(0)}
      <span className="gbar" style={{ background: bar }}>
        {value.slice(1, -1).map((k, j) => (
          <span key={j} className="mid" style={{ left: `${k.time * 100}%` }}>
            {swatch(j + 1)}
          </span>
        ))}
      </span>
      {swatch(value.length - 1)}
    </span>
  );
}

/** A NumberSequence of transparencies: one field per keypoint. */
export function NumSeqField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: NumberSequence;
  onChange: (v: NumberSequence) => void;
}) {
  return (
    <span className="pair" style={{ gridTemplateColumns: `repeat(${value.length}, 1fr)` }}>
      {value.map((k, i) => (
        <NumberField
          key={i}
          id={`${id}-${i}`}
          label={`${stopName(i, value.length)} ${label.toLowerCase()}`}
          value={k.value}
          min={0}
          max={1}
          step={0.05}
          unit={i === 0 ? 'start' : i === value.length - 1 ? 'end' : undefined}
          onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, value: v } : x)))}
        />
      ))}
    </span>
  );
}

/** A picture from the project's image library: a thumbnail with Upload and Remove. */
export function PictureField({
  label,
  src,
  onUpload,
  onRemove,
}: {
  label: string;
  /** The picture, if there is one. */
  src: string | undefined;
  onUpload: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="picfld">
      <span className="thumb" aria-hidden="true">
        {src ? <img src={src} alt="" /> : <Icon name="image" />}
      </span>
      <button
        className="btn sm"
        type="button"
        aria-label={`${src ? 'Replace' : 'Upload'} ${label}`}
        onClick={onUpload}
      >
        <Icon name="upload" />
        {src ? 'Replace' : 'Upload'}
      </button>
      {src && (
        <button
          className="btn sm ghost"
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </span>
  );
}

type LinkKind = 'none' | 'page' | 'url';

/**
 * Where an object links to on the website: nothing, a page of the site (optionally a section
 * on it, by the section's name), or another address. Optionally in a new tab.
 */
export function LinkField({
  id,
  value,
  pages,
  onChange,
}: {
  id: string;
  value: Link | null;
  pages: readonly { id: string; name: string }[];
  onChange: (v: Link | null) => boolean;
}) {
  const kind: LinkKind = value?.kind ?? 'none';
  const tab = value?.newTab ? { newTab: true as const } : {};
  let detail: ReactNode = null;
  if (value?.kind === 'page') {
    detail = (
      <>
        <span className="selw">
          <select
            id={`${id}-page`}
            className="fld txt"
            aria-label="Linked page"
            value={value.page}
            onChange={(e) => onChange({ ...value, page: e.target.value })}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Icon name="chevDown" />
        </span>
        <TextField
          id={`${id}-section`}
          label="Section"
          className="txt"
          placeholder="Section (optional)"
          value={value.section ?? ''}
          onCommit={(text) => {
            const section = text.trim();
            const { section: _old, ...rest } = value;
            void _old;
            return onChange(section ? { ...rest, section } : rest);
          }}
        />
      </>
    );
  } else if (value?.kind === 'url') {
    detail = (
      <TextField
        id={`${id}-url`}
        label="Link address"
        className="txt"
        placeholder="https://"
        value={value.url}
        onCommit={(url) => onChange({ kind: 'url', url: url.trim(), ...tab })}
      />
    );
  }
  return (
    <span className="linkfld">
      <span className="selw">
        <select
          id={id}
          className="fld txt"
          aria-label="Link"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as LinkKind;
            if (k === 'none') onChange(null);
            else if (k === 'page' && pages[0])
              onChange({ kind: 'page', page: pages[0].id, ...tab });
            else if (k === 'url') onChange({ kind: 'url', url: 'https://example.com', ...tab });
          }}
        >
          <option value="none">No link</option>
          <option value="page" disabled={!pages.length}>
            A page of the site
          </option>
          <option value="url">Another address</option>
        </select>
        <Icon name="chevDown" />
      </span>
      {detail}
      {value && (
        <label className="toggle">
          <Checkbox
            label="Open in a new tab"
            checked={!!value.newTab}
            onChange={(on) => {
              const { newTab: _t, ...rest } = value;
              void _t;
              onChange(on ? { ...rest, newTab: true } : rest);
            }}
          />
          Open in a new tab
        </label>
      )}
    </span>
  );
}
