import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportSite } from '../../../src/export/site.ts';
import { layoutContainer, layoutScreenGuis } from '../../../src/layout/layout.ts';
import { applyCommand, insert } from '../../../src/model/commands.ts';
import {
  COMPONENTS,
  buildComponent,
  componentSubtree,
  fitsTarget,
  type ComponentOptions,
} from '../../../src/model/components/index.ts';
import { breakpointsOf, serviceOf, validateDoc, type Doc } from '../../../src/model/document.ts';
import { sampleProject } from '../../../src/model/sample.ts';
import { pagesOf } from '../../../src/editor/editor.ts';
import { counterIds } from './helpers.ts';

const LOOKS: ComponentOptions[] = [];
for (const look of ['light', 'dark'] as const)
  for (const corners of ['rounded', 'sharp'] as const)
    for (const target of ['site', 'roblox'] as const) LOOKS.push({ look, corners, target });

describe('pre-made components', () => {
  it('have unique ids and names, and say what they are', () => {
    expect(new Set(COMPONENTS.map((c) => c.id)).size).toBe(COMPONENTS.length);
    expect(new Set(COMPONENTS.map((c) => c.name)).size).toBe(COMPONENTS.length);
    for (const c of COMPONENTS) {
      expect(c.summary).toMatch(/^[A-Z].*[^.]$/);
      expect(c.description).toMatch(/^[A-Z].*\.$/);
      if (c.lookOnly) expect(c.lookOnly).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('offer some for websites and some for Roblox', () => {
    expect(COMPONENTS.filter((c) => fitsTarget(c, 'site')).length).toBeGreaterThan(10);
    expect(COMPONENTS.filter((c) => fitsTarget(c, 'roblox')).length).toBeGreaterThan(10);
  });

  describe.each(COMPONENTS)('$name', (def) => {
    it.each(LOOKS)('builds a valid project ($look, $corners, $target)', (options) => {
      for (const place of ['page', 'other'] as const) {
        const built = buildComponent(def, options, place, counterIds());
        expect(validateDoc(built.doc)).toEqual([]);
        expect(buildComponent(def, options, place, counterIds())).toEqual(built);
      }
    });

    it('exports Luau that parses and a website', () => {
      const options: ComponentOptions = { look: 'dark', corners: 'rounded', target: 'roblox' };
      const onScreen = buildComponent(def, options, 'other', counterIds());
      for (const target of ['command', 'local'] as const)
        expect(() =>
          luaparse.parse(exportLuau(onScreen.doc, target), { luaVersion: '5.1' }),
        ).not.toThrow();
      const onPage = buildComponent(def, { ...options, target: 'site' }, 'page', counterIds());
      expect(exportSite(onPage.doc).map((f) => f.path)).toContain('index.html');
    });

    it('lays out with a size on every device', () => {
      const options: ComponentOptions = { look: 'light', corners: 'rounded', target: 'site' };
      const onPage = buildComponent(def, options, 'page', counterIds());
      for (const bp of [undefined, ...breakpointsOf(onPage.doc).map((b) => b.id)]) {
        const layout = layoutContainer(
          onPage.doc,
          onPage.holderId,
          { width: 1366, height: 768 },
          bp,
        );
        const box = layout.get(onPage.rootId)!;
        expect(box.w).toBeGreaterThan(0);
        expect(box.h).toBeGreaterThan(0);
      }
      const onScreen = buildComponent(def, options, 'other', counterIds());
      const layout = layoutScreenGuis(onScreen.doc, serviceOf(onScreen.doc, 'StarterGui').id, {
        width: 1366,
        height: 768,
      });
      const box = layout.get(onScreen.rootId)!;
      expect(box.w).toBeGreaterThan(0);
      expect(box.h).toBeGreaterThan(0);
    });

    it('inserts into another project, keeping its breakpoint changes', () => {
      const doc: Doc = sampleProject();
      const page = pagesOf(doc)[0]!;
      const options: ComponentOptions = { look: 'light', corners: 'rounded', target: 'site' };
      const subtree = componentSubtree(doc, def, options, 'page');
      const after = applyCommand(doc, insert(page.id, subtree)).doc;
      expect(validateDoc(after)).toEqual([]);
      const built = buildComponent(def, options, 'page');
      const changed = (d: Doc, ids: string[]) =>
        ids.filter((id) => d.instances[id]!.overrides).length;
      expect(changed(after, Object.keys(subtree.instances))).toBe(
        changed(built.doc, Object.keys(built.doc.instances)),
      );
    });
  });
});
