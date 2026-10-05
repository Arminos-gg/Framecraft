import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  batch,
  insert,
  move,
  remove,
  resetOverrides,
  setPreview,
  setProps,
  type Command,
} from '../../../src/model/commands.ts';
import {
  createInstance,
  extractSubtree,
  ModelError,
  resolveProps,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type Subtree,
} from '../../../src/model/document.ts';
import { pageSubtree } from '../../../src/model/sample.ts';
import {
  bp,
  byName,
  childNames,
  counterIds,
  expectValid,
  ofClass,
  sample,
  site,
} from './helpers.ts';

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

  it('puts pages only in Site and screens only in StarterGui', () => {
    const doc = sample();
    const sg = serviceOf(doc, 'StarterGui').id;
    const siteId = serviceOf(doc, 'Site').id;
    const page = pageSubtree({ Name: 'About', Path: '/about' }, counterIds('p'));
    const next = applyAndRevert(doc, insert(siteId, page));
    expect(childNames(next, siteId)).toEqual(['About']);
    expect(() => applyCommand(doc, insert(sg, page))).toThrow(
      "A Page can't go inside a StarterGui",
    );
    const screen = single(createInstance('ScreenGui', {}, 's') as AnyInstance);
    expect(() => applyCommand(doc, insert(siteId, screen))).toThrow(
      "A ScreenGui can't go inside a Site",
    );
  });

  it('refuses a second Site', () => {
    const doc = sample();
    const another = single(createInstance('Site', {}, 'site2') as AnyInstance);
    expect(() => applyCommand(doc, insert(doc.rootId, another))).toThrow('already a Site');
  });

  it('refuses changes for a breakpoint the project does not have, and bad preview ids', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel').id;
    const withChanges = {
      ...createInstance('Frame', {}, 'x'),
      overrides: { gone: { Visible: false } },
    };
    expect(() => applyCommand(doc, insert(panel, single(withChanges)))).toThrow(
      "breakpoint this project doesn't have",
    );
    const image = { ...createInstance('ImageLabel', {}, 'y'), preview: 'data:image/png;base64,AA' };
    expect(() => applyCommand(doc, insert(panel, single(image)))).toThrow('invalid preview');
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

  it('refuses to delete the root or a service', () => {
    const doc = sample();
    expect(() => applyCommand(doc, remove(doc.rootId))).toThrow(ModelError);
    expect(() => applyCommand(doc, remove(serviceOf(doc, 'StarterGui').id))).toThrow(
      "The StarterGui can't be deleted",
    );
    expect(() => applyCommand(doc, remove(serviceOf(doc, 'Site').id))).toThrow(ModelError);
  });

  it("takes a deleted breakpoint's changes with it, and undo brings them back", () => {
    const doc = site();
    const phone = bp(doc, 'Phone');
    const next = applyAndRevert(doc, remove(phone));
    expect(childNames(next, next.rootId)).toEqual(['StarterGui', 'Site', 'Tablet']);
    for (const inst of Object.values(next.instances)) {
      expect(Object.keys(inst.overrides ?? {})).not.toContain(phone);
    }
    // Headline keeps its Tablet changes; Links had only Phone changes, so it has none left.
    expect(Object.keys(byName(next, 'Headline').overrides!)).toEqual([bp(doc, 'Tablet')]);
    expect(byName(next, 'Links', 'Home').overrides).toBeUndefined();
  });

  it("keeps an object's changes per breakpoint through delete and undo", () => {
    const doc = site();
    applyAndRevert(doc, remove(byName(doc, 'Hero').id));
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

  it('refuses to move a service, even within the root', () => {
    const doc = sample();
    expect(() => applyCommand(doc, move(serviceOf(doc, 'Site').id, doc.rootId, 0))).toThrow(
      "The Site can't be moved",
    );
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
    const shown = applyAndRevert(withImage, setPreview('img', 'img_abc123'));
    expect(shown.instances.img!.preview).toBe('img_abc123');
    const cleared = applyAndRevert(shown, setPreview('img', null));
    expect(cleared.instances.img!.preview).toBeUndefined();
    expect(() => applyCommand(doc, setPreview(byName(doc, 'Panel').id, 'img_abc'))).toThrow(
      "can't have a preview",
    );
    expect(() => applyCommand(withImage, setPreview('img', 'data:image/png;base64,AA'))).toThrow(
      "isn't an image library id",
    );
  });
});

describe('changes per breakpoint', () => {
  const doc = site();
  const tablet = bp(doc, 'Tablet');
  const phone = bp(doc, 'Phone');
  const cta = ofClass(byName(doc, 'Subscribe'), 'TextButton');

  it('changes only that breakpoint and leaves the base as it was', () => {
    const next = applyAndRevert(doc, setProps(cta, { Size: [1, -48, 0, 52], TextSize: 18 }, phone));
    const after = next.instances[cta.id]!;
    expect(after.props).toEqual(cta.props);
    expect(after.overrides).toEqual({ [phone]: { Size: [1, -48, 0, 52], TextSize: 18 } });
    expect(resolveProps(next, after, phone)).toMatchObject({ TextSize: 18 });
    expect(resolveProps(next, after, tablet)).toMatchObject({ TextSize: 16 });
  });

  it('adds to the changes a breakpoint already has, and undo restores the old value', () => {
    const headline = ofClass(byName(doc, 'Headline'), 'TextLabel');
    const next = applyAndRevert(doc, setProps(headline, { TextSize: 30, Visible: false }, phone));
    expect(next.instances[headline.id]!.overrides![phone]).toEqual({
      Size: [1, -48, 0, 160],
      TextSize: 30,
      Visible: false,
    });
  });

  it('keeps a value set on a breakpoint even when it matches the inherited one', () => {
    const next = applyAndRevert(doc, setProps(cta, { TextSize: 16 }, phone));
    expect(next.instances[cta.id]!.overrides).toEqual({ [phone]: { TextSize: 16 } });
    const same = applyCommand(
      next,
      setProps(ofClass(next.instances[cta.id]!, 'TextButton'), { TextSize: 16 }, phone),
    );
    expect(same.changed).toBe(false);
  });

  it('resets changes so the inherited values show again', () => {
    const headline = byName(doc, 'Headline');
    const partly = applyAndRevert(doc, resetOverrides(headline.id, phone, ['TextSize']));
    expect(partly.instances[headline.id]!.overrides![phone]).toEqual({ Size: [1, -48, 0, 160] });
    expect(resolveProps(partly, partly.instances[headline.id]!, phone)).toMatchObject({
      TextSize: 44,
    });
    const all = applyAndRevert(doc, resetOverrides(headline.id, phone, ['TextSize', 'Size']));
    expect(Object.keys(all.instances[headline.id]!.overrides!)).toEqual([tablet]);
    const links = byName(doc, 'Links', 'Home');
    const none = applyAndRevert(doc, resetOverrides(links.id, phone, ['Visible']));
    expect(none.instances[links.id]!.overrides).toBeUndefined();
    expect(applyCommand(doc, resetOverrides(cta.id, phone, ['Size'])).changed).toBe(false);
  });

  it('sets and resets in one command', () => {
    const headline = byName(doc, 'Headline');
    const cmd: Command = {
      type: 'setProps',
      id: headline.id,
      props: { Visible: false },
      breakpoint: phone,
      clear: ['Size', 'TextSize'],
    };
    const next = applyAndRevert(doc, cmd);
    expect(next.instances[headline.id]!.overrides![phone]).toEqual({ Visible: false });
  });

  it('refuses what a breakpoint may not change', () => {
    const set = (cmd: Partial<Command & { type: 'setProps' }>) => () =>
      applyCommand(doc, { type: 'setProps', id: cta.id, props: {}, ...cmd } as Command);
    expect(set({ props: { Text: 'Hi' }, breakpoint: phone })).toThrow(
      "TextButton can't change Text per breakpoint",
    );
    expect(set({ props: { Name: 'X' }, breakpoint: phone })).toThrow('per breakpoint');
    expect(set({ props: { TextSize: 'big' }, breakpoint: phone })).toThrow(ModelError);
    expect(set({ props: { TextSize: 12 }, breakpoint: cta.id })).toThrow('No breakpoint');
    expect(set({ clear: ['TextSize'] })).toThrow('Only a breakpoint');
    expect(set({ props: { TextSize: 12 }, breakpoint: phone, clear: ['TextSize'] })).toThrow(
      'set and reset at once',
    );
    const img = createInstance('ImageLabel', {}, 'img') as AnyInstance;
    const withImage = applyCommand(doc, insert(byName(doc, 'Hero').id, single(img))).doc;
    expect(() =>
      applyCommand(withImage, { ...setPreview('img', 'img_abc'), breakpoint: phone } as Command),
    ).toThrow('same at every breakpoint');
  });

  it('lets a breakpoint be renamed and resized, but not moved out of the project', () => {
    const tabletInst = ofClass(doc.instances[tablet]!, 'Breakpoint');
    applyAndRevert(doc, setProps(tabletInst, { Name: 'Small laptop', MaxWidth: 1279 }));
    expect(() => applyCommand(doc, move(tablet, serviceOf(doc, 'Site').id))).toThrow(ModelError);
    applyAndRevert(doc, move(tablet, doc.rootId));
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
