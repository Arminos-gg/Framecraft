import { useEffect, useMemo } from 'react';
import { googleFontsHref } from '../../export/html.ts';
import type { Doc } from '../../model/document.ts';
import { FONTS, type FontName } from '../../model/fonts.ts';

const LINK_ID = 'framecraft-doc-fonts';

/**
 * Loads the Google look-alikes of the Roblox fonts the documents use, through one stylesheet
 * link per `linkId`, so the viewport and the template previews don't replace each other's.
 */
export function useDocFonts(docs: Doc | readonly Doc[], linkId = LINK_ID) {
  const href = useMemo(() => {
    const used = new Set<FontName>();
    const list: readonly Doc[] = 'instances' in docs ? [docs] : docs;
    for (const doc of list)
      for (const inst of Object.values(doc.instances)) {
        const font = (inst.props as { Font?: unknown }).Font;
        if (typeof font === 'string' && Object.hasOwn(FONTS, font)) used.add(font as FontName);
      }
    return googleFontsHref([...used].sort());
  }, [docs]);

  useEffect(() => {
    if (!href) return;
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [href, linkId]);
}
