import { expect, test } from '@playwright/test';
import { exportSite } from '../../src/export/site.ts';
import { layoutContainer } from '../../src/layout/layout.ts';
import { classDef } from '../../src/model/classes.ts';
import {
  breakpointForWidth,
  childOfClass,
  childrenOf,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import type { ClassName, PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert } from '../../src/model/commands.ts';
import { createInstance, serviceOf, single } from '../../src/model/document.ts';
import { sampleSite } from '../../src/model/sample.ts';

/** The page's objects in the order the export writes them: base list order, parents first. */
function exportOrder(doc: Doc, id: InstanceId): AnyInstance[] {
  const items = childrenOf(doc, id).filter((c) => classDef(c.className).kind === 'gui');
  const list = childOfClass(doc, id, 'UIListLayout');
  const order = list
    ? items
        .map((c, i) => ({ c, i }))
        .sort(
          (a, b) =>
            (a.c.props as { LayoutOrder: number }).LayoutOrder -
              (b.c.props as { LayoutOrder: number }).LayoutOrder || a.i - b.i,
        )
        .map((o) => o.c)
    : items;
  return order.flatMap((c) => [c, ...exportOrder(doc, c.id)]);
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

const doc = testSite();
const files = exportSite(doc);
const pages = childrenOf(doc, serviceOf(doc, 'Site').id);
const fileOf: Record<string, string> = {
  Home: 'index.html',
  Pricing: 'pricing/index.html',
  Free: 'free/index.html',
};
const sizes = [
  { width: 1366, height: 768 },
  { width: 810, height: 1080 },
  { width: 390, height: 844 },
];

for (const page of pages) {
  const file = files.find((f) => f.path === fileOf[page.props.Name])!;
  for (const size of sizes) {
    test(`${page.props.Name} at ${size.width}px matches the layout engine`, async ({
      page: tab,
    }) => {
      await tab.setViewportSize(size);
      await tab.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await tab.setContent(file.contents as string);
      const layout = layoutContainer(doc, page.id, size, breakpointForWidth(doc, size.width)?.id);
      // Shown on screen: its own Visible and every parent object's.
      const shown = (inst: AnyInstance): boolean => {
        for (let id: InstanceId | null = inst.id; id !== page.id && id !== null;) {
          if (!layout.get(id)!.visible) return false;
          id = doc.instances[id]!.parent;
        }
        return true;
      };
      const expected = exportOrder(doc, page.id).map((inst) => {
        const b = layout.get(inst.id)!;
        return { name: inst.props.Name, x: b.x, y: b.y, w: b.w, h: b.h, shown: shown(inst) };
      });
      const actual = await tab.$$eval('.g', (els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, shown: el.getClientRects().length > 0 };
        }),
      );
      expect(actual).toHaveLength(expected.length);
      // Phone hides something on every page, so hidden objects are checked too.
      expect(expected.some((e) => !e.shown) || size.width > 809).toBe(true);
      expected.forEach((e, i) => {
        const a = actual[i]!;
        expect(a.shown, `${e.name} shown`).toBe(e.shown);
        if (!e.shown) return;
        for (const k of ['x', 'y', 'w', 'h'] as const)
          expect(Math.abs(a[k] - e[k]), `${e.name}.${k}: ${a[k]} vs ${e[k]}`).toBeLessThan(0.05);
      });
      const pageHeight = await tab.evaluate(() => document.documentElement.scrollHeight);
      expect(Math.abs(pageHeight - layout.get(page.id)!.canvas!.h)).toBeLessThan(1);
    });
  }
}
