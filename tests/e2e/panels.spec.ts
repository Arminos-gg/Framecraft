import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Explorer, the Ribbon, the Properties panel with an editor for every value type, the
 * Code tab, the export dialog, the Project menu and autosave.
 */

const idOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => Object.values(window.framecraft!.doc.instances).find((i) => i.props.Name === n)!.id,
    name,
  );
const instanceOf = (page: Page, id: string) =>
  page.evaluate((i) => {
    const inst = window.framecraft!.doc.instances[i];
    return inst && { ...inst, props: inst.props as Record<string, unknown> };
  }, id);
const propsOf = async (page: Page, id: string) => (await instanceOf(page, id))!.props;
const selectByName = async (page: Page, name: string) => {
  const id = await idOf(page, name);
  await page.evaluate((i) => window.framecraft!.select(i), id);
  return id;
};
const selection = (page: Page) => page.evaluate(() => window.framecraft!.state.selection);
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true }).first();
/** Types into a property field and commits it, as a user would. */
async function commit(page: Page, selector: string, text: string) {
  const field = page.locator(selector);
  await field.click();
  await field.fill(text);
  await field.press('Enter');
}

/** A 1 x 1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

test.describe('Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
  });

  test('renames with a double-click and with F2', async ({ page }) => {
    const id = await selectByName(page, 'Version');
    await row(page, 'Version').locator('.nm').dblclick();
    await page.getByRole('textbox', { name: 'Rename Version' }).fill('Footer');
    await page.keyboard.press('Enter');
    expect((await propsOf(page, id)).Name).toBe('Footer');

    // The row has focus again, so F2 renames it; Escape keeps the name.
    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: 'Rename Footer' }).fill('Credits');
    await page.keyboard.press('Escape');
    expect((await propsOf(page, id)).Name).toBe('Footer');
    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: 'Rename Footer' }).fill('Credits');
    await page.keyboard.press('Enter');
    expect((await propsOf(page, id)).Name).toBe('Credits');
    await page.keyboard.press('Control+z');
    expect((await propsOf(page, id)).Name).toBe('Footer');
  });

  test('drags an object into another', async ({ page }) => {
    const version = await selectByName(page, 'Version');
    const panel = await idOf(page, 'Panel');
    await row(page, 'Version').dragTo(row(page, 'Panel'));
    expect((await instanceOf(page, version))!.parent).toBe(panel);
    // It keeps its place on screen and stays selected.
    expect(await selection(page)).toBe(version);
    await expect(row(page, 'Version')).toHaveAttribute('aria-level', '4');
  });

  test('reorders by dropping on the top edge of a row', async ({ page }) => {
    await selectByName(page, 'Version');
    const coins = (await row(page, 'Coins').boundingBox())!;
    await row(page, 'Version').dragTo(row(page, 'Coins'), {
      targetPosition: { x: coins.width / 2, y: 2 },
    });
    const order = await page.evaluate(() => {
      const ed = window.framecraft!;
      const menu = Object.values(ed.doc.instances).find((i) => i.props.Name === 'MainMenu')!;
      return menu.children.map((c) => ed.doc.instances[c]!.props.Name);
    });
    expect(order.slice(0, 3)).toEqual(['Version', 'Coins', 'Panel']);
  });

  test('hovering a row outlines its object in the viewport', async ({ page }) => {
    await page.evaluate(() => window.framecraft!.select(null));
    await row(page, 'MainMenu').click();
    await page.keyboard.press('ArrowRight');
    await row(page, 'Coins').hover();
    await expect(page.locator('.overlay .hoverbox')).toHaveCount(1);
    await page.mouse.move(1, 1);
    await expect(page.locator('.overlay .hoverbox')).toHaveCount(0);
  });

  test('moves through the tree with the arrow keys', async ({ page }) => {
    await row(page, 'MainMenu').click();
    await expect(row(page, 'MainMenu')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'MainMenu')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    expect(await selection(page)).toBe(await idOf(page, 'Coins'));
    await page.keyboard.press('ArrowDown');
    expect(await selection(page)).toBe(await idOf(page, 'Panel'));
    await page.keyboard.press('ArrowLeft');
    expect(await selection(page)).toBe(await idOf(page, 'MainMenu'));
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'MainMenu')).toHaveAttribute('aria-expanded', 'false');
    // The keys moved the selection, not the objects.
    expect((await propsOf(page, await idOf(page, 'Panel'))).Position).toEqual([0.5, 0, 0.5, 0]);
  });

  test('hides with the eye, inserts with +, and filters', async ({ page }) => {
    const version = await selectByName(page, 'Version');
    await page.getByRole('button', { name: 'Hide Version' }).click();
    expect((await propsOf(page, version)).Visible).toBe(false);
    await expect(row(page, 'Version')).toHaveClass(/\boff\b/);
    await page.getByRole('button', { name: 'Show Version' }).click();
    expect((await propsOf(page, version)).Visible).toBe(true);

    const panel = await selectByName(page, 'Panel');
    await page.getByRole('button', { name: 'Insert into Panel' }).click();
    await page.getByPlaceholder('Search objects').fill('imagel');
    await page.keyboard.press('Enter');
    const added = await instanceOf(page, (await selection(page))!);
    expect(added!.className).toBe('ImageLabel');
    expect(added!.parent).toBe(panel);

    await page.getByPlaceholder('Filter objects').fill('play');
    await expect(row(page, 'PlayButton')).toBeVisible();
    await expect(row(page, 'Buttons')).toBeVisible();
    await expect(row(page, 'Coins')).toHaveCount(0);
  });
});

test.describe('Ribbon', () => {
  test('inserts a Frame that takes Studio shorthand, then converts it', async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
    await page.locator('[data-insert="Frame"]').click();
    const frame = (await selection(page))!;
    expect((await instanceOf(page, frame))!.className).toBe('Frame');

    await commit(page, '#p-Size', '0.25,40,0.1,20');
    await commit(page, '#p-Position', '0.5');
    let props = await propsOf(page, frame);
    expect(props.Size).toEqual([0.25, 40, 0.1, 20]);
    expect(props.Position).toEqual([0.5, 0, 0.5, 0]);
    // A value that isn't a UDim2 is refused, and the field says so.
    await commit(page, '#p-Size', 'big');
    await expect(page.locator('#p-Size')).toHaveClass(/\bbad\b/);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'To Scale' }).click();
    props = await propsOf(page, frame);
    const size = props.Size as number[];
    expect([size[1], size[3]]).toEqual([0, 0]);
    expect(size[0]).toBeGreaterThan(0.25);

    // Modifiers go on the selection, once each (UIStroke aside).
    await page.locator('[data-insert="UICorner"]').click();
    const corner = await instanceOf(page, (await selection(page))!);
    expect(corner!.className).toBe('UICorner');
    expect(corner!.parent).toBe(frame);
  });

  test('sets what dragging writes', async ({ page }) => {
    await page.getByRole('button', { name: 'Offset', exact: true }).click();
    expect(await page.evaluate(() => window.framecraft!.state.unit)).toBe('offset');
    await page.getByLabel('Smart snapping').uncheck();
    expect(await page.evaluate(() => window.framecraft!.state.snap)).toBe(false);
  });
});

test.describe('Properties', () => {
  test('edits text, numbers, checkboxes and lists', async ({ page }) => {
    const id = await selectByName(page, 'Version');
    await commit(page, '#p-Text', 'v2');
    await commit(page, '#p-LayoutOrder', '7');
    await page.locator('#p-LayoutOrder').press('ArrowUp');
    await commit(page, '#p-Rotation', '15');
    await commit(page, '#p-TextSize', '-4');
    await page.locator('#p-Visible').uncheck();
    await page.locator('#p-Font').selectOption('Arial');
    const props = await propsOf(page, id);
    expect(props).toMatchObject({
      Text: 'v2',
      LayoutOrder: 8,
      Rotation: 15,
      Visible: false,
      Font: 'Arial',
    });
    // TextSize can't go below 1.
    expect(props.TextSize).toBe(1);
    // Escape puts the field back without an edit.
    await page.locator('#p-Text').fill('nope');
    await page.locator('#p-Text').press('Escape');
    expect((await propsOf(page, id)).Text).toBe('v2');
  });

  test('edits colors, transparency and AnchorPoint', async ({ page }) => {
    const id = await selectByName(page, 'Coins');
    await commit(page, '#p-BackgroundColor3', '#ff8000');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([255, 128, 0]);
    // One number is a gray, as in Studio.
    await commit(page, '#p-BackgroundColor3', '255');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([255, 255, 255]);
    await commit(page, '#p-BackgroundColor3', '0');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([0, 0, 0]);
    await page.getByLabel('BackgroundColor3 picker').fill('#00ff00');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([0, 255, 0]);

    await commit(page, '#p-BackgroundTransparency', '0.5');
    expect((await propsOf(page, id)).BackgroundTransparency).toBe(0.5);
    await page.getByLabel('BackgroundTransparency slider').fill('0.25');
    expect((await propsOf(page, id)).BackgroundTransparency).toBe(0.25);

    await page.getByRole('button', { name: 'Pick an AnchorPoint' }).click();
    await page.getByRole('button', { name: 'AnchorPoint 0.5, 0.5' }).click();
    expect((await propsOf(page, id)).AnchorPoint).toEqual([0.5, 0.5]);
  });

  test('edits UDim, UDim2 parts and gradients', async ({ page }) => {
    const coins = await idOf(page, 'Coins');
    await selectByName(page, 'Coins');
    await page.getByRole('button', { name: 'Show Size X and Y' }).click();
    await commit(page, '#p-Size-Xo', '200');
    await commit(page, '#p-Size-Ys', '0.1');
    expect((await propsOf(page, coins)).Size).toEqual([0, 200, 0.1, 52]);

    // The UICorner on Coins: a UDim.
    await page.getByRole('button', { name: 'UICorner', exact: true }).click();
    const corner = (await selection(page))!;
    await commit(page, '#p-CornerRadius-o', '12');
    expect((await propsOf(page, corner)).CornerRadius).toEqual([0.5, 12]);

    const gradient = await selectByName(page, 'UIGradient');
    await page.getByLabel('Color start color').fill('#000000');
    await commit(page, '#p-Transparency-0', '0.5');
    const props = await propsOf(page, gradient);
    expect((props.Color as { value: number[] }[])[0]!.value).toEqual([0, 0, 0]);
    expect((props.Transparency as { value: number }[])[0]!.value).toBe(0.5);
  });

  test('sets images, pictures and links', async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
    await page.locator('[data-insert="ImageLabel"]').click();
    const image = (await selection(page))!;
    await commit(page, '#p-Image', 'rbxassetid://123');
    expect((await propsOf(page, image)).Image).toBe('rbxassetid://123');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload preview picture' }).click();
    await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('.gui[data-id="' + image + '"] img.pic')).toBeVisible();
    expect((await instanceOf(page, image))!.preview).toMatch(/^img_/);

    const home = await selectByName(page, 'Home');
    const socialChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload SocialImage' }).click();
    await (await socialChooser).setFiles({ name: 'card.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('button', { name: 'Remove SocialImage' })).toBeVisible();
    expect((await propsOf(page, home)).SocialImage).toMatch(/^img_/);

    const logo = await selectByName(page, 'Logo');
    const pricing = await idOf(page, 'Pricing');
    await page.getByLabel('Link', { exact: true }).selectOption('page');
    await page.getByLabel('Linked page').selectOption({ label: 'Pricing' });
    await commit(page, '#p-Link-section', 'plans');
    await page.getByLabel('Open in a new tab').check();
    expect((await propsOf(page, logo)).Link).toEqual({
      kind: 'page',
      page: pricing,
      section: 'plans',
      newTab: true,
    });
    await page.getByLabel('Link', { exact: true }).selectOption('url');
    await commit(page, '#p-Link-url', 'https://example.org');
    expect((await propsOf(page, logo)).Link).toEqual({
      kind: 'url',
      url: 'https://example.org',
      newTab: true,
    });
  });

  test('changes a breakpoint only, and goes back to the inherited value', async ({ page }) => {
    const headline = await selectByName(page, 'Headline');
    const phone = await idOf(page, 'Phone');
    await page.getByLabel('Device size').selectOption({ label: 'Phone · 390×844' });
    await expect(page.locator('.bpbar')).toContainText('Phone');
    const before = (await propsOf(page, headline)).TextSize;
    await commit(page, '#p-TextSize', '30');
    let inst = await instanceOf(page, headline);
    expect(inst!.props.TextSize).toBe(before);
    expect((inst!.overrides as Record<string, Record<string, unknown>>)[phone]!.TextSize).toBe(30);
    // Text isn't per breakpoint, so it changes everywhere.
    await commit(page, '#p-Text', 'Fresh coffee');
    expect((await propsOf(page, headline)).Text).toBe('Fresh coffee');

    await page.getByRole('button', { name: /^TextSize is changed for Phone/ }).click();
    inst = await instanceOf(page, headline);
    const overrides = (inst!.overrides ?? {}) as Record<string, Record<string, unknown>>;
    expect(overrides[phone]).not.toHaveProperty('TextSize');
  });

  test('shows the selection as code', async ({ page }) => {
    await selectByName(page, 'Coins');
    await page.getByRole('tab', { name: 'Code' }).click();
    const code = page.getByLabel('Luau', { exact: true });
    await expect(code).toContainText('local coins = Instance.new("Frame")');
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    await expect(page.locator('.code .ln.hi')).toContainText('data-name="Coins"');
  });
});

test.describe('export and project files', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('downloads the website and copies the Luau', async ({ page }) => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export' });
    await expect(dialog.getByRole('tab', { name: 'Website' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(dialog.getByText('pricing/index.html')).toBeVisible();
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download website.zip' }).click();
    const zip = await readFile((await (await download).path())!);
    expect(zip.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');

    await dialog.getByRole('tab', { name: 'Luau for Studio' }).click();
    await expect(dialog.getByLabel('Exported Luau')).toContainText('game:GetService("StarterGui")');
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.getByText('Copied to clipboard')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      'local mainMenu = Instance.new("ScreenGui")',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('saves a project file and opens it again', async ({ page }) => {
    const download = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const file = (await (await download).path())!;

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New Roblox UI' }).click();
    expect(await page.evaluate(() => Object.keys(window.framecraft!.doc.instances).length)).toBe(6);
    // Undo in the toast brings the project back.
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await expect(row(page, 'Home')).toBeVisible();

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New website' }).click();
    await expect(row(page, 'Pricing')).toHaveCount(0);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Open project file…' }).click();
    await (
      await chooser
    ).setFiles({
      name: 'framecraft-project.json',
      mimeType: 'application/json',
      buffer: await readFile(file),
    });
    await expect(page.getByText('Opened framecraft-project.json.')).toBeVisible();
    await expect(row(page, 'Pricing')).toBeVisible();

    // A file that isn't a project changes nothing.
    const other = page.waitForEvent('filechooser');
    await page.keyboard.press('Control+o');
    await (
      await other
    ).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.getByRole('status')).toContainText(/isn.t a Framecraft project/);
    await expect(row(page, 'Pricing')).toBeVisible();
  });

  test('keeps the project and the theme after a reload', async ({ page }) => {
    const id = await selectByName(page, 'Headline');
    await commit(page, '#p-Text', 'Kept');
    await expect(page.locator('.saved')).toHaveText('Saved');

    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    expect((await propsOf(page, id)).Text).toBe('Kept');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
