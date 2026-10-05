import { expect, test } from '@playwright/test';

test('shows the editor shell with no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Insert and edit tools' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Explorer' })).toBeVisible();
  await expect(page.getByRole('main', { name: 'Viewport' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible();

  // The empty screen keeps the Laptop 1366 x 768 aspect ratio.
  const screen = await page.getByTestId('screen').boundingBox();
  expect(screen).not.toBeNull();
  expect(screen!.width / screen!.height).toBeCloseTo(1366 / 768, 2);

  expect(errors).toEqual([]);
});

test('follows the light and dark themes', async ({ page }) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  expect(await background()).toBe('rgb(232, 235, 241)');

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background()).toBe('rgb(16, 18, 23)');
});

test.describe('at 400px wide', () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test('does not scroll sideways and opens panels as sheets', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const explorer = page.getByRole('complementary', { name: 'Explorer' });
    await expect(explorer).toBeHidden();
    await page.getByRole('button', { name: 'Explorer', exact: true }).click();
    await expect(explorer).toBeVisible();
    await page.getByRole('button', { name: 'Close Explorer' }).click();
    await expect(explorer).toBeHidden();
  });
});
