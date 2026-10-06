import { describe, expect, it } from 'vitest';
import { rulerSteps, rulerTicks } from '../../../src/ui/viewport/rulers.ts';

describe('the measuring grid and rulers', () => {
  it('spaces lines and labels so they never crowd', () => {
    expect(rulerSteps(1)).toEqual({ minor: 10, major: 100 });
    expect(rulerSteps(0.5)).toEqual({ minor: 20, major: 200 });
    expect(rulerSteps(2)).toEqual({ minor: 5, major: 50 });
    expect(rulerSteps(8)).toEqual({ minor: 1, major: 10 });
    for (const zoom of [0.05, 0.1, 0.2, 0.33, 0.5, 0.75, 1, 1.5, 3, 8]) {
      const { minor, major } = rulerSteps(zoom);
      expect(minor * zoom, `ticks at ${zoom}`).toBeGreaterThanOrEqual(6);
      expect(major * zoom, `labels at ${zoom}`).toBeGreaterThanOrEqual(56);
      expect(major % minor).toBe(0);
    }
  });

  it('puts ticks on whole pixels from the device origin, labels on every major step', () => {
    // Device pixel 0 sits 40 screen pixels in, at zoom 1.
    const t = rulerTicks(300, 40, 1, { minor: 10, major: 100 });
    expect(t.labels).toEqual([0, 100, 200]);
    expect(t.major).toEqual([40.5, 140.5, 240.5]);
    expect(t.mid).toEqual([90.5, 190.5, 290.5]);
    // The ruler starts 40 px before the device, so the first tick is at -40.
    expect(t.minor[0]).toBe(0.5);
    expect(t.minor.length + t.mid.length + t.major.length).toBe(31);
  });

  it('counts back from the device origin when it has scrolled out of view', () => {
    const t = rulerTicks(200, -250, 0.5, { minor: 20, major: 200 });
    expect(t.labels).toEqual([600, 800]);
    expect(t.major).toEqual([50.5, 150.5]);
    expect(t.minor.every((x) => x >= 0 && x <= 201)).toBe(true);
  });
});
