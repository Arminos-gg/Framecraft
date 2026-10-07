/**
 * Basics for websites and Roblox screens alike: buttons, a card, a toggle, a slider, a tab bar
 * and an avatar. They are sized in pixels and take the fonts and colors of the view they are
 * added to.
 */
import type { Builder } from '../builder.ts';
import type { InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import { group, label, padAll, padX, stroke } from '../templates/kit.ts';
import { webButton } from './site.ts';
import type { Theme } from './theme.ts';
import type { ComponentDef } from './types.ts';

const WHITE: Color3 = [255, 255, 255];

function buttonSet(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, { Name: 'ButtonSet', Size: [0, 0, 0, 44], AutomaticSize: 'X' });
  b.add(id, 'UIListLayout', {
    FillDirection: 'Horizontal',
    VerticalAlignment: 'Center',
    Padding: [0, 10],
  });
  const buttons = [
    ['PrimaryButton', 'Primary', 'primary'],
    ['SecondaryButton', 'Secondary', 'secondary'],
    ['GhostButton', 'Ghost', 'ghost'],
    ['DangerButton', 'Delete', 'danger'],
  ] as const;
  buttons.forEach(([name, text, style], i) =>
    webButton(b, id, t, name, text, style, {
      LayoutOrder: i + 1,
      Size: [0, 0, 1, 0],
      TextSize: 15,
    }),
  );
  return id;
}

function card(b: Builder, parent: InstanceId, t: Theme) {
  const id = b.add(parent, 'Frame', {
    Name: 'Card',
    Size: [0, 300, 0, 0],
    AutomaticSize: 'Y',
    BackgroundColor3: t.c.surface,
  });
  t.round(b, id, 16);
  stroke(b, id, t.c.line, 1);
  padAll(b, id, [0, 16]);
  b.add(id, 'UIListLayout', { Padding: [0, 10] });
  const picture = b.add(id, 'Frame', {
    Name: 'Picture',
    LayoutOrder: 1,
    Size: [1, 0, 0, 150],
    BackgroundColor3: WHITE,
  });
  t.round(b, picture, 10);
  b.add(picture, 'UIGradient', { Color: colorSequence(t.c.accent, t.c.purple), Rotation: 30 });
  label(b, id, {
    Name: 'Title',
    HtmlTag: 'h3',
    LayoutOrder: 2,
    Size: [1, 0, 0, 28],
    Text: 'Card title',
    ...t.font.bold,
    TextSize: 19,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
    TextYAlignment: 'Bottom',
  });
  label(b, id, {
    Name: 'Text',
    HtmlTag: 'p',
    LayoutOrder: 3,
    Size: [1, 0, 0, 20],
    AutomaticSize: 'Y',
    Text: 'A line or two that says what this card is about.',
    ...t.font.regular,
    TextSize: 15,
    LineHeight: 1.4,
    TextWrapped: true,
    TextColor3: t.c.body,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
  const spacer = group(b, id, { Name: 'Actions', LayoutOrder: 4, Size: [1, 0, 0, 48] });
  b.add(spacer, 'UIListLayout', { VerticalAlignment: 'Bottom' });
  webButton(b, spacer, t, 'OpenButton', 'Open', 'primary', { Size: [0, 0, 0, 40], TextSize: 15 });
  return id;
}

/** A row of a settings list: its name on the left and a control on the right. */
function controlRow(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  text: string,
  order: number,
) {
  const row = group(b, parent, { Name: name, LayoutOrder: order, Size: [1, 0, 0, 32] });
  label(b, row, {
    Name: 'Label',
    Size: [0.6, 0, 1, 0],
    Text: text,
    ...t.font.medium,
    TextSize: 16,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  return row;
}

function toggle(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, { Name: 'Toggles', Size: [0, 300, 0, 0], AutomaticSize: 'Y' });
  b.add(id, 'UIListLayout', { Padding: [0, 12] });
  [
    ['Music', true],
    ['Notifications', false],
  ].forEach(([text, on], i) => {
    const row = controlRow(b, id, t, `${text}Row`, text as string, i + 1);
    const track = b.add(row, 'TextButton', {
      Name: 'Toggle',
      AnchorPoint: [1, 0.5],
      Position: [1, 0, 0.5, 0],
      Size: [0, 52, 0, 30],
      BackgroundColor3: on ? t.c.accent : t.c.sunken,
      Text: '',
    });
    t.pill(b, track);
    const knob = b.add(track, 'Frame', {
      Name: 'Knob',
      AnchorPoint: [on ? 1 : 0, 0.5],
      Position: [on ? 1 : 0, on ? -3 : 3, 0.5, 0],
      Size: [0, 24, 0, 24],
      BackgroundColor3: WHITE,
    });
    t.pill(b, knob);
  });
  return id;
}

function slider(b: Builder, parent: InstanceId, t: Theme) {
  const value = 0.64;
  const id = group(b, parent, { Name: 'Slider', Size: [0, 300, 0, 60] });
  label(b, id, {
    Name: 'Label',
    Size: [0.6, 0, 0, 24],
    Text: 'Volume',
    ...t.font.medium,
    TextSize: 16,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  label(b, id, {
    Name: 'Value',
    AnchorPoint: [1, 0],
    Position: [1, 0, 0, 0],
    Size: [0.4, 0, 0, 24],
    Text: `${Math.round(value * 100)}%`,
    ...t.font.bold,
    TextSize: 16,
    TextColor3: t.c.muted,
    TextXAlignment: 'Right',
  });
  const track = b.add(id, 'Frame', {
    Name: 'Track',
    Position: [0, 0, 0, 40],
    Size: [1, 0, 0, 8],
    BackgroundColor3: t.c.sunken,
  });
  t.pill(b, track);
  const fill = b.add(track, 'Frame', {
    Name: 'Fill',
    Size: [value, 0, 1, 0],
    BackgroundColor3: t.c.accent,
  });
  t.pill(b, fill);
  const knob = b.add(track, 'TextButton', {
    Name: 'Knob',
    AnchorPoint: [0.5, 0.5],
    Position: [value, 0, 0.5, 0],
    Size: [0, 22, 0, 22],
    BackgroundColor3: WHITE,
    Text: '',
  });
  t.pill(b, knob);
  stroke(b, knob, t.c.accent, 3, { ApplyStrokeMode: 'Border' });
  return id;
}

function tabBar(b: Builder, parent: InstanceId, t: Theme) {
  const id = b.add(parent, 'Frame', {
    Name: 'TabBar',
    Size: [0, 0, 0, 44],
    AutomaticSize: 'X',
    BackgroundColor3: t.c.raised,
  });
  t.round(b, id, 12);
  padAll(b, id, [0, 4]);
  b.add(id, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0, 4] });
  ['Overview', 'Stats', 'Settings'].forEach((text, i) => {
    const picked = i === 0;
    const tab = b.add(id, 'TextButton', {
      Name: `${text}Tab`,
      LayoutOrder: i + 1,
      Size: [0, 0, 1, 0],
      AutomaticSize: 'X',
      BackgroundColor3: t.c.bg,
      BackgroundTransparency: picked ? 0 : 1,
      Text: text,
      ...(picked ? t.font.bold : t.font.medium),
      TextSize: 15,
      TextColor3: picked ? t.c.ink : t.c.muted,
    });
    t.round(b, tab, 9);
    padX(b, tab, 18);
    if (picked && t.look === 'light') stroke(b, tab, t.c.line, 1, { ApplyStrokeMode: 'Border' });
  });
  return id;
}

function avatar(b: Builder, parent: InstanceId, t: Theme) {
  const id = b.add(parent, 'Frame', {
    Name: 'Avatar',
    Size: [0, 72, 0, 72],
    BackgroundColor3: WHITE,
  });
  t.circle(b, id);
  b.add(id, 'UIGradient', { Color: colorSequence(t.c.accent, t.c.purple), Rotation: 135 });
  label(b, id, {
    Name: 'Initials',
    Size: [1, 0, 1, 0],
    Text: 'AB',
    ...t.font.bold,
    TextSize: 26,
    TextColor3: WHITE,
  });
  const dot = b.add(id, 'Frame', {
    Name: 'Online',
    AnchorPoint: [0.5, 0.5],
    Position: [0.85, 0, 0.85, 0],
    Size: [0, 18, 0, 18],
    BackgroundColor3: t.c.good,
  });
  t.circle(b, dot);
  stroke(b, dot, t.c.bg, 3);
  return id;
}

export const BASIC_COMPONENTS: readonly ComponentDef[] = [
  {
    id: 'buttons',
    name: 'Button set',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'Primary, secondary, ghost and danger',
    description:
      'Four buttons in a row: primary, secondary, ghost and danger. Each grows with its text and shares the corner radius and text size.',
    build: buttonSet,
  },
  {
    id: 'card',
    name: 'Card',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'Picture, title, text and a button',
    description:
      'A rounded card with a picture spot, a title, a line of text and a button. It grows with its text, and makes a base for many other pieces.',
    build: card,
  },
  {
    id: 'toggle',
    name: 'Toggle',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'Switches with on and off looks',
    description: 'Two settings rows, each with a switch: one on, one off.',
    lookOnly: 'Switching needs a script, which the exports don’t write yet.',
    build: toggle,
  },
  {
    id: 'slider',
    name: 'Slider',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'Track, fill, knob and value',
    description: 'A labeled track with a fill, a knob and the value beside it.',
    lookOnly: 'Dragging the knob needs a script, which the exports don’t write yet.',
    build: slider,
  },
  {
    id: 'tabs',
    name: 'Tab bar',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'A row of tabs, one picked',
    description: 'Three tabs in a rounded bar, the first one picked. Each tab grows with its text.',
    lookOnly: 'Switching tabs needs a script, which the exports don’t write yet.',
    build: tabBar,
  },
  {
    id: 'avatar',
    name: 'Avatar',
    kind: 'both',
    category: 'Basics',
    place: 'block',
    summary: 'A round picture with initials',
    description:
      'A round picture with initials and an online dot. Put an ImageLabel inside for a photo.',
    build: avatar,
  },
];
