/**
 * The project's image library. Images are stored once, keyed by a hash of their bytes, and
 * objects refer to them by id: an ImageLabel's preview, a page's social image, the favicon.
 * The library lives next to the document rather than inside it, so the document stays small
 * enough to snapshot and compare. Project files carry the images they use.
 */
import { propSpec } from './classes.ts';
import type { Doc } from './document.ts';
import { ASSET_ID_PATTERN, type AssetId } from './values.ts';

/** Image id to data URL. */
export type Assets = Readonly<Record<AssetId, string>>;

const DATA_URL_PATTERN = /^data:image\/[\w.+-]+(;[\w=.+-]+)*;base64,[A-Za-z0-9+/=]*$/;
export const isImageDataUrl = (s: unknown): s is string =>
  typeof s === 'string' && DATA_URL_PATTERN.test(s);
export const isAssetId = (s: unknown): s is AssetId =>
  typeof s === 'string' && ASSET_ID_PATTERN.test(s);

/** cyrb53: a fast 53-bit string hash, plenty for telling a project's images apart. */
function hash53(s: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** The id an image gets in the library. The same picture always gets the same id. */
export const assetIdFor = (dataUrl: string): AssetId =>
  'img_' + hash53(dataUrl).toString(36) + dataUrl.length.toString(36);

/** Adds an image (a data URL) to the library; adding the same image twice keeps one copy. */
export function addAsset(assets: Assets, dataUrl: string): { assets: Assets; id: AssetId } {
  if (!isImageDataUrl(dataUrl)) throw new TypeError('Not an image data URL');
  const id = assetIdFor(dataUrl);
  return { assets: Object.hasOwn(assets, id) ? assets : { ...assets, [id]: dataUrl }, id };
}

/** Every image id the document uses: previews and image properties such as Favicon. */
export function usedAssets(doc: Doc): Set<AssetId> {
  const used = new Set<AssetId>();
  for (const inst of Object.values(doc.instances)) {
    if (inst.preview) used.add(inst.preview);
    for (const [key, value] of Object.entries(inst.props)) {
      if (value && propSpec(inst.className, key)?.type === 'asset') used.add(value as AssetId);
    }
  }
  return used;
}
