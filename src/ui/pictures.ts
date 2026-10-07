/**
 * Pictures from the user: image files (SVG included), SVG code copied from an icon site, and
 * pictures pasted or dropped onto the editor. SVGs are cleaned before they go into the image
 * library, and one-color SVGs come in white so ImageColor3 can color them, as Roblox colors
 * its icons.
 */
import { svgDataUrl } from '../model/assets.ts';
import type { Picture } from '../editor/editor.ts';
import { MAX_PICTURE_BYTES, readDataUrl } from './files.ts';

/** What file pickers offer for pictures. */
export const PICTURE_TYPES = 'image/*,.svg';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Elements that run code or pull in other documents. */
const UNSAFE = ['script', 'foreignObject', 'iframe', 'embed', 'object'];
/** Elements whose colors aren't one plain color. */
const MULTICOLOR = ['style', 'image', 'linearGradient', 'radialGradient', 'pattern', 'mask'];
const PAINTS = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
const NO_PAINT = /^(none|transparent|inherit)$/i;
/** Black, which an SVG uses when it gives no color, and currentColor, which is black in a picture. */
const INK = /^(currentcolor|black|#000|#000000|#000f|#000000ff|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i;

/** Whether text looks like SVG markup. */
export const looksLikeSvg = (text: string): boolean =>
  /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>\s*)?<svg[\s>]/i.test(text);

/**
 * An SVG made safe to keep and show: no scripts, event handlers or javascript: links, and a
 * width and height from its viewBox when it has none, so it has a size everywhere. A one-color
 * SVG (black or currentColor, which a picture shows as black) is made white and `oneColor` is
 * true. Null when the text isn't an SVG.
 */
export function cleanSvg(markup: string): { svg: string; oneColor: boolean } | null {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.namespaceURI !== SVG_NS || root.localName !== 'svg') return null;
  if (doc.getElementsByTagName('parsererror').length) return null;
  for (const name of UNSAFE) for (const el of [...root.getElementsByTagName(name)]) el.remove();

  const all = [root, ...root.querySelectorAll('*')];
  let oneColor = true;
  for (const el of all) {
    if (MULTICOLOR.includes(el.localName)) oneColor = false;
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      else if (/(^|:)href$/.test(n) && /^\s*javascript:/i.test(attr.value))
        el.removeAttribute(attr.name);
      else if (n === 'style' && /(fill|stroke|color)\s*:/i.test(attr.value)) oneColor = false;
      else if (
        PAINTS.includes(n) &&
        !NO_PAINT.test(attr.value.trim()) &&
        !INK.test(attr.value.trim())
      )
        oneColor = false;
    }
  }

  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    viewBox?.length === 4 &&
    viewBox.every(Number.isFinite) &&
    viewBox[2]! > 0 &&
    viewBox[3]! > 0
  ) {
    if (!root.hasAttribute('width')) root.setAttribute('width', String(viewBox[2]));
    if (!root.hasAttribute('height')) root.setAttribute('height', String(viewBox[3]));
  }

  if (oneColor) {
    for (const el of all)
      for (const n of PAINTS)
        if (INK.test(el.getAttribute(n)?.trim() ?? '')) el.setAttribute(n, 'currentColor');
    // Shapes with no fill of their own are black; make them follow the color too.
    if (!root.hasAttribute('fill')) root.setAttribute('fill', 'currentColor');
    root.setAttribute('color', '#fff');
  }
  return { svg: new XMLSerializer().serializeToString(root), oneColor };
}

/** A picture's size in pixels, or 100 by 100 when the browser can't tell. */
async function sizeOf(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = new Image();
  img.src = dataUrl;
  try {
    await img.decode();
  } catch {
    return { width: 100, height: 100 };
  }
  const { naturalWidth: width, naturalHeight: height } = img;
  return width > 0 && height > 0 ? { width, height } : { width: 100, height: 100 };
}

/** A picture from SVG code, or null when the text isn't an SVG. */
export async function pictureFromSvg(markup: string, name?: string): Promise<Picture | null> {
  const clean = cleanSvg(markup);
  if (!clean) return null;
  const dataUrl = svgDataUrl(clean.svg);
  return { dataUrl, ...(await sizeOf(dataUrl)), recolor: clean.oneColor, name };
}

/** The name a file gives an object: its name without the extension. */
const baseName = (file: File) => file.name.replace(/\.[^.]*$/, '').trim() || undefined;

/**
 * A picture from an image file. Throws an Error with a message for the user when the file
 * is too big or isn't a picture.
 */
export async function pictureFromFile(file: File): Promise<Picture> {
  if (file.size > MAX_PICTURE_BYTES)
    throw new Error('Pick an image under 1.5 MB, so the project still fits in your browser.');
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (svg) {
    const pic = await pictureFromSvg(await file.text(), baseName(file));
    if (!pic) throw new Error('That SVG couldn’t be read.');
    return pic;
  }
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t a picture.');
  const dataUrl = await readDataUrl(file);
  return { dataUrl, ...(await sizeOf(dataUrl)), name: baseName(file) };
}

/** Whether a paste or a drop holds a picture: an image file, or SVG code as text. */
export function hasPictures(data: DataTransfer): boolean {
  if ([...data.items].some((i) => i.kind === 'file' && /^image\//.test(i.type))) return true;
  if ([...data.files].some((f) => f.type.startsWith('image/') || /\.svg$/i.test(f.name)))
    return true;
  return looksLikeSvg(data.getData('text/plain'));
}

/**
 * The pictures in a paste or a drop. Reads the data before its first await, while the
 * browser still allows it.
 */
export async function picturesIn(data: DataTransfer): Promise<Picture[]> {
  const files = [...data.files].filter(
    (f) => f.type.startsWith('image/') || /\.svg$/i.test(f.name),
  );
  if (files.length) return Promise.all(files.map(pictureFromFile));
  const text = data.getData('text/plain');
  if (!looksLikeSvg(text)) return [];
  const pic = await pictureFromSvg(text, 'Icon');
  if (!pic) throw new Error('That SVG code couldn’t be read.');
  return [pic];
}
