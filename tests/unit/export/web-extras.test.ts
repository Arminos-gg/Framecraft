import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../../src/editor/editor.ts';
import { insertableInto } from '../../../src/editor/insert.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportSite } from '../../../src/export/site.ts';
import { strokeShadows } from '../../../src/export/html.ts';
import { defaultProps } from '../../../src/model/classes.ts';
import { breakpointsOf, type AnyInstance, type InstanceId } from '../../../src/model/document.ts';
import { sampleProject } from '../../../src/model/sample.ts';

let ed: Editor;
beforeEach(() => {
  ed = new Editor(sampleProject());
});

const byName = (name: string): AnyInstance => {
  const found = Object.values(ed.doc.instances).filter((i) => i.props.Name === name);
  expect(found, name).toHaveLength(1);
  return found[0]!;
};
/** By name, on the home page when another page has one too (each page has a Nav). */
const id = (name: string): InstanceId => {
  const home = Object.values(ed.doc.instances).find((i) => i.props.Name === 'Home')!;
  const nav = home.children.find((c) => ed.doc.instances[c]!.props.Name === name);
  return nav ?? byName(name).id;
};
const phone = () => breakpointsOf(ed.doc).find((b) => b.props.Name === 'Phone')!.id;
const home = () => exportSite(ed.doc).find((f) => f.path === 'index.html')!.contents as string;
/** The CSS rule for the element whose data-name is `name`, with its class swapped for `.X`. */
function ruleOf(html: string, name: string, suffix = ''): string {
  const cls = new RegExp(`class="g (e\\d+)"[^>]*data-name="${name}"`).exec(html)?.[1];
  expect(cls, `element ${name}`).toBeDefined();
  const rule = new RegExp(`\\.${cls}${suffix.replace(/[.:>*]/g, '\\$&')}\\{([^}]*)\\}`).exec(html);
  return rule?.[1] ?? '';
}

describe('UIHover', () => {
  it('goes only on objects on a page, and starts with the object’s own colors', () => {
    const play = Object.values(ed.doc.instances).find((i) => i.className === 'TextButton')!;
    expect(insertableInto(ed.doc, play.id).modifiers).not.toContain('UIHover');
    expect(ed.insert('UIHover', play.id)).toBeNull();

    ed.setDevice(phone());
    ed.select(id('Nav'));
    ed.setProp(id('Nav'), 'BackgroundColor3', [10, 20, 30]);
    expect(insertableInto(ed.doc, id('Subscribe')).modifiers).toContain('UIHover');
    const hover = ed.insert('UIHover', id('Subscribe'))!;
    const h = ed.doc.instances[hover]!;
    expect(h.props).toMatchObject({
      BackgroundColor3: (byName('Subscribe').props as Record<string, unknown>).BackgroundColor3,
      TextColor3: [255, 255, 255],
      Scale: 1.05,
    });
    expect(h.overrides).toBeUndefined();
    const nav = ed.insert('UIHover', id('Nav'))!;
    expect(ed.doc.instances[nav]!.overrides?.[phone()]).toEqual({ BackgroundColor3: [10, 20, 30] });
  });

  it('exports its look under the mouse, with a transition, and Luau skips it', () => {
    const hover = ed.insert('UIHover', id('Subscribe'))!;
    ed.setProp(hover, 'BackgroundColor3', [0, 0, 0]);
    ed.setProp(hover, 'TextColor3', [255, 0, 0]);
    ed.setProp(hover, 'Lift', 4);
    const html = home();
    expect(ruleOf(html, 'Subscribe')).toContain('transition:background-color 0.2s, scale 0.2s');
    expect(ruleOf(html, 'Subscribe', ':hover')).toBe(
      'background-color:rgba(0, 0, 0, 1);scale:1.05;translate:0 -4px;filter:none;',
    );
    expect(ruleOf(html, 'Subscribe', ':active')).toBe('filter:brightness(0.75);');
    expect(ruleOf(html, 'Subscribe', ':hover > .t > *')).toBe('color:rgba(255, 0, 0, 1);');
    // A page can't go to Roblox, but the same object on a screen leaves its UIHover out.
    ed.moveTo(id('Subscribe'), id('Panel'));
    expect(exportLuau(ed.doc)).not.toContain('UIHover');
  });
});

describe('web-only object properties', () => {
  it('blurs what is behind an object, and can change per breakpoint', () => {
    ed.setProp(id('Nav'), 'BackgroundBlur', 12);
    ed.setDevice(phone());
    ed.setProp(id('Nav'), 'BackgroundBlur', 0);
    const html = home();
    expect(ruleOf(html, 'Nav')).toContain('backdrop-filter:blur(12px);');
    expect(html).toMatch(/@media \(max-width: 809px\) \{[^@]*backdrop-filter:none;/);
  });

  it('marks objects that appear on scroll, and adds the script only when one does', () => {
    expect(home()).not.toContain('IntersectionObserver');
    ed.setProp(id('Headline'), 'Appear', 'SlideUp');
    ed.setProp(id('Headline'), 'AppearDelay', 0.3);
    const html = home();
    expect(html).toContain('data-appear="SlideUp"');
    expect(ruleOf(html, 'Headline')).toContain('animation-delay:0.3s;');
    expect(html).toContain('.fc-in[data-appear="SlideUp"] { animation-name: fc-up; }');
    expect(html).toContain('IntersectionObserver');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('pins a list item with sticky, and a free-placed one in a fixed layer', () => {
    ed.setProp(id('Nav'), 'Pinned', true);
    let html = home();
    expect(ruleOf(html, 'Nav')).toMatch(/^position:sticky;top:0;flex:none;.*z-index:1001;/);
    expect(html).not.toContain('class="pin"');

    // Without the page's list, the nav is placed freely, so it goes in the fixed layer.
    const list = ed.doc.instances[id('Home')]!.children.find(
      (c) => ed.doc.instances[c]!.className === 'UIListLayout',
    )!;
    ed.select(list);
    ed.deleteSelection();
    html = home();
    expect(html).toMatch(/<div class="pin">\s*<nav class="g e\d+"[^>]*data-name="Nav"/);
    expect(html).toContain('.pin{position:fixed;left:0px;right:0px;top:0px;z-index:1000;');
  });
});

describe('UIStroke sides', () => {
  const stroke = { ...defaultProps('UIStroke'), Thickness: 2, Color: [0, 0, 0] as const };
  it('draws all four sides as one ring', () => {
    expect(strokeShadows(stroke)).toEqual(['0 0 0 2px rgba(0, 0, 0, 1)']);
  });
  it('draws only the sides asked for, filling the corner between two', () => {
    expect(strokeShadows({ ...stroke, Top: false, Right: false, Left: false })).toEqual([
      '0 2px 0 0 rgba(0, 0, 0, 1)',
    ]);
    expect(strokeShadows({ ...stroke, Right: false, Bottom: false })).toEqual([
      '0 -2px 0 0 rgba(0, 0, 0, 1)',
      '-2px 0 0 0 rgba(0, 0, 0, 1)',
      '-2px -2px 0 0 rgba(0, 0, 0, 1)',
    ]);
  });
});
