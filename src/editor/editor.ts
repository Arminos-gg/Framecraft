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
import { isGui, type Backdrop } from '../export/html.ts';
import {
  ancestorAngle,
  layoutContainer,
  layoutScreenGuis,
  screenQuad,
  type Box,
  type Layout,
} from '../layout/layout.ts';
import type { Assets } from '../model/assets.ts';
import { canParent, classDef } from '../model/classes.ts';
import { batch, insert, remove, type Command } from '../model/commands.ts';
import {
  childrenOf,
  extractSubtree,
  getInstance,
  ModelError,
  reIdSubtree,
  resolveProps,
  serviceOf,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type InstanceId,
  type Subtree,
} from '../model/document.ts';
import { History } from '../model/history.ts';
import type { UDim2 } from '../model/values.ts';
import { DESKTOP, pageDevices, SCREEN_DEVICES, type Device } from './devices.ts';
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

export interface Toast {
  readonly id: number;
  readonly text: string;
}

export interface EditorState {
  readonly doc: Doc;
  readonly assets: Assets;
  readonly selection: InstanceId | null;
  readonly hover: InstanceId | null;
  readonly view: View;
  /** The device for Roblox screens, from SCREEN_DEVICES. */
  readonly screenDevice: string;
  /** The device for pages: 'desktop' or a breakpoint's id. */
  readonly pageDevice: string;
  /** Viewport zoom; null fits the screen to the viewport. */
  readonly zoom: number | null;
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
  active: boolean;
  warned: boolean;
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

const sameView = (a: View, b: View) =>
  a.kind === b.kind && (a.kind === 'screens' || a.pageId === (b as typeof a).pageId);

let sceneCache: { key: readonly unknown[]; scene: Scene } | null = null;

/** Lays out what the viewport shows. Cached, so calling it on every render is cheap. */
export function sceneOf(
  state: Pick<EditorState, 'doc' | 'view' | 'screenDevice' | 'pageDevice'>,
): Scene {
  const key = [state.doc, state.view, state.screenDevice, state.pageDevice];
  if (sceneCache && sceneCache.key.every((k, i) => k === key[i])) return sceneCache.scene;
  const scene = buildScene(state);
  sceneCache = { key, scene };
  return scene;
}

function buildScene(
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
  #clipboard: Subtree | null = null;
  #toastTimer: ReturnType<typeof setTimeout> | undefined;
  #seq = 0;

  constructor(doc: Doc, options: EditorOptions = {}) {
    this.history = new History(doc);
    const firstPage = pagesOf(doc)[0];
    this.#state = {
      doc,
      assets: options.assets ?? {},
      selection: null,
      hover: null,
      view: options.view ?? (firstPage ? { kind: 'page', pageId: firstPage.id } : SCREENS),
      screenDevice: SCREEN_DEVICES[0]!.id,
      pageDevice: DESKTOP.id,
      zoom: null,
      preview: false,
      unit: 'auto',
      snap: true,
      backdrop: 'game',
      canUndo: false,
      canRedo: false,
      gesture: null,
      toast: null,
      reveal: null,
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
    this.#update({ doc, selection: alive(this.#state.selection), hover: alive(this.#state.hover) });
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

  toast(text: string) {
    const toast = { id: ++this.#seq, text };
    this.#update({ toast });
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => {
      if (this.#state.toast === toast) this.#update({ toast: null });
    }, 2600);
  }

  /** Selects an object (or nothing) and shows the view it's drawn in. */
  select(id: InstanceId | null) {
    const doc = this.doc;
    const target = id !== null && getInstance(doc, id) ? id : null;
    const view = target === null ? undefined : viewOf(doc, target);
    this.#update({
      selection: target,
      view: view && !sameView(view, this.#state.view) ? view : this.#state.view,
    });
  }

  setHover(id: InstanceId | null) {
    if (id !== this.#state.hover) this.#update({ hover: id });
  }

  /** Shows the screens or a page. A selection that isn't drawn there is cleared. */
  setView(view: View) {
    if (sameView(view, this.#state.view)) return;
    const sel = this.#state.selection;
    const selView = sel === null ? undefined : viewOf(this.doc, sel);
    const keep = selView !== undefined && sameView(selView, view);
    this.#update({ view, hover: null, selection: keep ? sel : null, zoom: null });
  }

  /** Picks the device for the current view, and fits it to the viewport. */
  setDevice(id: string) {
    const patch = this.scene.view.kind === 'page' ? { pageDevice: id } : { screenDevice: id };
    this.#update({ ...patch, zoom: null });
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
  setBackdrop(backdrop: Backdrop) {
    this.#update({ backdrop });
  }

  undo() {
    this.#drag = null;
    this.history.undo();
    this.#update({ gesture: null });
  }
  redo() {
    this.history.redo();
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
    const siblings =
      inst.parent === null
        ? []
        : childrenOf(doc, inst.parent).flatMap((s) =>
            s.id !== id && isGui(s) ? (scene.layout.get(s.id) ?? []) : [],
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
    let guides: readonly Guide[];
    if (d.kind === 'move') {
      if (d.parentAngle) [dx, dy] = rotate(dx, dy, -d.parentAngle);
      const canSnap = snap && !d.parentAngle && !d.box.rotation;
      const m = moveRect(d.box, dx, dy, canSnap ? d.targets : null, threshold);
      props.Position = positionFor(d.position, d.anchor, d.box.area, m.rect, unit);
      guides = m.guides;
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
    this.#execute(edit(d.id, props, d.breakpoint));
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
    const inst = this.#selected();
    const scene = this.scene;
    const box = inst && scene.layout.get(inst.id);
    if (!inst || !isGui(inst) || !box) return;
    if (box.listItem) return this.toast(LIST_PLACES);
    const p = resolveProps(this.doc, inst, scene.breakpoint);
    const rect = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
    const Position = positionFor(p.Position, p.AnchorPoint, box.area, rect, this.#state.unit);
    this.#execute(edit(inst.id, { Position }, scene.breakpoint));
  }

  /** Objects, layers and modifiers can be copied and deleted; services and the root can't. */
  #editable(inst: AnyInstance | undefined): inst is AnyInstance {
    if (!inst) return false;
    const kind = classDef(inst.className).kind;
    return kind === 'gui' || kind === 'container' || kind === 'modifier';
  }

  deleteSelection() {
    const inst = this.#selected();
    if (!this.#editable(inst)) return;
    const parent = inst.parent === null ? undefined : getInstance(this.doc, inst.parent);
    const name = inst.props.Name;
    if (!this.#execute(remove(inst.id))) return;
    const kind = parent && classDef(parent.className).kind;
    this.select(parent && (kind === 'gui' || kind === 'container') ? parent.id : null);
    this.toast(`Deleted ${name}`);
  }

  duplicateSelection() {
    const inst = this.#selected();
    if (!this.#editable(inst) || inst.parent === null) return;
    const doc = this.doc;
    const parent = getInstance(doc, inst.parent)!;
    const copy = reIdSubtree(extractSubtree(doc, inst.id));
    const cmds: Command[] = [insert(parent.id, copy, parent.children.indexOf(inst.id) + 1)];
    // Offset the copy a little so it doesn't hide the original.
    const scene = this.scene;
    const box = scene.layout.get(inst.id);
    if (isGui(inst) && box && !box.listItem) {
      const pos = resolveProps(doc, inst, scene.breakpoint).Position;
      const Position = [pos[0], pos[1] + 12, pos[2], pos[3] + 12];
      cmds.push(edit(copy.rootId, { Position }, scene.breakpoint));
    }
    if (!this.#execute(batch(...cmds))) return;
    this.select(copy.rootId);
    this.toast(`Duplicated ${inst.props.Name}`);
  }

  copySelection(cut = false) {
    const inst = this.#selected();
    if (!this.#editable(inst)) return;
    this.#clipboard = extractSubtree(this.doc, inst.id);
    if (cut) this.deleteSelection();
    else this.toast(`Copied ${inst.props.Name}`);
  }

  /** Pastes into the selection, or the nearest ancestor that can hold the copy. */
  paste() {
    if (!this.#clipboard) return this.toast('Copy something first (Ctrl+C).');
    const doc = this.doc;
    const copy = reIdSubtree(this.#clipboard);
    const className = copy.instances[copy.rootId]!.className;
    let parent = this.#selected();
    while (parent && !canParent(className, parent.className))
      parent = parent.parent === null ? undefined : getInstance(doc, parent.parent);
    if (!parent) {
      const scene = this.scene;
      const fallback = [
        serviceOf(doc, 'StarterGui').id,
        serviceOf(doc, 'Site').id,
        scene.view.kind === 'page' ? scene.view.pageId : scene.roots[0],
      ];
      parent = fallback
        .flatMap((id) => (id === undefined ? [] : (getInstance(doc, id) ?? [])))
        .find((p) => canParent(className, p.className));
    }
    if (!parent) return this.toast('Add a ScreenGui first.');
    if (this.#execute(insert(parent.id, copy))) this.select(copy.rootId);
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
