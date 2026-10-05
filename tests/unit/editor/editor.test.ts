import { beforeEach, describe, expect, it } from 'vitest';
import { Editor, LIST_PLACES, sceneOf } from '../../../src/editor/editor.ts';
import { breakpointsOf, type AnyInstance, type InstanceId } from '../../../src/model/document.ts';
import { blankSiteDoc, sampleProject } from '../../../src/model/sample.ts';

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

describe('inserting', () => {
  it('puts a new object in the middle of the selection, nudged past the last one', () => {
    ed.select(id('MainMenu'));
    const first = ed.insert('Frame')!;
    const inst = ed.doc.instances[first]!;
    expect(inst.parent).toBe(id('MainMenu'));
    expect(ed.state.selection).toBe(first);
    // 1366 x 768, a 200 x 140 Frame, and MainMenu already holds Coins, Panel and Version.
    const nudge = 12 * 3;
    expect(inst.props).toMatchObject({ Position: [0, 583 + nudge, 0, 314 + nudge] });
    ed.undo();
    expect(ed.doc.instances[first]).toBeUndefined();
  });

  it('goes up to the nearest object that can hold it', () => {
    const corner = ed.doc.instances[id('Coins')]!.children.find(
      (c) => ed.doc.instances[c]!.className === 'UICorner',
    )!;
    ed.select(corner);
    const label = ed.insert('TextLabel')!;
    expect(ed.doc.instances[label]!.parent).toBe(id('Coins'));
    ed.select(id('Coins'));
    const layer = ed.insert('ScreenGui')!;
    expect(ed.doc.instances[layer]!.parent).toBe(id('StarterGui'));
  });

  it('fills the width of a page, where a UIListLayout stacks the sections', () => {
    ed.select(null);
    const section = ed.insert('Frame')!;
    const inst = ed.doc.instances[section]!;
    expect(inst.parent).toBe(id('Home'));
    expect(inst.props).toMatchObject({ Size: [1, 0, 0, 320], Position: [0, 0, 0, 0] });
  });

  it('adds pages with names and paths of their own, and shows them', () => {
    const page = ed.insert('Page')!;
    expect(ed.doc.instances[page]!.props).toMatchObject({ Name: 'Page', Path: '/page' });
    expect(ed.scene.view).toEqual({ kind: 'page', pageId: page });
    const second = ed.insert('Page')!;
    expect(ed.doc.instances[second]!.props).toMatchObject({ Name: 'Page2', Path: '/page-2' });
  });

  it('makes a ScreenGui to hold the first object on empty screens, in one step', () => {
    ed = new Editor(blankSiteDoc());
    ed.setView({ kind: 'screens' });
    const frame = ed.insert('Frame')!;
    const layer = ed.doc.instances[ed.doc.instances[frame]!.parent!]!;
    expect(layer.className).toBe('ScreenGui');
    ed.undo();
    expect(Object.values(ed.doc.instances).some((i) => i.className === 'ScreenGui')).toBe(false);
  });

  it('adds a modifier to the selection, once, except UIStroke', () => {
    ed.insert('UICorner');
    expect(ed.state.toast?.text).toBe('Select a Frame, label, button or image first.');
    ed.select(id('Coins'));
    const before = ed.doc;
    ed.insert('UICorner');
    expect(ed.doc).toBe(before);
    expect(ed.state.toast?.text).toBe('Coins already has a UICorner.');
    expect(ed.doc.instances[ed.state.selection!]!.className).toBe('UICorner');
    ed.select(id('Coins'));
    const stroke = ed.insert('UIStroke')!;
    expect(ed.doc.instances[stroke]!.props).toMatchObject({ Thickness: 2 });
    ed.select(id('Coins'));
    const padding = ed.insert('UIPadding')!;
    expect(ed.doc.instances[padding]!.props).toMatchObject({ PaddingTop: [0, 8] });
  });
});

describe('editing properties', () => {
  it('changes the breakpoint shown for properties that may differ, and the base for the rest', () => {
    ed.setDevice(phone());
    ed.select(id('Headline'));
    expect(ed.setProp(id('Headline'), 'TextSize', 30)).toBe(true);
    expect(ed.setProp(id('Headline'), 'Text', 'Fresh coffee')).toBe(true);
    const headline = byName('Headline');
    expect((headline.overrides?.[phone()] as Record<string, unknown>).TextSize).toBe(30);
    expect(props('Headline').Text).toBe('Fresh coffee');
    expect(props('Headline').TextSize).not.toBe(30);

    ed.resetProp(id('Headline'), 'TextSize');
    expect(byName('Headline').overrides?.[phone()]).not.toHaveProperty('TextSize');
  });

  it('refuses invalid values with a toast', () => {
    expect(ed.setProp(id('Coins'), 'Size', [1, 2])).toBe(false);
    expect(ed.state.toast?.text).toMatch(/can't take Size/);
  });

  it('makes a gesture one undo step', () => {
    ed.beginGesture();
    for (const t of [0.2, 0.4, 0.6]) ed.setProp(id('Coins'), 'BackgroundTransparency', t);
    ed.endGesture();
    expect(props('Coins').BackgroundTransparency).toBe(0.6);
    ed.undo();
    expect(props('Coins').BackgroundTransparency).not.toBe(0.2);
    expect(ed.state.canUndo).toBe(false);
  });

  it('renames objects but not services, and keeps the old name for a blank one', () => {
    ed.startRename(id('Coins'));
    expect(ed.state.renaming).toBe(id('Coins'));
    ed.endRename('  Gold  ');
    expect(ed.state.renaming).toBeNull();
    expect(Object.values(ed.doc.instances).some((i) => i.props.Name === 'Gold')).toBe(true);
    ed.startRename(id('Gold'));
    ed.endRename('   ');
    expect(byName('Gold')).toBeDefined();
    ed.startRename(id('StarterGui'));
    expect(ed.state.renaming).toBeNull();
  });

  it('reparents from the Explorer', () => {
    ed.moveTo(id('Version'), id('Panel'));
    expect(ed.doc.instances[id('Version')]!.parent).toBe(id('Panel'));
    expect(ed.state.selection).toBe(id('Version'));
    ed.moveTo(id('Panel'), id('Version'));
    expect(ed.state.toast?.text).toMatch(/can't go inside itself/);
  });

  it('hides an object at the breakpoint shown, and a ScreenGui everywhere', () => {
    ed.setDevice(phone());
    ed.toggleVisible(id('Headline'));
    expect((byName('Headline').overrides?.[phone()] as Record<string, unknown>).Visible).toBe(
      false,
    );
    expect(props('Headline').Visible).toBe(true);
    ed.toggleVisible(id('MainMenu'));
    expect(props('MainMenu').Enabled).toBe(false);
  });

  it('opens the ancestors of the selection in the Explorer', () => {
    ed.select(id('Amount'));
    expect(ed.state.expanded.has(id('Coins'))).toBe(true);
    expect(ed.state.expanded.has(id('MainMenu'))).toBe(true);
    ed.setExpanded(id('Coins'));
    expect(ed.state.expanded.has(id('Coins'))).toBe(false);
  });
});

describe('converting units', () => {
  it('rewrites the selection as Scale or Offset without moving it', () => {
    ed.select(id('MainMenu'));
    const frame = ed.insert('Frame')!;
    ed.setProp(frame, 'Size', [0.25, 40, 0.1, 20]);
    ed.convertUnits(true);
    const size = ed.doc.instances[frame]!.props as Record<string, unknown>;
    expect(size.Size).toEqual([0.2793, 0, 0.126, 0]);
    ed.convertUnits(false);
    expect((ed.doc.instances[frame]!.props as Record<string, unknown>).Size).toEqual([
      0, 382, 0, 97,
    ]);
  });
});

describe('pictures and projects', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';

  it('keeps a preview picture in the image library', () => {
    ed.select(id('MainMenu'));
    const image = ed.insert('ImageLabel')!;
    ed.setImagePreview(image, png);
    const asset = ed.doc.instances[image]!.preview!;
    expect(ed.state.assets[asset]).toBe(png);
    ed.setImagePreview(image, null);
    expect(ed.doc.instances[image]!.preview).toBeUndefined();
    ed.setImagePreview(image, 'data:text/plain;base64,aGk=');
    expect(ed.state.toast?.text).toBe('That file isn’t a picture Framecraft can use.');
  });

  it('sets a picture property such as a page’s social image', () => {
    ed.setPicture(id('Home'), 'SocialImage', png);
    const asset = props('Home').SocialImage as string;
    expect(ed.state.assets[asset]).toBe(png);
    ed.setPicture(id('Home'), 'SocialImage', null);
    expect(props('Home').SocialImage).toBe('');
  });

  it('opens another project, and the toast brings the old one back', () => {
    const old = ed.doc;
    ed.select(id('Coins'));
    ed.openProject({ doc: blankSiteDoc(), assets: {} }, 'Started a blank project.');
    expect(ed.state.selection).toBeNull();
    expect(ed.state.canUndo).toBe(false);
    expect(ed.state.toast?.text).toBe('Started a blank project.');
    ed.state.toast!.action!.run();
    expect(ed.doc).toBe(old);
  });
});
