import { beforeEach, describe, expect, it } from 'vitest';
import { Editor, LIST_PLACES } from '../../../src/editor/editor.ts';
import { alignRects, boundsOf, distributeRects } from '../../../src/editor/geometry.ts';
import { applyCommand, setLocked } from '../../../src/model/commands.ts';
import { isLocked, validateDoc, type InstanceId } from '../../../src/model/document.ts';
import { parseProject, serializeProject } from '../../../src/model/project.ts';
import { sampleProject } from '../../../src/model/sample.ts';

describe('align and distribute math', () => {
  const rects = [
    { x: 10, y: 0, w: 20, h: 10 },
    { x: 50, y: 30, w: 40, h: 20 },
    { x: 200, y: 5, w: 10, h: 10 },
  ];

  it('lines rectangles up with the box around them', () => {
    const to = boundsOf(rects);
    expect(to).toEqual({ x: 10, y: 0, w: 200, h: 50 });
    expect(alignRects(rects, to, 'left').map((r) => r.x)).toEqual([10, 10, 10]);
    expect(alignRects(rects, to, 'right').map((r) => r.x + r.w)).toEqual([210, 210, 210]);
    expect(alignRects(rects, to, 'center').map((r) => r.x + r.w / 2)).toEqual([110, 110, 110]);
    expect(alignRects(rects, to, 'bottom').map((r) => r.y + r.h)).toEqual([50, 50, 50]);
    expect(alignRects(rects, to, 'middle').map((r) => r.y)).toEqual([20, 15, 20]);
  });

  it('spaces rectangles evenly, keeping the first and last', () => {
    const spread = distributeRects([rects[2]!, rects[0]!, rects[1]!], 'x');
    // 200 px wide, 70 px of objects: two gaps of 65 px.
    expect(spread.map((r) => r.x)).toEqual([200, 10, 95]);
    expect(distributeRects(rects.slice(0, 2), 'x')).toEqual(rects.slice(0, 2));
  });
});

let ed: Editor;
let frames: InstanceId[];
const pos = (i: InstanceId) => (ed.doc.instances[i]!.props as Record<string, unknown>).Position;
const box = (i: InstanceId) => ed.scene.layout.get(i)!;
const byName = (name: string) =>
  Object.values(ed.doc.instances).find((i) => i.props.Name === name)!.id;

beforeEach(() => {
  ed = new Editor(sampleProject());
  ed.select(byName('MainMenu'));
  frames = [0, 1, 2].map(() => {
    const f = ed.insert('Frame', byName('MainMenu'))!;
    ed.select(byName('MainMenu'));
    return f;
  });
  ed.setProp(frames[0]!, 'Position', [0, 100, 0, 100]);
  ed.setProp(frames[1]!, 'Position', [0, 300, 0, 150]);
  ed.setProp(frames[2]!, 'Position', [0, 900, 0, 120]);
  ed.setProp(frames[1]!, 'Size', [0, 100, 0, 50]);
});

describe('aligning the selection', () => {
  it('lines several objects up with each other, in one undo step', () => {
    ed.selectMany(frames);
    ed.alignSelection('top');
    expect(frames.map((f) => box(f).y)).toEqual([100, 100, 100]);
    expect(pos(frames[1]!)).toEqual([0, 300, 0, 100]);
    ed.alignSelection('right');
    const right = box(frames[2]!).x + box(frames[2]!).w;
    expect(frames.map((f) => box(f).x + box(f).w)).toEqual([right, right, right]);
    ed.undo();
    ed.undo();
    expect(pos(frames[1]!)).toEqual([0, 300, 0, 150]);
  });

  it('centers one object in its parent with percents and an AnchorPoint', () => {
    ed.select(frames[0]!);
    ed.alignSelection('center');
    ed.alignSelection('bottom');
    const p = ed.doc.instances[frames[0]!]!.props as Record<string, unknown>;
    expect(p.Position).toEqual([0.5, 0, 1, 0]);
    expect(p.AnchorPoint).toEqual([0.5, 1]);
    const b = box(frames[0]!);
    expect(b.x + b.w / 2).toBe(ed.scene.width / 2);
    expect(b.y + b.h).toBe(ed.scene.height);
  });

  it('moves one object in pixels when edits are set to pixels', () => {
    ed.setUnit('offset');
    ed.select(frames[0]!);
    ed.alignSelection('right');
    expect(pos(frames[0]!)).toEqual([0, ed.scene.width - box(frames[0]!).w, 0, 100]);
  });

  it('spaces three or more evenly', () => {
    ed.selectMany(frames);
    ed.distributeSelection('x');
    const [a, b, c] = frames.map(box);
    expect(b!.x - (a!.x + a!.w)).toBeCloseTo(c!.x - (b!.x + b!.w), 0);
    ed.selectMany(frames.slice(0, 2));
    ed.distributeSelection('x');
    expect(ed.state.toast?.text).toMatch(/three or more/);
  });

  it('leaves list items and locked objects where they are, and says so', () => {
    ed.select(byName('PlayButton'));
    ed.alignSelection('left');
    expect(ed.state.toast?.text).toBe(LIST_PLACES);
    ed.toggleLocked(frames[1]!);
    ed.selectMany(frames);
    ed.alignSelection('left');
    expect(pos(frames[1]!)).toEqual([0, 300, 0, 150]);
    expect(pos(frames[2]!)).toEqual([0, 100, 0, 120]);
    expect(ed.state.toast?.text).toMatch(/locked object stays/);
  });
});

describe('locking', () => {
  it('is saved with the project, undoes, and locks what is inside', () => {
    const coins = byName('Coins');
    ed.select(coins);
    ed.toggleSelectedLocked();
    expect(ed.doc.instances[coins]!.locked).toBe(true);
    expect(isLocked(ed.doc, byName('Amount'))).toBe(true);
    expect(validateDoc(ed.doc)).toEqual([]);
    const reopened = parseProject(serializeProject(ed.doc));
    expect(reopened.doc.instances[coins]!.locked).toBe(true);
    ed.undo();
    expect(ed.doc.instances[coins]!.locked).toBeUndefined();
  });

  it('keeps locked objects from dragging, nudging and box selection', () => {
    const f = frames[0]!;
    ed.toggleLocked(f);
    ed.select(f);
    ed.nudge(5, 0);
    expect(pos(f)).toEqual([0, 100, 0, 100]);
    expect(ed.state.toast?.text).toMatch(/Unlock it/);
    const b = box(f);
    ed.startDrag('move', f, { x: b.x + 5, y: b.y + 5 });
    ed.dragTo({ x: b.x + 50, y: b.y + 50 }, { zoom: 1 });
    ed.endDrag();
    expect(pos(f)).toEqual([0, 100, 0, 100]);
    ed.selectInRect({ x: 0, y: 0, w: ed.scene.width, h: ed.scene.height });
    expect(ed.state.selected).not.toContain(f);
    expect(ed.state.selected).toContain(frames[1]);
  });

  it('only locks objects, Folders and ScreenGuis', () => {
    const doc = ed.doc;
    const starter = byName('StarterGui');
    expect(() => applyCommand(doc, setLocked(starter, true))).toThrow(/can't be locked/);
  });
});
