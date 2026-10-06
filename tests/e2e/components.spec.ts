import { expect, test, type Page } from '@playwright/test';
import { themeFor } from '../../src/model/components/theme.ts';

/**
 * The Components drawer: opening it from the ribbon, finding a component, previewing it in a
 * look, and adding a plain copy with the Add button or by dragging it onto the viewport.
 */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)?.id,
    name,
  );
const drawer = (page: Page) => page.getByRole('region', { name: 'Components' });
const card = (page: Page, id: string) => page.locator(`.ccard[data-component="${id}"]`);
const count = (page: Page) =>
  page.evaluate(() => Object.keys(window.framecraft!.doc.instances).length);
const showPage = async (page: Page, name: string) => {
  const id = await idOf(page, name);
  await page.getByLabel('Show').selectOption('page:' + id);
};

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

test('opens from the ribbon, shows what fits the view and searches', async ({ page }) => {
  await showPage(page, 'Home');
  const button = page.locator('[data-components]');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(drawer(page)).toBeVisible();
  // Search has focus when the drawer opens.
  await expect(drawer(page).getByRole('searchbox')).toBeFocused();
  // A website shows website components and the ones for both, not Roblox ones.
  await expect(card(page, 'pricing')).toBeVisible();
  await expect(card(page, 'buttons')).toBeVisible();
  await expect(card(page, 'hotbar')).toHaveCount(0);
  await drawer(page).getByRole('button', { name: 'All', exact: true }).first().click();
  await expect(card(page, 'hotbar')).toBeVisible();

  // Enter in the search previews the first match.
  await drawer(page).getByRole('searchbox').fill('foot');
  await expect(page.locator('.ccard')).toHaveCount(1);
  await drawer(page).getByRole('searchbox').press('Enter');
  await expect(page.locator('.cdetail')).toHaveAttribute('aria-label', 'Footer');
  await drawer(page).getByRole('searchbox').fill('nothing like this');
  await expect(page.getByText('Nothing matches')).toBeVisible();

  // Escape closes the preview, then the drawer.
  await page.keyboard.press('Escape');
  await expect(page.locator('.cdetail')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('adds a section to the end of a page, as one undo step', async ({ page }) => {
  await showPage(page, 'Home');
  await page.locator('[data-components]').click();
  await card(page, 'pricing').click();
  const add = page.locator('[data-add-component="pricing"]');
  await expect(add).toHaveText('Add to Home');
  const before = await count(page);
  await add.click();

  const added = await page.evaluate(() => {
    const f = window.framecraft!;
    const sel = f.doc.instances[f.state.selection!]!;
    const page = f.doc.instances[sel.parent!]!;
    const orders = page.children
      .map((id) => f.doc.instances[id]!.props as { LayoutOrder?: number })
      .filter((p) => p.LayoutOrder !== undefined)
      .map((p) => p.LayoutOrder!);
    return {
      name: sel.props.Name,
      parent: page.props.Name,
      last: (sel.props as { LayoutOrder: number }).LayoutOrder === Math.max(...orders),
    };
  });
  expect(added).toEqual({ name: 'Pricing', parent: 'Home', last: true });
  expect(await count(page)).toBeGreaterThan(before + 10);
  const toast = page.getByRole('status');
  await expect(toast).toContainText('Pricing table added to Home');

  // The toast's Undo takes the whole component away.
  await toast.getByRole('button', { name: 'Undo' }).click();
  expect(await count(page)).toBe(before);
});

test('wraps a block in a section of its own on a page', async ({ page }) => {
  await showPage(page, 'Home');
  await page.evaluate(() => window.framecraft!.select(null));
  await page.locator('[data-components]').click();
  await card(page, 'card').dblclick();
  const placed = await page.evaluate(() => {
    const f = window.framecraft!;
    const sel = f.doc.instances[f.state.selection!]!;
    const section = f.doc.instances[sel.parent!]!;
    return {
      name: sel.props.Name,
      section: section.props.Name,
      tag: (section.props as { HtmlTag: string }).HtmlTag,
      page: f.doc.instances[section.parent!]!.className,
    };
  });
  expect(placed).toEqual({ name: 'Card', section: 'CardSection', tag: 'section', page: 'Page' });
});

test('adds a Roblox piece in the look picked', async ({ page }) => {
  await page.getByLabel('Show').selectOption('screens');
  await page.locator('[data-components]').click();
  await expect(card(page, 'pricing')).toHaveCount(0);
  await card(page, 'hotbar').click();
  const detail = page.locator('.cdetail');
  await expect(detail.getByRole('button', { name: 'Dark' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await detail.getByRole('button', { name: 'Light' }).click();
  await detail.getByRole('button', { name: 'Sharp' }).click();
  await page.locator('[data-add-component="hotbar"]').click();

  const added = await page.evaluate(() => {
    const f = window.framecraft!;
    const sel = f.doc.instances[f.state.selection!]!;
    const corners = Object.values(f.doc.instances).filter(
      (i) => i.className === 'UICorner' && f.doc.instances[i.parent!]!.parent === sel.id,
    );
    return {
      name: sel.props.Name,
      parent: f.doc.instances[sel.parent!]!.className,
      slot: (
        f.doc.instances[sel.children.find((id) => f.doc.instances[id]!.props.Name === 'Slot1')!]!
          .props as unknown as { BackgroundColor3: number[] }
      ).BackgroundColor3,
      sharp: corners.every(
        (c) => (c.props as unknown as { CornerRadius: number[] }).CornerRadius[1]! <= 2,
      ),
    };
  });
  expect(added.name).toBe('Hotbar');
  expect(added.parent).toBe('ScreenGui');
  expect(added.sharp).toBe(true);
  // Slots are the Light look's surface color, not the Dark look's.
  expect(added.slot).toEqual(
    themeFor({ look: 'light', corners: 'sharp', target: 'roblox' }).c.surface,
  );
});

test('adds a component dragged onto the viewport', async ({ page }) => {
  await page.getByLabel('Show').selectOption('screens');
  await page.locator('[data-components]').click();
  const before = await count(page);
  await card(page, 'wallet').dragTo(page.locator('.canvas'), {
    targetPosition: { x: 200, y: 200 },
  });
  await expect.poll(() => count(page)).toBeGreaterThan(before);
  await expect(page.getByRole('status')).toContainText('Currency counter added to');
});
