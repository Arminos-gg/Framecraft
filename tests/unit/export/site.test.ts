import { describe, expect, it } from 'vitest';
import { changedDecls, exportSite, pageFiles, slug } from '../../../src/export/site.ts';
import { addAsset } from '../../../src/model/assets.ts';
import {
  applyCommand,
  insert,
  remove,
  setPreview,
  type Command,
} from '../../../src/model/commands.ts';
import {
  childOfClass,
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type Instance,
  type InstanceId,
} from '../../../src/model/document.ts';
import type { PropsOf } from '../../../src/model/classes.ts';
import { bp, byName, site } from '../model/helpers.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const page = (id: string, props: Partial<PropsOf<'Page'>>) =>
  createInstance('Page', props, id) as Instance<'Page'>;

const text = (files: ReturnType<typeof exportSite>, path: string) => {
  const f = files.find((x) => x.path === path);
  expect(f, path).toBeDefined();
  return f!.contents as string;
};

function edit(doc: Doc, ...cmds: Command[]): Doc {
  return cmds.reduce((d, c) => applyCommand(d, c).doc, doc);
}
const set = (id: InstanceId, props: Record<string, unknown>): Command => ({
  type: 'setProps',
  id,
  props,
});

describe('page files', () => {
  it('puts each page in a folder named after its path', () => {
    const files = pageFiles([
      page('a', { Path: '/' }),
      page('b', { Path: '/pricing' }),
      page('c', { Path: '/About Us/Team/' }),
    ]);
    expect([...files.values()].map((f) => f.file)).toEqual([
      'index.html',
      'pricing/index.html',
      'about-us/team/index.html',
    ]);
    expect(files.get('c')!.depth).toBe(2);
  });

  it('makes the first page the home page when none is at /', () => {
    const files = pageFiles([page('a', { Path: '/start' }), page('b', { Path: '/next' })]);
    expect(files.get('a')!.file).toBe('index.html');
    expect(files.get('b')!.file).toBe('next/index.html');
  });

  it('keeps two pages with the same path apart, and writes the 404 page', () => {
    const files = pageFiles([
      page('a', { Path: '/' }),
      page('b', { Path: '/blog' }),
      page('c', { Path: '/blog' }),
      page('d', { Path: '/', Name: 'Contact' }),
      page('e', { Path: '/missing', NotFound: true }),
    ]);
    expect(files.get('c')!.file).toBe('blog-2/index.html');
    expect(files.get('d')!.file).toBe('contact/index.html');
    expect(files.get('e')).toEqual({ file: '404.html', depth: 0, url: '404.html' });
  });

  it('turns names into web-safe slugs', () => {
    expect(slug('  Our Plans & Prices! ')).toBe('our-plans-prices');
  });
});

describe('the sample site', () => {
  const doc = site();
  const files = exportSite(doc);
  const home = text(files, 'index.html');

  it('writes the home page first, then the others', () => {
    expect(files.map((f) => f.path)).toEqual(['index.html', 'pricing/index.html']);
  });

  it('fills in the page head', () => {
    expect(home).toContain('<html lang="en">');
    expect(home).toContain('<title>Northwind Coffee</title>');
    expect(home).toContain(
      '<meta name="description" content="Small-batch coffee, roasted every week.">',
    );
    expect(home).not.toContain('canonical');
    expect(home).toContain('family=Fraunces:wght@600;700&family=Inter:wght@500;600');
  });

  it('writes the font, weight and letter spacing, with a media query when it changes', () => {
    let doc = site();
    const headline = byName(doc, 'Headline').id;
    doc = edit(doc, set(headline, { FontStyle: 'Italic', LetterSpacing: -1.5 }), {
      type: 'setProps',
      id: headline,
      props: { LetterSpacing: 0.5 },
      breakpoint: bp(doc, 'Phone'),
    });
    const html = text(exportSite(doc, {}), 'index.html');
    expect(html).toContain('family=Fraunces:ital,wght@0,700;1,600&family=Inter');
    expect(html).toContain(
      'font-family:"Fraunces", Georgia, serif;font-weight:600;font-style:italic;',
    );
    expect(html).toContain('letter-spacing:-1.5px;');
    const phone = html.indexOf('@media (max-width: 809px)');
    expect(phone).toBeGreaterThan(0);
    expect(html.indexOf('letter-spacing:0.5px;')).toBeGreaterThan(phone);
  });

  it('writes each breakpoint’s changes as a media query, widest first', () => {
    const tablet = home.indexOf('@media (max-width: 1199px)');
    const phone = home.indexOf('@media (max-width: 809px)');
    expect(tablet).toBeGreaterThan(0);
    expect(phone).toBeGreaterThan(tablet);
    // Headline: Tablet changes its width and text size; Phone changes them again.
    expect(home.slice(tablet, phone)).toMatch(/\.e\d+\{width:calc\(100% \+ -96px\);\}/);
    expect(home.slice(tablet, phone)).toContain('font-size:44px;');
    expect(home.slice(phone)).toContain('font-size:34px;');
    // Phone hides the nav links.
    expect(home.slice(phone)).toContain('display:none;');
  });

  it('paints the page background, see-through when asked', () => {
    expect(home).toContain('body{background-color:rgb(');
    const home2 = text(
      exportSite(edit(doc, set(byName(doc, 'Home').id, { BackgroundTransparency: 0.5 }))),
      'index.html',
    );
    expect(home2).toMatch(/body\{background-color:rgba\(\d+, \d+, \d+, 0\.5\);\}/);
  });

  it('stacks the sections with flexbox and sizes them in vh', () => {
    expect(home).toContain(
      '.pc{--vh:100vh;min-height:var(--vh);display:flex;flex-direction:column;',
    );
    expect(home).toContain('height:calc(var(--vh) * 1 + -72px);');
  });
});

describe('links, tags and pictures', () => {
  const base = site();
  const homeId = byName(base, 'Home').id;
  const pricingId = byName(base, 'Pricing').id;

  it('links between pages with relative paths, and to sections by name', () => {
    const doc = edit(
      base,
      set(byName(base, 'HomeLink', 'Pricing').id, { Link: { kind: 'page', page: homeId } }),
      set(byName(base, 'PricingLink', 'Home').id, {
        Link: { kind: 'page', page: pricingId, section: 'Plans' },
      }),
      set(byName(base, 'PricingLink', 'Pricing').id, {
        Link: { kind: 'page', page: pricingId, section: 'plans' },
      }),
    );
    const files = exportSite(doc);
    expect(text(files, 'index.html')).toMatch(
      /<a class="g e\d+" href="pricing\/index.html#plans" data-btn data-name="PricingLink">/,
    );
    const pricing = text(files, 'pricing/index.html');
    expect(pricing).toContain('href="../index.html"');
    expect(pricing).toContain('href="#plans"');
    expect(pricing).toMatch(/<div class="g e\d+" id="plans" data-name="Plans">/);
  });

  it('opens outside links in a new tab when asked, and never nests links', () => {
    const subscribe = byName(base, 'Subscribe').id;
    const hero = byName(base, 'Hero').id;
    const doc = edit(
      base,
      set(hero, { Link: { kind: 'url', url: 'https://example.com/shop' } }),
      set(subscribe, { Link: { kind: 'url', url: 'https://example.com/join', newTab: true } }),
    );
    const html = text(exportSite(doc), 'index.html');
    expect(html).toContain('<a class="g e');
    expect(html).toContain('href="https://example.com/shop"');
    // The button sits inside the linked hero, so it stays a plain element.
    expect(html).not.toContain('https://example.com/join');
  });

  it('drops a link to a page that is gone', () => {
    const doc = edit(
      base,
      set(byName(base, 'Logo', 'Home').id, { Link: { kind: 'page', page: 'gone' } }),
    );
    expect(text(exportSite(doc), 'index.html')).toMatch(/<div class="g e\d+" data-name="Logo">/);
  });

  it('uses the chosen tag, with only phrasing content inside a heading', () => {
    const doc = edit(
      base,
      set(byName(base, 'Headline').id, { HtmlTag: 'h1' }),
      set(byName(base, 'Nav', 'Home').id, { HtmlTag: 'nav' }),
    );
    const html = text(exportSite(doc), 'index.html');
    expect(html).toMatch(
      /<h1 class="g e\d+" data-name="Headline">\n\s+<span class="t e\d+t"><span>Coffee/,
    );
    expect(html).toMatch(/<nav class="g e\d+" data-name="Nav">/);
  });

  it('tints pictures per breakpoint, with a filter for every color used', () => {
    const { assets, id } = addAsset({}, PNG);
    const img = createInstance('ImageLabel', { Name: 'Icon' }, 'img') as AnyInstance;
    const doc = edit(base, insert(byName(base, 'Plans').id, single(img)), setPreview('img', id), {
      type: 'setProps',
      id: 'img',
      props: { ImageColor3: [0, 0, 0] },
      breakpoint: bp(base, 'Phone'),
    });
    const pricing = text(exportSite(doc, assets), 'pricing/index.html');
    expect(pricing).toContain('<filter id="fc-tint-000000"');
    expect(pricing).toMatch(
      /@media \(max-width: 809px\) \{[^@]*\.e\d+i\{filter:url\(#fc-tint-000000\);\}/,
    );
  });

  it('writes pictures as files, with alt text, the favicon and a social image', () => {
    const { assets, id } = addAsset({}, PNG);
    const img = createInstance(
      'ImageLabel',
      { Name: 'Beans', AltText: 'A bag of beans' },
      'img',
    ) as AnyInstance;
    let doc = edit(base, insert(byName(base, 'Plans').id, single(img)), setPreview('img', id));
    doc = edit(
      doc,
      set(serviceOf(doc, 'Site').id, { Favicon: id, BaseUrl: 'https://northwind.example/' }),
      set(pricingId, { SocialImage: id }),
    );
    const files = exportSite(doc, assets);
    expect(files.map((f) => f.path)).toEqual([
      'index.html',
      'pricing/index.html',
      `images/${id}.png`,
    ]);
    expect(files[2]!.contents).toEqual(
      Uint8Array.from(atob('iVBORw0KGgo='), (c) => c.charCodeAt(0)),
    );
    const pricing = text(files, 'pricing/index.html');
    expect(pricing).toMatch(
      new RegExp(`<img class="img e\\d+i" src="\\.\\./images/${id}\\.png" alt="A bag of beans">`),
    );
    expect(pricing).toContain(`<link rel="icon" href="../images/${id}.png">`);
    expect(pricing).toContain(
      `<meta property="og:image" content="https://northwind.example/images/${id}.png">`,
    );
    expect(pricing).toContain('<link rel="canonical" href="https://northwind.example/pricing/">');
    expect(text(files, 'index.html')).toContain(
      '<link rel="canonical" href="https://northwind.example/">',
    );
  });
});

describe('AutomaticSize on a page', () => {
  it('says which way a box grows per breakpoint, and lets free-placed boxes grow the page', () => {
    let doc = site();
    const pricing = byName(doc, 'Pricing');
    const note = createInstance(
      'TextLabel',
      { Name: 'Note', Text: 'Prices include tax.', TextWrapped: true },
      'note',
    ) as AnyInstance;
    doc = edit(doc, insert(pricing.id, single(note)), {
      type: 'setProps',
      id: 'note',
      props: { AutomaticSize: 'Y' },
      breakpoint: bp(doc, 'Phone'),
    });
    let pricingPage = text(exportSite(doc), 'pricing/index.html');
    expect(pricingPage).toContain('data-auto data-name="Note"');
    const phone = pricingPage.indexOf('@media (max-width: 809px)');
    expect(pricingPage.slice(0, phone)).toMatch(/--auto:none;/);
    expect(pricingPage.slice(phone)).toMatch(/--auto:y;/);
    // The page stacks its sections with a list, so it grows by itself.
    expect(pricingPage).toContain('<div class="c pc">');

    doc = edit(doc, remove(childOfClass(doc, pricing.id, 'UIListLayout')!.id));
    pricingPage = text(exportSite(doc), 'pricing/index.html');
    expect(pricingPage).toContain('<div class="c pc" data-grow>');
  });
});

describe('changedDecls', () => {
  it('keeps what changed and resets what a breakpoint drops', () => {
    expect(
      changedDecls(
        [
          ['width', '10px'],
          ['transform', 'translate(-50%, 0%)'],
          ['display', 'none'],
        ],
        [
          ['width', '20px'],
          ['height', '5px'],
        ],
      ),
    ).toEqual([
      ['width', '20px'],
      ['height', '5px'],
      ['transform', 'none'],
      ['display', 'block'],
    ]);
  });
});

describe('a project without pages', () => {
  it('exports nothing', () => {
    const doc = site();
    const empty = { ...doc, instances: { ...doc.instances } };
    const siteId = serviceOf(doc, 'Site').id;
    for (const p of [byName(doc, 'Home').id, byName(doc, 'Pricing').id]) delete empty.instances[p];
    empty.instances[siteId] = { ...empty.instances[siteId]!, children: [] };
    expect(exportSite(empty)).toEqual([]);
  });
});
