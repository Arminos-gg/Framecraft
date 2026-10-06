/**
 * Accessibility checks for the website, shown before it's exported: text too close in color
 * to what's behind it, links with no words for a screen reader to say, and pages with no
 * main heading. Each check names the object (and the device it fails on) so the editor can
 * show it.
 */
import { isGui } from '../export/html.ts';
import { classDef } from '../model/classes.ts';
import {
  getInstance,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../model/document.ts';
import { textContrast, fmtRatio, type TextContrast } from './contrast.ts';
import { pageDevices } from './devices.ts';
import { buildScene, pagesOf } from './editor.ts';

export interface Check {
  readonly kind: 'contrast' | 'link' | 'heading';
  /** The object to show: the text, the link or the page. */
  readonly id: InstanceId;
  readonly page: InstanceId;
  /** The page device it fails on, for contrast: 'desktop' or a breakpoint's id. */
  readonly device?: string;
  /** The colors, for contrast. */
  readonly contrast?: TextContrast;
  readonly text: string;
}

/** Words a screen reader can say for an object: its text, or a picture's AltText. */
function hasWords(doc: Doc, id: InstanceId): boolean {
  return subtreeIds(doc, id).some((d) => {
    const inst = getInstance(doc, d) as AnyInstance;
    const p = inst.props as { Text?: string; AltText?: string; PlaceholderText?: string };
    if (!isGui(inst)) return false;
    return !!(p.Text?.trim() || p.AltText?.trim() || p.PlaceholderText?.trim());
  });
}

/** The site's accessibility problems, page by page in Explorer order. */
export function siteChecks(doc: Doc): Check[] {
  const out: Check[] = [];
  const devices = pageDevices(doc);
  for (const page of pagesOf(doc)) {
    const ids = subtreeIds(doc, page.id).slice(1);
    const objects = ids.map((id) => getInstance(doc, id) as AnyInstance).filter(isGui);

    // Contrast: each text's worst device. A breakpoint can change colors and sizes.
    const worst = new Map<InstanceId, { c: TextContrast; device: string }>();
    for (const device of devices) {
      const scene = buildScene({
        doc,
        view: { kind: 'page', pageId: page.id },
        screenDevice: 'laptop',
        pageDevice: device.id,
      });
      for (const inst of objects) {
        if (!classDef(inst.className).text) continue;
        const c = textContrast(doc, scene, inst.id);
        if (!c || c.ratio >= c.needed) continue;
        const was = worst.get(inst.id);
        if (!was || c.ratio < was.c.ratio) worst.set(inst.id, { c, device: device.id });
      }
    }

    let heading = false;
    for (const inst of objects) {
      const p = inst.props as { HtmlTag: string; Link: unknown };
      if (p.HtmlTag === 'h1') heading = true;
      const bad = worst.get(inst.id);
      if (bad) {
        const name = devices.find((d) => d.id === bad.device)!.label.split(' · ')[0];
        out.push({
          kind: 'contrast',
          id: inst.id,
          page: page.id,
          device: bad.device,
          contrast: bad.c,
          text: `Text contrast is ${fmtRatio(bad.c.ratio)}${devices.length > 1 ? ` on ${name}` : ''}. Text this size needs ${bad.c.needed}:1 to be easy to read.`,
        });
      }
      if (p.Link && inst.className !== 'TextBox' && !hasWords(doc, inst.id))
        out.push({
          kind: 'link',
          id: inst.id,
          page: page.id,
          text: 'This link has no words, so screen readers can’t say where it goes. Give its picture AltText, or add text.',
        });
    }
    if (!heading && objects.some((o) => classDef(o.className).text))
      out.push({
        kind: 'heading',
        id: page.id,
        page: page.id,
        text: 'This page has no main heading. Set HtmlTag to h1 on its title, so search engines and screen readers know what the page is about.',
      });
  }
  return out;
}
