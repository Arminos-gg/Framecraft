import { describe, expect, it } from 'vitest';
import { exportHtml, googleFontsHref } from '../../../src/export/html.ts';
import { calcU, rgba } from '../../../src/export/format.ts';
import { addAsset } from '../../../src/model/assets.ts';
import type { ClassName, PropsOf } from '../../../src/model/classes.ts';
import { applyCommand, insert, setPreview } from '../../../src/model/commands.ts';
import {
  createInstance,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { colorSequence } from '../../../src/model/values.ts';
import { byName, counterIds } from '../model/helpers.ts';

function scene() {
  let doc: Doc = blankDoc(counterIds('s'));
  let n = 0;
  const add = <C extends ClassName>(
    parent: InstanceId,
    className: C,
    props: Partial<PropsOf<C>> = {},
  ) => {
    const inst = createInstance(className, props, `o${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  return {
    screen: byName(doc, 'ScreenGui').id,
    add,
    edit: (f: (d: Doc) => Doc) => (doc = f(doc)),
    get doc() {
      return doc;
    },
  };
}

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('CSS values', () => {
  it('writes Scale and Offset as calc()', () => {
    expect(calcU(0.5, 0)).toBe('50%');
    expect(calcU(0, 12)).toBe('12px');
    expect(calcU(0, 0)).toBe('0px');
    expect(calcU(1, -20)).toBe('calc(100% + -20px)');
  });

  it('turns transparency into alpha', () => {
    expect(rgba([10, 20, 30], 0.25)).toBe('rgba(10, 20, 30, 0.75)');
    expect(rgba([0, 0, 0], 2)).toBe('rgba(0, 0, 0, 0)');
  });

  it('asks Google Fonts for every family and weight once', () => {
    expect(googleFontsHref(['GothamBold', 'Gotham', 'GothamBold', 'LuckiestGuy'])).toBe(
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Luckiest+Guy&display=swap',
    );
    expect(googleFontsHref(['SourceSansItalic', 'SourceSans'])).toBe(
      'https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;1,400&display=swap',
    );
    expect(googleFontsHref([])).toBeNull();
  });
});

describe('HTML export', () => {
  it('shows an image preview from the library, or a placeholder', () => {
    const s = scene();
    const img = s.add(s.screen, 'ImageLabel', { Image: 'rbxassetid://42', ScaleType: 'Fit' });
    expect(exportHtml(s.doc)).toContain('<div class="ph">rbxassetid://42</div>');
    const { assets, id } = addAsset({}, PNG);
    s.edit((d) => applyCommand(d, setPreview(img, id)).doc);
    const html = exportHtml(s.doc, { assets });
    expect(html).toMatch(new RegExp(`<img class="img (e\\d+i)" src="${PNG}" alt="">`));
    const cls = /<img class="img (e\d+i)"/.exec(html)![1]!;
    expect(html).toContain(`.${cls}{object-fit:contain;}`);
    expect(html).not.toContain('fc-tint');
    // Without the library the picture can't be found, so the placeholder shows.
    expect(exportHtml(s.doc)).toContain('<div class="ph">rbxassetid://42</div>');
  });

  it('tints a picture by ImageColor3 with one color filter per color', () => {
    const s = scene();
    const { assets, id } = addAsset({}, PNG);
    const a = s.add(s.screen, 'ImageLabel', { ImageColor3: [255, 0, 51], ImageTransparency: 0.25 });
    const b = s.add(s.screen, 'ImageButton', { ImageColor3: [255, 0, 51] });
    s.edit((d) => applyCommand(applyCommand(d, setPreview(a, id)).doc, setPreview(b, id)).doc);
    const html = exportHtml(s.doc, { assets });
    expect(html.match(/<filter /g)).toHaveLength(1);
    expect(html).toContain(
      '<filter id="fc-tint-ff0033" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0.2 0 0 0 0 0 1 0"/></filter>',
    );
    expect(html).toMatch(/\.e\d+i\{object-fit:fill;opacity:0\.75;filter:url\(#fc-tint-ff0033\);\}/);
  });

  it('adds the fitting script only when something needs the real box', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame');
    expect(exportHtml(s.doc)).not.toContain('<script>');
    s.add(card, 'UICorner', { CornerRadius: [0.2, 4] });
    const html = exportHtml(s.doc);
    expect(html).toContain('data-r="0.2,4"');
    expect(html).toContain('<script>');
  });

  it('writes gradients with more than two keypoints with stop positions', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame');
    s.add(card, 'UIGradient', { Color: colorSequence([255, 0, 0], [0, 255, 0], [0, 0, 255]) });
    expect(exportHtml(s.doc)).toContain(
      'background-image:linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 255, 0) 50%, rgb(0, 0, 255) 100%)',
    );
  });

  it('turns a TextBox into an input and escapes text', () => {
    const s = scene();
    s.add(s.screen, 'TextBox', { Name: 'Search', Text: '<b>&', PlaceholderText: 'Find "it"' });
    expect(exportHtml(s.doc)).toContain(
      '<input value="&lt;b&gt;&amp;" placeholder="Find &quot;it&quot;" aria-label="Search">',
    );
  });

  it('keeps every object’s Roblox name in data-name', () => {
    const s = scene();
    s.add(s.screen, 'Frame', { Name: 'Shop panel' });
    expect(exportHtml(s.doc)).toContain('data-name="Shop panel"');
  });

  it('marks objects with AutomaticSize for the fitting script, with a content box to measure', () => {
    const s = scene();
    const tag = s.add(s.screen, 'TextLabel', {
      Text: 'New',
      TextWrapped: true,
      AutomaticSize: 'XY',
    });
    s.add(tag, 'UIPadding', { PaddingLeft: [0, 6], PaddingRight: [0, 6] });
    s.add(s.screen, 'Frame');
    const html = exportHtml(s.doc);
    expect(html).toContain('<div class="g e1" data-auto data-name="TextLabel">');
    expect(html).toMatch(/\.e1\{[^}]*--auto:xy;/);
    // Its content box is written even without children: the script reads the padding there.
    expect(html).toMatch(/<div class="c e1c">\s*<\/div>/);
    expect(html).toContain('.e1c{left:6px;top:0px;right:6px;bottom:0px;}');
    // Wrapped text breaks a word too long for the line, as Roblox does.
    expect(html).toContain('white-space:pre-wrap;overflow-wrap:anywhere;');
    expect(html).toContain('function grow(el)');
    expect(html).not.toMatch(/data-name="Frame"[^>]*data-auto|data-auto[^>]*data-name="Frame"/);
  });

  it('puts a ScrollingFrame’s children on a canvas', () => {
    const s = scene();
    const scroll = s.add(s.screen, 'ScrollingFrame', { CanvasSize: [0, 0, 3, 0] });
    s.add(scroll, 'Frame');
    const html = exportHtml(s.doc);
    expect(html).toContain(
      '.e1v{position:absolute;left:0;top:0;width:max(100%, 0px);height:max(100%, 300%);}',
    );
    expect(html).toContain('overflow:auto;');
  });

  it('marks a ScrollingFrame with AutomaticCanvasSize for the fitting script', () => {
    const s = scene();
    s.add(s.screen, 'ScrollingFrame', { AutomaticCanvasSize: 'Y' });
    s.add(s.screen, 'ScrollingFrame', { Name: 'Fixed' });
    const html = exportHtml(s.doc);
    expect(html).toContain('<div class="g e1" data-canvas data-name="ScrollingFrame">');
    expect(html).toMatch(/\.e1\{[^}]*--canvas:y;/);
    // Its canvas and content box are written even without children.
    expect(html).toMatch(/<div class="e1v">\s*<div class="c e1c">/);
    expect(html).toContain('function canvas(el)');
    expect(html).not.toMatch(/data-canvas[^>]*data-name="Fixed"/);
  });

  it('writes LineHeight when it isn’t 1', () => {
    const s = scene();
    s.add(s.screen, 'TextLabel', { LineHeight: 1.5 });
    s.add(s.screen, 'TextLabel');
    const html = exportHtml(s.doc);
    expect(html).toMatch(/\.e1t > \*\{[^}]*line-height:1\.5;/);
    expect(html).not.toMatch(/\.e2t > \*\{[^}]*line-height/);
  });
});
