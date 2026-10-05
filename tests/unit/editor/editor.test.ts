import { beforeEach, describe, expect, it } from 'vitest';
import { Editor, LIST_PLACES, sceneOf } from '../../../src/editor/editor.ts';
import { breakpointsOf, type AnyInstance, type InstanceId } from '../../../src/model/document.ts';
import { sampleProject } from '../../../src/model/sample.ts';

let ed: Editor;
beforeEach(() => {
  ed = new Editor(sampleProject());
});

const byName = (name: string): AnyInstance => {
  const inst = Object.values(ed.doc.instances).find((i) => i.props.Name === name);
  if (!inst) throw new Error(`No ${name}`);
  return inst;
};
const id = (name: string): InstanceId => byName(name).id;
const props = (name: string) => byName(name).props as Record<string, unknown>;
const phone = () => breakpointsOf(ed.doc).find((b) => b.props.Name === 'Phone')!.id;
/** The middle of an object, in device pixels. */
const middle = (name: string) => {
  const b = ed.scene.layout.get(id(name))!;
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};
const dragBy = (name: string, dx: number, dy: number, mods = {}) => {
  const p = middle(name);
  ed.startDrag('move', id(name), p);
  ed.dragTo({ x: p.x + dx, y: p.y + dy }, { zoom: 1, ...mods });
  ed.endDrag();
};

describe('views', () => {
  it('starts on the first page at Desktop, as long as its content', () => {
    const scene = ed.scene;
    expect(scene.view).toEqual({ kind: 'page', pageId: id('Home') });
    expect([scene.width, scene.height]).toEqual([1366, 768]);
    expect(scene.breakpoint).toBeUndefined();
    expect(sceneOf(ed.state)).toBe(scene);
  });

  it('shows the view of whatever gets selected', () => {
    ed.select(id('Coins'));
    expect(ed.scene.view).toEqual({ kind: 'screens' });
    expect(ed.scene.roots).toEqual([id('MainMenu')]);
    ed.select(id('Headline'));
    expect(ed.scene.view).toEqual({ kind: 'page', pageId: id('Home') });
  });

  it('clears a selection the new view does not draw', () => {
    ed.select(id('Headline'));
    ed.setView({ kind: 'screens' });
    expect(ed.state.selection).toBeNull();
  });

  it('offers a device per breakpoint on pages, and edits that breakpoint', () => {
    expect(ed.scene.devices.map((d) => d.label)).toEqual([
      'Desktop · 1366×768',
      'Tablet · 810×1080',
      'Phone · 390×844',
    ]);
    ed.setDevice(phone());
    expect(ed.scene.breakpoint).toBe(phone());
    expect([ed.scene.width, ed.scene.device.height]).toEqual([390, 844]);
  });
});

describe('dragging', () => {
  beforeEach(() => ed.select(id('Coins')));

  it('moves an object in its own units, as one undo step', () => {
    dragBy('Coins', -30, 10);
    expect(props('Coins').Position).toEqual([1, -50, 0, 30]);
    expect(ed.state.canUndo).toBe(true);
    ed.undo();
    expect(props('Coins').Position).toEqual([1, -20, 0, 20]);
    expect(ed.state.canUndo).toBe(false);
  });

  it('shows the gesture while it lasts', () => {
    const p = middle('Coins');
    ed.startDrag('move', id('Coins'), p);
    ed.dragTo({ x: p.x + 20, y: p.y + 40 }, { zoom: 1 });
    expect(ed.state.gesture).toMatchObject({ id: id('Coins'), kind: 'move' });
    ed.endDrag();
    expect(ed.state.gesture).toBeNull();
  });

  it('ignores tiny movements, and a click picks the child under the cursor', () => {
    const p = middle('Coins');
    ed.startDrag('move', id('Coins'), p, { clickId: id('Amount') });
    ed.dragTo({ x: p.x + 2, y: p.y }, { zoom: 1 });
    ed.endDrag();
    expect(props('Coins').Position).toEqual([1, -20, 0, 20]);
    expect(ed.state.selection).toBe(id('Amount'));
    expect(ed.state.canUndo).toBe(false);
  });

  it('snaps unless Alt is held or snapping is off', () => {
    dragBy('Coins', 17, 0);
    expect(props('Coins').Position).toEqual([1, 0, 0, 20]);
    ed.undo();
    dragBy('Coins', 17, 0, { alt: true });
    expect(props('Coins').Position).toEqual([1, -3, 0, 20]);
    ed.undo();
    ed.setSnap(false);
    dragBy('Coins', 17, 0);
    expect(props('Coins').Position).toEqual([1, -3, 0, 20]);
  });

  it('reaches further for snapping when zoomed out', () => {
    const p = middle('Coins');
    ed.startDrag('move', id('Coins'), p);
    ed.dragTo({ x: p.x + 10, y: p.y }, { zoom: 0.5 });
    ed.endDrag();
    expect(props('Coins').Position).toEqual([1, 0, 0, 20]);
  });

  it('writes Scale when asked', () => {
    ed.setUnit('scale');
    dragBy('Coins', -30, 0);
    expect(props('Coins').Position).toEqual([0.978, -20, 0, 20]);
  });

  it('resizes from a handle and keeps the AnchorPoint side in place', () => {
    const b = ed.scene.layout.get(id('Coins'))!;
    const east = { x: b.x + b.w, y: b.y + b.h / 2 };
    ed.startDrag('resize', id('Coins'), east, { handle: 'e' });
    ed.dragTo({ x: east.x + 40, y: east.y }, { zoom: 1, alt: true });
    ed.endDrag();
    // The left edge stays, so a right-anchored Position moves with the right edge.
    expect(props('Coins').Size).toEqual([0, 216, 0, 52]);
    expect(props('Coins').Position).toEqual([1, 20, 0, 20]);
  });

  it('won’t move an object a UIListLayout places', () => {
    const before = ed.doc;
    dragBy('PlayButton', 30, 30);
    expect(ed.doc).toBe(before);
    expect(ed.state.toast?.text).toBe(LIST_PLACES);
    expect(ed.state.canUndo).toBe(false);
  });

  it('cancels the drag on undo', () => {
    const p = middle('Coins');
    ed.startDrag('move', id('Coins'), p);
    ed.dragTo({ x: p.x - 50, y: p.y }, { zoom: 1 });
    ed.undo();
    expect(props('Coins').Position).toEqual([1, -20, 0, 20]);
    expect(ed.dragging).toBe(false);
  });
});

describe('breakpoints', () => {
  it('changes only the breakpoint shown', () => {
    ed.setDevice(phone());
    ed.select(id('Headline'));
    dragBy('Headline', 0, 40);
    const headline = byName('Headline');
    expect(props('Headline').Position).toEqual([0.5, 0, 0.42, 0]);
    const changed = headline.overrides?.[phone()] as Record<string, unknown>;
    // The hero is 844 - 60 px tall on a phone; Auto keeps Scale as Scale.
    expect(changed.Position).toEqual([0.5, 0, 0.471, 0]);

    ed.nudge(5, 0);
    expect((byName('Headline').overrides?.[phone()] as Record<string, unknown>).Position).toEqual([
      0.5128, 0, 0.471, 0,
    ]);
    expect(props('Headline').Position).toEqual([0.5, 0, 0.42, 0]);
  });
});

describe('keyboard actions', () => {
  it('nudges by whole pixels', () => {
    ed.select(id('Coins'));
    ed.nudge(1, 0);
    ed.nudge(0, 10);
    expect(props('Coins').Position).toEqual([1, -19, 0, 30]);
    ed.select(id('PlayButton'));
    ed.nudge(1, 0);
    expect(ed.state.toast?.text).toBe(LIST_PLACES);
  });

  it('deletes and selects the parent, but never a service', () => {
    ed.select(id('Amount'));
    ed.deleteSelection();
    expect(Object.values(ed.doc.instances).some((i) => i.props.Name === 'Amount')).toBe(false);
    expect(ed.state.selection).toBe(id('Coins'));
    const before = ed.doc;
    ed.select(id('StarterGui'));
    ed.deleteSelection();
    expect(ed.doc).toBe(before);
  });

  it('duplicates next to the original, a little offset, as one step', () => {
    ed.select(id('Coins'));
    const count = Object.keys(ed.doc.instances).length;
    ed.duplicateSelection();
    const copy = ed.state.selection!;
    expect(copy).not.toBe(id('Coins'));
    expect(ed.doc.instances[copy]!.props).toMatchObject({
      Name: 'Coins',
      Position: [1, -8, 0, 32],
    });
    expect(Object.keys(ed.doc.instances).length).toBe(count + 8);
    const parent = ed.doc.instances[id('MainMenu')]!;
    expect(parent.children.indexOf(copy)).toBe(parent.children.indexOf(id('Coins')) + 1);
    ed.undo();
    expect(Object.keys(ed.doc.instances).length).toBe(count);
  });

  it('pastes into the nearest object that can hold the copy', () => {
    ed.paste();
    expect(ed.state.toast?.text).toBe('Copy something first (Ctrl+C).');
    ed.select(id('Coins'));
    ed.copySelection();
    ed.select(null);
    ed.setView({ kind: 'screens' });
    ed.paste();
    const pasted = ed.doc.instances[ed.state.selection!]!;
    expect(pasted.parent).toBe(id('MainMenu'));
    // Cut a modifier, then paste it onto another object.
    ed.select(id('Coins'));
    const corner = ed.doc.instances[id('Coins')]!.children.find(
      (c) => ed.doc.instances[c]!.className === 'UICorner',
    )!;
    ed.select(corner);
    ed.copySelection(true);
    expect(ed.doc.instances[corner]).toBeUndefined();
    ed.select(id('Version'));
    ed.paste();
    expect(ed.doc.instances[ed.state.selection!]!.parent).toBe(id('Version'));
  });
});

describe('preview links', () => {
  it('goes to the linked page and section, or hands back an outside address', () => {
    expect(ed.followLink(id('Subscribe'))).toBeNull();
    expect(ed.scene.view).toEqual({ kind: 'page', pageId: id('Pricing') });
    expect(ed.state.reveal?.id).toBe(id('Plans'));

    const logo = byName('Logo');
    ed.history.execute({
      type: 'setProps',
      id: logo.id,
      props: { Link: { kind: 'url', url: 'https://example.com', newTab: true } },
    });
    expect(ed.followLink(logo.id)).toEqual({ url: 'https://example.com', newTab: true });
    expect(ed.followLink(id('Hero'))).toBeNull();
  });
});
