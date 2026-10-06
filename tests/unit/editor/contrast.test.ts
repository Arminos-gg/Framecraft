import { describe, expect, it } from 'vitest';
import { siteChecks } from '../../../src/editor/checks.ts';
import {
  blend,
  contrastRatio,
  fmtRatio,
  isLargeText,
  textContrast,
} from '../../../src/editor/contrast.ts';
import { buildScene, SCREENS, type View } from '../../../src/editor/editor.ts';
import { Builder, pageSubtree } from '../../../src/model/builder.ts';
import type { Doc, InstanceId } from '../../../src/model/document.ts';
import { counterIds, site } from '../model/helpers.ts';

const sceneFor = (doc: Doc, view: View, pageDevice = 'desktop') =>
  buildScene({ doc, view, screenDevice: 'laptop', pageDevice });

/** A page with one text on it; `setup` adds what goes behind it. */
function onPage(
  text: Record<string, unknown>,
  setup?: (b: Builder, page: InstanceId) => InstanceId,
  page: Record<string, unknown> = {},
) {
  const b = new Builder(counterIds());
  const pageId = b.addSubtree(b.site, pageSubtree({ ...page }, b.makeId));
  const parent = setup?.(b, pageId) ?? pageId;
  const id = b.add(parent, 'TextLabel', {
    Size: [0, 200, 0, 50],
    BackgroundTransparency: 1,
    Text: 'Hello',
    TextSize: 16,
    ...text,
  });
  const c = textContrast(b.doc, sceneFor(b.doc, { kind: 'page', pageId }), id);
  return { b, c, id, pageId };
}

describe('contrast ratios', () => {
  it('follows WCAG', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(blend([0, 0, 0], 0.5, [255, 255, 255])).toEqual([127.5, 127.5, 127.5]);
  });

  it('counts 24 px, or 19 px bold, as large', () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(20, 400)).toBe(false);
    expect(isLargeText(19, 700)).toBe(true);
  });

  it('rounds down when it shows a ratio', () => {
    expect(fmtRatio(4.49)).toBe('4.4:1');
    expect(fmtRatio(21)).toBe('21:1');
  });
});

describe('text contrast', () => {
  it('reads the page background behind text with nothing else under it', () => {
    const { c } = onPage({ TextColor3: [0, 0, 0] });
    expect(c!.ratio).toBeCloseTo(21, 5);
    expect(c!.needed).toBe(4.5);
  });

  it('uses the object drawn below that covers the text', () => {
    const { c } = onPage({ TextColor3: [255, 255, 255] }, (b, page) =>
      b.add(page, 'Frame', { Size: [0, 400, 0, 400], BackgroundColor3: [194, 98, 45] }),
    );
    expect(c!.ratio).toBeCloseTo(4.13, 2);
    expect(c!.background).toEqual([194, 98, 45]);
  });

  it('counts a sibling drawn below, not one beside the text', () => {
    const b = new Builder(counterIds());
    const page = b.addSubtree(b.site, pageSubtree({}, b.makeId));
    // A section whose children are placed freely, so they can overlap.
    const section = b.add(page, 'Frame', { Size: [1, 0, 0, 600], BackgroundTransparency: 1 });
    b.add(section, 'Frame', { Size: [0, 400, 0, 400], BackgroundColor3: [0, 0, 0] });
    b.add(section, 'Frame', {
      Position: [0, 500, 0, 0],
      Size: [0, 400, 0, 400],
      BackgroundColor3: [255, 255, 255],
    });
    const id = b.add(section, 'TextLabel', {
      Size: [0, 200, 0, 50],
      BackgroundTransparency: 1,
      Text: 'On black',
      TextColor3: [40, 40, 40],
    });
    const c = textContrast(b.doc, sceneFor(b.doc, { kind: 'page', pageId: page }), id)!;
    expect(c.background).toEqual([0, 0, 0]);
    expect(c.ratio).toBeLessThan(2);
  });

  it('blends see-through backgrounds and text', () => {
    const { c } = onPage({ TextColor3: [0, 0, 0], TextTransparency: 0.5 }, (b, page) =>
      b.add(page, 'Frame', {
        Size: [0, 400, 0, 400],
        BackgroundColor3: [0, 0, 0],
        BackgroundTransparency: 0.5,
      }),
    );
    // Black at half over white is 127.5 gray; the text is half that again.
    expect(c!.background).toEqual([127.5, 127.5, 127.5]);
    expect(c!.text).toEqual([63.75, 63.75, 63.75]);
  });

  it('takes the worst end of a gradient', () => {
    const { c } = onPage({ TextColor3: [255, 255, 255] }, (b, page) => {
      const f = b.add(page, 'Frame', { Size: [0, 400, 0, 400], BackgroundColor3: [255, 255, 255] });
      b.add(f, 'UIGradient', {
        Color: [
          { time: 0, value: [0, 0, 0] },
          { time: 1, value: [230, 230, 230] },
        ],
      });
      return f;
    });
    expect(c!.background).toEqual([230, 230, 230]);
  });

  it('lets a text outline stand in for the background', () => {
    const { b, id, pageId } = onPage({ TextColor3: [255, 255, 255] });
    b.add(id, 'UIStroke', { Color: [0, 0, 0], Thickness: 2 });
    const c = textContrast(b.doc, sceneFor(b.doc, { kind: 'page', pageId }), id)!;
    expect(c.ratio).toBeCloseTo(21, 5);
  });

  it('needs 3:1 for large text', () => {
    expect(onPage({ TextSize: 32 }).c!.needed).toBe(3);
    expect(onPage({ TextSize: 20, Font: 'GothamBold' }).c!.needed).toBe(3);
  });

  it('can’t tell over a picture, over the game, or for empty text', () => {
    expect(
      onPage({}, (b, page) =>
        b.add(page, 'ImageLabel', { Size: [0, 400, 0, 400], Image: 'rbxassetid://1' }),
      ).c,
    ).toBeUndefined();
    expect(onPage({ Text: '  ' }).c).toBeUndefined();

    const b = new Builder(counterIds());
    const sg = b.add(b.starterGui, 'ScreenGui');
    const id = b.add(sg, 'TextLabel', { Text: 'Score', BackgroundTransparency: 1 });
    expect(textContrast(b.doc, sceneFor(b.doc, SCREENS), id)).toBeUndefined();
    // Over a solid frame on the screen it can.
    const frame = b.add(sg, 'Frame', { BackgroundColor3: [0, 0, 0] });
    const inFrame = b.add(frame, 'TextLabel', {
      Text: 'Score',
      BackgroundTransparency: 1,
      TextColor3: [255, 255, 255],
    });
    expect(textContrast(b.doc, sceneFor(b.doc, SCREENS), inFrame)!.ratio).toBeCloseTo(21, 5);
  });
});

describe('site checks', () => {
  it('passes the sample site', () => {
    expect(siteChecks(site())).toEqual([]);
  });

  it('finds low contrast, links with no words and pages with no heading', () => {
    const { b, id, pageId } = onPage({ TextColor3: [150, 150, 150] });
    const link = b.add(pageId, 'ImageButton', {
      Position: [0, 0, 0, 300],
      Link: { kind: 'url', url: 'https://example.com' },
    });
    const checks = siteChecks(b.doc);
    expect(checks.map((c) => [c.kind, c.id])).toEqual([
      ['contrast', id],
      ['link', link],
      ['heading', pageId],
    ]);
    expect(checks[0]!.text).toMatch(
      /^Text contrast is 2\.9:1 on Desktop\. Text this size needs 4\.5:1/,
    );

    b.set(link, { AltText: 'Our shop' });
    b.set(id, { TextColor3: [90, 90, 90], HtmlTag: 'h1' });
    expect(siteChecks(b.doc)).toEqual([]);
  });

  it('names the device where a breakpoint makes text fail', () => {
    const { b, id } = onPage({ TextColor3: [0, 0, 0], HtmlTag: 'h1' });
    b.change(id, 'Phone', { TextColor3: [200, 200, 200] });
    const [check] = siteChecks(b.doc);
    expect(check!.device).toBe(b.breakpoint('Phone'));
    expect(check!.text).toMatch(/ on Phone\./);
  });
});
