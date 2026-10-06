import { expect, test, type Page } from '@playwright/test';
import { SCREEN_DEVICES } from '../../src/editor/devices.ts';
import { exportHtml } from '../../src/export/html.ts';
import { exportSite } from '../../src/export/site.ts';
import type * as LayoutModule from '../../src/layout/layout.ts';
import { classDef } from '../../src/model/classes.ts';
import {
  breakpointForWidth,
  serviceOf,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import type { UDim2 } from '../../src/model/values.ts';
import type * as MeasureModule from '../../src/ui/viewport/text-measure.ts';
import { screenDoc, siteDoc } from './auto-size-docs.ts';

/**
 * AutomaticSize in the exports, opened in Chromium, matches the layout engine measuring text
 * in the same page, as the editor does: every box of a screen and of a site full of objects
 * that grow, at several window sizes. Names are unique, so boxes match by data-name.
 */

interface Found {
  x: number;
  y: number;
  w: number;
  h: number;
  shown: boolean;
}

/** Serves `html` from the dev server, so the page can import the app's modules. */
async function open(tab: Page, html: string, size: { width: number; height: number }) {
  await tab.setViewportSize(size);
  await tab.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await tab.route('**/__export/page.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  );
  await tab.goto('/__export/page.html');
  await tab.evaluate(() => document.fonts.ready);
}

/** Lays out `root` in the page, measuring text with the editor's browser measurer. */
async function engineBoxes(
  tab: Page,
  doc: Doc,
  root: InstanceId,
  size: { width: number; height: number },
  breakpoint: InstanceId | undefined,
) {
  return tab.evaluate(
    async ({ doc, root, size, breakpoint }) => {
      const layoutPath = '/src/layout/layout.ts';
      const measurePath = '/src/ui/viewport/text-measure.ts';
      const L = (await import(layoutPath)) as typeof LayoutModule;
      const M = (await import(measurePath)) as typeof MeasureModule;
      const { measure } = M.domTextMeasurer();
      const inst = doc.instances[root]!;
      const layout =
        inst.className === 'Page'
          ? L.layoutContainer(doc, root, size, breakpoint, measure)
          : L.layoutScreenGuis(doc, root, size, undefined, measure);
      return Object.fromEntries(
        [...layout].map(([id, b]) => [
          id,
          { x: b.x, y: b.y, w: b.w, h: b.h, visible: b.visible, canvas: b.canvas?.h ?? 0 },
        ]),
      );
    },
    { doc, root, size, breakpoint },
  );
}

async function exportedBoxes(tab: Page): Promise<Record<string, Found>> {
  return tab.$$eval('.g[data-name]', (els) =>
    Object.fromEntries(
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [
          (el as HTMLElement).dataset.name!,
          { x: r.x, y: r.y, w: r.width, h: r.height, shown: el.getClientRects().length > 0 },
        ];
      }),
    ),
  );
}

/** Every shown object is where the engine puts it, and some of them grew. */
function compare(
  doc: Doc,
  root: InstanceId,
  expected: Record<string, { x: number; y: number; w: number; h: number; visible: boolean }>,
  actual: Record<string, Found>,
) {
  const shown = (id: InstanceId): boolean => {
    for (let at: InstanceId | null = id; at !== null && at !== root; at = doc.instances[at]!.parent)
      if (!expected[at]!.visible) return false;
    return true;
  };
  let grew = 0;
  for (const inst of Object.values(doc.instances)) {
    if (classDef(inst.className).kind !== 'gui' || !expected[inst.id]) continue;
    const name = inst.props.Name;
    const e = expected[inst.id]!;
    const a = actual[name];
    expect(a, name).toBeDefined();
    expect(a!.shown, `${name} shown`).toBe(shown(inst.id));
    if (!a!.shown) continue;
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect(Math.abs(a![k] - e[k]), `${name}.${k}: ${a![k]} vs ${e[k]}`).toBeLessThan(0.1);
    // Sized in Offset only, so a box bigger than its Size grew.
    const [xs, xo, ys, yo] = (inst.props as unknown as { Size: UDim2 }).Size;
    if ((!xs && e.w > xo + 1) || (!ys && e.h > yo + 1)) grew++;
  }
  expect(grew, 'objects that grew').toBeGreaterThanOrEqual(2);
}

const screens = screenDoc();
for (const device of SCREEN_DEVICES.slice(0, 3)) {
  test(`the Roblox HTML page grows boxes as the editor does on ${device.label}`, async ({
    page: tab,
  }) => {
    const size = { width: device.width, height: device.height };
    await open(tab, exportHtml(screens), size);
    const starterGui = serviceOf(screens, 'StarterGui').id;
    const expected = await engineBoxes(tab, screens, starterGui, size, undefined);
    compare(screens, starterGui, expected, await exportedBoxes(tab));
  });
}

const site = siteDoc();
const files = exportSite(site);
for (const [name, file] of [
  ['Home', 'index.html'],
  ['Free', 'free/index.html'],
] as const)
  for (const size of [
    { width: 1366, height: 768 },
    { width: 810, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    test(`the ${name} page grows boxes as the editor does at ${size.width}px`, async ({
      page: tab,
    }) => {
      const html = files.find((f) => f.path === file)!.contents as string;
      await open(tab, html, size);
      const page = Object.values(site.instances).find((i) => i.props.Name === name)!.id;
      const breakpoint = breakpointForWidth(site, size.width)?.id;
      const expected = await engineBoxes(tab, site, page, size, breakpoint);
      compare(site, page, expected, await exportedBoxes(tab));
      const height = await tab.evaluate(
        () => document.querySelector('.page')!.getBoundingClientRect().height,
      );
      expect(Math.abs(height - expected[page]!.canvas), 'page height').toBeLessThan(0.1);
    });
  }
