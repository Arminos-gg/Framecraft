/**
 * A product landing page: a nav bar, a hero with a mock of the app, three feature cards, a
 * call to action and a footer. Tablet and Phone stack the cards and shrink the headline.
 */
import { Builder, pageSubtree } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import { column, corner, group, label, padAll, padX, sizeAt, stroke } from './kit.ts';

const INK: Color3 = [17, 24, 39];
const BODY: Color3 = [75, 85, 99];
const MUTED: Color3 = [107, 114, 128];
const ACCENT: Color3 = [79, 70, 229];
const ACCENT_SOFT: Color3 = [238, 242, 255];
const LINE: Color3 = [229, 231, 235];
const ALT: Color3 = [249, 250, 251];
const BAR: Color3 = [226, 229, 240];
const WHITE: Color3 = [255, 255, 255];

export function landingTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const home = b.addSubtree(
    b.site,
    pageSubtree(
      {
        Name: 'Home',
        Path: '/',
        Title: 'Orbit · Plan less, ship more',
        Description: "Orbit keeps your team's projects, deadlines and notes in one calm place.",
      },
      makeId,
    ),
  );
  const nav = addNav(b, home);
  const hero = addHero(b, home);
  addFeatures(b, home);
  addCallToAction(b, home);
  addFooter(b, home);

  b.set(nav.features, { Link: { kind: 'page', page: home, section: 'features' } });
  b.set(nav.start, { Link: { kind: 'page', page: home, section: 'getstarted' } });
  b.set(hero.demo, { Link: { kind: 'page', page: home, section: 'features' } });
  return b.doc;
}

function addNav(b: Builder, page: InstanceId) {
  const nav = b.add(page, 'Frame', {
    Name: 'Nav',
    HtmlTag: 'nav',
    LayoutOrder: 1,
    Size: [1, 0, 0, 72],
    BackgroundColor3: WHITE,
  });
  b.change(nav, 'Phone', { Size: [1, 0, 0, 64] });
  const bar = column(b, nav, 1120, [1, 0], 'Bar');

  const logo = group(b, bar, { Name: 'Logo', Size: [0, 130, 1, 0] });
  const mark = b.add(logo, 'Frame', {
    Name: 'Mark',
    AnchorPoint: [0, 0.5],
    Position: [0, 0, 0.5, 0],
    Size: [0, 28, 0, 28],
    BackgroundColor3: WHITE,
  });
  corner(b, mark, [0, 8]);
  b.add(mark, 'UIGradient', { Color: colorSequence([129, 140, 248], ACCENT), Rotation: 45 });
  const ring = group(b, mark, {
    Name: 'Ring',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0, 12, 0, 12],
  });
  corner(b, ring, [0.5, 0]);
  stroke(b, ring, WHITE, 2.5);
  label(b, logo, {
    Name: 'Wordmark',
    Position: [0, 38, 0, 0],
    Size: [0, 90, 1, 0],
    Text: 'Orbit',
    Font: 'PlusJakartaSans',
    FontWeight: 'ExtraBold',
    TextSize: 22,
    TextColor3: INK,
    TextXAlignment: 'Left',
  });

  const links = group(b, bar, {
    Name: 'Links',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0, 324, 0, 40],
  });
  b.change(links, 'Phone', { Visible: false });
  b.add(links, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Center',
    Padding: [0, 8],
  });
  const link = (name: string, order: number, text: string) =>
    b.add(links, 'TextButton', {
      Name: name,
      LayoutOrder: order,
      Size: [0, 100, 1, 0],
      BackgroundTransparency: 1,
      Text: text,
      Font: 'PlusJakartaSans',
      FontWeight: 'Medium',
      TextSize: 15,
      TextColor3: BODY,
    });
  const features = link('FeaturesLink', 1, 'Features');
  link('CustomersLink', 2, 'Customers');
  link('PricingLink', 3, 'Pricing');

  const actions = group(b, bar, {
    Name: 'Actions',
    AnchorPoint: [1, 0.5],
    Position: [1, 0, 0.5, 0],
    Size: [0, 236, 0, 40],
  });
  b.add(actions, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Right',
    VerticalAlignment: 'Center',
    Padding: [0, 8],
  });
  const signIn = b.add(actions, 'TextButton', {
    Name: 'SignIn',
    LayoutOrder: 1,
    Size: [0, 88, 1, 0],
    BackgroundTransparency: 1,
    Text: 'Sign in',
    Font: 'PlusJakartaSans',
    FontWeight: 'Medium',
    TextSize: 15,
    TextColor3: INK,
  });
  b.change(signIn, 'Tablet', { Visible: false });
  const start = b.add(actions, 'TextButton', {
    Name: 'GetStartedButton',
    LayoutOrder: 2,
    Size: [0, 132, 1, 0],
    BackgroundColor3: INK,
    Text: 'Get started',
    Font: 'PlusJakartaSans',
    FontWeight: 'Bold',
    TextSize: 15,
    TextColor3: WHITE,
  });
  corner(b, start, [0, 10]);
  return { features, start };
}

function addHero(b: Builder, page: InstanceId) {
  const hero = b.add(page, 'Frame', {
    Name: 'Hero',
    HtmlTag: 'header',
    LayoutOrder: 2,
    BackgroundColor3: WHITE,
    ClipsDescendants: true,
    AutomaticSize: 'Y',
  });
  sizeAt(b, hero, { base: [1, 0, 0, 860], Tablet: [1, 0, 0, 800], Phone: [1, 0, 0, 820] });
  b.add(hero, 'UIGradient', { Color: colorSequence(WHITE, [236, 239, 255]), Rotation: 90 });
  const pad = b.add(hero, 'UIPadding', { PaddingTop: [0, 80] });
  b.change(pad, 'Phone', { PaddingTop: [0, 48] });
  b.add(hero, 'UIListLayout', { HorizontalAlignment: 'Center', Padding: [0, 20] });

  const badge = label(b, hero, {
    Name: 'Badge',
    LayoutOrder: 1,
    Size: [0, 268, 0, 34],
    AutomaticSize: 'X',
    BackgroundTransparency: 0,
    BackgroundColor3: ACCENT_SOFT,
    Text: 'New · Shared timelines are here',
    Font: 'PlusJakartaSans',
    FontWeight: 'Medium',
    TextSize: 14,
    TextColor3: ACCENT,
  });
  corner(b, badge, [0.5, 0]);
  padX(b, badge, 16);
  stroke(b, badge, [199, 210, 254], 1, { ApplyStrokeMode: 'Border' });

  const headline = label(b, hero, {
    Name: 'Headline',
    HtmlTag: 'h1',
    LayoutOrder: 2,
    Text: 'Plan less. Ship more.',
    Font: 'PlusJakartaSans',
    FontWeight: 'ExtraBold',
    TextSize: 76,
    LetterSpacing: -2,
    LineHeight: 1.1,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: INK,
  });
  sizeAt(b, headline, { base: [0, 900, 0, 88], Tablet: [1, -80, 0, 76], Phone: [1, -40, 0, 112] });
  b.change(headline, 'Tablet', { TextSize: 64 });
  b.change(headline, 'Phone', { TextSize: 44 });

  const sub = label(b, hero, {
    Name: 'Subhead',
    HtmlTag: 'p',
    LayoutOrder: 3,
    Text: "Orbit keeps your team's projects, deadlines and notes in one calm place, so everyone knows what's next.",
    Font: 'PlusJakartaSans',
    TextSize: 20,
    LineHeight: 1.4,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: BODY,
  });
  sizeAt(b, sub, { base: [0, 640, 0, 60], Phone: [1, -40, 0, 100] });
  b.change(sub, 'Phone', { TextSize: 18 });

  // Taller than the buttons, so the mock below gets more room.
  const buttons = group(b, hero, { Name: 'Buttons', LayoutOrder: 4, AutomaticSize: 'X' });
  sizeAt(b, buttons, { base: [0, 380, 0, 88], Phone: [1, -40, 0, 144] });
  const row = b.add(buttons, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0, 12],
  });
  b.change(row, 'Phone', { FillDirection: 'Vertical' });
  const button = (name: string, order: number, text: string, bg: Color3, fg: Color3) => {
    const id = b.add(buttons, 'TextButton', {
      Name: name,
      LayoutOrder: order,
      BackgroundColor3: bg,
      Text: text,
      Font: 'PlusJakartaSans',
      FontWeight: 'Bold',
      TextSize: 16,
      TextColor3: fg,
    });
    sizeAt(b, id, { base: [0, 184, 0, 52], Phone: [1, 0, 0, 52] });
    b.set(id, { AutomaticSize: 'X' });
    corner(b, id, [0, 12]);
    padX(b, id, 24);
    return id;
  };
  button('StartFree', 1, 'Start for free', ACCENT, WHITE);
  const demo = button('Demo', 2, 'See how it works', WHITE, INK);
  stroke(b, demo, LINE, 1, { ApplyStrokeMode: 'Border' });

  addAppMock(b, hero);
  return { demo };
}

/** A drawing of the app: a window with a sidebar and a board of task cards. */
function addAppMock(b: Builder, hero: InstanceId) {
  const mock = b.add(hero, 'Frame', {
    Name: 'AppPreview',
    LayoutOrder: 5,
    BackgroundColor3: WHITE,
    ClipsDescendants: true,
  });
  sizeAt(b, mock, { base: [0, 1040, 0, 380], Tablet: [1, -80, 0, 320], Phone: [1, -40, 0, 260] });
  corner(b, mock, [0, 16]);
  stroke(b, mock, [221, 224, 240], 1);

  const top = b.add(mock, 'Frame', {
    Name: 'TitleBar',
    Size: [1, 0, 0, 44],
    BackgroundColor3: ALT,
  });
  const dots = group(b, top, { Name: 'Dots', Position: [0, 16, 0, 0], Size: [0, 60, 1, 0] });
  b.add(dots, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 8],
  });
  const dotColors: Color3[] = [
    [248, 113, 113],
    [251, 191, 36],
    [52, 211, 153],
  ];
  dotColors.forEach((color, i) => {
    const dot = b.add(dots, 'Frame', {
      Name: `Dot${i + 1}`,
      LayoutOrder: i + 1,
      Size: [0, 12, 0, 12],
      BackgroundColor3: color,
    });
    corner(b, dot, [0.5, 0]);
  });
  b.add(top, 'Frame', {
    Name: 'Divider',
    Position: [0, 0, 1, -1],
    Size: [1, 0, 0, 1],
    BackgroundColor3: LINE,
  });

  const side = b.add(mock, 'Frame', {
    Name: 'Sidebar',
    Position: [0, 0, 0, 44],
    Size: [0, 200, 1, -44],
    BackgroundColor3: ALT,
  });
  b.change(side, 'Phone', { Visible: false });
  padAll(b, side, [0, 16]);
  b.add(side, 'UIListLayout', { Padding: [0, 6] });
  [0.55, 0.4, 0.62, 0.48, 0.36].forEach((w, i) => {
    const item = b.add(side, 'Frame', {
      Name: `NavItem${i + 1}`,
      LayoutOrder: i + 1,
      Size: [1, 0, 0, 30],
      BackgroundColor3: ACCENT_SOFT,
      BackgroundTransparency: i === 0 ? 0 : 1,
    });
    corner(b, item, [0, 8]);
    const bar = b.add(item, 'Frame', {
      Name: 'Bar',
      AnchorPoint: [0, 0.5],
      Position: [0, 12, 0.5, 0],
      Size: [w, 0, 0, 8],
      BackgroundColor3: i === 0 ? ACCENT : BAR,
    });
    corner(b, bar, [0.5, 0]);
  });

  const board = group(b, mock, { Name: 'Board' });
  b.set(board, { Position: [0, 224, 0, 68], Size: [1, -248, 1, -68] });
  b.change(board, 'Phone', { Position: [0, 16, 0, 60], Size: [1, -32, 1, -60] });
  b.add(board, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 16] });
  const lanes: [string, Color3, number][] = [
    ['To do', [129, 140, 248], 3],
    ['In progress', [251, 191, 36], 2],
    ['Done', [52, 211, 153], 2],
  ];
  lanes.forEach(([title, chip, count], i) => {
    const lane = group(b, board, {
      Name: title.replace(' ', ''),
      LayoutOrder: i + 1,
      Size: [0.3333, -11, 1, 0],
    });
    b.add(lane, 'UIListLayout', { Padding: [0, 10] });
    label(b, lane, {
      Name: 'Heading',
      LayoutOrder: 0,
      Size: [1, 0, 0, 18],
      Text: title,
      Font: 'PlusJakartaSans',
      FontWeight: 'Bold',
      TextSize: 13,
      TextColor3: MUTED,
      TextXAlignment: 'Left',
    });
    for (let n = 1; n <= count; n++) {
      const card = b.add(lane, 'Frame', {
        Name: `Card${n}`,
        LayoutOrder: n,
        Size: [1, 0, 0, 72],
        BackgroundColor3: WHITE,
      });
      corner(b, card, [0, 10]);
      stroke(b, card, LINE, 1);
      const tag = b.add(card, 'Frame', {
        Name: 'Tag',
        Position: [0, 12, 0, 12],
        Size: [0, 36, 0, 8],
        BackgroundColor3: chip,
      });
      corner(b, tag, [0.5, 0]);
      const line = (name: string, y: number, w: number) => {
        const id = b.add(card, 'Frame', {
          Name: name,
          Position: [0, 12, 0, y],
          Size: [w, -24, 0, 8],
          BackgroundColor3: BAR,
        });
        corner(b, id, [0.5, 0]);
      };
      line('Line1', 30, n % 2 ? 0.9 : 0.75);
      line('Line2', 46, n % 2 ? 0.55 : 0.65);
    }
  });
}

function addFeatures(b: Builder, page: InstanceId) {
  const section = b.add(page, 'Frame', {
    Name: 'Features',
    HtmlTag: 'section',
    LayoutOrder: 3,
    BackgroundColor3: WHITE,
    AutomaticSize: 'Y',
  });
  sizeAt(b, section, { base: [1, 0, 0, 564], Tablet: [1, 0, 0, 924], Phone: [1, 0, 0, 940] });
  const pad = b.add(section, 'UIPadding', { PaddingTop: [0, 96], PaddingBottom: [0, 96] });
  b.change(pad, 'Phone', { PaddingTop: [0, 64], PaddingBottom: [0, 64] });
  b.add(section, 'UIListLayout', { HorizontalAlignment: 'Center', Padding: [0, 16] });

  label(b, section, {
    Name: 'Eyebrow',
    LayoutOrder: 1,
    Size: [0, 200, 0, 20],
    Text: 'FEATURES',
    Font: 'PlusJakartaSans',
    FontWeight: 'Bold',
    TextSize: 14,
    LetterSpacing: 1.5,
    TextColor3: ACCENT,
  });
  const title = label(b, section, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 2,
    Text: "Everything your team needs, and nothing it doesn't",
    Font: 'PlusJakartaSans',
    FontWeight: 'ExtraBold',
    TextSize: 40,
    LetterSpacing: -1,
    LineHeight: 1.15,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: INK,
  });
  sizeAt(b, title, { base: [0, 720, 0, 96], Tablet: [1, -80, 0, 96], Phone: [1, -40, 0, 128] });
  b.change(title, 'Tablet', { TextSize: 36 });
  b.change(title, 'Phone', { TextSize: 30 });

  // Cards sit at the bottom of a taller row, which leaves room under the title.
  const cards = group(b, section, { Name: 'Cards', LayoutOrder: 3, AutomaticSize: 'Y' });
  sizeAt(b, cards, {
    base: [0, 1120, 0, 224],
    Tablet: [1, -80, 0, 584],
    Phone: [1, -40, 0, 632],
  });
  const list = b.add(cards, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Bottom',
    Padding: [0, 24],
  });
  b.change(list, 'Tablet', { FillDirection: 'Vertical', Padding: [0, 16] });

  const features: [string, string, number][] = [
    [
      'Shared timelines',
      'See every project on one timeline, and move dates together when plans change.',
      0.5,
    ],
    [
      'Calm notifications',
      'Orbit gathers updates into one daily digest, so focus time stays focused.',
      0.25,
    ],
    ['Notes that link up', 'Meeting notes link to the tasks they create, and tasks link back.', 0],
  ];
  features.forEach(([heading, body, round], i) => {
    const card = b.add(cards, 'Frame', {
      Name: heading
        .split(' ')
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(''),
      LayoutOrder: i + 1,
      BackgroundColor3: ALT,
      AutomaticSize: 'Y',
    });
    sizeAt(b, card, {
      base: [0.3333, -16, 0, 200],
      Tablet: [1, 0, 0, 176],
      Phone: [1, 0, 0, 192],
    });
    corner(b, card, [0, 16]);
    stroke(b, card, LINE, 1);
    const pad = padAll(b, card, [0, 28]);
    b.change(pad, 'Phone', {
      PaddingTop: [0, 24],
      PaddingBottom: [0, 24],
      PaddingLeft: [0, 24],
      PaddingRight: [0, 24],
    });
    const icon = b.add(card, 'Frame', {
      Name: 'Icon',
      Size: [0, 44, 0, 44],
      BackgroundColor3: WHITE,
    });
    corner(b, icon, [0, 12]);
    b.add(icon, 'UIGradient', { Color: colorSequence([129, 140, 248], ACCENT), Rotation: 45 });
    const glyph = b.add(icon, 'Frame', {
      Name: 'Glyph',
      AnchorPoint: [0.5, 0.5],
      Position: [0.5, 0, 0.5, 0],
      Size: [0, 18, 0, 18],
      BackgroundColor3: WHITE,
    });
    corner(b, glyph, [round, round ? 0 : 4]);
    label(b, card, {
      Name: 'Heading',
      HtmlTag: 'h3',
      Position: [0, 0, 0, 64],
      Size: [1, 0, 0, 28],
      Text: heading,
      Font: 'PlusJakartaSans',
      FontWeight: 'Bold',
      TextSize: 20,
      TextColor3: INK,
      TextXAlignment: 'Left',
    });
    label(b, card, {
      Name: 'Body',
      HtmlTag: 'p',
      Position: [0, 0, 0, 100],
      Size: [1, 0, 1, -100],
      Text: body,
      Font: 'PlusJakartaSans',
      TextSize: 16,
      LineHeight: 1.35,
      TextWrapped: true,
      AutomaticSize: 'Y',
      TextColor3: BODY,
      TextXAlignment: 'Left',
      TextYAlignment: 'Top',
    });
  });
}

function addCallToAction(b: Builder, page: InstanceId) {
  const section = b.add(page, 'Frame', {
    Name: 'GetStarted',
    HtmlTag: 'section',
    LayoutOrder: 4,
    BackgroundColor3: WHITE,
  });
  sizeAt(b, section, { base: [1, 0, 0, 360], Phone: [1, 0, 0, 384] });
  b.set(section, { AutomaticSize: 'Y' });
  // The room under the banner, kept when the banner grows.
  const pad = b.add(section, 'UIPadding', { PaddingBottom: [0, 96] });
  b.change(pad, 'Phone', { PaddingBottom: [0, 64] });
  const card = b.add(section, 'Frame', {
    Name: 'Banner',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 0],
    BackgroundColor3: WHITE,
    AutomaticSize: 'Y',
  });
  sizeAt(b, card, { base: [0, 1120, 0, 264], Tablet: [1, -80, 0, 264], Phone: [1, -40, 0, 320] });
  corner(b, card, [0, 24]);
  b.add(card, 'UIGradient', { Color: colorSequence([30, 27, 75], [67, 56, 202]), Rotation: 20 });
  b.add(card, 'UIListLayout', {
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Center',
    Padding: [0, 16],
  });
  const title = label(b, card, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 1,
    Text: 'Ready when your team is.',
    Font: 'PlusJakartaSans',
    FontWeight: 'ExtraBold',
    TextSize: 40,
    LetterSpacing: -1,
    LineHeight: 1.15,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: WHITE,
  });
  sizeAt(b, title, { base: [1, -64, 0, 48], Phone: [1, -48, 0, 76] });
  b.change(title, 'Phone', { TextSize: 30 });
  const sub = label(b, card, {
    Name: 'Subhead',
    HtmlTag: 'p',
    LayoutOrder: 2,
    Text: 'Free for teams of up to 10. No card needed.',
    Font: 'PlusJakartaSans',
    TextSize: 18,
    LineHeight: 1.4,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: [199, 210, 254],
  });
  sizeAt(b, sub, { base: [1, -64, 0, 28], Phone: [1, -48, 0, 52] });
  const button = b.add(card, 'TextButton', {
    Name: 'StartButton',
    LayoutOrder: 3,
    Size: [0, 184, 0, 52],
    AutomaticSize: 'X',
    BackgroundColor3: WHITE,
    Text: 'Start for free',
    Font: 'PlusJakartaSans',
    FontWeight: 'Bold',
    TextSize: 16,
    TextColor3: INK,
  });
  corner(b, button, [0, 12]);
  padX(b, button, 24);
}

function addFooter(b: Builder, page: InstanceId) {
  const footer = b.add(page, 'Frame', {
    Name: 'Footer',
    HtmlTag: 'footer',
    LayoutOrder: 5,
    BackgroundColor3: WHITE,
  });
  sizeAt(b, footer, { base: [1, 0, 0, 88], Phone: [1, 0, 0, 112] });
  b.add(footer, 'Frame', { Name: 'Divider', Size: [1, 0, 0, 1], BackgroundColor3: LINE });
  const bar = column(b, footer, 1120, [1, 0], 'Bar');
  const copy = label(b, bar, {
    Name: 'Copyright',
    AnchorPoint: [0, 0.5],
    Position: [0, 0, 0.5, 0],
    Size: [0, 240, 0, 20],
    Text: '© 2026 Orbit Labs',
    Font: 'PlusJakartaSans',
    TextSize: 14,
    TextColor3: MUTED,
    TextXAlignment: 'Left',
  });
  b.change(copy, 'Phone', {
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 28],
    TextXAlignment: 'Center',
  });
  const links = group(b, bar, {
    Name: 'Links',
    AnchorPoint: [1, 0.5],
    Position: [1, 0, 0.5, 0],
    Size: [0, 240, 0, 20],
  });
  b.change(links, 'Phone', { AnchorPoint: [0.5, 0], Position: [0.5, 0, 0, 64] });
  const row = b.add(links, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Right',
    Padding: [0, 16],
  });
  b.change(row, 'Phone', { HorizontalAlignment: 'Center' });
  ['Privacy', 'Terms', 'Contact'].forEach((text, i) =>
    b.add(links, 'TextButton', {
      Name: `${text}Link`,
      LayoutOrder: i + 1,
      Size: [0, 64, 1, 0],
      BackgroundTransparency: 1,
      Text: text,
      Font: 'PlusJakartaSans',
      FontWeight: 'Medium',
      TextSize: 14,
      TextColor3: MUTED,
    }),
  );
}
