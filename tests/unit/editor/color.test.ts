import { describe, expect, it } from 'vitest';
import { docColors, hsvToRgb, rgbToHsv } from '../../../src/editor/color.ts';
import { sampleProject } from '../../../src/model/sample.ts';
import type { Color3 } from '../../../src/model/values.ts';

describe('hue, saturation and brightness', () => {
  it('converts both ways', () => {
    const cases: [Color3, [number, number, number]][] = [
      [
        [255, 0, 0],
        [0, 1, 1],
      ],
      [
        [0, 255, 0],
        [120, 1, 1],
      ],
      [
        [0, 0, 255],
        [240, 1, 1],
      ],
      [
        [255, 128, 0],
        [30, 1, 1],
      ],
      [
        [255, 255, 255],
        [0, 0, 1],
      ],
      [
        [0, 0, 0],
        [0, 0, 0],
      ],
    ];
    for (const [c, hsv] of cases) {
      const [h, s, v] = rgbToHsv(c);
      expect(h).toBeCloseTo(hsv[0], 0);
      expect(s).toBeCloseTo(hsv[1], 2);
      expect(v).toBeCloseTo(hsv[2], 2);
      expect(hsvToRgb(rgbToHsv(c))).toEqual(c);
    }
  });

  it('round-trips every sixteenth color', () => {
    for (let r = 0; r < 256; r += 17)
      for (let g = 0; g < 256; g += 17)
        for (let b = 0; b < 256; b += 17) expect(hsvToRgb(rgbToHsv([r, g, b]))).toEqual([r, g, b]);
  });

  it('keeps the given hue for grays, which have none', () => {
    expect(rgbToHsv([128, 128, 128], 200)[0]).toBe(200);
    expect(rgbToHsv([0, 0, 0], 90)[0]).toBe(90);
    expect(rgbToHsv([255, 0, 0], 90)[0]).toBe(0);
  });
});

describe('docColors', () => {
  it('lists the colors a project uses, most used first, once each', () => {
    const colors = docColors(sampleProject());
    expect(colors.length).toBeGreaterThan(3);
    expect(colors.length).toBeLessThanOrEqual(16);
    expect(new Set(colors.map((c) => c.join())).size).toBe(colors.length);
    expect(docColors(sampleProject(), 2)).toEqual(colors.slice(0, 2));
  });
});
