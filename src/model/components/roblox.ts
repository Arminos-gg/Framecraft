/**
 * Roblox components. Like the Roblox templates, they are sized in Scale with
 * UIAspectRatioConstraints where the shape matters, so they fit every screen, and each places
 * itself where games usually put it: a hotbar along the bottom, coins in the top corner.
 */
import type { Builder } from '../builder.ts';
import type { PropsOf } from '../classes.ts';
import type { InstanceId } from '../document.ts';
import { colorSequence, type Color3, type UDim2 } from '../values.ts';
import { coin, darker, gem, item, lighter } from '../templates/game.ts';
import { group, label, square, stroke } from '../templates/kit.ts';
import type { Theme } from './theme.ts';
import type { ComponentDef } from './types.ts';

const WHITE: Color3 = [255, 255, 255];
const BLACK: Color3 = [0, 0, 0];

/** The sheen game buttons usually have. */
const shine = (b: Builder, id: InstanceId) =>
  b.add(id, 'UIGradient', { Color: colorSequence(WHITE, [206, 212, 226]), Rotation: 90 });

/** A chunky game button whose text fills its middle half. */
function gameButton(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  text: string,
  color: Color3,
  props: Partial<PropsOf<'TextButton'>> = {},
) {
  const id = b.add(parent, 'TextButton', {
    Name: name,
    BackgroundColor3: color,
    Text: text,
    ...t.font.heavy,
    TextScaled: true,
    TextColor3: WHITE,
    ...props,
  });
  t.round(b, id, 10);
  b.add(id, 'UIPadding', { PaddingTop: [0.26, 0], PaddingBottom: [0.26, 0] });
  shine(b, id);
  return id;
}

/** A panel that keeps its width-to-height ratio, in the middle of its parent. */
function panel(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  size: UDim2,
  ratio: number,
  props: Partial<PropsOf<'Frame'>> = {},
) {
  const id = b.add(parent, 'Frame', {
    Name: name,
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: size,
    BackgroundColor3: t.c.surface,
    ...props,
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: ratio });
  t.round(b, id, 20);
  if (t.look === 'dark') stroke(b, id, WHITE, 2, { Transparency: 0.85 });
  else stroke(b, id, t.c.line, 2);
  return id;
}

/** A red close button, square inside the given size. */
function closeButton(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  props: Partial<PropsOf<'TextButton'>>,
) {
  const close = b.add(parent, 'TextButton', {
    Name: 'CloseButton',
    BackgroundColor3: t.c.bad,
    Text: 'X',
    Font: 'Gotham',
    FontWeight: 'Heavy',
    TextScaled: true,
    TextColor3: WHITE,
    ...props,
  });
  square(b, close);
  t.round(b, close, 10);
  b.add(close, 'UIPadding', {
    PaddingTop: [0.24, 0],
    PaddingBottom: [0.24, 0],
    PaddingLeft: [0.24, 0],
    PaddingRight: [0.24, 0],
  });
  shine(b, close);
  return close;
}

/** A panel's title bar: the title on the left and a close button on the right. */
function header(b: Builder, panelId: InstanceId, t: Theme, title: string, height = 0.14) {
  const bar = group(b, panelId, { Name: 'Header', Size: [1, 0, height, 0] });
  const titleId = label(b, bar, {
    Name: 'Title',
    Position: [0.05, 0, 0.22, 0],
    Size: [0.6, 0, 0.56, 0],
    Text: title,
    ...t.font.display,
    TextScaled: true,
    TextColor3: t.c.ink,
    TextXAlignment: 'Left',
  });
  if (t.look === 'dark') stroke(b, titleId, t.c.sunken, 2);
  closeButton(b, bar, t, {
    AnchorPoint: [1, 0.5],
    Position: [0.96, 0, 0.5, 0],
    Size: [0.2, 0, 0.62, 0],
  });
  return bar;
}

/** A label whose text fills its box, the way game UI scales with the screen. */
const scaled = (b: Builder, parent: InstanceId, t: Theme, props: Partial<PropsOf<'TextLabel'>>) =>
  label(b, parent, {
    ...t.font.bold,
    TextScaled: true,
    TextColor3: t.c.ink,
    ...props,
  });

/** A rounded bar filled from the left to `fill` (0 to 1). */
function bar(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  fill: number,
  color: Color3,
  props: Partial<PropsOf<'Frame'>>,
) {
  const track = b.add(parent, 'Frame', {
    Name: name,
    BackgroundColor3: t.c.sunken,
    BackgroundTransparency: t.look === 'dark' ? 0.15 : 0,
    ...props,
  });
  t.pill(b, track);
  const fillId = b.add(track, 'Frame', {
    Name: 'Fill',
    Size: [fill, 0, 1, 0],
    BackgroundColor3: WHITE,
  });
  t.pill(b, fillId);
  b.add(fillId, 'UIGradient', { Color: colorSequence(lighter(color, 0.3), color), Rotation: 90 });
  return track;
}

/** A pill on the HUD, dark and see-through in the dark look, white in the light one. */
function hudPill(b: Builder, parent: InstanceId, t: Theme, props: Partial<PropsOf<'Frame'>>) {
  const id = b.add(parent, 'Frame', {
    BackgroundColor3: t.look === 'dark' ? t.c.sunken : t.c.surface,
    BackgroundTransparency: t.look === 'dark' ? 0.15 : 0.05,
    ...props,
  });
  t.pill(b, id);
  return id;
}

function itemSlot(b: Builder, parent: InstanceId, t: Theme) {
  const color = t.c.purple;
  const slot = b.add(parent, 'TextButton', {
    Name: 'ItemSlot',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0.12, 0, 0.12, 0],
    BackgroundColor3: t.c.raised,
    Text: '',
  });
  square(b, slot);
  t.round(b, slot, 12);
  stroke(b, slot, color, 3, { ApplyStrokeMode: 'Border' });
  item(b, slot, color, 'orb', { Size: [0.62, 0, 0.62, 0] });
  scaled(b, slot, t, {
    Name: 'Count',
    AnchorPoint: [1, 1],
    Position: [0.92, 0, 0.94, 0],
    Size: [0.5, 0, 0.24, 0],
    Text: 'x12',
    ...t.font.heavy,
    TextXAlignment: 'Right',
  });
  return slot;
}

const HOTBAR: ([Color3, 'orb' | 'gem'] | null)[] = [
  [[255, 200, 61], 'gem'],
  [[232, 80, 88], 'orb'],
  [[64, 192, 96], 'orb'],
  [[80, 152, 255], 'gem'],
  null,
  null,
];

function hotbar(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, {
    Name: 'Hotbar',
    AnchorPoint: [0.5, 1],
    Position: [0.5, 0, 0.97, 0],
    Size: [0.46, 0, 0.11, 0],
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 6.4 });
  b.add(id, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0.016, 0],
  });
  const dark = t.look === 'dark';
  HOTBAR.forEach((slot, i) => {
    const selected = i === 0;
    const s = b.add(id, 'TextButton', {
      Name: `Slot${i + 1}`,
      LayoutOrder: i + 1,
      Size: [0.153, 0, 1, 0],
      BackgroundColor3: dark ? t.c.sunken : t.c.surface,
      BackgroundTransparency: selected ? 0.05 : dark ? 0.25 : 0.1,
      Text: '',
    });
    square(b, s);
    t.round(b, s, 10);
    stroke(b, s, selected ? t.c.gold : dark ? WHITE : t.c.line, selected ? 3 : 2, {
      Transparency: selected || !dark ? 0 : 0.75,
      ApplyStrokeMode: 'Border',
    });
    scaled(b, s, t, {
      Name: 'Key',
      Position: [0.1, 0, 0.06, 0],
      Size: [0.3, 0, 0.26, 0],
      Text: String(i + 1),
      ...t.font.heavy,
      TextTransparency: 0.3,
      TextXAlignment: 'Left',
    });
    if (slot) item(b, s, slot[0], slot[1], { Size: [0.58, 0, 0.58, 0] });
  });
  return id;
}

/** A pill holding a coin or a gem and an amount. */
function counter(
  b: Builder,
  parent: InstanceId,
  t: Theme,
  name: string,
  amount: string,
  icon: 'coin' | 'gem',
  props: Partial<PropsOf<'Frame'>>,
) {
  const pill = hudPill(b, parent, t, { Name: name, ...props });
  stroke(b, pill, icon === 'coin' ? t.c.gold : t.c.blue, 2, { Transparency: 0.4 });
  const place = {
    AnchorPoint: [0, 0.5],
    Position: [0.03, 0, 0.5, 0],
    Size: [0.5, 0, 0.84, 0],
  } as const;
  if (icon === 'coin') coin(b, pill, place);
  else gem(b, pill, place);
  scaled(b, pill, t, {
    Name: 'Amount',
    Position: [0.3, 0, 0.2, 0],
    Size: [0.6, 0, 0.6, 0],
    Text: amount,
    ...t.font.heavy,
    TextXAlignment: 'Right',
  });
  return pill;
}

function wallet(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, {
    Name: 'Wallet',
    AnchorPoint: [1, 0],
    Position: [0.98, 0, 0.03, 0],
    Size: [0.17, 0, 0.15, 0],
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 2.4 });
  b.add(id, 'UIListLayout', { HorizontalAlignment: 'Right', Padding: [0.08, 0] });
  counter(b, id, t, 'Coins', '12,450', 'coin', { LayoutOrder: 1, Size: [1, 0, 0.46, 0] });
  counter(b, id, t, 'Gems', '380', 'gem', { LayoutOrder: 2, Size: [1, 0, 0.46, 0] });
  return id;
}

function bars(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, {
    Name: 'Bars',
    AnchorPoint: [0, 1],
    Position: [0.02, 0, 0.96, 0],
    Size: [0.28, 0, 0.09, 0],
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 5 });
  b.add(id, 'UIListLayout', { Padding: [0.1, 0] });
  const health = bar(b, id, t, 'Health', 0.7, t.c.good, {
    LayoutOrder: 1,
    Size: [1, 0, 0.58, 0],
  });
  stroke(b, health, t.look === 'dark' ? t.c.sunken : t.c.line, 2, { Transparency: 0.3 });
  const amount = scaled(b, health, t, {
    Name: 'Amount',
    Size: [1, 0, 1, 0],
    Text: '70 / 100',
    ...t.font.heavy,
    TextColor3: WHITE,
  });
  stroke(b, amount, darker(t.c.good, 0.5), 1.5);
  b.add(amount, 'UIPadding', { PaddingTop: [0.2, 0], PaddingBottom: [0.2, 0] });
  const xp = group(b, id, { Name: 'Experience', LayoutOrder: 2, Size: [1, 0, 0.32, 0] });
  bar(b, xp, t, 'Bar', 0.42, t.c.blue, { Size: [0.78, 0, 1, 0] });
  const level = scaled(b, xp, t, {
    Name: 'Level',
    AnchorPoint: [1, 0],
    Position: [1, 0, 0, 0],
    Size: [0.19, 0, 1, 0],
    Text: 'Lv 12',
    ...t.font.heavy,
    TextColor3: WHITE,
    TextXAlignment: 'Left',
  });
  stroke(b, level, BLACK, 1.5, { Transparency: 0.3 });
  return id;
}

function close(b: Builder, parent: InstanceId, t: Theme) {
  return closeButton(b, parent, t, {
    AnchorPoint: [1, 0],
    Position: [0.98, 0, 0.03, 0],
    Size: [0.07, 0, 0.07, 0],
  });
}

function windowPanel(b: Builder, parent: InstanceId, t: Theme) {
  const id = panel(b, parent, t, 'Window', [0.6, 0, 0.7, 0], 1.3);
  header(b, id, t, 'MENU');
  const body = b.add(id, 'ScrollingFrame', {
    Name: 'Body',
    Position: [0.05, 0, 0.17, 0],
    Size: [0.9, 0, 0.78, 0],
    BackgroundTransparency: 1,
    CanvasSize: [0, 0, 0, 0],
    AutomaticCanvasSize: 'Y',
    ScrollBarThickness: 6,
  });
  b.add(body, 'UIListLayout', { Padding: [0, 8] });
  for (let i = 1; i <= 6; i++) {
    const row = b.add(body, 'Frame', {
      Name: `Row${i}`,
      LayoutOrder: i,
      Size: [1, -12, 0, 56],
      BackgroundColor3: t.c.raised,
    });
    t.round(b, row, 12);
    scaled(b, row, t, {
      Name: 'Label',
      Position: [0.05, 0, 0.3, 0],
      Size: [0.6, 0, 0.4, 0],
      Text: `Row ${i}`,
      TextXAlignment: 'Left',
    });
  }
  return id;
}

function confirmDialog(b: Builder, parent: InstanceId, t: Theme) {
  const id = b.add(parent, 'Frame', {
    Name: 'ConfirmDialog',
    Size: [1, 0, 1, 0],
    BackgroundColor3: BLACK,
    BackgroundTransparency: 0.5,
  });
  const box = panel(b, id, t, 'Box', [0.4, 0, 0.36, 0], 1.7);
  scaled(b, box, t, {
    Name: 'Question',
    Position: [0.08, 0, 0.14, 0],
    Size: [0.84, 0, 0.18, 0],
    Text: 'Buy for 50 coins?',
    ...t.font.display,
  });
  scaled(b, box, t, {
    Name: 'Detail',
    Position: [0.12, 0, 0.38, 0],
    Size: [0.76, 0, 0.11, 0],
    Text: 'You have 12,450 coins.',
    ...t.font.medium,
    TextColor3: t.c.muted,
  });
  const actions = group(b, box, {
    Name: 'Actions',
    Position: [0.08, 0, 0.62, 0],
    Size: [0.84, 0, 0.24, 0],
  });
  b.add(actions, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0.04, 0],
  });
  gameButton(b, actions, t, 'YesButton', 'YES', t.c.good, {
    LayoutOrder: 1,
    Size: [0.48, 0, 1, 0],
  });
  gameButton(b, actions, t, 'NoButton', 'NO', t.c.bad, { LayoutOrder: 2, Size: [0.48, 0, 1, 0] });
  return id;
}

function sideMenu(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, {
    Name: 'SideMenu',
    AnchorPoint: [0, 0.5],
    Position: [0.015, 0, 0.5, 0],
    Size: [0.09, 0, 0.56, 0],
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 0.24 });
  b.add(id, 'UIListLayout', { VerticalAlignment: 'Center', Padding: [0.02, 0] });
  const items: [string, Color3][] = [
    ['Shop', t.c.gold],
    ['Pets', t.c.purple],
    ['Rebirth', t.c.good],
    ['Codes', t.c.blue],
  ];
  items.forEach(([text, color], i) => {
    const button = b.add(id, 'TextButton', {
      Name: `${text}Button`,
      LayoutOrder: i + 1,
      Size: [1, 0, 0.235, 0],
      BackgroundColor3: color,
      Text: '',
    });
    square(b, button);
    t.round(b, button, 14);
    b.add(button, 'UIGradient', {
      Color: colorSequence(lighter(color, 0.25), darker(color, 0.15)),
      Rotation: 90,
    });
    stroke(b, button, darker(color, 0.45), 3, { ApplyStrokeMode: 'Border' });
    item(b, button, lighter(color, 0.5), i % 2 ? 'gem' : 'orb', {
      Position: [0.5, 0, 0.42, 0],
      Size: [0.5, 0, 0.5, 0],
    });
    const name = scaled(b, button, t, {
      Name: 'Label',
      AnchorPoint: [0.5, 1],
      Position: [0.5, 0, 0.95, 0],
      Size: [0.9, 0, 0.24, 0],
      Text: text,
      ...t.font.heavy,
      TextColor3: WHITE,
    });
    stroke(b, name, darker(color, 0.55), 2);
  });
  return id;
}

/** A text box for a game panel, with a rounded sunken background. */
function gameBox(b: Builder, parent: InstanceId, t: Theme, props: Partial<PropsOf<'TextBox'>>) {
  const id = b.add(parent, 'TextBox', {
    BackgroundColor3: t.c.sunken,
    Text: '',
    ...t.font.bold,
    TextScaled: true,
    TextColor3: t.c.ink,
    ...props,
  });
  t.round(b, id, 12);
  b.add(id, 'UIPadding', {
    PaddingTop: [0.28, 0],
    PaddingBottom: [0.28, 0],
    PaddingLeft: [0.05, 0],
    PaddingRight: [0.05, 0],
  });
  return id;
}

function codes(b: Builder, parent: InstanceId, t: Theme) {
  const id = panel(b, parent, t, 'Codes', [0.4, 0, 0.5, 0], 1.35);
  header(b, id, t, 'CODES', 0.2);
  gameBox(b, id, t, {
    Name: 'CodeBox',
    Position: [0.08, 0, 0.27, 0],
    Size: [0.84, 0, 0.2, 0],
    PlaceholderText: 'Enter code',
  });
  gameButton(b, id, t, 'RedeemButton', 'REDEEM', t.c.good, {
    Position: [0.08, 0, 0.53, 0],
    Size: [0.84, 0, 0.19, 0],
  });
  scaled(b, id, t, {
    Name: 'Result',
    Position: [0.08, 0, 0.78, 0],
    Size: [0.84, 0, 0.09, 0],
    Text: 'Code redeemed: +500 coins',
    ...t.font.bold,
    TextColor3: t.c.good,
  });
  return id;
}

function rebirth(b: Builder, parent: InstanceId, t: Theme) {
  const id = panel(b, parent, t, 'Rebirth', [0.42, 0, 0.56, 0], 1.25);
  header(b, id, t, 'REBIRTH', 0.18);
  const row = group(b, id, {
    Name: 'Multiplier',
    Position: [0.1, 0, 0.24, 0],
    Size: [0.8, 0, 0.26, 0],
  });
  b.add(row, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Center',
    Padding: [0.04, 0],
  });
  scaled(b, row, t, {
    Name: 'Now',
    LayoutOrder: 1,
    Size: [0.28, 0, 0.7, 0],
    Text: 'x2',
    ...t.font.heavy,
    TextColor3: t.c.muted,
  });
  scaled(b, row, t, {
    Name: 'Arrow',
    LayoutOrder: 2,
    Size: [0.16, 0, 0.5, 0],
    Text: '>',
    ...t.font.heavy,
    TextColor3: t.c.muted,
  });
  const next = scaled(b, row, t, {
    Name: 'Next',
    LayoutOrder: 3,
    Size: [0.34, 0, 1, 0],
    Text: 'x3',
    ...t.font.heavy,
    TextColor3: t.c.gold,
  });
  stroke(b, next, darker(t.c.gold, 0.5), 2);
  const cost = group(b, id, { Name: 'Cost', Position: [0.2, 0, 0.55, 0], Size: [0.6, 0, 0.11, 0] });
  b.add(cost, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    VerticalAlignment: 'Center',
    Padding: [0.03, 0],
  });
  coin(b, cost, { LayoutOrder: 1, Size: [0.2, 0, 1, 0] });
  scaled(b, cost, t, {
    Name: 'Amount',
    LayoutOrder: 2,
    Size: [0.5, 0, 0.9, 0],
    Text: '1M coins',
    ...t.font.heavy,
    TextXAlignment: 'Left',
  });
  gameButton(b, id, t, 'RebirthButton', 'REBIRTH', t.c.gold, {
    Position: [0.12, 0, 0.74, 0],
    Size: [0.76, 0, 0.17, 0],
    TextColor3: [56, 38, 0],
  });
  return id;
}

function roundTimer(b: Builder, parent: InstanceId, t: Theme) {
  const id = group(b, parent, {
    Name: 'RoundTimer',
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0.03, 0],
    Size: [0.16, 0, 0.13, 0],
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 2.2 });
  const pill = hudPill(b, id, t, { Name: 'Time', Size: [1, 0, 0.62, 0] });
  stroke(b, pill, t.look === 'dark' ? WHITE : t.c.line, 2, {
    Transparency: t.look === 'dark' ? 0.8 : 0,
  });
  scaled(b, pill, t, {
    Name: 'Clock',
    Position: [0.1, 0, 0.16, 0],
    Size: [0.8, 0, 0.68, 0],
    Text: '1:24',
    ...t.font.heavy,
  });
  const left = scaled(b, id, t, {
    Name: 'PlayersLeft',
    Position: [0.05, 0, 0.7, 0],
    Size: [0.9, 0, 0.26, 0],
    Text: '8 players left',
    ...t.font.bold,
    TextColor3: t.look === 'dark' ? t.c.ink : WHITE,
  });
  stroke(b, left, BLACK, 1.5, { Transparency: 0.4 });
  return id;
}

function questTracker(b: Builder, parent: InstanceId, t: Theme) {
  const id = b.add(parent, 'Frame', {
    Name: 'Quest',
    AnchorPoint: [1, 0],
    Position: [0.98, 0, 0.22, 0],
    Size: [0.2, 0, 0.16, 0],
    BackgroundColor3: t.look === 'dark' ? t.c.sunken : t.c.surface,
    BackgroundTransparency: t.look === 'dark' ? 0.25 : 0.05,
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: 2.3 });
  t.round(b, id, 12);
  scaled(b, id, t, {
    Name: 'Heading',
    Position: [0.07, 0, 0.12, 0],
    Size: [0.6, 0, 0.17, 0],
    Text: 'QUEST',
    ...t.font.heavy,
    TextColor3: t.c.gold,
    TextXAlignment: 'Left',
  });
  scaled(b, id, t, {
    Name: 'Goal',
    Position: [0.07, 0, 0.36, 0],
    Size: [0.86, 0, 0.2, 0],
    Text: 'Defeat 5 slimes',
    TextXAlignment: 'Left',
  });
  bar(b, id, t, 'Progress', 0.6, t.c.gold, {
    Position: [0.07, 0, 0.7, 0],
    Size: [0.64, 0, 0.13, 0],
  });
  scaled(b, id, t, {
    Name: 'Count',
    AnchorPoint: [1, 0],
    Position: [0.93, 0, 0.66, 0],
    Size: [0.18, 0, 0.21, 0],
    Text: '3/5',
    TextColor3: t.c.muted,
    TextXAlignment: 'Right',
  });
  return id;
}

function shopCard(b: Builder, parent: InstanceId, t: Theme) {
  const color = t.c.purple;
  const card = b.add(parent, 'Frame', {
    Name: 'ShopItem',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0.22, 0, 0.42, 0],
    BackgroundColor3: t.c.raised,
  });
  b.add(card, 'UIAspectRatioConstraint', { AspectRatio: 0.78 });
  t.round(b, card, 14);
  stroke(b, card, color, 2, { Transparency: 0.3 });
  scaled(b, card, t, {
    Name: 'Rarity',
    Position: [0.08, 0, 0.06, 0],
    Size: [0.6, 0, 0.07, 0],
    Text: 'EPIC',
    ...t.font.heavy,
    TextColor3: color,
    TextXAlignment: 'Left',
  });
  item(b, card, color, 'orb', {
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0.16, 0],
    Size: [0.6, 0, 0.4, 0],
  });
  scaled(b, card, t, {
    Name: 'ItemName',
    Position: [0.08, 0, 0.6, 0],
    Size: [0.84, 0, 0.1, 0],
    Text: 'Frost Wings',
  });
  const buy = gameButton(b, card, t, 'BuyButton', '800', t.c.good, {
    AnchorPoint: [0.5, 1],
    Position: [0.5, 0, 0.94, 0],
    Size: [0.84, 0, 0.17, 0],
  });
  coin(b, buy, {
    AnchorPoint: [0, 0.5],
    Position: [0.06, 0, 0.5, 0],
    Size: [0.3, 0, 1.3, 0],
  });
  return card;
}

export const ROBLOX_COMPONENTS: readonly ComponentDef[] = [
  {
    id: 'window',
    name: 'Window panel',
    kind: 'roblox',
    category: 'Menus',
    place: 'screen',
    summary: 'Title bar, close button, scrolling body',
    description:
      'The base for most menus: a panel with a title, a close button and a body that scrolls. Add rows to the body and the canvas grows with them.',
    build: windowPanel,
  },
  {
    id: 'confirm',
    name: 'Confirm dialog',
    kind: 'roblox',
    category: 'Menus',
    place: 'screen',
    summary: 'A question with Yes and No',
    description:
      'Dims the game and asks a question with Yes and No buttons. Use it before spending coins.',
    build: confirmDialog,
  },
  {
    id: 'sidemenu',
    name: 'Side menu buttons',
    kind: 'roblox',
    category: 'Menus',
    place: 'screen',
    summary: 'Big icon buttons down the left edge',
    description:
      'The stack of big buttons simulator games keep on the left edge: Shop, Pets, Rebirth and Codes.',
    build: sideMenu,
  },
  {
    id: 'close',
    name: 'Close button',
    kind: 'roblox',
    category: 'Menus',
    place: 'screen',
    summary: 'A red X for a panel’s corner',
    description: 'A square red button with an X, in the top-right corner of whatever it lands in.',
    build: close,
  },
  {
    id: 'shopitem',
    name: 'Shop item card',
    kind: 'roblox',
    category: 'Shop',
    place: 'screen',
    summary: 'Item, rarity, name and a Buy button',
    description:
      'A card for one item: its rarity, a picture, its name and a Buy button with the price in coins.',
    build: shopCard,
  },
  {
    id: 'wallet',
    name: 'Currency counter',
    kind: 'roblox',
    category: 'Shop',
    place: 'screen',
    summary: 'Coin and gem pills',
    description: 'Two pills in the top-right corner showing coins and gems, each with its icon.',
    build: wallet,
  },
  {
    id: 'rebirth',
    name: 'Rebirth panel',
    kind: 'roblox',
    category: 'Rewards',
    place: 'screen',
    summary: 'Next multiplier, cost and Rebirth',
    description: 'Shows the current and next multiplier, what a rebirth costs, and the button.',
    build: rebirth,
  },
  {
    id: 'codes',
    name: 'Codes panel',
    kind: 'roblox',
    category: 'Rewards',
    place: 'screen',
    summary: 'A code box and Redeem',
    description: 'A box to type a code in, a Redeem button and a line that says whether it worked.',
    lookOnly:
      'Checking a code needs a script on the server, which the Luau export doesn’t write; it builds the panel for you to wire up.',
    build: codes,
  },
  {
    id: 'hotbar',
    name: 'Hotbar',
    kind: 'roblox',
    category: 'HUD',
    place: 'screen',
    summary: 'Numbered slots along the bottom',
    description:
      'Six numbered slots along the bottom of the screen; the first is picked and has a gold border.',
    build: hotbar,
  },
  {
    id: 'bars',
    name: 'Health and XP bars',
    kind: 'roblox',
    category: 'HUD',
    place: 'screen',
    summary: 'A health bar and a level bar',
    description:
      'A health bar with its amount and a thinner experience bar with the level, in the bottom-left corner.',
    build: bars,
  },
  {
    id: 'timer',
    name: 'Round timer',
    kind: 'roblox',
    category: 'HUD',
    place: 'screen',
    summary: 'Time left and players alive',
    description:
      'A pill at the top of the screen with the time left in the round and how many players are still in.',
    build: roundTimer,
  },
  {
    id: 'quest',
    name: 'Quest tracker',
    kind: 'roblox',
    category: 'HUD',
    place: 'screen',
    summary: 'A goal with a progress bar',
    description: 'A small card on the right with the current quest, a progress bar and the count.',
    build: questTracker,
  },
  {
    id: 'slot',
    name: 'Item slot',
    kind: 'roblox',
    category: 'Inventory',
    place: 'screen',
    summary: 'A square tile with an item and a count',
    description: 'A square slot with an item, a count and a border in the item’s rarity color.',
    build: itemSlot,
  },
];
