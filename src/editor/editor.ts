/**
 * The editor: the document's undo history plus everything the editor shows that isn't saved,
 * such as the selection, the view and the zoom. React reads it through `subscribe` and
 * `getState` (useSyncExternalStore); every change makes a new state object.
 *
 * Viewport gestures arrive here in screen pixels (the device's own pixels, before zoom) and
 * leave as commands. A drag runs inside History.begin() and commit(), so it is one undo step.
 * On a page shown at Tablet or Phone, edits change that breakpoint's values.
 */
import { slug } from '../export/site.ts';
import { isGui, isTinted, type Backdrop } from '../export/html.ts';
import {
  ancestorAngle,
  layoutContainer,
  layoutScreenGuis,
  screenQuad,
  type Box,
  type Layout,
} from '../layout/layout.ts';
import { textVersion } from '../layout/text.ts';
import { addAsset, type Assets } from '../model/assets.ts';
import { canParent, classDef, isOverridable, propSpec, type ClassName } from '../model/classes.ts';
import { FONT_WEIGHTS, type FontStyle, type FontWeight } from '../model/fonts.ts';
import { batch, insert, move, remove, setPreview, type Command } from '../model/commands.ts';
import {
  childOfClass,
  childrenOf,
  drawnChildren,
  drawnParent,
  extractSubtree,
  getInstance,
  isAncestor,
  ModelError,
  newId,
  reIdSubtree,
  resolveProps,
  serviceOf,
  single,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from '../model/document.ts';
import { History } from '../model/history.ts';
import type { Project } from '../model/project.ts';
import { roundTo } from '../export/format.ts';
import type { UDim2 } from '../model/values.ts';
import {
  DESKTOP,
  pageDevices,
  SCREEN_DEVICES,
  SIDE_BY_SIDE_SCREENS,
  type Device,
} from './devices.ts';
import { hasModifier, insertParent, newSubtree } from './insert.ts';
import { finishShape, shapeById, shapeClass, shapePicture, shapeProps } from './shapes.ts';
import {
  componentSubtree,
  type ComponentDef,
  type ComponentOptions,
} from '../model/components/index.ts';
import {
  moveRect,
  positionFor,
  resizeRect,
  rotate,
  sizeFor,
  snapTargets,
  type Guide,
  type Handle,
  type Point,
  type SnapTargets,
  type UnitMode,
} from './geometry.ts';

/** What the viewport shows: every Roblox screen at once, or one page of the site. */
export type View =
  { readonly kind: 'screens' } | { readonly kind: 'page'; readonly pageId: InstanceId };

export const SCREENS: View = { kind: 'screens' };

export interface Scene {
  readonly view: View;
  readonly device: Device;
  /** The devices this view offers. */
  readonly devices: readonly Device[];
  /** The breakpoint shown and edited; none for Desktop and for Roblox screens. */
  readonly breakpoint: InstanceId | undefined;
  readonly layout: Layout;
  /** The drawn area: the device's screen, or for a page the whole page, as long as its content. */
  readonly width: number;
  readonly height: number;
  /** What gets drawn: the ScreenGuis from bottom to top, or the page. */
  readonly roots: readonly InstanceId[];
}

/** A drag in progress, for the overlay: snapping guides and the readout. */
export interface Gesture {
  readonly id: InstanceId;
  readonly kind: 'move' | 'resize';
  readonly guides: readonly Guide[];
}

/** A picture to place: a data URL, with its size in pixels for a new object. */
export interface Picture {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  /** A one-color SVG made white, so ImageColor3 colors it (it starts black). */
  readonly recolor?: boolean;
  /** The new object's Name, such as the file's name. */
  readonly name?: string;
}

export interface Toast {
  readonly id: number;
  readonly text: string;
  /** A second, quieter line, such as what a deleted object held. */
  readonly detail?: string;
  /** Sets its icon and color: `delete` red with a bin, `done` green with a tick. */
  readonly tone?: 'delete' | 'done';
  /** A button in the toast, such as Undo after opening another project. */
  readonly action?: { readonly label: string; readonly run: () => void };
  /** How long it stays, in milliseconds, unless the pointer rests on it. */
  readonly duration: number;
}

/** Autosave, as the app bar shows it. `idle` until something saves the project. */
export type SaveStatus = 'idle' | 'pending' | 'saved' | 'off';

export interface EditorState {
  readonly doc: Doc;
  readonly assets: Assets;
  /** The selected object Properties shows and the handles resize: the last one picked. */
  readonly selection: InstanceId | null;
  /** Everything selected, `selection` included; empty when it's null. */
  readonly selected: readonly InstanceId[];
  readonly hover: InstanceId | null;
  readonly view: View;
  /** The device for Roblox screens, from SCREEN_DEVICES. */
  readonly screenDevice: string;
  /** The device for pages: 'desktop' or a breakpoint's id. */
  readonly pageDevice: string;
  /** Viewport zoom; null fits the screen to the viewport. */
  readonly zoom: number | null;
  /** Show every device next to each other; the edits go to `screenDevice` or `pageDevice`. */
  readonly sideBySide: boolean;
  /** Try the UI: buttons react, text boxes take input, links go to their page. */
  readonly preview: boolean;
  readonly unit: UnitMode;
  readonly snap: boolean;
  readonly backdrop: Backdrop;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly gesture: Gesture | null;
  readonly toast: Toast | null;
  /** An object to scroll into view, after following a link to a section. */
  readonly reveal: { readonly id: InstanceId; readonly seq: number } | null;
  /** Explorer rows that are open. */
  readonly expanded: ReadonlySet<InstanceId>;
  /** The Explorer row whose name is being edited. */
  readonly renaming: InstanceId | null;
  readonly saveStatus: SaveStatus;
  /** The Components drawer is open. */
  readonly components: boolean;
}

export const LIST_PLACES = 'A UIListLayout places this object. Change LayoutOrder to reorder it.';

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 3;

/** A drag needs to move this many viewport pixels before it changes anything. */
const DRAG_START = 3;
/** Snapping reaches this many viewport pixels. */
const SNAP_REACH = 6;

interface Drag {
  readonly kind: 'move' | 'resize';
  readonly id: InstanceId;
  readonly handle: Handle | undefined;
  readonly start: Point;
  readonly box: Box;
  /** Position, Size and AnchorPoint at the start, at the breakpoint being edited. */
  readonly position: UDim2;
  readonly size: UDim2;
  readonly anchor: readonly [number, number];
  readonly breakpoint: InstanceId | undefined;
  readonly parentAngle: number;
  readonly angle: number;
  readonly targets: SnapTargets;
  /** A click (no drag) selects this object instead: the child under the cursor. */
  readonly clickId: InstanceId | undefined;
  /** The rest of the selection, which a move takes along. */
  readonly followers: readonly Follower[];
  active: boolean;
  warned: boolean;
}

/** Another selected object moving with the one dragged. */
interface Follower {
  readonly id: InstanceId;
  readonly box: Box;
  readonly position: UDim2;
  readonly anchor: readonly [number, number];
  readonly parentAngle: number;
}

const edit = (
  id: InstanceId,
  props: Record<string, unknown>,
  breakpoint: InstanceId | undefined,
): Command =>
  breakpoint === undefined
    ? { type: 'setProps', id, props }
    : { type: 'setProps', id, props, breakpoint };

/** The view an instance is drawn in, if any: its page, or the screens. */
export function viewOf(doc: Doc, id: InstanceId): View | undefined {
  let inst = getInstance(doc, id);
  while (inst) {
    if (inst.className === 'Page') return { kind: 'page', pageId: inst.id };
    if (inst.className === 'ScreenGui' || inst.className === 'StarterGui') return SCREENS;
    inst = inst.parent === null ? undefined : getInstance(doc, inst.parent);
  }
  return undefined;
}

/** The whole device shown, as a rectangle at the origin. */
const rectOf = (scene: Scene) => ({ x: 0, y: 0, w: scene.device.width, h: scene.device.height });

const sameView = (a: View, b: View) =>
  a.kind === b.kind && (a.kind === 'screens' || a.pageId === (b as typeof a).pageId);

/** The last scene of each view and device, so the viewport can draw several devices at once. */
const sceneCache = new Map<string, { key: readonly unknown[]; scene: Scene }>();

/** Lays out what the viewport shows. Cached, so calling it on every render is cheap. */
export function sceneOf(
  state: Pick<EditorState, 'doc' | 'view' | 'screenDevice' | 'pageDevice'>,
): Scene {
  const key = [state.doc, state.view, state.screenDevice, state.pageDevice, textVersion()];
  const slot =
    state.view.kind === 'page' ? 'page:' + state.pageDevice : 'screens:' + state.screenDevice;
  const hit = sceneCache.get(slot);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.scene;
  const scene = buildScene(state);
  if (sceneCache.size >= 16) sceneCache.clear();
  sceneCache.set(slot, { key, scene });
  return scene;
}

/**
 * The scenes drawn side by side, from the widest device down: every device of a page, or
 * three of the Roblox screens' devices plus the one being edited. The one being edited is
 * `sceneOf(state)` itself.
 */
export function sideBySideScenes(
  state: Pick<EditorState, 'doc' | 'view' | 'screenDevice' | 'pageDevice'>,
): Scene[] {
  const active = sceneOf(state);
  const ids =
    active.view.kind === 'page'
      ? active.devices.map((d) => d.id)
      : SCREEN_DEVICES.filter(
          (d) => SIDE_BY_SIDE_SCREENS.includes(d.id) || d.id === active.device.id,
        ).map((d) => d.id);
  return ids.map((id) =>
    id === active.device.id
      ? active
      : sceneOf(
          active.view.kind === 'page'
            ? { ...state, pageDevice: id }
            : { ...state, screenDevice: id },
        ),
  );
}

/** Lays out a view of any document, uncached; the template previews use it. */
export function buildScene(
  state: Pick<EditorState, 'doc' | 'view' | 'screenDevice' | 'pageDevice'>,
): Scene {
  const { doc, view } = state;
  const page = view.kind === 'page' ? getInstance(doc, view.pageId) : undefined;
  if (page?.className === 'Page') {
    const devices = pageDevices(doc);
    const device = devices.find((d) => d.id === state.pageDevice) ?? DESKTOP;
    const viewport = { width: device.width, height: device.height };
    const layout = layoutContainer(doc, page.id, viewport, device.breakpoint);
    const box = layout.get(page.id);
    return {
      view,
      device,
      devices,
      breakpoint: device.breakpoint,
      layout,
      width: device.width,
      height: box?.canvas?.h ?? device.height,
      roots: [page.id],
    };
  }
  const device = SCREEN_DEVICES.find((d) => d.id === state.screenDevice) ?? SCREEN_DEVICES[0]!;
  const starterGui = serviceOf(doc, 'StarterGui');
  const roots = childrenOf(doc, starterGui.id)
    .filter((c) => c.className === 'ScreenGui')
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) =>
        (a.c.props as { DisplayOrder: number }).DisplayOrder -
          (b.c.props as { DisplayOrder: number }).DisplayOrder || a.i - b.i,
    )
    .map(({ c }) => c.id);
  return {
    view: SCREENS,
    device,
    devices: SCREEN_DEVICES,
    breakpoint: undefined,
    layout: layoutScreenGuis(doc, starterGui.id, { width: device.width, height: device.height }),
    width: device.width,
    height: device.height,
    roots,
  };
}

/** The Explorer starts with the services open, showing the screens and the pages. */
function initialExpanded(doc: Doc): ReadonlySet<InstanceId> {
  return new Set([serviceOf(doc, 'StarterGui').id, serviceOf(doc, 'Site').id]);
}

/** The pages of the site, in Explorer order. */
export const pagesOf = (doc: Doc): AnyInstance[] =>
  childrenOf(doc, serviceOf(doc, 'Site').id).filter((c) => c.className === 'Page');

export interface EditorOptions {
  readonly assets?: Assets;
  readonly view?: View;
}

export class Editor {
  readonly history: History;
  #state: EditorState;
  #listeners = new Set<() => void>();
  #drag: Drag | null = null;
  #clipboard: Subtree[] | null = null;
  #toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** When the toast goes, or while it's held, how long it has left. */
  #toastEnds = 0;
  #toastLeft: number | null = null;
  #seq = 0;

  constructor(doc: Doc, options: EditorOptions = {}) {
    this.history = new History(doc);
    const firstPage = pagesOf(doc)[0];
    this.#state = {
      doc,
      assets: options.assets ?? {},
      selection: null,
      selected: [],
      hover: null,
      view: options.view ?? (firstPage ? { kind: 'page', pageId: firstPage.id } : SCREENS),
      screenDevice: SCREEN_DEVICES[0]!.id,
      pageDevice: DESKTOP.id,
      zoom: null,
      sideBySide: false,
      preview: false,
      unit: 'auto',
      snap: true,
      backdrop: 'grid',
      canUndo: false,
      canRedo: false,
      gesture: null,
      toast: null,
      reveal: null,
      expanded: initialExpanded(doc),
      renaming: null,
      saveStatus: 'idle',
      components: false,
    };
    this.history.subscribe(() => this.#onDocChange());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getState = (): EditorState => this.#state;
  get state(): EditorState {
    return this.#state;
  }
  get doc(): Doc {
    return this.#state.doc;
  }
  get scene(): Scene {
    return sceneOf(this.#state);
  }
  /** Lays the view out again, such as after web fonts load and text measures differently. */
  refreshLayout() {
    this.#update({});
  }
  /** A pointer is down on an object (it may not have moved yet). */
  get dragging(): boolean {
    return this.#drag !== null;
  }

  #update(patch: Partial<EditorState>) {
    this.#state = {
      ...this.#state,
      ...patch,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
    this.#listeners.forEach((l) => l());
  }

  /** Keeps the selection and hover pointing at objects that still exist. */
  #onDocChange() {
    const doc = this.history.doc;
    const alive = (id: InstanceId | null) => (id !== null && getInstance(doc, id) ? id : null);
    const selected = this.#state.selected.filter((id) => alive(id) !== null);
    this.#update({
      doc,
      selection: alive(this.#state.selection) ?? selected.at(-1) ?? null,
      selected: selected.length === this.#state.selected.length ? this.#state.selected : selected,
      hover: alive(this.#state.hover),
      renaming: alive(this.#state.renaming),
    });
  }

  /** Runs a command as one undo step (or part of the open gesture). Refusals become a toast. */
  #execute(cmd: Command): boolean {
    try {
      this.history.execute(cmd);
      return true;
    } catch (e) {
      if (!(e instanceof ModelError)) throw e;
      this.toast(e.message);
      return false;
    }
  }

  #selected(): AnyInstance | undefined {
    const id = this.#state.selection;
    return id === null ? undefined : getInstance(this.doc, id);
  }

  toast(
    text: string,
    action?: Toast['action'],
    more: { readonly detail?: string; readonly tone?: Toast['tone'] } = {},
  ) {
    const duration = action ? 6000 : 2600;
    const toast: Toast = { id: ++this.#seq, text, duration, ...more, ...(action && { action }) };
    this.#update({ toast });
    this.#toastLeft = null;
    this.#timeToast(toast, duration);
  }
  #timeToast(toast: Toast, ms: number) {
    clearTimeout(this.#toastTimer);
    this.#toastEnds = Date.now() + ms;
    this.#toastTimer = setTimeout(() => {
      if (this.#state.toast === toast) this.#update({ toast: null });
    }, ms);
  }
  /** Keeps the toast while the pointer rests on it; `false` lets it go with the time it had left. */
  holdToast(hold: boolean) {
    const toast = this.#state.toast;
    if (!toast) return;
    if (hold && this.#toastLeft === null) {
      clearTimeout(this.#toastTimer);
      this.#toastLeft = Math.max(0, this.#toastEnds - Date.now());
    } else if (!hold && this.#toastLeft !== null) {
      this.#timeToast(toast, Math.max(1200, this.#toastLeft));
      this.#toastLeft = null;
    }
  }
  dismissToast() {
    if (this.#state.toast) this.#update({ toast: null });
  }

  /**
   * Selects an object (or nothing), shows the view it's drawn in, and opens its ancestors in
   * the Explorer.
   */
  select(id: InstanceId | null) {
    this.selectMany(id === null ? [] : [id]);
  }

  /**
   * Selects several objects; `primary` (the last one by default) is the one Properties shows
   * first. Shows the primary's view and opens everyone's ancestors in the Explorer.
   */
  selectMany(ids: readonly InstanceId[], primary?: InstanceId) {
    const doc = this.doc;
    const selected = [...new Set(ids)].filter((id) => getInstance(doc, id));
    const target =
      primary !== undefined && selected.includes(primary) ? primary : (selected.at(-1) ?? null);
    const view = target === null ? undefined : viewOf(doc, target);
    let expanded = this.#state.expanded;
    for (const id of selected)
      for (let p = getInstance(doc, id)!.parent; p !== null;) {
        if (!expanded.has(p)) expanded = new Set(expanded).add(p);
        p = getInstance(doc, p)?.parent ?? null;
      }
    this.#update({
      selection: target,
      selected,
      expanded,
      view: view && !sameView(view, this.#state.view) ? view : this.#state.view,
    });
  }

  /** Adds an object to the selection, or takes it out (Ctrl or Shift and click). */
  toggleSelected(id: InstanceId) {
    const { selected } = this.#state;
    if (!selected.includes(id)) return this.selectMany([...selected, id], id);
    const rest = selected.filter((s) => s !== id);
    const primary = this.#state.selection === id ? rest.at(-1) : this.#state.selection;
    this.selectMany(rest, primary ?? undefined);
  }

  /**
   * Selects every object beside the selected one, or with nothing selected, every object on
   * the page or the Roblox screens shown (Ctrl+A).
   */
  selectAll() {
    const doc = this.doc;
    const inst = this.#selected();
    const parent = inst && isGui(inst) && inst.parent !== null && drawnParent(doc, inst.parent);
    const scene = this.scene;
    const roots = parent ? [parent.id] : scene.roots;
    const ids = roots.flatMap((r) =>
      drawnChildren(doc, r)
        .filter(isGui)
        .map((c) => c.id),
    );
    if (ids.length) this.selectMany(ids, inst && ids.includes(inst.id) ? inst.id : undefined);
  }

  /**
   * Selects the objects drawn entirely inside a rectangle of the device shown (a box drawn on
   * empty space), leaving out those inside another one picked, added to `base`.
   */
  selectInRect(
    r: { x: number; y: number; w: number; h: number },
    base: readonly InstanceId[] = [],
  ) {
    const doc = this.doc;
    const { layout } = this.scene;
    const inside = new Set<InstanceId>();
    const drawn = (id: InstanceId): boolean => {
      for (let p: InstanceId | null = id; p !== null; p = getInstance(doc, p)?.parent ?? null) {
        const b = layout.get(p);
        if (!b) return true;
        if (!b.visible) return false;
      }
      return true;
    };
    for (const id of layout.keys()) {
      const inst = getInstance(doc, id);
      const q = inst && isGui(inst) && drawn(id) ? screenQuad(doc, layout, id) : undefined;
      if (!q) continue;
      const a = (q.angle * Math.PI) / 180;
      const hw = (Math.abs(q.w * Math.cos(a)) + Math.abs(q.h * Math.sin(a))) / 2;
      const hh = (Math.abs(q.w * Math.sin(a)) + Math.abs(q.h * Math.cos(a))) / 2;
      if (q.cx - hw >= r.x && q.cx + hw <= r.x + r.w && q.cy - hh >= r.y && q.cy + hh <= r.y + r.h)
        inside.add(id);
    }
    const picked = [...inside].filter((id) => ![...inside].some((o) => isAncestor(doc, o, id)));
    this.selectMany([...base.filter((id) => !picked.includes(id)), ...picked]);
  }

  /** Opens or closes an Explorer row; without `open`, toggles it. */
  setExpanded(id: InstanceId, open?: boolean) {
    const now = this.#state.expanded.has(id);
    if ((open ?? !now) === now) return;
    const expanded = new Set(this.#state.expanded);
    if (now) expanded.delete(id);
    else expanded.add(id);
    this.#update({ expanded });
  }

  setSaveStatus(saveStatus: SaveStatus) {
    if (saveStatus !== this.#state.saveStatus) this.#update({ saveStatus });
  }

  setHover(id: InstanceId | null) {
    if (id !== this.#state.hover) this.#update({ hover: id });
  }

  /** Shows the screens or a page. A selection that isn't drawn there is cleared. */
  setView(view: View) {
    if (sameView(view, this.#state.view)) return;
    const shown = (id: InstanceId) => {
      const v = viewOf(this.doc, id);
      return v !== undefined && sameView(v, view);
    };
    const selected = this.#state.selected.filter(shown);
    const sel = this.#state.selection;
    const selection = sel !== null && shown(sel) ? sel : (selected.at(-1) ?? null);
    this.#update({ view, hover: null, selection, selected, zoom: null });
  }

  /**
   * Picks the device for the current view, and fits it to the viewport. Side by side, every
   * device stays where it is and this one takes the edits.
   */
  setDevice(id: string) {
    const patch = this.scene.view.kind === 'page' ? { pageDevice: id } : { screenDevice: id };
    if (this.#state.sideBySide) this.#update(patch);
    else this.#update({ ...patch, zoom: null });
  }

  /** Shows every device next to each other, or only the one being edited. */
  setSideBySide(sideBySide: boolean) {
    if (sideBySide === this.#state.sideBySide) return;
    this.endDrag();
    this.#update({ sideBySide, hover: null, zoom: null });
  }

  setZoom(zoom: number | null) {
    this.#update({ zoom: zoom === null ? null : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) });
  }

  setPreview(preview: boolean) {
    this.endDrag();
    this.#update({ preview, hover: null });
  }

  setUnit(unit: UnitMode) {
    this.#update({ unit });
  }
  setSnap(snap: boolean) {
    this.#update({ snap });
  }
  setComponentsOpen(components: boolean) {
    if (components !== this.#state.components) this.#update({ components });
  }
  setBackdrop(backdrop: Backdrop) {
    this.#update({ backdrop });
  }

  undo() {
    this.#drag = null;
    const done = this.history.undo();
    this.#update({ gesture: null });
    if (!done) this.toast('Nothing to undo');
  }
  redo() {
    if (!this.history.redo()) return this.toast('Nothing to redo');
    this.#update({});
  }

  /**
   * Starts dragging an object: `move`, or `resize` from a handle. Nothing changes until the
   * pointer has moved a few pixels. With `clickId`, a click without a drag selects that object.
   */
  startDrag(
    kind: 'move' | 'resize',
    id: InstanceId,
    point: Point,
    opts: { handle?: Handle; clickId?: InstanceId } = {},
  ) {
    const scene = this.scene;
    const doc = this.doc;
    const inst = getInstance(doc, id);
    const box = scene.layout.get(id);
    if (!inst || !isGui(inst) || !box || (kind === 'resize' && !opts.handle)) return;
    const p = resolveProps(doc, inst, scene.breakpoint);
    // A move takes the rest of the selection along, when it's drawn here and not in a list.
    const followers: Follower[] = [];
    if (kind === 'move' && this.#state.selected.includes(id))
      for (const t of this.#targets()) {
        const b = scene.layout.get(t.id);
        if (t.id === id || !isGui(t) || !b || b.listItem) continue;
        const tp = resolveProps(doc, t, scene.breakpoint);
        followers.push({
          id: t.id,
          box: b,
          position: tp.Position,
          anchor: tp.AnchorPoint,
          parentAngle: ancestorAngle(doc, scene.layout, t.id),
        });
      }
    const moving = new Set([id, ...followers.map((f) => f.id)]);
    const parent = inst.parent === null ? undefined : drawnParent(doc, inst.parent);
    const siblings = !parent
      ? []
      : drawnChildren(doc, parent.id).flatMap((s) =>
          !moving.has(s.id) && isGui(s) ? (scene.layout.get(s.id) ?? []) : [],
        );
    this.#drag = {
      kind,
      id,
      handle: opts.handle,
      start: point,
      box,
      position: p.Position,
      size: p.Size,
      anchor: p.AnchorPoint,
      breakpoint: scene.breakpoint,
      parentAngle: ancestorAngle(doc, scene.layout, id),
      angle: screenQuad(doc, scene.layout, id)?.angle ?? 0,
      targets: snapTargets(box.area, siblings),
      clickId: opts.clickId,
      followers,
      active: false,
      warned: false,
    };
  }

  /**
   * Follows the pointer. `zoom` turns the start threshold and snapping reach into screen
   * pixels; Shift keeps proportions on a corner handle; Alt skips snapping.
   */
  dragTo(point: Point, mods: { zoom: number; shift?: boolean; alt?: boolean }) {
    const d = this.#drag;
    if (!d) return;
    let dx = point.x - d.start.x;
    let dy = point.y - d.start.y;
    if (!d.active) {
      if (Math.hypot(dx, dy) * mods.zoom < DRAG_START) return;
      d.active = true;
    }
    if (d.kind === 'move' && d.box.listItem) {
      if (!d.warned) {
        d.warned = true;
        this.toast(LIST_PLACES);
      }
      return;
    }
    if (!this.history.inGroup) this.history.begin();
    const unit = this.#state.unit;
    const snap = this.#state.snap && !mods.alt;
    const threshold = SNAP_REACH / mods.zoom;
    const props: Record<string, unknown> = {};
    const follow: Command[] = [];
    let guides: readonly Guide[];
    if (d.kind === 'move') {
      if (d.parentAngle) [dx, dy] = rotate(dx, dy, -d.parentAngle);
      const canSnap = snap && !d.parentAngle && !d.box.rotation;
      const m = moveRect(d.box, dx, dy, canSnap ? d.targets : null, threshold);
      props.Position = positionFor(d.position, d.anchor, d.box.area, m.rect, unit);
      guides = m.guides;
      // The others move as far on screen as the dragged one, snapping included.
      let [sx, sy] = [m.rect.x - d.box.x, m.rect.y - d.box.y];
      if (d.parentAngle) [sx, sy] = rotate(sx, sy, d.parentAngle);
      for (const f of d.followers) {
        const [fx, fy] = f.parentAngle ? rotate(sx, sy, -f.parentAngle) : [sx, sy];
        const rect = { x: f.box.x + fx, y: f.box.y + fy, w: f.box.w, h: f.box.h };
        const Position = positionFor(f.position, f.anchor, f.box.area, rect, unit);
        follow.push(edit(f.id, { Position }, d.breakpoint));
      }
    } else {
      if (d.angle) [dx, dy] = rotate(dx, dy, -d.angle);
      const m = resizeRect(d.box, d.handle!, dx, dy, {
        snap: snap && !d.angle ? d.targets : null,
        threshold,
        keepRatio: !!mods.shift,
      });
      props.Size = sizeFor(d.size, d.box.area, m.rect.w, m.rect.h, unit);
      if (!d.box.listItem)
        props.Position = positionFor(d.position, d.anchor, d.box.area, m.rect, unit);
      guides = m.guides;
    }
    const own = edit(d.id, props, d.breakpoint);
    this.#execute(follow.length ? batch(own, ...follow) : own);
    this.#update({ gesture: { id: d.id, kind: d.kind, guides } });
  }

  /** Ends the drag as one undo step, or treats it as a click if it never moved. */
  endDrag() {
    const d = this.#drag;
    if (!d) return;
    this.#drag = null;
    if (this.history.inGroup) this.history.commit();
    if (!d.active && d.clickId !== undefined) this.select(d.clickId);
    this.#update({ gesture: null });
  }

  /** Moves the selection by whole pixels, as the arrow keys do. */
  nudge(dx: number, dy: number) {
    const scene = this.scene;
    const cmds: Command[] = [];
    let listed = false;
    for (const inst of this.#targets()) {
      const box = scene.layout.get(inst.id);
      if (!isGui(inst) || !box) continue;
      if (box.listItem) {
        listed = true;
        continue;
      }
      const p = resolveProps(this.doc, inst, scene.breakpoint);
      const rect = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
      const Position = positionFor(p.Position, p.AnchorPoint, box.area, rect, this.#state.unit);
      cmds.push(edit(inst.id, { Position }, scene.breakpoint));
    }
    if (cmds.length) this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds));
    else if (listed) this.toast(LIST_PLACES);
  }

  /**
   * Objects, folders, layers and modifiers can be copied and deleted; services and the root
   * can't.
   */
  #editable(inst: AnyInstance | undefined): inst is AnyInstance {
    if (!inst) return false;
    const kind = classDef(inst.className).kind;
    return kind === 'gui' || kind === 'container' || kind === 'modifier' || kind === 'folder';
  }

  /**
   * What the selection's actions work on: the selected objects that can be edited, without
   * those inside another selected one, in Explorer order.
   */
  #targets(): AnyInstance[] {
    const doc = this.doc;
    const { selected } = this.#state;
    const order = new Map(subtreeIds(doc, doc.rootId).map((id, i) => [id, i]));
    return selected
      .filter((id) => !selected.some((o) => o !== id && isAncestor(doc, o, id)))
      .map((id) => getInstance(doc, id))
      .filter((inst) => this.#editable(inst))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  /** The selected objects the selection's actions work on, in Explorer order. */
  get targetIds(): InstanceId[] {
    return this.#targets().map((t) => t.id);
  }
  get targetCount(): number {
    return this.#targets().length;
  }

  /** Whether something was copied, so Paste has something to put in. */
  get canPaste(): boolean {
    return this.#clipboard !== null;
  }

  /** "Button" for one object, "3 objects" for more. */
  #what(list: readonly AnyInstance[]) {
    return list.length === 1 ? list[0]!.props.Name : `${list.length} objects`;
  }

  deleteSelection() {
    const targets = this.#targets();
    if (!targets.length) return;
    const doc = this.doc;
    const inst = targets.find((t) => t.id === this.#state.selection) ?? targets[0]!;
    const parent = inst.parent === null ? undefined : getInstance(doc, inst.parent);
    const inside =
      targets.reduce((n, t) => n + Object.keys(extractSubtree(doc, t.id).instances).length, 0) -
      targets.length;
    const cmds = targets.map((t) => remove(t.id));
    if (!this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds))) return;
    const after = this.doc;
    const kind = parent && classDef(parent.className).kind;
    const keep = parent && (kind === 'gui' || kind === 'container' || kind === 'folder');
    this.select(keep ? parent.id : null);
    const what = this.#what(targets);
    const undo = () => {
      // Only while the delete is still the last change; otherwise Undo would take back
      // something else.
      if (this.doc !== after) return this.toast('You’ve changed things since. Use Undo (Ctrl+Z).');
      this.undo();
      this.selectMany(
        targets.map((t) => t.id),
        inst.id,
      );
      this.toast(`${what} ${targets.length === 1 ? 'is' : 'are'} back`, undefined, {
        tone: 'done',
      });
    };
    const objects = (n: number) => `${n} ${n === 1 ? 'object' : 'objects'}`;
    const detail =
      targets.length === 1
        ? inside
          ? `${inst.className} and ${objects(inside)} inside it`
          : inst.className
        : targets.map((t) => t.props.Name).join(', ') +
          (inside ? `, with ${objects(inside)} inside` : '');
    this.toast(`Deleted ${what}`, { label: 'Undo', run: undo }, { tone: 'delete', detail });
  }

  duplicateSelection() {
    const targets = this.#targets().filter((t) => t.parent !== null);
    if (!targets.length) return;
    const doc = this.doc;
    const scene = this.scene;
    const cmds: Command[] = [];
    const copies = new Map<InstanceId, InstanceId>();
    // Last first, so each copy lands right after its original.
    for (const inst of [...targets].reverse()) {
      const parent = getInstance(doc, inst.parent!)!;
      const copy = reIdSubtree(extractSubtree(doc, inst.id));
      copies.set(inst.id, copy.rootId);
      cmds.push(insert(parent.id, copy, parent.children.indexOf(inst.id) + 1));
      // Offset the copy a little so it doesn't hide the original.
      const box = scene.layout.get(inst.id);
      if (isGui(inst) && box && !box.listItem) {
        const pos = resolveProps(doc, inst, scene.breakpoint).Position;
        const Position = [pos[0], pos[1] + 12, pos[2], pos[3] + 12];
        cmds.push(edit(copy.rootId, { Position }, scene.breakpoint));
      }
    }
    if (!this.#execute(batch(...cmds))) return;
    const primary = this.#state.selection;
    this.selectMany(
      targets.map((t) => copies.get(t.id)!),
      primary === null ? undefined : copies.get(primary),
    );
    this.toast(`Duplicated ${this.#what(targets)}`);
  }

  copySelection(cut = false) {
    const targets = this.#targets();
    if (!targets.length) return;
    this.#clipboard = targets.map((t) => extractSubtree(this.doc, t.id));
    if (cut) this.deleteSelection();
    else this.toast(`Copied ${this.#what(targets)}`);
  }

  /** Pastes into the selection, or the nearest ancestor that can hold each copy. */
  paste() {
    if (!this.#clipboard) return this.toast('Copy something first (Ctrl+C).');
    const doc = this.doc;
    const scene = this.scene;
    const cmds: Command[] = [];
    const ids: InstanceId[] = [];
    for (const subtree of this.#clipboard) {
      const copy = reIdSubtree(subtree);
      const className = copy.instances[copy.rootId]!.className;
      let parent = this.#selected();
      while (parent && !canParent(className, parent.className))
        parent = parent.parent === null ? undefined : getInstance(doc, parent.parent);
      if (!parent) {
        const fallback = [
          serviceOf(doc, 'StarterGui').id,
          serviceOf(doc, 'Site').id,
          scene.view.kind === 'page' ? scene.view.pageId : scene.roots[0],
        ];
        parent = fallback
          .flatMap((id) => (id === undefined ? [] : (getInstance(doc, id) ?? [])))
          .find((p) => canParent(className, p.className));
      }
      if (!parent) continue;
      cmds.push(insert(parent.id, copy));
      ids.push(copy.rootId);
    }
    if (!cmds.length) return this.toast('Add a ScreenGui first.');
    if (this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds))) this.selectMany(ids);
  }

  /**
   * Puts the selected objects in a new Folder where the first of them was, as Ctrl+G does in
   * Studio. They must share a parent.
   */
  groupSelection() {
    const doc = this.doc;
    const targets = this.#targets().filter((t) => {
      const kind = classDef(t.className).kind;
      return kind === 'gui' || kind === 'folder';
    });
    if (!targets.length) return this.toast('Select objects to put in a Folder.');
    const parentId = targets[0]!.parent;
    const parent = parentId === null ? undefined : getInstance(doc, parentId);
    if (!parent || targets.some((t) => t.parent !== parentId))
      return this.toast('Pick objects that sit in the same parent to group them.');
    if (!canParent('Folder', parent.className)) return this.toast('A Folder can’t go there.');
    const folder = newSubtree(doc, 'Folder', parent, rectOf(this.scene));
    const index = Math.min(...targets.map((t) => parent.children.indexOf(t.id)));
    const cmds = [
      insert(parent.id, folder, index),
      ...targets.map((t) => move(t.id, folder.rootId)),
    ];
    if (!this.#execute(batch(...cmds))) return;
    this.select(folder.rootId);
    this.setExpanded(folder.rootId, true);
    const listed = childOfClass(doc, drawnParent(doc, parent.id)?.id ?? parent.id, 'UIListLayout');
    this.toast(
      listed
        ? `Grouped ${this.#what(targets)} in a Folder. The UIListLayout doesn’t arrange objects in a Folder, as in Roblox.`
        : `Grouped ${this.#what(targets)} in a Folder`,
    );
  }

  /** Takes everything out of the selected Folders and deletes them (Ctrl+Shift+G). */
  ungroupSelection() {
    const doc = this.doc;
    const folders = this.#targets().filter((t) => t.className === 'Folder' && t.parent !== null);
    if (!folders.length) return this.toast('Select a Folder to ungroup.');
    const cmds: Command[] = [];
    const freed: InstanceId[] = [];
    for (const f of folders) {
      const parent = getInstance(doc, f.parent!)!;
      // Index among the parent's other children: the folder's place, kept until it goes.
      let at = parent.children.indexOf(f.id);
      for (const c of f.children) {
        cmds.push(move(c, parent.id, at++));
        freed.push(c);
      }
      cmds.push(remove(f.id));
    }
    if (!this.#execute(batch(...cmds))) return;
    this.selectMany(freed);
  }

  /** The breakpoint edits to an object go to: the one shown, when the object is on the page shown. */
  breakpointFor(id: InstanceId): InstanceId | undefined {
    const scene = this.scene;
    if (scene.breakpoint === undefined) return undefined;
    const view = viewOf(this.doc, id);
    return view && sameView(view, scene.view) ? scene.breakpoint : undefined;
  }

  /**
   * Sets one property, as one undo step or as part of an open gesture. On a page shown at a
   * breakpoint, a property that may differ per breakpoint changes there only; the others
   * change everywhere. Returns false when the value is refused.
   */
  setProp(id: InstanceId, key: string, value: unknown): boolean {
    const inst = getInstance(this.doc, id);
    if (!inst) return false;
    const bp = this.breakpointFor(id);
    const here = bp !== undefined && isOverridable(inst.className, key) ? bp : undefined;
    return this.#execute(edit(id, { [key]: value }, here));
  }

  /**
   * Ctrl+B and Ctrl+I: turns the selected text bold (or back to Regular) or italic (or back
   * to Normal). Returns false when the selection has no text.
   */
  toggleTextStyle(which: 'bold' | 'italic'): boolean {
    const id = this.#state.selection;
    const inst = id === null ? undefined : getInstance(this.doc, id);
    if (!inst || !classDef(inst.className).text) return false;
    // The last picked object decides, and every selected text object follows it.
    const p = inst.props as { FontWeight: FontWeight; FontStyle: FontStyle };
    if (which === 'italic')
      return this.setSelectedProp('FontStyle', p.FontStyle === 'Italic' ? 'Normal' : 'Italic');
    const bold = FONT_WEIGHTS[p.FontWeight] >= FONT_WEIGHTS.SemiBold;
    return this.setSelectedProp('FontWeight', bold ? 'Regular' : 'Bold');
  }

  /** Drops the shown breakpoint's own value, so the property inherits again. */
  resetProp(id: InstanceId, key: string) {
    const bp = this.breakpointFor(id);
    if (bp !== undefined)
      this.#execute({ type: 'setProps', id, props: {}, breakpoint: bp, clear: [key] });
  }

  /** The selected objects that have a property, which Properties edits all at once. */
  #withProp(key: string): AnyInstance[] {
    return this.#state.selected.flatMap((id) => {
      const inst = getInstance(this.doc, id);
      return inst && propSpec(inst.className, key) ? [inst] : [];
    });
  }

  /** Sets one property on every selected object that has it, as one step; see setProp. */
  setSelectedProp(key: string, value: unknown): boolean {
    const cmds = this.#withProp(key).map((inst) => {
      const bp = this.breakpointFor(inst.id);
      const here = bp !== undefined && isOverridable(inst.className, key) ? bp : undefined;
      return edit(inst.id, { [key]: value }, here);
    });
    if (!cmds.length) return false;
    return this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds));
  }

  /** resetProp for every selected object that has the property. */
  resetSelectedProp(key: string) {
    const cmds = this.#withProp(key).flatMap((inst): Command[] => {
      const bp = this.breakpointFor(inst.id);
      return bp === undefined
        ? []
        : [{ type: 'setProps', id: inst.id, props: {}, breakpoint: bp, clear: [key] }];
    });
    if (cmds.length) this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds));
  }

  /** Edits between these (a slider, the color picker) are one undo step. */
  beginGesture() {
    if (!this.history.inGroup) this.history.begin();
  }
  endGesture() {
    if (this.history.inGroup && !this.#drag) this.history.commit();
  }

  /**
   * Objects, folders, layers, modifiers and breakpoints can be renamed; services and the root
   * can't.
   */
  canRename(id: InstanceId): boolean {
    const inst = getInstance(this.doc, id);
    const kind = inst && classDef(inst.className).kind;
    return !!kind && kind !== 'root' && kind !== 'service';
  }
  startRename(id: InstanceId | null = this.#state.selection) {
    if (id !== null && this.canRename(id)) this.#update({ renaming: id });
  }
  /** Ends renaming; with a name, applies it. A blank name keeps the old one. */
  endRename(name?: string) {
    const id = this.#state.renaming;
    if (id === null) return;
    this.#update({ renaming: null });
    const inst = getInstance(this.doc, id);
    const v = name?.trim();
    if (inst && v && v !== inst.props.Name) this.#execute(edit(id, { Name: v }, undefined));
  }

  /**
   * Inserts a new object, layer, page or modifier and selects it. An object goes into
   * `parentId` (the selection by default) or its nearest ancestor that can hold it, or else
   * into what the viewport shows. A modifier goes on `parentId` itself.
   */
  insert(className: ClassName, parentId: InstanceId | null = this.#state.selection) {
    return this.#insertNew(className, parentId);
  }

  /**
   * Inserts a shape from the Shapes menu, where an object would go. Picture shapes add their
   * white SVG to the image library.
   */
  insertShape(shapeId: string, parentId: InstanceId | null = this.#state.selection) {
    const shape = shapeById(shapeId);
    if (!shape) return null;
    const picture = shapePicture(shape);
    if (picture !== undefined && this.#addPicture(picture) === null) return null;
    return this.#insertNew(shapeClass(shape), parentId, shapeProps(shape), (root) =>
      finishShape(shape, root, newId),
    );
  }

  /**
   * Inserts an ImageLabel showing a picture, as big as the picture up to 400 px a side: a
   * pasted or dropped SVG or image.
   */
  insertPicture(pic: Picture, parentId: InstanceId | null = this.#state.selection) {
    const preview = this.#addPicture(pic.dataUrl);
    if (preview === null) return null;
    const fit = Math.min(1, 400 / Math.max(pic.width, pic.height, 1));
    const w = Math.max(1, Math.round(pic.width * fit));
    const h = Math.max(1, Math.round(pic.height * fit));
    const props: Record<string, unknown> = {
      Size: [0, w, 0, h],
      BackgroundTransparency: 1,
    };
    const name = pic.name?.trim();
    if (name) props.Name = name;
    if (pic.recolor) props.ImageColor3 = [0, 0, 0];
    return this.#insertNew('ImageLabel', parentId, props, (root) => single({ ...root, preview }));
  }

  /**
   * Inserts a new object, layer, page or modifier and selects it. An object goes into
   * `parentId` (the selection by default) or its nearest ancestor that can hold it, or else
   * into what the viewport shows. A modifier goes on `parentId` itself. `start` and `finish`
   * shape the new object: properties it starts with, and what goes with it.
   */
  #insertNew(
    className: ClassName,
    parentId: InstanceId | null,
    start?: Readonly<Record<string, unknown>>,
    finish?: (root: AnyInstance) => Subtree,
  ) {
    const doc = this.doc;
    const scene = this.scene;
    const kind = classDef(className).kind;
    let parent = insertParent(doc, className, parentId);
    if (!parent && kind === 'modifier') {
      this.toast(
        className === 'UIListLayout'
          ? 'Select a ScreenGui, page or object to lay out its children.'
          : 'Select a Frame, label, button or image first.',
      );
      return null;
    }
    const cmds: Command[] = [];
    if (!parent) {
      const fallback =
        className === 'ScreenGui'
          ? serviceOf(doc, 'StarterGui')
          : className === 'Page'
            ? serviceOf(doc, 'Site')
            : getInstance(
                doc,
                scene.view.kind === 'page' ? scene.view.pageId : (scene.roots[0] ?? ''),
              );
      parent = fallback && canParent(className, fallback.className) ? fallback : undefined;
    }
    if (!parent) {
      // Roblox screens with no ScreenGui yet: make one to hold the object.
      const starterGui = serviceOf(doc, 'StarterGui');
      const layer = newSubtree(doc, 'ScreenGui', starterGui, rectOf(scene));
      cmds.push(insert(starterGui.id, layer));
      parent = layer.instances[layer.rootId]!;
    } else if (hasModifier(doc, parent.id, className)) {
      this.select(childOfClass(doc, parent.id, className)!.id);
      this.toast(`${parent.props.Name} already has a ${className}.`);
      return null;
    }
    const box = scene.layout.get(parent.id);
    let area = box?.content ?? rectOf(scene);
    // On a long page, center in the first screen rather than halfway down.
    if (parent.className === 'Page') area = { ...area, h: Math.min(area.h, scene.device.height) };
    let subtree = newSubtree(this.doc, className, parent, area, newId, start);
    if (finish) subtree = finish(subtree.instances[subtree.rootId]!);
    cmds.push(insert(parent.id, subtree));
    if (!this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds))) return null;
    this.select(subtree.rootId);
    return subtree.rootId;
  }

  /**
   * Where a component lands: a block in the selection or its nearest ancestor that can hold
   * it, a website section in that object's page, and otherwise what the viewport shows.
   * Undefined when the Roblox screens have no ScreenGui yet.
   */
  #componentParent(def: ComponentDef, parentId: InstanceId | null): AnyInstance | undefined {
    const doc = this.doc;
    const scene = this.scene;
    let parent = insertParent(doc, 'Frame', parentId);
    if (def.place === 'section') {
      const view = parent ? viewOf(doc, parent.id) : scene.view;
      if (view?.kind === 'page') parent = getInstance(doc, view.pageId);
    }
    return (
      parent ??
      getInstance(doc, scene.view.kind === 'page' ? scene.view.pageId : (scene.roots[0] ?? ''))
    );
  }

  /** The name of the object a component would land in now, for the Add button. */
  componentParentName(def: ComponentDef): string {
    return this.#componentParent(def, this.#state.selection)?.props.Name ?? 'a new ScreenGui';
  }

  /**
   * Adds a copy of a pre-made component and selects it. A block lands inside the selection, or
   * its nearest ancestor that can hold it, like Insert; a website section goes into the page.
   * Straight on a page, a block gets a section of its own. Returns the new component's id.
   */
  addComponent(
    def: ComponentDef,
    options: ComponentOptions,
    parentId: InstanceId | null = this.#state.selection,
  ): InstanceId | null {
    const doc = this.doc;
    const scene = this.scene;
    let parent = this.#componentParent(def, parentId);
    const cmds: Command[] = [];
    if (!parent) {
      // Roblox screens with no ScreenGui yet: make one to hold the component.
      const starterGui = serviceOf(doc, 'StarterGui');
      const layer = newSubtree(doc, 'ScreenGui', starterGui, rectOf(scene));
      cmds.push(insert(starterGui.id, layer));
      parent = layer.instances[layer.rootId]!;
    }
    const onPage = parent.className === 'Page';
    const copy = componentSubtree(doc, def, options, onPage ? 'page' : 'other');
    const outer = copy.instances[copy.rootId]!;
    const siblings = childrenOf(doc, parent.id).filter(isGui);
    let place: Record<string, unknown> = {};
    if (childOfClass(doc, parent.id, 'UIListLayout')) {
      // Last in the list.
      const last = Math.max(0, ...siblings.map((c) => resolveProps(doc, c).LayoutOrder));
      place = { LayoutOrder: last + 1 };
    } else if (def.place === 'block') {
      const nudge = (12 * siblings.length) % 96;
      place = { AnchorPoint: [0.5, 0.5], Position: [0.5, nudge, 0.5, nudge] };
    }
    const subtree: Subtree = {
      ...copy,
      instances: {
        ...copy.instances,
        [outer.id]: { ...outer, props: { ...outer.props, ...place } } as AnyInstance,
      },
    };
    cmds.push(insert(parent.id, subtree));
    if (!this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds))) return null;
    // On a page, a block's section holds it; select the component itself.
    const rootId =
      onPage && def.place !== 'section'
        ? (outer.children.find((id) => {
            const c = copy.instances[id]!;
            return isGui(c);
          }) ?? outer.id)
        : outer.id;
    this.select(rootId);
    this.toast(`${def.name} added to ${parent.props.Name}`, {
      label: 'Undo',
      run: () => this.undo(),
    });
    return rootId;
  }

  /** Reparents or reorders: `index` is the place among the new parent's other children. */
  moveTo(id: InstanceId, parentId: InstanceId, index?: number) {
    if (this.#execute(move(id, parentId, index))) this.select(id);
  }

  /**
   * Moves several objects, in Explorer order, into a parent: `index` is where they go among the
   * parent's children that aren't moving (the end by default). One undo step.
   */
  moveManyTo(ids: readonly InstanceId[], parentId: InstanceId, index?: number) {
    const doc = this.doc;
    const parent = getInstance(doc, parentId);
    if (!parent) return;
    const order = new Map(subtreeIds(doc, doc.rootId).map((id, i) => [id, i]));
    const moving = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const others = parent.children.filter((c) => !moving.includes(c));
    const at = index ?? others.length;
    const final = [...others.slice(0, at), ...moving, ...others.slice(at)];
    // Each to the end first, then to its place: every index then counts only what's settled.
    const cmds = [
      ...moving.map((id) => move(id, parentId)),
      ...moving.map((id) => move(id, parentId, final.indexOf(id))),
    ];
    if (this.#execute(batch(...cmds))) this.selectMany(moving, this.#state.selection ?? undefined);
  }

  /** The Explorer's eye: Visible for an object (at the breakpoint shown), Enabled for a ScreenGui. */
  toggleVisible(id: InstanceId) {
    const inst = getInstance(this.doc, id);
    if (inst?.className === 'ScreenGui') {
      this.#execute(edit(id, { Enabled: !inst.props.Enabled }, undefined));
    } else if (inst && isGui(inst)) {
      const bp = this.breakpointFor(id);
      this.#execute(edit(id, { Visible: !resolveProps(this.doc, inst, bp).Visible }, bp));
    }
  }

  /** Shows or hides every selected object, as the Explorer's eye does for one. */
  setSelectedVisible(visible: boolean) {
    const cmds = this.#state.selected.flatMap((id): Command[] => {
      const inst = getInstance(this.doc, id);
      if (inst?.className === 'ScreenGui') return [edit(id, { Enabled: visible }, undefined)];
      return inst && isGui(inst) ? [edit(id, { Visible: visible }, this.breakpointFor(id))] : [];
    });
    if (cmds.length) this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds));
  }

  /**
   * Rewrites Position and Size of the selection and everything inside it as pure Scale or pure
   * Offset, keeping every object where it is on the device shown.
   */
  convertUnits(toScale: boolean) {
    const doc = this.doc;
    const scene = this.scene;
    const roots = this.#targets().filter(
      (inst) => isGui(inst) || ['ScreenGui', 'Page', 'Folder'].includes(inst.className),
    );
    if (!roots.length) return this.toast('Select an object to convert.');
    const cmds: Command[] = [];
    for (const id of roots.flatMap((r) => subtreeIds(doc, r.id))) {
      const c = getInstance(doc, id);
      const b = scene.layout.get(id);
      if (!c || !isGui(c) || !b || (toScale && (b.area.w <= 0 || b.area.h <= 0))) continue;
      const bp = this.breakpointFor(id);
      const p = resolveProps(doc, c, bp);
      const { w, h } = b.area;
      const write = (u: UDim2): UDim2 => {
        const x = u[0] * w + u[1];
        const y = u[2] * h + u[3];
        return toScale
          ? [roundTo(x / w, 4), 0, roundTo(y / h, 4), 0]
          : [0, Math.round(x), 0, Math.round(y)];
      };
      cmds.push(edit(id, { Position: write(p.Position), Size: write(p.Size) }, bp));
    }
    if (!cmds.length || !this.#execute(batch(...cmds))) return;
    const n = cmds.length;
    this.toast(
      `Rewrote ${n} object${n === 1 ? '' : 's'} in ${toScale ? 'percent' : 'pixels'}. Switch devices to see the difference.`,
    );
  }

  /** Adds a picture to the image library; returns its id, or null when it isn't a picture. */
  #addPicture(dataUrl: string) {
    try {
      const added = addAsset(this.#state.assets, dataUrl);
      if (added.assets !== this.#state.assets) this.#update({ assets: added.assets });
      return added.id;
    } catch {
      this.toast('That file isn’t a picture Framecraft can use.');
      return null;
    }
  }

  /**
   * Shows a picture in an ImageLabel or ImageButton, or removes it with null. The export keeps
   * the Image id. A one-color SVG comes in white, so an ImageColor3 still at white turns
   * black to keep it looking as it did.
   */
  setImagePreview(id: InstanceId, picture: string | Pick<Picture, 'dataUrl' | 'recolor'> | null) {
    const pic: Pick<Picture, 'dataUrl' | 'recolor'> | null =
      typeof picture === 'string' ? { dataUrl: picture } : picture;
    const asset = pic === null ? null : this.#addPicture(pic.dataUrl);
    if (pic !== null && asset === null) return;
    const inst = getInstance(this.doc, id);
    const recolor =
      pic?.recolor &&
      (inst?.className === 'ImageLabel' || inst?.className === 'ImageButton') &&
      !isTinted(inst.props.ImageColor3);
    this.#execute(
      recolor
        ? batch(setPreview(id, asset), edit(id, { ImageColor3: [0, 0, 0] }, undefined))
        : setPreview(id, asset),
    );
  }

  /** Sets a picture property such as a page's SocialImage, or clears it with null. */
  setPicture(id: InstanceId, key: string, dataUrl: string | null) {
    const asset = dataUrl === null ? '' : this.#addPicture(dataUrl);
    if (asset !== null) this.setProp(id, key, asset);
  }

  /**
   * Opens another project in place of this one. The undo history starts over, so the toast
   * offers to bring the previous project back.
   */
  openProject(project: Project, message: string) {
    const before = { doc: this.doc, assets: this.#state.assets };
    this.#load(project);
    this.toast(message, {
      label: 'Undo',
      run: () => {
        this.#load(before);
        this.toast('Your previous project is back.');
      },
    });
  }

  #load(project: Project) {
    this.#drag = null;
    this.history.reset(project.doc);
    const firstPage = pagesOf(project.doc)[0];
    this.#update({
      assets: project.assets,
      selection: null,
      selected: [],
      hover: null,
      renaming: null,
      gesture: null,
      preview: false,
      zoom: null,
      pageDevice: DESKTOP.id,
      view: firstPage ? { kind: 'page', pageId: firstPage.id } : SCREENS,
      expanded: initialExpanded(project.doc),
    });
  }

  /**
   * In preview, a click on a linked object goes where it points. A page link shows that page
   * (and scrolls to the section); an outside address is returned for the caller to open.
   */
  followLink(id: InstanceId): { url: string; newTab: boolean } | null {
    const doc = this.doc;
    let inst = getInstance(doc, id);
    while (inst && isGui(inst)) {
      const link = inst.props.Link;
      if (link && inst.className !== 'TextBox') {
        if (link.kind === 'url') return { url: link.url, newTab: !!link.newTab };
        const page = getInstance(doc, link.page);
        if (page?.className !== 'Page') return null;
        this.setView({ kind: 'page', pageId: page.id });
        const name = link.section === undefined ? '' : slug(link.section);
        const target = name
          ? subtreeIds(doc, page.id).find((i) => {
              const c = getInstance(doc, i);
              return c && isGui(c) && slug(c.props.Name) === name;
            })
          : undefined;
        this.#update({ reveal: { id: target ?? page.id, seq: ++this.#seq } });
        return null;
      }
      inst = inst.parent === null ? undefined : getInstance(doc, inst.parent);
    }
    return null;
  }
}
