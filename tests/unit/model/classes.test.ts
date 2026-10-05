import { describe, expect, it } from 'vitest';
import {
  canParent,
  CLASSES,
  defaultProps,
  normalizeProp,
  propNames,
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

  it('keeps the prototype property order', () => {
    expect(propNames('TextButton')).toEqual([
      'Name',
      'LayoutOrder',
      'AnchorPoint',
      'Position',
      'Size',
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
      'TextScaled',
      'TextWrapped',
      'TextXAlignment',
      'TextYAlignment',
      'TextTransparency',
      'AutoButtonColor',
    ]);
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
  ];
  it.each(cases)('%s inside %s: %s', (child, parent, ok) => {
    expect(canParent(child, parent)).toBe(ok);
  });
});
