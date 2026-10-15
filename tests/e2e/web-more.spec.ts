import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { newSubtree } from '../../src/editor/insert.ts';
import { exportSite } from '../../src/export/site.ts';
import type { ClassName, PropsOf } from '../../src/model/classes.ts';
import { applyCommand, insert } from '../../src/model/commands.ts';
import {
  childrenOf,
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../src/model/document.ts';
import { sampleSite } from '../../src/model/sample.ts';

/**
 * More web-only extras in a real browser: a Form that sends to a form service, YouTube and
 * map embeds, underlined, capital and gradient text, photo filters, mouse pointers and smooth
 * scrolling to a section; and the same in the editor's preview.
 */

const ACTION = 'https://formspree.io/f/test';

/** The sample site with a contact form, a video, a map and styled text on its home page. */
function moreSite(): { doc: Doc; home: InstanceId } {
  let doc = sampleSite();
  let n = 0;
  const makeId = () => `w${++n}`;
  const byName = (name: string, within: InstanceId) =>
    childrenOf(doc, within).find((c) => c.props.Name === name)!.id;
  const home = byName('Home', serviceOf(doc, 'Site').id);
  const add = <C extends ClassName>(parent: InstanceId, c: C, props: Partial<PropsOf<C>>) => {
    const inst = createInstance(c, props, makeId()) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  const set = (id: InstanceId, props: Record<string, unknown>) => {
    doc = applyCommand(doc, { type: 'setProps', id, props }).doc;
  };
  const area = { x: 0, y: 0, w: 1366, h: 768 };
  const page = doc.instances[home]!;
  const form = newSubtree(doc, 'Form', page, area, makeId);
  doc = applyCommand(doc, insert(home, form)).doc;
  set(form.rootId, { Action: ACTION, LayoutOrder: 20, SentText: 'Got it!' });
  add(home, 'Embed', {
    Name: 'Video',
    LayoutOrder: 21,
    Source: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s',
  });
  add(home, 'Embed', { Name: 'Map', LayoutOrder: 22, Kind: 'Map', Source: 'Eiffel Tower' });
  const hero = byName('Hero', home);
  const headline = byName('Headline', hero);
  set(headline, {
    TextCase: 'Uppercase',
    TextDecoration: 'Underline',
    TextColor3: [255, 255, 255],
  });
  add(headline, 'UIGradient', {
    ApplyTo: 'Text',
    Color: [
      { time: 0, value: [255, 0, 0] },
      { time: 1, value: [0, 0, 255] },
    ],
  });
  set(byName('Subscribe', hero), { Cursor: 'Help' });
  // The nav's Home link goes to the form, further down the same page.
  const links = byName('Links', byName('Nav', home));
  set(byName('HomeLink', links), { Link: { kind: 'page', page: home, section: 'Form' } });
  return { doc, home };
}

async function openExport(tab: Page, doc: Doc) {
  const html = exportSite(doc).find((f) => f.path === 'index.html')!.contents as string;
  await tab.setViewportSize({ width: 1366, height: 768 });
  await tab.route(/fonts\.(googleapis|gstatic)\.com|youtube|google\.com|ytimg/, (r) => r.abort());
  await tab.route('**/__export/page.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  );
  await tab.goto('/__export/page.html');
  return html;
}

test.describe('exported website', () => {
  test('a form sends what people type to its Action and says so', async ({ page: tab }) => {
    let sent: { body: string; accept: string | null } | undefined;
    await tab.route(ACTION, async (r) => {
      sent = {
        body: r.request().postData() ?? '',
        accept: r.request().headers()['accept'] ?? null,
      };
      await r.fulfill({
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: '{"ok":true}',
      });
    });
    await openExport(tab, moreSite().doc);
    const form = tab.locator('form[data-name="Form"]');
    await expect(form).toHaveAttribute('action', ACTION);
    const send = form.locator('button[type="submit"]');
    // Required fields stop an empty form.
    await send.click();
    expect(sent).toBeUndefined();
    await form.locator('input[name="Email"]').fill('ada@example.com');
    await expect(form.locator('input[name="Email"]')).toHaveAttribute('type', 'email');
    await form.locator('textarea[name="Message"]').fill('Hello there');
    await send.click();
    await expect(send).toHaveText('Got it!');
    await expect(send).toBeDisabled();
    await expect(form.locator('[role="status"]')).toHaveText('Got it!');
    expect(sent?.accept).toBe('application/json');
    expect(sent?.body).toContain('ada@example.com');
    expect(sent?.body).toContain('Hello there');
    // The form empties for the next message.
    await expect(form.locator('textarea')).toHaveValue('');
  });

  test('a form that can’t send says so and lets people try again', async ({ page: tab }) => {
    await tab.route(ACTION, (r) => r.fulfill({ status: 500, body: '' }));
    await openExport(tab, moreSite().doc);
    const form = tab.locator('form[data-name="Form"]');
    await form.locator('input[name="Email"]').fill('ada@example.com');
    await form.locator('textarea[name="Message"]').fill('Hello');
    const send = form.locator('button[type="submit"]');
    await send.click();
    await expect(send).toHaveText('Couldn’t send. Try again.');
    await expect(send).toBeEnabled();
  });

  test('embeds, text styles and pointers', async ({ page: tab }) => {
    const html = await openExport(tab, moreSite().doc);
    const video = tab.locator('[data-name="Video"] iframe');
    await expect(video).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=65&rel=0',
    );
    await expect(video).toHaveAttribute('title', 'YouTube video');
    await expect(tab.locator('[data-name="Map"] iframe')).toHaveAttribute(
      'src',
      'https://maps.google.com/maps?q=Eiffel%20Tower&z=14&output=embed',
    );
    // The iframe fills its object.
    const box = await tab.locator('[data-name="Video"]').boundingBox();
    const frame = await video.boundingBox();
    expect(frame).toEqual(box);

    const headline = tab.locator('[data-name="Headline"] .t > span');
    const style = await headline.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.textTransform, s.textDecorationLine, s.backgroundClip, s.webkitTextFillColor];
    });
    expect(style).toEqual(['uppercase', 'underline', 'text', 'rgba(0, 0, 0, 0)']);
    expect(
      await tab.locator('[data-name="Subscribe"]').evaluate((el) => getComputedStyle(el).cursor),
    ).toBe('help');
    // The Home link glides to the form on the same page.
    expect(html).toContain('href="#form"');
    expect(html).toContain('html { scroll-behavior: smooth; }');
    await tab.locator('[data-name="HomeLink"]').click();
    await expect.poll(() => tab.evaluate(() => scrollY)).toBeGreaterThan(300);
  });
});

test('axe finds nothing on a page with a form, a video and a map', async ({ page: tab }) => {
  await openExport(tab, moreSite().doc);
  // The players themselves are YouTube's and Google's pages, which the test doesn't load.
  const r = await new AxeBuilder({ page: tab }).exclude('iframe').analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')}`))).toEqual(
    [],
  );
});

test.describe('editor', () => {
  test('the Web menu adds a form, a video and a map to the page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    await page.locator('[data-insert="web"]').click();
    await page.locator('[data-web="form"]').click();
    const formId = await page.evaluate(() => window.framecraft!.state.selection!);
    expect(
      await page.evaluate((id) => window.framecraft!.doc.instances[id]!.className, formId),
    ).toBe('Form');
    // It starts with an email field, a message box and a Send button.
    const kids = await page.evaluate(
      (id) =>
        window.framecraft!.doc.instances[id]!.children.map(
          (c) => window.framecraft!.doc.instances[c]!.props.Name,
        ),
      formId,
    );
    expect(kids).toEqual(['UIPadding', 'UIListLayout', 'UICorner', 'Email', 'Message', 'Send']);

    await page.locator('[data-insert="web"]').click();
    await page.locator('[data-web="map"]').click();
    const map = await page.evaluate(() => window.framecraft!.state.selection!);
    // A map can't hold another object, so the next one goes beside it.
    await page.locator('[data-insert="web"]').click();
    await page.locator('[data-web="video"]').click();
    const video = await page.evaluate(() => {
      const ed = window.framecraft!;
      return ed.doc.instances[ed.state.selection!]!;
    });
    expect(video.props.Name).toBe('Video');
    expect(video.parent).not.toBe(map);
    // While editing, the video is a picture of it; in preview, the real player.
    const el = page.locator(`.screen .gui[data-id="${video.id}"]`);
    await expect(el.locator('.embph')).toBeVisible();
    await page.evaluate(
      (id) => window.framecraft!.setProp(id, 'Source', 'https://youtu.be/dQw4w9WgXcQ'),
      video.id,
    );
    await page.route(/youtube|ytimg|google\.com/, (r) => r.abort());
    await page.evaluate(() => window.framecraft!.setPreview(true));
    await expect(el.locator('iframe')).toHaveAttribute('src', /embed\/dQw4w9WgXcQ/);
  });

  test('the Web menu is for pages, and forms stay on the website', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    await page.evaluate(() => window.framecraft!.setView({ kind: 'screens' }));
    await expect(page.locator('[data-insert="web"]')).toHaveCount(0);
    const result = await page.evaluate(() => window.framecraft!.insert('Form'));
    expect(result).toBeNull();
    await expect(page.locator('.toast')).toContainText('works on the website only');
  });

  test('a form’s button in preview says where it sends', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    const send = await page.evaluate(() => {
      const ed = window.framecraft!;
      const form = ed.insertWeb('form')!;
      ed.setProp(form, 'Action', 'https://formspree.io/f/abc');
      ed.select(null);
      ed.setPreview(true);
      return ed.doc.instances[form]!.children.find(
        (c) => ed.doc.instances[c]!.props.Name === 'Send',
      )!;
    });
    await page.locator(`.screen .gui[data-id="${send}"]`).click();
    await expect(page.locator('.toast')).toContainText('sends the form to formspree.io');
  });

  test('Ctrl+U underlines text on a page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.screen .gui').first()).toBeVisible();
    const id = await page.evaluate(() => {
      const ed = window.framecraft!;
      const t = Object.values(ed.doc.instances).find((i) => i.props.Name === 'Headline')!;
      ed.select(t.id);
      return t.id;
    });
    await page.locator('.canvas').focus();
    await page.keyboard.press('Control+u');
    const span = page.locator(`.screen .gui[data-id="${id}"] .txt > span`);
    await expect
      .poll(() => span.evaluate((el) => getComputedStyle(el).textDecorationLine))
      .toBe('underline');
  });
});
