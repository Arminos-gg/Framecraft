import { describe, expect, it } from 'vitest';
import prototypeBoxes from './prototype-boxes.json';
import {
  ancestorAngle,
  layoutContainer,
  layoutScreenGuis,
  screenQuad,
  type Layout,
  type Rect,
} from '../../../src/layout/layout.ts';
import type { ClassName, PropsOf } from '../../../src/model/classes.ts';
import { applyCommand, insert } from '../../../src/model/commands.ts';
import {
  breakpointForWidth,
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { byName, counterIds, sample, site } from '../model/helpers.ts';

const LAPTOP = { width: 1366, height: 768 };

/** Checks a box's position and size to 0.01 px, the precision the prototype's checks use. */
function expectRect(actual: Rect | undefined, expected: Partial<Rect>) {
  expect(actual).toBeDefined();
  for (const [k, v] of Object.entries(expected)) {
    expect(actual![k as keyof Rect], k).toBeCloseTo(v, 2);
  }
}

describe('the sample game menu at Laptop 1366×768', () => {
  const doc = sample();
  const layout = layoutContainer(doc, byName(doc, 'MainMenu').id, LAPTOP);
  const box = (name: string) => layout.get(byName(doc, name).id);

  // The numbers the prototype's smoke test checks in the browser.
  it('places the panel', () => {
    expectRect(box('Panel'), { x: 450.78, y: 107.52, w: 464.44, h: 552.96 });
  });

  it('places the coin counter and its icon', () => {
    expectRect(box('Coins'), { x: 1170, y: 20, w: 176, h: 52 });
    expectRect(box('CoinIcon'), { x: 1180, y: 29, w: 34, h: 34 });
  });

  it('places the button list inside the panel padding', () => {
    expectRect(box('Panel')!.content, { x: 474.78, y: 131.52, w: 416.44, h: 504.96 });
    expectRect(box('Buttons'), { y: 323.4 });
  });

  it('stacks the buttons from the bottom with a Scale gap', () => {
    expectRect(box('PlayButton'), { y: 342.19 });
    expectRect(box('ShopButton'), { y: 445.5 });
    expectRect(box('SettingsButton'), { y: 548.82 });
    expect(box('PlayButton')!.listItem).toBe(true);
    expect(box('Coins')!.listItem).toBe(false);
  });

  it('gives the ScreenGui the whole window', () => {
    expectRect(layout.get(byName(doc, 'MainMenu').id), { x: 0, y: 0, w: 1366, h: 768 });
  });
});

describe('the same numbers as the prototype', () => {
  const doc = sample();
  const devices = Object.entries(prototypeBoxes.devices);
  it.each(devices)('on %s', (_, device) => {
    const layout = layoutContainer(doc, byName(doc, 'MainMenu').id, device);
    const boxes = Object.entries(device.boxes);
    expect(layout.size).toBe(boxes.length);
    for (const [name, expected] of boxes) {
      const actual = layout.get(byName(doc, name).id)!;
      for (const k of ['x', 'y', 'w', 'h'] as const)
        expect(actual[k], `${name}.${k}`).toBeCloseTo(expected[k], 5);
      expect(actual.visible, name).toBe(expected.visible);
      expect(actual.listItem, name).toBe(expected.listItem);
    }
  });
});

/** A blank project with a ScreenGui, and helpers to add objects to it. */
function scene() {
  let doc: Doc = blankDoc(counterIds('s'));
  const screen = byName(doc, 'ScreenGui').id;
  let n = 0;
  const add = <C extends ClassName>(
    parent: InstanceId,
    className: C,
    props: Partial<PropsOf<C>> = {},
  ) => {
    const inst = createInstance(className, props, `o${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  return {
    screen,
    add,
    layout: (viewport = { width: 1000, height: 500 }): Layout =>
      layoutContainer(doc, screen, viewport),
    get doc() {
      return doc;
    },
  };
}

describe('UDim2 placement', () => {
  it('anchors at the bottom-right corner with AnchorPoint (1, 1)', () => {
    const s = scene();
    const id = s.add(s.screen, 'Frame', {
      AnchorPoint: [1, 1],
      Position: [1, 0, 1, 0],
      Size: [0, 200, 0, 100],
    });
    expectRect(s.layout().get(id), { x: 800, y: 400, w: 200, h: 100 });
  });

  it('mixes Scale and Offset, with negative offsets', () => {
    const s = scene();
    const id = s.add(s.screen, 'Frame', { Position: [0.5, -30, 0, -10], Size: [0.5, -40, 1, -60] });
    expectRect(s.layout().get(id), { x: 470, y: -10, w: 460, h: 440 });
  });

  it('never makes a box smaller than zero', () => {
    const s = scene();
    const id = s.add(s.screen, 'Frame', { Size: [0, -50, 0.1, -80] });
    expectRect(s.layout().get(id), { w: 0, h: 0 });
  });

  it('measures Scale against the parent, not the window', () => {
    const s = scene();
    const parent = s.add(s.screen, 'Frame', { Position: [0, 100, 0, 50], Size: [0, 400, 0, 200] });
    const child = s.add(parent, 'Frame', { Position: [0.5, 0, 0.5, 0], Size: [0.25, 0, 0.5, 0] });
    expectRect(s.layout().get(child), { x: 300, y: 150, w: 100, h: 100 });
  });

  it('ignores Rotation for the box but keeps it for drawing', () => {
    const s = scene();
    const parent = s.add(s.screen, 'Frame', { Size: [0, 200, 0, 200], Rotation: 90 });
    const child = s.add(parent, 'Frame', { Size: [0, 20, 0, 20], Rotation: 15 });
    const layout = s.layout();
    expectRect(layout.get(child), { x: 0, y: 0, w: 20, h: 20 });
    expect(layout.get(parent)!.rotation).toBe(90);
    // The child's center (10, 10) turns 90° around the parent's center (100, 100).
    const quad = screenQuad(s.doc, layout, child)!;
    expect(quad.cx).toBeCloseTo(190, 6);
    expect(quad.cy).toBeCloseTo(10, 6);
    expect(quad.angle).toBe(105);
    expect(ancestorAngle(s.doc, layout, child)).toBe(90);
  });

  it('keeps boxes for hidden objects and their children', () => {
    const s = scene();
    const hidden = s.add(s.screen, 'Frame', { Visible: false });
    const inside = s.add(hidden, 'Frame');
    const layout = s.layout();
    expect(layout.get(hidden)!.visible).toBe(false);
    expect(layout.get(inside)!.visible).toBe(true);
  });
});

describe('UIPadding', () => {
  it('shrinks the area for children by Scale and Offset', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Position: [0, 10, 0, 10], Size: [0, 200, 0, 100] });
    s.add(frame, 'UIPadding', {
      PaddingLeft: [0.1, 0],
      PaddingRight: [0, 5],
      PaddingTop: [0.1, 0],
      PaddingBottom: [0.2, 4],
    });
    const child = s.add(frame, 'Frame', { Size: [1, 0, 1, 0] });
    const layout = s.layout();
    expectRect(layout.get(frame)!.content, { x: 30, y: 20, w: 175, h: 66 });
    expectRect(layout.get(child), { x: 30, y: 20, w: 175, h: 66 });
  });

  it('never leaves a negative area', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 100, 0, 100] });
    s.add(frame, 'UIPadding', { PaddingLeft: [0, 80], PaddingRight: [0, 80] });
    expectRect(s.layout().get(frame)!.content, { w: 0, h: 100 });
  });
});

describe('UIListLayout', () => {
  /** A 300×200 frame at the origin with a list and three 50×40 items. */
  function list(props: Partial<PropsOf<'UIListLayout'>>, items = ['A', 'B', 'C']) {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 300, 0, 200] });
    s.add(frame, 'UIListLayout', props);
    const ids = items.map((name, i) =>
      s.add(frame, 'Frame', {
        Name: name,
        LayoutOrder: i,
        Size: [0, 50, 0, 40],
        Position: [0.5, 99, 0.5, 99],
        AnchorPoint: [1, 1],
        Rotation: 30,
      }),
    );
    const layout = s.layout();
    return { s, frame, ids, at: (i: number) => layout.get(ids[i]!)!, layout };
  }

  it('stacks top to bottom and ignores Position, AnchorPoint and Rotation', () => {
    const { at } = list({ Padding: [0, 10] });
    expectRect(at(0), { x: 0, y: 0 });
    expectRect(at(1), { x: 0, y: 50 });
    expectRect(at(2), { x: 0, y: 100 });
    expect(at(1).rotation).toBe(0);
    expect(at(1).listItem).toBe(true);
  });

  it('centers and right-aligns across a vertical list', () => {
    expectRect(list({ HorizontalAlignment: 'Center' }).at(0), { x: 125 });
    expectRect(list({ HorizontalAlignment: 'Right' }).at(0), { x: 250 });
  });

  it('centers and bottom-aligns along a vertical list', () => {
    // Three 40 px items with 10 px gaps take 140 of the 200 px.
    expectRect(list({ VerticalAlignment: 'Center', Padding: [0, 10] }).at(0), { y: 30 });
    expectRect(list({ VerticalAlignment: 'Bottom', Padding: [0, 10] }).at(0), { y: 60 });
  });

  it('runs left to right in a horizontal list, with a Scale gap', () => {
    const { at } = list({ FillDirection: 'Horizontal', Padding: [0.1, 0] });
    // The gap is 10% of the 300 px width.
    expectRect(at(0), { x: 0, y: 0 });
    expectRect(at(1), { x: 80 });
    expectRect(at(2), { x: 160 });
  });

  it('aligns a horizontal list right and centers it vertically', () => {
    const { at } = list({
      FillDirection: 'Horizontal',
      HorizontalAlignment: 'Right',
      VerticalAlignment: 'Center',
    });
    expectRect(at(2), { x: 250, y: 80 });
    expectRect(at(0), { x: 150 });
  });

  it('gives hidden items no space', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 300, 0, 200] });
    s.add(frame, 'UIListLayout', {});
    const a = s.add(frame, 'Frame', { Size: [0, 50, 0, 40] });
    const hidden = s.add(frame, 'Frame', { Size: [0, 50, 0, 40], Visible: false });
    const c = s.add(frame, 'Frame', { Size: [0, 50, 0, 40] });
    const layout = s.layout();
    expectRect(layout.get(c), { y: 40 });
    expect(layout.get(a)!.visible).toBe(true);
    expect(layout.get(hidden)).toMatchObject({ visible: false, listItem: true });
  });

  it('orders by LayoutOrder, keeping child order for ties', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 300, 0, 200] });
    s.add(frame, 'UIListLayout', {});
    const late = s.add(frame, 'Frame', { LayoutOrder: 5, Size: [0, 10, 0, 10] });
    const first = s.add(frame, 'Frame', { LayoutOrder: 1, Size: [0, 10, 0, 10] });
    const second = s.add(frame, 'Frame', { LayoutOrder: 1, Size: [0, 10, 0, 10] });
    const layout = s.layout();
    expect([first, second, late].map((id) => layout.get(id)!.y)).toEqual([0, 10, 20]);
  });

  it('orders by Name when SortOrder is Name, with numbers in order', () => {
    const { at } = list({ SortOrder: 'Name' }, ['Item10', 'Item2', 'Apple']);
    expect([at(2).y, at(1).y, at(0).y]).toEqual([0, 40, 80]);
  });

  it('measures Scale sizes of items against the list parent', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 300, 0, 200] });
    s.add(frame, 'UIListLayout', {});
    const half = s.add(frame, 'Frame', { Size: [0.5, 0, 0.25, 0] });
    expectRect(s.layout().get(half), { w: 150, h: 50 });
  });
});

describe('UIAspectRatioConstraint', () => {
  function aspect(ratio: number, size: PropsOf<'Frame'>['Size']) {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: size });
    s.add(frame, 'UIAspectRatioConstraint', { AspectRatio: ratio });
    return s.layout().get(frame)!;
  }

  it('fits the largest box of the ratio inside Size', () => {
    expectRect(aspect(1, [0, 200, 0, 100]), { w: 100, h: 100 });
    expectRect(aspect(4, [0, 200, 0, 100]), { w: 200, h: 50 });
    expectRect(aspect(0.5, [0.2, 0, 0.8, 0]), { w: 200, h: 400 });
  });

  it('works under a list, before the list places the item', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame', { Size: [0, 300, 0, 300] });
    s.add(frame, 'UIListLayout', {});
    const square = s.add(frame, 'Frame', { Size: [1, 0, 0, 100] });
    s.add(square, 'UIAspectRatioConstraint', {});
    const next = s.add(frame, 'Frame', { Size: [0, 10, 0, 10] });
    const layout = s.layout();
    expectRect(layout.get(square), { w: 100, h: 100 });
    expectRect(layout.get(next), { y: 100 });
  });
});

describe('ScrollingFrame', () => {
  it('places children on a canvas at least as big as the frame', () => {
    const s = scene();
    const scroll = s.add(s.screen, 'ScrollingFrame', {
      Position: [0, 10, 0, 20],
      Size: [0, 200, 0, 100],
      CanvasSize: [0, 0, 3, 0],
    });
    const child = s.add(scroll, 'Frame', { Position: [0, 0, 1, 0], AnchorPoint: [0, 1] });
    const layout = s.layout();
    expectRect(layout.get(scroll)!.canvas, { x: 10, y: 20, w: 200, h: 300 });
    expectRect(layout.get(child), { y: 180 });
  });
});

describe('ScreenGuis', () => {
  it('lays out every ScreenGui in StarterGui and marks a disabled one hidden', () => {
    const s = scene();
    const doc = s.doc;
    const second = createInstance('ScreenGui', { Enabled: false }, 'second') as AnyInstance;
    const withTwo = applyCommand(doc, insert(serviceOf(doc, 'StarterGui').id, single(second))).doc;
    const layout = layoutScreenGuis(withTwo, serviceOf(doc, 'StarterGui').id, LAPTOP);
    expect(layout.get(s.screen)!.visible).toBe(true);
    expect(layout.get('second')!.visible).toBe(false);
  });

  it('refuses to lay out something that is not a ScreenGui or Page', () => {
    const doc = sample();
    expect(() => layoutContainer(doc, byName(doc, 'Panel').id, LAPTOP)).toThrow(TypeError);
  });
});

describe('pages', () => {
  const doc = site();
  const page = (name: string) => byName(doc, name).id;
  const at = (width: number, height = 900) => ({ width, height });
  const lay = (name: string, width: number, height?: number) =>
    layoutContainer(doc, page(name), at(width, height), breakpointForWidth(doc, width)?.id);
  const box = (layout: Layout, name: string, within: string) =>
    layout.get(byName(doc, name, within).id)!;

  it('stacks sections from the top and fills the window width', () => {
    const home = lay('Home', 1366, 768);
    expectRect(box(home, 'Nav', 'Home'), { x: 0, y: 0, w: 1366, h: 72 });
    expectRect(box(home, 'Hero', 'Home'), { x: 0, y: 72, w: 1366, h: 696 });
    expectRect(box(home, 'Headline', 'Home'), { w: 720, h: 140 });
  });

  it('makes the page at least as tall as the window', () => {
    expectRect(lay('Home', 1366, 768).get(page('Home'))!.canvas, { w: 1366, h: 768 });
  });

  it('grows the page to fit its sections', () => {
    // On a phone the Plans section is 1000 px tall, below a 60 px nav, so the page is taller
    // than the window.
    const phone = lay('Pricing', 390, 844);
    expect(phone.get(page('Pricing'))!.canvas!.h).toBeCloseTo(60 + 1000, 6);
    const short = lay('Pricing', 390, 400);
    expect(short.get(page('Pricing'))!.canvas!.h).toBeCloseTo(1060, 6);
  });

  it('uses Tablet values on a tablet and Phone values on a phone', () => {
    expectRect(box(lay('Home', 810), 'Headline', 'Home'), { w: 714, h: 140 });
    expectRect(box(lay('Home', 390), 'Headline', 'Home'), { w: 342, h: 160 });
    expectRect(box(lay('Home', 390), 'Hero', 'Home'), { y: 60, h: 900 - 60 });
  });

  it('hides the nav links on a phone only', () => {
    expect(box(lay('Home', 1366), 'Links', 'Home').visible).toBe(true);
    expect(box(lay('Home', 810), 'Links', 'Home').visible).toBe(true);
    expect(box(lay('Home', 390), 'Links', 'Home').visible).toBe(false);
  });

  it('lays the price cards side by side, centered, then stacks them on a phone', () => {
    const desktop = lay('Pricing', 1366);
    // Three 300 px cards and two 24 px gaps, centered in 1366 minus 40 px padding each side.
    expect(['Taster', 'Regular', 'Office'].map((n) => box(desktop, n, 'Pricing').x)).toEqual([
      209, 533, 857,
    ]);
    expect(box(desktop, 'Taster', 'Pricing').y).toBe(72 + 48);

    const phone = lay('Pricing', 390);
    expect(['Taster', 'Regular', 'Office'].map((n) => box(phone, n, 'Pricing').y)).toEqual([
      108, 412, 716,
    ]);
    expectRect(box(phone, 'Office', 'Pricing'), { x: 40, w: 310, h: 280 });
  });

  it('applies the base values when no breakpoint is given', () => {
    const base = layoutContainer(doc, page('Home'), at(390));
    expectRect(box(base, 'Hero', 'Home'), { h: 900 - 72 });
  });

  it('counts page padding below the last section', () => {
    let d = doc;
    const pricing = byName(d, 'Pricing');
    const padding = createInstance('UIPadding', { PaddingBottom: [0, 300] }, 'pad') as AnyInstance;
    d = applyCommand(d, insert(pricing.id, single(padding))).doc;
    const layout = layoutContainer(d, pricing.id, at(1366, 768));
    expect(layout.get(pricing.id)!.canvas!.h).toBe(72 + 420 + 300);
  });

  it('measures vertical Scale on a page against the window, less the page padding', () => {
    expectRect(box(lay('Home', 1366, 900), 'Hero', 'Home'), { h: 900 - 72 });
    let d = doc;
    const home = byName(d, 'Home');
    const padding = createInstance('UIPadding', { PaddingTop: [0.1, 0] }, 'pad') as AnyInstance;
    d = applyCommand(d, insert(home.id, single(padding))).doc;
    const layout = layoutContainer(d, home.id, at(1366, 1000));
    // 10% of the 1000 px window is padding, so the hero gets 900 - 72.
    expectRect(layout.get(byName(d, 'Hero').id), { y: 100 + 72, h: 900 - 72 });
  });
});
