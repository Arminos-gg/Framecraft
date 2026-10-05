import { expect, test, type Page } from '@playwright/test';

/**
 * The viewport in the running app: the same interactions the prototype's smoke test covers
 * (select, drag, resize, select inside, undo, preview, devices), plus snapping, nudging, zoom,
 * the keyboard, and editing a page per breakpoint.
 */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)!.id,
    name,
  );
const propsOf = (page: Page, id: string) =>
  page.evaluate((i) => window.framecraft!.doc.instances[i]!.props as Record<string, unknown>, id);
const selectedName = (page: Page) =>
  page.evaluate(() => {
    const ed = window.framecraft!;
    const sel = ed.state.selection;
    return sel === null ? null : ed.doc.instances[sel]!.props.Name;
  });
const boxOf = async (page: Page, id: string) => {
  const box = await page.locator(`.screen .gui[data-id="${id}"]`).boundingBox();
  if (!box) throw new Error(`${id} isn't drawn`);
  return box;
};
/** Viewport pixels per device pixel. */
const zoomOf = async (page: Page) => {
  const device = await page.getByTestId('screen').boundingBox();
  const width = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="screen"]')!;
    return el.offsetWidth;
  });
  return device!.width / width;
};
/** Selects by name, as the Explorer will. */
const selectByName = async (page: Page, name: string) => {
  const id = await idOf(page, name);
  await page.evaluate((i) => window.framecraft!.select(i), id);
  return id;
};
const center = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
}

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe('Roblox screens', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
  });

  test('drags, resizes, selects inside the selection and undoes', async ({ page }) => {
    // As in the prototype's smoke test: Coins is selected first, then dragged by its middle,
    // where its Amount label sits, so the drag moves the selection.
    const coins = await selectByName(page, 'Coins');
    const start = await propsOf(page, coins);
    const c = center(await boxOf(page, coins));

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x - 30, c.y + 6, { steps: 4 });
    await page.mouse.move(c.x - 60, c.y + 12, { steps: 4 });
    await expect(page.locator('.overlay .readout')).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator('.overlay .readout')).toHaveCount(0);
    const moved = await propsOf(page, coins);
    expect(await selectedName(page)).toBe('Coins');
    // Offset stays Offset: only the pixel parts change.
    expect(moved.Position).not.toEqual(start.Position);
    expect([(moved.Position as number[])[0], (moved.Position as number[])[2]]).toEqual([1, 0]);
    await expect(page.locator('.statusline')).toContainText('AbsoluteSize 176 × 52');

    const east = center((await page.locator('.overlay .handle[data-h="e"]').boundingBox())!);
    await drag(page, east, 40, 0);
    expect((await propsOf(page, coins)).Size).toEqual([0, expect.any(Number), 0, 52]);
    expect(((await propsOf(page, coins)).Size as number[])[1]).toBeGreaterThan(176);

    await page.mouse.click(c.x - 45, c.y + 12);
    expect(await selectedName(page)).toBe('Amount');

    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    const undone = await propsOf(page, coins);
    expect([undone.Position, undone.Size]).toEqual([start.Position, start.Size]);
    await page.keyboard.press('Control+Shift+z');
    expect((await propsOf(page, coins)).Position).toEqual(moved.Position);
  });

  test('snaps to the screen edge, and Alt skips snapping', async ({ page }) => {
    const coins = await selectByName(page, 'Coins');
    const z = await zoomOf(page);
    const c = center(await boxOf(page, coins));
    // Coins sits 20 px from the right edge; 17 px to the right lands within reach of the edge.
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 17 * z, c.y, { steps: 6 });
    await expect(page.locator('.overlay .guide.v')).toHaveCount(1);
    await page.mouse.up();
    expect((await propsOf(page, coins)).Position).toEqual([1, 0, 0, 20]);
    await expect(page.locator('.overlay .guide')).toHaveCount(0);

    await page.keyboard.press('Control+z');
    await page.keyboard.down('Alt');
    await drag(page, c, 17 * z, 0);
    await page.keyboard.up('Alt');
    const x = ((await propsOf(page, coins)).Position as number[])[1]!;
    expect(x).toBeGreaterThanOrEqual(-4);
    expect(x).toBeLessThan(0);
  });

  test('nudges with the arrow keys, and won’t move a list item', async ({ page }) => {
    const coins = await selectByName(page, 'Coins');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    expect((await propsOf(page, coins)).Position).toEqual([1, -19, 0, 30]);

    const play = await idOf(page, 'PlayButton');
    const before = await propsOf(page, play);
    await page.locator(`.screen .gui[data-id="${play}"]`).click();
    expect(await selectedName(page)).toBe('PlayButton');
    const canvas = (await page.locator('.canvas').boundingBox())!;
    await page.mouse.click(canvas.x + 8, canvas.y + 8); // empty space: nothing selected
    expect(await selectedName(page)).toBeNull();
    const p = center(await boxOf(page, play));
    await drag(page, p, 40, 30);
    await expect(page.getByRole('status')).toContainText('A UIListLayout places this object');
    expect(await propsOf(page, play)).toEqual(before);
    await expect(page.locator('.overlay .selbox.locked')).toHaveCount(1);
    await expect(page.locator('.overlay .anchor-dot')).toHaveCount(0);
  });

  test('duplicates, deletes, copies and pastes from the keyboard', async ({ page }) => {
    const coins = await selectByName(page, 'Coins');
    const count = () => page.evaluate(() => Object.keys(window.framecraft!.doc.instances).length);
    const n = await count();

    // Coins holds 7 objects: the copy brings them all.
    await page.keyboard.press('Control+d');
    expect(await count()).toBe(n + 8);
    const copy = await page.evaluate(() => window.framecraft!.state.selection!);
    expect(copy).not.toBe(coins);
    expect((await propsOf(page, copy)).Position).toEqual([1, -8, 0, 32]);

    await page.keyboard.press('Delete');
    expect(await count()).toBe(n);
    expect(await selectedName(page)).toBe('MainMenu');

    await selectByName(page, 'Coins');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    expect(await count()).toBe(n + 8);
    await page.keyboard.press('Control+z');
    expect(await count()).toBe(n);
  });

  test('zooms, fits and switches devices', async ({ page }) => {
    const zoom = page.getByLabel('Zoom', { exact: true });
    const fit = await zoom.textContent();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(parseInt((await zoom.textContent())!)).toBeCloseTo(parseInt(fit!) * 1.25, -1);
    await page.getByRole('button', { name: 'Fit' }).click();
    await expect(zoom).toHaveText(fit!);

    const canvas = page.locator('.canvas');
    const c = center((await canvas.boundingBox())!);
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    expect(parseInt((await zoom.textContent())!)).toBeGreaterThan(parseInt(fit!));

    await page.getByLabel('Device size').selectOption('phoneP');
    const screen = (await page.getByTestId('screen').boundingBox())!;
    expect(screen.width / screen.height).toBeCloseTo(390 / 844, 2);
    await expect(page.locator('.statusline')).toContainText('Screen 390 × 844');
  });

  test('P toggles preview, which hides the selection', async ({ page }) => {
    const coins = await selectByName(page, 'Coins');
    await expect(page.locator('.overlay .selbox')).toHaveCount(1);
    await page.keyboard.press('p');
    await expect(page.locator('.overlay .selbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stop preview' })).toBeVisible();
    // Dragging in preview changes nothing.
    const before = await propsOf(page, coins);
    await drag(page, center(await boxOf(page, coins)), -50, 20);
    expect(await propsOf(page, coins)).toEqual(before);
    await page.keyboard.press('p');
    await expect(page.locator('.overlay .selbox')).toHaveCount(1);
  });
});

test.describe('website pages', () => {
  test('edits only the breakpoint shown', async ({ page }) => {
    const headline = await idOf(page, 'Headline');
    const desktopBox = await boxOf(page, headline);
    await page.getByLabel('Device size').selectOption({ label: 'Phone · 390×844' });
    await expect(page.getByText('Editing Phone')).toBeVisible();

    const z = await zoomOf(page);
    const h = await boxOf(page, headline);
    await drag(page, center(h), 0, 30 * z);
    // The base value stays; Phone gets its own. Auto keeps a pure Scale value in Scale.
    const props = await propsOf(page, headline);
    expect(props.Position).toEqual([0.5, 0, 0.42, 0]);
    const phone = await page.evaluate(() => {
      const ed = window.framecraft!;
      return Object.values(ed.doc.instances).find((i) => i.props.Name === 'Phone')!.id;
    });
    const overrides = await page.evaluate(
      ([id, bp]) =>
        window.framecraft!.doc.instances[id!]!.overrides?.[bp!] as Record<string, unknown>,
      [headline, phone],
    );
    const [xs, xo, ys, yo] = overrides!.Position as number[];
    expect([xs, xo, yo]).toEqual([0.5, 0, 0]);
    // The hero is 844 - 60 px tall on a phone.
    expect(ys).toBeCloseTo(0.42 + 30 / 784, 2);

    await page.getByLabel('Device size').selectOption('desktop');
    await expect(page.getByText('Editing Phone')).toHaveCount(0);
    expect(await boxOf(page, headline)).toEqual(desktopBox);
  });

  test('preview follows links between pages', async ({ page }) => {
    const show = page.getByLabel('Show');
    const pricing = await idOf(page, 'Pricing');
    await page.getByRole('button', { name: 'Preview' }).click();
    await page
      .locator('.screen .gui')
      .filter({ hasText: /^Pricing$/ })
      .click();
    await expect(show).toHaveValue('page:' + pricing);
    await page
      .locator('.screen .gui')
      .filter({ hasText: /^Home$/ })
      .click();
    await expect(show).not.toHaveValue('page:' + pricing);
    await page
      .locator('.screen .gui')
      .filter({ hasText: /^Start a subscription$/ })
      .click();
    await expect(show).toHaveValue('page:' + pricing);
  });

  test('draws a page as long as its content', async ({ page }) => {
    await page.getByLabel('Device size').selectOption({ label: 'Phone · 390×844' });
    const pricing = await idOf(page, 'Pricing');
    await page.getByLabel('Show').selectOption('page:' + pricing);
    const height = await page.evaluate(
      () => document.querySelector<HTMLElement>('[data-testid="screen"]')!.offsetHeight,
    );
    // Nav 60 + plans 1000 on a phone.
    expect(height).toBe(1060);
    await expect(page.locator('.overlay .fold')).toHaveCount(1);
  });
});
