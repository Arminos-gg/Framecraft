import { describe, expect, it } from 'vitest';
import {
  moveRect,
  nearest,
  positionFor,
  resizeRect,
  rotate,
  sizeFor,
  snapTargets,
  writeAxis,
} from '../../../src/editor/geometry.ts';
import type { Box } from '../../../src/layout/layout.ts';

const area = { x: 0, y: 0, w: 1366, h: 768 };

const box = (x: number, y: number, w: number, h: number, extra: Partial<Box> = {}): Box => {
  const r = { x, y, w, h };
  return { ...r, rotation: 0, visible: true, listItem: false, area, content: r, ...extra };
};

describe('writeAxis', () => {
  it('keeps each value in its own unit in Auto', () => {
    expect(writeAxis([0, 10], 30, 100, 'auto')).toEqual([0, 30]);
    expect(writeAxis([0.5, 0], 60, 200, 'auto')).toEqual([0.3, 0]);
    // Mixed values change their Offset.
    expect(writeAxis([0.5, 10], 120, 200, 'auto')).toEqual([0.5, 20]);
    // A zero value counts as Offset.
    expect(writeAxis([0, 0], 42, 200, 'auto')).toEqual([0, 42]);
  });

  it('writes the chosen unit and keeps the other part', () => {
    expect(writeAxis([0.5, 10], 120, 200, 'scale')).toEqual([0.55, 10]);
    expect(writeAxis([0.5, 0], 120, 200, 'offset')).toEqual([0.5, 20]);
  });

  it('rounds Offset to whole pixels and Scale to 4 decimals', () => {
    expect(writeAxis([0, 0], 10.6, 200, 'offset')).toEqual([0, 11]);
    expect(writeAxis([0, 0], 100, 300, 'scale')).toEqual([0.3333, 0]);
  });

  it('falls back to Offset when the parent has no length', () => {
    expect(writeAxis([0.5, 0], 30, 0, 'scale')).toEqual([0.5, 30]);
  });
});

describe('positionFor and sizeFor', () => {
  it('measures Position at the AnchorPoint', () => {
    // Coins: AnchorPoint (1, 0), right edge 20 px from the screen edge.
    const rect = { x: 1170, y: 20, w: 176, h: 52 };
    expect(positionFor([1, -20, 0, 20], [1, 0], area, rect, 'auto')).toEqual([1, -20, 0, 20]);
    expect(positionFor([1, -20, 0, 20], [1, 0], area, { ...rect, x: 1100 }, 'auto')).toEqual([
      1, -90, 0, 20,
    ]);
    // Centered by AnchorPoint 0.5, in Scale.
    const centered = { x: 683 - 50, y: 384 - 25, w: 100, h: 50 };
    expect(positionFor([0.5, 0, 0.5, 0], [0.5, 0.5], area, centered, 'auto')).toEqual([
      0.5, 0, 0.5, 0,
    ]);
  });

  it('is relative to the parent area', () => {
    const inner = { x: 100, y: 50, w: 400, h: 200 };
    expect(
      positionFor([0, 0, 0, 0], [0, 0], inner, { x: 140, y: 70, w: 10, h: 10 }, 'auto'),
    ).toEqual([0, 40, 0, 20]);
    expect(sizeFor([0.5, 0, 0, 30], inner, 300, 60, 'auto')).toEqual([0.75, 0, 0, 60]);
  });
});

describe('snapping', () => {
  it('finds the closest line within reach', () => {
    expect(nearest([10, 50], [0, 47, 100], 5)).toEqual({ d: -3, line: 47 });
    expect(nearest([10], [0, 100], 5)).toBeNull();
  });

  it('offers the parent area and visible, unrotated siblings', () => {
    const t = snapTargets(area, [
      box(100, 100, 50, 50),
      box(300, 300, 10, 10, { visible: false }),
      box(500, 500, 10, 10, { rotation: 15 }),
    ]);
    expect(t.xs).toEqual([0, 683, 1366, 100, 125, 150]);
    expect(t.ys).toEqual([0, 384, 768, 100, 125, 150]);
  });

  it('moves edges or the center onto a line and draws a guide', () => {
    const t = snapTargets(area, []);
    const m = moveRect(box(1170, 20, 176, 52), 17, 0, t, 6);
    expect(m.rect).toEqual({ x: 1190, y: 20, w: 176, h: 52 });
    expect(m.guides).toEqual([{ axis: 'v', at: 1366, from: 0, to: 768 }]);
    const centered = moveRect(box(600, 300, 100, 50), 30, 0, t, 6);
    expect(centered.rect.x + 50).toBe(683);
    expect(moveRect(box(1170, 20, 176, 52), 17, 0, null, 6).rect.x).toBe(1187);
  });
});

describe('resizeRect', () => {
  const start = box(100, 100, 200, 100);
  const free = { snap: null, threshold: 6, keepRatio: false };

  it('moves the dragged edges only', () => {
    expect(resizeRect(start, 'e', 40, 10, free).rect).toEqual({ x: 100, y: 100, w: 240, h: 100 });
    expect(resizeRect(start, 'w', 40, 10, free).rect).toEqual({ x: 140, y: 100, w: 160, h: 100 });
    expect(resizeRect(start, 'n', 5, -20, free).rect).toEqual({ x: 100, y: 80, w: 200, h: 120 });
    expect(resizeRect(start, 'se', 20, 30, free).rect).toEqual({ x: 100, y: 100, w: 220, h: 130 });
  });

  it('keeps proportions on a corner with Shift', () => {
    const r = resizeRect(start, 'nw', -100, 0, { ...free, keepRatio: true }).rect;
    expect(r).toEqual({ x: 0, y: 50, w: 300, h: 150 });
  });

  it('never goes below 1 px, keeping the opposite edge in place', () => {
    expect(resizeRect(start, 'w', 500, 0, free).rect).toEqual({ x: 299, y: 100, w: 1, h: 100 });
    expect(resizeRect(start, 's', 0, -500, free).rect.h).toBe(1);
  });

  it('snaps the dragged edge', () => {
    const t = snapTargets(area, [box(400, 0, 10, 10)]);
    const m = resizeRect(start, 'e', 97, 0, { ...free, snap: t });
    expect(m.rect.w).toBe(300);
    expect(m.guides).toEqual([{ axis: 'v', at: 400, from: 0, to: 768 }]);
  });
});

it('rotates clockwise on screen', () => {
  const [x, y] = rotate(1, 0, 90);
  expect(x).toBeCloseTo(0);
  expect(y).toBeCloseTo(1);
});
