import { expect, test, type Page } from '@playwright/test';
import { exportSite } from '../../src/export/site.ts';
import type { ClassName, PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert, remove } from '../../src/model/commands.ts';
import {
  childrenOf,
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import { sampleSite } from '../../src/model/sample.ts';

/**
 * The web-only extras in a real browser: a UIHover's look under the mouse, pinned objects that
 * stay on screen while the page scrolls, Appear animations that wait for their object to
 * scroll into view, and the same in the editor's preview.
 */

/** The sample site with the extras on its home page. */
function extrasSite(): Doc {
  let doc = sampleSite();
  let n = 0;
  const byName = (name: string, within: InstanceId) =>
    childrenOf(doc, within).find((c) => c.props.Name === name)!.id;
  const home = byName('Home', serviceOf(doc, 'Site').id);
  const add = <C extends ClassName>(parent: InstanceId, c: C, props: Partial<PropsOf<C>>) => {
    const inst = createInstance(c, props, `x${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  const set = (id: InstanceId, props: Record<string, unknown>) => {
    doc = applyCommand(doc, { type: 'setProps', id, props }).doc;
  };
  const nav = byName('Nav', home);
  set(nav, { Pinned: true, BackgroundBlur: 8, BackgroundTransparency: 0.2 });
  const hero = byName('Hero', home);
  add(byName('Subscribe', hero), 'UIHover', {
    BackgroundColor3: [0, 0, 0],
    TextColor3: [255, 0, 0],
    Scale: 1,
    Duration: 0,
  });
  // A long section at the bottom that slides in.
  add(home, 'Frame', {
    Name: 'Late',
    LayoutOrder: 10,
    Size: [1, 0, 0, 600],
    BackgroundColor3: [200, 230, 255],
    Appear: 'SlideUp',
  });
  return doc;
}

async function openExport(tab: Page, doc: Doc) {
  const html = exportSite(doc).find((f) => f.path === 'index.html')!.contents as string;
  await tab.setViewportSize({ width: 1366, height: 768 });
  await tab.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await tab.route('**/__export/page.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  );
  await tab.goto('/__export/page.html');
}
const rectOf = (tab: Page, name: string) =>
  tab
    .locator(`[data-name="${name}"]`)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

test.describe('exported website', () => {
  test('a UIHover changes the colors under the mouse', async ({ page: tab }) => {
    await openExport(tab, extrasSite());
    const button = tab.locator('[data-name="Subscribe"]');
    const colors = () =>
      button.evaluate((el) => [
        getComputedStyle(el).backgroundColor,
        getComputedStyle(el.querySelector('.t > *')!).color,
      ]);
    expect(await colors()).not.toEqual(['rgb(0, 0, 0)', 'rgb(255, 0, 0)']);
    await button.hover();
    await expect.poll(colors).toEqual(['rgb(0, 0, 0)', 'rgb(255, 0, 0)']);
  });

  test('a pinned nav stays at the top, and Appear waits for its object', async ({ page: tab }) => {
    await openExport(tab, extrasSite());
    expect(await rectOf(tab, 'Nav')).toEqual({ x: 0, y: 0, w: 1366, h: 72 });
    const late = tab.locator('[data-name="Late"]');
    await expect(late).toHaveClass(/fc-pre/);
    expect(
      await tab.locator('[data-name="Nav"]').evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe('blur(8px)');

    await tab.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect(late).toHaveClass(/fc-in/);
    expect((await rectOf(tab, 'Nav')).y).toBe(0);
  });

  test('a free-placed pinned object stays put on the window', async ({ page: tab }) => {
    let doc = extrasSite();
    const home = childrenOf(doc, serviceOf(doc, 'Site').id)[0]!;
    const list = childrenOf(doc, home.id).find((c) => c.className === 'UIListLayout')!;
    doc = applyCommand(doc, remove(list.id)).doc;
    const chat = createInstance(
      'TextButton',
      {
        Name: 'Chat',
        AnchorPoint: [1, 1],
        Position: [1, -24, 1, -24],
        Size: [0, 64, 0, 64],
        Pinned: true,
      },
      'chat',
    );
    doc = applyCommand(doc, insert(home.id, single(chat as unknown as AnyInstance))).doc;
    // Something far down, so the page scrolls.
    const deep = createInstance('Frame', { Name: 'Deep', Position: [0, 0, 3, 0] }, 'deep');
    doc = applyCommand(doc, insert(home.id, single(deep as unknown as AnyInstance))).doc;
    await openExport(tab, doc);
    const at = { x: 1366 - 24 - 64, y: 768 - 24 - 64, w: 64, h: 64 };
    expect(await rectOf(tab, 'Chat')).toEqual(at);
    await tab.evaluate(() => scrollTo(0, 1500));
    expect(await tab.evaluate(() => scrollY)).toBeGreaterThan(1000);
    expect(await rectOf(tab, 'Chat')).toEqual(at);
  });
});

test.describe('editor preview', () => {
  test('shows hover colors and keeps a pinned nav in view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    const buttonId = await page.evaluate(() => {
      const ed = window.framecraft!;
      const find = (name: string) =>
        Object.values(ed.doc.instances).find((i) => i.props.Name === name)!.id;
      const home = ed.doc.instances[find('Home')]!;
      const nav = home.children.find((c) => ed.doc.instances[c]!.props.Name === 'Nav')!;
      ed.setProp(nav, 'Pinned', true);
      const hover = ed.insert('UIHover', find('Subscribe'))!;
      ed.setProp(hover, 'BackgroundColor3', [0, 0, 0]);
      ed.setProp(hover, 'Scale', 1);
      ed.setProp(hover, 'Duration', 0);
      ed.select(null);
      // Zoomed in, so the page is taller than the viewport and scrolls.
      ed.setZoom(1);
      ed.setPreview(true);
      return find('Subscribe');
    });
    const button = page.locator(`.screen .gui[data-id="${buttonId}"]`);
    await button.hover();
    await expect
      .poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe('rgb(0, 0, 0)');

    const nav = page.locator('.screen > .gui[data-pin="list"]');
    const canvas = page.locator('.canvas');
    const before = (await nav.boundingBox())!.y;
    const top = (await canvas.boundingBox())!.y;
    await canvas.evaluate((el) => el.scrollBy(0, 300));
    // Scrolled far enough that the nav would have left the viewport.
    expect(before - (await canvas.evaluate((el) => el.scrollTop))).toBeLessThan(top);
    // It sticks to the top of the viewport instead of scrolling out of it.
    await expect.poll(async () => (await nav.boundingBox())!.y).toBeCloseTo(top, 0);
  });

  test('plays Appear when an object scrolls into view', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    const id = await page.evaluate(() => {
      const ed = window.framecraft!;
      const home = Object.values(ed.doc.instances).find((i) => i.props.Name === 'Home')!;
      const late = ed.insert('Frame', home.id)!;
      ed.setProp(late, 'LayoutOrder', 99);
      ed.setProp(late, 'Size', [1, 0, 0, 900]);
      ed.setProp(late, 'Appear', 'Zoom');
      ed.select(null);
      ed.setZoom(1);
      ed.setPreview(true);
      return late;
    });
    const late = page.locator(`.screen .gui[data-id="${id}"]`);
    await expect(late).toHaveClass(/fc-pre/);
    await page.locator('.canvas').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(late).toHaveClass(/fc-in/);
    await page.evaluate(() => window.framecraft!.setPreview(false));
    await expect(late).not.toHaveClass(/fc-/);
  });
});
