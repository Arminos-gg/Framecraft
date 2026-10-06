/**
 * The measuring grid and the rulers: how far apart their lines are at a zoom, and where the
 * ticks of a ruler fall. Everything is in device pixels unless it says screen.
 */

/** Spacings a grid or ruler may use, in device pixels. */
const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export interface Steps {
  /** Between ticks and fine grid lines. */
  readonly minor: number;
  /** Between labels and strong grid lines; a multiple of `minor`. */
  readonly major: number;
}

/** Ticks at least 6 screen pixels apart, labels at least 56, so neither crowds at any zoom. */
export function rulerSteps(zoom: number): Steps {
  const minor = NICE.find((s) => s * zoom >= 6) ?? NICE.at(-1)!;
  const major = NICE.find((s) => s >= minor * 5 && s % minor === 0 && s * zoom >= 56) ?? minor * 10;
  return { minor, major };
}

export interface Ticks {
  /** Screen positions of plain ticks, of ticks halfway between labels, and of labeled ones. */
  readonly minor: number[];
  readonly mid: number[];
  readonly major: number[];
  /** The value at each labeled tick, in the same order as `major`. */
  readonly labels: number[];
}

/**
 * The ticks of a ruler `length` screen pixels long, where device pixel 0 is at screen
 * position `offset`. Positions are whole pixels plus a half, so 1 px lines stay sharp.
 */
export function rulerTicks(length: number, offset: number, zoom: number, steps: Steps): Ticks {
  const { minor, major } = steps;
  const half = major / 2;
  const marksHalf = half % minor === 0;
  const ticks: Ticks = { minor: [], mid: [], major: [], labels: [] };
  const last = (length - offset) / zoom;
  for (let v = Math.ceil(-offset / zoom / minor) * minor; v <= last; v += minor) {
    const at = Math.round(offset + v * zoom) + 0.5;
    if (v % major === 0) {
      ticks.major.push(at);
      ticks.labels.push(v === 0 ? 0 : v);
    } else if (marksHalf && v % half === 0) ticks.mid.push(at);
    else ticks.minor.push(at);
  }
  return ticks;
}
