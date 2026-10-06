import { describe, expect, it } from 'vitest';
import {
  automaticSizeOf,
  canParent,
  classDef,
  CLASSES,
  defaultProps,
  isOverridable,
  normalizeProp,
  propNames,
  propSpec,
  type ClassName,
  type PropsOf,
} from '../../../src/model/classes.ts';

const classNames = Object.keys(CLASSES) as ClassName[];

describe('class registry', () => {
  it.each(classNames)('%s has valid defaults, named after the class', (className) => {
    const props: Record<string, unknown> = defaultProps(className);
    expect(props.Name).toBe(className);
    for (const [key, value] of Object.entries(props)) {
      expect(normalizeProp(className, key, value), key).toEqual(value);
    }
  });

  it('gives each call its own copy of the defaults', () => {
    const a = defaultProps('UIGradient');
    const b = defaultProps('UIGradient');
    expect(a.Color).toEqual(b.Color);
    expect(a.Color).not.toBe(b.Color);
  });

  it('uses the real UIGradient property names', () => {
    expect(propNames('UIGradient')).toEqual(['Name', 'Color', 'Transparency', 'Rotation']);
    expect(normalizeProp('UIGradient', 'Color', [{ time: 0, value: [1, 2, 3] }])).toBeUndefined();
    expect(normalizeProp('UIStroke', 'Color', [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('keeps the prototype property order, with AutomaticSize after Size', () => {
    expect(propNames('TextButton')).toEqual([
      'Name',
      'LayoutOrder',
      'AnchorPoint',
      'Position',
      'Size',
      'AutomaticSize',
      'Rotation',
      'BackgroundColor3',
      'BackgroundTransparency',
      'BorderColor3',
      'BorderSizePixel',
      'Visible',
      'ZIndex',
      'ClipsDescendants',
      'Text',
      'Font',
      'TextColor3',
      'TextSize',
      'LineHeight',
      'TextScaled',
      'TextWrapped',
      'TextXAlignment',
      'TextYAlignment',
      'TextTransparency',
      'AutoButtonColor',
      // Web-only properties come last.
      'Link',
      'HtmlTag',
    ]);
  });

  it('gives every object AutomaticSize except a ScrollingFrame, which grows its canvas', () => {
    for (const c of [
      'Frame',
      'TextLabel',
      'TextButton',
      'TextBox',
      'ImageLabel',
      'ImageButton',
    ] as const)
      expect(propSpec(c, 'AutomaticSize')).toMatchObject({ default: 'None', overridable: true });
    expect(propSpec('ScrollingFrame', 'AutomaticSize')).toBeUndefined();
    expect(automaticSizeOf(defaultProps('ScrollingFrame'))).toBe('None');
    expect(automaticSizeOf({ ...defaultProps('Frame'), AutomaticSize: 'XY' })).toBe('XY');
  });

  it('refuses properties a class does not have', () => {
    expect(normalizeProp('Frame', 'Text', 'Hi')).toBeUndefined();
    expect(normalizeProp('TextLabel', 'TextSize', 500)).toBe(100);
  });

  it('types properties per class', () => {
    const label: PropsOf<'TextLabel'> = defaultProps('TextLabel');
    const align: 'Left' | 'Center' | 'Right' = label.TextXAlignment;
    expect(align).toBe('Center');
    // @ts-expect-error a TextLabel has no Thickness
    expect(label.Thickness).toBeUndefined();
  });
});

describe('canParent', () => {
  const cases: [ClassName, ClassName, boolean][] = [
    ['ScreenGui', 'StarterGui', true],
    ['ScreenGui', 'Frame', false],
    ['Frame', 'ScreenGui', true],
    ['Frame', 'Frame', true],
    ['TextLabel', 'StarterGui', false],
    ['UICorner', 'Frame', true],
    ['UICorner', 'ScreenGui', false],
    ['UIListLayout', 'ScreenGui', true],
    ['UIListLayout', 'TextButton', true],
    ['Frame', 'UICorner', false],
    ['UIStroke', 'UIGradient', false],
    ['StarterGui', 'ScreenGui', false],
    ['StarterGui', 'DataModel', true],
    ['Site', 'DataModel', true],
    ['Breakpoint', 'DataModel', true],
    ['Breakpoint', 'Site', false],
    ['Page', 'Site', true],
    ['Page', 'StarterGui', false],
    ['ScreenGui', 'Site', false],
    ['Frame', 'Page', true],
    ['TextLabel', 'Site', false],
    ['UIListLayout', 'Page', true],
    ['UIPadding', 'Page', true],
    ['UIPadding', 'ScreenGui', false],
    ['UICorner', 'Page', false],
    ['DataModel', 'DataModel', false],
  ];
  it.each(cases)('%s inside %s: %s', (child, parent, ok) => {
    expect(canParent(child, parent)).toBe(ok);
  });
});

describe('website markers', () => {
  it('marks what may differ per breakpoint: layout, size, visibility, text size and colors', () => {
    for (const prop of ['Position', 'Size', 'AnchorPoint', 'Visible', 'BackgroundColor3'])
      expect(isOverridable('Frame', prop), prop).toBe(true);
    for (const prop of ['TextSize', 'TextColor3', 'TextXAlignment'])
      expect(isOverridable('TextLabel', prop), prop).toBe(true);
    expect(isOverridable('UIListLayout', 'FillDirection')).toBe(true);
    expect(isOverridable('UIPadding', 'PaddingLeft')).toBe(true);
    expect(isOverridable('Page', 'BackgroundColor3')).toBe(true);
  });

  it("keeps names, text, images, fonts and a page's details the same everywhere", () => {
    expect(isOverridable('Frame', 'Name')).toBe(false);
    expect(isOverridable('TextLabel', 'Text')).toBe(false);
    expect(isOverridable('TextLabel', 'Font')).toBe(false);
    expect(isOverridable('ImageLabel', 'Image')).toBe(false);
    expect(isOverridable('UIListLayout', 'SortOrder')).toBe(false);
    expect(isOverridable('Page', 'Path')).toBe(false);
    expect(isOverridable('Breakpoint', 'MaxWidth')).toBe(false);
    expect(isOverridable('Frame', 'Nope')).toBe(false);
  });

  it('marks the classes and properties Roblox does not have', () => {
    expect(classDef('Site').web).toBe(true);
    expect(classDef('Page').web).toBe(true);
    expect(classDef('Frame').web).toBeUndefined();
    const webProps = (c: ClassName) =>
      Object.entries(classDef(c).props)
        .filter(([, spec]) => spec.web)
        .map(([name]) => name);
    expect(webProps('Page')).toEqual([
      'Path',
      'Title',
      'Description',
      'SocialImage',
      'NotFound',
      'BackgroundColor3',
      'BackgroundTransparency',
    ]);
    expect(webProps('TextButton')).toEqual(['Link', 'HtmlTag']);
    expect(webProps('ImageLabel')).toEqual(['AltText', 'Link', 'HtmlTag']);
    expect(webProps('UICorner')).toEqual([]);
  });

  it('allows one StarterGui and one Site per project', () => {
    expect(classDef('StarterGui').unique).toBe(true);
    expect(classDef('Site').unique).toBe(true);
    expect(classDef('Breakpoint').unique).toBeUndefined();
  });
});
