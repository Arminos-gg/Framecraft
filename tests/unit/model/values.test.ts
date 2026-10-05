import { describe, expect, it } from 'vitest';
import {
  colorSequence,
  normalizeValue,
  numberSequence,
  valueEquals,
} from '../../../src/model/values.ts';

describe('normalizeValue', () => {
  it('rounds UDim2 and UDim offsets to whole pixels and keeps Scale as is', () => {
    expect(normalizeValue('udim2', [0.25, 40.6, 0.1, -20.4])).toEqual([0.25, 41, 0.1, -20]);
    expect(normalizeValue('udim', [0.5, 7.5])).toEqual([0.5, 8]);
  });

  it('rounds and clamps colors to 0-255', () => {
    expect(normalizeValue('color', [300, -5, 12.6])).toEqual([255, 0, 13]);
  });

  it('clamps transparency to 0-1 and numbers to their limits', () => {
    expect(normalizeValue('alpha', 1.4)).toBe(1);
    expect(normalizeValue('alpha', -0.2)).toBe(0);
    expect(normalizeValue('int', 140.7, { min: 1, max: 100 })).toBe(100);
    expect(normalizeValue('int', 2.4)).toBe(2);
    expect(normalizeValue('number', -3, { min: 0 })).toBe(0);
  });

  it('accepts only listed enum options', () => {
    const options = ['Left', 'Center', 'Right'];
    expect(normalizeValue('enum', 'Right', { options })).toBe('Right');
    expect(normalizeValue('enum', 'Middle', { options })).toBeUndefined();
  });

  it('refuses values of the wrong shape', () => {
    expect(normalizeValue('int', '5')).toBeUndefined();
    expect(normalizeValue('number', Number.NaN)).toBeUndefined();
    expect(normalizeValue('udim2', [0, 0, 0])).toBeUndefined();
    expect(normalizeValue('vec2', [0, 'a'])).toBeUndefined();
    expect(normalizeValue('bool', 1)).toBeUndefined();
    expect(normalizeValue('string', null)).toBeUndefined();
  });

  it('accepts sequences that run from time 0 to 1 in order', () => {
    const three = [
      { time: 0, value: [255, 0, 0] },
      { time: 0.4, value: [0, 255, 0] },
      { time: 1, value: [0, 0, 255.4] },
    ];
    expect(normalizeValue('colorseq', three)).toEqual([
      { time: 0, value: [255, 0, 0] },
      { time: 0.4, value: [0, 255, 0] },
      { time: 1, value: [0, 0, 255] },
    ]);
    expect(normalizeValue('numseq', numberSequence(0, 2), { min: 0, max: 1 })).toEqual(
      numberSequence(0, 1),
    );
  });

  it('refuses sequences Roblox would refuse', () => {
    const k = (time: number) => ({ time, value: 0 });
    expect(normalizeValue('numseq', [k(0)])).toBeUndefined();
    expect(normalizeValue('numseq', [k(0.1), k(1)])).toBeUndefined();
    expect(normalizeValue('numseq', [k(0), k(0.9)])).toBeUndefined();
    expect(normalizeValue('numseq', [k(0), k(0.6), k(0.3), k(1)])).toBeUndefined();
    const tooMany = Array.from({ length: 21 }, (_, i) => k(i / 20));
    expect(normalizeValue('numseq', tooMany)).toBeUndefined();
  });
});

describe('sequence helpers', () => {
  it('spread keypoints evenly from 0 to 1', () => {
    expect(colorSequence([1, 2, 3], [4, 5, 6])).toEqual([
      { time: 0, value: [1, 2, 3] },
      { time: 1, value: [4, 5, 6] },
    ]);
    expect(numberSequence(0, 0.5, 1).map((k) => k.time)).toEqual([0, 0.5, 1]);
  });
});

describe('valueEquals', () => {
  it('compares values deeply', () => {
    expect(valueEquals([0, 1, 0, 2], [0, 1, 0, 2])).toBe(true);
    expect(valueEquals([0, 1, 0, 2], [0, 1, 0, 3])).toBe(false);
    expect(
      valueEquals(colorSequence([0, 0, 0], [1, 1, 1]), colorSequence([0, 0, 0], [1, 1, 1])),
    ).toBe(true);
    expect(valueEquals([1], { 0: 1 })).toBe(false);
    expect(valueEquals('a', 'a')).toBe(true);
  });
});

describe('website values', () => {
  it('accepts an image library id or nothing', () => {
    expect(normalizeValue('asset', 'img_abc123')).toBe('img_abc123');
    expect(normalizeValue('asset', '')).toBe('');
    expect(normalizeValue('asset', 'rbxassetid://1')).toBeUndefined();
    expect(normalizeValue('asset', 'data:image/png;base64,AA')).toBeUndefined();
  });

  it('accepts links to a page, a section of a page, or an outside address', () => {
    expect(normalizeValue('link', null)).toBeNull();
    expect(normalizeValue('link', { kind: 'page', page: 'p1' })).toEqual({
      kind: 'page',
      page: 'p1',
    });
    expect(
      normalizeValue('link', { kind: 'page', page: 'p1', section: 'plans', newTab: true }),
    ).toEqual({
      kind: 'page',
      page: 'p1',
      section: 'plans',
      newTab: true,
    });
    expect(
      normalizeValue('link', { kind: 'url', url: ' https://example.com/a ', newTab: false }),
    ).toEqual({
      kind: 'url',
      url: 'https://example.com/a',
    });
    expect(normalizeValue('link', { kind: 'url', url: 'mailto:hi@example.com' })).toEqual({
      kind: 'url',
      url: 'mailto:hi@example.com',
    });
  });

  it('refuses links that could run script or point nowhere', () => {
    const bad = [
      { kind: 'url', url: 'javascript:alert(1)' },
      { kind: 'url', url: 'https://' },
      { kind: 'url', url: 'example.com' },
      { kind: 'page', page: '' },
      { kind: 'page', page: 'p1', section: '1 bad' },
      { kind: 'page', page: 'p1', newTab: 'yes' },
      { kind: 'file', url: 'https://example.com' },
      'https://example.com',
      [],
    ];
    for (const v of bad) expect(normalizeValue('link', v), JSON.stringify(v)).toBeUndefined();
  });
});
