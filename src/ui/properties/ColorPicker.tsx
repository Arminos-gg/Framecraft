/**
 * The color picker that opens from a color swatch: a saturation and brightness square, a hue
 * slider, a Hex field, R, G and B fields, an eyedropper where the browser has one, and the
 * project's own colors. A drag in the square or on the slider is one undo step.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { hsvToRgb, rgbToHsv, type Hsv } from '../../editor/color.ts';
import { fromHex, hex, parseColor, parseNumber } from '../../editor/text-values.ts';
import { rgb } from '../../export/format.ts';
import type { Color3 } from '../../model/values.ts';
import { valueEquals } from '../../model/values.ts';
import { Popover } from '../Popover.tsx';
import { TextField, type Gesture } from './fields.tsx';

/** Chromium's eyedropper, which picks a color from anywhere on the screen. */
interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}
const EyeDropper = (globalThis as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const CHANNELS = ['R', 'G', 'B'] as const;

interface PickerProps {
  anchor: HTMLElement;
  label: string;
  value: Color3;
  onChange: (c: Color3) => void;
  gesture: Gesture;
  /** Colors to offer as swatches, such as the ones the project already uses; read on opening. */
  swatches?: () => readonly Color3[];
  onClose: () => void;
}

export function ColorPicker({
  anchor,
  label,
  value,
  onChange,
  gesture,
  swatches: getSwatches,
  onClose,
}: PickerProps) {
  // Hue and saturation live here as well as in the color, so dragging through black or gray
  // doesn't lose them.
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(value));
  const shown = valueEquals(hsvToRgb(hsv), value) ? hsv : rgbToHsv(value, hsv[0]);
  if (shown !== hsv) setHsv(shown);
  const [before] = useState(value);
  const [swatches] = useState(() => getSwatches?.() ?? []);
  const area = useRef<HTMLDivElement>(null);
  const idBase = `cp-${label.replace(/\W+/g, '-')}`;

  const set = (next: Hsv) => {
    setHsv(next);
    const c = hsvToRgb(next);
    if (!valueEquals(c, value)) onChange(c);
  };
  const setColor = (c: Color3) => {
    setHsv(rgbToHsv(c, hsv[0]));
    if (!valueEquals(c, value)) onChange(c);
  };

  const fromPoint = (e: PointerEvent) => {
    const r = area.current!.getBoundingClientRect();
    set([
      shown[0],
      clamp((e.clientX - r.left) / r.width),
      1 - clamp((e.clientY - r.top) / r.height),
    ]);
  };
  const onAreaKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }[e.key];
    if (!d) return;
    e.preventDefault();
    set([shown[0], clamp(shown[1] + d[0]!), clamp(shown[2] + d[1]!)]);
  };

  const [h, s, v] = shown;
  const hue = rgb(hsvToRgb([h, 1, 1]));
  return (
    <Popover anchor={anchor} placement="left" label={label} className="pop cpop" onClose={onClose}>
      <div
        ref={area}
        className="cparea"
        style={{ backgroundColor: hue }}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
        aria-valuenow={Math.round(s * 100)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          gesture.begin();
          fromPoint(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPoint(e);
        }}
        onPointerUp={() => gesture.end()}
        onLostPointerCapture={() => gesture.end()}
        onKeyDown={onAreaKey}
      >
        <i
          className="cpthumb"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: rgb(value) }}
        />
      </div>

      <div className="cpbar">
        {EyeDropper && (
          <button
            type="button"
            className="cpdrop"
            aria-label="Pick a color from the screen"
            title="Pick a color from the screen"
            onClick={() => {
              new EyeDropper()
                .open()
                .then((r) => {
                  const c = fromHex(r.sRGBHex);
                  if (c) setColor(c);
                })
                .catch(() => {});
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 3.5a2.1 2.1 0 0 1 3 3l-1.8 1.8 1 1-1.4 1.4-4-4 1.4-1.4 1 1z" />
              <path d="M9.3 7.3 4 12.6V16h3.4l5.3-5.3" />
            </svg>
          </button>
        )}
        <input
          className="cphue"
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(h)}
          aria-label="Hue"
          onPointerDown={() => gesture.begin()}
          onPointerUp={() => gesture.end()}
          onBlur={() => gesture.end()}
          onChange={(e) => set([Number(e.target.value), s, v])}
          style={{ ['--thumb' as string]: hue }}
        />
      </div>

      <div className="cprow">
        <span className="cpchips" title="Before and now">
          <button
            type="button"
            style={{ background: rgb(before) }}
            aria-label={`Put back ${hex(before).toUpperCase()}`}
            title="Put back the color from before"
            onClick={() => setColor(before)}
          />
          <i style={{ background: rgb(value) }} />
        </span>
        <span className="cphex">
          <label htmlFor={`${idBase}-hex`}>Hex</label>
          <TextField
            id={`${idBase}-hex`}
            label={`${label} hex`}
            value={hex(value).slice(1).toUpperCase()}
            onCommit={(text) => {
              const c = parseColor(text);
              if (!c) return false;
              setColor(c);
              return true;
            }}
          />
        </span>
      </div>

      <div className="cprgb">
        {CHANNELS.map((ch, i) => {
          const apply = (n: number) => {
            const c = [...value] as [number, number, number];
            c[i] = Math.round(clamp(n, 0, 255));
            setColor(c);
          };
          return (
            <span key={ch}>
              <TextField
                id={`${idBase}-${ch}`}
                label={`${label} ${ch === 'R' ? 'red' : ch === 'G' ? 'green' : 'blue'}`}
                value={String(value[i])}
                onCommit={(text) => {
                  const n = parseNumber(text);
                  if (n === null) return false;
                  apply(n);
                  return true;
                }}
                onStep={(dir, big, text) =>
                  apply((parseNumber(text) ?? value[i]!) + dir * (big ? 10 : 1))
                }
              />
              <label htmlFor={`${idBase}-${ch}`}>{ch}</label>
            </span>
          );
        })}
      </div>

      {swatches.length > 0 && (
        <div className="cpswatches">
          <div className="cpcap" id={`${idBase}-sw`}>
            In this project
          </div>
          <div role="group" aria-labelledby={`${idBase}-sw`}>
            {swatches.map((c) => (
              <button
                key={c.join()}
                type="button"
                className={valueEquals(c, value) ? 'on' : undefined}
                aria-pressed={valueEquals(c, value)}
                style={{ background: rgb(c) }}
                aria-label={`Use ${hex(c).toUpperCase()}`}
                title={hex(c).toUpperCase()}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}
