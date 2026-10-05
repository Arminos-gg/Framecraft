import { describe, expect, it } from 'vitest';
import {
  breakpointForWidth,
  breakpointsOf,
  childOfClass,
  createInstance,
  resolveProps,
  serviceOf,
  extractSubtree,
  isAncestor,
  ModelError,
  reIdSubtree,
  subtreeIds,
  validateDoc,
  type AnyInstance,
  type Doc,
} from '../../../src/model/document.ts';
import { blankDoc, blankSiteDoc } from '../../../src/model/sample.ts';
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

describe('sample and blank documents', () => {
  it('builds a valid sample game menu', () => {
    const doc = sample();
    expectValid(doc);
    // The prototype's 32 instances, plus the DataModel, Site and two breakpoints.
    expect(Object.keys(doc.instances)).toHaveLength(36);
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
    expect(doc.rootId).toBe('game');
    expect(childNames(doc, doc.rootId)).toEqual(['StarterGui', 'Site', 'Tablet', 'Phone']);
    expect(childNames(doc, serviceOf(doc, 'StarterGui').id)).toEqual(['ScreenGui']);
  });

  it('builds a blank website with a home page whose sections stack', () => {
    const doc = blankSiteDoc(counterIds());
    expectValid(doc);
    const home = byName(doc, 'Home');
    expect(home.parent).toBe(serviceOf(doc, 'Site').id);
    expect(home.props).toMatchObject({ Path: '/' });
    expect(childOfClass(doc, home.id, 'UIListLayout')?.props).toMatchObject({
      FillDirection: 'Vertical',
      SortOrder: 'LayoutOrder',
    });
  });

  it('builds a valid two-page sample website', () => {
    const doc = site();
    expectValid(doc);
    expect(childNames(doc, serviceOf(doc, 'Site').id)).toEqual(['Home', 'Pricing']);
    expect(childNames(doc, byName(doc, 'Home').id)).toEqual(['UIListLayout', 'Nav', 'Hero']);
    expect(byName(doc, 'Links', 'Pricing').overrides).toEqual({
      [bp(doc, 'Phone')]: { Visible: false },
    });
  });
});

describe('breakpoints', () => {
  const doc = site();
  const tablet = bp(doc, 'Tablet');
  const phone = bp(doc, 'Phone');

  it('lists breakpoints widest first', () => {
    expect(breakpointsOf(doc).map((b) => b.props.Name)).toEqual(['Tablet', 'Phone']);
  });

  it('picks the narrowest breakpoint a width fits, and none above Tablet', () => {
    const at = (w: number) => breakpointForWidth(doc, w)?.props.Name;
    expect(at(1366)).toBeUndefined();
    expect(at(1200)).toBeUndefined();
    expect(at(1199)).toBe('Tablet');
    expect(at(810)).toBe('Tablet');
    expect(at(809)).toBe('Phone');
    expect(at(320)).toBe('Phone');
  });

  it('resolves values from Desktop through Tablet to Phone', () => {
    const headline = ofClass(byName(doc, 'Headline'), 'TextLabel');
    expect(resolveProps(doc, headline)).toMatchObject({ Size: [0, 720, 0, 140], TextSize: 52 });
    expect(resolveProps(doc, headline, tablet)).toMatchObject({
      Size: [1, -96, 0, 140],
      TextSize: 44,
    });
    expect(resolveProps(doc, headline, phone)).toMatchObject({
      Size: [1, -48, 0, 160],
      TextSize: 34,
    });
    // Values a breakpoint doesn't change come from the base.
    expect(resolveProps(doc, headline, phone).Text).toBe(headline.props.Text);
  });

  it("shows Tablet's changes on Phone unless Phone changes them too", () => {
    const changes = { [tablet]: { TextSize: 30, Visible: false }, [phone]: { TextSize: 20 } };
    const label = { ...byName(doc, 'Logo', 'Home'), overrides: changes } as AnyInstance;
    expect(resolveProps(doc, label, phone)).toMatchObject({ TextSize: 20, Visible: false });
    expect(resolveProps(doc, label, tablet)).toMatchObject({ TextSize: 30, Visible: false });
    expect(resolveProps(doc, label)).toMatchObject({ TextSize: 22, Visible: true });
  });

  it('refuses an id that is not a breakpoint', () => {
    expect(() => resolveProps(doc, byName(doc, 'Headline'), byName(doc, 'Hero').id)).toThrow(
      ModelError,
    );
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

  it('catches a second service and a missing one', () => {
    const doc = sample();
    const sg = serviceOf(doc, 'StarterGui');
    const site = serviceOf(doc, 'Site');
    const twoStarterGuis = edit(doc, site.id, { className: 'StarterGui', props: sg.props });
    const problems = validateDoc(twoStarterGuis).join();
    expect(problems).toContain('is a second StarterGui');
    expect(problems).toContain('The project has no Site');
  });

  it('catches bad changes per breakpoint', () => {
    const doc = site();
    const headline = byName(doc, 'Headline');
    const phone = bp(doc, 'Phone');
    const check = (overrides: unknown) => validateDoc(edit(doc, headline.id, { overrides })).join();
    expect(check({})).toContain('empty overrides map');
    expect(check({ [phone]: {} })).toContain('empty change list');
    expect(check({ [byName(doc, 'Hero').id]: { TextSize: 10 } })).toContain("isn't a breakpoint");
    expect(check({ [phone]: { Text: 'Hi' } })).toContain("can't change Text per breakpoint");
    expect(check({ [phone]: { TextSize: 1000 } })).toContain('invalid TextSize');
  });

  it('catches a preview that is not an image library id', () => {
    const doc = sample();
    const img = createInstance('ImageLabel', {}, 'img');
    const panel = byName(doc, 'Panel');
    const withImage = (preview: string): Doc => ({
      ...doc,
      instances: {
        ...doc.instances,
        img: { ...img, parent: panel.id, preview },
        [panel.id]: { ...panel, children: [...panel.children, 'img'] },
      },
    });
    expect(validateDoc(withImage('img_abc'))).toEqual([]);
    expect(validateDoc(withImage('data:image/png;base64,AAAA')).join()).toContain(
      'invalid preview id',
    );
  });
});
