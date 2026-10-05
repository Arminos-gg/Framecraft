import { describe, expect, it } from 'vitest';
import {
  fmtColor,
  fmtUDim2,
  fmtVec2,
  fromHex,
  hex,
  parseColor,
  parseNumber,
  parseNums,
  parseUDim,
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

  it('reads UDims, Vector2s and colors', () => {
    expect(parseUDim('0.1, 8')).toEqual([0.1, 8]);
    expect(parseUDim('12')).toEqual([0, 12]);
    expect(parseUDim('0.5')).toEqual([0.5, 0]);
    expect(parseVec2('0.5')).toEqual([0.5, 0.5]);
    expect(parseVec2('1, 0')).toEqual([1, 0]);
    expect(parseVec2('1, 0, 0')).toBeNull();
    expect(parseColor('#FF8000')).toEqual([255, 128, 0]);
    expect(parseColor('#f80')).toEqual([255, 136, 0]);
    expect(parseColor('[300, -2, 10.4]')).toEqual([255, 0, 10]);
    expect(parseColor('red')).toBeNull();
    expect(fromHex('12345')).toBeNull();
  });

  it('writes values back as the fields show them', () => {
    expect(fmtUDim2([0.5, 0, 0.12345, -8])).toBe('{0.5, 0},{0.1235, -8}');
    expect(fmtVec2([0.5, 1])).toBe('0.5, 1');
    expect(fmtColor([19, 21, 33])).toBe('[19, 21, 33]');
    expect(hex([255, 128, 0])).toBe('#ff8000');
  });
});
