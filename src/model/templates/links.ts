/**
 * A link-in-bio page: a picture, a name, a short bio, a stack of links and social buttons,
 * in one centered column that fills the width on a phone.
 */
import { Builder, pageSubtree } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import { corner, group, label, sizeAt, stroke } from './kit.ts';

const PLUM: Color3 = [36, 22, 56];
const MAUVE: Color3 = [92, 72, 110];
const PEACH: Color3 = [255, 214, 186];
const LILAC: Color3 = [214, 190, 255];
const WHITE: Color3 = [255, 255, 255];

export function linksTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const home = b.addSubtree(
    b.site,
    pageSubtree(
      {
        Name: 'Home',
        Path: '/',
        Title: 'Juniper Lane',
        Description: 'Singer-songwriter from Portland. New album Paper Moons is out now.',
        // Taller windows continue the bottom of the gradient.
        BackgroundColor3: LILAC,
      },
      makeId,
    ),
  );
  const profile = b.add(home, 'Frame', {
    Name: 'Profile',
    HtmlTag: 'section',
    LayoutOrder: 1,
    Size: [1, 0, 0, 880],
    AutomaticSize: 'Y',
    BackgroundColor3: WHITE,
  });
  b.add(profile, 'UIGradient', { Color: colorSequence(PEACH, LILAC), Rotation: 90 });

  const card = group(b, profile, {
    Name: 'Card',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0, 0],
    AutomaticSize: 'Y',
  });
  sizeAt(b, card, { base: [0, 440, 1, 0], Phone: [1, -40, 1, 0] });
  const pad = b.add(card, 'UIPadding', { PaddingTop: [0, 72] });
  b.change(pad, 'Phone', { PaddingTop: [0, 56] });
  b.add(card, 'UIListLayout', { HorizontalAlignment: 'Center', Padding: [0, 12] });

  const avatar = b.add(card, 'Frame', {
    Name: 'Avatar',
    LayoutOrder: 1,
    Size: [0, 112, 0, 112],
    BackgroundColor3: WHITE,
  });
  corner(b, avatar, [0.5, 0]);
  stroke(b, avatar, WHITE, 4);
  b.add(avatar, 'UIGradient', {
    Color: colorSequence([255, 138, 101], [155, 93, 229]),
    Rotation: 135,
  });
  label(b, avatar, {
    Name: 'Initials',
    Size: [1, 0, 1, 0],
    Text: 'JL',
    Font: 'FredokaOne',
    TextSize: 40,
    TextColor3: WHITE,
  });
  label(b, card, {
    Name: 'Name',
    HtmlTag: 'h1',
    LayoutOrder: 2,
    Size: [1, 0, 0, 40],
    Text: 'Juniper Lane',
    Font: 'DMSans',
    FontWeight: 'ExtraBold',
    TextSize: 30,
    TextColor3: PLUM,
  });
  label(b, card, {
    Name: 'Bio',
    HtmlTag: 'p',
    LayoutOrder: 3,
    Size: [1, 0, 0, 48],
    AutomaticSize: 'Y',
    Text: 'Singer-songwriter from Portland. New album Paper Moons is out now.',
    Font: 'DMSans',
    TextSize: 17,
    LineHeight: 1.4,
    TextWrapped: true,
    TextColor3: MAUVE,
  });

  // Taller than its buttons, which leaves room above them.
  const links = group(b, card, { Name: 'Links', LayoutOrder: 4, Size: [1, 0, 0, 340] });
  b.add(links, 'UIListLayout', { VerticalAlignment: 'Bottom', Padding: [0, 12] });
  const items = [
    ['Album', 'Listen to Paper Moons'],
    ['Tour', 'Tour dates'],
    ['Merch', 'Merch store'],
    ['Newsletter', 'Join the newsletter'],
    ['Video', 'Watch the new video'],
  ];
  items.forEach(([name, text], i) => {
    const featured = i === 0;
    const id = b.add(links, 'TextButton', {
      Name: name,
      LayoutOrder: i + 1,
      Size: [1, 0, 0, 56],
      BackgroundColor3: featured ? PLUM : WHITE,
      BackgroundTransparency: featured ? 0 : 0.3,
      Text: text,
      Font: 'DMSans',
      FontWeight: 'Bold',
      TextSize: 16,
      TextColor3: featured ? WHITE : PLUM,
      Link: { kind: 'url', url: 'https://example.com/', newTab: true },
    });
    corner(b, id, [0, 16]);
    if (!featured) stroke(b, id, WHITE, 1, { Transparency: 0.3, ApplyStrokeMode: 'Border' });
  });

  const social = group(b, card, { Name: 'Social', LayoutOrder: 5, Size: [0, 232, 0, 60] });
  b.add(social, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Bottom',
    Padding: [0, 12],
  });
  ['IG', 'TT', 'YT', 'SP'].forEach((text, i) => {
    const id = b.add(social, 'TextButton', {
      Name: `Social${i + 1}`,
      LayoutOrder: i + 1,
      Size: [0, 48, 0, 48],
      BackgroundColor3: WHITE,
      BackgroundTransparency: 0.4,
      Text: text,
      Font: 'DMSans',
      FontWeight: 'Bold',
      TextSize: 14,
      TextColor3: PLUM,
      Link: { kind: 'url', url: 'https://example.com/', newTab: true },
    });
    corner(b, id, [0.5, 0]);
  });
  label(b, card, {
    Name: 'Credit',
    LayoutOrder: 6,
    Size: [1, 0, 0, 40],
    Text: 'Made with Framecraft',
    Font: 'DMSans',
    TextSize: 13,
    TextColor3: MAUVE,
    TextTransparency: 0.2,
    TextYAlignment: 'Bottom',
  });
  return b.doc;
}
