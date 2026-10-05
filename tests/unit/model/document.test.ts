import { describe, expect, it } from 'vitest';
import {
  childOfClass,
  createInstance,
  extractSubtree,
  isAncestor,
  ModelError,
  reIdSubtree,
  subtreeIds,
  validateDoc,
  type AnyInstance,
  type Doc,
} from '../../../src/model/document.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { byName, childNames, counterIds, expectValid, sample } from './helpers.ts';

describe('sample and blank documents', () => {
  it('builds a valid sample game menu', () => {
    const doc = sample();
    expectValid(doc);
    expect(Object.keys(doc.instances)).toHaveLength(32);
    const sg = byName(doc, 'MainMenu');
    expect(childNames(doc, sg.id)).toEqual(['Coins', 'Panel', 'Version']);
    expect(childNames(doc, byName(doc, 'Buttons').id)).toEqual([
      'UIListLayout',
      'PlayButton',
      'ShopButton',
      'SettingsButton',
    ]);
  });

  it('builds a blank project with one ScreenGui', () => {
    const doc = blankDoc(counterIds());
    expectValid(doc);
    expect(childNames(doc, doc.rootId)).toEqual(['ScreenGui']);
  });
});

describe('lookups', () => {
  const doc = sample();
  const panel = byName(doc, 'Panel');

  it('finds a child by class', () => {
    expect(childOfClass(doc, panel.id, 'UIPadding')?.props.PaddingTop).toEqual([0, 24]);
    expect(childOfClass(doc, panel.id, 'UIGradient')).toBeUndefined();
  });

  it('knows ancestors', () => {
    const play = byName(doc, 'PlayButton');
    expect(isAncestor(doc, panel.id, play.id)).toBe(true);
    expect(isAncestor(doc, play.id, panel.id)).toBe(false);
    expect(isAncestor(doc, panel.id, panel.id)).toBe(false);
  });

  it('lists a subtree parents first', () => {
    const coins = byName(doc, 'Coins');
    const names = subtreeIds(doc, coins.id).map((id) => doc.instances[id]!.props.Name);
    expect(names).toEqual([
      'Coins',
      'UICorner',
      'UIStroke',
      'CoinIcon',
      'UICorner',
      'UIGradient',
      'UIStroke',
      'Amount',
    ]);
  });

  it('copies a subtree with fresh ids', () => {
    const original = extractSubtree(doc, byName(doc, 'Coins').id);
    const copy = reIdSubtree(original, counterIds('c'));
    expect(copy.rootId).toBe('c1');
    expect(copy.instances[copy.rootId]!.parent).toBeNull();
    const ids = new Set(Object.keys(copy.instances));
    expect(ids.size).toBe(8);
    for (const inst of Object.values(copy.instances)) {
      expect(doc.instances[inst.id]).toBeUndefined();
      for (const c of inst.children) expect(copy.instances[c]!.parent).toBe(inst.id);
    }
  });
});

describe('createInstance', () => {
  it('fills defaults and normalizes values', () => {
    const f = createInstance('Frame', { Position: [0.5, 10.4, 0, 0] }, 'f');
    expect(f.props.Size).toEqual([0, 200, 0, 140]);
    expect(f.props.Position).toEqual([0.5, 10, 0, 0]);
    expect(f.props.Name).toBe('Frame');
  });

  it('refuses invalid values', () => {
    // @ts-expect-error not a Frame property
    expect(() => createInstance('Frame', { Text: 'x' })).toThrow(ModelError);
    expect(() => createInstance('Frame', { Size: [0, 0] as never })).toThrow(ModelError);
  });
});

describe('validateDoc', () => {
  const edit = (doc: Doc, id: string, change: Partial<Record<string, unknown>>): Doc => ({
    ...doc,
    instances: { ...doc.instances, [id]: { ...doc.instances[id]!, ...change } as AnyInstance },
  });

  it('accepts a valid document', () => {
    expect(validateDoc(sample())).toEqual([]);
  });

  it('catches broken links', () => {
    const doc = sample();
    const coins = byName(doc, 'Coins');
    expect(
      validateDoc(edit(doc, coins.id, { parent: byName(doc, 'Panel').id })).length,
    ).toBeGreaterThan(0);
    expect(
      validateDoc(edit(doc, coins.id, { children: [...coins.children, 'nope'] })).length,
    ).toBeGreaterThan(0);
  });

  it('catches classes in the wrong place', () => {
    const doc = sample();
    const sg = byName(doc, 'MainMenu');
    const wrong = edit(doc, sg.id, { className: 'Frame', props: createInstance('Frame').props });
    expect(validateDoc(wrong).join()).toContain("can't sit inside a StarterGui");
  });

  it('catches invalid and unknown properties', () => {
    const doc = sample();
    const panel = byName(doc, 'Panel');
    const badSize = edit(doc, panel.id, { props: { ...panel.props, Size: [0.34, 0.5, 0.72, 0] } });
    expect(validateDoc(badSize).join()).toContain('invalid Size');
    const extra = edit(doc, panel.id, { props: { ...panel.props, Text: 'x' } });
    expect(validateDoc(extra).join()).toContain('unknown property Text');
  });

  it('catches instances not connected to the root', () => {
    const doc = sample();
    const extra = createInstance('Frame', {}, 'orphan');
    const orphaned: Doc = { ...doc, instances: { ...doc.instances, orphan: extra } };
    expect(validateDoc(orphaned).join()).toContain('orphan has no parent');
  });
});
