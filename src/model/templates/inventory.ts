/**
 * A game inventory: a grid of twenty slots, some holding items with a count, and a details
 * card for the selected item with Equip and Sell buttons.
 */
import { Builder } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import type { Color3 } from '../values.ts';
import {
  BLUE,
  button,
  DEEP,
  dim,
  GOLD,
  GREEN,
  header,
  item,
  NAVY_2,
  NAVY_3,
  panel,
  PURPLE,
  RED,
  SUB,
  TEXT,
  WHITE,
} from './game.ts';
import { corner, group, label, square, stroke } from './kit.ts';

type Slot = [Color3, 'orb' | 'gem', number] | null;

const FROST: Color3 = [120, 200, 255];
const SLOTS: Slot[] = [
  [PURPLE, 'orb', 1],
  [GOLD, 'gem', 1],
  [RED, 'orb', 6],
  [GREEN, 'orb', 12],
  [BLUE, 'gem', 2],
  [FROST, 'gem', 1],
  [RED, 'gem', 3],
  [GOLD, 'orb', 25],
  [PURPLE, 'gem', 1],
  [GREEN, 'gem', 4],
  [BLUE, 'orb', 1],
];

export function inventoryTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'Inventory' });
  dim(b, sg);
  const inv = panel(b, sg, [0.8, 0, 0.8, 0], 1.7);
  const top = header(b, inv, 'INVENTORY');
  label(b, top, {
    Name: 'Capacity',
    AnchorPoint: [1, 0.5],
    Position: [0.86, 0, 0.5, 0],
    Size: [0.2, 0, 0.36, 0],
    Text: `${SLOTS.length} / 40`,
    Font: 'GothamBold',
    TextScaled: true,
    TextColor3: SUB,
    TextXAlignment: 'Right',
  });

  const grid = group(b, inv, {
    Name: 'Slots',
    Position: [0.03, 0, 0.16, 0],
    Size: [0.58, 0, 0.8, 0],
  });
  b.add(grid, 'UIListLayout', { Padding: [0.032, 0] });
  for (let r = 0; r < 4; r++) {
    const row = group(b, grid, {
      Name: `Row${r + 1}`,
      LayoutOrder: r + 1,
      Size: [1, 0, 0.226, 0],
    });
    b.add(row, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.02, 0] });
    for (let c = 0; c < 5; c++) {
      const n = r * 5 + c;
      addSlot(b, row, n + 1, SLOTS[n] ?? null, n === 0);
    }
  }
  addDetails(b, inv);
  return b.doc;
}

function addSlot(b: Builder, row: InstanceId, n: number, slot: Slot, selected: boolean) {
  const id = b.add(row, 'TextButton', {
    Name: `Slot${n}`,
    LayoutOrder: n,
    Size: [0.184, 0, 1, 0],
    BackgroundColor3: NAVY_2,
    Text: '',
  });
  square(b, id);
  corner(b, id, [0, 12]);
  // A stroke on a button outlines its text unless it applies to the border.
  if (selected) stroke(b, id, WHITE, 3, { ApplyStrokeMode: 'Border' });
  else if (slot) stroke(b, id, slot[0], 2, { Transparency: 0.45, ApplyStrokeMode: 'Border' });
  if (!slot) return;
  const [color, shape, count] = slot;
  item(b, id, color, shape, { Size: [0.62, 0, 0.62, 0] });
  if (count > 1)
    label(b, id, {
      Name: 'Count',
      AnchorPoint: [1, 1],
      Position: [0.92, 0, 0.94, 0],
      Size: [0.5, 0, 0.22, 0],
      Text: `x${count}`,
      Font: 'GothamBlack',
      TextScaled: true,
      TextColor3: TEXT,
      TextXAlignment: 'Right',
    });
}

function addDetails(b: Builder, inv: InstanceId) {
  const card = b.add(inv, 'Frame', {
    Name: 'Details',
    Position: [0.64, 0, 0.16, 0],
    Size: [0.33, 0, 0.8, 0],
    BackgroundColor3: NAVY_2,
  });
  corner(b, card, [0, 16]);
  const preview = b.add(card, 'Frame', {
    Name: 'Preview',
    Position: [0.08, 0, 0.05, 0],
    Size: [0.84, 0, 0.4, 0],
    BackgroundColor3: DEEP,
  });
  corner(b, preview, [0, 14]);
  item(b, preview, PURPLE, 'orb', { Size: [0.7, 0, 0.7, 0] });
  label(b, card, {
    Name: 'ItemName',
    Position: [0.08, 0, 0.49, 0],
    Size: [0.84, 0, 0.08, 0],
    Text: 'Frost Wings',
    Font: 'FredokaOne',
    TextScaled: true,
    TextColor3: TEXT,
    TextXAlignment: 'Left',
  });
  label(b, card, {
    Name: 'Rarity',
    Position: [0.08, 0, 0.585, 0],
    Size: [0.84, 0, 0.045, 0],
    Text: 'EPIC · BACK ACCESSORY',
    Font: 'GothamBlack',
    TextScaled: true,
    TextColor3: PURPLE,
    TextXAlignment: 'Left',
  });
  label(b, card, {
    Name: 'Description',
    Position: [0.08, 0, 0.66, 0],
    Size: [0.84, 0, 0.14, 0],
    Text: 'Leaves a trail of snowflakes while you glide. Glide speed +10%.',
    Font: 'GothamMedium',
    TextScaled: true,
    TextWrapped: true,
    TextColor3: SUB,
    TextXAlignment: 'Left',
    TextYAlignment: 'Top',
  });
  const actions = group(b, card, {
    Name: 'Actions',
    Position: [0.08, 0, 0.84, 0],
    Size: [0.84, 0, 0.11, 0],
  });
  b.add(actions, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.04, 0] });
  button(b, actions, 'EquipButton', 'EQUIP', GREEN, { LayoutOrder: 1, Size: [0.6, 0, 1, 0] });
  button(b, actions, 'SellButton', 'SELL', NAVY_3, { LayoutOrder: 2, Size: [0.36, 0, 1, 0] });
}
