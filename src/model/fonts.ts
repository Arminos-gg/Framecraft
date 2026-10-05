/**
 * Roblox Enum.Font names and the Google Fonts look-alikes the editor draws them with.
 * Exports keep the real Enum.Font names.
 */

interface WebFont {
  /** Google Fonts family. */
  family: string;
  weight: number;
  italic?: boolean;
}

export const FONTS = {
  SourceSans: { family: 'Source Sans 3', weight: 400 },
  SourceSansLight: { family: 'Source Sans 3', weight: 300 },
  SourceSansSemibold: { family: 'Source Sans 3', weight: 600 },
  SourceSansBold: { family: 'Source Sans 3', weight: 700 },
  SourceSansItalic: { family: 'Source Sans 3', weight: 400, italic: true },
  Gotham: { family: 'Montserrat', weight: 400 },
  GothamMedium: { family: 'Montserrat', weight: 500 },
  GothamBold: { family: 'Montserrat', weight: 700 },
  GothamBlack: { family: 'Montserrat', weight: 900 },
  BuilderSans: { family: 'Figtree', weight: 400 },
  BuilderSansMedium: { family: 'Figtree', weight: 500 },
  BuilderSansBold: { family: 'Figtree', weight: 700 },
  BuilderSansExtraBold: { family: 'Figtree', weight: 800 },
  Arial: { family: 'Arimo', weight: 400 },
  ArialBold: { family: 'Arimo', weight: 700 },
  FredokaOne: { family: 'Fredoka', weight: 600 },
  LuckiestGuy: { family: 'Luckiest Guy', weight: 400 },
  Bangers: { family: 'Bangers', weight: 400 },
  Arcade: { family: 'Press Start 2P', weight: 400 },
  Oswald: { family: 'Oswald', weight: 400 },
  Nunito: { family: 'Nunito', weight: 400 },
  PermanentMarker: { family: 'Permanent Marker', weight: 400 },
  Roboto: { family: 'Roboto', weight: 400 },
  RobotoMono: { family: 'Roboto Mono', weight: 400 },
  Code: { family: 'Roboto Mono', weight: 400 },
  Ubuntu: { family: 'Ubuntu', weight: 400 },
  Merriweather: { family: 'Merriweather', weight: 400 },
} as const satisfies Record<string, WebFont>;

export type FontName = keyof typeof FONTS;
export const FONT_NAMES = Object.keys(FONTS) as FontName[];
