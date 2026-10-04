// Smoke test for the prototype.
//
// Loads prototype/dist/framecraft.html in headless Chromium and checks:
//   1. the exports of the untouched sample match the golden files in prototype/examples/
//   2. the exported Luau parses
//   3. the layout engine produces the expected pixel boxes (UDim2, AnchorPoint, UIPadding, UIListLayout)
//   4. the editor's main interactions work (select, drag, resize, undo, shorthand input, convert, reparent)
//   5. no page errors, and no sideways scrolling at phone width
//
// Run:    npm run build && npm test
// First:  npx playwright install chromium
// After an intentional exporter change:  npm run examples   (rewrites the golden files)
import { chromium } from 'playwright';
import luaparse from 'luaparse';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = join(root, 'prototype/dist/framecraft.html');
const examples = join(root, 'prototype/examples');
const out = join(root, 'tests/output');
const updateExamples = process.argv.includes('--update-examples');

if (!existsSync(pagePath)) {
  console.error('prototype/dist/framecraft.html is missing. Run `npm run build` first.');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};
const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(pagePath).href);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* ignore */ } });
  await page.reload();
  await page.waitForTimeout(800);

  // 1 + 2. Golden exports of the sample project
  const luau = await page.evaluate(() => exportLuau('command'));
  const luauLocal = await page.evaluate(() => exportLuau('local'));
  const html = await page.evaluate(() => exportHtml());
  const json = await page.evaluate(() => exportJson());
  const goldens = { 'sample-menu.luau': luau, 'sample-menu.localscript.luau': luauLocal, 'sample-menu.html': html };
  if (updateExamples) {
    mkdirSync(examples, { recursive: true });
    for (const [file, text] of Object.entries(goldens)) writeFileSync(join(examples, file), text);
    writeFileSync(join(examples, 'sample-project.json'), json);
    console.log('Rewrote the golden files in prototype/examples/');
  }
  for (const [file, text] of Object.entries(goldens)) {
    const golden = existsSync(join(examples, file)) ? readFileSync(join(examples, file), 'utf8') : null;
    writeFileSync(join(out, file), text);
    check(`export matches prototype/examples/${file}`, golden === text, golden == null ? 'golden file missing' : golden === text ? '' : `diff: tests/output/${file}`);
  }
  for (const [file, text] of [['command bar Luau', luau], ['LocalScript Luau', luauLocal]]) {
    try { luaparse.parse(text, { luaVersion: '5.1' }); check(`${file} parses`, true); }
    catch (e) { check(`${file} parses`, false, e.message); }
  }

  // 3. Layout numbers at Laptop 1366x768 (Roblox AbsolutePosition / AbsoluteSize)
  const boxes = await page.evaluate(() => {
    const byName = (n) => Object.values(doc.nodes).find((x) => x.props.Name === n);
    const box = (n) => { const b = L[byName(n).id]; return { x: b.x, y: b.y, w: b.w, h: b.h }; };
    return { panel: box('Panel'), coins: box('Coins'), buttons: box('Buttons'), play: box('PlayButton'), shop: box('ShopButton'), settings: box('SettingsButton'), icon: box('CoinIcon') };
  });
  const { panel, coins, buttons, play, shop, settings, icon } = boxes;
  check('Panel: scale size, centered by AnchorPoint 0.5', near(panel.x, 450.78) && near(panel.y, 107.52) && near(panel.w, 464.44) && near(panel.h, 552.96), JSON.stringify(panel));
  check('Coins: AnchorPoint (1,0) with Position {1,-20},{0,20}', near(coins.x, 1170) && near(coins.y, 20) && near(coins.w, 176) && near(coins.h, 52), JSON.stringify(coins));
  check('CoinIcon: centered vertically inside Coins', near(icon.x, 1180) && near(icon.y, 29), JSON.stringify(icon));
  check('Buttons: placed inside the UIPadding area, AnchorPoint (0,1)', near(buttons.x, 474.78) && near(buttons.y, 323.4) && near(buttons.h, 313.08), JSON.stringify(buttons));
  check('UIListLayout: bottom-aligned, LayoutOrder, 0.05 padding', near(play.y, 342.19, 1) && near(shop.y, 445.5, 1) && near(settings.y, 548.81, 1) && near(play.x, buttons.x), `${play.y.toFixed(2)}, ${shop.y.toFixed(2)}, ${settings.y.toFixed(2)}`);
  await page.screenshot({ path: join(out, 'editor.png') });

  // 4. Interactions
  const coinsId = await page.evaluate(() => Object.values(doc.nodes).find((n) => n.props.Name === 'Coins').id);
  await page.click(`#tree .row[data-id="${coinsId}"] .name`);
  const startPos = await page.evaluate((id) => JSON.stringify(node(id).props.Position), coinsId);
  const cb = await page.locator(`#screen .gui[data-id="${coinsId}"]`).boundingBox();
  const cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy + 6, { steps: 4 });
  await page.mouse.move(cx - 60, cy + 12, { steps: 4 });
  const readout = await page.locator('#overlay .readout').count();
  await page.mouse.up();
  const moved = await page.evaluate((id) => ({ pos: JSON.stringify(node(id).props.Position), sel: node(ui.sel).props.Name }), coinsId);
  check('drag moves the selected object (Offset stays Offset)', moved.pos !== startPos && moved.sel === 'Coins' && readout === 1, `${startPos} -> ${moved.pos}`);

  const eh = await page.locator('#overlay .handle[data-h="e"]').boundingBox();
  await page.mouse.move(eh.x + 4, eh.y + 4);
  await page.mouse.down();
  await page.mouse.move(eh.x + 44, eh.y + 4, { steps: 5 });
  await page.mouse.up();
  const size = await page.evaluate((id) => node(id).props.Size, coinsId);
  check('east handle widens the object', size[1] > 176, JSON.stringify(size));

  await page.mouse.click(cx - 45, cy + 12);
  check('a click inside the selection selects the child under the cursor', (await page.evaluate(() => node(ui.sel).props.Name)) === 'Amount');

  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  check('undo restores position and size', (await page.evaluate((id) => JSON.stringify(node(id).props.Position), coinsId)) === startPos);

  await page.click('[data-insert="Frame"]');
  await page.fill('#p-Size', '0.25,40,0.1,20');
  await page.press('#p-Size', 'Enter');
  await page.fill('#p-Position', '0.5');
  await page.press('#p-Position', 'Enter');
  const typed = await page.evaluate(() => [node(ui.sel).props.Size, node(ui.sel).props.Position]);
  check('Studio shorthand in UDim2 fields', JSON.stringify(typed) === JSON.stringify([[0.25, 40, 0.1, 20], [0.5, 0, 0.5, 0]]), JSON.stringify(typed));

  await page.click('#toScale');
  const scaled = await page.evaluate(() => node(ui.sel).props.Size);
  check('To Scale rewrites Size as pure Scale', scaled[1] === 0 && scaled[3] === 0 && scaled[0] > 0.25, JSON.stringify(scaled));

  const versionId = await page.evaluate(() => Object.values(doc.nodes).find((n) => n.props.Name === 'Version').id);
  const panelId = await page.evaluate(() => Object.values(doc.nodes).find((n) => n.props.Name === 'Panel').id);
  await page.dragAndDrop(`#tree .row[data-id="${versionId}"]`, `#tree .row[data-id="${panelId}"]`);
  check('Explorer drag reparents', (await page.evaluate((id) => node(node(id).parent).props.Name, versionId)) === 'Panel');

  await page.keyboard.press('p');
  check('P toggles preview', await page.evaluate(() => ui.preview === true && document.querySelectorAll('#overlay .selbox').length === 0));
  await page.keyboard.press('p');

  await page.selectOption('#deviceSel', 'phoneL');
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, 'editor-phone-landscape.png') });

  // 5. Phone width
  const phone = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => errors.push('phone: ' + String(e)));
  await pp.goto(pathToFileURL(pagePath).href);
  await pp.waitForTimeout(600);
  check('no sideways scrolling at 400px', !(await pp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await pp.screenshot({ path: join(out, 'editor-phone.png') });

  // The exported HTML page renders on its own
  const ep = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  ep.on('pageerror', (e) => errors.push('export: ' + String(e)));
  await ep.goto(pathToFileURL(join(out, 'sample-menu.html')).href);
  await ep.waitForTimeout(600);
  const epPanel = await ep.evaluate(() => { const r = document.querySelector('[data-name="Panel"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  check('exported HTML places Panel like the editor', near(epPanel.x, 450.78, 1) && near(epPanel.y, 107.52, 1) && near(epPanel.w, 464.44, 1), JSON.stringify(epPanel));
  await ep.screenshot({ path: join(out, 'export-page.png') });
} finally {
  await browser.close();
}

check('no page errors', errors.length === 0, errors.join(' | '));
console.log(failures.length ? `\n${failures.length} check(s) failed. Screenshots and exports are in tests/output/.` : '\nAll checks passed. Screenshots and exports are in tests/output/.');
process.exit(failures.length ? 1 : 0);
