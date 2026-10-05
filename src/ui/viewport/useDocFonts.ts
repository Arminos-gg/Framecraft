import { useEffect, useMemo } from 'react';
import { googleFontsHref } from '../../export/html.ts';
import type { Doc } from '../../model/document.ts';
import { FONTS, type FontName } from '../../model/fonts.ts';

const LINK_ID = 'framecraft-doc-fonts';

/** Loads the Google look-alikes of the Roblox fonts the document uses. */
export function useDocFonts(doc: Doc) {
  const href = useMemo(() => {
    const used = new Set<FontName>();
    for (const inst of Object.values(doc.instances)) {
      const font = (inst.props as { Font?: unknown }).Font;
      if (typeof font === 'string' && Object.hasOwn(FONTS, font)) used.add(font as FontName);
    }
    return googleFontsHref([...used].sort());
  }, [doc]);

  useEffect(() => {
    if (!href) return;
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [href]);
}
