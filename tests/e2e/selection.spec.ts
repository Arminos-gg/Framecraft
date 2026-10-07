import { expect, test, type Page } from '@playwright/test';

/**
 * Picking and moving several things: Ctrl and Shift clicks in the Explorer and the viewport,
 * a box drawn on empty space, the right-click menu, Folders, and panning with the middle
 * button.
 */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)!.id,
    name,
  );
const selectedNames = (page: Page) =>
  page.evaluate(() => {
    const ed = window.framecraft!;
    return ed.state.selected.map((s) => ed.doc.instances[s]!.props.Name);
  });
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });
const showScreens = (page: Page) =>
  page.evaluate(() => {
    window.framecraft!.select(null);
    window.framecraft!.setView({ kind: 'screens' });
  });

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('selects several rows in the Explorer and edits them together', async ({ page }) => {
  await showScreens(page);
  await page.evaluate(() => {
    const ed = window.framecraft!;
    const menu = Object.values(ed.doc.instances).find((i) => i.props.Name === 'MainMenu')!;
    ed.setExpanded(menu.id, true);
  });
  await row(page, 'Coins').click();
  await row(page, 'Version').click({ modifiers: ['ControlOrMeta'] });
  expect(await selectedNames(page)).toEqual(['Coins', 'Version']);
  await expect(row(page, 'Coins')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'Version')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.selhead')).toContainText('2 objects');
  // Shift selects the range between.
  await row(page, 'Coins').click();
  await row(page, 'Version').click({ modifiers: ['Shift'] });
  expect(await selectedNames(page)).toEqual(['Coins', 'Panel', 'Version']);

  // One edit changes all of them.
  const field = page.locator('#p-ZIndex');
  await field.fill('5');
  await field.press('Enter');
  const z = await page.evaluate(() => {
    const ed = window.framecraft!;
    return ed.state.selected.map(
      (s) => (ed.doc.instances[s]!.props as unknown as { ZIndex: number }).ZIndex,
    );
  });
  expect(z).toEqual([5, 5, 5]);
  // Every selected object is outlined on the canvas.
  await expect(page.locator('.overlay .selbox[data-many]')).toHaveCount(3);
});

test('right-clicks a row to rename, group into a Folder, ungroup and delete', async ({ page }) => {
  await showScreens(page);
  const coins = await idOf(page, 'Coins');
  await page.evaluate((id) => window.framecraft!.select(id), coins);
  const menu = page.getByRole('menu', { name: 'Object actions' });

  await row(page, 'Coins').click({ button: 'right' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Rename' }).click();
  await expect(menu).toBeHidden();
  const input = page.getByRole('textbox', { name: 'Rename Coins' });
  await input.fill('Wallet');
  await input.press('Enter');
  await expect(row(page, 'Wallet')).toBeVisible();

  await row(page, 'Version').click({ modifiers: ['ControlOrMeta'] });
  await row(page, 'Version').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Group into a Folder' }).click();
  await expect(row(page, 'Folder')).toHaveAttribute('aria-selected', 'true');
  expect(
    await page.evaluate(() => {
      const ed = window.framecraft!;
      return ed.doc.instances[ed.state.selection!]!.children.map(
        (c) => ed.doc.instances[c]!.props.Name,
      );
    }),
  ).toEqual(['Wallet', 'Version']);
  // Objects in a Folder still draw where they were.
  await expect(page.locator(`.screen .gui[data-id="${coins}"]`)).toBeVisible();

  await row(page, 'Folder').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Ungroup' }).click();
  await expect(row(page, 'Folder')).toHaveCount(0);
  expect(await selectedNames(page)).toEqual(['Wallet', 'Version']);

  await row(page, 'Version').click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Delete 2 objects' }).click();
  await expect(row(page, 'Wallet')).toHaveCount(0);
  await expect(row(page, 'Version')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(row(page, 'Wallet')).toBeVisible();
});

test('the menu opens from the keyboard and closes with Escape', async ({ page }) => {
  await showScreens(page);
  await page.evaluate(async () => {
    const ed = window.framecraft!;
    ed.select(Object.values(ed.doc.instances).find((i) => i.props.Name === 'Panel')!.id);
  });
  await row(page, 'Panel').focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Object actions' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(row(page, 'Panel')).toBeFocused();
});

test('adds to the selection with Shift, moves both, and right-clicks on the canvas', async ({
  page,
}) => {
  await showScreens(page);
  const coins = page.locator(`.screen .gui[data-id="${await idOf(page, 'Coins')}"]`);
  const version = page.locator(`.screen .gui[data-id="${await idOf(page, 'Version')}"]`);
  // A click on Coins lands on its Amount label, so pick Coins itself first.
  const coinsId = await idOf(page, 'Coins');
  await page.evaluate((id) => window.framecraft!.select(id), coinsId);
  await version.click({ modifiers: ['Shift'] });
  expect(await selectedNames(page)).toEqual(['Coins', 'Version']);

  const before = await page.evaluate(() => {
    const ed = window.framecraft!;
    return ed.state.selected.map(
      (s) => (ed.doc.instances[s]!.props as unknown as { Position: number[] }).Position,
    );
  });
  const b = (await coins.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2 + 20, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2 - 40, b.y + b.height / 2 + 40, { steps: 6 });
  await page.mouse.up({});
  const after = await page.evaluate(() => {
    const ed = window.framecraft!;
    return ed.state.selected.map(
      (s) => (ed.doc.instances[s]!.props as unknown as { Position: number[] }).Position,
    );
  });
  expect(await selectedNames(page)).toEqual(['Coins', 'Version']);
  for (const i of [0, 1]) {
    expect(after[i]![1]).toBeLessThan(before[i]![1]!);
    expect(after[i]![3]).toBeGreaterThan(before[i]![3]!);
  }
  // Both moved by the same amount.
  expect(after[0]![1]! - before[0]![1]!).toBe(after[1]![1]! - before[1]![1]!);

  await version.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Object actions' });
  await expect(menu.getByRole('menuitem', { name: 'Delete 2 objects' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('a box drawn from empty space selects what is inside it', async ({ page }) => {
  await showScreens(page);
  const coins = (await page
    .locator(`.screen .gui[data-id="${await idOf(page, 'Coins')}"]`)
    .boundingBox())!;
  await page.mouse.move(coins.x + coins.width + 4, coins.y + coins.height + 6);
  await page.mouse.down();
  await page.mouse.move(coins.x - 10, coins.y - 10, { steps: 8 });
  await expect(page.locator('.marquee')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.marquee')).toHaveCount(0);
  expect(await selectedNames(page)).toEqual(['Coins']);
});

test('the middle button pans the canvas', async ({ page }) => {
  await page.evaluate(() => window.framecraft!.setZoom(2));
  const canvas = page.locator('.canvas');
  const start = await canvas.evaluate((el) => [el.scrollLeft, el.scrollTop]);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'middle' });
  await expect(canvas).toHaveClass(/panning/);
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 - 80, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  const end = await canvas.evaluate((el) => [el.scrollLeft, el.scrollTop]);
  expect(end[0]! - start[0]!).toBeCloseTo(120, -1);
  expect(end[1]! - start[1]!).toBeCloseTo(80, -1);
  await expect(canvas).not.toHaveClass(/panning/);
});
