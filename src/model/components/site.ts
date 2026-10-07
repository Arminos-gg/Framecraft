/**
 * Website components: full-width sections (navbar, hero, footer and so on) and blocks that sit
 * inside a section (forms, link lists, badges). Sections center a 1120-pixel column on Desktop
 * and fill the window less a margin on Tablet and Phone, as the website templates do.
 */
import type { Builder } from '../builder.ts';
import type { PropsOf } from '../classes.ts';
import type { InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import { column, group, label, padAll, padX, sizeAt, stroke } from '../templates/kit.ts';
import type { Theme } from './theme.ts';
import type { ComponentDef } from './types.ts';

const WIDTH = 1120;

interface SectionOptions {
  tag?: PropsOf<'Frame'>['HtmlTag'];
  bg?: Color3;
  pad?: number;
  phonePad?: number;
  gap?: number;
}

/** A full-width band that grows with its content, stacking it centered. */
function section(b: Builder, parent: InstanceId, t: Theme, name: string, o: SectionOptions = {}) {
  const id = b.add(parent, 'Frame', {
    Name: name,
    HtmlTag: o.tag ?? 'section',
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
    BackgroundColor3: o.bg ?? t.c.bg,
  });
  const pad = o.pad ?? 96;
  const p = b.add(id, 'UIPadding', { PaddingTop: [0, pad], PaddingBottom: [0, pad] });
  const phone = o.phonePad ?? Math.round(pad * 0.67);
  b.change(p, 'Phone', { PaddingTop: [0, phone], PaddingBottom: [0, phone] });
  b.add(id, 'UIListLayout', { HorizontalAlignment: 'Center', Padding: [0, o.gap ?? 16] });
  return id;
}

/** A section's centered column, growing with its content. */
function content(b: Builder, parent: InstanceId, name = 'Content', order = 0) {
  const id = column(b, parent, WIDTH, [0, 0], name);
  b.set(id, { AutomaticSize: 'Y', LayoutOrder: order });
  return id;
}

/** A heading in the section's middle, a size smaller on Tablet and Phone. */
function heading(b: Builder, parent: InstanceId, t: Theme, text: string, order: number) {
  const id = label(b, parent, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: order,
    Text: text,
    ...t.font.heavy,
    TextSize: 40,
    LineHeight: 1.15,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: t.c.ink,
  });
  sizeAt(b, id, { base: [0, 720, 0, 46], Tablet: [1, -80, 0, 46], Phone: [1, -40, 0, 36] });
  b.change(id, 'Tablet', { TextSize: 36 });
  b.change(id, 'Phone', { TextSize: 30 });
  return id;
}

function paragraph(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  text: string,
  props: Partial<PropsOf<'TextLabel'>> = {},
) {
  return label(b, parent, {
    Name: 'Text',
    HtmlTag: 'p',
    Size: [1, 0, 0, 22],
    AutomaticSize: 'Y',
    Text: text,
    ...t.font.regular,
    TextSize: 16,
    LineHeight: 1.45,
    TextWrapped: true,
    TextColor3: t.c.body,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
    ...props,
  });
}

type ButtonStyle = 'primary' | 'secondary' | 'ghost' | 'danger';

/** A button that grows sideways with its text. */
export function webButton(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  text: string,
  style: ButtonStyle = 'primary',
  props: Partial<PropsOf<'TextButton'>> = {},
) {
  const bg = {
    primary: t.c.accent,
    secondary: t.c.bg,
    ghost: t.c.bg,
    danger: t.c.bad,
  }[style];
  const fg = {
    primary: t.c.onAccent,
    secondary: t.c.ink,
    ghost: t.c.accent,
    danger: [255, 255, 255] as Color3,
  }[style];
  const id = b.add(parent, 'TextButton', {
    Name: name,
    Size: [0, 0, 0, 48],
    AutomaticSize: 'X',
    BackgroundColor3: bg,
    BackgroundTransparency: style === 'ghost' ? 1 : 0,
    Text: text,
    ...t.font.bold,
    TextSize: 16,
    TextColor3: fg,
    ...props,
  });
  t.round(b, id, 10);
  padX(b, id, 22);
  if (style === 'secondary') stroke(b, id, t.c.line, 1, { ApplyStrokeMode: 'Border' });
  return id;
}

/** A row that lays its children side by side, centered, and stacks them on Phone. */
function buttonRow(b: Builder, parent: InstanceId, order: number) {
  const row = group(b, parent, {
    Name: 'Buttons',
    LayoutOrder: order,
    Size: [0, 0, 0, 48],
    AutomaticSize: 'XY',
  });
  b.change(row, 'Phone', { Size: [1, -40, 0, 48], AutomaticSize: 'Y' });
  const list = b.add(row, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0, 12],
  });
  b.change(list, 'Phone', { FillDirection: 'Vertical' });
  return row;
}

/** A small mark for a brand: a rounded square with a ring in it. */
function logoMark(b: Builder, parent: InstanceId, t: Theme, props: Partial<PropsOf<'Frame'>>) {
  const mark = b.add(parent, 'Frame', {
    Name: 'Mark',
    Size: [0, 28, 0, 28],
    BackgroundColor3: t.c.accent,
    ...props,
  });
  t.round(b, mark, 8);
  const ring = group(b, mark, {
    Name: 'Ring',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0, 12, 0, 12],
  });
  t.circle(b, ring);
  stroke(b, ring, t.c.onAccent, 2.5);
  return mark;
}

function navbar(b: Builder, page: InstanceId, t: Theme) {
  const nav = b.add(page, 'Frame', {
    Name: 'Navbar',
    HtmlTag: 'nav',
    Size: [1, 0, 0, 72],
    BackgroundColor3: t.c.bg,
  });
  b.change(nav, 'Phone', { Size: [1, 0, 0, 64] });
  b.add(nav, 'Frame', {
    Name: 'Divider',
    Position: [0, 0, 1, -1],
    Size: [1, 0, 0, 1],
    BackgroundColor3: t.c.line,
  });
  const bar = column(b, nav, WIDTH, [1, 0], 'Bar');
  const logo = group(b, bar, { Name: 'Logo', Size: [0, 130, 1, 0] });
  logoMark(b, logo, t, { AnchorPoint: [0, 0.5], Position: [0, 0, 0.5, 0] });
  label(b, logo, {
    Name: 'Wordmark',
    Position: [0, 38, 0, 0],
    Size: [0, 90, 1, 0],
    Text: 'Brand',
    ...t.font.heavy,
    TextSize: 22,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });

  const links = group(b, bar, {
    Name: 'Links',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0, 0, 0, 40],
    AutomaticSize: 'X',
  });
  b.change(links, 'Phone', { Visible: false });
  b.add(links, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 4],
  });
  ['Features', 'Pricing', 'About'].forEach((text, i) => {
    const id = b.add(links, 'TextButton', {
      Name: `${text}Link`,
      LayoutOrder: i + 1,
      Size: [0, 0, 1, 0],
      AutomaticSize: 'X',
      BackgroundTransparency: 1,
      Text: text,
      ...t.font.medium,
      TextSize: 15,
      TextColor3: t.c.body,
    });
    padX(b, id, 14);
  });

  const actions = group(b, bar, {
    Name: 'Actions',
    AnchorPoint: [1, 0.5],
    Position: [1, 0, 0.5, 0],
    Size: [0, 0, 0, 40],
    AutomaticSize: 'X',
  });
  b.add(actions, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 8],
  });
  const signIn = webButton(b, actions, t, 'SignIn', 'Sign in', 'ghost', {
    LayoutOrder: 1,
    Size: [0, 0, 1, 0],
    TextSize: 15,
    TextColor3: t.c.ink,
  });
  b.change(signIn, 'Tablet', { Visible: false });
  webButton(b, actions, t, 'SignUp', 'Sign up', 'primary', {
    LayoutOrder: 2,
    Size: [0, 0, 1, 0],
    TextSize: 15,
  });
  return nav;
}

function hero(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Hero', { tag: 'header', pad: 112, phonePad: 56, gap: 20 });
  b.add(id, 'UIGradient', {
    Color: colorSequence(t.c.bg, t.c.accentSoft),
    Rotation: 90,
  });
  const badge = label(b, id, {
    Name: 'Badge',
    LayoutOrder: 1,
    Size: [0, 0, 0, 32],
    AutomaticSize: 'X',
    BackgroundTransparency: 0,
    BackgroundColor3: t.c.accentSoft,
    Text: 'New · Say what just launched',
    ...t.font.medium,
    TextSize: 14,
    TextColor3: t.c.accent,
  });
  t.pill(b, badge);
  padX(b, badge, 14);
  const headline = label(b, id, {
    Name: 'Headline',
    HtmlTag: 'h1',
    LayoutOrder: 2,
    Text: 'Say what you make in one clear line',
    ...t.font.heavy,
    TextSize: 68,
    LineHeight: 1.1,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: t.c.ink,
  });
  sizeAt(b, headline, { base: [0, 880, 0, 75], Tablet: [1, -80, 0, 62], Phone: [1, -40, 0, 46] });
  b.change(headline, 'Tablet', { TextSize: 56 });
  b.change(headline, 'Phone', { TextSize: 42 });
  const sub = paragraph(
    b,
    id,
    t,
    'One or two sentences on who it is for and why it helps. Swap this for your own words.',
    { Name: 'Subhead', LayoutOrder: 3, TextSize: 20, LineHeight: 1.4, TextXAlignment: 'Center' },
  );
  sizeAt(b, sub, { base: [0, 620, 0, 28], Tablet: [0, 560, 0, 28], Phone: [1, -40, 0, 28] });
  b.change(sub, 'Phone', { TextSize: 18 });
  const row = buttonRow(b, id, 4);
  b.set(row, { Size: [0, 0, 0, 72] });
  b.add(row, 'UIPadding', { PaddingTop: [0, 20] });
  webButton(b, row, t, 'Primary', 'Get started', 'primary', {
    LayoutOrder: 1,
    Size: [0, 0, 0, 52],
  });
  webButton(b, row, t, 'Secondary', 'Learn more', 'secondary', {
    LayoutOrder: 2,
    Size: [0, 0, 0, 52],
  });
  return id;
}

function iconTile(b: Builder, parent: InstanceId, t: Theme, round: number) {
  const icon = b.add(parent, 'Frame', {
    Name: 'Icon',
    LayoutOrder: 1,
    Size: [0, 44, 0, 44],
    BackgroundColor3: t.c.accent,
  });
  t.round(b, icon, 12);
  const glyph = b.add(icon, 'Frame', {
    Name: 'Glyph',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0, 18, 0, 18],
    BackgroundColor3: t.c.onAccent,
  });
  if (round) b.add(glyph, 'UICorner', { CornerRadius: [round, 0] });
  return icon;
}

/** A row of equal cards side by side, stacked on Tablet and Phone. */
function cardRow(b: Builder, parent: InstanceId, order: number, gap = 24) {
  const row = group(b, parent, { Name: 'Cards', LayoutOrder: order, AutomaticSize: 'Y' });
  sizeAt(b, row, { base: [0, WIDTH, 0, 0], Tablet: [1, -80, 0, 0], Phone: [1, -40, 0, 0] });
  const list = b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, gap] });
  b.change(list, 'Tablet', { FillDirection: 'Vertical', Padding: [0, 16] });
  return row;
}

/** A card in a cardRow: a third of the row on Desktop, the row's width when stacked. */
function card(b: Builder, row: InstanceId, t: Theme, name: string, order: number, pad = 28) {
  const id = b.add(row, 'Frame', {
    Name: name,
    LayoutOrder: order,
    AutomaticSize: 'Y',
    BackgroundColor3: t.c.surface,
  });
  sizeAt(b, id, { base: [0.3333, -16, 0, 0], Tablet: [1, 0, 0, 0] });
  t.round(b, id, 16);
  const outline = stroke(b, id, t.c.line, 1);
  padAll(b, id, [0, pad]);
  b.add(id, 'UIListLayout', { Padding: [0, 12] });
  return { id, outline };
}

function cardTitle(b: Builder, parent: InstanceId, t: Theme, text: string, order: number) {
  return label(b, parent, {
    Name: 'Heading',
    HtmlTag: 'h3',
    LayoutOrder: order,
    Size: [1, 0, 0, 28],
    Text: text,
    ...t.font.bold,
    TextSize: 20,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
}

function eyebrow(b: Builder, parent: InstanceId, t: Theme, text: string) {
  return label(b, parent, {
    Name: 'Eyebrow',
    LayoutOrder: 1,
    Size: [0, 240, 0, 20],
    Text: text,
    ...t.font.bold,
    TextSize: 14,
    TextColor3: t.c.accent,
  });
}

function features(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Features');
  eyebrow(b, id, t, 'FEATURES');
  heading(b, id, t, 'Everything you need, nothing you don’t', 2);
  const row = cardRow(b, id, 3);
  b.add(row, 'UIPadding', { PaddingTop: [0, 32] });
  const items: [string, string, number][] = [
    ['Fast to start', 'Say how the first minutes go. Keep each card to one idea.', 0.5],
    ['Easy to share', 'A second reason to choose you, in a sentence or two.', 0.25],
    ['Built to last', 'A third reason. Three cards read well; four still fit.', 0],
  ];
  items.forEach(([title, body, round], i) => {
    const { id: c } = card(b, row, t, `Feature${i + 1}`, i + 1);
    iconTile(b, c, t, round);
    const h = cardTitle(b, c, t, title, 2);
    b.add(h, 'UIPadding', { PaddingTop: [0, 8] });
    b.set(h, { Size: [1, 0, 0, 36] });
    paragraph(b, c, t, body, { Name: 'Body', LayoutOrder: 3 });
  });
  return id;
}

function stats(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Stats', { pad: 72 });
  const row = group(b, id, { Name: 'Numbers', AutomaticSize: 'Y' });
  sizeAt(b, row, { base: [0, WIDTH, 0, 0], Tablet: [1, -80, 0, 0], Phone: [1, -40, 0, 0] });
  const list = b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 24] });
  b.change(list, 'Phone', { FillDirection: 'Vertical', Padding: [0, 28] });
  const items = [
    ['10k+', 'Happy customers'],
    ['99.9%', 'Uptime last year'],
    ['4.9', 'Average rating'],
    ['24/7', 'Friendly support'],
  ];
  items.forEach(([value, caption], i) => {
    const stat = group(b, row, {
      Name: `Stat${i + 1}`,
      LayoutOrder: i + 1,
      Size: [0.25, -18, 0, 0],
      AutomaticSize: 'Y',
    });
    b.change(stat, 'Phone', { Size: [1, 0, 0, 0] });
    b.add(stat, 'UIListLayout', { HorizontalAlignment: 'Center', Padding: [0, 4] });
    label(b, stat, {
      Name: 'Value',
      LayoutOrder: 1,
      Size: [1, 0, 0, 56],
      Text: value!,
      ...t.font.heavy,
      TextSize: 48,
      TextColor3: t.c.ink,
    });
    label(b, stat, {
      Name: 'Caption',
      LayoutOrder: 2,
      Size: [1, 0, 0, 22],
      Text: caption!,
      ...t.font.medium,
      TextSize: 16,
      TextColor3: t.c.muted,
    });
  });
  return id;
}

function pricing(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Pricing');
  heading(b, id, t, 'Simple pricing', 1);
  const sub = paragraph(b, id, t, 'Start free and upgrade when you need more.', {
    Name: 'Subhead',
    LayoutOrder: 2,
    TextSize: 18,
    TextXAlignment: 'Center',
  });
  sizeAt(b, sub, { base: [0, 620, 0, 26], Phone: [1, -40, 0, 26] });
  const row = cardRow(b, id, 3);
  b.add(row, 'UIPadding', { PaddingTop: [0, 32] });
  const plans: [string, string, string[], boolean][] = [
    ['Free', '$0', ['One project', 'Basic support', 'Community forum'], false],
    ['Pro', '$12', ['Unlimited projects', 'Priority support', 'Custom domain'], true],
    ['Team', '$29', ['Everything in Pro', 'Up to 10 people', 'Shared workspace'], false],
  ];
  plans.forEach(([name, price, perks, popular], i) => {
    const { id: c, outline } = card(b, row, t, `${name}Plan`, i + 1, 32);
    if (popular) {
      b.set(outline, { Color: t.c.accent, Thickness: 2 });
      b.set(c, { BackgroundColor3: t.c.bg });
    }
    const top = group(b, c, { Name: 'Top', LayoutOrder: 1, Size: [1, 0, 0, 28] });
    label(b, top, {
      Name: 'PlanName',
      Size: [0.5, 0, 1, 0],
      Text: name,
      ...t.font.bold,
      TextSize: 18,
      TextColor3: t.c.ink,
      TextXAlignment: 'Left',
    });
    if (popular) {
      const tag = label(b, top, {
        Name: 'Popular',
        AnchorPoint: [1, 0.5],
        Position: [1, 0, 0.5, 0],
        Size: [0, 0, 0, 26],
        AutomaticSize: 'X',
        BackgroundTransparency: 0,
        BackgroundColor3: t.c.accentSoft,
        Text: 'Popular',
        ...t.font.bold,
        TextSize: 13,
        TextColor3: t.c.accent,
      });
      t.pill(b, tag);
      padX(b, tag, 10);
    }
    const priceRow = group(b, c, { Name: 'Price', LayoutOrder: 2, Size: [1, 0, 0, 56] });
    b.add(priceRow, 'UIListLayout', {
      FillDirection: 'Horizontal',
      VerticalAlignment: 'Bottom',
      Padding: [0, 6],
    });
    label(b, priceRow, {
      Name: 'Amount',
      LayoutOrder: 1,
      Size: [0, 0, 0, 52],
      AutomaticSize: 'X',
      Text: price,
      ...t.font.heavy,
      TextSize: 44,
      TextColor3: t.c.ink,
    });
    label(b, priceRow, {
      Name: 'Per',
      LayoutOrder: 2,
      Size: [0, 0, 0, 36],
      AutomaticSize: 'X',
      Text: '/ month',
      ...t.font.medium,
      TextSize: 15,
      TextColor3: t.c.muted,
    });
    const list = group(b, c, {
      Name: 'Perks',
      LayoutOrder: 3,
      Size: [1, 0, 0, 0],
      AutomaticSize: 'Y',
    });
    b.add(list, 'UIListLayout', { Padding: [0, 10] });
    b.add(list, 'UIPadding', { PaddingTop: [0, 8], PaddingBottom: [0, 16] });
    perks.forEach((perk, n) =>
      label(b, list, {
        Name: `Perk${n + 1}`,
        LayoutOrder: n + 1,
        Size: [1, 0, 0, 22],
        Text: `✓  ${perk}`,
        ...t.font.regular,
        TextSize: 16,
        TextColor3: t.c.body,
        TextXAlignment: 'Left',
      }),
    );
    webButton(b, c, t, 'ChooseButton', `Choose ${name}`, popular ? 'primary' : 'secondary', {
      LayoutOrder: 4,
      Size: [1, 0, 0, 48],
      AutomaticSize: 'None',
    });
  });
  return id;
}

function testimonial(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Testimonial', { gap: 28, bg: t.c.surface });
  const quote = label(b, id, {
    Name: 'Quote',
    HtmlTag: 'p',
    LayoutOrder: 1,
    Text: '“A quote from a happy customer goes here. Keep it short and specific, two lines at most.”',
    ...t.font.medium,
    TextSize: 28,
    LineHeight: 1.35,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: t.c.ink,
  });
  sizeAt(b, quote, { base: [0, 760, 0, 38], Tablet: [1, -80, 0, 38], Phone: [1, -40, 0, 30] });
  b.change(quote, 'Phone', { TextSize: 22 });
  const person = group(b, id, {
    Name: 'Person',
    LayoutOrder: 2,
    Size: [0, 0, 0, 52],
    AutomaticSize: 'X',
  });
  b.add(person, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 14],
  });
  const avatar = b.add(person, 'Frame', {
    Name: 'Avatar',
    LayoutOrder: 1,
    Size: [0, 52, 0, 52],
    BackgroundColor3: [255, 255, 255],
  });
  t.circle(b, avatar);
  b.add(avatar, 'UIGradient', { Color: colorSequence(t.c.accent, t.c.purple), Rotation: 135 });
  label(b, avatar, {
    Name: 'Initials',
    Size: [1, 0, 1, 0],
    Text: 'AB',
    ...t.font.bold,
    TextSize: 18,
    TextColor3: [255, 255, 255],
  });
  const who = group(b, person, { Name: 'Who', LayoutOrder: 2, Size: [0, 0, 0, 44] });
  b.set(who, { AutomaticSize: 'X' });
  b.add(who, 'UIListLayout', { Padding: [0, 2] });
  label(b, who, {
    Name: 'Name',
    LayoutOrder: 1,
    Size: [0, 0, 0, 22],
    AutomaticSize: 'X',
    Text: 'Alex Brown',
    ...t.font.bold,
    TextSize: 16,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  label(b, who, {
    Name: 'Role',
    LayoutOrder: 2,
    Size: [0, 0, 0, 20],
    AutomaticSize: 'X',
    Text: 'Their role, Their company',
    ...t.font.regular,
    TextSize: 14,
    TextColor3: t.c.muted,
    TextXAlignment: 'Left',
  });
  return id;
}

function logos(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Logos', { pad: 56, gap: 24 });
  label(b, id, {
    Name: 'Caption',
    LayoutOrder: 1,
    Size: [0, 400, 0, 20],
    Text: 'Trusted by teams at',
    ...t.font.medium,
    TextSize: 15,
    TextColor3: t.c.muted,
  });
  const row = group(b, id, { Name: 'Row', LayoutOrder: 2 });
  sizeAt(b, row, { base: [0, 920, 0, 44], Tablet: [1, -80, 0, 44], Phone: [1, -40, 0, 36] });
  b.add(row, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0.025, 0],
  });
  for (let i = 1; i <= 5; i++) {
    const logo = label(b, row, {
      Name: `Logo${i}`,
      LayoutOrder: i,
      Size: [0.18, 0, 1, 0],
      BackgroundTransparency: 0,
      BackgroundColor3: t.c.raised,
      Text: 'Logo',
      ...t.font.heavy,
      TextSize: 18,
      TextColor3: t.c.muted,
    });
    b.change(logo, 'Phone', { TextSize: 14 });
    t.round(b, logo, 8);
  }
  return id;
}

function callToAction(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'CallToAction', { bg: t.c.accent, pad: 72, gap: 12 });
  const title = label(b, id, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 1,
    Text: 'Ready to get started?',
    ...t.font.heavy,
    TextSize: 40,
    LineHeight: 1.15,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: t.c.onAccent,
  });
  sizeAt(b, title, { base: [0, 720, 0, 46], Tablet: [1, -80, 0, 46], Phone: [1, -40, 0, 36] });
  b.change(title, 'Phone', { TextSize: 30 });
  const sub = paragraph(b, id, t, 'One line on what happens next. No card needed.', {
    Name: 'Subhead',
    LayoutOrder: 2,
    TextSize: 18,
    TextColor3: t.c.onAccent,
    TextTransparency: 0.15,
    TextXAlignment: 'Center',
  });
  sizeAt(b, sub, { base: [0, 620, 0, 26], Phone: [1, -40, 0, 26] });
  const row = buttonRow(b, id, 3);
  b.set(row, { Size: [0, 0, 0, 64] });
  b.add(row, 'UIPadding', { PaddingTop: [0, 16] });
  webButton(b, row, t, 'StartButton', 'Get started', 'secondary', {
    LayoutOrder: 1,
    BackgroundColor3: t.c.onAccent,
    TextColor3: t.c.accent,
  });
  return id;
}

function faq(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Faq', { gap: 32 });
  heading(b, id, t, 'Questions and answers', 1);
  const list = group(b, id, { Name: 'Questions', LayoutOrder: 2, AutomaticSize: 'Y' });
  sizeAt(b, list, { base: [0, 760, 0, 0], Tablet: [1, -80, 0, 0], Phone: [1, -40, 0, 0] });
  b.add(list, 'UIListLayout', { Padding: [0, 12] });
  const items = [
    ['How do I get started?', 'Answer the question in a sentence or two. Link to more if needed.'],
    ['Can I change plans later?', 'Yes. Say how, and what happens to what people already made.'],
    ['Do you offer refunds?', 'Say what your policy is in plain words.'],
    ['How do I get help?', 'Say where to write and how fast you answer.'],
  ];
  items.forEach(([q, a], i) => {
    const row = b.add(list, 'Frame', {
      Name: `Question${i + 1}`,
      LayoutOrder: i + 1,
      Size: [1, 0, 0, 0],
      AutomaticSize: 'Y',
      BackgroundColor3: t.c.surface,
    });
    t.round(b, row, 12);
    stroke(b, row, t.c.line, 1);
    padAll(b, row, [0, 20]);
    b.add(row, 'UIListLayout', { Padding: [0, 6] });
    label(b, row, {
      Name: 'Question',
      HtmlTag: 'h3',
      LayoutOrder: 1,
      Size: [1, 0, 0, 24],
      AutomaticSize: 'Y',
      Text: q!,
      ...t.font.bold,
      TextSize: 17,
      TextWrapped: true,
      TextColor3: t.c.ink,
      TextXAlignment: 'Left',
    });
    paragraph(b, row, t, a!, { Name: 'Answer', LayoutOrder: 2 });
  });
  return id;
}

/** A label and a box to type in, stacked. */
function field(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  text: string,
  placeholder: string,
  order: number,
  height = 44,
) {
  const wrap = group(b, parent, {
    Name: name,
    LayoutOrder: order,
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
  });
  b.add(wrap, 'UIListLayout', { Padding: [0, 6] });
  label(b, wrap, {
    Name: 'Label',
    LayoutOrder: 1,
    Size: [1, 0, 0, 20],
    Text: text,
    ...t.font.medium,
    TextSize: 14,
    TextColor3: t.c.body,
    TextXAlignment: 'Left',
  });
  const box = b.add(wrap, 'TextBox', {
    Name: 'Box',
    LayoutOrder: 2,
    Size: [1, 0, 0, height],
    BackgroundColor3: t.c.bg,
    Text: '',
    PlaceholderText: placeholder,
    ...t.font.regular,
    TextSize: 16,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
    TextYAlignment: height > 50 ? 'Top' : 'Center',
    TextWrapped: height > 50,
  });
  t.round(b, box, 10);
  stroke(b, box, t.c.line, 1, { ApplyStrokeMode: 'Border' });
  b.add(box, 'UIPadding', {
    PaddingLeft: [0, 14],
    PaddingRight: [0, 14],
    PaddingTop: [0, height > 50 ? 12 : 0],
  });
  return wrap;
}

/** A rounded card that holds a form, as wide as its section's column at most. */
function formCard(b: Builder, parent: InstanceId, t: Theme, name: string, width: number) {
  const id = b.add(parent, 'Frame', {
    Name: name,
    AutomaticSize: 'Y',
    BackgroundColor3: t.c.surface,
  });
  sizeAt(b, id, { base: [0, width, 0, 0], Phone: [1, -40, 0, 0] });
  t.round(b, id, 16);
  stroke(b, id, t.c.line, 1);
  padAll(b, id, [0, 28]);
  b.add(id, 'UIListLayout', { Padding: [0, 16] });
  return id;
}

function contactForm(b: Builder, parent: InstanceId, t: Theme) {
  const id = formCard(b, parent, t, 'ContactForm', 560);
  label(b, id, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 1,
    Size: [1, 0, 0, 32],
    Text: 'Get in touch',
    ...t.font.heavy,
    TextSize: 26,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  field(b, id, t, 'NameField', 'Name', 'Your name', 2);
  field(b, id, t, 'EmailField', 'Email', 'you@example.com', 3);
  field(b, id, t, 'MessageField', 'Message', 'How can we help?', 4, 120);
  webButton(b, id, t, 'SendButton', 'Send message', 'primary', { LayoutOrder: 5 });
  return id;
}

function newsletter(b: Builder, parent: InstanceId, t: Theme) {
  const id = formCard(b, parent, t, 'Newsletter', 560);
  label(b, id, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 1,
    Size: [1, 0, 0, 32],
    Text: 'Get the newsletter',
    ...t.font.heavy,
    TextSize: 26,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  paragraph(b, id, t, 'One email a month with what’s new. Unsubscribe any time.', {
    Name: 'Subhead',
    LayoutOrder: 2,
  });
  const row = group(b, id, { Name: 'Signup', LayoutOrder: 3, Size: [1, 0, 0, 48] });
  b.change(row, 'Phone', { Size: [1, 0, 0, 108] });
  const list = b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 12] });
  b.change(list, 'Phone', { FillDirection: 'Vertical' });
  const box = b.add(row, 'TextBox', {
    Name: 'EmailBox',
    LayoutOrder: 1,
    Size: [1, -132, 1, 0],
    BackgroundColor3: t.c.bg,
    Text: '',
    PlaceholderText: 'you@example.com',
    ...t.font.regular,
    TextSize: 16,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  b.change(box, 'Phone', { Size: [1, 0, 0, 48] });
  t.round(b, box, 10);
  stroke(b, box, t.c.line, 1, { ApplyStrokeMode: 'Border' });
  padX(b, box, 14);
  const join = webButton(b, row, t, 'JoinButton', 'Join', 'primary', {
    LayoutOrder: 2,
    Size: [0, 120, 1, 0],
    AutomaticSize: 'None',
  });
  b.change(join, 'Phone', { Size: [1, 0, 0, 48] });
  return id;
}

function footer(b: Builder, page: InstanceId, t: Theme) {
  const id = section(b, page, t, 'Footer', { tag: 'footer', pad: 64, gap: 40, bg: t.c.surface });
  b.add(id, 'Frame', {
    Name: 'Divider',
    LayoutOrder: 0,
    Size: [1, 0, 0, 1],
    BackgroundColor3: t.c.line,
  });
  const cols = content(b, id, 'Columns', 1);
  const list = b.add(cols, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 24] });
  b.change(list, 'Phone', { FillDirection: 'Vertical', Padding: [0, 32] });
  const brand = group(b, cols, {
    Name: 'Brand',
    LayoutOrder: 1,
    Size: [0.4, -18, 0, 0],
    AutomaticSize: 'Y',
  });
  b.change(brand, 'Phone', { Size: [1, 0, 0, 0] });
  b.add(brand, 'UIListLayout', { Padding: [0, 12] });
  const logo = group(b, brand, { Name: 'Logo', LayoutOrder: 1, Size: [1, 0, 0, 28] });
  logoMark(b, logo, t, {});
  label(b, logo, {
    Name: 'Wordmark',
    Position: [0, 38, 0, 0],
    Size: [0, 120, 1, 0],
    Text: 'Brand',
    ...t.font.heavy,
    TextSize: 20,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  paragraph(b, brand, t, 'One line on what you do.', { Name: 'Tagline', LayoutOrder: 2 });
  const columns: [string, string[]][] = [
    ['Product', ['Features', 'Pricing', 'Changelog']],
    ['Company', ['About', 'Blog', 'Careers']],
    ['Help', ['Contact', 'Docs', 'Privacy']],
  ];
  columns.forEach(([title, links], i) => {
    const col = group(b, cols, {
      Name: title,
      LayoutOrder: i + 2,
      Size: [0.2, -18, 0, 0],
      AutomaticSize: 'Y',
    });
    b.change(col, 'Phone', { Size: [1, 0, 0, 0] });
    b.add(col, 'UIListLayout', { Padding: [0, 10] });
    label(b, col, {
      Name: 'Heading',
      LayoutOrder: 0,
      Size: [1, 0, 0, 22],
      Text: title,
      ...t.font.bold,
      TextSize: 15,
      TextColor3: t.c.ink,
      TextXAlignment: 'Left',
    });
    links.forEach((text, n) =>
      b.add(col, 'TextButton', {
        Name: `${text}Link`,
        LayoutOrder: n + 1,
        Size: [1, 0, 0, 20],
        BackgroundTransparency: 1,
        Text: text,
        ...t.font.regular,
        TextSize: 15,
        TextColor3: t.c.muted,
        TextXAlignment: 'Left',
      }),
    );
  });
  const small = content(b, id, 'SmallPrint', 2);
  label(b, small, {
    Name: 'Copyright',
    Size: [1, 0, 0, 20],
    Text: '© 2026 Your company',
    ...t.font.regular,
    TextSize: 14,
    TextColor3: t.c.muted,
    TextXAlignment: 'Left',
  });
  return id;
}

function linkList(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, { Name: 'LinkList', AutomaticSize: 'Y' });
  sizeAt(b, id, { base: [0, 440, 0, 0], Phone: [1, -40, 0, 0] });
  b.add(id, 'UIListLayout', { Padding: [0, 12] });
  [
    'Read the latest post',
    'Watch the new video',
    'Shop the collection',
    'Join the newsletter',
  ].forEach((text, i) => {
    const featured = i === 0;
    const link = b.add(id, 'TextButton', {
      Name: `Link${i + 1}`,
      LayoutOrder: i + 1,
      Size: [1, 0, 0, 56],
      BackgroundColor3: featured ? t.c.accent : t.c.surface,
      Text: text,
      ...t.font.bold,
      TextSize: 16,
      TextColor3: featured ? t.c.onAccent : t.c.ink,
      Link: { kind: 'url', url: 'https://example.com/', newTab: true },
    });
    t.round(b, link, 16);
    if (!featured) stroke(b, link, t.c.line, 1, { ApplyStrokeMode: 'Border' });
  });
  return id;
}

function badges(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, { Name: 'Badges', Size: [0, 0, 0, 28], AutomaticSize: 'X' });
  b.add(id, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 8],
  });
  const items: [string, Color3, Color3][] = [
    ['New', t.c.accentSoft, t.c.accent],
    ['Sale', t.c.bad, [255, 255, 255]],
    ['Design', t.c.raised, t.c.body],
  ];
  items.forEach(([text, bg, fg], i) => {
    const badge = label(b, id, {
      Name: `${text}Badge`,
      LayoutOrder: i + 1,
      Size: [0, 0, 1, 0],
      AutomaticSize: 'X',
      BackgroundTransparency: 0,
      BackgroundColor3: bg,
      Text: text,
      ...t.font.bold,
      TextSize: 13,
      TextColor3: fg,
    });
    t.pill(b, badge);
    padX(b, badge, 12);
  });
  return id;
}

export const SITE_COMPONENTS: readonly ComponentDef[] = [
  {
    id: 'navbar',
    name: 'Navbar',
    kind: 'site',
    category: 'Navigation',
    place: 'section',
    summary: 'Logo, page links and a sign-up button',
    description:
      'A bar for the top of every page: your logo, three page links and two buttons. Phone hides the links and Tablet the Sign in button.',
    build: navbar,
  },
  {
    id: 'hero',
    name: 'Hero',
    kind: 'site',
    category: 'Heroes',
    place: 'section',
    summary: 'Big headline, subline and two buttons',
    description:
      'The first thing visitors see: a badge, a large headline, one line under it and two buttons. The headline and text shrink on Tablet and Phone, and the buttons stack on Phone.',
    build: hero,
  },
  {
    id: 'cta',
    name: 'Call-to-action band',
    kind: 'site',
    category: 'Heroes',
    place: 'section',
    summary: 'Colored band with one line and a button',
    description:
      'A full-width band in your accent color with a title, a line and a button, for the end of a page.',
    build: callToAction,
  },
  {
    id: 'features',
    name: 'Feature grid',
    kind: 'site',
    category: 'Features',
    place: 'section',
    summary: 'Three cards with icon, title and text',
    description:
      'A title over three cards side by side, each with an icon, a short heading and a line or two of text. The cards stack on Tablet and Phone.',
    build: features,
  },
  {
    id: 'stats',
    name: 'Stats row',
    kind: 'site',
    category: 'Features',
    place: 'section',
    summary: 'Four big numbers with captions',
    description: 'Four big numbers in a row, each with a caption under it. They stack on Phone.',
    build: stats,
  },
  {
    id: 'pricing',
    name: 'Pricing table',
    kind: 'site',
    category: 'Pricing',
    place: 'section',
    summary: 'Three plans, the middle one highlighted',
    description:
      'Three plans with a name, a price, a short list of what you get and a button. The middle plan is outlined and marked Popular. The plans stack on Tablet and Phone.',
    build: pricing,
  },
  {
    id: 'testimonial',
    name: 'Testimonial',
    kind: 'site',
    category: 'Social proof',
    place: 'section',
    summary: 'A quote with a name and picture',
    description:
      'A quote from a customer, with their name, their role and a round picture with initials.',
    build: testimonial,
  },
  {
    id: 'logos',
    name: 'Logo strip',
    kind: 'site',
    category: 'Social proof',
    place: 'section',
    summary: 'A row of customer logos',
    description:
      'Five logo spots under a “Trusted by” line. Swap each spot for an ImageLabel with the logo from your pictures.',
    build: logos,
  },
  {
    id: 'faq',
    name: 'FAQ',
    kind: 'site',
    category: 'Content',
    place: 'section',
    summary: 'Questions with their answers',
    description: 'Four common questions, each in a card with its answer underneath.',
    lookOnly:
      'Opening and closing answers needs a script, which the export doesn’t write yet, so every answer shows.',
    build: faq,
  },
  {
    id: 'badges',
    name: 'Badges',
    kind: 'site',
    category: 'Content',
    place: 'block',
    summary: 'Small pill labels: New, Sale, a category',
    description: 'Three small labels in a row. Each grows with its text, so rename them freely.',
    build: badges,
  },
  {
    id: 'contact',
    name: 'Contact form',
    kind: 'site',
    category: 'Forms',
    place: 'block',
    summary: 'Name, email, message and Send',
    description: 'A card with name, email and message boxes and a Send button.',
    lookOnly:
      'Sending needs a form service address, which Framecraft doesn’t ask for yet, so Send does nothing on the exported site.',
    build: contactForm,
  },
  {
    id: 'newsletter',
    name: 'Newsletter signup',
    kind: 'site',
    category: 'Forms',
    place: 'block',
    summary: 'One email box and a Join button',
    description:
      'A card with a title, a line, an email box and a Join button, which stack on Phone.',
    lookOnly:
      'Signing up needs a form service address, which Framecraft doesn’t ask for yet, so Join does nothing on the exported site.',
    build: newsletter,
  },
  {
    id: 'links',
    name: 'Link list',
    kind: 'site',
    category: 'Navigation',
    place: 'block',
    summary: 'Stacked buttons that open links',
    description:
      'Four wide buttons that open links in a new tab, the first one filled, as on a link-in-bio page. Set each Link in Properties.',
    build: linkList,
  },
  {
    id: 'footer',
    name: 'Footer',
    kind: 'site',
    category: 'Navigation',
    place: 'section',
    summary: 'Link columns and small print',
    description:
      'Your logo and a line, three columns of links and the small print, for the bottom of every page. The columns stack on Phone.',
    build: footer,
  },
];
