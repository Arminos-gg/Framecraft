import { describe, expect, it } from 'vitest';
import { createInstance } from '../../../src/model/document.ts';
import {
  FONT_NAMES,
  FONTS,
  fontCss,
  LEGACY_FONTS,
  legacyFontOf,
  upgradeFont,
  webWeight,
  type FontName,
} from '../../../src/model/fonts.ts';
import { loadProject, serializeProject } from '../../../src/model/project.ts';
import { byName, sample } from './helpers.ts';

describe('fonts', () => {
  it('reads Roblox’s older font names as a family and a weight', () => {
    expect(upgradeFont({ Font: 'GothamBold', Text: 'Hi' })).toEqual({
      Font: 'Gotham',
      FontWeight: 'Bold',
      FontStyle: 'Normal',
      Text: 'Hi',
    });
    expect(upgradeFont({ Font: 'SourceSansItalic' })).toMatchObject({
      Font: 'SourceSans',
      FontWeight: 'Regular',
      FontStyle: 'Italic',
    });
    // A weight given alongside wins, and family names pass through.
    expect(upgradeFont({ Font: 'GothamBold', FontWeight: 'Light' }).FontWeight).toBe('Light');
    expect(upgradeFont({ Font: 'Inter' })).toEqual({ Font: 'Inter' });
    expect(
      createInstance('TextLabel', { Font: 'BuilderSansExtraBold' as FontName }).props,
    ).toMatchObject({ Font: 'BuilderSans', FontWeight: 'ExtraBold' });
  });

  it('opens project files that use the older names', () => {
    const file = JSON.parse(serializeProject(sample()));
    const title = byName(loadProject(file).doc, 'Amount');
    file.doc.instances[title.id].props.Font = 'GothamBlack';
    delete file.doc.instances[title.id].props.FontWeight;
    expect(byName(loadProject(file).doc, 'Amount').props).toMatchObject({
      Font: 'Gotham',
      FontWeight: 'Heavy',
    });
  });

  it('turns every older name back into itself for Roblox', () => {
    for (const [name, [font, weight, style = 'Normal']] of Object.entries(LEGACY_FONTS))
      expect(legacyFontOf({ font, weight, style })).toBe(name);
    expect(legacyFontOf({ font: 'Gotham', weight: 'Regular', style: 'Normal' })).toBe('Gotham');
    expect(legacyFontOf({ font: 'Gotham', weight: 'Light', style: 'Normal' })).toBeUndefined();
    expect(legacyFontOf({ font: 'Inter', weight: 'Regular', style: 'Normal' })).toBeUndefined();
  });

  it('draws the weight the web font has nearest to the one asked for', () => {
    expect(webWeight('Inter', 'SemiBold')).toBe(600);
    expect(webWeight('Oswald', 'Heavy')).toBe(700);
    expect(webWeight('Bangers', 'Bold')).toBe(400);
    // Fredoka One's look-alike is heavier than its name.
    expect(webWeight('FredokaOne', 'Regular')).toBe(600);
    for (const font of FONT_NAMES)
      expect(FONTS[font].weights).toContain(webWeight(font, 'Regular'));
  });

  it('gives each font a fallback of its kind, and italics only where the font has them', () => {
    expect(fontCss({ font: 'Fraunces', weight: 'Bold', style: 'Italic' })).toEqual({
      family: '"Fraunces", Georgia, serif',
      weight: 700,
      style: 'italic',
    });
    expect(fontCss({ font: 'JetBrainsMono', weight: 'Regular', style: 'Normal' }).family).toBe(
      '"JetBrains Mono", ui-monospace, monospace',
    );
    expect(fontCss({ font: 'Manrope', weight: 'Regular', style: 'Italic' }).style).toBe('normal');
  });
});
