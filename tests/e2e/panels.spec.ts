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

    // Studio's full UDim2 in either axis sets both; a lone number of 1 or less is Scale.
    await commit(page, '#p-Size-X', '0.25,40,0.1,20');
    await commit(page, '#p-Position-X', '50%');
    await commit(page, '#p-Position-Y', '0.5');
    let props = await propsOf(page, frame);
    expect(props.Size).toEqual([0.25, 40, 0.1, 20]);
    expect(props.Position).toEqual([0.5, 0, 0.5, 0]);
    await expect(page.locator('#p-Size-X')).toHaveValue('25% + 40px');
    await expect(page.locator('#p-Size-Y')).toHaveValue('10% + 20px');
    // A value that isn't a length is refused, and the field says so.
    await commit(page, '#p-Size-Y', 'big');
    await expect(page.locator('#p-Size-Y')).toHaveClass(/\bbad\b/);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'To percent' }).click();
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
    await page.getByRole('button', { name: 'Pixels', exact: true }).click();
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
    await page.locator('#p-Font').click();
    await page.getByRole('option', { name: /^Arial/ }).click();
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

  test('picks a font from the menu, its weight and its letter spacing', async ({ page }) => {
    const id = await selectByName(page, 'Headline');
    const font = page.locator('#p-Font');
    await expect(font).toHaveText('Fraunces');
    // The menu searches as you type; arrows and Enter pick.
    await font.click();
    const menu = page.getByRole('dialog', { name: 'Fonts' });
    const search = menu.getByRole('combobox');
    await search.fill('dm');
    await expect(menu.getByRole('option')).toHaveText([/^DM Sans/, /^DM Serif Display/]);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(menu).toBeHidden();
    await expect(font).toBeFocused();
    expect((await propsOf(page, id)).Font).toBe('DMSerifDisplay');
    await font.click();
    await search.fill('jakarta');
    await search.press('Enter');
    expect((await propsOf(page, id)).Font).toBe('PlusJakartaSans');
    // Escape closes the menu without a change.
    await font.click();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    expect((await propsOf(page, id)).Font).toBe('PlusJakartaSans');

    // Weights the font has, with their numbers, and a Bold toggle.
    await page.locator('#p-FontWeight').selectOption('Light');
    expect((await propsOf(page, id)).FontWeight).toBe('Light');
    await expect(page.locator('#p-FontWeight option')).toHaveText([
      'ExtraLight · 200',
      'Light · 300',
      'Regular · 400',
      'Medium · 500',
      'SemiBold · 600',
      'Bold · 700',
      'ExtraBold · 800',
    ]);
    const bold = page.getByRole('button', { name: 'Bold', exact: true });
    await bold.click();
    expect((await propsOf(page, id)).FontWeight).toBe('Bold');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    // Ctrl+B and Ctrl+I work on the selection from outside a text field.
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+i');
    expect(await propsOf(page, id)).toMatchObject({ FontWeight: 'Regular', FontStyle: 'Italic' });

    await commit(page, '#p-LetterSpacing', '-1.5');
    expect((await propsOf(page, id)).LetterSpacing).toBe(-1.5);
    const span = page.locator(`.gui[data-id="${id}"] .txt > span`);
    await expect(span).toHaveCSS('letter-spacing', '-1.5px');
    await expect(span).toHaveCSS('font-weight', '400');
    await expect(span).toHaveCSS('font-style', 'italic');

    // Roblox has no letter spacing, so the Roblox screens don't offer it.
    await selectByName(page, 'Version');
    await expect(page.locator('#p-FontWeight')).toBeVisible();
    await expect(page.locator('#p-LetterSpacing')).toHaveCount(0);
  });

  test('grows a label to fit its text with AutomaticSize', async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
    // Text measures differently once web fonts arrive; let them arrive first, so the layout
    // and the Stage are read on the same side of that change.
    await page.evaluate(() => document.fonts.ready);
    const id = await selectByName(page, 'Version');
    await commit(page, '#p-Text', 'A version line much longer than the 260 pixels it has');
    const box = () =>
      page.evaluate((i) => {
        const b = window.framecraft!.scene.layout.get(i)!;
        return { w: b.w, h: b.h };
      }, id);
    expect(await box()).toEqual({ w: 260, h: 20 });

    await page.locator('#p-AutomaticSize').selectOption('X');
    const grown = await box();
    expect(grown.w).toBeGreaterThan(300);
    expect(grown.h).toBe(20);
    // The Stage draws it at the grown size, and Properties says Size is now the smallest.
    const drawn = page.locator(`.screen .gui[data-id="${id}"]`);
    expect((await drawn.boundingBox())!.width).toBeGreaterThan(0);
    expect(await drawn.evaluate((el) => parseFloat(el.style.width))).toBeCloseTo(grown.w, 3);
    await expect(page.getByText('Size is the smallest it gets')).toBeVisible();

    // Wrapped, it keeps its width and grows down instead.
    await page.locator('#p-TextWrapped').check();
    await page.locator('#p-AutomaticSize').selectOption('Y');
    const tall = await box();
    expect(tall.w).toBe(260);
    expect(tall.h).toBeGreaterThan(20);

    await page.locator('#p-AutomaticSize').selectOption('None');
    expect(await box()).toEqual({ w: 260, h: 20 });
    expect((await propsOf(page, id)).AutomaticSize).toBe('None');
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
    // The picker: Hex and R, G, B fields, a drag in the square as one undo step, and the
    // project's own colors.
    await page.getByLabel('BackgroundColor3 picker').click();
    const picker = page.getByRole('dialog', { name: 'BackgroundColor3' });
    await commit(page, '#cp-BackgroundColor3-hex', '00ff00');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([0, 255, 0]);
    await commit(page, '#cp-BackgroundColor3-hex', '255');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([255, 255, 255]);
    await commit(page, '#cp-BackgroundColor3-R', '10');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([10, 255, 255]);
    await page.locator('#cp-BackgroundColor3-B').press('ArrowDown');
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([10, 255, 254]);
    await page.getByLabel('Hue').fill('0');
    const reddish = (await propsOf(page, id)).BackgroundColor3;
    expect(reddish).toEqual([255, 10, 10]);
    const area = (await picker
      .getByRole('slider', { name: 'Saturation and brightness' })
      .boundingBox())!;
    await page.mouse.move(area.x + 2, area.y + 2);
    await page.mouse.down();
    // Past the corner: the drag keeps to the square.
    await page.mouse.move(area.x + area.width + 20, area.y - 20, { steps: 6 });
    await page.mouse.up();
    expect((await propsOf(page, id)).BackgroundColor3).toEqual([255, 0, 0]);
    // The whole drag is one undo step.
    await page.evaluate(() => window.framecraft!.undo());
    expect((await propsOf(page, id)).BackgroundColor3).toEqual(reddish);
    await expect(picker.getByRole('button', { name: /^Use #/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();

    await commit(page, '#p-BackgroundTransparency', '0.5');
    expect((await propsOf(page, id)).BackgroundTransparency).toBe(0.5);
    await page.getByLabel('BackgroundTransparency slider').fill('0.25');
    expect((await propsOf(page, id)).BackgroundTransparency).toBe(0.25);

    await page.getByRole('button', { name: 'Pick an AnchorPoint' }).click();
    await page.getByRole('button', { name: 'AnchorPoint 0.5, 0.5' }).click();
    expect((await propsOf(page, id)).AnchorPoint).toEqual([0.5, 0.5]);
  });

  test('edits lengths in percent and pixels, and gradients', async ({ page }) => {
    const coins = await idOf(page, 'Coins');
    await selectByName(page, 'Coins');
    await expect(page.getByLabel('Size width')).toHaveValue('176px');
    await commit(page, '#p-Size-X', '210px');
    await commit(page, '#p-Size-Y', '10% + 52px');
    expect((await propsOf(page, coins)).Size).toEqual([0, 210, 0.1, 52]);
    // The arrows step pixels, or a percent when that's all there is; Shift steps ten.
    await page.locator('#p-Size-X').press('ArrowUp');
    await page.locator('#p-Size-Y').press('Shift+ArrowDown');
    await commit(page, '#p-Position-X', '50%');
    await page.locator('#p-Position-X').press('ArrowUp');
    expect((await propsOf(page, coins)).Size).toEqual([0, 211, 0.1, 42]);
    expect(((await propsOf(page, coins)).Position as number[]).slice(0, 2)).toEqual([0.51, 0]);
    await expect(page.locator('#p-Size-Y')).toHaveValue('10% + 42px');

    // The UICorner on Coins: a UDim.
    await page.getByRole('button', { name: 'UICorner', exact: true }).click();
    const corner = (await selection(page))!;
    await expect(page.locator('#p-CornerRadius')).toHaveValue('50%');
    await commit(page, '#p-CornerRadius', '50% + 12px');
    expect((await propsOf(page, corner)).CornerRadius).toEqual([0.5, 12]);

    const gradient = await selectByName(page, 'UIGradient');
    await page.getByLabel('Color start color').click();
    await commit(page, '#cp-Color-start-color-hex', '#000000');
    await page.keyboard.press('Escape');
    await commit(page, '#p-Transparency-0', '0.5');
    const props = await propsOf(page, gradient);
    expect((props.Color as { value: number[] }[])[0]!.value).toEqual([0, 0, 0]);
    expect((props.Transparency as { value: number }[])[0]!.value).toBe(0.5);
  });

  test('sets images, pictures and links', async ({ page }) => {
    await page.getByLabel('Show').selectOption('screens');
    await page.locator('[data-insert="ImageLabel"]').click();
    const image = (await selection(page))!;
    await commit(page, '#p-Image-id', 'rbxassetid://123');
    expect((await propsOf(page, image)).Image).toBe('rbxassetid://123');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Image' }).click();
    await (await chooser).setFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.locator('.gui[data-id="' + image + '"] img.pic')).toBeVisible();
    await expect(page.locator('.picfld.big img')).toBeVisible();
    expect((await instanceOf(page, image))!.preview).toMatch(/^img_/);

    // On a page, an image is only its picture: Roblox asset ids don't apply.
    await page.getByLabel('Show').selectOption('page:' + (await idOf(page, 'Home')));
    await page.locator('[data-insert="ImageLabel"]').click();
    await expect(page.getByRole('button', { name: 'Upload Image' })).toBeVisible();
    await expect(page.locator('#p-Image-id')).toHaveCount(0);

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

  test('downloads the Roblox screens as a model file', async ({ page }) => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export' });
    await dialog.getByRole('tab', { name: 'Roblox model' }).click();
    await expect(dialog.getByText('framecraft-ui.rbxmx')).toBeVisible();
    const objects = await page.evaluate(() => {
      const fc = window.framecraft!;
      const starterGui = Object.values(fc.doc.instances).find((i) => i.className === 'StarterGui')!;
      const count = (id: string): number =>
        1 + fc.doc.instances[id]!.children.reduce((n, c) => n + count(c), 0);
      return count(starterGui.id) - 1;
    });
    await expect(dialog.locator('.count')).toContainText(`${objects} objects`);

    const read = async () => {
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Download .rbxmx' }).click();
      const file = await download;
      const xml = await readFile((await file.path())!, 'utf8');
      // The browser's XML parser reads it, with one Item per object.
      const items = await page.evaluate((text) => {
        const parsed = new DOMParser().parseFromString(text, 'application/xml');
        if (parsed.querySelector('parsererror')) return -1;
        return parsed.querySelectorAll('Item').length;
      }, xml);
      return { name: file.suggestedFilename(), items };
    };
    expect(await read()).toEqual({ name: 'framecraft-ui.rbxmx', items: objects });
    await page.keyboard.press('Escape');

    // With a second screen, one screen can be picked on its own.
    await page.evaluate(() => {
      const fc = window.framecraft!;
      const starterGui = Object.values(fc.doc.instances).find((i) => i.className === 'StarterGui')!;
      fc.insert('ScreenGui', starterGui.id);
    });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await dialog.getByRole('tab', { name: 'Roblox model' }).click();
    await expect(dialog.locator('.count')).toContainText(`2 screens, ${objects + 1} objects`);
    await dialog.getByLabel('Which screens').selectOption({ label: 'ScreenGui' });
    await expect(dialog.locator('.count')).toContainText('1 screen, 1 object');
    expect(await read()).toEqual({ name: 'ScreenGui.rbxmx', items: 1 });
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

  test('starts a project from a template', async ({ page }) => {
    const openTemplates = async () => {
      await page.getByRole('button', { name: 'Project', exact: true }).click();
      await page.getByRole('menuitem', { name: 'New from a template…' }).click();
    };
    const dialog = page.getByRole('dialog', { name: 'New from a template' });
    const stage = page.getByTestId('screen');

    await openTemplates();
    // Seven templates, each previewed by drawing its first screen.
    const cards = dialog.locator('.tpl');
    await expect(cards).toHaveCount(7);
    for (const card of await cards.all()) await expect(card.locator('.gui').first()).toBeAttached();
    await dialog.getByRole('button', { name: /^Shop/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status')).toContainText(
      'Started a new project from the Shop template.',
    );
    await expect(row(page, 'Shop')).toBeVisible();
    await expect(stage.getByText('ITEM SHOP')).toBeVisible();

    // Escape leaves the project as it is.
    await openTemplates();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(row(page, 'Shop')).toBeVisible();

    // A website template opens on its first page.
    await openTemplates();
    await dialog.getByRole('button', { name: /^Portfolio/ }).click();
    await expect(stage.getByText('Selected work')).toBeVisible();
    await expect(row(page, 'Shop')).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await expect(row(page, 'Shop')).toBeVisible();
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
