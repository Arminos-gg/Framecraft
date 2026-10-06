/**
 * The looks a component can be added in: Light or Dark colors, Rounded or Sharp corners, and
 * the website or Roblox style (fonts and colors). Components take every color, font and
 * corner from a Theme, so one build function makes every look.
 */
import type { Builder } from '../builder.ts';
import type { InstanceId } from '../document.ts';
import type { FontName, FontWeight } from '../fonts.ts';
import type { Color3, UDim } from '../values.ts';

export type Look = 'light' | 'dark';
export type Corners = 'rounded' | 'sharp';
/** Where a component is made for: a website page or a Roblox screen. */
export type Target = 'site' | 'roblox';

export interface ComponentOptions {
  readonly look: Look;
  readonly corners: Corners;
  /** The style a component made for both draws in. */
  readonly target: Target;
}

export interface Palette {
  /** Behind everything: the page, or nothing on a Roblox screen. */
  readonly bg: Color3;
  /** Cards and panels. */
  readonly surface: Color3;
  /** Rows, slots and tiles inside a panel. */
  readonly raised: Color3;
  /** Tracks, inputs and pills that sit into a surface. */
  readonly sunken: Color3;
  readonly ink: Color3;
  readonly body: Color3;
  readonly muted: Color3;
  readonly line: Color3;
  readonly accent: Color3;
  readonly accentSoft: Color3;
  readonly onAccent: Color3;
  readonly good: Color3;
  readonly bad: Color3;
  readonly gold: Color3;
  readonly purple: Color3;
  readonly blue: Color3;
}

const PALETTES: Record<Target, Record<Look, Palette>> = {
  site: {
    light: {
      bg: [255, 255, 255],
      surface: [249, 250, 251],
      raised: [243, 244, 246],
      sunken: [229, 231, 235],
      ink: [17, 24, 39],
      body: [75, 85, 99],
      muted: [107, 114, 128],
      line: [229, 231, 235],
      accent: [79, 70, 229],
      accentSoft: [238, 242, 255],
      onAccent: [255, 255, 255],
      good: [22, 163, 74],
      bad: [220, 38, 38],
      gold: [234, 179, 8],
      purple: [147, 51, 234],
      blue: [37, 99, 235],
    },
    dark: {
      bg: [15, 17, 23],
      surface: [26, 29, 38],
      raised: [35, 39, 50],
      sunken: [48, 53, 66],
      ink: [243, 244, 246],
      body: [180, 186, 198],
      muted: [138, 145, 160],
      line: [46, 51, 64],
      accent: [129, 140, 248],
      accentSoft: [37, 40, 74],
      onAccent: [15, 17, 23],
      good: [74, 222, 128],
      bad: [248, 113, 113],
      gold: [250, 204, 21],
      purple: [192, 132, 252],
      blue: [96, 165, 250],
    },
  },
  roblox: {
    light: {
      bg: [232, 237, 246],
      surface: [255, 255, 255],
      raised: [236, 240, 248],
      sunken: [214, 221, 235],
      ink: [29, 34, 51],
      body: [72, 80, 104],
      muted: [118, 127, 152],
      line: [205, 213, 229],
      accent: [47, 143, 255],
      accentSoft: [217, 233, 255],
      onAccent: [255, 255, 255],
      good: [52, 180, 92],
      bad: [232, 76, 84],
      gold: [255, 184, 0],
      purple: [139, 92, 246],
      blue: [47, 143, 255],
    },
    // The Roblox templates' colors (templates/game.ts).
    dark: {
      bg: [14, 15, 26],
      surface: [24, 26, 43],
      raised: [36, 39, 64],
      sunken: [14, 15, 26],
      ink: [240, 242, 250],
      body: [196, 202, 224],
      muted: [160, 168, 196],
      line: [56, 61, 94],
      accent: [80, 152, 255],
      accentSoft: [36, 52, 92],
      onAccent: [255, 255, 255],
      good: [64, 192, 96],
      bad: [232, 80, 88],
      gold: [255, 200, 61],
      purple: [170, 110, 255],
      blue: [80, 152, 255],
    },
  },
};

/** A typeface: a font family with its weight, spread into a text object's properties. */
export interface Face {
  readonly Font: FontName;
  readonly FontWeight: FontWeight;
}

export interface Fonts {
  readonly regular: Face;
  readonly medium: Face;
  readonly bold: Face;
  readonly heavy: Face;
  /** Titles on game panels. */
  readonly display: Face;
}

const FONT_SETS: Record<Target, Fonts> = {
  site: {
    regular: { Font: 'BuilderSans', FontWeight: 'Regular' },
    medium: { Font: 'BuilderSans', FontWeight: 'Medium' },
    bold: { Font: 'BuilderSans', FontWeight: 'Bold' },
    heavy: { Font: 'BuilderSans', FontWeight: 'ExtraBold' },
    display: { Font: 'BuilderSans', FontWeight: 'ExtraBold' },
  },
  roblox: {
    regular: { Font: 'Gotham', FontWeight: 'Medium' },
    medium: { Font: 'Gotham', FontWeight: 'Medium' },
    bold: { Font: 'Gotham', FontWeight: 'Bold' },
    heavy: { Font: 'Gotham', FontWeight: 'Heavy' },
    display: { Font: 'FredokaOne', FontWeight: 'Regular' },
  },
};

/** Everything a component's build function reads its look from. */
export interface Theme extends ComponentOptions {
  readonly c: Palette;
  readonly font: Fonts;
  /** A corner radius in pixels, or nearly square when the corners are Sharp. */
  radius(px: number): UDim;
  /** Rounds an object's corners by `px` pixels (Sharp keeps them nearly square). */
  round(b: Builder, id: InstanceId, px: number): InstanceId;
  /** Makes a pill of an object, or a nearly square box when the corners are Sharp. */
  pill(b: Builder, id: InstanceId): InstanceId;
  /** Makes a circle of an object; circles stay round in every look. */
  circle(b: Builder, id: InstanceId): InstanceId;
}

/** The corner Sharp leaves, so edges still look finished. */
const SHARP: UDim = [0, 2];

export function themeFor(options: ComponentOptions): Theme {
  const sharp = options.corners === 'sharp';
  const radius = (px: number): UDim => (sharp ? [0, Math.min(px, SHARP[1])] : [0, px]);
  const corner = (b: Builder, id: InstanceId, r: UDim) =>
    b.add(id, 'UICorner', { CornerRadius: r });
  return {
    ...options,
    c: PALETTES[options.target][options.look],
    font: FONT_SETS[options.target],
    radius,
    round: (b, id, px) => corner(b, id, radius(px)),
    pill: (b, id) => corner(b, id, sharp ? SHARP : [0.5, 0]),
    circle: (b, id) => corner(b, id, [0.5, 0]),
  };
}
