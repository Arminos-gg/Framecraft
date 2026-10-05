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
import { textVersion } from '../layout/text.ts';
import { addAsset, type Assets } from '../model/assets.ts';
import { canParent, classDef, isOverridable, type ClassName } from '../model/classes.ts';
import { batch, insert, move, remove, setPreview, type Command } from '../model/commands.ts';
import {
  childOfClass,
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
import type { Project } from '../model/project.ts';
import { roundTo } from '../export/format.ts';
import type { UDim2 } from '../model/values.ts';
import { DESKTOP, pageDevices, SCREEN_DEVICES, type Device } from './devices.ts';
import { hasModifier, insertParent, newSubtree } from './insert.ts';
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
  /** A button in the toast, such as Undo after opening another project. */
  readonly action?: { readonly label: string; readonly run: () => void };
}

/** Autosave, as the app bar shows it. `idle` until something saves the project. */
export type SaveStatus = 'idle' | 'pending' | 'saved' | 'off';

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
  /** Explorer rows that are open. */
  readonly expanded: ReadonlySet<InstanceId>;
  /** The Explorer row whose name is being edited. */
  readonly renaming: InstanceId | null;
  readonly saveStatus: SaveStatus;
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

/** The whole device shown, as a rectangle at the origin. */
const rectOf = (scene: Scene) => ({ x: 0, y: 0, w: scene.device.width, h: scene.device.height });

const sameView = (a: View, b: View) =>
  a.kind === b.kind && (a.kind === 'screens' || a.pageId === (b as typeof a).pageId);

let sceneCache: { key: readonly unknown[]; scene: Scene } | null = null;

/** Lays out what the viewport shows. Cached, so calling it on every render is cheap. */
export function sceneOf(
  state: Pick<EditorState, 'doc' | 'view' | 'screenDevice' | 'pageDevice'>,
): Scene {
  const key = [state.doc, state.view, state.screenDevice, state.pageDevice, textVersion()];
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
      expanded: initialExpanded(doc),
      renaming: null,
      saveStatus: 'idle',
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
    this.#update({
      doc,
      selection: alive(this.#state.selection),
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

  toast(text: string, action?: Toast['action']) {
    const toast: Toast = action ? { id: ++this.#seq, text, action } : { id: ++this.#seq, text };
    this.#update({ toast });
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(
      () => {
        if (this.#state.toast === toast) this.#update({ toast: null });
      },
      action ? 6000 : 2600,
    );
  }
  dismissToast() {
    if (this.#state.toast) this.#update({ toast: null });
  }

  /**
   * Selects an object (or nothing), shows the view it's drawn in, and opens its ancestors in
   * the Explorer.
   */
  select(id: InstanceId | null) {
    const doc = this.doc;
    const target = id !== null && getInstance(doc, id) ? id : null;
    const view = target === null ? undefined : viewOf(doc, target);
    let expanded = this.#state.expanded;
    for (let p = target === null ? null : getInstance(doc, target)!.parent; p !== null;) {
      if (!expanded.has(p)) expanded = new Set(expanded).add(p);
      p = getInstance(doc, p)?.parent ?? null;
    }
    this.#update({
      selection: target,
      expanded,
      view: view && !sameView(view, this.#state.view) ? view : this.#state.view,
    });
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

  /** Drops the shown breakpoint's own value, so the property inherits again. */
  resetProp(id: InstanceId, key: string) {
    const bp = this.breakpointFor(id);
    if (bp !== undefined)
      this.#execute({ type: 'setProps', id, props: {}, breakpoint: bp, clear: [key] });
  }

  /** Edits between these (a slider, the color picker) are one undo step. */
  beginGesture() {
    if (!this.history.inGroup) this.history.begin();
  }
  endGesture() {
    if (this.history.inGroup && !this.#drag) this.history.commit();
  }

  /** Objects, layers, modifiers and breakpoints can be renamed; services and the root can't. */
  canRename(id: InstanceId): boolean {
    const inst = getInstance(this.doc, id);
    const kind = inst && classDef(inst.className).kind;
    return kind === 'gui' || kind === 'container' || kind === 'modifier' || kind === 'setting';
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
    const subtree = newSubtree(this.doc, className, parent, area);
    cmds.push(insert(parent.id, subtree));
    if (!this.#execute(cmds.length === 1 ? cmds[0]! : batch(...cmds))) return null;
    this.select(subtree.rootId);
    return subtree.rootId;
  }

  /** Reparents or reorders: `index` is the place among the new parent's other children. */
  moveTo(id: InstanceId, parentId: InstanceId, index?: number) {
    if (this.#execute(move(id, parentId, index))) this.select(id);
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

  /**
   * Rewrites Position and Size of the selection and everything inside it as pure Scale or pure
   * Offset, keeping every object where it is on the device shown.
   */
  convertUnits(toScale: boolean) {
    const doc = this.doc;
    const scene = this.scene;
    const inst = this.#selected();
    if (!inst || !(isGui(inst) || inst.className === 'ScreenGui' || inst.className === 'Page'))
      return this.toast('Select an object to convert.');
    const cmds: Command[] = [];
    for (const id of subtreeIds(doc, inst.id)) {
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
      `Rewrote ${n} object${n === 1 ? '' : 's'} as ${toScale ? 'Scale' : 'Offset'}. Switch devices to see the difference.`,
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

  /** Shows a picture in an ImageLabel or ImageButton, or removes it with null. The export keeps the Image id. */
  setImagePreview(id: InstanceId, dataUrl: string | null) {
    const asset = dataUrl === null ? null : this.#addPicture(dataUrl);
    if (dataUrl !== null && asset === null) return;
    this.#execute(setPreview(id, asset));
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
