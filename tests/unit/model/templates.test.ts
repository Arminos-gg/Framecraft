import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { pageDevices, SCREEN_DEVICES } from '../../../src/editor/devices.ts';
import { pagesOf } from '../../../src/editor/editor.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportSite } from '../../../src/export/site.ts';
import { layoutContainer, layoutScreenGuis, type Layout } from '../../../src/layout/layout.ts';
import { classDef } from '../../../src/model/classes.ts';
import {
  childrenOf,
  serviceOf,
  validateDoc,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { parseProject, serializeProject } from '../../../src/model/project.ts';
import { TEMPLATES } from '../../../src/model/templates/index.ts';
import { counterIds } from './helpers.ts';

const screenGuis = (doc: Doc) => childrenOf(doc, serviceOf(doc, 'StarterGui').id);

/**
 * The objects drawn on screen that no parent clips: shown themselves and under shown parents
 * up to `root`, with no ClipsDescendants parent in between. Clipped drawings, such as the app
 * mock on the landing page, may run past their frame on purpose.
 */
function unclipped(doc: Doc, layout: Layout, root: InstanceId): AnyInstance[] {
  const out: AnyInstance[] = [];
  const walk = (id: InstanceId) => {
    for (const c of childrenOf(doc, id)) {
      if (classDef(c.className).kind !== 'gui' || !layout.get(c.id)?.visible) continue;
      out.push(c);
      if (!(c.props as { ClipsDescendants: boolean }).ClipsDescendants) walk(c.id);
    }
  };
  walk(root);
  return out;
}

describe('starter templates', () => {
  it('have unique ids, names and descriptions', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) expect(t.description).toMatch(/^[A-Z].*\.$/);
  });

  describe.each(TEMPLATES)('$name', (t) => {
    const doc = t.build(counterIds());

    it('is a valid document', () => {
      expect(validateDoc(doc)).toEqual([]);
    });

    it('takes every id from the id maker, so it builds the same each time', () => {
      expect(t.build(counterIds())).toEqual(doc);
    });

    it('survives a round trip through a project file', () => {
      expect(parseProject(serializeProject(doc)).doc).toEqual(doc);
    });

    if (t.kind === 'site') {
      it('is a website: pages and no Roblox screens', () => {
        expect(pagesOf(doc).length).toBeGreaterThan(0);
        expect(screenGuis(doc)).toEqual([]);
        expect(exportSite(doc).map((f) => f.path)).toContain('index.html');
      });

      it('fits the window on every device, with nothing running off the side', () => {
        for (const page of pagesOf(doc))
          for (const device of pageDevices(doc)) {
            const viewport = { width: device.width, height: device.height };
            const layout = layoutContainer(doc, page.id, viewport, device.breakpoint);
            for (const inst of unclipped(doc, layout, page.id)) {
              const b = layout.get(inst.id)!;
              const where = `${inst.props.Name} on ${device.label}`;
              expect(b.x, where).toBeGreaterThanOrEqual(-0.5);
              expect(b.x + b.w, where).toBeLessThanOrEqual(device.width + 0.5);
            }
          }
      });
    } else {
      it('is Roblox UI: screens and no pages', () => {
        expect(screenGuis(doc).length).toBeGreaterThan(0);
        expect(pagesOf(doc)).toEqual([]);
      });

      it('exports Luau that parses', () => {
        for (const target of ['command', 'local'] as const)
          expect(() =>
            luaparse.parse(exportLuau(doc, target), { luaVersion: '5.1' }),
          ).not.toThrow();
      });

      it('stays on screen on every device', () => {
        for (const device of SCREEN_DEVICES) {
          const viewport = { width: device.width, height: device.height };
          const layout = layoutScreenGuis(doc, serviceOf(doc, 'StarterGui').id, viewport);
          for (const sg of screenGuis(doc))
            for (const inst of unclipped(doc, layout, sg.id)) {
              const b = layout.get(inst.id)!;
              const where = `${inst.props.Name} on ${device.label}`;
              expect(b.x, where).toBeGreaterThanOrEqual(-0.5);
              expect(b.y, where).toBeGreaterThanOrEqual(-0.5);
              expect(b.x + b.w, where).toBeLessThanOrEqual(device.width + 0.5);
              expect(b.y + b.h, where).toBeLessThanOrEqual(device.height + 0.5);
            }
        }
      });
    }
  });
});
