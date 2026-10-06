import { expect, test } from '@playwright/test';
import { exportSite } from '../../src/export/site.ts';
import type * as LayoutModule from '../../src/layout/layout.ts';
import {
  breakpointForWidth,
  childrenOf,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import type { ClassName, PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert } from '../../src/model/commands.ts';
import { createInstance, serviceOf, single } from '../../src/model/document.ts';
import { sampleSite } from '../../src/model/sample.ts';
import { TEMPLATES } from '../../src/model/templates/index.ts';
import { COMPONENTS, componentSubtree, fitsTarget } from '../../src/model/components/index.ts';
import { pageSubtree } from '../../src/model/builder.ts';
import { emptyProject } from '../../src/model/document.ts';
import type * as MeasureModule from '../../src/ui/viewport/text-measure.ts';
import { exportOrder } from './export-order.ts';

interface Found {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  canvas: number;
}

/**
 * The sample site plus a page that tests what the sample doesn't use: free-placed sections in
 * Scale that grow the page, Scale page padding, a heading, a horizontal list whose order
 * changes on a phone, and a section hidden on a phone.
 */
function testSite(): Doc {
  let doc = sampleSite();
  const phone = childrenOf(doc, doc.rootId).find((c) => c.props.Name === 'Phone')!.id;
  let n = 0;
  const add = <C extends ClassName>(parent: InstanceId, c: C, props: Partial<PropsOf<C>>) => {
    const inst = createInstance(c, props, `t${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  const onPhone = (id: InstanceId, props: Record<string, unknown>) => {
    doc = applyCommand(doc, { type: 'setProps', id, props, breakpoint: phone }).doc;
  };
  const page = add(serviceOf(doc, 'Site').id, 'Page', { Name: 'Free', Path: '/free' });
  add(page, 'UIPadding', {
    PaddingTop: [0.05, 10],
    PaddingLeft: [0, 24],
    PaddingRight: [0.1, 0],
    PaddingBottom: [0, 40],
  });
  const banner = add(page, 'Frame', {
    Name: 'Banner',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 0],
    Size: [0.8, 0, 0.5, 0],
  });
  add(banner, 'TextLabel', { Name: 'Title', Size: [1, 0, 0.3, 0], Text: 'Hello', HtmlTag: 'h1' });
  add(page, 'Frame', { Name: 'Deep', Position: [0, 0, 1.2, 0], Size: [0.5, 0, 0, 200] });
  const gone = add(page, 'Frame', {
    Name: 'Gone',
    AnchorPoint: [0, 1],
    Position: [0, 0, 2, 0],
    Size: [0, 100, 0.25, 0],
  });
  onPhone(gone, { Visible: false });
  const row = add(page, 'Frame', { Name: 'Row', Position: [0, 0, 0.6, 0], Size: [1, 0, 0, 80] });
  add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.02, 0] });
  const first = add(row, 'Frame', { Name: 'A', LayoutOrder: 1, Size: [0.2, 0, 1, 0] });
  add(row, 'Frame', { Name: 'B', LayoutOrder: 2, Size: [0.2, 0, 1, 0] });
  add(row, 'Frame', { Name: 'C', LayoutOrder: 3, Size: [0.2, 0, 1, 0] });
  onPhone(first, { LayoutOrder: 5 });
  return doc;
}

/**
 * A page with every component for websites, each added as the Components drawer adds it to a
 * page. The Roblox ones are checked on a screen in html-export.spec.ts.
 */
function componentsSite(): Doc {
  let doc = emptyProject();
  const page = pageSubtree({ Name: 'Components', Path: '/' });
  doc = applyCommand(doc, insert(serviceOf(doc, 'Site').id, page)).doc;
  COMPONENTS.filter((def) => fitsTarget(def, 'site')).forEach((def, i) => {
    const look = i % 2 ? 'dark' : 'light';
    const copy = componentSubtree(doc, def, { look, corners: 'rounded', target: 'site' }, 'page');
    const root = copy.instances[copy.rootId]!;
    const placed = { ...root, props: { ...root.props, LayoutOrder: i + 1 } } as AnyInstance;
    const subtree = { ...copy, instances: { ...copy.instances, [root.id]: placed } };
    doc = applyCommand(doc, insert(page.rootId, subtree)).doc;
  });
  return doc;
}

const sizes = [
  { width: 1366, height: 768 },
  { width: 810, height: 1080 },
  { width: 390, height: 844 },
];

/**
 * Every page of a site, exported and opened at Desktop, Tablet and Phone widths, puts each
 * object where the layout engine does, and is as tall as the layout says. The engine runs in
 * the same page and measures text there, as in the editor, since the templates grow boxes to
 * fit their text. The page comes from the dev server, so it can import the app's modules.
 */
function checkSite(name: string, doc: Doc, { phoneHides }: { phoneHides: boolean }) {
  const files = exportSite(doc);
  const pages = childrenOf(doc, serviceOf(doc, 'Site').id);
  const fileOf = (page: AnyInstance) => {
    const path = (page.props as { Path: string }).Path.replace(/^\/|\/$/g, '');
    return path ? `${path}/index.html` : 'index.html';
  };
  for (const page of pages) {
    const file = files.find((f) => f.path === fileOf(page))!;
    for (const size of sizes) {
      test(`${name}: ${page.props.Name} at ${size.width}px matches the layout engine`, async ({
        page: tab,
      }) => {
        await tab.setViewportSize(size);
        await tab.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
        await tab.route('**/__export/page.html', (r) =>
          r.fulfill({ contentType: 'text/html', body: file.contents as string }),
        );
        await tab.goto('/__export/page.html');
        await tab.evaluate(() => document.fonts.ready);
        const boxes: Record<InstanceId, Found> = await tab.evaluate(
          async ({ doc, root, size, breakpoint }) => {
            const layoutPath = '/src/layout/layout.ts';
            const measurePath = '/src/ui/viewport/text-measure.ts';
            const L = (await import(layoutPath)) as typeof LayoutModule;
            const M = (await import(measurePath)) as typeof MeasureModule;
            const layout = L.layoutContainer(
              doc,
              root,
              size,
              breakpoint,
              M.domTextMeasurer().measure,
            );
            return Object.fromEntries(
              [...layout].map(([id, b]) => [
                id,
                { x: b.x, y: b.y, w: b.w, h: b.h, visible: b.visible, canvas: b.canvas?.h ?? 0 },
              ]),
            );
          },
          { doc, root: page.id, size, breakpoint: breakpointForWidth(doc, size.width)?.id },
        );
        // Shown on screen: its own Visible and every parent object's.
        const shown = (inst: AnyInstance): boolean => {
          for (let id: InstanceId | null = inst.id; id !== page.id && id !== null;) {
            if (!boxes[id]!.visible) return false;
            id = doc.instances[id]!.parent;
          }
          return true;
        };
        const expected = exportOrder(doc, page.id).map((inst) => {
          const b = boxes[inst.id]!;
          return { name: inst.props.Name, x: b.x, y: b.y, w: b.w, h: b.h, shown: shown(inst) };
        });
        const actual = await tab.$$eval('.g', (els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              name: (el as HTMLElement).dataset.name,
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              shown: el.getClientRects().length > 0,
            };
          }),
        );
        expect(actual.map((a) => a.name)).toEqual(expected.map((e) => e.name));
        // Phone hides something on every page of the test site, so hidden objects are checked too.
        if (phoneHides) expect(expected.some((e) => !e.shown) || size.width > 809).toBe(true);
        expected.forEach((e, i) => {
          const a = actual[i]!;
          expect(a.shown, `${e.name} shown`).toBe(e.shown);
          if (!e.shown) return;
          for (const k of ['x', 'y', 'w', 'h'] as const)
            expect(Math.abs(a[k] - e[k]), `${e.name}.${k}: ${a[k]} vs ${e[k]}`).toBeLessThan(0.05);
        });
        const pageHeight = await tab.evaluate(() => document.documentElement.scrollHeight);
        expect(Math.abs(pageHeight - boxes[page.id]!.canvas)).toBeLessThan(1);
      });
    }
  }
}

checkSite('Test site', testSite(), { phoneHides: true });
for (const t of TEMPLATES)
  if (t.kind === 'site') checkSite(`${t.name} template`, t.build(), { phoneHides: false });
checkSite('Every component', componentsSite(), { phoneHides: false });
