import { expect, test, type Page } from '@playwright/test';

/** Shapes from the ribbon, SVG pictures (uploaded, pasted and dropped) and ImageColor3 tints. */

const instanceOf = (page: Page, id: string) =>
  page.evaluate((i) => {
    const inst = window.framecraft!.doc.instances[i];
    return inst && { ...inst, props: inst.props as Record<string, unknown> };
  }, id);
const selection = (page: Page) => page.evaluate(() => window.framecraft!.state.selection);
/** The SVG markup of an object's picture. */
const svgOf = (page: Page, id: string) =>
  page.evaluate((i) => {
    const ed = window.framecraft!;
    const url = ed.state.assets[ed.doc.instances[i]!.preview!]!;
    return new TextDecoder().decode(
      Uint8Array.from(atob(url.split(',')[1]!), (c) => c.charCodeAt(0)),
    );
  }, id);

/** An icon as icon sites copy it: one color, drawn in currentColor, with a script slipped in. */
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 48" fill="none" stroke="currentColor" stroke-width="2" onload="alert(1)"><script>alert(2)</script><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/></svg>`;
/** A two-color logo, which keeps its colors. */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="40" height="40" fill="#e33"/><circle cx="60" cy="20" r="20"/></svg>`;

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.screen .gui').first()).toBeVisible();
  await page.getByLabel('Show').selectOption('screens');
});
test.afterEach(() => expect(errors).toEqual([]));

test('inserts shapes from the ribbon, tinted by ImageColor3', async ({ page }) => {
  await page.locator('[data-insert="shapes"]').click();
  const menu = page.getByRole('dialog', { name: 'Insert a shape' });
  await expect(menu.locator('.shapebtn')).toHaveCount(24);
  await menu.getByRole('button', { name: 'Star', exact: true }).click();
  await expect(menu).toBeHidden();
  const star = (await selection(page))!;
  const inst = (await instanceOf(page, star))!;
  expect(inst.className).toBe('ImageLabel');
  expect(inst.props.ImageColor3).toEqual([68, 114, 196]);
  const pic = page.locator(`.gui[data-id="${star}"] img.pic`);
  await expect(pic).toBeVisible();
  expect(await pic.evaluate((el) => getComputedStyle(el).filter)).toBe('url("#fc-tint-4472c4")');
  await expect(page.locator('filter#fc-tint-4472c4').first()).toBeAttached();

  // Changing the color changes the tint.
  await page.getByLabel('ImageColor3', { exact: true }).first().fill('255, 0, 0');
  await page.getByLabel('ImageColor3', { exact: true }).first().press('Enter');
  await expect(pic).toHaveCSS('filter', 'url("#fc-tint-ff0000")');

  await page.locator('[data-insert="shapes"]').click();
  await page.getByRole('button', { name: 'Circle', exact: true }).click();
  const circle = (await selection(page))!;
  expect((await instanceOf(page, circle))!.className).toBe('Frame');
  await expect(page.locator(`.gui[data-id="${circle}"]`)).toHaveCSS('border-radius', '50px');
});

test('uploads an SVG and keeps it safe', async ({ page }) => {
  await page.locator('[data-insert="ImageLabel"]').click();
  const image = (await selection(page))!;
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload Image' }).click();
  await (
    await chooser
  ).setFiles({ name: 'bell.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(ICON) });
  await expect(page.locator(`.gui[data-id="${image}"] img.pic`)).toBeVisible();
  const svg = await svgOf(page, image);
  expect(svg).not.toMatch(/script|onload|alert/);
  // One color: white, colored black by ImageColor3, so it looks as it did and can be recolored.
  expect(svg).toContain('color="#fff"');
  expect(svg).toContain('width="24" height="48"');
  expect((await instanceOf(page, image))!.props.ImageColor3).toEqual([0, 0, 0]);
});

test('pastes SVG code as a new image', async ({ page }) => {
  await page.evaluate((svg) => {
    const data = new DataTransfer();
    data.setData('text/plain', svg);
    document.body.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, ICON);
  await expect.poll(() => page.evaluate(() => window.framecraft!.state.selection)).not.toBeNull();
  const icon = (await selection(page))!;
  const inst = (await instanceOf(page, icon))!;
  expect(inst.className).toBe('ImageLabel');
  expect(inst.props).toMatchObject({ Name: 'Icon', Size: [0, 24, 0, 48], ImageColor3: [0, 0, 0] });
  await expect(page.locator(`.gui[data-id="${icon}"] img.pic`)).toBeVisible();
});

test('drops a picture file on the viewport, keeping a logo’s own colors', async ({ page }) => {
  await page.locator('.canvas').evaluate((canvas, svg) => {
    const data = new DataTransfer();
    data.items.add(new File([svg], 'Brand logo.svg', { type: 'image/svg+xml' }));
    canvas.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    );
  }, LOGO);
  await expect
    .poll(async () => {
      const s = await selection(page);
      return s && (await instanceOf(page, s))!.props.Name;
    })
    .toBe('Brand logo');
  const logo = (await selection(page))!;
  expect((await instanceOf(page, logo))!.props).toMatchObject({
    Size: [0, 80, 0, 40],
    ImageColor3: [255, 255, 255],
  });
  expect(await svgOf(page, logo)).not.toContain('color="#fff"');
});

test('still pastes copied objects with Ctrl+V', async ({ page }) => {
  await page.locator('[data-insert="Frame"]').click();
  const frame = (await selection(page))!;
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } });
  await page.evaluate((i) => window.framecraft!.select(i), frame);
  const before = await page.evaluate(() => Object.keys(window.framecraft!.doc.instances).length);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect
    .poll(() => page.evaluate(() => Object.keys(window.framecraft!.doc.instances).length))
    .toBe(before + 1);
});
