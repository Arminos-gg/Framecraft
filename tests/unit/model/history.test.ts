import { describe, expect, it, vi } from 'vitest';
import { insert, move, remove, resetOverrides, type Command } from '../../../src/model/commands.ts';
import {
  createInstance,
  ModelError,
  single,
  type AnyInstance,
} from '../../../src/model/document.ts';
import { History } from '../../../src/model/history.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { bp, byName, childNames, counterIds, ofClass, sample, site } from './helpers.ts';

const setSize = (id: string, size: readonly number[]) =>
  ({ type: 'setProps', id, props: { Size: size } }) as const;

describe('History', () => {
  it('undoes and redoes each kind of edit', () => {
    const start = sample();
    const h = new History(start);
    const panel = byName(start, 'Panel').id;
    const steps = [
      insert(panel, single(createInstance('Frame', { Name: 'Badge' }, 'x') as AnyInstance)),
      move(byName(start, 'Version').id, panel, 0),
      setSize(panel, [0.5, 0, 0.5, 0]),
      remove(byName(start, 'Coins').id),
    ];
    const docs = [h.doc];
    for (const s of steps) docs.push(h.execute(s));

    for (let i = steps.length - 1; i >= 0; i--) {
      expect(h.undo()).toBe(true);
      expect(h.doc).toEqual(docs[i]);
    }
    expect(h.undo()).toBe(false);
    expect(h.canUndo).toBe(false);

    for (let i = 1; i <= steps.length; i++) {
      expect(h.redo()).toBe(true);
      expect(h.doc).toEqual(docs[i]);
    }
    expect(h.redo()).toBe(false);
  });

  it('clears redo after a new edit', () => {
    const h = new History(sample());
    const panel = byName(h.doc, 'Panel').id;
    h.execute(setSize(panel, [0.5, 0, 0.5, 0]));
    h.undo();
    expect(h.canRedo).toBe(true);
    h.execute(setSize(panel, [0.6, 0, 0.6, 0]));
    expect(h.canRedo).toBe(false);
  });

  it('records no step for an invalid edit or one that changes nothing', () => {
    const h = new History(sample());
    const before = h.doc;
    expect(() => h.execute(remove(h.doc.rootId))).toThrow(ModelError);
    h.execute({ type: 'setProps', id: byName(h.doc, 'Panel').id, props: { Name: 'Panel' } });
    expect(h.doc).toBe(before);
    expect(h.canUndo).toBe(false);
  });

  it('turns a drag into one undo step', () => {
    const h = new History(sample());
    const panel = byName(h.doc, 'Panel').id;
    const start = h.doc;
    h.begin();
    for (let x = 1; x <= 50; x++) {
      h.execute({ type: 'setProps', id: panel, props: { Position: [0.5, x, 0.5, 0] } });
    }
    h.execute(setSize(panel, [0.4, 0, 0.7, 0]));
    h.commit();
    const end = h.doc;
    expect(end.instances[panel]!.props).toMatchObject({
      Position: [0.5, 50, 0.5, 0],
      Size: [0.4, 0, 0.7, 0],
    });

    expect(h.undo()).toBe(true);
    expect(h.doc).toEqual(start);
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toBe(true);
    expect(h.doc).toEqual(end);
  });

  it('groups different kinds of edits into one step', () => {
    const h = new History(sample());
    const start = h.doc;
    const panel = byName(start, 'Panel').id;
    h.begin();
    h.execute(insert(panel, single(createInstance('Frame', {}, 'x') as AnyInstance)));
    h.execute(setSize('x', [0, 10, 0, 10]));
    h.execute(move(byName(start, 'Version').id, 'x'));
    h.commit();
    expect(childNames(h.doc, 'x')).toEqual(['Version']);
    h.undo();
    expect(h.doc).toEqual(start);
  });

  it('records nothing for an empty gesture and restores the start on cancel', () => {
    const h = new History(sample());
    const start = h.doc;
    h.begin();
    h.commit();
    expect(h.canUndo).toBe(false);

    h.begin();
    h.execute(setSize(byName(start, 'Panel').id, [1, 0, 1, 0]));
    h.cancel();
    expect(h.doc).toBe(start);
    expect(h.canUndo).toBe(false);
  });

  it('cancels a gesture when undo is pressed during it', () => {
    const h = new History(sample());
    const start = h.doc;
    h.begin();
    h.execute(setSize(byName(start, 'Panel').id, [1, 0, 1, 0]));
    expect(h.undo()).toBe(true);
    expect(h.doc).toBe(start);
    expect(h.inGroup).toBe(false);
  });

  it('refuses to start a gesture inside another', () => {
    const h = new History(sample());
    h.begin();
    expect(() => h.begin()).toThrow(ModelError);
  });

  it('keeps at most `limit` steps', () => {
    const h = new History(sample(), 3);
    const panel = byName(h.doc, 'Panel').id;
    for (let i = 1; i <= 5; i++) h.execute(setSize(panel, [0, i, 0, i]));
    let undone = 0;
    while (h.undo()) undone++;
    expect(undone).toBe(3);
    expect(h.doc.instances[panel]!.props).toMatchObject({ Size: [0, 2, 0, 2] });
  });

  it('notifies subscribers of every change', () => {
    const h = new History(sample());
    const listener = vi.fn();
    const off = h.subscribe(listener);
    h.execute(setSize(byName(h.doc, 'Panel').id, [1, 0, 1, 0]));
    h.undo();
    h.redo();
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    h.undo();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('starts over on reset', () => {
    const h = new History(sample());
    h.execute(setSize(byName(h.doc, 'Panel').id, [1, 0, 1, 0]));
    const blank = blankDoc(counterIds('b'));
    h.reset(blank);
    expect(h.doc).toBe(blank);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});

describe('History with breakpoints', () => {
  const at = (id: string, breakpoint: string | undefined, props: Record<string, unknown>) =>
    ({ type: 'setProps', id, props, ...(breakpoint && { breakpoint }) }) as Command;

  /** Runs `steps` as one gesture and checks undo gives the start back and redo the end. */
  function gesture(steps: (doc: ReturnType<typeof site>) => Command[]) {
    const h = new History(site());
    const start = h.doc;
    h.begin();
    for (const s of steps(start)) h.execute(s);
    h.commit();
    const end = h.doc;
    expect(h.undo()).toBe(true);
    expect(h.doc).toEqual(start);
    expect(h.redo()).toBe(true);
    expect(h.doc).toEqual(end);
    expect(h.undo()).toBe(true);
    expect(h.undo()).toBe(false);
    return { start, end };
  }

  it('turns a drag on Phone into one step that undoes back to no change', () => {
    const { start, end } = gesture((doc) => {
      const cta = byName(doc, 'Subscribe').id;
      return Array.from({ length: 20 }, (_, x) =>
        at(cta, bp(doc, 'Phone'), { Position: [0.5, x, 0.66, 0] }),
      );
    });
    const cta = byName(start, 'Subscribe').id;
    expect(start.instances[cta]!.overrides).toBeUndefined();
    expect(end.instances[cta]!.overrides).toEqual({
      [bp(start, 'Phone')]: { Position: [0.5, 19, 0.66, 0] },
    });
  });

  it('keeps edits at different breakpoints apart within a gesture', () => {
    const { end, start } = gesture((doc) => {
      const headline = byName(doc, 'Headline').id;
      return [
        at(headline, undefined, { TextSize: 60 }),
        at(headline, bp(doc, 'Tablet'), { TextSize: 40 }),
        at(headline, bp(doc, 'Phone'), { TextSize: 30 }),
        at(headline, undefined, { TextSize: 64 }),
      ];
    });
    const headline = ofClass(end.instances[byName(start, 'Headline').id]!, 'TextLabel');
    expect(headline.props.TextSize).toBe(64);
    expect(headline.overrides![bp(start, 'Tablet')]).toMatchObject({ TextSize: 40 });
    expect(headline.overrides![bp(start, 'Phone')]).toMatchObject({ TextSize: 30 });
  });

  it('merges a set followed by a reset of the same property', () => {
    const { start, end } = gesture((doc) => {
      const headline = byName(doc, 'Headline').id;
      const phone = bp(doc, 'Phone');
      return [
        at(headline, phone, { TextSize: 20, Visible: false }),
        resetOverrides(headline, phone, ['TextSize']),
        at(headline, phone, { Size: [1, 0, 0, 100] }),
      ];
    });
    const id = byName(start, 'Headline').id;
    expect(end.instances[id]!.overrides![bp(start, 'Phone')]).toEqual({
      Size: [1, 0, 0, 100],
      Visible: false,
    });
  });

  it('merges a reset followed by a new value for the same property', () => {
    const { start, end } = gesture((doc) => {
      const links = byName(doc, 'Links', 'Home').id;
      const phone = bp(doc, 'Phone');
      return [resetOverrides(links, phone, ['Visible']), at(links, phone, { Visible: true })];
    });
    const id = byName(start, 'Links', 'Home').id;
    expect(end.instances[id]!.overrides).toEqual({ [bp(start, 'Phone')]: { Visible: true } });
  });
});
