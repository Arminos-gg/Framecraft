/**
 * The browser's own text measurer for the layout engine. It lays text out exactly as the Stage
 * and the exported pages do (a span with the LineHeight in a flex box, `pre` or `pre-wrap`), so
 * AutomaticSize in the editor matches the exports. Results are cached until web fonts load.
 */
import { fontCss } from '../../model/fonts.ts';
import { setTextMeasurer, textChanged, type TextMeasurer } from '../../layout/text.ts';

/** Measures text in `doc`, caching each answer; `clear` forgets them. */
export function domTextMeasurer(doc: Document = document) {
  const cache = new Map<string, { w: number; h: number }>();
  let box: HTMLDivElement | null = null;
  let span: HTMLSpanElement | null = null;

  const measure: TextMeasurer = (request) => {
    const { text, size, wrap, lineHeight = 1, letterSpacing = 0 } = request;
    const f = fontCss(request);
    const key = [
      f.family,
      f.weight,
      f.style,
      size,
      wrap ?? '',
      lineHeight,
      letterSpacing,
      text,
    ].join('|');
    const known = cache.get(key);
    if (known) return known;
    if (!box || !span || !box.isConnected) {
      box = doc.createElement('div');
      span = doc.createElement('span');
      // Out of sight and out of the page's layout; text properties reset to the defaults the
      // Stage and the exports draw with.
      box.style.cssText =
        'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;' +
        'display:flex;align-items:flex-start;letter-spacing:normal;word-spacing:normal;' +
        'text-transform:none;font-variant:normal;font-feature-settings:normal';
      box.append(span);
      doc.body.append(box);
    }
    const s = span.style;
    s.fontFamily = f.family;
    s.fontWeight = String(f.weight);
    s.fontStyle = f.style;
    s.fontSize = size + 'px';
    s.lineHeight = String(lineHeight);
    s.letterSpacing = letterSpacing ? letterSpacing + 'px' : '';
    s.whiteSpace = wrap === undefined ? 'pre' : 'pre-wrap';
    s.overflowWrap = wrap === undefined ? '' : 'anywhere';
    box.style.width = wrap === undefined ? 'max-content' : wrap + 'px';
    span.textContent = text;
    const cs = getComputedStyle(span);
    const out = { w: parseFloat(cs.width) || 0, h: parseFloat(cs.height) || 0 };
    if (cache.size > 5000) cache.clear();
    cache.set(key, out);
    return out;
  };
  return { measure, clear: () => cache.clear() };
}

/**
 * Makes the layout engine measure text in this browser. When web fonts finish loading, text
 * measures differently, so the cache clears and `onChange` runs to lay out again.
 */
export function measureTextInBrowser(onChange: () => void) {
  const text = domTextMeasurer();
  setTextMeasurer(text.measure);
  document.fonts?.addEventListener('loadingdone', () => {
    text.clear();
    textChanged();
    onChange();
  });
}
