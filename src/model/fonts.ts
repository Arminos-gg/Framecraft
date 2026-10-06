/**
 * The fonts text can use: Roblox's own (under their Enum.Font names) and modern web fonts.
 * The editor and the websites draw each with a Google Fonts family. The Roblox exports use the
 * font's Roblox family, or the closest Roblox font when Roblox doesn't have it.
 *
 * Weight and style are their own properties (FontWeight and FontStyle, the parts of Roblox's
 * FontFace), so a Font is a family. Roblox's older names that carry a weight, such as
 * GothamBold, are read as Gotham with FontWeight Bold (see `upgradeFont`).
 */

/** Roblox's Enum.FontWeight, with each weight's number. */
export const FONT_WEIGHTS = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Heavy: 900,
} as const;
export type FontWeight = keyof typeof FONT_WEIGHTS;
export const FONT_WEIGHT_NAMES = Object.keys(FONT_WEIGHTS) as FontWeight[];

/** Roblox's Enum.FontStyle. */
export const FONT_STYLES = ['Normal', 'Italic'] as const;
export type FontStyle = (typeof FONT_STYLES)[number];

export type FontKind = 'sans' | 'serif' | 'mono' | 'display';

export interface FontFamily {
  /** What the font menu shows. */
  readonly label: string;
  /** The Google Fonts family the editor and websites draw it with. */
  readonly web: string;
  /** The weights `web` has on Google Fonts, lightest first. */
  readonly weights: readonly number[];
  /** Whether `web` has italics, at every weight it has. */
  readonly italic: boolean;
  readonly kind: FontKind;
  /** Roblox's font family file (rbxasset://fonts/families/<roblox>.json). */
  readonly roblox: string;
  /** A web font Roblox doesn't have: `roblox` is the closest Roblox font, standing in. */
  readonly webOnly?: true;
  /** The web weight that draws Regular, when the look-alike is heavier than its name. */
  readonly regular?: number;
}

const range = (from: number, to: number) =>
  Array.from({ length: (to - from) / 100 + 1 }, (_, i) => from + i * 100);
const ALL = range(100, 900);

/** Roblox's fonts, under their Enum.Font names, drawn with Google look-alikes. */
// prettier-ignore
const ROBLOX_FONTS = {
  SourceSans: { label: 'SourceSans', web: 'Source Sans 3', weights: range(200, 900), italic: true, kind: 'sans', roblox: 'SourceSansPro' },
  Gotham: { label: 'Gotham', web: 'Montserrat', weights: ALL, italic: true, kind: 'sans', roblox: 'GothamSSm' },
  BuilderSans: { label: 'BuilderSans', web: 'Figtree', weights: range(300, 900), italic: true, kind: 'sans', roblox: 'BuilderSans' },
  Arial: { label: 'Arial', web: 'Arimo', weights: range(400, 700), italic: true, kind: 'sans', roblox: 'Arial' },
  Roboto: { label: 'Roboto', web: 'Roboto', weights: ALL, italic: true, kind: 'sans', roblox: 'Roboto' },
  Nunito: { label: 'Nunito', web: 'Nunito', weights: range(200, 900), italic: true, kind: 'sans', roblox: 'Nunito' },
  Ubuntu: { label: 'Ubuntu', web: 'Ubuntu', weights: [300, 400, 500, 700], italic: true, kind: 'sans', roblox: 'Ubuntu' },
  Oswald: { label: 'Oswald', web: 'Oswald', weights: range(200, 700), italic: false, kind: 'sans', roblox: 'Oswald' },
  Merriweather: { label: 'Merriweather', web: 'Merriweather', weights: [300, 400, 700, 900], italic: true, kind: 'serif', roblox: 'Merriweather' },
  RobotoMono: { label: 'RobotoMono', web: 'Roboto Mono', weights: range(100, 700), italic: true, kind: 'mono', roblox: 'RobotoMono' },
  Code: { label: 'Code', web: 'Roboto Mono', weights: range(100, 700), italic: true, kind: 'mono', roblox: 'Inconsolata' },
  FredokaOne: { label: 'FredokaOne', web: 'Fredoka', weights: range(300, 700), italic: false, kind: 'display', roblox: 'FredokaOne', regular: 600 },
  LuckiestGuy: { label: 'LuckiestGuy', web: 'Luckiest Guy', weights: [400], italic: false, kind: 'display', roblox: 'LuckiestGuy' },
  Bangers: { label: 'Bangers', web: 'Bangers', weights: [400], italic: false, kind: 'display', roblox: 'Bangers' },
  Arcade: { label: 'Arcade', web: 'Press Start 2P', weights: [400], italic: false, kind: 'mono', roblox: 'PressStart2P' },
  PermanentMarker: { label: 'PermanentMarker', web: 'Permanent Marker', weights: [400], italic: false, kind: 'display', roblox: 'PermanentMarker' },
} as const satisfies Record<string, FontFamily>;

/**
 * Modern web fonts. Montserrat, Josefin Sans and Titillium Web are Roblox fonts too; for the
 * rest the Roblox exports use the closest Roblox font.
 */
// prettier-ignore
const WEB_FONTS = {
  Inter: { label: 'Inter', web: 'Inter', weights: ALL, italic: true, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  Poppins: { label: 'Poppins', web: 'Poppins', weights: ALL, italic: true, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  Montserrat: { label: 'Montserrat', web: 'Montserrat', weights: ALL, italic: true, kind: 'sans', roblox: 'Montserrat' },
  DMSans: { label: 'DM Sans', web: 'DM Sans', weights: ALL, italic: true, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  PlusJakartaSans: { label: 'Plus Jakarta Sans', web: 'Plus Jakarta Sans', weights: range(200, 800), italic: true, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  Manrope: { label: 'Manrope', web: 'Manrope', weights: range(200, 800), italic: false, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  Geist: { label: 'Geist', web: 'Geist', weights: ALL, italic: false, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  SpaceGrotesk: { label: 'Space Grotesk', web: 'Space Grotesk', weights: range(300, 700), italic: false, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  Outfit: { label: 'Outfit', web: 'Outfit', weights: ALL, italic: false, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  Sora: { label: 'Sora', web: 'Sora', weights: range(100, 800), italic: false, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  Urbanist: { label: 'Urbanist', web: 'Urbanist', weights: ALL, italic: true, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  Lexend: { label: 'Lexend', web: 'Lexend', weights: ALL, italic: false, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  WorkSans: { label: 'Work Sans', web: 'Work Sans', weights: ALL, italic: true, kind: 'sans', roblox: 'BuilderSans', webOnly: true },
  Rubik: { label: 'Rubik', web: 'Rubik', weights: range(300, 900), italic: true, kind: 'sans', roblox: 'Nunito', webOnly: true },
  OpenSans: { label: 'Open Sans', web: 'Open Sans', weights: range(300, 800), italic: true, kind: 'sans', roblox: 'SourceSansPro', webOnly: true },
  Lato: { label: 'Lato', web: 'Lato', weights: [100, 300, 400, 700, 900], italic: true, kind: 'sans', roblox: 'SourceSansPro', webOnly: true },
  Raleway: { label: 'Raleway', web: 'Raleway', weights: ALL, italic: true, kind: 'sans', roblox: 'Montserrat', webOnly: true },
  JosefinSans: { label: 'Josefin Sans', web: 'Josefin Sans', weights: range(100, 700), italic: true, kind: 'sans', roblox: 'JosefinSans' },
  BricolageGrotesque: { label: 'Bricolage Grotesque', web: 'Bricolage Grotesque', weights: range(200, 800), italic: false, kind: 'display', roblox: 'BuilderSans', webOnly: true },
  PlayfairDisplay: { label: 'Playfair Display', web: 'Playfair Display', weights: range(400, 900), italic: true, kind: 'serif', roblox: 'Merriweather', webOnly: true },
  Lora: { label: 'Lora', web: 'Lora', weights: range(400, 700), italic: true, kind: 'serif', roblox: 'Merriweather', webOnly: true },
  Fraunces: { label: 'Fraunces', web: 'Fraunces', weights: ALL, italic: true, kind: 'serif', roblox: 'Merriweather', webOnly: true },
  DMSerifDisplay: { label: 'DM Serif Display', web: 'DM Serif Display', weights: [400], italic: true, kind: 'serif', roblox: 'Merriweather', webOnly: true },
  InstrumentSerif: { label: 'Instrument Serif', web: 'Instrument Serif', weights: [400], italic: true, kind: 'serif', roblox: 'Merriweather', webOnly: true },
  JetBrainsMono: { label: 'JetBrains Mono', web: 'JetBrains Mono', weights: range(100, 800), italic: true, kind: 'mono', roblox: 'RobotoMono', webOnly: true },
  GeistMono: { label: 'Geist Mono', web: 'Geist Mono', weights: ALL, italic: false, kind: 'mono', roblox: 'RobotoMono', webOnly: true },
  SpaceMono: { label: 'Space Mono', web: 'Space Mono', weights: [400, 700], italic: true, kind: 'mono', roblox: 'RobotoMono', webOnly: true },
} as const satisfies Record<string, FontFamily>;

export const FONTS: Readonly<Record<FontName, FontFamily>> = { ...ROBLOX_FONTS, ...WEB_FONTS };
export type FontName = keyof typeof ROBLOX_FONTS | keyof typeof WEB_FONTS;
export const FONT_NAMES = Object.keys(FONTS) as FontName[];
/** The font menu's groups, in order. */
export const FONT_GROUPS: readonly {
  readonly name: string;
  readonly fonts: readonly FontName[];
}[] = [
  { name: 'Web fonts', fonts: Object.keys(WEB_FONTS) as FontName[] },
  { name: 'Roblox fonts', fonts: Object.keys(ROBLOX_FONTS) as FontName[] },
];

export const isFontName = (s: unknown): s is FontName =>
  typeof s === 'string' && Object.hasOwn(FONTS, s);

/** The parts of a text object's font. */
export interface TextFace {
  readonly font: FontName;
  readonly weight: FontWeight;
  readonly style: FontStyle;
}
export const faceOf = (p: {
  readonly Font: FontName;
  readonly FontWeight: FontWeight;
  readonly FontStyle: FontStyle;
}): TextFace => ({ font: p.Font, weight: p.FontWeight, style: p.FontStyle });

/**
 * Roblox's Enum.Font names, and the family, weight and style each one is. A family with the
 * same name is that family at Regular.
 */
export const LEGACY_FONTS: Readonly<
  Record<string, readonly [font: FontName, weight: FontWeight, style?: FontStyle]>
> = {
  SourceSansLight: ['SourceSans', 'Light'],
  SourceSansSemibold: ['SourceSans', 'SemiBold'],
  SourceSansBold: ['SourceSans', 'Bold'],
  SourceSansItalic: ['SourceSans', 'Regular', 'Italic'],
  GothamMedium: ['Gotham', 'Medium'],
  GothamBold: ['Gotham', 'Bold'],
  GothamBlack: ['Gotham', 'Heavy'],
  BuilderSansMedium: ['BuilderSans', 'Medium'],
  BuilderSansBold: ['BuilderSans', 'Bold'],
  BuilderSansExtraBold: ['BuilderSans', 'ExtraBold'],
  ArialBold: ['Arial', 'Bold'],
};

/**
 * Turns an older Font name that carries a weight (GothamBold) into its family, FontWeight and
 * FontStyle, unless those are given too. Other properties pass through.
 */
export function upgradeFont<T extends Readonly<Record<string, unknown>>>(props: T): T {
  const legacy = typeof props.Font === 'string' ? LEGACY_FONTS[props.Font] : undefined;
  if (!legacy) return props;
  const [font, weight, style = 'Normal'] = legacy;
  return {
    ...props,
    Font: font,
    FontWeight: props.FontWeight ?? weight,
    FontStyle: props.FontStyle ?? style,
  };
}

/** The Roblox Enum.Font that is exactly this face, if there is one. */
export function legacyFontOf({ font, weight, style }: TextFace): string | undefined {
  if (Object.hasOwn(WEB_FONTS, font)) return undefined;
  if (weight === 'Regular' && style === 'Normal') return font;
  for (const [name, [f, w, s = 'Normal']] of Object.entries(LEGACY_FONTS))
    if (f === font && w === weight && s === style) return name;
  return undefined;
}

/** The weight a web font draws at: the one it has nearest to the asked one. */
export function webWeight(font: FontName, weight: FontWeight): number {
  const f = FONTS[font];
  const want = weight === 'Regular' && f.regular ? f.regular : FONT_WEIGHTS[weight];
  let best = f.weights[0]!;
  for (const w of f.weights) if (Math.abs(w - want) < Math.abs(best - want)) best = w;
  return best;
}

const FALLBACK: Record<FontKind, string> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
  display: 'system-ui, sans-serif',
};

/** The CSS font for a face: its Google Fonts family with a fallback, weight and style. */
export function fontCss({ font, weight, style }: TextFace) {
  const f = FONTS[font];
  return {
    family: `"${f.web}", ${FALLBACK[f.kind]}`,
    weight: webWeight(font, weight),
    style: style === 'Italic' && f.italic ? 'italic' : 'normal',
  };
}

/** A key for a face, for sets of the faces a page uses. */
export const faceKey = (f: TextFace) => `${f.font}|${f.weight}|${f.style}`;
export function parseFaceKey(key: string): TextFace {
  const [font, weight, style] = key.split('|') as [FontName, FontWeight, FontStyle];
  return { font, weight, style };
}

/** One Google Fonts stylesheet link for these faces, or null for none. */
export function googleFontsHref(faces: readonly TextFace[]): string | null {
  const families = new Map<string, { specs: Set<string>; single: boolean }>();
  for (const face of faces) {
    const f = FONTS[face.font];
    const css = fontCss(face);
    const entry = families.get(f.web) ?? {
      specs: new Set<string>(),
      single: f.weights.length === 1 && !f.italic,
    };
    entry.specs.add(`${css.style === 'italic' ? 1 : 0},${css.weight}`);
    families.set(f.web, entry);
  }
  const parts = [...families].map(([family, { specs, single }]) => {
    const name = family.replace(/ /g, '+');
    if (single) return 'family=' + name;
    const sorted = [...specs].sort();
    if (sorted.some((s) => s.startsWith('1,')))
      return `family=${name}:ital,wght@${sorted.join(';')}`;
    const weights = sorted.map((s) => s.slice(2)).sort((a, b) => +a - +b);
    return `family=${name}:wght@${weights.join(';')}`;
  });
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : null;
}

/** A Roblox FontFace for a face: the family file, weight and style. */
export function robloxFace({ font, weight, style }: TextFace) {
  return {
    family: `rbxasset://fonts/families/${FONTS[font].roblox}.json`,
    weight,
    style,
  };
}
