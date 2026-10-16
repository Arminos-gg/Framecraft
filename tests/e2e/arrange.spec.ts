import { expect, test, type Page } from '@playwright/test';

/** Align, space evenly and lock, from the Properties panel, the Explorer and the keyboard. */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)!.id,
    name,
  );
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
  await page.evaluate(() => {
    const ed = window.framecraft!;
    const menu = Object.values(ed.doc.instances).find((i) => i.props.Name === 'MainMenu')!;
    ed.setView({ kind: 'screens' });
    ed.setExpanded(menu.id, true);
  });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('aligns from the Properties panel and the keyboard', async ({ page }) => {
  await row(page, 'Coins').click();
  await page.getByRole('button', { name: 'Align center in parent' }).click();
  const coins = await idOf(page, 'Coins');
  const read = () =>
    page.evaluate((id) => {
      const p = window.framecraft!.doc.instances[id]!.props as Record<string, unknown>;
      return [p.Position, p.AnchorPoint];
    }, coins);
  expect((await read())[1]).toEqual([0.5, 0]);
  expect(((await read())[0] as number[]).slice(0, 2)).toEqual([0.5, 0]);
  await page.keyboard.press('Alt+KeyA');
  expect(((await read())[0] as number[]).slice(0, 2)).toEqual([0, 0]);
  await expect(page.getByRole('button', { name: 'Space evenly across' })).toBeDisabled();
});

test('a locked object lets clicks through and keeps its place', async ({ page }) => {
  await row(page, 'Coins').hover();
  await page.getByRole('button', { name: 'Lock Coins' }).click();
  await expect(page.getByRole('button', { name: 'Unlock Coins' })).toBeVisible();
  const coins = await idOf(page, 'Coins');
  // A click on it in the viewport picks what's behind it instead.
  await page.locator(`.screen .gui[data-id="${coins}"]`).click({ force: true });
  const sel = await page.evaluate(() => window.framecraft!.state.selection);
  expect(sel).not.toBe(coins);
  // Picked in the Explorer it shows a lock and no handles, and the arrows leave it be.
  await row(page, 'Coins').click();
  await expect(page.locator('.lockbadge')).toBeVisible();
  await expect(page.locator('.handle')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+Shift+KeyL');
  await expect(page.getByRole('button', { name: 'Unlock Coins' })).toHaveCount(0);
});
