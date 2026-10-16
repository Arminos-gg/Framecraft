import { describe, expect, it } from 'vitest';
import { Builder } from '../../../src/model/builder.ts';
import {
  applyCommand,
  batch,
  insert,
  move,
  remove,
  replace,
  type Command,
} from '../../../src/model/commands.ts';
import {
  extractSubtree,
  reIdSubtree,
  resolveProps,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { History } from '../../../src/model/history.ts';
import {
  copiesOf,
  copyHasChanges,
  copyRootOf,
  deleteComponent,
  detachCopy,
  makeComponent,
  newCopy,
  ownChanges,
  resetCopy,
} from '../../../src/model/linked.ts';
import { parseProject, serializeProject } from '../../../src/model/project.ts';
import { counterIds, expectValid } from './helpers.ts';

/** A ScreenGui with a Card (a Title and a UICorner inside) made into a component, and two more copies. */
function setup() {
  const b = new Builder(counterIds());
  const gui = b.add(b.starterGui, 'ScreenGui');
  const card = b.add(gui, 'Frame', { Name: 'Card', Size: [0, 200, 0, 120] });
  b.add(card, 'TextLabel', { Name: 'Title', Text: 'Hello', TextColor3: [0, 0, 0] });
  b.add(card, 'UICorner');
  const made = makeComponent(b.doc, card, counterIds('k'));
  const history = new History(applyCommand(b.doc, replace(made.patch)).doc);
  const cid = made.componentId;
  const two = newCopy(history.doc, cid, counterIds('a'));
  history.execute(insert(gui, two));
  const three = newCopy(history.doc, cid, counterIds('b'));
  history.execute(insert(gui, three));
  return { history, gui, card, two: two.rootId, three: three.rootId, cid };
}

const child = (doc: Doc, root: InstanceId, name: string): AnyInstance => {
  const found = subtreeIds(doc, root)
    .map((id) => doc.instances[id]!)
    .find((i) => i.props.Name === name);
  expect(found, name).toBeDefined();
  return found!;
};
const props = (inst: AnyInstance) => inst.props as Record<string, unknown>;
const run = (h: History, cmd: Command) => {
  h.execute(cmd);
  expectValid(h.doc);
  return h.doc;
};

describe('linked components', () => {
  it('makes an object a component, with itself as the first copy', () => {
    const { history, card, cid } = setup();
    const doc = history.doc;
    expectValid(doc);
    expect(copiesOf(doc, cid)).toHaveLength(3);
    expect(copiesOf(doc, cid)[0]!.id).toBe(card);
    expect(copyRootOf(doc, child(doc, card, 'Title').id)?.id).toBe(card);
  });

  it('spreads a shared property to every copy, and undo takes it back from all', () => {
    const { history: h, card, two, three } = setup();
    const before = h.doc;
    const title = child(h.doc, two, 'Title');
    const doc = run(h, { type: 'setProps', id: title.id, props: { TextColor3: [255, 0, 0] } });
    for (const root of [card, two, three])
      expect(props(child(doc, root, 'Title')).TextColor3).toEqual([255, 0, 0]);
    h.undo();
    expect(h.doc).toEqual(before);
    h.redo();
    expect(h.doc).toEqual(doc);
  });

  it('keeps each copy’s own text, place and size', () => {
    const { history: h, card, two, three } = setup();
    run(h, { type: 'setProps', id: child(h.doc, two, 'Title').id, props: { Text: 'Two' } });
    const doc = run(h, {
      type: 'setProps',
      id: two,
      props: { Position: [0, 300, 0, 0], Size: [0, 99, 0, 99] },
    });
    expect(props(child(doc, card, 'Title')).Text).toBe('Hello');
    expect(props(child(doc, two, 'Title')).Text).toBe('Two');
    expect(props(doc.instances[card]!).Size).toEqual([0, 200, 0, 120]);
    expect(props(doc.instances[three]!).Position).toEqual([0, 0, 0, 0]);
    // A shared change doesn't touch the text each copy has.
    const after = run(h, {
      type: 'setProps',
      id: child(doc, card, 'Title').id,
      props: { TextSize: 30 },
    });
    expect(props(child(after, two, 'Title')).Text).toBe('Two');
    expect(props(child(after, two, 'Title')).TextSize).toBe(30);
    expect(ownChanges(after, child(after, two, 'Title'))).toEqual(['Text']);
    expect(copyHasChanges(after, two)).toBe(true);
    expect(copyHasChanges(after, three)).toBe(false);
  });

  it('adds and deletes objects in every copy', () => {
    const { history: h, card, two, three } = setup();
    const b = new Builder(counterIds('x'));
    const extra = b.add(b.starterGui, 'ScreenGui');
    const price = b.add(extra, 'TextLabel', { Name: 'Price', Text: '$5' });
    const label = extractSubtree(b.doc, price);
    let doc = run(h, insert(three, label));
    for (const root of [card, two, three]) expect(props(child(doc, root, 'Price')).Text).toBe('$5');
    doc = run(h, remove(child(doc, card, 'Title').id));
    for (const root of [card, two, three])
      expect(subtreeIds(doc, root).map((id) => props(doc.instances[id]!).Name)).not.toContain(
        'Title',
      );
    h.undo();
    h.undo();
    h.redo();
    h.redo();
    expect(h.doc).toEqual(doc);
  });

  it('undoes an edit made on a copy that a later step filled in', () => {
    const { history: h, card, two } = setup();
    // Edit the second copy's title, then delete the title from the first copy and undo both.
    const before = h.doc;
    run(h, { type: 'setProps', id: child(h.doc, two, 'Title').id, props: { TextSize: 40 } });
    run(h, remove(child(h.doc, card, 'Title').id));
    h.undo();
    h.undo();
    expect(h.doc).toEqual(before);
  });

  it('moves an object out of a copy as a plain one, and the other copies lose it', () => {
    const { history: h, gui, card, two } = setup();
    const title = child(h.doc, two, 'Title');
    const doc = run(h, move(title.id, gui));
    expect(doc.instances[title.id]!.copyOf).toBeUndefined();
    expect(subtreeIds(doc, card).map((id) => props(doc.instances[id]!).Name)).not.toContain(
      'Title',
    );
  });

  it('makes duplicates and pastes follow the component, keeping their own text', () => {
    const { history: h, gui, card, two, cid } = setup();
    run(h, { type: 'setProps', id: child(h.doc, two, 'Title').id, props: { Text: 'Mine' } });
    const copy = reIdSubtree(extractSubtree(h.doc, two));
    let doc = run(h, insert(gui, copy));
    expect(copiesOf(doc, cid)).toHaveLength(4);
    expect(props(child(doc, copy.rootId, 'Title')).Text).toBe('Mine');
    // A duplicate of an object inside a copy joins the component.
    const title = reIdSubtree(extractSubtree(doc, child(doc, card, 'Title').id));
    doc = run(h, insert(card, title));
    expect(
      subtreeIds(doc, two).filter((id) => doc.instances[id]!.className === 'TextLabel'),
    ).toHaveLength(2);
  });

  it('keeps one undo step for a drag inside a copy', () => {
    const { history: h, two, three } = setup();
    const title = child(h.doc, two, 'Title').id;
    const before = h.doc;
    h.begin();
    for (let x = 1; x <= 5; x++)
      h.execute({ type: 'setProps', id: title, props: { Position: [0, x * 10, 0, 0] } });
    h.commit();
    expect(props(child(h.doc, three, 'Title')).Position).toEqual([0, 50, 0, 0]);
    h.undo();
    expect(h.doc).toEqual(before);
  });

  it('a copy put inside another copy becomes part of it', () => {
    const { history: h, card, two, three, cid } = setup();
    const doc = run(h, move(three, two));
    expect(copiesOf(doc, cid)).toHaveLength(2);
    expect(
      subtreeIds(doc, card).filter((id) => props(doc.instances[id]!).Name === 'Card'),
    ).toHaveLength(2);
  });

  it('changes per breakpoint are shared, and per-copy ones stay', () => {
    const b = new Builder(counterIds());
    const page = b.add(b.site, 'Page');
    const card = b.add(page, 'Frame', { Name: 'Card' });
    const title = b.add(card, 'TextLabel', { Name: 'Title' });
    const made = makeComponent(b.doc, card, counterIds('k'));
    const h = new History(applyCommand(b.doc, replace(made.patch)).doc);
    const copy = newCopy(h.doc, made.componentId, counterIds('c'));
    run(h, insert(page, copy));
    const phone = b.breakpoint('Phone');
    run(h, { type: 'setProps', id: title, props: { TextSize: 10 }, breakpoint: phone });
    const doc = run(h, {
      type: 'setProps',
      id: card,
      props: { Size: [1, 0, 0, 80] },
      breakpoint: phone,
    });
    const other = child(doc, copy.rootId, 'Title');
    expect(resolveProps(doc, other, phone)).toMatchObject({ TextSize: 10 });
    expect(resolveProps(doc, doc.instances[card]!, phone).Size).toEqual([1, 0, 0, 80]);
    expect(resolveProps(doc, doc.instances[copy.rootId]!, phone).Size).toEqual([0, 200, 0, 140]);
  });

  it('resets a copy’s own text and detaches a copy', () => {
    const { history: h, two, cid } = setup();
    run(h, { type: 'setProps', id: child(h.doc, two, 'Title').id, props: { Text: 'Mine' } });
    let doc = run(h, replace(resetCopy(h.doc, two)));
    expect(props(child(doc, two, 'Title')).Text).toBe('Hello');
    doc = run(h, replace(detachCopy(h.doc, child(doc, two, 'Title').id)));
    expect(copiesOf(doc, cid)).toHaveLength(2);
    expect(subtreeIds(doc, two).every((id) => !doc.instances[id]!.copyOf)).toBe(true);
    // A detached copy no longer changes with the others.
    const now = run(h, {
      type: 'setProps',
      id: child(doc, two, 'Title').id,
      props: { TextSize: 50 },
    });
    expect(props(child(now, copiesOf(now, cid)[0]!.id, 'Title')).TextSize).toBe(14);
  });

  it('deleting a component leaves its copies as plain objects', () => {
    const { history: h, cid } = setup();
    const doc = run(h, replace(deleteComponent(h.doc, cid)));
    expect(doc.components).toBeUndefined();
    expect(Object.values(doc.instances).some((i) => i.copyOf)).toBe(false);
  });

  it('refuses a component inside a copy', () => {
    const { history: h, two } = setup();
    expect(() => makeComponent(h.doc, child(h.doc, two, 'Title').id)).toThrow(/Detach/);
  });

  it('saves and opens components', () => {
    const { history: h } = setup();
    const opened = parseProject(serializeProject(h.doc)).doc;
    expect(opened).toEqual(h.doc);
    // A copy of a component the file lacks opens as plain objects.
    const file = JSON.parse(serializeProject(h.doc));
    delete file.doc.components;
    const plain = parseProject(JSON.stringify(file)).doc;
    expectValid(plain);
    expect(Object.values(plain.instances).some((i) => i.copyOf)).toBe(false);
  });

  it('leaves documents without components alone', () => {
    const b = new Builder(counterIds());
    const gui = b.add(b.starterGui, 'ScreenGui');
    const frame = b.add(gui, 'Frame');
    const r = applyCommand(b.doc, batch({ type: 'setProps', id: frame, props: { Rotation: 5 } }));
    expect(r.exact).toBeUndefined();
  });
});
