import { beforeEach, describe, expect, it } from 'vitest';
import { siteChecks } from '../../../src/editor/checks.ts';
import { textContrast } from '../../../src/editor/contrast.ts';
import { buildScene, Editor, formSendNote } from '../../../src/editor/editor.ts';
import { insertableInto } from '../../../src/editor/insert.ts';
import { exportHtml, pictureFilter } from '../../../src/export/html.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportRbxmx } from '../../../src/export/rbxmx.ts';
import { exportSite } from '../../../src/export/site.ts';
import { estimateText } from '../../../src/layout/text.ts';
import { canParent, defaultProps } from '../../../src/model/classes.ts';
import { applyCommand, insert, move } from '../../../src/model/commands.ts';
import {
  breakpointsOf,
  createInstance,
  ModelError,
  single,
  type AnyInstance,
  type InstanceId,
} from '../../../src/model/document.ts';
import { embedSrc, youtubeId, youtubeStart } from '../../../src/model/embeds.ts';
import { sampleProject } from '../../../src/model/sample.ts';

let ed: Editor;
beforeEach(() => {
  ed = new Editor(sampleProject());
});

/** By name, on the home page when another page has one too (each page has a Nav). */
const id = (name: string): InstanceId => {
  const home = Object.values(ed.doc.instances).find((i) => i.props.Name === 'Home')!;
  const own = home.children.find((c) => ed.doc.instances[c]!.props.Name === name);
  if (own) return own;
  const found = Object.values(ed.doc.instances).filter((i) => i.props.Name === name);
  expect(found, name).toHaveLength(1);
  return found[0]!.id;
};
const inst = (i: InstanceId) => ed.doc.instances[i]! as AnyInstance;
const phone = () => breakpointsOf(ed.doc).find((b) => b.props.Name === 'Phone')!.id;
const home = () => exportSite(ed.doc).find((f) => f.path === 'index.html')!.contents as string;
/** The CSS rule for the element whose data-name is `name`, with its class swapped for `.X`. */
function ruleOf(html: string, name: string, suffix = ''): string {
  const cls = new RegExp(`class="g (e\\d+)"[^>]*data-name="${name}"`).exec(html)?.[1];
  expect(cls, `element ${name}`).toBeDefined();
  const rule = new RegExp(`\\.${cls}${suffix.replace(/[.:>*]/g, '\\$&')}\\{([^}]*)\\}`).exec(html);
  return rule?.[1] ?? '';
}

describe('embeds', () => {
  it('read a video id from every kind of YouTube link', () => {
    for (const link of [
      'dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ])
      expect(youtubeId(link), link).toBe('dQw4w9WgXcQ');
    for (const bad of ['', 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/'])
      expect(youtubeId(bad), bad).toBeUndefined();
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90);
    expect(youtubeStart('https://youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s')).toBe(3723);
    expect(youtubeStart('https://youtu.be/dQw4w9WgXcQ')).toBe(0);
  });

  it('make the player or map address', () => {
    const p = { ...defaultProps('Embed'), Source: 'https://youtu.be/dQw4w9WgXcQ?t=5' };
    expect(embedSrc(p)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5&rel=0');
    expect(embedSrc({ ...p, Autoplay: true })).toContain('autoplay=1&mute=1');
    expect(embedSrc({ ...p, Source: 'not a video' })).toBeUndefined();
    const map = { ...p, Kind: 'Map' as const, Source: '10 Downing St, London', Zoom: 16 };
    expect(embedSrc(map)).toBe(
      'https://maps.google.com/maps?q=10%20Downing%20St%2C%20London&z=16&output=embed',
    );
    expect(embedSrc({ ...map, Source: '  ' })).toBeUndefined();
  });

  it('export as an iframe with a title, and hold no objects', () => {
    const video = ed.insertWeb('video', id('Home'))!;
    ed.setProp(video, 'Source', 'https://youtu.be/dQw4w9WgXcQ');
    ed.setProp(video, 'Title', 'Our roastery tour');
    expect(home()).toMatch(
      /<iframe class="emb" src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0" title="Our roastery tour" loading="lazy" allow="[^"]+" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen><\/iframe>/,
    );
    expect(canParent('Frame', 'Embed')).toBe(false);
    expect(canParent('UICorner', 'Embed')).toBe(true);
    // A new map goes last on the page, at its own size.
    const map = ed.insertWeb('map', id('Home'))!;
    expect(inst(map).props).toMatchObject({ Name: 'Map', Kind: 'Map', Size: [0, 560, 0, 360] });
    expect((inst(map).props as { LayoutOrder: number }).LayoutOrder).toBeGreaterThan(
      (inst(video).props as { LayoutOrder: number }).LayoutOrder,
    );
  });
});

describe('forms', () => {
  it('start as a contact form and export a form that sends', () => {
    const form = ed.insertWeb('form', id('Home'))!;
    ed.setProp(form, 'Action', 'https://formspree.io/f/abc');
    const html = home();
    expect(html).toMatch(
      /<form class="g e\d+" action="https:\/\/formspree\.io\/f\/abc" method="post" data-form data-sent="Thanks! Your message was sent\."[^>]* data-name="Form">/,
    );
    expect(html).toContain('type="email" placeholder="Your email"');
    expect(html).toMatch(/<input value="" name="Email" type="email" [^>]*required>/);
    expect(html).toMatch(/<textarea name="Message" [^>]*required><\/textarea>/);
    // The button sends it, and holds only spans.
    expect(html).toMatch(
      /<button class="g e\d+" type="submit" data-btn data-name="Send">\s*<span class="t/,
    );
    expect(html).toContain('<span class="fc-status" role="status"></span>');
    expect(html).toContain('form.querySelectorAll(\'button[type="submit"]\')');
    expect(html).toContain(':where(button.g)');
    // Pages without a form get none of it.
    const pricing = exportSite(ed.doc).find((f) => f.path === 'pricing/index.html')!;
    expect(pricing.contents).not.toContain('data-form');
    expect(pricing.contents).not.toContain('button.g');
  });

  it('keep a TextBox outside a form as it was', () => {
    const box = ed.insert('TextBox', id('Home'))!;
    expect(home()).toMatch(
      new RegExp(`<input value="" placeholder="Type here" aria-label="Type here">`),
    );
    ed.setProp(box, 'Required', true);
    expect(home()).toContain('aria-label="Type here" required>');
  });

  it('stay on the website: no Form or Embed in a Roblox screen', () => {
    const screen = Object.values(ed.doc.instances).find((i) => i.className === 'ScreenGui')!;
    expect(insertableInto(ed.doc, screen.id).objects).not.toContain('Form');
    expect(insertableInto(ed.doc, id('Home')).objects).toEqual(
      expect.arrayContaining(['Form', 'Embed']),
    );
    expect(ed.insertWeb('form', screen.id)).not.toBeNull(); // goes to the page shown instead
    const form = createInstance('Form', {}, 'f1') as unknown as AnyInstance;
    expect(() => applyCommand(ed.doc, insert(screen.id, single(form)))).toThrow(ModelError);
    const folder = ed.insert('Folder', id('Home'))!;
    ed.insertWeb('video', folder);
    expect(() => applyCommand(ed.doc, move(folder, screen.id))).toThrow(/website only/);
    // A whole page with a form still moves among pages.
    const site = Object.values(ed.doc.instances).find((i) => i.className === 'Site')!;
    expect(() => applyCommand(ed.doc, move(id('Home'), site.id, 1))).not.toThrow();
  });

  it('say in preview where they send', () => {
    expect(formSendNote({ Action: '', SentText: 'x' })).toContain('Give the Form an Action');
    expect(formSendNote({ Action: 'https://formspree.io/f/abc', SentText: 'Done' })).toBe(
      'On the website, this sends the form to formspree.io, and the button then says “Done”.',
    );
  });

  it('show up in the website checks until they can send and show something', () => {
    const form = ed.insertWeb('form', id('Home'))!;
    const video = ed.insertWeb('video', id('Home'))!;
    const kinds = () => siteChecks(ed.doc).map((c) => c.kind);
    expect(kinds()).toEqual(expect.arrayContaining(['form', 'embed']));
    ed.setProp(form, 'Action', 'https://formspree.io/f/abc');
    ed.setProp(video, 'Source', 'dQw4w9WgXcQ');
    expect(kinds()).not.toContain('form');
    expect(kinds()).not.toContain('embed');
  });
});

describe('text styles', () => {
  it('export underlines and capitals on the website, per breakpoint', () => {
    const headline = id('Headline');
    ed.setProp(headline, 'TextDecoration', 'Underline');
    ed.setProp(headline, 'TextCase', 'Uppercase');
    ed.setDevice(phone());
    ed.setProp(headline, 'TextCase', 'None');
    const html = home();
    expect(ruleOf(html, 'Headline', 't > *')).toContain(
      'text-decoration-line:underline;text-transform:uppercase;',
    );
    expect(html).toMatch(/@media \(max-width: 809px\) \{[^@]*text-transform:none;/);
  });

  it('measure capitals for AutomaticSize', () => {
    const face = { font: 'Inter', weight: 'Regular', style: 'Normal' } as const;
    const typed = estimateText({
      ...face,
      text: 'hi there',
      size: 10,
      wrap: 30,
      textCase: 'Uppercase',
    });
    expect(typed).toEqual(estimateText({ ...face, text: 'HI THERE', size: 10, wrap: 30 }));
  });

  it('paint gradient letters, and check their contrast color by color', () => {
    const headline = id('Headline');
    const g = ed.insert('UIGradient', headline)!;
    ed.setProp(g, 'ApplyTo', 'Text');
    ed.setProp(g, 'Color', [
      { time: 0, value: [255, 255, 255] },
      { time: 1, value: [40, 40, 40] },
    ]);
    const rule = ruleOf(home(), 'Headline', 't > *');
    expect(rule).toContain('-webkit-text-fill-color:transparent;');
    expect(rule).toContain('background-clip:text;');
    expect(rule).toMatch(
      /background-image:linear-gradient\(90deg, rgb\(255, 255, 255\), rgb\(40, 40, 40\)\)/,
    );
    // The object's own background has no gradient now.
    expect(ruleOf(home(), 'Headline')).not.toContain('linear-gradient');
    // The dark end of the gradient on the dark hero is hard to read.
    const scene = buildScene({
      doc: ed.doc,
      view: { kind: 'page', pageId: id('Home') },
      screenDevice: 'laptop',
      pageDevice: 'desktop',
    });
    expect(textContrast(ed.doc, scene, headline)!.ratio).toBeLessThan(2);
  });
});

describe('picture filters and pointers', () => {
  it('filter pictures after their tint, on the website only', () => {
    const p = { ...defaultProps('ImageLabel'), ImageColor3: [255, 0, 0] as const };
    expect(pictureFilter(p, false)).toBe('url(#fc-tint-ff0000)');
    expect(pictureFilter({ ...p, Grayscale: 1, Blur: 4, Brightness: 1.2 }, true)).toBe(
      'url(#fc-tint-ff0000) grayscale(1) brightness(1.2) blur(4px)',
    );
    expect(pictureFilter(defaultProps('ImageLabel'), true)).toBeUndefined();
  });

  it('export filters and pointers, which the Roblox exports skip', () => {
    const pic = ed.insert('ImageLabel', id('Home'))!;
    ed.setProp(pic, 'Grayscale', 1);
    ed.setProp(pic, 'Cursor', 'ZoomIn');
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    const withPicture = {
      ...ed.doc,
      instances: { ...ed.doc.instances, [pic]: { ...inst(pic), preview: 'img_abc' } },
    };
    const html = exportSite(withPicture, { img_abc: data }).find((f) => f.path === 'index.html')!
      .contents as string;
    expect(html).toMatch(/\.e\d+i\{object-fit:fill;filter:grayscale\(1\);\}/);
    expect(ruleOf(html, 'ImageLabel')).toContain('cursor:zoom-in;');

    // A web-only value set on a Roblox screen does nothing there.
    const label = Object.values(ed.doc.instances).find(
      (i) => i.className === 'TextLabel' && i.props.Name === 'Title',
    )!;
    const doc = applyCommand(ed.doc, {
      type: 'setProps',
      id: label.id,
      props: { TextDecoration: 'Underline', TextCase: 'Uppercase', Cursor: 'Help' },
    }).doc;
    for (const out of [exportLuau(doc, 'command'), exportRbxmx(doc)])
      for (const word of ['TextDecoration', 'TextCase', 'Cursor', 'ApplyTo', 'Grayscale'])
        expect(out).not.toContain(word);
    const screens = exportHtml(doc);
    expect(screens).not.toContain('text-decoration-line');
    expect(screens).not.toContain('cursor:help');
  });

  it('smooth scrolling comes with a link to a section of the same page', () => {
    expect(home()).not.toContain('scroll-behavior');
    const links = inst(id('Nav')).children.find((c) => inst(c).props.Name === 'Links')!;
    const link = inst(links).children.find((c) => inst(c).props.Name === 'HomeLink')!;
    ed.setProp(link, 'Link', { kind: 'page', page: id('Home'), section: 'Hero' });
    expect(home()).toContain('html { scroll-behavior: smooth; }');
    const site = Object.values(ed.doc.instances).find((i) => i.className === 'Site')!;
    ed.setProp(site.id, 'SmoothScroll', false);
    expect(home()).not.toContain('scroll-behavior');
  });
});
