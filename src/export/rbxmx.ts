/**
 * Roblox model file export (.rbxmx): the ScreenGuis as the XML that Studio reads with
 * Insert from File. It writes the same objects as the Luau export, with the base (Desktop)
 * values, and skips everything web only.
 *
 * Every property is written, defaults included, so nothing depends on what Studio picks for
 * a missing one. Fonts are written as FontFace, as Studio saves them. The other names are the
 * ones the Luau export sets; Roblox's API dump marks IgnoreGuiInset, CornerRadius and Image as
 * loadable, though Studio now saves them as ScreenInsets, four corner radii and ImageContent.
 */
import { classDef, propNames, propSpec, type ClassName } from '../model/classes.ts';
import type { FontName } from '../model/fonts.ts';
import {
  childrenOf,
  requireInstance,
  serviceOf,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../model/document.ts';
import type {
  Color3,
  ColorSequence,
  NumberSequence,
  PropValue,
  UDim,
  UDim2,
  Vector2,
} from '../model/values.ts';
import { fmtNum } from './format.ts';

/**
 * The FontFace Studio gives each Enum.Font: its family file, weight and style. This is what
 * Studio saves for a font today (the Font enum is only read), and what `Font.fromEnum` gives.
 */
const FONT_FACES: Record<FontName, readonly [family: string, weight: number, italic?: true]> = {
  SourceSans: ['SourceSansPro', 400],
  SourceSansLight: ['SourceSansPro', 300],
  SourceSansSemibold: ['SourceSansPro', 600],
  SourceSansBold: ['SourceSansPro', 700],
  SourceSansItalic: ['SourceSansPro', 400, true],
  Gotham: ['GothamSSm', 400],
  GothamMedium: ['GothamSSm', 500],
  GothamBold: ['GothamSSm', 700],
  GothamBlack: ['GothamSSm', 900],
  BuilderSans: ['BuilderSans', 400],
  BuilderSansMedium: ['BuilderSans', 500],
  BuilderSansBold: ['BuilderSans', 700],
  BuilderSansExtraBold: ['BuilderSans', 800],
  Arial: ['Arial', 400],
  ArialBold: ['Arial', 700],
  FredokaOne: ['FredokaOne', 400],
  LuckiestGuy: ['LuckiestGuy', 400],
  Bangers: ['Bangers', 400],
  Arcade: ['PressStart2P', 400],
  Oswald: ['Oswald', 400],
  Nunito: ['Nunito', 400],
  PermanentMarker: ['PermanentMarker', 400],
  Roboto: ['Roboto', 400],
  RobotoMono: ['RobotoMono', 400],
  Code: ['Inconsolata', 400],
  Ubuntu: ['Ubuntu', 400],
  Merriweather: ['Merriweather', 400],
};

/** A font as Studio saves it: `<Font name="FontFace">` with its family, weight and style. */
export function fontFace(font: FontName): string {
  const [family, weight, italic] = FONT_FACES[font];
  return (
    `<Font name="FontFace"><Family><url>rbxasset://fonts/families/${family}.json</url></Family>` +
    `<Weight>${weight}</Weight><Style>${italic ? 'Italic' : 'Normal'}</Style></Font>`
  );
}

const AUTOMATIC_SIZE = { None: 0, X: 1, Y: 2, XY: 3 };

/**
 * The number Studio stores for each enum property's options, from Roblox's API dump. A model
 * file stores enums as numbers (`<token>`), not names.
 */
export const ENUM_TOKENS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  AutomaticSize: AUTOMATIC_SIZE,
  AutomaticCanvasSize: AUTOMATIC_SIZE,
  TextXAlignment: { Left: 0, Right: 1, Center: 2 },
  TextYAlignment: { Top: 0, Center: 1, Bottom: 2 },
  ScaleType: { Stretch: 0, Slice: 1, Tile: 2, Fit: 3, Crop: 4 },
  ApplyStrokeMode: { Contextual: 0, Border: 1 },
  FillDirection: { Horizontal: 0, Vertical: 1 },
  HorizontalAlignment: { Center: 0, Left: 1, Right: 2 },
  VerticalAlignment: { Center: 0, Top: 1, Bottom: 2 },
  SortOrder: { Name: 0, Custom: 1, LayoutOrder: 2 },
};
/** Properties whose Roblox type differs from the editor's: TextSize is a float in Roblox. */
const FLOAT_PROPS = new Set(['TextSize']);

/** Escapes text for XML, dropping the control characters XML can't hold. */
export function xmlText(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r/g, '&#13;')
  );
}

const num = (v: number) => fmtNum(v);
const int = (v: number) => String(Math.round(v));
/** A color channel from 0 to 255 as Roblox's 0 to 1. */
const channel = (c: number) => fmtNum(c / 255, 6);

const tags = (pairs: [string, string][]) => pairs.map(([t, v]) => `<${t}>${v}</${t}>`).join('');
const udim = (u: UDim) =>
  tags([
    ['S', num(u[0])],
    ['O', int(u[1])],
  ]);
const udim2 = (u: UDim2) =>
  tags([
    ['XS', num(u[0])],
    ['XO', int(u[1])],
    ['YS', num(u[2])],
    ['YO', int(u[3])],
  ]);
const vector2 = (v: Vector2) =>
  tags([
    ['X', num(v[0])],
    ['Y', num(v[1])],
  ]);
const color3 = (c: Color3) =>
  tags([
    ['R', channel(c[0])],
    ['G', channel(c[1])],
    ['B', channel(c[2])],
  ]);
/** Each keypoint is `time r g b 0`, the last number being an unused envelope. */
const colorSequence = (seq: ColorSequence) =>
  seq.map((k) => `${num(k.time)} ${k.value.map(channel).join(' ')} 0 `).join('');
/** Each keypoint is `time value envelope`. */
const numberSequence = (seq: NumberSequence) =>
  seq.map((k) => `${num(k.time)} ${num(k.value)} 0 `).join('');

/** One property as its XML element. */
function property(className: ClassName, name: string, value: PropValue): string {
  const spec = propSpec(className, name)!;
  const el = (type: string, body: string) => `<${type} name="${name}">${body}</${type}>`;
  switch (spec.type) {
    case 'string':
      return el('string', xmlText(value as string));
    case 'bool':
      return el('bool', String(value));
    case 'int':
      return FLOAT_PROPS.has(name)
        ? el('float', num(value as number))
        : el('int', int(value as number));
    case 'number':
    case 'alpha':
      return el('float', num(value as number));
    case 'color':
      return el('Color3', color3(value as Color3));
    case 'vec2':
      return el('Vector2', vector2(value as Vector2));
    case 'udim':
      return el('UDim', udim(value as UDim));
    case 'udim2':
      return el('UDim2', udim2(value as UDim2));
    case 'enum': {
      if (name === 'Font') return fontFace(value as FontName);
      const token = ENUM_TOKENS[name]?.[value as string];
      if (token === undefined) throw new Error(`No Roblox value for ${name} ${String(value)}`);
      return el('token', String(token));
    }
    case 'image':
      return el('Content', value ? `<url>${xmlText(value as string)}</url>` : '<null></null>');
    case 'colorseq':
      return el('ColorSequence', colorSequence(value as ColorSequence));
    case 'numseq':
      return el('NumberSequence', numberSequence(value as NumberSequence));
    case 'asset':
    case 'link':
      // Web only; skipped before it gets here.
      return '';
  }
}

/** The property elements for one instance: Name first, then the class's own, in order. */
function properties(inst: AnyInstance): string[] {
  const props = inst.props as Readonly<Record<string, PropValue>>;
  const out: string[] = [];
  for (const name of propNames(inst.className)) {
    if (propSpec(inst.className, name)!.web) continue;
    out.push(property(inst.className, name, props[name]!));
  }
  // Studio's full screen, as in the editor, with children drawn above their parent.
  if (inst.className === 'ScreenGui')
    out.push('<bool name="IgnoreGuiInset">true</bool>', '<token name="ZIndexBehavior">1</token>');
  return out;
}

/** Studio writes referents as RBX and 32 hex digits; a counter keeps the file stable. */
const referent = (n: number) => 'RBX' + n.toString(16).toUpperCase().padStart(32, '0');

/** The ScreenGuis a full export holds. */
export const screensOf = (doc: Doc): AnyInstance[] =>
  childrenOf(doc, serviceOf(doc, 'StarterGui').id).filter((i) => i.className === 'ScreenGui');

/**
 * A Roblox model file holding the given ScreenGuis (every one by default) and everything in
 * them. In Studio, right-click StarterGui, choose Insert from File and pick the file.
 */
export function exportRbxmx(doc: Doc, rootIds?: readonly InstanceId[]): string {
  const roots = rootIds ?? screensOf(doc).map((s) => s.id);
  const lines = [
    '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
    '\t<External>null</External>',
    '\t<External>nil</External>',
  ];
  let n = 0;
  const item = (id: InstanceId, depth: number) => {
    const inst = requireInstance(doc, id);
    if (classDef(inst.className).web) return;
    const pad = '\t'.repeat(depth);
    lines.push(`${pad}<Item class="${inst.className}" referent="${referent(++n)}">`);
    lines.push(`${pad}\t<Properties>`);
    for (const p of properties(inst)) lines.push(`${pad}\t\t${p}`);
    lines.push(`${pad}\t</Properties>`);
    for (const c of inst.children) item(c, depth + 1);
    lines.push(`${pad}</Item>`);
  };
  for (const id of roots) item(id, 1);
  lines.push('</roblox>');
  return lines.join('\n') + '\n';
}
