/**
 * The viewport: the device (a Roblox screen or a page of the site) drawn at a zoom, with the
 * selection on top. Pointer gestures go to the editor in device pixels.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { pagesOf, sceneOf, ZOOM_MAX, ZOOM_MIN, type View } from '../../editor/editor.ts';
import type { Handle, Point } from '../../editor/geometry.ts';
import { isGui, type Backdrop } from '../../export/html.ts';
import { getInstance, isAncestor } from '../../model/document.ts';
import { useEditor, useEditorState } from '../editor-context.ts';
import { Overlay } from './Overlay.tsx';
import { Stage } from './Stage.tsx';
import { useDocFonts } from './useDocFonts.ts';

/** Space around the device when it's fitted to the viewport. */
const PAD = 40;

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'game', label: 'Game scene' },
  { id: 'night', label: 'Night scene' },
  { id: 'checker', label: 'Checker' },
];

const viewKey = (v: View) => (v.kind === 'page' ? 'page:' + v.pageId : 'screens');

/** The object drawn under a DOM element, if any. */
function guiIdAt(target: EventTarget | null): string | null {
  const el =
    target instanceof Element ? target.closest<HTMLElement>('.screen .gui[data-id]') : null;
  return el?.dataset.id ?? null;
}

export function Viewport() {
  const editor = useEditor();
  const state = useEditorState();
  const scene = sceneOf(state);
  const { doc } = state;
  useDocFonts(doc);

  const canvasRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [mouse, setMouse] = useState<Point | null>(null);

  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const measure = () => setFrame({ w: cv.clientWidth, h: cv.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  const { device } = scene;
  const fit =
    frame.w > 0
      ? Math.min(
          2,
          Math.max(
            0.05,
            Math.min((frame.w - PAD * 2) / device.width, (frame.h - PAD * 2) / device.height),
          ),
        )
      : 1;
  const z = state.zoom ?? fit;
  const W = scene.width * z;
  const H = scene.height * z;
  const innerW = Math.max(frame.w, W + PAD * 2);
  const innerH = Math.max(frame.h, H + PAD * 2);
  const left = Math.round((innerW - W) / 2);
  const top = Math.round((innerH - H) / 2);

  const toDevice = (clientX: number, clientY: number): Point => {
    const r = deviceRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / z, y: (clientY - r.top) / z };
  };

  // Zooming keeps the point under the cursor (or the viewport's center) where it was.
  const anchor = useRef<{ at: Point; cx: number; cy: number } | null>(null);
  const zoomTo = (next: number, clientX?: number, clientY?: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const cx = clientX ?? r.left + r.width / 2;
    const cy = clientY ?? r.top + r.height / 2;
    anchor.current = { at: toDevice(cx, cy), cx, cy };
    editor.setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    const cv = canvasRef.current;
    if (!a || !cv || !deviceRef.current) return;
    anchor.current = null;
    const d = deviceRef.current.getBoundingClientRect();
    cv.scrollLeft += d.left + a.at.x * z - a.cx;
    cv.scrollTop += d.top + a.at.y * z - a.cy;
  }, [z]);

  // Ctrl or Cmd with the wheel (or a trackpad pinch) zooms; it needs a non-passive listener.
  const zoomRef = useRef(zoomTo);
  const zRef = useRef(z);
  useLayoutEffect(() => {
    zoomRef.current = zoomTo;
    zRef.current = z;
  });
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(zRef.current * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);

  // After following a link to a section, scroll it to the top of the viewport.
  const reveal = state.reveal;
  useEffect(() => {
    const cv = canvasRef.current;
    const box = reveal && scene.layout.get(reveal.id);
    if (!cv || !box) return;
    cv.scrollTo({ top: top + box.y * z - 12 });
  }, [reveal, scene, top, z]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || state.preview) return;
    const target = e.target as Element;
    const p = toDevice(e.clientX, e.clientY);
    const handle = target.closest<HTMLElement>('.handle');
    if (handle && state.selection) {
      e.preventDefault();
      editor.startDrag('resize', state.selection, p, { handle: handle.dataset.h as Handle });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    const id = guiIdAt(target);
    if (!id) {
      editor.select(null);
      return;
    }
    e.preventDefault();
    const sel = state.selection;
    const selected = sel === null ? undefined : getInstance(doc, sel);
    if (sel !== null && selected && isGui(selected) && id !== sel && isAncestor(doc, sel, id)) {
      // A drag inside the selection moves the selection; a plain click selects the child.
      editor.startDrag('move', sel, p, { clickId: id });
    } else {
      if (sel !== id) editor.select(id);
      editor.startDrag('move', id, p);
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!deviceRef.current) return;
    const p = toDevice(e.clientX, e.clientY);
    setMouse(p);
    if (editor.dragging) {
      editor.dragTo(p, { zoom: z, shift: e.shiftKey, alt: e.altKey });
      return;
    }
    if (!state.preview) editor.setHover(guiIdAt(e.target));
  };
  const onPointerUp = () => editor.endDrag();
  const onPointerLeave = () => {
    if (editor.dragging) return;
    setMouse(null);
    editor.setHover(null);
  };
  const onClick = (e: MouseEvent) => {
    if (!state.preview) return;
    const id = guiIdAt(e.target);
    const out = id && editor.followLink(id);
    if (out) window.open(out.url, '_blank', 'noopener');
  };

  const pages = pagesOf(doc);
  const breakpoint =
    scene.breakpoint === undefined ? undefined : getInstance(doc, scene.breakpoint);

  return (
    <main className="stage panel" aria-label="Viewport">
      <div className="stagebar">
        <select
          aria-label="Show"
          value={viewKey(scene.view)}
          onChange={(e) => {
            const v = e.target.value;
            editor.setView(
              v === 'screens' ? { kind: 'screens' } : { kind: 'page', pageId: v.slice(5) },
            );
          }}
        >
          <option value="screens">Roblox screens</option>
          {pages.map((p) => (
            <option key={p.id} value={'page:' + p.id}>
              Page: {p.props.Name}
            </option>
          ))}
        </select>
        <select
          aria-label="Device size"
          value={device.id}
          onChange={(e) => editor.setDevice(e.target.value)}
        >
          {scene.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        {scene.view.kind === 'screens' && (
          <select
            aria-label="Backdrop"
            value={state.backdrop}
            onChange={(e) => editor.setBackdrop(e.target.value as Backdrop)}
          >
            {BACKDROPS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        )}
        {breakpoint?.className === 'Breakpoint' && (
          <span
            className="bpchip"
            title={`Changes apply to windows up to ${breakpoint.props.MaxWidth} px wide`}
          >
            Editing {breakpoint.props.Name}
          </span>
        )}
        <div className="spacer" />
        <div className="legend wide-only" aria-hidden="true">
          <span>
            <i className="s" />
            Scale
          </span>
          <span>
            <i className="o" />
            Offset
          </span>
        </div>
        <button className="btn icon" aria-label="Zoom out" onClick={() => zoomTo(z / 1.25)}>
          −
        </button>
        <span className="zoomval" aria-label="Zoom">
          {Math.round(z * 100)}%
        </span>
        <button className="btn icon" aria-label="Zoom in" onClick={() => zoomTo(z * 1.25)}>
          +
        </button>
        <button className="btn" onClick={() => editor.setZoom(null)}>
          Fit
        </button>
      </div>
      <div
        className={state.preview ? 'canvas preview' : 'canvas'}
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      >
        <div className="canvas-inner" style={{ width: innerW, height: innerH }}>
          <div
            ref={deviceRef}
            className={
              scene.view.kind === 'screens' ? `device backdrop-${state.backdrop}` : 'device'
            }
            data-testid="screen"
            style={{
              left,
              top,
              width: scene.width,
              height: scene.height,
              transform: `scale(${z})`,
            }}
          >
            <Stage doc={doc} scene={scene} assets={state.assets} preview={state.preview} />
          </div>
          <div className="overlay" style={{ left, top }}>
            <Overlay state={state} scene={scene} zoom={z} />
          </div>
        </div>
      </div>
      <StatusLine mouse={mouse} />
    </main>
  );
}

function StatusLine({ mouse }: { mouse: Point | null }) {
  const state = useEditorState();
  const scene = sceneOf(state);
  const sel = state.selection;
  const box = sel === null ? undefined : scene.layout.get(sel);
  const inst = sel === null ? undefined : getInstance(state.doc, sel);
  const hint = state.preview
    ? 'Preview: buttons react, text boxes take input and links work. Press P or Preview to go back to editing.'
    : 'Drag to move · handles resize · Shift keeps proportions · arrows nudge · Ctrl+D duplicates';
  return (
    <div className="statusline">
      {inst && isGui(inst) && box ? (
        <>
          <span>
            AbsolutePosition {Math.round(box.x)}, {Math.round(box.y)}
          </span>
          <span>
            AbsoluteSize {Math.round(box.w)} × {Math.round(box.h)}
          </span>
        </>
      ) : (
        <span>
          {scene.view.kind === 'page' ? 'Window' : 'Screen'} {scene.device.width} ×{' '}
          {scene.device.height}
        </span>
      )}
      {mouse && (
        <span>
          Mouse {Math.round(mouse.x)}, {Math.round(mouse.y)}
        </span>
      )}
      <span className="hint">{hint}</span>
    </div>
  );
}
