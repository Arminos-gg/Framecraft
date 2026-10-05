import { describe, expect, it } from 'vitest';
import {
  fmtColor,
  fmtLength,
  fmtVec2,
  fromHex,
  hex,
  parseColor,
  parseLength,
  parseNumber,
  parseNums,
  parseUDim2,
  parseVec2,
} from '../../../src/editor/text-values.ts';

describe('Studio shorthand', () => {
  it('reads the numbers in braces, brackets and commas', () => {
    expect(parseNums('{0.5, 0},{0.5, 0}')).toEqual([0.5, 0, 0.5, 0]);
    expect(parseNums('[1 2; 3]')).toEqual([1, 2, 3]);
    expect(parseNums('  ')).toBeNull();
    expect(parseNums('1, two')).toBeNull();
    expect(parseNumber('-4.5')).toBe(-4.5);
    expect(parseNumber('1, 2')).toBeNull();
  });

  it('reads a UDim2 the way Studio does', () => {
    expect(parseUDim2('0.25,40,0.1,20')).toEqual([0.25, 40, 0.1, 20]);
    expect(parseUDim2('{0.25, 40.4},{0.1, 19.6}')).toEqual([0.25, 40, 0.1, 20]);
    // One number: 1 or less is Scale on both axes, more is Offset.
    expect(parseUDim2('0.5')).toEqual([0.5, 0, 0.5, 0]);
    expect(parseUDim2('1')).toEqual([1, 0, 1, 0]);
    expect(parseUDim2('200')).toEqual([0, 200, 0, 200]);
    expect(parseUDim2('0')).toEqual([0, 0, 0, 0]);
    // Two numbers: X then Y, each read on its own.
    expect(parseUDim2('0.5, 120')).toEqual([0.5, 0, 0, 120]);
    expect(parseUDim2('1, 2, 3')).toBeNull();
  });

  it('reads a length in percent and pixels', () => {
    expect(parseLength('50%')).toEqual([0.5, 0]);
    expect(parseLength('200px')).toEqual([0, 200]);
    expect(parseLength('50% + 20px')).toEqual([0.5, 20]);
    expect(parseLength('100%-40PX')).toEqual([1, -40]);
    expect(parseLength(' -25 % + 10.6 px ')).toEqual([-0.25, 11]);
    expect(parseLength('33.333%')).toEqual([0.3333, 0]);
    expect(parseLength('50% + 50% - 10')).toEqual([1, -10]);
    // A lone number reads as Studio does, and a pair is Scale and Offset.
    expect(parseLength('12')).toEqual([0, 12]);
    expect(parseLength('-8')).toEqual([0, -8]);
    expect(parseLength('0.5')).toEqual([0.5, 0]);
    expect(parseLength('0')).toEqual([0, 0]);
    expect(parseLength('0.1, 8')).toEqual([0.1, 8]);
    expect(parseLength('{0.1, 8}')).toEqual([0.1, 8]);
    for (const bad of ['', ' ', '50% 20px', '50%%', 'px', '5em', '1, 2, 3', '+'])
      expect(parseLength(bad), bad).toBeNull();
  });

  it('reads Vector2s and colors', () => {
    expect(parseVec2('0.5')).toEqual([0.5, 0.5]);
    expect(parseVec2('1, 0')).toEqual([1, 0]);
    expect(parseVec2('1, 0, 0')).toBeNull();
    expect(parseColor('#FF8000')).toEqual([255, 128, 0]);
    expect(parseColor('#f80')).toEqual([255, 136, 0]);
    expect(parseColor('[300, -2, 10.4]')).toEqual([255, 0, 10]);
    expect(parseColor('red')).toBeNull();
    expect(parseColor('1, 2')).toBeNull();
    // One number is a gray, as in Studio, even with three digits.
    expect(parseColor('255')).toEqual([255, 255, 255]);
    expect(parseColor('0')).toEqual([0, 0, 0]);
    expect(parseColor(' 128 ')).toEqual([128, 128, 128]);
    expect(parseColor('300')).toEqual([255, 255, 255]);
    expect(parseColor('#255')).toEqual([34, 85, 85]);
    expect(parseColor('ff8000')).toEqual([255, 128, 0]);
    expect(parseColor('112233')).toEqual([17, 34, 51]);
    expect(fromHex('12345')).toBeNull();
  });

  it('writes values back as the fields show them', () => {
    expect(fmtLength([0.5, 0])).toBe('50%');
    expect(fmtLength([0, 200])).toBe('200px');
    expect(fmtLength([0.5, 20])).toBe('50% + 20px');
    expect(fmtLength([1, -40])).toBe('100% - 40px');
    expect(fmtLength([0.12345, 0])).toBe('12.35%');
    expect(fmtLength([-0.25, -8])).toBe('-25% - 8px');
    expect(fmtLength([0, 0])).toBe('0px');
    for (const u of [
      [0.5, 20],
      [1, -40],
      [0.3333, 0],
      [0, -12],
      [0, 0],
    ] as const)
      expect(parseLength(fmtLength(u))).toEqual(u);
    expect(fmtVec2([0.5, 1])).toBe('0.5, 1');
    expect(fmtColor([19, 21, 33])).toBe('[19, 21, 33]');
    expect(hex([255, 128, 0])).toBe('#ff8000');
  });
});
