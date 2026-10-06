/**
 * TextScaled: the largest whole text size, up to 100, that fits the text box. It needs the
 * rendered text, so it runs on the DOM after each render. Results are cached by font, text and
 * box size; clear the cache when web fonts finish loading, since the sizes change.
 */
const cache = new Map<string, number>();

export function clearFitCache() {
  cache.clear();
}

export function fitTexts(root: HTMLElement) {
  for (const box of root.querySelectorAll<HTMLElement>('.txt[data-fit]')) {
    const span = box.firstElementChild as HTMLElement | null;
    const W = box.clientWidth;
    const H = box.clientHeight;
    if (!span || W <= 0 || H <= 0) continue;
    const s = span.style;
    const key = [
      s.fontFamily,
      s.fontWeight,
      s.fontStyle,
      s.lineHeight,
      span.textContent,
      W,
      H,
      box.className,
    ].join('|');
    let size = cache.get(key);
    if (size === undefined) {
      let lo = 1;
      let hi = 100;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        s.fontSize = mid + 'px';
        const fits =
          span.scrollWidth <= W + 0.5 &&
          span.offsetWidth <= W + 0.5 &&
          span.offsetHeight <= H + 0.5;
        if (fits) lo = mid;
        else hi = mid - 1;
      }
      size = lo;
      if (cache.size > 3000) cache.clear();
      cache.set(key, size);
    }
    s.fontSize = size + 'px';
  }
}
