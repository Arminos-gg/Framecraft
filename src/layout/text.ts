/**
 * How big a piece of text is, for AutomaticSize. In the app the browser measures it, with the
 * same styles the Stage and the exports draw text with (see ui/viewport/text-measure.ts).
 * Where there's no browser, such as in unit tests, an estimate stands in.
 */
import type { TextFace } from '../model/fonts.ts';

export interface TextRequest extends TextFace {
  readonly text: string;
  /** TextSize in pixels. */
  readonly size: number;
  /** LineHeight: each line is this many times the text size tall; 1 when left out. */
  readonly lineHeight?: number;
  /** Extra space after each letter in pixels, as CSS letter-spacing; 0 when left out. */
  readonly letterSpacing?: number;
  /** Wrap at this width, as TextWrapped does; leave it out to keep each line whole. */
  readonly wrap?: number;
}

/** The text's bounds, as Roblox's TextBounds: the widest line, and the lines' total height. */
export interface TextSize {
  readonly w: number;
  readonly h: number;
}

export type TextMeasurer = (request: TextRequest) => TextSize;

/**
 * An estimate for where there's no browser to measure in: every character half the text size
 * wide plus the letter spacing, and lines broken at spaces, or inside a word too long for the line.
 */
export const estimateText: TextMeasurer = ({
  text,
  size,
  wrap,
  lineHeight = 1,
  letterSpacing = 0,
}) => {
  if (!text) return { w: 0, h: 0 };
  const advance = Math.max(1, size / 2 + letterSpacing);
  const fits = wrap === undefined ? Infinity : Math.max(1, Math.floor(wrap / advance));
  const lines: number[] = []; // characters on each line
  for (const paragraph of text.split('\n')) {
    let line = 0;
    for (const word of paragraph.split(' ')) {
      const longer = line ? line + 1 + word.length : word.length;
      if (line && longer > fits) {
        lines.push(line);
        line = word.length;
      } else line = longer;
      for (; line > fits; line -= fits) lines.push(fits);
    }
    lines.push(line);
  }
  return { w: Math.max(...lines) * advance, h: lines.length * size * lineHeight };
};

let current: TextMeasurer = estimateText;
let version = 0;

/** Measures text with the measurer in use: the browser's in the app, the estimate elsewhere. */
export const measureText: TextMeasurer = (request) => current(request);

/** Sets how text is measured. The app uses the browser's own measurer. */
export function setTextMeasurer(measurer: TextMeasurer) {
  current = measurer;
  version++;
}

/** Text may measure differently now, such as after web fonts load; lay out again. */
export function textChanged() {
  version++;
}

/** Changes whenever text may measure differently, so cached layouts know to start over. */
export const textVersion = (): number => version;
