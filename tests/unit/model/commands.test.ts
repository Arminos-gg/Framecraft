import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  batch,
  insert,
  move,
  remove,
  setPreview,
  setProps,
  type Command,
} from '../../../src/model/commands.ts';
import {
  createInstance,
  extractSubtree,
  ModelError,
  single,
  type AnyInstance,
  type Doc,
  type Subtree,
} from '../../../src/model/document.ts';
import { byName, childNames, expectValid, sample } from './helpers.ts';

/** Applies a command, checks the result is valid, and checks the inverse gives back the original. */
function applyAndRevert(doc: Doc, cmd: Command): Doc {
  const before = structuredClone(doc);
  const r = applyCommand(doc, cmd);
  expect(r.changed).toBe(true);
  expectValid(r.doc);
  expect(doc, 'the original document is untouched').toEqual(before);
  const back = applyCommand(r.doc, r.inverse);
  expectValid(back.doc);
  expect(back.doc).toEqual(doc);
  return r.doc;
}

const frame = (id: string, name = 'New') =>
  single(createInstance('Frame', { Name: name }, id) as AnyInstance);

describe('insert', () => {
  it('adds an object at a position among its siblings', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    const next = applyAndRevert(doc, insert(panel.id, frame('x', 'Badge'), 1));
    expect(childNames(next, panel.id)).toEqual([
      'UICorner',
      'Badge',
      'UIStroke',
      'UIPadding',
      'Title',
      'Subtitle',
      'Buttons',
    ]);
  });

  it('appends by default and inserts whole subtrees', () => {
    const doc = sample();
    const copy = extractSubtree(doc, byName(doc, 'Coins').id);
    const ids = Object.keys(copy.instances);
    const fresh: Subtree = {
      rootId: 'copy-' + copy.rootId,
      instances: Object.fromEntries(
        Object.values(copy.instances).map((i) => [
          'copy-' + i.id,
          {
            ...i,
            id: 'copy-' + i.id,
            parent: i.parent && 'copy-' + i.parent,
            children: i.children.map((c) => 'copy-' + c),
          } as AnyInstance,
        ]),
      ),
    };
    const panel = byName(doc, 'Panel');
    const next = applyAndRevert(doc, insert(panel.id, fresh));
    expect(childNames(next, panel.id).at(-1)).toBe('Coins');
    expect(Object.keys(next.instances)).toHaveLength(
      Object.keys(doc.instances).length + ids.length,
    );
  });

  it('refuses a class that cannot go there', () => {
    const doc = sample();
    expect(() => applyCommand(doc, insert(doc.rootId, frame('x')))).toThrow(ModelError);
    const corner = single(createInstance('UICorner', {}, 'c') as AnyInstance);
    expect(() => applyCommand(doc, insert(byName(doc, 'MainMenu').id, corner))).toThrow(
      "A UICorner can't go inside a ScreenGui",
    );
  });

  it('refuses ids that are already used and missing parents', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    expect(() => applyCommand(doc, insert(panel.id, frame(panel.id)))).toThrow(ModelError);
    expect(() => applyCommand(doc, insert('nope', frame('x')))).toThrow(ModelError);
  });
});

describe('delete', () => {
  it('removes an object with everything inside it', () => {
    const doc = sample();
    const coins = byName(doc, 'Coins');
    const next = applyAndRevert(doc, remove(coins.id));
    expect(Object.keys(next.instances)).toHaveLength(Object.keys(doc.instances).length - 8);
    expect(childNames(next, byName(doc, 'MainMenu').id)).toEqual(['Panel', 'Version']);
  });

  it('puts a deleted object back in the same place on undo', () => {
    const doc = sample();
    const shop = byName(doc, 'ShopButton');
    const r = applyCommand(doc, remove(shop.id));
    const back = applyCommand(r.doc, r.inverse).doc;
    expect(childNames(back, byName(doc, 'Buttons').id)).toEqual([
      'UIListLayout',
      'PlayButton',
      'ShopButton',
      'SettingsButton',
    ]);
  });

  it('refuses to delete the root', () => {
    const doc = sample();
    expect(() => applyCommand(doc, remove(doc.rootId))).toThrow(ModelError);
  });
});

describe('move', () => {
  it('reparents an object', () => {
    const doc = sample();
    const version = byName(doc, 'Version');
    const panel = byName(doc, 'Panel');
    const next = applyAndRevert(doc, move(version.id, panel.id, 0));
    expect(next.instances[version.id]!.parent).toBe(panel.id);
    expect(childNames(next, panel.id)[0]).toBe('Version');
    expect(childNames(next, byName(doc, 'MainMenu').id)).toEqual(['Coins', 'Panel']);
  });

  it('reorders within the same parent', () => {
    const doc = sample();
    const buttons = byName(doc, 'Buttons');
    const play = byName(doc, 'PlayButton');
    const toEnd = applyAndRevert(doc, move(play.id, buttons.id));
    expect(childNames(toEnd, buttons.id)).toEqual([
      'UIListLayout',
      'ShopButton',
      'SettingsButton',
      'PlayButton',
    ]);
    const toStart = applyAndRevert(doc, move(play.id, buttons.id, 0));
    expect(childNames(toStart, buttons.id)[0]).toBe('PlayButton');
  });

  it('reports no change for a move to the same place', () => {
    const doc = sample();
    const play = byName(doc, 'PlayButton');
    const r = applyCommand(doc, move(play.id, byName(doc, 'Buttons').id, 1));
    expect(r.changed).toBe(false);
    expect(r.doc).toBe(doc);
  });

  it('refuses to move an object into itself or its own descendants', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    expect(() => applyCommand(doc, move(panel.id, panel.id))).toThrow("can't go inside itself");
    expect(() => applyCommand(doc, move(panel.id, byName(doc, 'PlayButton').id))).toThrow(
      "can't go inside itself",
    );
  });

  it('refuses a parent of the wrong class', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    expect(() => applyCommand(doc, move(panel.id, doc.rootId))).toThrow(ModelError);
    expect(() => applyCommand(doc, move(doc.rootId, panel.id))).toThrow(ModelError);
  });
});

describe('setProps', () => {
  it('changes properties and normalizes the values', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    if (panel.className !== 'Frame') throw new Error('Panel should be a Frame');
    const next = applyAndRevert(
      doc,
      setProps(panel, { Size: [0.5, 10.6, 0.5, 0], Visible: false }),
    );
    const updated = next.instances[panel.id]!;
    expect(updated.props).toMatchObject({ Size: [0.5, 11, 0.5, 0], Visible: false });
    expect(updated.props.Name).toBe('Panel');
  });

  it('reports no change when the values are already set', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    const r = applyCommand(doc, { type: 'setProps', id: panel.id, props: { Name: 'Panel' } });
    expect(r.changed).toBe(false);
    expect(r.doc).toBe(doc);
  });

  it('refuses unknown properties and invalid values', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    const set = (props: Record<string, unknown>) => () =>
      applyCommand(doc, { type: 'setProps', id: panel.id, props });
    expect(set({ Text: 'Hi' })).toThrow("Frame can't take Text");
    expect(set({ BackgroundColor3: 'red' })).toThrow(ModelError);
    expect(set({ Name: 'Ok', Size: 'big' })).toThrow(ModelError);
  });

  it('sets and clears an image preview', () => {
    const doc = sample();
    const img = createInstance('ImageLabel', {}, 'img') as AnyInstance;
    const withImage = applyCommand(doc, insert(byName(doc, 'Panel').id, single(img))).doc;
    const shown = applyAndRevert(withImage, setPreview('img', 'data:image/png;base64,AAAA'));
    expect(shown.instances.img!.preview).toBe('data:image/png;base64,AAAA');
    const cleared = applyAndRevert(shown, setPreview('img', null));
    expect(cleared.instances.img!.preview).toBeUndefined();
    expect(() => applyCommand(doc, setPreview(byName(doc, 'Panel').id, 'data:,'))).toThrow(
      "can't have a preview",
    );
  });
});

describe('batch', () => {
  it('applies several commands as one and reverts them in reverse order', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    const next = applyAndRevert(
      doc,
      batch(
        insert(panel.id, frame('x', 'Badge')),
        insert('x', single(createInstance('UICorner', {}, 'xc') as AnyInstance)),
        move(byName(doc, 'Version').id, 'x'),
        { type: 'setProps', id: 'x', props: { Size: [0, 40, 0, 40] } },
        remove(byName(doc, 'Subtitle').id),
      ),
    );
    expect(childNames(next, 'x')).toEqual(['UICorner', 'Version']);
  });

  it('changes nothing when one command fails', () => {
    const doc = sample();
    const before = structuredClone(doc);
    const panel = byName(doc, 'Panel');
    expect(() =>
      applyCommand(doc, batch(remove(byName(doc, 'Title').id), move(panel.id, doc.rootId))),
    ).toThrow(ModelError);
    expect(doc).toEqual(before);
  });
});
