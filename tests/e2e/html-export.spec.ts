import { expect, test } from '@playwright/test';
import { SCREEN_DEVICES } from '../../src/editor/devices.ts';
import { exportHtml } from '../../src/export/html.ts';
import { layoutScreenGuis } from '../../src/layout/layout.ts';
import type * as LayoutModule from '../../src/layout/layout.ts';
import { classDef, type ClassName, type PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert } from '../../src/model/commands.ts';
import {
  childrenOf,
  createInstance,
  emptyProject,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import { COMPONENTS, componentSubtree, fitsTarget } from '../../src/model/components/index.ts';
import { sampleDoc } from '../../src/model/sample.ts';
import { TEMPLATES } from '../../src/model/templates/index.ts';
import type * as MeasureModule from '../../src/ui/viewport/text-measure.ts';
import { exportOrder } from './export-order.ts';

/**
 * The HTML page for the Roblox screens, opened in Chromium, puts every object where the
 * layout engine (and so the editor) does. The prototype's smoke test checked the Panel; this
 * checks every object of the sample menu plus a screen of edge cases, on every device.
 */

/** The sample menu plus what it doesn't use. Names are unique, so boxes match by data-name. */
function testDoc(): Doc {
  let doc = sampleDoc();
  let n = 0;
  const add = <C extends ClassName>(parent: InstanceId, c: C, props: Partial<PropsOf<C>>) => {
    const inst = createInstance(c, props, `t${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  const sg = add(serviceOf(doc, 'StarterGui').id, 'ScreenGui', { Name: 'Edges' });
  add(sg, 'Frame', {
    Name: 'Corner',
    AnchorPoint: [1, 1],
    Position: [1, -8, 1, -8],
    Size: [0, 120, 0.1, 30],
  });
  add(sg, 'Frame', { Name: 'Negative', Position: [0, -20, 0, -10], Size: [0.2, 0, 0, 60] });
  const square = add(sg, 'Frame', {
    Name: 'Square',
    Position: [0.3, 0, 0.1, 0],
    Size: [0.3, 0, 0.3, 0],
  });
  add(square, 'UIAspectRatioConstraint', { AspectRatio: 1 });
  add(square, 'UICorner', { CornerRadius: [0.25, 0] });
  const row = add(sg, 'Frame', {
    Name: 'Row',
    Position: [0.05, 0, 0.6, 0],
    Size: [0.9, 0, 0, 90],
  });
  add(row, 'UIPadding', { PaddingLeft: [0, 12], PaddingRight: [0.05, 0], PaddingTop: [0.1, 0] });
  add(row, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Center',
    Padding: [0, 10],
  });
  add(row, 'TextButton', { Name: 'One', LayoutOrder: 2, Size: [0.2, 0, 0.8, 0] });
  add(row, 'TextButton', { Name: 'Two', LayoutOrder: 1, Size: [0, 90, 0, 40] });
  add(row, 'Frame', { Name: 'Hidden', LayoutOrder: 0, Visible: false, Size: [0, 50, 1, 0] });
  const right = add(sg, 'Frame', {
    Name: 'RightList',
    Position: [0.7, 0, 0.1, 0],
    Size: [0.25, 0, 0.4, 0],
  });
  add(right, 'UIListLayout', { HorizontalAlignment: 'Right', SortOrder: 'Name' });
  add(right, 'TextLabel', { Name: 'Beta', Size: [0.5, 0, 0, 30], TextScaled: true });
  add(right, 'TextLabel', { Name: 'Alpha', Size: [0.8, 0, 0.2, 0] });
  const scroll = add(sg, 'ScrollingFrame', {
    Name: 'Scroller',
    Position: [0, 0, 0.75, 0],
    Size: [0, 200, 0, 120],
    CanvasSize: [0, 0, 2, 0],
  });
  add(scroll, 'Frame', { Name: 'Deep', Position: [0, 10, 0.6, 0], Size: [1, -20, 0.2, 0] });
  return doc;
}

const doc = testDoc();
const html = exportHtml(doc);
const guis = Object.values(doc.instances).filter((i) => classDef(i.className).kind === 'gui');

for (const device of SCREEN_DEVICES) {
  test(`the HTML page matches the layout engine on ${device.label}`, async ({ page }) => {
    const size = { width: device.width, height: device.height };
    await page.setViewportSize(size);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.setContent(html);
    const layout = layoutScreenGuis(doc, serviceOf(doc, 'StarterGui').id, size);
    const actual = await page.$$eval('.g[data-name]', (els) =>
      Object.fromEntries(
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const shown = el.getClientRects().length > 0;
          return [
            (el as HTMLElement).dataset.name!,
            { x: r.x, y: r.y, w: r.width, h: r.height, shown },
          ];
        }),
      ),
    );
    expect(Object.keys(actual).sort()).toEqual(guis.map((g) => g.props.Name).sort());
    for (const g of guis) {
      const b = layout.get(g.id)!;
      const a = actual[g.props.Name]!;
      expect(a.shown, `${g.props.Name} shown`).toBe(b.visible);
      if (!b.visible) continue;
      // Chromium lays out in steps of 1/64 px, and the steps add up along a list.
      for (const k of ['x', 'y', 'w', 'h'] as const)
        expect(Math.abs(a[k] - b[k]), `${g.props.Name}.${k}: ${a[k]} vs ${b[k]}`).toBeLessThan(0.1);
    }
  });
}

// The Roblox templates repeat names (every slot has an Icon), so their boxes match in the
// order the export writes them.
function checkScreens(name: string, doc: Doc) {
  const html = exportHtml(doc);
  const starterGui = serviceOf(doc, 'StarterGui').id;
  const order = childrenOf(doc, starterGui).flatMap((sg) => exportOrder(doc, sg.id));
  for (const device of SCREEN_DEVICES) {
    test(`${name} matches the layout engine on ${device.label}`, async ({ page }) => {
      const size = { width: device.width, height: device.height };
      await page.setViewportSize(size);
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await page.route('**/__export/screens.html', (r) =>
        r.fulfill({ contentType: 'text/html', body: html }),
      );
      await page.goto('/__export/screens.html');
      await page.evaluate(() => document.fonts.ready);
      // The engine runs in the page and measures text there, as in the editor, since the
      // components grow boxes to fit their text.
      const boxes: [
        InstanceId,
        { x: number; y: number; w: number; h: number; rotation: number },
      ][] = await page.evaluate(
        async ({ doc, starterGui, size }) => {
          const layoutPath = '/src/layout/layout.ts';
          const measurePath = '/src/ui/viewport/text-measure.ts';
          const L = (await import(layoutPath)) as typeof LayoutModule;
          const M = (await import(measurePath)) as typeof MeasureModule;
          const layout = L.layoutScreenGuis(
            doc,
            starterGui,
            size,
            undefined,
            M.domTextMeasurer().measure,
          );
          return [...layout].map(([id, b]) => [
            id,
            { x: b.x, y: b.y, w: b.w, h: b.h, rotation: b.rotation },
          ]);
        },
        { doc, starterGui, size },
      );
      const layout = new Map(boxes);
      const actual = await page.$$eval('.g', (els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            name: (el as HTMLElement).dataset.name,
            x: r.x,
            y: r.y,
            w: parseFloat(s.width),
            h: parseFloat(s.height),
          };
        }),
      );
      expect(actual.map((a) => a.name)).toEqual(order.map((g) => g.props.Name));
      // A rotated object's screen box grows with the turn, so it and its children only
      // compare their sizes. The templates nest lists in lists, and Chromium's 1/64 px steps
      // add up a little further than in the test screen above.
      const turned = (id: InstanceId | null): boolean =>
        id !== null &&
        id !== starterGui &&
        (!!layout.get(id)?.rotation || turned(doc.instances[id]!.parent));
      order.forEach((g, i) => {
        const b = layout.get(g.id)!;
        const a = actual[i]!;
        const keys = turned(g.id) ? (['w', 'h'] as const) : (['x', 'y', 'w', 'h'] as const);
        for (const k of keys)
          expect(Math.abs(a[k] - b[k]), `${g.props.Name}.${k}: ${a[k]} vs ${b[k]}`).toBeLessThan(
            0.25,
          );
      });
    });
  }
}

for (const t of TEMPLATES.filter((t) => t.kind === 'roblox'))
  checkScreens(`the ${t.name} template`, t.build());

/** Every component for Roblox, each in a ScreenGui of its own, as the Components drawer adds it. */
function componentsScreens(): Doc {
  let doc = emptyProject();
  const starterGui = serviceOf(doc, 'StarterGui').id;
  COMPONENTS.filter((def) => fitsTarget(def, 'roblox')).forEach((def, i) => {
    const sg = createInstance('ScreenGui', { Name: `${def.name} layer` }) as AnyInstance;
    doc = applyCommand(doc, insert(starterGui, single(sg))).doc;
    const look = i % 2 ? 'light' : 'dark';
    const copy = componentSubtree(
      doc,
      def,
      { look, corners: 'rounded', target: 'roblox' },
      'other',
    );
    doc = applyCommand(doc, insert(sg.id, copy)).doc;
  });
  return doc;
}
checkScreens('every Roblox component', componentsScreens());
