import { describe, expect, it } from 'vitest';
import {
  addAsset,
  assetIdFor,
  isAssetId,
  isImageDataUrl,
  usedAssets,
} from '../../../src/model/assets.ts';
import { applyCommand, insert, setPreview, setProps } from '../../../src/model/commands.ts';
import {
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
} from '../../../src/model/document.ts';
import { byName, sample } from './helpers.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const SVG = 'data:image/svg+xml;base64,PHN2Zy8+';

describe('image library', () => {
  it('gives the same picture the same id, and different pictures different ids', () => {
    expect(assetIdFor(PNG)).toBe(assetIdFor(PNG));
    expect(assetIdFor(PNG)).not.toBe(assetIdFor(SVG));
    expect(isAssetId(assetIdFor(PNG))).toBe(true);
  });

  it('stores a picture once however often it is added', () => {
    const first = addAsset({}, PNG);
    const again = addAsset(first.assets, PNG);
    expect(again.id).toBe(first.id);
    expect(again.assets).toBe(first.assets);
    const both = addAsset(again.assets, SVG);
    expect(Object.keys(both.assets)).toHaveLength(2);
    expect(first.assets).toEqual({ [first.id]: PNG });
  });

  it('only takes image data URLs', () => {
    expect(isImageDataUrl(PNG)).toBe(true);
    expect(isImageDataUrl(SVG)).toBe(true);
    expect(isImageDataUrl('data:text/html;base64,PGI+')).toBe(false);
    expect(isImageDataUrl('https://example.com/a.png')).toBe(false);
    expect(() => addAsset({}, 'rbxassetid://1')).toThrow(TypeError);
  });

  it('finds the pictures a document uses: previews and image properties', () => {
    const doc = sample();
    expect(usedAssets(doc)).toEqual(new Set());
    const img = createInstance('ImageLabel', {}, 'img') as AnyInstance;
    let next = applyCommand(doc, insert(byName(doc, 'Panel').id, single(img))).doc;
    next = applyCommand(next, setPreview('img', 'img_one')).doc;
    next = applyCommand(next, setProps(serviceOf(next, 'Site'), { Favicon: 'img_two' })).doc;
    expect(usedAssets(next)).toEqual(new Set(['img_one', 'img_two']));
  });
});
