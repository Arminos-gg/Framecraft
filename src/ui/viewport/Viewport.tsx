/**
 * The viewport: the device (a Roblox screen or a page of the site) drawn at a zoom, with the
 * selection on top, or every device next to each other. Pointer gestures go to the editor in
 * the pixels of the device they started on, which becomes the one being edited.
 */
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  pagesOf,
  sceneOf,
  sideBySideScenes,
  ZOOM_MAX,
  ZOOM_MIN,
  type View,
} from '../../editor/editor.ts';
import type { Handle, Point } from '../../editor/geometry.ts';
import { isGui, type Backdrop } from '../../export/html.ts';
import { getInstance, isAncestor } from '../../model/document.ts';
import { useEditor, useEditorState } from '../editor-context.ts';
import { Icon } from '../icons.tsx';
import { Overlay } from './Overlay.tsx';
import { rulerSteps } from './rulers.ts';
import { Rulers } from './Rulers.tsx';
import { Stage } from './Stage.tsx';
import { useDocFonts } from './useDocFonts.ts';

/** Space around the device when it's fitted to the viewport. */
const PAD = 40;
/** Side by side: the space between devices, and above them for their names. */
const GAP = 40;
const LABEL = 26;

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'game', label: 'Game scene' },
  { id: 'night', label: 'Night scene' },
  { id: 'checker', label: 'Checker' },
];

const viewKey = (v: View) => (v.kind === 'page' ? 'page:' + v.pageId : 'screens');

/** The device drawn under a DOM element, if any. */
const frameAt = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLElement>('.device[data-device]') : null;

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
  const scenes = state.sideBySide ? sideBySideScenes(state) : [scene];
  const gaps = GAP * (scenes.length - 1);
  const label = state.sideBySide ? LABEL : 0;
  const fit =
    frame.w > 0
      ? Math.min(
          2,
          Math.max(
            0.05,
            Math.min(
              (frame.w - PAD * 2 - gaps) / scenes.reduce((w, s) => w + s.device.width, 0),
              (frame.h - PAD * 2 - label) / Math.max(...scenes.map((s) => s.device.height)),
            ),
          ),
        )
      : 1;
  const z = state.zoom ?? fit;
  const W = scenes.reduce((w, s) => w + s.width * z, 0) + gaps;
  const H = Math.max(...scenes.map((s) => s.height * z)) + label;
  const innerW = Math.max(frame.w, W + PAD * 2);
  const innerH = Math.max(frame.h, H + PAD * 2);
  const top = Math.round((innerH - H) / 2) + label;
  // The devices from left to right, top-aligned; the rulers and the grid follow the edited one.
  const frames = scenes.map((s, i) => ({
    scene: s,
    left: Math.round(
      (innerW - W) / 2 + scenes.slice(0, i).reduce((w, p) => w + p.width * z + GAP, 0),
    ),
  }));
  const left = frames.find((f) => f.scene === scene)?.left ?? frames[0]!.left;
  // The measuring grid, in and around the device, lines up with the rulers.
  const steps = rulerSteps(z);

  const toDevice = (clientX: number, clientY: number, el: Element = deviceRef.current!): Point => {
    const r = el.getBoundingClientRect();
    return { x: (clientX - r.left) / z, y: (clientY - r.top) / z };
  };
  /** The device a drag started on; it keeps the drag's pixels even if the pointer leaves it. */
  const dragFrame = useRef<HTMLElement | null>(null);

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

  /** The page shown, whose empty space selects it so its background can be changed. */
  const pageId = scene.view.kind === 'page' ? scene.view.pageId : null;
  const targetAt = (target: EventTarget | null) =>
    guiIdAt(target) ?? (frameAt(target) ? pageId : null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (state.preview) return;
    const target = e.target as Element;
    if (target.closest('.device-name')) return;
    if (e.button !== 0) {
      // A right-click selects what's under it, the page included, without moving anything.
      if (e.button !== 2) return;
      const el = frameAt(target);
      if (el && el.dataset.device !== device.id) editor.setDevice(el.dataset.device!);
      editor.select(targetAt(target));
      return;
    }
    const handle = target.closest<HTMLElement>('.handle');
    if (handle && state.selection) {
      e.preventDefault();
      dragFrame.current = deviceRef.current;
      const p = toDevice(e.clientX, e.clientY);
      editor.startDrag('resize', state.selection, p, { handle: handle.dataset.h as Handle });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    // Side by side, a press on another device makes it the one being edited.
    const el = frameAt(target);
    if (el && el.dataset.device !== device.id) editor.setDevice(el.dataset.device!);
    dragFrame.current = el ?? deviceRef.current;
    const p = toDevice(e.clientX, e.clientY, dragFrame.current!);
    const id = guiIdAt(target);
    if (!id) {
      editor.select(el ? pageId : null);
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
    if (editor.dragging) {
      const p = toDevice(e.clientX, e.clientY, dragFrame.current ?? deviceRef.current);
      setMouse(p);
      editor.dragTo(p, { zoom: z, shift: e.shiftKey, alt: e.altKey });
      return;
    }
    // The rulers measure the device being edited, so the mouse readout does too.
    const el = frameAt(e.target);
    setMouse(el && el !== deviceRef.current ? null : toDevice(e.clientX, e.clientY));
    if (!state.preview) editor.setHover(targetAt(e.target));
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
  const selected = state.selection === null ? undefined : getInstance(doc, state.selection);
  const selBox =
    !state.preview && selected && isGui(selected) ? scene.layout.get(selected.id) : undefined;
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
        <button
          type="button"
          className="toggle"
          aria-pressed={state.sideBySide}
          aria-label="Side by side"
          title="Show every device next to each other"
          onClick={() => editor.setSideBySide(!state.sideBySide)}
        >
          <Icon name="devices" />
          <span>Side by side</span>
        </button>
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
            Percent
          </span>
          <span>
            <i className="o" />
            Pixels
          </span>
        </div>
        <div className="zoom" role="group" aria-label="Zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => zoomTo(z / 1.25)}>
            <Icon name="minus" />
          </button>
          <span className="zv" aria-label="Zoom">
            {Math.round(z * 100)}%
          </span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomTo(z * 1.25)}>
            <Icon name="plus" />
          </button>
          <button
            type="button"
            title={
              state.sideBySide
                ? 'Fit the devices in the viewport'
                : 'Fit the device in the viewport'
            }
            onClick={() => editor.setZoom(null)}
          >
            Fit
          </button>
        </div>
      </div>
      <div className="canvasbox">
        <Rulers
          canvas={canvasRef}
          origin={{ x: left, y: top }}
          frame={frame}
          zoom={z}
          steps={steps}
          device={{ w: scene.width, h: scene.height }}
          selection={selBox}
          mouse={mouse}
          middleY={scene.view.kind === 'screens'}
        />
        <div
          className={state.preview ? 'canvas preview' : 'canvas'}
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          onContextMenu={(e) => {
            if (!state.preview) e.preventDefault();
          }}
        >
          <div
            className="canvas-inner"
            style={
              {
                width: innerW,
                height: innerH,
                '--grid-x': `${left}px`,
                '--grid-y': `${top}px`,
                '--grid-minor': `${steps.minor * z}px`,
                '--grid-major': `${steps.major * z}px`,
              } as CSSProperties
            }
          >
            {frames.map(({ scene: s, left: x }) => {
              const editing = s === scene;
              return (
                <Fragment key={s.device.id}>
                  {state.sideBySide && (
                    <button
                      type="button"
                      className={editing ? 'device-name editing' : 'device-name'}
                      aria-pressed={editing}
                      title={`${s.device.label}: ${editing ? 'your edits go here' : 'click to edit this device'}`}
                      style={{ left: x, top: top - LABEL }}
                      onClick={() => editor.setDevice(s.device.id)}
                    >
                      {s.device.label.split(' · ')[0]}
                    </button>
                  )}
                  <div
                    ref={editing ? deviceRef : undefined}
                    className={
                      s.view.kind === 'screens'
                        ? `device backdrop-${state.backdrop}`
                        : 'device page'
                    }
                    data-testid={editing ? 'screen' : undefined}
                    data-device={s.device.id}
                    style={
                      {
                        left: x,
                        top,
                        width: s.width,
                        height: s.height,
                        transform: `scale(${z})`,
                        '--zoom': z,
                        '--grid-minor': `${steps.minor}px`,
                        '--grid-major': `${steps.major}px`,
                      } as CSSProperties
                    }
                  >
                    <Stage doc={doc} scene={s} assets={state.assets} preview={state.preview} />
                  </div>
                  <div className="overlay" style={{ left: x, top }}>
                    <Overlay state={state} scene={s} zoom={z} passive={!editing} />
                  </div>
                </Fragment>
              );
            })}
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
