import { describe, expect, it } from 'vitest';
import { layoutContainer, type Layout } from '../../../src/layout/layout.ts';
import { estimateText } from '../../../src/layout/text.ts';
import type { ClassName, PropsOf } from '../../../src/model/classes.ts';
import { applyCommand, insert, remove } from '../../../src/model/commands.ts';
import {
  breakpointForWidth,
  createInstance,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { blankDoc, blankSiteDoc } from '../../../src/model/sample.ts';
import { bp, byName, counterIds } from '../model/helpers.ts';

const LAPTOP = { width: 1366, height: 768 };

/** A blank screen or page to add objects to. Text measures as the estimate: 0.5 em a letter. */
function build(kind: 'screen' | 'page' = 'screen') {
  let doc: Doc = kind === 'screen' ? blankDoc(counterIds('s')) : blankSiteDoc(counterIds('s'));
  let n = 0;
  const root = byName(doc, kind === 'screen' ? 'ScreenGui' : 'Home').id;
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
    root,
    add,
    get doc() {
      return doc;
    },
    set doc(d: Doc) {
      doc = d;
    },
    layout(viewport = LAPTOP, breakpoint?: InstanceId): Layout {
      return layoutContainer(doc, root, viewport, breakpoint, estimateText);
    },
  };
}

const label = (props: Partial<PropsOf<'TextLabel'>>): Partial<PropsOf<'TextLabel'>> => ({
  TextSize: 20,
  BackgroundTransparency: 1,
  ...props,
});

describe('estimated text', () => {
  it('makes each letter half the text size wide and each line as tall as the text size', () => {
    expect(estimateText({ text: 'Hello', font: 'Gotham', size: 20 })).toEqual({ w: 50, h: 20 });
    expect(estimateText({ text: 'a\nbbb', font: 'Gotham', size: 20 })).toEqual({ w: 30, h: 40 });
    expect(estimateText({ text: '', font: 'Gotham', size: 20 })).toEqual({ w: 0, h: 0 });
  });

  it('wraps at spaces, and inside words too long for the line', () => {
    // 10 letters fit in 100 px.
    const wrap = (text: string) => estimateText({ text, font: 'Gotham', size: 20, wrap: 100 });
    expect(wrap('aaaa bbbb cccc')).toEqual({ w: 90, h: 40 });
    expect(wrap('abcdefghijklmnopqrstuvwxy')).toEqual({ w: 100, h: 60 });
  });
});

describe('AutomaticSize', () => {
  it('leaves an object at its Size when it is None', () => {
    const s = build();
    const id = s.add(
      s.root,
      'TextLabel',
      label({ Text: 'A long line of text', Size: [0, 40, 0, 10] }),
    );
    expect(s.layout().get(id)).toMatchObject({ w: 40, h: 10 });
  });

  it('grows a label on X to fit its text and padding, and never below its Size', () => {
    const s = build();
    const id = s.add(
      s.root,
      'TextLabel',
      label({ Text: 'Hello', Size: [0, 10, 0, 30], AutomaticSize: 'X' }),
    );
    expect(s.layout().get(id)).toMatchObject({ w: 50, h: 30 });
    s.add(id, 'UIPadding', { PaddingLeft: [0, 8], PaddingRight: [0, 12] });
    expect(s.layout().get(id)).toMatchObject({ w: 70, h: 30 });
    const wide = s.add(
      s.root,
      'TextLabel',
      label({ Text: 'Hi', Size: [0, 200, 0, 30], AutomaticSize: 'X' }),
    );
    expect(s.layout().get(wide)).toMatchObject({ w: 200 });
  });

  it('grows a wrapped label on Y as its text wraps at its width', () => {
    const s = build();
    const id = s.add(
      s.root,
      'TextLabel',
      label({
        Text: 'aaaa bbbb cccc',
        Size: [0, 100, 0, 0],
        TextWrapped: true,
        AutomaticSize: 'Y',
      }),
    );
    expect(s.layout().get(id)).toMatchObject({ w: 100, h: 40 });
    // Without TextWrapped, the text keeps its lines: one per line break.
    const lines = s.add(
      s.root,
      'TextLabel',
      label({ Text: 'a\nb\nc', Size: [0, 100, 0, 0], AutomaticSize: 'Y' }),
    );
    expect(s.layout().get(lines)).toMatchObject({ h: 60 });
  });

  it('grows wrapped text on X only as wide as the parent, then wraps it', () => {
    const s = build();
    const column = s.add(s.root, 'Frame', { Size: [0, 120, 0, 300] });
    const id = s.add(
      column,
      'TextLabel',
      label({
        Text: 'aaaa bbbb cccc dddd',
        Size: [0, 0, 0, 0],
        TextWrapped: true,
        AutomaticSize: 'XY',
      }),
    );
    expect(s.layout().get(id)).toMatchObject({ w: 120, h: 40 });
    // Unwrapped text runs past its parent.
    const long = s.add(
      column,
      'TextLabel',
      label({ Text: 'aaaa bbbb cccc dddd', AutomaticSize: 'XY', Size: [0, 0, 0, 0] }),
    );
    expect(s.layout().get(long)).toMatchObject({ w: 190, h: 20 });
  });

  it('keeps TextScaled text out of it', () => {
    const s = build();
    const id = s.add(
      s.root,
      'TextLabel',
      label({ Text: 'Hello there', TextScaled: true, Size: [0, 30, 0, 10], AutomaticSize: 'XY' }),
    );
    expect(s.layout().get(id)).toMatchObject({ w: 30, h: 10 });
  });

  it('measures an empty TextBox by its placeholder', () => {
    const s = build();
    const id = s.add(s.root, 'TextBox', {
      Text: '',
      PlaceholderText: 'Search',
      TextSize: 20,
      Size: [0, 0, 0, 30],
      AutomaticSize: 'X',
    });
    expect(s.layout().get(id)).toMatchObject({ w: 60 });
  });

  it('grows from its AnchorPoint', () => {
    const s = build();
    const id = s.add(
      s.root,
      'TextLabel',
      label({
        Text: 'Centered',
        AnchorPoint: [0.5, 0.5],
        Position: [0.5, 0, 0.5, 0],
        Size: [0, 0, 0, 20],
        AutomaticSize: 'X',
      }),
    );
    expect(s.layout().get(id)).toMatchObject({ x: 683 - 40, w: 80 });
  });

  it('fits a list: its items and gaps along it, its widest item across it', () => {
    const s = build();
    const card = s.add(s.root, 'Frame', { Size: [0, 200, 0, 20], AutomaticSize: 'Y' });
    s.add(card, 'UIPadding', { PaddingTop: [0, 10], PaddingBottom: [0, 10] });
    s.add(card, 'UIListLayout', { Padding: [0, 5] });
    s.add(card, 'Frame', { Size: [1, 0, 0, 30], LayoutOrder: 1 });
    const second = s.add(card, 'Frame', { Size: [1, 0, 0, 40], LayoutOrder: 2 });
    s.add(card, 'Frame', { Size: [1, 0, 0, 100], LayoutOrder: 3, Visible: false });
    const layout = s.layout();
    expect(layout.get(card)).toMatchObject({ w: 200, h: 10 + 30 + 5 + 40 + 10 });
    expect(layout.get(second)).toMatchObject({ y: 10 + 30 + 5 });

    const row = s.add(s.root, 'Frame', { Size: [0, 0, 0, 0], AutomaticSize: 'XY' });
    s.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 8] });
    s.add(row, 'Frame', { Size: [0, 50, 0, 20] });
    s.add(row, 'Frame', { Size: [0, 70, 0, 35] });
    expect(s.layout().get(row)).toMatchObject({ w: 50 + 8 + 70, h: 35 });
  });

  it('fits free-placed children, counting their AnchorPoint but not space above or left', () => {
    const s = build();
    const box = s.add(s.root, 'Frame', { Size: [0, 0, 0, 0], AutomaticSize: 'XY' });
    s.add(box, 'Frame', { Position: [0, 10, 0, 20], Size: [0, 30, 0, 40] });
    s.add(box, 'Frame', { AnchorPoint: [1, 1], Position: [0, 100, 0, 90], Size: [0, 50, 0, 50] });
    s.add(box, 'Frame', { Position: [0, -40, 0, -40], Size: [0, 20, 0, 20] });
    s.add(box, 'Frame', { Position: [0, 500, 0, 500], Size: [0, 20, 0, 20], Visible: false });
    expect(s.layout().get(box)).toMatchObject({ w: 100, h: 90 });
  });

  it('measures Scale children at Size, then stretches them to the grown box', () => {
    const s = build();
    const box = s.add(s.root, 'Frame', { Size: [0, 200, 0, 50], AutomaticSize: 'Y' });
    const fill = s.add(box, 'Frame', { Size: [1, 0, 1, 0] });
    expect(s.layout().get(box)).toMatchObject({ h: 50 });
    s.add(box, 'Frame', { Position: [0, 0, 0, 100], Size: [0, 20, 0, 20] });
    const layout = s.layout();
    expect(layout.get(box)).toMatchObject({ h: 120 });
    expect(layout.get(fill)).toMatchObject({ w: 200, h: 120 });
  });

  it('grows a card around a label that grows', () => {
    const s = build();
    const card = s.add(s.root, 'Frame', { Size: [0, 200, 0, 0], AutomaticSize: 'Y' });
    s.add(card, 'UIPadding', {
      PaddingTop: [0, 12],
      PaddingBottom: [0, 12],
      PaddingLeft: [0, 12],
      PaddingRight: [0, 12],
    });
    s.add(card, 'UIListLayout', { Padding: [0, 8] });
    s.add(card, 'TextLabel', label({ Text: 'Title', Size: [1, 0, 0, 24], LayoutOrder: 1 }));
    // 176 px wide: 17 letters a line, so three lines.
    const body = s.add(
      card,
      'TextLabel',
      label({
        Text: 'Some words that go on for quite a while',
        Size: [1, 0, 0, 0],
        TextWrapped: true,
        AutomaticSize: 'Y',
        LayoutOrder: 2,
      }),
    );
    const next = s.add(s.root, 'Frame', { Size: [0, 10, 0, 10] });
    const layout = s.layout();
    expect(layout.get(body)).toMatchObject({ y: 12 + 24 + 8, w: 176, h: 60 });
    expect(layout.get(card)).toMatchObject({ h: 12 + 24 + 8 + 60 + 12 });
    expect(layout.get(next)).toMatchObject({ y: 0 });
  });

  it('pushes the next item of a list along', () => {
    const s = build();
    const column = s.add(s.root, 'Frame', { Size: [0, 100, 1, 0] });
    s.add(column, 'UIListLayout', {});
    s.add(
      column,
      'TextLabel',
      label({ Text: 'a\nb\nc', Size: [1, 0, 0, 0], AutomaticSize: 'Y', LayoutOrder: 1 }),
    );
    const after = s.add(column, 'Frame', { Size: [1, 0, 0, 10], LayoutOrder: 2 });
    expect(s.layout().get(after)).toMatchObject({ y: 60 });
  });

  it('makes a page longer when a section on it grows', () => {
    // A new page stacks its sections with a UIListLayout.
    const s = build('page');
    const section = s.add(s.root, 'Frame', { Size: [1, 0, 0, 100], AutomaticSize: 'Y' });
    s.add(section, 'Frame', { Size: [0, 10, 0, 1000] });
    expect(s.layout().get(section)).toMatchObject({ y: 0, h: 1000 });
    expect(s.layout().get(s.root)!.canvas!.h).toBe(1000);

    // Without the list, a free-placed section pushes the page as far as its bottom.
    s.doc = applyCommand(s.doc, remove(byName(s.doc, 'UIListLayout').id)).doc;
    s.doc = applyCommand(s.doc, {
      type: 'setProps',
      id: section,
      props: { Position: [0, 0, 0, 600] },
    }).doc;
    expect(s.layout().get(s.root)!.canvas!.h).toBe(1600);
  });

  it('can differ per breakpoint', () => {
    const s = build('page');
    const id = s.add(s.root, 'TextLabel', label({ Text: 'Hello', Size: [0, 10, 0, 20] }));
    const phone = bp(s.doc, 'Phone');
    s.doc = applyCommand(s.doc, {
      type: 'setProps',
      id,
      props: { AutomaticSize: 'X' },
      breakpoint: phone,
    }).doc;
    const at = (width: number) =>
      s.layout({ width, height: 800 }, breakpointForWidth(s.doc, width)?.id);
    expect(at(1366).get(id)).toMatchObject({ w: 10 });
    expect(at(390).get(id)).toMatchObject({ w: 50 });
  });
});
