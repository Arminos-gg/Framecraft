import { describe, expect, it } from 'vitest';
import { exportHtml } from '../../../src/export/html.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportRbxmx } from '../../../src/export/rbxmx.ts';
import { exportSite } from '../../../src/export/site.ts';
import { layoutContainer } from '../../../src/layout/layout.ts';
import { Builder } from '../../../src/model/builder.ts';
import { canParent } from '../../../src/model/classes.ts';
import { drawnChildren, drawnParent, folderObjects } from '../../../src/model/document.ts';
import { pageSubtree } from '../../../src/model/builder.ts';
import { counterIds } from '../model/helpers.ts';

const VIEW = { width: 1000, height: 600 };

/** A ScreenGui with a list-laid-out Frame, holding a Folder and a free object in it. */
function folderScreen() {
  const b = new Builder(counterIds('f'));
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'Menu' });
  const top = b.add(sg, 'Folder', { Name: 'Top' });
  const badge = b.add(top, 'Frame', {
    Name: 'Badge',
    Position: [0.5, 10, 0, 20],
    Size: [0, 100, 0, 40],
  });
  const list = b.add(sg, 'Frame', {
    Name: 'List',
    Position: [0, 100, 0, 100],
    Size: [0, 300, 0, 100],
    AutomaticSize: 'Y',
  });
  b.add(list, 'UIListLayout', {});
  b.add(list, 'TextButton', { Name: 'One', Size: [1, 0, 0, 50] });
  b.add(list, 'TextButton', { Name: 'Two', Size: [1, 0, 0, 50] });
  const tags = b.add(list, 'Folder', { Name: 'Tags' });
  const inner = b.add(tags, 'Folder', { Name: 'Inner' });
  const tag = b.add(inner, 'Frame', {
    Name: 'Tag',
    Position: [0, 20, 0, 150],
    Size: [0.5, 0, 0, 30],
  });
  return { doc: b.doc, sg, top, badge, list, tags, inner, tag };
}

describe('Folder', () => {
  it('sits in layers, objects and other Folders, and holds objects but not modifiers', () => {
    expect(canParent('Folder', 'ScreenGui')).toBe(true);
    expect(canParent('Folder', 'Page')).toBe(true);
    expect(canParent('Folder', 'Frame')).toBe(true);
    expect(canParent('Folder', 'Folder')).toBe(true);
    expect(canParent('Folder', 'StarterGui')).toBe(false);
    expect(canParent('TextLabel', 'Folder')).toBe(true);
    expect(canParent('UICorner', 'Folder')).toBe(false);
    expect(canParent('UIListLayout', 'Folder')).toBe(false);
  });

  it('draws its objects as if they sat in its parent', () => {
    const { doc, sg, list, badge, tag, top, inner } = folderScreen();
    expect(drawnChildren(doc, sg).map((c) => c.id)).toEqual([badge, list]);
    expect(folderObjects(doc, list).map((c) => c.id)).toEqual([tag]);
    expect(drawnParent(doc, inner)?.id).toBe(list);
    const layout = layoutContainer(doc, sg, VIEW);
    expect(layout.get(badge)).toMatchObject({ x: 510, y: 20, w: 100, h: 40 });
    // The Folder's box is the area its objects are placed in: its parent's.
    expect(layout.get(top)).toMatchObject({ x: 0, y: 0, w: 1000, h: 600 });
  });

  it('places its objects by their Position, even where a UIListLayout arranges the rest', () => {
    const { doc, sg, tag } = folderScreen();
    const layout = layoutContainer(doc, sg, VIEW);
    expect(layout.get(tag)).toMatchObject({ x: 120, y: 250, w: 150, h: 30, listItem: false });
  });

  it('counts its objects when the parent grows to fit (AutomaticSize)', () => {
    const { doc, sg, list } = folderScreen();
    // The list holds 100 px of buttons; the tag in the folder reaches down to 180.
    expect(layoutContainer(doc, sg, VIEW).get(list)?.h).toBe(180);
  });

  it('is written to Luau and the model file, and draws nothing in the HTML page', () => {
    const { doc } = folderScreen();
    const luau = exportLuau(doc);
    expect(luau).toContain('local tags = Instance.new("Folder")');
    expect(luau).toContain('tag.Parent = inner');
    expect(luau).toContain('inner.Parent = tags');
    expect(exportRbxmx(doc)).toMatch(/<Item class="Folder" referent="RBX[0-9A-F]+">/);
    const html = exportHtml(doc);
    expect(html).not.toContain('data-name="Tags"');
    // The tag is placed on its own inside the list's content box, not as a list item.
    const tagClass = /class="g (e\d+)"[^>]*data-name="Tag"/.exec(html)![1]!;
    expect(html).toMatch(new RegExp(`\\.${tagClass}\\{left:[^}]*top:`));
    expect(html).not.toMatch(new RegExp(`\\.${tagClass}\\{position:relative`));
  });

  it('puts page sections in a Folder on the page, and lets them make it longer', () => {
    const b = new Builder(counterIds('p'));
    const page = b.addSubtree(b.site, pageSubtree({ Name: 'Home', Path: '/' }, b.makeId));
    const folder = b.add(page, 'Folder', { Name: 'Extras' });
    b.add(folder, 'Frame', { Name: 'Low', Position: [0, 0, 0, 900], Size: [1, 0, 0, 200] });
    const layout = layoutContainer(b.doc, page, VIEW);
    expect(layout.get(page)?.canvas?.h).toBe(1100);
    const index = exportSite(b.doc).find((f) => f.path === 'index.html')!.contents as string;
    expect(index).toContain('data-name="Low"');
    expect(index).not.toContain('data-name="Extras"');
    expect(index).toContain('min-height:max(var(--vh), 1100px)');
  });
});
