/**
 * A designer's portfolio: a header, an introduction, a grid of four projects, an about
 * section, a contact band and a footer. Phone stacks the grid into one column.
 */
import { Builder, pageSubtree } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import { column, corner, group, label, padX, sizeAt } from './kit.ts';

const PAPER: Color3 = [246, 244, 239];
const SAND: Color3 = [238, 234, 226];
const INK: Color3 = [28, 28, 28];
const BODY: Color3 = [74, 74, 74];
const MUTED: Color3 = [128, 124, 118];
const ACCENT: Color3 = [196, 82, 50];
const WHITE: Color3 = [255, 255, 255];

export function portfolioTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const home = b.addSubtree(
    b.site,
    pageSubtree(
      {
        Name: 'Home',
        Path: '/',
        Title: 'Mara Lindqvist · Product designer',
        Description:
          'Product designer in Stockholm. Selected work, about me and how to get in touch.',
        BackgroundColor3: PAPER,
      },
      makeId,
    ),
  );
  const links = addHeader(b, home);
  addIntro(b, home);
  addWork(b, home);
  addAbout(b, home);
  addContact(b, home);
  addFooter(b, home);
  for (const [id, section] of links) b.set(id, { Link: { kind: 'page', page: home, section } });
  return b.doc;
}

function addHeader(b: Builder, page: InstanceId) {
  const header = b.add(page, 'Frame', {
    Name: 'Header',
    HtmlTag: 'nav',
    LayoutOrder: 1,
    BackgroundColor3: PAPER,
  });
  sizeAt(b, header, { base: [1, 0, 0, 88], Phone: [1, 0, 0, 72] });
  const bar = column(b, header, 1120, [1, 0], 'Bar');
  const name = label(b, bar, {
    Name: 'Name',
    Size: [0, 220, 1, 0],
    Text: 'Mara Lindqvist',
    Font: 'Merriweather',
    TextSize: 20,
    TextColor3: INK,
    TextXAlignment: 'Left',
  });
  b.change(name, 'Phone', { Size: [0, 150, 1, 0], TextSize: 16 });
  const links = group(b, bar, {
    Name: 'Links',
    AnchorPoint: [1, 0.5],
    Position: [1, 0, 0.5, 0],
    Size: [0, 240, 0, 36],
  });
  b.change(links, 'Phone', { Size: [0, 190, 0, 36] });
  const row = b.add(links, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Right',
    Padding: [0, 8],
  });
  b.change(row, 'Phone', { Padding: [0, 2] });
  return (['Work', 'About', 'Contact'] as const).map((text, i) => {
    const id = b.add(links, 'TextButton', {
      Name: `${text}Link`,
      LayoutOrder: i + 1,
      Size: [0, 72, 1, 0],
      BackgroundTransparency: 1,
      Text: text,
      Font: 'SourceSansSemibold',
      TextSize: 17,
      TextColor3: INK,
    });
    b.change(id, 'Phone', { Size: [0, 62, 1, 0], TextSize: 16 });
    return [id, text.toLowerCase()] as const;
  });
}

function addIntro(b: Builder, page: InstanceId) {
  const intro = b.add(page, 'Frame', {
    Name: 'Intro',
    HtmlTag: 'header',
    LayoutOrder: 2,
    BackgroundTransparency: 1,
    AutomaticSize: 'Y',
  });
  sizeAt(b, intro, { base: [1, 0, 0, 440], Tablet: [1, 0, 0, 410], Phone: [1, 0, 0, 348] });
  const pad = b.add(intro, 'UIPadding', { PaddingTop: [0, 104], PaddingBottom: [0, 80] });
  b.change(pad, 'Tablet', { PaddingBottom: [0, 74] });
  b.change(pad, 'Phone', { PaddingTop: [0, 40], PaddingBottom: [0, 40] });
  const content = column(b, intro, 1120);
  b.set(content, { AutomaticSize: 'Y' });
  b.add(content, 'UIListLayout', { Padding: [0, 24] });
  label(b, content, {
    Name: 'Kicker',
    LayoutOrder: 1,
    Size: [1, 0, 0, 24],
    Text: 'Product designer · Stockholm',
    Font: 'SourceSansSemibold',
    TextSize: 17,
    TextColor3: ACCENT,
    TextXAlignment: 'Left',
  });
  const headline = label(b, content, {
    Name: 'Headline',
    HtmlTag: 'h1',
    LayoutOrder: 2,
    Text: 'I design calm, useful products for people who are short on time.',
    Font: 'Merriweather',
    TextSize: 52,
    LineHeight: 1.2,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: INK,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
  sizeAt(b, headline, { base: [0, 940, 0, 128], Tablet: [1, 0, 0, 104], Phone: [1, 0, 0, 120] });
  b.change(headline, 'Tablet', { TextSize: 40 });
  b.change(headline, 'Phone', { TextSize: 30 });
  const sub = label(b, content, {
    Name: 'Subhead',
    HtmlTag: 'p',
    LayoutOrder: 3,
    Text: 'Currently leading design at Northwind. Before that, eight years of apps, brands and the odd board game.',
    Font: 'SourceSans',
    TextSize: 20,
    LineHeight: 1.4,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: BODY,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
  sizeAt(b, sub, { base: [0, 620, 0, 56], Phone: [1, 0, 0, 76] });
  b.change(sub, 'Phone', { TextSize: 18 });
}

interface Project {
  name: string;
  meta: string;
  light: Color3;
  dark: Color3;
  device: 'phone' | 'web';
}

const PROJECTS: Project[] = [
  {
    name: 'Northwind app',
    meta: 'Mobile app · 2025',
    light: [236, 219, 199],
    dark: [176, 124, 82],
    device: 'phone',
  },
  {
    name: 'Tidewater Bank',
    meta: 'Web app · 2024',
    light: [205, 223, 214],
    dark: [74, 120, 104],
    device: 'web',
  },
  {
    name: 'Fern Health',
    meta: 'Design system · 2023',
    light: [218, 216, 239],
    dark: [102, 96, 170],
    device: 'web',
  },
  {
    name: 'Kiln Ceramics',
    meta: 'Online shop · 2022',
    light: [242, 211, 199],
    dark: [184, 96, 72],
    device: 'phone',
  },
];

function addWork(b: Builder, page: InstanceId) {
  const work = b.add(page, 'Frame', {
    Name: 'Work',
    HtmlTag: 'section',
    LayoutOrder: 3,
    BackgroundTransparency: 1,
  });
  sizeAt(b, work, { base: [1, 0, 0, 1096], Tablet: [1, 0, 0, 928], Phone: [1, 0, 0, 1488] });
  const pad = b.add(work, 'UIPadding', { PaddingTop: [0, 40] });
  b.change(pad, 'Phone', { PaddingTop: [0, 24] });
  const content = column(b, work, 1120);
  const list = b.add(content, 'UIListLayout', { Padding: [0, 32] });
  b.change(list, 'Phone', { Padding: [0, 24] });

  const heading = group(b, content, { Name: 'Heading', LayoutOrder: 1, Size: [1, 0, 0, 48] });
  const title = label(b, heading, {
    Name: 'Title',
    HtmlTag: 'h2',
    Size: [0.6, 0, 1, 0],
    Text: 'Selected work',
    Font: 'Merriweather',
    TextSize: 34,
    TextColor3: INK,
    TextXAlignment: 'Left',
  });
  b.change(title, 'Phone', { Size: [1, 0, 1, 0], TextSize: 28 });
  const years = label(b, heading, {
    Name: 'Years',
    AnchorPoint: [1, 0],
    Position: [1, 0, 0, 0],
    Size: [0.4, 0, 1, 0],
    Text: 'Case studies, 2019 to 2026',
    Font: 'SourceSans',
    TextSize: 17,
    TextColor3: MUTED,
    TextXAlignment: 'Right',
  });
  b.change(years, 'Phone', { Visible: false });

  const grid = group(b, content, { Name: 'Projects', LayoutOrder: 2 });
  sizeAt(b, grid, { base: [1, 0, 0, 880], Tablet: [1, 0, 0, 712], Phone: [1, 0, 0, 1352] });
  const rows = b.add(grid, 'UIListLayout', { Padding: [0, 40] });
  b.change(rows, 'Tablet', { Padding: [0, 32] });
  b.change(rows, 'Phone', { Padding: [0, 24] });
  for (let r = 0; r < 2; r++) {
    const row = group(b, grid, { Name: `Row${r + 1}`, LayoutOrder: r + 1 });
    sizeAt(b, row, { base: [1, 0, 0, 420], Tablet: [1, 0, 0, 340], Phone: [1, 0, 0, 664] });
    const cols = b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 40] });
    b.change(cols, 'Tablet', { Padding: [0, 32] });
    b.change(cols, 'Phone', { FillDirection: 'Vertical', Padding: [0, 24] });
    for (let c = 0; c < 2; c++) addProject(b, row, PROJECTS[r * 2 + c]!, c + 1);
  }
}

function addProject(b: Builder, row: InstanceId, p: Project, order: number) {
  const card = group(b, row, { Name: p.name.replace(/\s/g, ''), LayoutOrder: order });
  sizeAt(b, card, {
    base: [0.5, -20, 1, 0],
    Tablet: [0.5, -16, 1, 0],
    Phone: [1, 0, 0.5, -12],
  });
  const cover = b.add(card, 'Frame', {
    Name: 'Cover',
    Size: [1, 0, 1, -76],
    BackgroundColor3: WHITE,
    ClipsDescendants: true,
  });
  corner(b, cover, [0, 14]);
  b.add(cover, 'UIGradient', { Color: colorSequence(p.light, PAPER), Rotation: 135 });

  // A drawing of the project on its device, cut off by the bottom of the cover.
  const phone = p.device === 'phone';
  const screen = b.add(cover, 'Frame', {
    Name: 'Screen',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0.16, 0],
    Size: phone ? [0.36, 0, 1, 0] : [0.76, 0, 1, 0],
    BackgroundColor3: WHITE,
    ClipsDescendants: true,
  });
  corner(b, screen, [0, phone ? 22 : 12]);
  b.add(screen, 'Frame', {
    Name: 'Banner',
    Size: [1, 0, 0.3, 0],
    BackgroundColor3: p.dark,
    BackgroundTransparency: 0.1,
  });
  const bars: [number, number][] = phone
    ? [
        [0.36, 0.7],
        [0.42, 0.5],
        [0.5, 0.62],
      ]
    : [
        [0.38, 0.4],
        [0.44, 0.6],
        [0.5, 0.3],
      ];
  bars.forEach(([y, w], i) => {
    const bar = b.add(screen, 'Frame', {
      Name: `Line${i + 1}`,
      Position: [0.1, 0, y, 0],
      Size: [w, 0, 0.025, 0],
      BackgroundColor3: i ? [228, 224, 216] : p.dark,
    });
    corner(b, bar, [0.5, 0]);
  });

  label(b, card, {
    Name: 'Title',
    HtmlTag: 'h3',
    Position: [0, 0, 1, -60],
    Size: [1, 0, 0, 28],
    Text: p.name,
    Font: 'SourceSansSemibold',
    TextSize: 21,
    TextColor3: INK,
    TextXAlignment: 'Left',
  });
  label(b, card, {
    Name: 'Meta',
    Position: [0, 0, 1, -30],
    Size: [1, 0, 0, 22],
    Text: p.meta,
    Font: 'SourceSans',
    TextSize: 17,
    TextColor3: MUTED,
    TextXAlignment: 'Left',
  });
}

function addAbout(b: Builder, page: InstanceId) {
  const about = b.add(page, 'Frame', {
    Name: 'About',
    HtmlTag: 'section',
    LayoutOrder: 4,
    BackgroundColor3: SAND,
    AutomaticSize: 'Y',
  });
  sizeAt(b, about, { base: [1, 0, 0, 640], Tablet: [1, 0, 0, 600], Phone: [1, 0, 0, 808] });
  const pad = b.add(about, 'UIPadding', { PaddingTop: [0, 96], PaddingBottom: [0, 96] });
  b.change(pad, 'Phone', { PaddingTop: [0, 64], PaddingBottom: [0, 64] });
  const content = column(b, about, 1120);
  b.set(content, { AutomaticSize: 'Y' });
  const cols = b.add(content, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 64] });
  b.change(cols, 'Tablet', { Padding: [0, 40] });
  b.change(cols, 'Phone', { FillDirection: 'Vertical', Padding: [0, 32] });

  const portrait = b.add(content, 'Frame', {
    Name: 'Portrait',
    LayoutOrder: 1,
    BackgroundColor3: WHITE,
  });
  sizeAt(b, portrait, { base: [0, 400, 1, 0], Tablet: [0.42, 0, 1, 0], Phone: [1, 0, 0, 360] });
  corner(b, portrait, [0, 16]);
  b.add(portrait, 'UIGradient', {
    Color: colorSequence([226, 170, 128], [128, 76, 62]),
    Rotation: 120,
  });
  label(b, portrait, {
    Name: 'Initials',
    Size: [1, 0, 1, 0],
    Text: 'ML',
    Font: 'Merriweather',
    TextSize: 96,
    TextColor3: WHITE,
    TextTransparency: 0.15,
  });

  const text = group(b, content, { Name: 'Text', LayoutOrder: 2, AutomaticSize: 'Y' });
  sizeAt(b, text, {
    base: [1, -464, 1, 0],
    Tablet: [0.58, -40, 1, 0],
    Phone: [1, 0, 0, 288],
  });
  const lines = b.add(text, 'UIListLayout', { VerticalAlignment: 'Center', Padding: [0, 20] });
  b.change(lines, 'Phone', { VerticalAlignment: 'Top' });
  label(b, text, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 1,
    Size: [1, 0, 0, 44],
    Text: 'About',
    Font: 'Merriweather',
    TextSize: 34,
    TextColor3: INK,
    TextXAlignment: 'Left',
  });
  // Paragraphs are as tall as their text.
  const paragraph = (name: string, order: number, body: string) =>
    label(b, text, {
      Name: name,
      HtmlTag: 'p',
      LayoutOrder: order,
      Size: [1, 0, 0, 0],
      AutomaticSize: 'Y',
      Text: body,
      Font: 'SourceSans',
      TextSize: 19,
      LineHeight: 1.4,
      TextWrapped: true,
      TextColor3: BODY,
      TextXAlignment: 'Left',
      TextYAlignment: 'Top',
    });
  paragraph(
    'Story',
    2,
    "I've spent eight years turning messy problems into products people enjoy using. I work best close to engineers, with real data and short feedback loops.",
  );
  paragraph(
    'Outside',
    3,
    'Outside work I teach an interaction design course and make slightly wonky pottery.',
  );
  label(b, text, {
    Name: 'Clients',
    LayoutOrder: 4,
    Size: [1, 0, 0, 0],
    AutomaticSize: 'Y',
    Text: 'Clients include Northwind, Tidewater Bank, Fern Health and Kiln.',
    Font: 'SourceSansSemibold',
    TextSize: 16,
    LineHeight: 1.4,
    TextWrapped: true,
    TextColor3: MUTED,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
}

function addContact(b: Builder, page: InstanceId) {
  const contact = b.add(page, 'Frame', {
    Name: 'Contact',
    HtmlTag: 'section',
    LayoutOrder: 5,
    BackgroundColor3: INK,
    AutomaticSize: 'Y',
  });
  sizeAt(b, contact, { base: [1, 0, 0, 340], Phone: [1, 0, 0, 330] });
  const pad = b.add(contact, 'UIPadding', { PaddingTop: [0, 96], PaddingBottom: [0, 64] });
  b.change(pad, 'Phone', { PaddingTop: [0, 64], PaddingBottom: [0, 70] });
  const content = column(b, contact, 1120);
  b.set(content, { AutomaticSize: 'Y' });
  b.add(content, 'UIListLayout', { Padding: [0, 24] });
  label(b, content, {
    Name: 'Kicker',
    LayoutOrder: 1,
    Size: [1, 0, 0, 24],
    Text: 'Contact',
    Font: 'SourceSansSemibold',
    TextSize: 17,
    TextColor3: [232, 160, 130],
    TextXAlignment: 'Left',
  });
  const title = label(b, content, {
    Name: 'Title',
    HtmlTag: 'h2',
    LayoutOrder: 2,
    Text: "Have a project in mind? Let's talk.",
    Font: 'Merriweather',
    TextSize: 44,
    LineHeight: 1.2,
    TextWrapped: true,
    AutomaticSize: 'Y',
    TextColor3: PAPER,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
  sizeAt(b, title, { base: [0, 720, 0, 56], Tablet: [1, 0, 0, 56], Phone: [1, 0, 0, 72] });
  b.change(title, 'Tablet', { TextSize: 40 });
  b.change(title, 'Phone', { TextSize: 28 });
  const email = b.add(content, 'TextButton', {
    Name: 'EmailButton',
    LayoutOrder: 3,
    Size: [0, 168, 0, 52],
    AutomaticSize: 'X',
    BackgroundColor3: ACCENT,
    Text: 'Email me',
    Font: 'SourceSansSemibold',
    TextSize: 18,
    TextColor3: WHITE,
    Link: { kind: 'url', url: 'mailto:hello@example.com' },
  });
  corner(b, email, [0.5, 0]);
  padX(b, email, 24);
}

function addFooter(b: Builder, page: InstanceId) {
  const footer = b.add(page, 'Frame', {
    Name: 'Footer',
    HtmlTag: 'footer',
    LayoutOrder: 6,
    BackgroundColor3: INK,
  });
  sizeAt(b, footer, { base: [1, 0, 0, 80], Phone: [1, 0, 0, 104] });
  const bar = column(b, footer, 1120, [1, 0], 'Bar');
  b.add(bar, 'Frame', {
    Name: 'Divider',
    Size: [1, 0, 0, 1],
    BackgroundColor3: [64, 62, 58],
  });
  const copy = label(b, bar, {
    Name: 'Copyright',
    AnchorPoint: [0, 0.5],
    Position: [0, 0, 0.5, 0],
    Size: [0, 240, 0, 20],
    Text: '© 2026 Mara Lindqvist',
    Font: 'SourceSans',
    TextSize: 15,
    TextColor3: [150, 146, 140],
    TextXAlignment: 'Left',
  });
  b.change(copy, 'Phone', {
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 24],
    TextXAlignment: 'Center',
  });
  const links = group(b, bar, {
    Name: 'Links',
    AnchorPoint: [1, 0.5],
    Position: [1, 0, 0.5, 0],
    Size: [0, 280, 0, 20],
  });
  b.change(links, 'Phone', { AnchorPoint: [0.5, 0], Position: [0.5, 0, 0, 58] });
  const row = b.add(links, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Right',
    Padding: [0, 16],
  });
  b.change(row, 'Phone', { HorizontalAlignment: 'Center' });
  ['LinkedIn', 'Dribbble', 'Instagram'].forEach((text, i) =>
    b.add(links, 'TextButton', {
      Name: text,
      LayoutOrder: i + 1,
      Size: [0, 76, 1, 0],
      BackgroundTransparency: 1,
      Text: text,
      Font: 'SourceSans',
      TextSize: 15,
      TextColor3: [200, 196, 190],
      Link: { kind: 'url', url: `https://www.${text.toLowerCase()}.com/`, newTab: true },
    }),
  );
}
