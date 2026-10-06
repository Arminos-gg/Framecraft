import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function scan(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).exclude('.ruler').analyze();
  for (const v of r.violations) {
    console.log(`[${label}] ${v.id} (${v.impact}): ${v.help}`);
    for (const n of v.nodes.slice(0, 6))
      console.log(
        '   ',
        n.target.join(' '),
        '|',
        n.failureSummary?.split('\n').slice(1, 3).join(' '),
      );
    if (v.nodes.length > 6) console.log(`    ... ${v.nodes.length} nodes`);
  }
  return r.violations;
}

for (const scheme of ['light', 'dark'] as const)
  test(`explore ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await scan(page, scheme + ' start');
    await page.getByRole('treeitem').nth(3).click();
    await scan(page, scheme + ' selected');
    await page.getByRole('tab', { name: 'Code' }).click();
    await scan(page, scheme + ' code');
    await page.getByRole('tab', { name: 'Properties' }).click();
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await scan(page, scheme + ' menu');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+e');
    await scan(page, scheme + ' export');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: /template/ }).click();
    await scan(page, scheme + ' templates');
    expect(1).toBe(1);
  });
