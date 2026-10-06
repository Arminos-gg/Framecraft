/**
 * A game shop: a panel with the player's coins, category tabs and a grid of six items, each
 * with its rarity and a buy button.
 */
import { Builder } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import type { Color3 } from '../values.ts';
import {
  BLUE,
  button,
  coin,
  counter,
  dim,
  GOLD,
  GREEN,
  header,
  item,
  NAVY_2,
  panel,
  PURPLE,
  SUB,
  TEXT,
} from './game.ts';
import { corner, group, label, stroke } from './kit.ts';

const RARITY: Record<string, Color3> = {
  LEGENDARY: GOLD,
  EPIC: PURPLE,
  RARE: BLUE,
  COMMON: [120, 214, 140],
};

const ITEMS: [string, keyof typeof RARITY, string, 'orb' | 'gem'][] = [
  ['Neon Blade', 'LEGENDARY', '1,200', 'gem'],
  ['Frost Wings', 'EPIC', '800', 'orb'],
  ['Slime Pet', 'RARE', '450', 'orb'],
  ['Speed Boost', 'COMMON', '99', 'gem'],
  ['Pirate Hat', 'RARE', '450', 'gem'],
  ['Lucky Charm', 'EPIC', '800', 'orb'],
];

export function shopTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'Shop' });
  dim(b, sg);
  const shop = panel(b, sg, [0.8, 0, 0.8, 0], 1.75);
  const top = header(b, shop, 'ITEM SHOP');
  counter(b, top, 'Coins', '12,450', 'coin', {
    AnchorPoint: [1, 0.5],
    Position: [0.88, 0, 0.5, 0],
    Size: [0.2, 0, 0.56, 0],
  });

  const tabs = group(b, shop, {
    Name: 'Tabs',
    Position: [0.03, 0, 0.16, 0],
    Size: [0.2, 0, 0.8, 0],
  });
  b.add(tabs, 'UIListLayout', { Padding: [0.025, 0] });
  ['Featured', 'Skins', 'Pets', 'Boosts', 'Codes'].forEach((text, i) => {
    const selected = i === 0;
    const tab = b.add(tabs, 'TextButton', {
      Name: `${text}Tab`,
      LayoutOrder: i + 1,
      Size: [1, 0, 0.14, 0],
      BackgroundColor3: selected ? GOLD : NAVY_2,
      Text: text,
      Font: 'Gotham',
      FontWeight: 'Bold',
      TextScaled: true,
      TextColor3: selected ? [56, 38, 0] : SUB,
      TextXAlignment: 'Left',
    });
    corner(b, tab, [0, 12]);
    b.add(tab, 'UIPadding', {
      PaddingTop: [0.3, 0],
      PaddingBottom: [0.3, 0],
      PaddingLeft: [0.12, 0],
    });
  });

  const grid = group(b, shop, {
    Name: 'Items',
    Position: [0.26, 0, 0.16, 0],
    Size: [0.71, 0, 0.8, 0],
  });
  b.add(grid, 'UIListLayout', { Padding: [0.04, 0] });
  for (let r = 0; r < 2; r++) {
    const row = group(b, grid, { Name: `Row${r + 1}`, LayoutOrder: r + 1, Size: [1, 0, 0.48, 0] });
    b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.025, 0] });
    for (let c = 0; c < 3; c++) addItem(b, row, ITEMS[r * 3 + c]!, c + 1);
  }
  return b.doc;
}

function addItem(
  b: Builder,
  row: InstanceId,
  [name, rarity, price, shape]: (typeof ITEMS)[number],
  order: number,
) {
  const color = RARITY[rarity]!;
  const card = b.add(row, 'Frame', {
    Name: name.replace(' ', ''),
    LayoutOrder: order,
    Size: [0.3166, 0, 1, 0],
    BackgroundColor3: NAVY_2,
  });
  corner(b, card, [0, 14]);
  stroke(b, card, color, 2, { Transparency: 0.3 });
  label(b, card, {
    Name: 'Rarity',
    Position: [0.08, 0, 0.06, 0],
    Size: [0.6, 0, 0.08, 0],
    Text: rarity,
    Font: 'Gotham',
    FontWeight: 'Heavy',
    TextScaled: true,
    TextColor3: color,
    TextXAlignment: 'Left',
  });
  item(b, card, color, shape, {
    AnchorPoint: [0.5, 0],
    Position: [0.5, 0, 0.17, 0],
    Size: [0.6, 0, 0.4, 0],
  });
  label(b, card, {
    Name: 'ItemName',
    Position: [0.08, 0, 0.6, 0],
    Size: [0.84, 0, 0.1, 0],
    Text: name,
    Font: 'Gotham',
    FontWeight: 'Bold',
    TextScaled: true,
    TextColor3: TEXT,
  });
  const buy = button(b, card, 'BuyButton', price, GREEN, {
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
