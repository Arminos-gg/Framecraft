import { describe, expect, it } from 'vitest';
import { pagesOf } from '../../../src/editor/editor.ts';
import {
  codeOwner,
  liveLuau,
  liveWeb,
  prettyCss,
  SCREENS_FILE,
  shortenData,
} from '../../../src/editor/live-code.ts';
import { exportHtml, isGui } from '../../../src/export/html.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportSite } from '../../../src/export/site.ts';
import { classDef } from '../../../src/model/classes.ts';
import { serviceOf, subtreeIds, type AnyInstance, type Doc } from '../../../src/model/document.ts';
import { sampleProject } from '../../../src/model/sample.ts';
import { TEMPLATES } from '../../../src/model/templates/index.ts';

const byName = (doc: Doc, name: string): AnyInstance =>
  Object.values(doc.instances).find((i) => i.props.Name === name)!;

/** The lines that belong to an object. */
const linesOf = (
  code: { lines: readonly string[]; owners: readonly (string | null)[] },
  id: string,
) => code.lines.filter((_, i) => code.owners[i] === id);

describe('live code', () => {
  const doc = sampleProject();
  const home = pagesOf(doc)[0]!;

  it('shows a page as its HTML file, with the CSS beside it', () => {
    const web = liveWeb(doc, {}, home.id)!;
    expect(web.file).toBe('index.html');
    // Copying takes the file exactly as it downloads.
    expect(web.full).toBe(exportSite(doc).find((f) => f.path === 'index.html')!.contents);
    // The style sheet is folded away in the HTML and shown as CSS, one declaration per line.
    const fold = web.html.lines.findIndex((l) => l === '<style>…</style>');
    expect(web.html.folded.has(fold)).toBe(true);
    expect(web.html.lines.join('\n')).not.toContain('font-family');
    expect(web.css.lines).toContain('  font-family: "Fraunces", Georgia, serif;');
  });

  it('knows which object each line belongs to', () => {
    const web = liveWeb(doc, {}, home.id)!;
    const headline = byName(doc, 'Headline');
    expect(linesOf(web.html, headline.id)).toEqual([
      '          <h1 class="g e7" data-name="Headline">',
      expect.stringContaining('<span class="t e7t">'),
      '          </h1>',
    ]);
    const css = linesOf(web.css, headline.id);
    expect(css).toContain('.e7 {');
    expect(css).toContain('.e7t > * {');
    expect(css).toContain('    font-size: 34px;'); // Phone's media query
    // The page owns its own rules; the fixed boilerplate belongs to nobody.
    expect(linesOf(web.css, home.id)).toContain('body {');
    expect(web.css.owners[web.css.lines.indexOf('.g {')]).toBeNull();
    // Every object on the page has code of its own.
    for (const id of subtreeIds(doc, home.id)) {
      const inst = doc.instances[id]!;
      if (isGui(inst)) expect(linesOf(web.html, id).length, inst.props.Name).toBeGreaterThan(0);
    }
  });

  it('marks the nearest object with code for a modifier', () => {
    const web = liveWeb(doc, {}, home.id)!;
    const button = byName(doc, 'Subscribe');
    const corner = button.children
      .map((c) => doc.instances[c]!)
      .find((c) => c.className === 'UICorner')!;
    expect(codeOwner(doc, corner.id, web.css)).toBe(button.id);
    expect(codeOwner(doc, null, web.css)).toBeUndefined();
  });

  it('shows the Roblox screens as Luau, line by line', () => {
    const luau = liveLuau(doc);
    expect(luau.full).toBe(exportLuau(doc, 'command'));
    const coins = byName(doc, 'Coins');
    const own = linesOf(luau.luau, coins.id);
    expect(own[0]).toBe('-- Coins (Frame)');
    expect(own).toContain('local coins = Instance.new("Frame")');
    expect(own).toContain('coins.Parent = mainMenu');
    // A modifier's lines are its own.
    const corner = coins.children
      .map((c) => doc.instances[c]!)
      .find((c) => c.className === 'UICorner')!;
    expect(linesOf(luau.luau, corner.id)).toContain('coinsCorner.Parent = coins');
    expect(codeOwner(doc, corner.id, luau.luau)).toBe(corner.id);
    // Every Roblox object has lines.
    for (const id of subtreeIds(doc, serviceOf(doc, 'StarterGui').id).slice(1))
      if (!classDef(doc.instances[id]!.className).web)
        expect(linesOf(luau.luau, id).length).toBeGreaterThan(0);
  });

  it('shows the Roblox screens as one web page', () => {
    const web = liveWeb(doc, {}, undefined, 'grid')!;
    expect(web.file).toBe(SCREENS_FILE);
    expect(web.full).toBe(exportHtml(doc, { backdrop: 'grid' }));
    const menu = byName(doc, 'MainMenu');
    expect(linesOf(web.html, menu.id)[0]).toContain('class="screen s1"');
    expect(linesOf(web.css, menu.id)[0]).toBe('.s1 {');
  });

  it('gives every object on every template page some code', () => {
    for (const t of TEMPLATES.filter((t) => t.kind === 'site')) {
      const tdoc = t.build();
      for (const page of pagesOf(tdoc)) {
        const web = liveWeb(tdoc, {}, page.id)!;
        // Braces stay balanced, so nothing was lost in reformatting.
        const css = web.css.lines.join('\n');
        expect(css.split('{').length, t.name).toBe(css.split('}').length);
        for (const id of subtreeIds(tdoc, page.id).slice(1)) {
          const inst = tdoc.instances[id]!;
          if (isGui(inst)) expect(linesOf(web.html, id).length, inst.props.Name).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('prettyCss', () => {
  it('writes one declaration per line, keeping strings and media queries whole', () => {
    const owners = new Map([['e1', 'a']]);
    const css = [
      '  /* A note that runs',
      '     over two lines. */',
      '  .g { position: absolute; margin: 0; }',
      '  .e1{width:10px;mask-image:url("data:image/svg+xml;utf8,<svg/>");}',
      '  @media (max-width: 809px) {',
      '    .e1{width:20px;}',
      '  }',
    ].join('\n');
    const out = prettyCss(css, owners);
    expect(out.lines).toEqual([
      '/* A note that runs',
      '   over two lines. */',
      '.g {',
      '  position: absolute;',
      '  margin: 0;',
      '}',
      '.e1 {',
      '  width: 10px;',
      '  mask-image: url("data:image/svg+xml;utf8,<svg/>");',
      '}',
      '@media (max-width: 809px) {',
      '  .e1 {',
      '    width: 20px;',
      '  }',
      '}',
    ]);
    expect(out.owners).toEqual([
      ...[null, null, null, null, null, null],
      ...['a', 'a', 'a', 'a'],
      null,
      ...['a', 'a', 'a'],
      null,
    ]);
  });

  it('shortens long data addresses for reading', () => {
    const long = 'data:image/png;base64,' + 'A'.repeat(500);
    expect(shortenData(`<img src="${long}">`)).toBe(`<img src="${long.slice(0, 48)}…">`);
    expect(shortenData('url("data:image/svg+xml,%3Csvg%3E")')).toBe(
      'url("data:image/svg+xml,%3Csvg%3E")',
    );
  });
});
