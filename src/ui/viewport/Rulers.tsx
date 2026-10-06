/**
 * Rulers along the top and left of the viewport, in device pixels from the device's top-left
 * corner. They shade the device and the selection, mark the device's middle, and follow the
 * mouse. Scrolling the canvas moves them with it.
 */
import { useEffect, useState, type RefObject } from 'react';
import type { Point } from '../../editor/geometry.ts';
import { rulerTicks, type Steps } from './rulers.ts';

/** How thick a ruler is, in screen pixels; the stylesheet's `--ruler-size` matches it. */
const SIZE = 18;

interface Span {
  readonly start: number;
  readonly size: number;
}

export function Rulers({
  canvas,
  origin,
  frame,
  zoom,
  steps,
  device,
  selection,
  mouse,
  middleY,
}: {
  /** The scrolling canvas; the rulers follow its scroll. */
  canvas: RefObject<HTMLDivElement | null>;
  /** Where the device's top-left corner is inside the canvas, before scrolling. */
  origin: Point;
  /** The canvas's visible size. */
  frame: { w: number; h: number };
  zoom: number;
  steps: Steps;
  device: { w: number; h: number };
  selection: { x: number; y: number; w: number; h: number } | undefined;
  mouse: Point | null;
  /** Whether half the device's height means anything, as on a Roblox screen. */
  middleY: boolean;
}) {
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const follow = () => setScroll({ x: el.scrollLeft, y: el.scrollTop });
    follow();
    el.addEventListener('scroll', follow, { passive: true });
    return () => el.removeEventListener('scroll', follow);
  }, [canvas]);

  const common = { zoom, steps };
  return (
    <>
      <div className="ruler-corner" aria-hidden="true" />
      <Ruler
        axis="x"
        length={frame.w}
        offset={origin.x - scroll.x}
        device={{ start: 0, size: device.w }}
        selection={selection && { start: selection.x, size: selection.w }}
        mouse={mouse?.x}
        middle
        {...common}
      />
      <Ruler
        axis="y"
        length={frame.h}
        offset={origin.y - scroll.y}
        device={{ start: 0, size: device.h }}
        selection={selection && { start: selection.y, size: selection.h }}
        mouse={mouse?.y}
        middle={middleY}
        {...common}
      />
    </>
  );
}

function Ruler({
  axis,
  length,
  offset,
  zoom,
  steps,
  device,
  selection,
  mouse,
  middle,
}: {
  axis: 'x' | 'y';
  length: number;
  offset: number;
  zoom: number;
  steps: Steps;
  device: Span;
  selection: Span | undefined;
  mouse: number | undefined;
  middle: boolean;
}) {
  const ticks = rulerTicks(length, offset, zoom, steps);
  const at = (v: number) => offset + v * zoom;
  // Ticks grow in from the ruler's edge next to the canvas, `depth` pixels long.
  const x = axis === 'x';
  const path = (list: number[], depth: number) =>
    list
      .map((p) => (x ? `M${p} ${SIZE - depth}V${SIZE}` : `M${SIZE - depth} ${p}H${SIZE}`))
      .join('');
  const band = (span: Span, className: string) => {
    const a = at(span.start);
    const len = span.size * zoom;
    return x ? (
      <rect className={className} x={a} y={0} width={len} height={SIZE} />
    ) : (
      <rect className={className} x={0} y={a} width={SIZE} height={len} />
    );
  };
  const mark = (v: number, className: string, depth: number) => {
    const p = Math.round(at(v)) + 0.5;
    return x ? (
      <path className={className} d={`M${p} ${SIZE - depth}V${SIZE}`} />
    ) : (
      <path className={className} d={`M${SIZE - depth} ${p}H${SIZE}`} />
    );
  };
  return (
    <svg className={`ruler ${axis}`} aria-hidden="true">
      {band(device, 'device')}
      {selection && band(selection, 'sel')}
      <path
        className="tick"
        d={path(ticks.minor, 4) + path(ticks.mid, 7) + path(ticks.major, SIZE)}
      />
      {ticks.major.map((p, i) => (
        <text
          key={ticks.labels[i]}
          transform={x ? `translate(${p + 3} 9)` : `translate(12 ${p - 3}) rotate(-90)`}
        >
          {ticks.labels[i]}
        </text>
      ))}
      {middle && mark(device.size / 2, 'middle', 7)}
      {mouse !== undefined && mark(mouse, 'mouse', SIZE)}
    </svg>
  );
}
