/**
 * The class registry: every Roblox class the editor supports, with its own typed property
 * schema. Property names, order and defaults follow the prototype, which follows Studio.
 */
import { FONT_NAMES, FONT_STYLES, FONT_WEIGHT_NAMES } from './fonts.ts';
import {
  colorSequence,
  normalizeValue,
  type Link,
  numberSequence,
  type PropType,
  type PropValue,
  type UDim2,
  type ValueTypes,
} from './values.ts';

/** Properties panel sections, in the order they appear. */
export const CATEGORY_ORDER = [
  'Data',
  'Web',
  'Breakpoint',
  'Transform',
  'Appearance',
  'Text',
  'Image',
  'Filters',
  'Embed',
  'Form',
  'Scrolling',
  'Behavior',
  'Animation',
  'Corner',
  'Stroke',
  'Gradient',
  'Hover',
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
  /** May differ per breakpoint: layout, size, visibility, text size and colors. */
  readonly overridable?: boolean;
  /** Has no Roblox counterpart; the Luau export skips or translates it. */
  readonly web?: boolean;
}
export interface EnumSpec<O extends string = string> extends PropSpec<'enum'> {
  readonly options: readonly O[];
  readonly default: O;
}

/** The value type a property spec holds; enums narrow to their options. */
export type ValueOf<S> =
  S extends EnumSpec<infer O> ? O : S extends PropSpec<infer T> ? ValueTypes[T] : never;

type Options = Pick<PropSpec, 'min' | 'max' | 'step' | 'overridable' | 'web'>;
function spec<T extends Exclude<PropType, 'enum'>>(
  type: T,
  category: Category,
  def: ValueTypes[T],
  options: Options = {},
): PropSpec<T> {
  return { type, category, default: def, ...options };
}
function enumSpec<const O extends string>(
  category: Category,
  options: readonly O[],
  def: NoInfer<O>,
  extra: Options = {},
): EnumSpec<O> {
  return { type: 'enum', category, options, default: def, ...extra };
}
/** Shorthand for a property that may differ per breakpoint. */
const OV = { overridable: true } as const;
const WEB = { web: true } as const;

/**
 * root: the hidden DataModel at the top. service: StarterGui (Roblox screens) and Site
 * (web pages), one of each. container: a ScreenGui or Page, a full-window layer.
 * gui: an object that draws. modifier: a child object that changes its parent (UICorner and
 * so on). setting: a project setting kept in the tree, such as a Breakpoint. folder: a Folder,
 * which only groups objects; they draw as if they sat in the Folder's parent.
 */
export type ClassKind =
  'root' | 'service' | 'container' | 'gui' | 'modifier' | 'setting' | 'folder';

export interface ClassDef {
  readonly kind: ClassKind;
  readonly props: Readonly<Record<string, PropSpec>>;
  /** Which parents it may sit in: any class of these kinds, or these classes by name. */
  readonly parents: { readonly kinds?: readonly ClassKind[]; readonly classes?: readonly string[] };
  /** At most one per parent (the services). Can't be deleted or moved. */
  readonly unique?: boolean;
  /** Has no Roblox counterpart. */
  readonly web?: boolean;
  readonly text?: boolean;
  readonly button?: boolean;
  readonly input?: boolean;
  readonly image?: boolean;
  readonly scroll?: boolean;
  /** Arranges its parent's children (UIListLayout). */
  readonly layout?: boolean;
  /** Holds modifiers but no objects: an Embed shows another site's page over anything inside. */
  readonly leaf?: boolean;
}

const name = (className: string) => spec('string', 'Data', className);

const IN_LAYERS = { kinds: ['container', 'gui', 'folder'] } as const;
const ON_OBJECTS = { kinds: ['gui'] } as const;

/** Which way an object grows to fit its text and children; Size is then its smallest size. */
export const AUTOMATIC_SIZES = ['None', 'X', 'Y', 'XY'] as const;
export type AutomaticSize = (typeof AUTOMATIC_SIZES)[number];
/** An object's AutomaticSize, or None for a class without one. */
export const automaticSizeOf = (props: object): AutomaticSize =>
  'AutomaticSize' in props ? (props.AutomaticSize as AutomaticSize) : 'None';

const guiBase = (className: string, size: UDim2) => ({
  Name: name(className),
  LayoutOrder: spec('int', 'Data', 0, OV),
  AnchorPoint: spec('vec2', 'Transform', [0, 0], OV),
  Position: spec('udim2', 'Transform', [0, 0, 0, 0], OV),
  Size: spec('udim2', 'Transform', size, OV),
  AutomaticSize: enumSpec('Transform', AUTOMATIC_SIZES, 'None', OV),
  Rotation: spec('number', 'Transform', 0, { step: 1, ...OV }),
  BackgroundColor3: spec('color', 'Appearance', [255, 255, 255], OV),
  BackgroundTransparency: spec('alpha', 'Appearance', 0, OV),
  BorderColor3: spec('color', 'Appearance', [27, 42, 53], OV),
  BorderSizePixel: spec('int', 'Appearance', 0, { min: 0, ...OV }),
  Visible: spec('bool', 'Appearance', true, OV),
  ZIndex: spec('int', 'Appearance', 1, OV),
  ClipsDescendants: spec('bool', 'Behavior', false, OV),
});

/**
 * A ScrollingFrame grows its canvas (AutomaticCanvasSize), not itself, so it has no
 * AutomaticSize. Neither has an Embed, which shows another site's page at its own size.
 */
function scrollBase(className: string, size: UDim2) {
  const { AutomaticSize, ...props } = guiBase(className, size);
  void AutomaticSize;
  return props;
}

const textProps = (text: string) => ({
  Text: spec('string', 'Text', text),
  Font: enumSpec('Text', FONT_NAMES, 'SourceSans'),
  /** The parts of Roblox's FontFace: Font is its family. */
  FontWeight: enumSpec('Text', FONT_WEIGHT_NAMES, 'Regular'),
  FontStyle: enumSpec('Text', FONT_STYLES, 'Normal'),
  TextColor3: spec('color', 'Text', [0, 0, 0], OV),
  TextSize: spec('int', 'Text', 14, { min: 1, max: 100, ...OV }),
  /** Each line's height as a multiple of TextSize, the text centered in it. */
  LineHeight: spec('number', 'Text', 1, { min: 1, max: 3, step: 0.05, ...OV }),
  /** Extra space after each letter in pixels, as CSS letter-spacing. Roblox has none. */
  LetterSpacing: spec('number', 'Text', 0, { min: -20, max: 100, step: 0.1, ...OV, ...WEB }),
  /** A line under or through the text, on websites. */
  TextDecoration: enumSpec('Text', TEXT_DECORATIONS, 'None', { ...OV, ...WEB }),
  /** Shows the text in capitals (or lowercase) on websites, whatever was typed. */
  TextCase: enumSpec('Text', TEXT_CASES, 'None', { ...OV, ...WEB }),
  TextScaled: spec('bool', 'Text', false, OV),
  TextWrapped: spec('bool', 'Text', false, OV),
  TextXAlignment: enumSpec('Text', ['Left', 'Center', 'Right'], 'Center', OV),
  TextYAlignment: enumSpec('Text', ['Top', 'Center', 'Bottom'], 'Center', OV),
  TextTransparency: spec('alpha', 'Text', 0, OV),
});

const imageProps = () => ({
  Image: spec('image', 'Image', ''),
  ImageColor3: spec('color', 'Image', [255, 255, 255], OV),
  ImageTransparency: spec('alpha', 'Image', 0, OV),
  ScaleType: enumSpec('Image', ['Stretch', 'Fit', 'Crop'], 'Stretch', OV),
  // Photo filters for the website, as CSS filter: 0 or 1 leaves the picture as it is.
  Grayscale: spec('number', 'Filters', 0, { min: 0, max: 1, step: 0.05, ...OV, ...WEB }),
  Sepia: spec('number', 'Filters', 0, { min: 0, max: 1, step: 0.05, ...OV, ...WEB }),
  Brightness: spec('number', 'Filters', 1, { min: 0, max: 3, step: 0.05, ...OV, ...WEB }),
  Contrast: spec('number', 'Filters', 1, { min: 0, max: 3, step: 0.05, ...OV, ...WEB }),
  Saturation: spec('number', 'Filters', 1, { min: 0, max: 3, step: 0.05, ...OV, ...WEB }),
  /** Blurs the picture itself, in pixels. */
  Blur: spec('int', 'Filters', 0, { min: 0, max: 50, ...OV, ...WEB }),
});

/** The picture filters, in the order CSS applies them, with the value that changes nothing. */
export const IMAGE_FILTERS = [
  ['Grayscale', 0],
  ['Sepia', 0],
  ['Brightness', 1],
  ['Contrast', 1],
  ['Saturation', 1],
  ['Blur', 0],
] as const;

const autoButtonColor = () => ({ AutoButtonColor: spec('bool', 'Behavior', true) });

/** Lines a text can have on a website. */
export const TEXT_DECORATIONS = ['None', 'Underline', 'Strikethrough'] as const;
export type TextDecoration = (typeof TEXT_DECORATIONS)[number];
/** How a website shows the letters of a text. */
export const TEXT_CASES = ['None', 'Uppercase', 'Lowercase', 'Capitalize'] as const;
export type TextCase = (typeof TEXT_CASES)[number];

/** The mouse pointer over an object on a website; Auto lets the browser pick. */
export const CURSORS = [
  'Auto',
  'Default',
  'Pointer',
  'Text',
  'Move',
  'Grab',
  'Crosshair',
  'ZoomIn',
  'Help',
  'Wait',
  'NotAllowed',
  'None',
] as const;
export type Cursor = (typeof CURSORS)[number];

/** What an Embed shows: a YouTube video or a map of a place. */
export const EMBED_KINDS = ['YouTube', 'Map'] as const;
export type EmbedKind = (typeof EMBED_KINDS)[number];

/** What a TextBox in a Form asks for; LongText is a box for a message. */
export const INPUT_TYPES = [
  'Text',
  'Email',
  'Phone',
  'Number',
  'Url',
  'Password',
  'LongText',
] as const;
export type InputType = (typeof INPUT_TYPES)[number];

/** HTML elements an object can become on a web page; Auto picks a plain one. */
export const HTML_TAGS = [
  'Auto',
  'section',
  'header',
  'footer',
  'nav',
  'h1',
  'h2',
  'h3',
  'p',
] as const;

export type HtmlTag = (typeof HTML_TAGS)[number];

/** An object's Link, or null for none or a class without one (a Form, an Embed). */
export const linkOf = (props: object): Link | null =>
  'Link' in props ? (props.Link as Link | null) : null;
/** An object's HtmlTag, or Auto for a class without one. */
export const htmlTagOf = (props: object): HtmlTag =>
  'HtmlTag' in props ? (props.HtmlTag as HtmlTag) : 'Auto';

/** How an object on a web page comes in the first time it scrolls into view. */
export const APPEAR_STYLES = [
  'None',
  'Fade',
  'SlideUp',
  'SlideLeft',
  'SlideRight',
  'Zoom',
] as const;
export type AppearStyle = (typeof APPEAR_STYLES)[number];

/** Web-only properties every object has, last in its list. */
const webProps = () => ({
  Link: spec('link', 'Web', null, WEB),
  HtmlTag: enumSpec('Web', HTML_TAGS, 'Auto', WEB),
  ...webExtras(),
});
/** The web-only properties of objects that can't be a link or pick their tag. */
const webExtras = () => ({
  /** The mouse pointer over the object. */
  Cursor: enumSpec('Web', CURSORS, 'Auto', WEB),
  /** Straight on a page: stays on screen while the page scrolls. */
  Pinned: spec('bool', 'Web', false, WEB),
  /** Blurs whatever is behind the object, in pixels: frosted glass. */
  BackgroundBlur: spec('int', 'Appearance', 0, { min: 0, max: 100, ...OV, ...WEB }),
  Appear: enumSpec('Animation', APPEAR_STYLES, 'None', WEB),
  /** Seconds to wait before appearing, to stagger objects that come in together. */
  AppearDelay: spec('number', 'Animation', 0, { min: 0, max: 10, step: 0.1, ...WEB }),
});
const altText = () => ({ AltText: spec('string', 'Web', '', WEB) });

export const CLASSES = {
  DataModel: { kind: 'root', parents: {}, props: { Name: name('DataModel') } },
  StarterGui: {
    kind: 'service',
    unique: true,
    parents: { classes: ['DataModel'] },
    props: { Name: name('StarterGui') },
  },
  Site: {
    kind: 'service',
    unique: true,
    web: true,
    parents: { classes: ['DataModel'] },
    props: {
      Name: name('Site'),
      Language: spec('string', 'Web', 'en', WEB),
      Favicon: spec('asset', 'Web', '', WEB),
      BaseUrl: spec('string', 'Web', '', WEB),
      /** A link to a section glides there rather than jumping. */
      SmoothScroll: spec('bool', 'Web', true, WEB),
    },
  },
  Breakpoint: {
    kind: 'setting',
    parents: { classes: ['DataModel'] },
    props: {
      Name: name('Breakpoint'),
      MaxWidth: spec('int', 'Breakpoint', 1199, { min: 1 }),
      PreviewWidth: spec('int', 'Breakpoint', 810, { min: 1 }),
      PreviewHeight: spec('int', 'Breakpoint', 1080, { min: 1 }),
    },
  },
  ScreenGui: {
    kind: 'container',
    parents: { classes: ['StarterGui'] },
    props: {
      Name: name('ScreenGui'),
      Enabled: spec('bool', 'Behavior', true),
      DisplayOrder: spec('int', 'Behavior', 0),
      ResetOnSpawn: spec('bool', 'Behavior', false),
    },
  },
  Page: {
    kind: 'container',
    web: true,
    scroll: true,
    parents: { classes: ['Site'] },
    props: {
      Name: name('Page'),
      Path: spec('string', 'Web', '/page', WEB),
      Title: spec('string', 'Web', '', WEB),
      Description: spec('string', 'Web', '', WEB),
      SocialImage: spec('asset', 'Web', '', WEB),
      NotFound: spec('bool', 'Web', false, WEB),
      BackgroundColor3: spec('color', 'Appearance', [255, 255, 255], { ...OV, ...WEB }),
      BackgroundTransparency: spec('alpha', 'Appearance', 0, { ...OV, ...WEB }),
    },
  },
  /**
   * Groups objects, as in Studio. Its objects draw and lay out as if they sat in the Folder's
   * parent, placed by their own Position; a UIListLayout there doesn't arrange them.
   */
  Folder: {
    kind: 'folder',
    parents: IN_LAYERS,
    props: { Name: name('Folder') },
  },
  Frame: {
    kind: 'gui',
    parents: IN_LAYERS,
    props: { ...guiBase('Frame', [0, 200, 0, 140]), ...webProps() },
  },
  TextLabel: {
    kind: 'gui',
    parents: IN_LAYERS,
    text: true,
    props: { ...guiBase('TextLabel', [0, 200, 0, 50]), ...textProps('Label'), ...webProps() },
  },
  TextButton: {
    kind: 'gui',
    parents: IN_LAYERS,
    text: true,
    button: true,
    props: {
      ...guiBase('TextButton', [0, 200, 0, 50]),
      ...textProps('Button'),
      ...autoButtonColor(),
      ...webProps(),
    },
  },
  TextBox: {
    kind: 'gui',
    parents: IN_LAYERS,
    text: true,
    input: true,
    props: {
      ...guiBase('TextBox', [0, 200, 0, 50]),
      ...textProps(''),
      PlaceholderText: spec('string', 'Text', 'Type here'),
      // In a Form: what the box asks for, and whether the form can be sent without it.
      InputType: enumSpec('Form', INPUT_TYPES, 'Text', WEB),
      Required: spec('bool', 'Form', false, WEB),
      ...webProps(),
    },
  },
  ImageLabel: {
    kind: 'gui',
    parents: IN_LAYERS,
    image: true,
    props: {
      ...guiBase('ImageLabel', [0, 100, 0, 100]),
      ...imageProps(),
      ...altText(),
      ...webProps(),
    },
  },
  ImageButton: {
    kind: 'gui',
    parents: IN_LAYERS,
    image: true,
    button: true,
    props: {
      ...guiBase('ImageButton', [0, 100, 0, 100]),
      ...imageProps(),
      ...autoButtonColor(),
      ...altText(),
      ...webProps(),
    },
  },
  ScrollingFrame: {
    kind: 'gui',
    parents: IN_LAYERS,
    scroll: true,
    props: {
      ...scrollBase('ScrollingFrame', [0, 240, 0, 200]),
      CanvasSize: spec('udim2', 'Scrolling', [0, 0, 2, 0], OV),
      AutomaticCanvasSize: enumSpec('Scrolling', AUTOMATIC_SIZES, 'None', OV),
      ScrollBarThickness: spec('int', 'Scrolling', 12, { min: 0, ...OV }),
      ...webProps(),
    },
  },
  /**
   * A form on a web page. Its TextBoxes are the fields, named by their Name, and its buttons
   * send it to Action, an address from a form service such as Formspree.
   */
  Form: {
    kind: 'gui',
    web: true,
    parents: IN_LAYERS,
    props: {
      ...guiBase('Form', [0, 400, 0, 260]),
      Action: spec('string', 'Form', '', WEB),
      Method: enumSpec('Form', ['POST', 'GET'], 'POST', WEB),
      /** What the send button says once the form went through. */
      SentText: spec('string', 'Form', 'Thanks! Your message was sent.', WEB),
      ...webExtras(),
    },
  },
  /** A YouTube video or a map, from another site, on a web page. */
  Embed: {
    kind: 'gui',
    web: true,
    leaf: true,
    parents: IN_LAYERS,
    props: {
      ...scrollBase('Embed', [0, 560, 0, 315]),
      Kind: enumSpec('Embed', EMBED_KINDS, 'YouTube', WEB),
      /** A YouTube link, or the address or place a map shows. */
      Source: spec('string', 'Embed', '', WEB),
      /** YouTube: starts playing, muted, as the page opens. */
      Autoplay: spec('bool', 'Embed', false, WEB),
      /** Map: from 1 (the world) to 20 (a building). */
      Zoom: spec('int', 'Embed', 14, { min: 1, max: 20, ...WEB }),
      /** What a screen reader says for it. */
      Title: spec('string', 'Web', '', WEB),
      ...webExtras(),
    },
  },
  UICorner: {
    kind: 'modifier',
    parents: ON_OBJECTS,
    props: { Name: name('UICorner'), CornerRadius: spec('udim', 'Corner', [0, 8], OV) },
  },
  UIStroke: {
    kind: 'modifier',
    parents: ON_OBJECTS,
    props: {
      Name: name('UIStroke'),
      Color: spec('color', 'Stroke', [0, 0, 0], OV),
      Thickness: spec('number', 'Stroke', 1, { min: 0, step: 0.5, ...OV }),
      Transparency: spec('alpha', 'Stroke', 0, OV),
      ApplyStrokeMode: enumSpec('Stroke', ['Contextual', 'Border'], 'Contextual', OV),
      // Which sides of the box the outline draws on, for the website. Roblox draws all four.
      Top: spec('bool', 'Stroke', true, { ...OV, ...WEB }),
      Right: spec('bool', 'Stroke', true, { ...OV, ...WEB }),
      Bottom: spec('bool', 'Stroke', true, { ...OV, ...WEB }),
      Left: spec('bool', 'Stroke', true, { ...OV, ...WEB }),
    },
  },
  UIGradient: {
    kind: 'modifier',
    parents: ON_OBJECTS,
    props: {
      Name: name('UIGradient'),
      Color: spec('colorseq', 'Gradient', colorSequence([255, 255, 255], [0, 0, 0]), OV),
      Transparency: spec('numseq', 'Gradient', numberSequence(0, 0), { min: 0, max: 1, ...OV }),
      Rotation: spec('number', 'Gradient', 0, { step: 1, ...OV }),
      /** On a website, a text object's gradient can color its letters instead. */
      ApplyTo: enumSpec('Gradient', ['Background', 'Text'], 'Background', WEB),
    },
  },
  UIPadding: {
    kind: 'modifier',
    // A page can have padding too; a ScreenGui can't, as in Roblox.
    parents: { kinds: ['gui'], classes: ['Page'] },
    props: {
      Name: name('UIPadding'),
      PaddingTop: spec('udim', 'Padding', [0, 0], OV),
      PaddingBottom: spec('udim', 'Padding', [0, 0], OV),
      PaddingLeft: spec('udim', 'Padding', [0, 0], OV),
      PaddingRight: spec('udim', 'Padding', [0, 0], OV),
    },
  },
  UIListLayout: {
    kind: 'modifier',
    layout: true,
    // A UIListLayout can also arrange the objects directly in a ScreenGui or Page.
    parents: { kinds: ['gui', 'container'] },
    props: {
      Name: name('UIListLayout'),
      FillDirection: enumSpec('Layout', ['Vertical', 'Horizontal'], 'Vertical', OV),
      HorizontalAlignment: enumSpec('Layout', ['Left', 'Center', 'Right'], 'Left', OV),
      VerticalAlignment: enumSpec('Layout', ['Top', 'Center', 'Bottom'], 'Top', OV),
      Padding: spec('udim', 'Layout', [0, 0], OV),
      SortOrder: enumSpec('Layout', ['LayoutOrder', 'Name'], 'LayoutOrder'),
    },
  },
  UIHover: {
    kind: 'modifier',
    web: true,
    parents: ON_OBJECTS,
    props: {
      Name: name('UIHover'),
      BackgroundColor3: spec('color', 'Hover', [255, 255, 255], { ...OV, ...WEB }),
      BackgroundTransparency: spec('alpha', 'Hover', 0, { ...OV, ...WEB }),
      TextColor3: spec('color', 'Hover', [0, 0, 0], { ...OV, ...WEB }),
      /** How much bigger the object gets, 1 for no change. */
      Scale: spec('number', 'Hover', 1.05, { min: 0.5, max: 2, step: 0.01, ...OV, ...WEB }),
      /** How many pixels the object moves up. */
      Lift: spec('int', 'Hover', 0, { min: -100, max: 100, ...OV, ...WEB }),
      /** Seconds the change takes. */
      Duration: spec('number', 'Hover', 0.2, { min: 0, max: 2, step: 0.05, ...WEB }),
    },
  },
  UIAspectRatioConstraint: {
    kind: 'modifier',
    parents: ON_OBJECTS,
    props: {
      Name: name('UIAspectRatioConstraint'),
      AspectRatio: spec('number', 'Constraint', 1, { min: 0.01, step: 0.05, ...OV }),
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
/** Objects only a web page can hold, from the ribbon's Web menu. */
export const WEB_OBJECT_CLASSES = ['Form', 'Embed'] as const satisfies readonly ClassName[];
/** Modifiers the ribbon adds to the selection, in ribbon order. */
export const MODIFIER_CLASSES = [
  'UICorner',
  'UIStroke',
  'UIGradient',
  'UIPadding',
  'UIListLayout',
  'UIAspectRatioConstraint',
  'UIHover',
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
  const { kinds = [], classes = [] } = classDef(child).parents;
  if (classDef(parent).leaf && classDef(child).kind !== 'modifier') return false;
  return kinds.includes(classDef(parent).kind) || classes.includes(parent);
}

/** Whether a property may differ per breakpoint. */
export const isOverridable = (className: ClassName, prop: string): boolean =>
  propSpec(className, prop)?.overridable === true;
