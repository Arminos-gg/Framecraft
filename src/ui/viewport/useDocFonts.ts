import { useEffect, useMemo } from 'react';
import type { Doc } from '../../model/document.ts';
import { faceKey, googleFontsHref, isFontName, parseFaceKey } from '../../model/fonts.ts';

const LINK_ID = 'framecraft-doc-fonts';

/**
 * Loads the web fonts the documents use, at the weights and styles they use, through one
 * stylesheet link per `linkId`, so the viewport and the template previews don't replace each
 * other's.
 */
export function useDocFonts(docs: Doc | readonly Doc[], linkId = LINK_ID) {
  const href = useMemo(() => {
    const used = new Set<string>();
    const list: readonly Doc[] = 'instances' in docs ? [docs] : docs;
    for (const doc of list)
      for (const inst of Object.values(doc.instances)) {
        const p = inst.props as { Font?: unknown; FontWeight?: unknown; FontStyle?: unknown };
        if (!isFontName(p.Font)) continue;
        const face = { font: p.Font, weight: p.FontWeight, style: p.FontStyle };
        used.add(faceKey(face as Parameters<typeof faceKey>[0]));
      }
    return googleFontsHref([...used].sort().map(parseFaceKey));
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
