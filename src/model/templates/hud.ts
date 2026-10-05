/**
 * An in-game HUD: health and experience bars by the player's picture, coins and gems, a quest
 * tracker, and a hotbar of six slots at the bottom.
 */
import { Builder } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import { colorSequence, type Color3 } from '../values.ts';
import {
  bar,
  BLUE,
  counter,
  DEEP,
  GOLD,
  GREEN,
  item,
  NAVY,
  RED,
  SUB,
  TEXT,
  WHITE,
} from './game.ts';
import { corner, group, label, square, stroke } from './kit.ts';

const HOTBAR: ([Color3, 'orb' | 'gem'] | null)[] = [
  [GOLD, 'gem'],
  [RED, 'orb'],
  [GREEN, 'orb'],
  [BLUE, 'gem'],
  null,
  null,
];

export function hudTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'HUD' });
  addPlayer(b, sg);
  addWallet(b, sg);
  addQuest(b, sg);
  addHotbar(b, sg);
  return b.doc;
}

function addPlayer(b: Builder, sg: InstanceId) {
  const player = group(b, sg, {
    Name: 'Player',
    Position: [0.02, 0, 0.03, 0],
    Size: [0.28, 0, 0.1, 0],
  });
  b.add(player, 'UIAspectRatioConstraint', { AspectRatio: 4.4 });
  const avatar = b.add(player, 'Frame', {
    Name: 'Avatar',
    Size: [1, 0, 1, 0],
    BackgroundColor3: WHITE,
  });
  square(b, avatar);
  corner(b, avatar, [0.5, 0]);
  stroke(b, avatar, WHITE, 3);
  b.add(avatar, 'UIGradient', {
    Color: colorSequence([120, 180, 255], [70, 90, 210]),
    Rotation: 90,
  });
  const level = b.add(avatar, 'Frame', {
    Name: 'Level',
    AnchorPoint: [0.5, 0.5],
    Position: [0.86, 0, 0.86, 0],
    Size: [0.42, 0, 0.42, 0],
    BackgroundColor3: GOLD,
  });
  corner(b, level, [0.5, 0]);
  stroke(b, level, NAVY, 2);
  label(b, level, {
    Name: 'Number',
    Size: [1, 0, 1, 0],
    Text: '12',
    Font: 'GothamBlack',
    TextScaled: true,
    TextColor3: [56, 38, 0],
  });
  b.add(level, 'UIPadding', { PaddingTop: [0.2, 0], PaddingBottom: [0.2, 0] });

  const bars = group(b, player, {
    Name: 'Bars',
    Position: [0.27, 0, 0.14, 0],
    Size: [0.73, 0, 0.72, 0],
  });
  b.add(bars, 'UIListLayout', { Padding: [0.12, 0] });
  const health = bar(b, bars, 'Health', 0.86, RED, {
    LayoutOrder: 1,
    Size: [1, 0, 0.56, 0],
  });
  stroke(b, health, DEEP, 2, { Transparency: 0.3 });
  const amount = label(b, health, {
    Name: 'Amount',
    Size: [1, 0, 1, 0],
    Text: '86 / 100',
    Font: 'GothamBlack',
    TextScaled: true,
    TextColor3: WHITE,
  });
  stroke(b, amount, DEEP, 1.5);
  b.add(amount, 'UIPadding', { PaddingTop: [0.2, 0], PaddingBottom: [0.2, 0] });
  bar(b, bars, 'Experience', 0.42, BLUE, { LayoutOrder: 2, Size: [0.7, 0, 0.32, 0] });
}

function addWallet(b: Builder, sg: InstanceId) {
  const wallet = group(b, sg, {
    Name: 'Wallet',
    AnchorPoint: [1, 0],
    Position: [0.98, 0, 0.03, 0],
    Size: [0.17, 0, 0.15, 0],
  });
  b.add(wallet, 'UIAspectRatioConstraint', { AspectRatio: 2.4 });
  b.add(wallet, 'UIListLayout', { HorizontalAlignment: 'Right', Padding: [0.08, 0] });
  counter(b, wallet, 'Coins', '12,450', 'coin', { LayoutOrder: 1, Size: [1, 0, 0.46, 0] });
  counter(b, wallet, 'Gems', '380', 'gem', { LayoutOrder: 2, Size: [1, 0, 0.46, 0] });
}

function addQuest(b: Builder, sg: InstanceId) {
  const quest = b.add(sg, 'Frame', {
    Name: 'Quest',
    AnchorPoint: [1, 0],
    Position: [0.98, 0, 0.22, 0],
    Size: [0.2, 0, 0.16, 0],
    BackgroundColor3: DEEP,
    BackgroundTransparency: 0.25,
  });
  b.add(quest, 'UIAspectRatioConstraint', { AspectRatio: 2.3 });
  corner(b, quest, [0, 12]);
  label(b, quest, {
    Name: 'Heading',
    Position: [0.07, 0, 0.12, 0],
    Size: [0.6, 0, 0.17, 0],
    Text: 'QUEST',
    Font: 'GothamBlack',
    TextScaled: true,
    TextColor3: GOLD,
    TextXAlignment: 'Left',
  });
  label(b, quest, {
    Name: 'Goal',
    Position: [0.07, 0, 0.36, 0],
    Size: [0.86, 0, 0.2, 0],
    Text: 'Defeat 5 slimes',
    Font: 'GothamBold',
    TextScaled: true,
    TextColor3: TEXT,
    TextXAlignment: 'Left',
  });
  bar(b, quest, 'Progress', 0.6, GOLD, {
    Position: [0.07, 0, 0.7, 0],
    Size: [0.64, 0, 0.13, 0],
  });
  label(b, quest, {
    Name: 'Count',
    AnchorPoint: [1, 0],
    Position: [0.93, 0, 0.66, 0],
    Size: [0.18, 0, 0.21, 0],
    Text: '3/5',
    Font: 'GothamBold',
    TextScaled: true,
    TextColor3: SUB,
    TextXAlignment: 'Right',
  });
}

function addHotbar(b: Builder, sg: InstanceId) {
  const hotbar = group(b, sg, {
    Name: 'Hotbar',
    AnchorPoint: [0.5, 1],
    Position: [0.5, 0, 0.97, 0],
    Size: [0.46, 0, 0.11, 0],
  });
  b.add(hotbar, 'UIAspectRatioConstraint', { AspectRatio: 6.4 });
  b.add(hotbar, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Center',
    Padding: [0.016, 0],
  });
  HOTBAR.forEach((slot, i) => {
    const selected = i === 0;
    const id = b.add(hotbar, 'TextButton', {
      Name: `Slot${i + 1}`,
      LayoutOrder: i + 1,
      Size: [0.153, 0, 1, 0],
      BackgroundColor3: DEEP,
      BackgroundTransparency: selected ? 0.05 : 0.25,
      Text: '',
    });
    square(b, id);
    corner(b, id, [0, 10]);
    stroke(b, id, selected ? GOLD : WHITE, selected ? 3 : 2, {
      Transparency: selected ? 0 : 0.75,
      ApplyStrokeMode: 'Border',
    });
    label(b, id, {
      Name: 'Key',
      Position: [0.1, 0, 0.06, 0],
      Size: [0.3, 0, 0.26, 0],
      Text: String(i + 1),
      Font: 'GothamBlack',
      TextScaled: true,
      TextColor3: TEXT,
      TextTransparency: 0.3,
      TextXAlignment: 'Left',
    });
    if (slot) item(b, id, slot[0], slot[1], { Size: [0.58, 0, 0.58, 0] });
  });
}
