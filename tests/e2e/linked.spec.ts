import { expect, test, type Page } from '@playwright/test';

/**
 * Linked components: making one from the right-click menu, copies that change together,
 * each copy's own text with Reset, Detach, and adding a copy from the Components drawer.
 */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)!.id,
    name,
  );
/** The copies' roots of the only component, in tree order. */
const copies = (page: Page) =>
  page.evaluate(() => {
    const doc = window.framecraft!.doc;
    const c = Object.values(doc.components ?? {})[0];
    if (!c) return [];
    return Object.values(doc.instances)
      .filter((i) => i.copyOf?.component === c.id && i.copyOf.key === c.rootId)
      .map((i) => i.id);
  });
/** A property of the object named `name` inside each copy. */
const inCopies = (page: Page, name: string, key: string) =>
  page.evaluate(
    ({ name, key }) => {
      const doc = window.framecraft!.doc;
      return Object.values(doc.instances)
        .filter((i) => i.copyOf && i.props.Name === name)
        .map((i) => (i.props as Record<string, unknown>)[key]);
    },
    { name, key },
  );
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
  const pricing = await idOf(page, 'Pricing');
  await page.getByLabel('Show').selectOption('page:' + pricing);
  await page.evaluate(() => {
    const ed = window.framecraft!;
    const doc = ed.doc;
    for (const n of ['Pricing', 'Plans']) {
      const inst = Object.values(doc.instances).find((i) => i.props.Name === n)!;
      ed.setExpanded(inst.id, true);
    }
  });
});
test.afterEach(() => expect(errors).toEqual([]));

test('makes a component whose copies change together', async ({ page }) => {
  await row(page, 'Taster').click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Make component/ }).click();
  await expect(page.getByRole('status').last()).toContainText('Taster is a component now');
  expect(await copies(page)).toHaveLength(1);

  // Duplicates are linked copies, marked in the Explorer, which says so.
  await row(page, 'Taster, copy of Taster').click();
  await page.keyboard.press('ControlOrMeta+d');
  await page.keyboard.press('ControlOrMeta+d');
  expect(await copies(page)).toHaveLength(3);
  await expect(page.locator('.row .cmark')).toHaveCount(3);
  await expect(page.getByRole('group', { name: 'Copy of Taster' })).toContainText('3 copies');

  // A color changed in one copy changes in all of them.
  const [, second] = await copies(page);
  await page.evaluate((root) => {
    const ed = window.framecraft!;
    const doc = ed.doc;
    const price = doc.instances[root]!.children.find(
      (c) => doc.instances[c]!.props.Name === 'Price',
    )!;
    ed.setProp(price, 'TextColor3', [200, 30, 30]);
  }, second!);
  expect(await inCopies(page, 'Price', 'TextColor3')).toEqual([
    [200, 30, 30],
    [200, 30, 30],
    [200, 30, 30],
  ]);

  // Text stays each copy's own, with a dot that puts the component's back.
  const name = await page.evaluate((root) => {
    const ed = window.framecraft!;
    const doc = ed.doc;
    const id = doc.instances[root]!.children.find(
      (c) => doc.instances[c]!.props.Name === 'PlanName',
    )!;
    ed.setProp(id, 'Text', 'Weekly');
    ed.select(id);
    return id;
  }, second!);
  expect(await inCopies(page, 'PlanName', 'Text')).toEqual(['Taster', 'Weekly', 'Taster']);
  await expect(page.getByRole('group', { name: 'Copy of Taster' })).toContainText(
    'In Taster, a copy of',
  );
  await page.getByRole('button', { name: /Text is this copy’s own/ }).click();
  expect(await inCopies(page, 'PlanName', 'Text')).toEqual(['Taster', 'Taster', 'Taster']);
  await page.evaluate((id) => window.framecraft!.setProp(id, 'Text', 'Weekly'), name);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(await inCopies(page, 'PlanName', 'Text')).toEqual(['Taster', 'Taster', 'Taster']);

  // Undo takes the color back from every copy.
  for (let i = 0; i < 5; i++) await page.keyboard.press('ControlOrMeta+z');
  const colors = await inCopies(page, 'Price', 'TextColor3');
  expect(colors).toHaveLength(3);
  expect(new Set(colors.map(String)).size).toBe(1);
  expect(colors[0]).not.toEqual([200, 30, 30]);

  // Detach makes a copy plain again.
  await page.getByRole('button', { name: 'Detach', exact: true }).click();
  expect(await copies(page)).toHaveLength(2);
});

test('adds a copy from the Components drawer', async ({ page }) => {
  await page.evaluate(() => {
    const ed = window.framecraft!;
    const taster = Object.values(ed.doc.instances).find((i) => i.props.Name === 'Taster')!;
    ed.select(taster.id);
  });
  await page.keyboard.press('ControlOrMeta+Alt+k');
  expect(await copies(page)).toHaveLength(1);
  await page.locator('[data-components]').click();
  const drawer = page.getByRole('region', { name: 'Components' });
  await drawer.getByRole('button', { name: /^Yours/ }).click();
  await drawer.locator('.ccard[data-your-component]').click();
  await expect(page.locator('.cdetail')).toContainText('1 copy');
  await page.locator('[data-add-copy]').click();
  expect(await copies(page)).toHaveLength(2);
  // The new copy went beside the first, not inside it.
  const parents = await page.evaluate(() => {
    const doc = window.framecraft!.doc;
    return Object.values(doc.instances)
      .filter((i) => i.props.Name === 'Taster')
      .map((i) => doc.instances[i.parent!]!.props.Name);
  });
  expect(parents).toEqual(['Plans', 'Plans']);

  // Deleting the component keeps the copies as plain objects.
  await drawer.locator('.ccard[data-your-component]').click();
  await page.getByRole('button', { name: 'Delete component' }).click();
  expect(await copies(page)).toHaveLength(0);
  await expect(page.locator('.row .cmark')).toHaveCount(0);
});
