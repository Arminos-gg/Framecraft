/**
 * The class registry: every Roblox class the editor supports, with its own typed property
 * schema. Property names, order and defaults follow the prototype, which follows Studio.
 */
import { FONT_NAMES } from './fonts.ts';
import {
  colorSequence,
  normalizeValue,
  numberSequence,
  type PropType,
  type PropValue,
  type UDim2,
  type ValueTypes,
} from './values.ts';

/** Properties panel sections, in the order they appear. */
export const CATEGORY_ORDER = [
  'Data',
  'Transform',
  'Appearance',
  'Text',
  'Image',
  'Scrolling',
  'Behavior',
  'Corner',
  'Stroke',
  'Gradient',
  'Padding',
  'Layout',
  'Constraint',
] as const;
export type Category = (typeof CATEGORY_ORDER)[number];

export interface PropSpec<T extends PropType = PropType> {
  readonly type: T;
  readonly category: Category;
  readonly default: ValueTypes[T];
  readonly min?: number;
  readonly max?: number;
  /** Step for drag and arrow-key edits in the Properties panel. */
  readonly step?: number;
  readonly options?: readonly string[];
}
export interface EnumSpec<O extends string = string> extends PropSpec<'enum'> {
  readonly options: readonly O[];
  readonly default: O;
}

/** The value type a property spec holds; enums narrow to their options. */
export type ValueOf<S> =
  S extends EnumSpec<infer O> ? O : S extends PropSpec<infer T> ? ValueTypes[T] : never;

type Limits = Pick<PropSpec, 'min' | 'max' | 'step'>;
function spec<T extends Exclude<PropType, 'enum'>>(
  type: T,
  category: Category,
  def: ValueTypes[T],
  limits: Limits = {},
): PropSpec<T> {
  return { type, category, default: def, ...limits };
}
function enumSpec<const O extends string>(
  category: Category,
  options: readonly O[],
  def: NoInfer<O>,
): EnumSpec<O> {
  return { type: 'enum', category, options, default: def };
}

/**
 * root: StarterGui, the top of the tree. container: ScreenGui, a full-screen layer.
 * gui: an object that draws. modifier: a child object that changes its parent (UICorner and so on).
 */
export type ClassKind = 'root' | 'container' | 'gui' | 'modifier';

export interface ClassDef {
  readonly kind: ClassKind;
  readonly props: Readonly<Record<string, PropSpec>>;
  readonly text?: boolean;
  readonly button?: boolean;
  readonly input?: boolean;
  readonly image?: boolean;
  readonly scroll?: boolean;
  /** Arranges its parent's children (UIListLayout). */
  readonly layout?: boolean;
}

const name = (className: string) => spec('string', 'Data', className);

const guiBase = (className: string, size: UDim2) => ({
  Name: name(className),
  LayoutOrder: spec('int', 'Data', 0),
  AnchorPoint: spec('vec2', 'Transform', [0, 0]),
  Position: spec('udim2', 'Transform', [0, 0, 0, 0]),
  Size: spec('udim2', 'Transform', size),
  Rotation: spec('number', 'Transform', 0, { step: 1 }),
  BackgroundColor3: spec('color', 'Appearance', [255, 255, 255]),
  BackgroundTransparency: spec('alpha', 'Appearance', 0),
  BorderColor3: spec('color', 'Appearance', [27, 42, 53]),
  BorderSizePixel: spec('int', 'Appearance', 0, { min: 0 }),
  Visible: spec('bool', 'Appearance', true),
  ZIndex: spec('int', 'Appearance', 1),
  ClipsDescendants: spec('bool', 'Behavior', false),
});

const textProps = (text: string) => ({
  Text: spec('string', 'Text', text),
  Font: enumSpec('Text', FONT_NAMES, 'SourceSans'),
  TextColor3: spec('color', 'Text', [0, 0, 0]),
  TextSize: spec('int', 'Text', 14, { min: 1, max: 100 }),
  TextScaled: spec('bool', 'Text', false),
  TextWrapped: spec('bool', 'Text', false),
  TextXAlignment: enumSpec('Text', ['Left', 'Center', 'Right'], 'Center'),
  TextYAlignment: enumSpec('Text', ['Top', 'Center', 'Bottom'], 'Center'),
  TextTransparency: spec('alpha', 'Text', 0),
});

const imageProps = () => ({
  Image: spec('image', 'Image', ''),
  ImageColor3: spec('color', 'Image', [255, 255, 255]),
  ImageTransparency: spec('alpha', 'Image', 0),
  ScaleType: enumSpec('Image', ['Stretch', 'Fit', 'Crop'], 'Stretch'),
});

const autoButtonColor = () => ({ AutoButtonColor: spec('bool', 'Behavior', true) });

export const CLASSES = {
  StarterGui: { kind: 'root', props: { Name: name('StarterGui') } },
  ScreenGui: {
    kind: 'container',
    props: {
      Name: name('ScreenGui'),
      Enabled: spec('bool', 'Behavior', true),
      DisplayOrder: spec('int', 'Behavior', 0),
      ResetOnSpawn: spec('bool', 'Behavior', false),
    },
  },
  Frame: { kind: 'gui', props: guiBase('Frame', [0, 200, 0, 140]) },
  TextLabel: {
    kind: 'gui',
    text: true,
    props: { ...guiBase('TextLabel', [0, 200, 0, 50]), ...textProps('Label') },
  },
  TextButton: {
    kind: 'gui',
    text: true,
    button: true,
    props: {
      ...guiBase('TextButton', [0, 200, 0, 50]),
      ...textProps('Button'),
      ...autoButtonColor(),
    },
  },
  TextBox: {
    kind: 'gui',
    text: true,
    input: true,
    props: {
      ...guiBase('TextBox', [0, 200, 0, 50]),
      ...textProps(''),
      PlaceholderText: spec('string', 'Text', 'Type here'),
    },
  },
  ImageLabel: {
    kind: 'gui',
    image: true,
    props: { ...guiBase('ImageLabel', [0, 100, 0, 100]), ...imageProps() },
  },
  ImageButton: {
    kind: 'gui',
    image: true,
    button: true,
    props: { ...guiBase('ImageButton', [0, 100, 0, 100]), ...imageProps(), ...autoButtonColor() },
  },
  ScrollingFrame: {
    kind: 'gui',
    scroll: true,
    props: {
      ...guiBase('ScrollingFrame', [0, 240, 0, 200]),
      CanvasSize: spec('udim2', 'Scrolling', [0, 0, 2, 0]),
      ScrollBarThickness: spec('int', 'Scrolling', 12, { min: 0 }),
    },
  },
  UICorner: {
    kind: 'modifier',
    props: { Name: name('UICorner'), CornerRadius: spec('udim', 'Corner', [0, 8]) },
  },
  UIStroke: {
    kind: 'modifier',
    props: {
      Name: name('UIStroke'),
      Color: spec('color', 'Stroke', [0, 0, 0]),
      Thickness: spec('number', 'Stroke', 1, { min: 0, step: 0.5 }),
      Transparency: spec('alpha', 'Stroke', 0),
      ApplyStrokeMode: enumSpec('Stroke', ['Contextual', 'Border'], 'Contextual'),
    },
  },
  UIGradient: {
    kind: 'modifier',
    props: {
      Name: name('UIGradient'),
      Color: spec('colorseq', 'Gradient', colorSequence([255, 255, 255], [0, 0, 0])),
      Transparency: spec('numseq', 'Gradient', numberSequence(0, 0), { min: 0, max: 1 }),
      Rotation: spec('number', 'Gradient', 0, { step: 1 }),
    },
  },
  UIPadding: {
    kind: 'modifier',
    props: {
      Name: name('UIPadding'),
      PaddingTop: spec('udim', 'Padding', [0, 0]),
      PaddingBottom: spec('udim', 'Padding', [0, 0]),
      PaddingLeft: spec('udim', 'Padding', [0, 0]),
      PaddingRight: spec('udim', 'Padding', [0, 0]),
    },
  },
  UIListLayout: {
    kind: 'modifier',
    layout: true,
    props: {
      Name: name('UIListLayout'),
      FillDirection: enumSpec('Layout', ['Vertical', 'Horizontal'], 'Vertical'),
      HorizontalAlignment: enumSpec('Layout', ['Left', 'Center', 'Right'], 'Left'),
      VerticalAlignment: enumSpec('Layout', ['Top', 'Center', 'Bottom'], 'Top'),
      Padding: spec('udim', 'Layout', [0, 0]),
      SortOrder: enumSpec('Layout', ['LayoutOrder', 'Name'], 'LayoutOrder'),
    },
  },
  UIAspectRatioConstraint: {
    kind: 'modifier',
    props: {
      Name: name('UIAspectRatioConstraint'),
      AspectRatio: spec('number', 'Constraint', 1, { min: 0.01, step: 0.05 }),
    },
  },
} satisfies Record<string, ClassDef>;

export type ClassName = keyof typeof CLASSES;
type SpecsOf<C extends ClassName> = (typeof CLASSES)[C]['props'];
export type PropName<C extends ClassName> = keyof SpecsOf<C> & string;
export type PropsOf<C extends ClassName> = {
  readonly [K in PropName<C>]: ValueOf<SpecsOf<C>[K]>;
};

/** Objects the ribbon inserts, in ribbon order. */
export const OBJECT_CLASSES = [
  'Frame',
  'TextLabel',
  'TextButton',
  'TextBox',
  'ImageLabel',
  'ImageButton',
  'ScrollingFrame',
] as const satisfies readonly ClassName[];
/** Modifiers the ribbon adds to the selection, in ribbon order. */
export const MODIFIER_CLASSES = [
  'UICorner',
  'UIStroke',
  'UIGradient',
  'UIPadding',
  'UIListLayout',
  'UIAspectRatioConstraint',
] as const satisfies readonly ClassName[];

export const isClassName = (s: unknown): s is ClassName =>
  typeof s === 'string' && Object.hasOwn(CLASSES, s);
export const classDef = (className: ClassName): ClassDef => CLASSES[className];

export function propSpec(className: ClassName, prop: string): PropSpec | undefined {
  const specs: Readonly<Record<string, PropSpec>> = CLASSES[className].props;
  return Object.hasOwn(specs, prop) ? specs[prop] : undefined;
}

export function propNames<C extends ClassName>(className: C): PropName<C>[] {
  return Object.keys(CLASSES[className].props) as PropName<C>[];
}

/** A fresh set of default property values for a class. Name defaults to the class name. */
export function defaultProps<C extends ClassName>(className: C): PropsOf<C> {
  const specs: Readonly<Record<string, PropSpec>> = CLASSES[className].props;
  const out: Record<string, PropValue> = {};
  for (const [key, s] of Object.entries(specs)) out[key] = structuredClone(s.default);
  return out as PropsOf<C>;
}

/**
 * Coerces a value for a class's property: rounds offsets and integers, clamps to the
 * property's limits. Returns undefined for an unknown property or an unreadable value.
 */
export function normalizeProp(className: ClassName, prop: string, value: unknown) {
  const s = propSpec(className, prop);
  return s && normalizeValue(s.type, value, s);
}

/** Whether an object of class `child` may sit directly inside one of class `parent`. */
export function canParent(child: ClassName, parent: ClassName): boolean {
  const ck = CLASSES[child].kind;
  const pk = CLASSES[parent].kind;
  switch (ck) {
    case 'root':
      return false;
    case 'container':
      return pk === 'root';
    case 'gui':
      return pk === 'container' || pk === 'gui';
    case 'modifier':
      // A UIListLayout can also arrange the objects directly in a ScreenGui.
      return pk === 'gui' || (pk === 'container' && classDef(child).layout === true);
  }
}
