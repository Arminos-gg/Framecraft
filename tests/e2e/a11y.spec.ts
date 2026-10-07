/**
 * Accessibility: axe finds nothing in the editor (both themes, with menus and dialogs open) or
 * in the websites the templates export, and everything works from the keyboard.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { exportSite } from '../../src/export/site.ts';
import { sampleSite } from '../../src/model/sample.ts';
import { TEMPLATES } from '../../src/model/templates/index.ts';

/** Selects an object by its Name, as a click in the Explorer would. */
const select = (page: Page, name: string) =>
  page.evaluate((name) => {
    const ed = window.framecraft!;
    ed.select(Object.values(ed.doc.instances).find((i) => i.props.Name === name)!.id);
  }, name);

/** axe's findings, one line per problem and element, so a failure says what to fix. */
async function axe(page: Page) {
  // The rulers' numbers are drawn on the canvas; axe misreads the background of SVG text.
  const r = await new AxeBuilder({ page }).exclude('.ruler').analyze();
  return r.violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} ${n.failureSummary ?? ''}`),
  );
}

for (const scheme of ['light', 'dark'] as const)
  test(`axe finds nothing in the editor in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    expect(await axe(page)).toEqual([]);

    await select(page, 'Headline');
    await page.getByRole('treeitem', { name: 'Headline' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('tab', { name: 'Code' }).click();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('tab', { name: 'Properties' }).click();

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Insert object' }).click();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+e');
    await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: /template/ }).click();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    // The color picker, the right-click menu, several objects at once and the delete popup.
    await page.getByRole('button', { name: 'TextColor3 picker' }).click();
    await expect(page.getByRole('slider', { name: 'Saturation and brightness' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('treeitem', { name: 'Headline' }).click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Object actions' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('treeitem', { name: 'Hero' }).click({ modifiers: ['Shift'] });
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Delete');
    await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible();
    // Once it has slid in, as axe reads colors mid-fade.
    await page
      .locator('.toast')
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await axe(page)).toEqual([]);
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

    await page.getByRole('button', { name: 'Components', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Components' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: 'Close components' }).click();

    await page.keyboard.press('p');
    expect(await axe(page)).toEqual([]);
  });

test('axe finds nothing in the exported sites', async ({ page }) => {
  // The pages link Google Fonts; the fallback fonts measure close enough for contrast.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const sites = [
    { name: 'Sample', doc: sampleSite() },
    ...TEMPLATES.filter((t) => t.kind === 'site').map((t) => ({ name: t.name, doc: t.build() })),
  ];
  const found: string[] = [];
  for (const { name, doc } of sites)
    for (const file of exportSite(doc))
      if (file.path.endsWith('.html')) {
        await page.setContent(file.contents as string);
        found.push(...(await axe(page)).map((v) => `${name} ${file.path}: ${v}`));
      }
  expect(found).toEqual([]);
});

test('F6 moves between the panels', async ({ page }) => {
  await page.goto('/');
  await select(page, 'Headline');
  await page.getByRole('treeitem', { name: 'Headline' }).click();
  const focused = () =>
    page.evaluate(() => {
      const regions = ['.topbar', '.ribbon', '.explorer', '.canvas', '.props'];
      return regions.find((r) => document.querySelector(r)?.contains(document.activeElement));
    });
  expect(await focused()).toBe('.explorer');
  await page.keyboard.press('F6');
  expect(await focused()).toBe('.canvas');
  // Arrows on the canvas nudge the selection.
  const x = () =>
    page.evaluate(
      () => window.framecraft!.scene.layout.get(window.framecraft!.state.selection!)!.x,
    );
  const before = await x();
  await page.keyboard.press('ArrowRight');
  expect(await x()).toBeCloseTo(before + 1, 0);
  await page.keyboard.press('F6');
  expect(await focused()).toBe('.props');
  await page.keyboard.press('F6');
  expect(await focused()).toBe('.topbar');
  await page.keyboard.press('Shift+F6');
  expect(await focused()).toBe('.props');
});

test('says what got selected on the canvas', async ({ page }) => {
  await page.goto('/');
  await select(page, 'Headline');
  await expect(page.getByTestId('announcer')).toHaveText('Selected Headline, TextLabel');
  await page.keyboard.press('Control+a');
  await expect(page.getByTestId('announcer')).toHaveText(/^Selected \d+ objects$/);
});

test('Shift and the arrows select several rows in the Explorer', async ({ page }) => {
  await page.goto('/');
  await select(page, 'Headline');
  const headline = page.getByRole('treeitem', { name: 'Headline' });
  await headline.click();
  await page.keyboard.press('Shift+ArrowDown');
  const selected = page.locator('[role="treeitem"][aria-selected="true"]');
  await expect(selected).toHaveCount(2);
  // One Tab stop: the row Properties shows.
  await expect(page.locator('[role="treeitem"][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[role="treeitem"][tabindex="0"]')).toBeFocused();
  await page.keyboard.press('Shift+ArrowUp');
  await expect(selected).toHaveCount(1);
  await expect(headline).toBeFocused();
});

test('opens the right-click menu from the keyboard', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await select(page, 'Headline');
  // On the canvas.
  const canvas = page.getByRole('group', { name: 'Canvas' });
  await canvas.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Object actions' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(canvas).toBeFocused();

  // In the Explorer; Delete there shows the popup, which stays while focus is on it.
  await page.getByRole('treeitem', { name: 'Headline' }).focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: /Delete/ })).toBeFocused();
  await page.keyboard.press('Enter');
  const undo = page.getByRole('status').getByRole('button', { name: 'Undo' });
  await undo.focus();
  await page.clock.runFor(10_000);
  await expect(undo).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'Headline' })).toBeVisible();
});

test('tabs and the insert menu work from the keyboard', async ({ page }) => {
  await page.goto('/');
  const props = page.getByRole('tab', { name: 'Properties' });
  await props.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Code' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Code' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');

  await select(page, 'Hero');
  await page.getByRole('treeitem', { name: 'Hero' }).click();
  await page.getByRole('button', { name: 'Insert object' }).click();
  const search = page.getByRole('combobox', { name: 'Search objects' });
  await expect(search).toBeFocused();
  await search.fill('label');
  const active = await search.getAttribute('aria-activedescendant');
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('treeitem', { name: /^TextLabel/ })).toBeVisible();
});

test('shows text contrast in Properties and the checks before export', async ({ page }) => {
  await page.goto('/');
  await select(page, 'Headline');
  await page.getByRole('treeitem', { name: 'Headline' }).click();
  await expect(page.getByTestId('contrast')).toContainText(/Contrast \d+(\.\d)?:1\. Easy to read/);

  // Dark gray text on the dark hero fails, and the export dialog lists it.
  await page.getByRole('textbox', { name: 'TextColor3', exact: true }).fill('50, 50, 50');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('contrast')).toContainText('needs 3:1 to be easy to read');
  await page.keyboard.press('Control+e');
  const checks = page.getByRole('region', { name: 'Accessibility checks' });
  await expect(checks).toContainText('Headline');
  await expect(checks).toContainText(/Text contrast is 1\.\d:1/);
  await checks.getByRole('button', { name: 'Show Headline' }).click();
  await expect(page.getByRole('dialog', { name: 'Export' })).toBeHidden();
  await expect(page.getByRole('treeitem', { name: /^Headline/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('button', { name: 'Undo' }).click();
  await page.keyboard.press('Control+e');
  await expect(
    page.getByRole('status').filter({ hasText: 'pass the accessibility checks' }),
  ).toBeVisible();
});

test('follows a link from the keyboard in preview', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('p');
  const link = page.getByRole('link', { name: 'Pricing' }).first();
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Show' })).toHaveValue(/^page:/);
  const shown = await page.evaluate(() => {
    const ed = window.framecraft!;
    const v = ed.state.view;
    return v.kind === 'page' ? ed.doc.instances[v.pageId]!.props.Name : null;
  });
  expect(shown).toBe('Pricing');
});

test('the color picker and the Components drawer work from the keyboard', async ({ page }) => {
  await page.goto('/');
  await select(page, 'Headline');
  const swatch = page.getByRole('button', { name: 'TextColor3 picker' });
  await swatch.focus();
  await page.keyboard.press('Enter');
  const area = page.getByRole('slider', { name: 'Saturation and brightness' });
  await area.focus();
  const before = await swatch.getAttribute('title');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(swatch).not.toHaveAttribute('title', before!);
  await page.keyboard.press('Escape');
  await expect(area).toBeHidden();
  await expect(swatch).toBeFocused();

  // The drawer takes the Explorer's place, so F6 goes there from the ribbon.
  const toggle = page.getByRole('button', { name: 'Components', exact: true });
  await toggle.click();
  await toggle.focus();
  await page.keyboard.press('F6');
  const drawer = page.getByRole('region', { name: 'Components' });
  await expect(drawer.locator(':focus')).toHaveCount(1);
  await drawer.getByRole('searchbox', { name: 'Search components' }).fill('navbar');
  await expect(drawer.getByRole('button', { name: /Navbar/ }).first()).toBeVisible();
});
