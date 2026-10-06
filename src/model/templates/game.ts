/**
 * Pieces the Roblox templates share: a panel that keeps its shape on every screen, its header
 * and close button, buttons, and item icons. Everything is sized in Scale, with
 * UIAspectRatioConstraints where the shape matters, so it fits a laptop and a phone alike.
 */
import type { Builder } from '../builder.ts';
import type { PropsOf } from '../classes.ts';
import type { InstanceId } from '../document.ts';
import { colorSequence, type Color3, type UDim2 } from '../values.ts';
import { corner, group, label, square, stroke } from './kit.ts';

export const NAVY: Color3 = [24, 26, 43];
export const NAVY_2: Color3 = [36, 39, 64];
export const NAVY_3: Color3 = [56, 61, 94];
export const DEEP: Color3 = [14, 15, 26];
export const TEXT: Color3 = [240, 242, 250];
export const SUB: Color3 = [160, 168, 196];
export const GOLD: Color3 = [255, 200, 61];
export const GREEN: Color3 = [64, 192, 96];
export const RED: Color3 = [232, 80, 88];
export const BLUE: Color3 = [80, 152, 255];
export const PURPLE: Color3 = [170, 110, 255];
export const WHITE: Color3 = [255, 255, 255];
export const BLACK: Color3 = [0, 0, 0];

const mix = (a: Color3, b: Color3, t: number): Color3 =>
  a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as unknown as Color3;
export const lighter = (c: Color3, t = 0.45) => mix(c, WHITE, t);
export const darker = (c: Color3, t = 0.35) => mix(c, BLACK, t);

/** Darkens the game behind a menu. */
export function dim(b: Builder, sg: InstanceId) {
  return b.add(sg, 'Frame', {
    Name: 'Dim',
    Size: [1, 0, 1, 0],
    BackgroundColor3: BLACK,
    BackgroundTransparency: 0.5,
  });
}

/** A menu panel in the middle of the screen that keeps its width-to-height ratio. */
export function panel(b: Builder, sg: InstanceId, size: UDim2, ratio: number) {
  const id = b.add(sg, 'Frame', {
    Name: 'Panel',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: size,
    BackgroundColor3: NAVY,
  });
  b.add(id, 'UIAspectRatioConstraint', { AspectRatio: ratio });
  corner(b, id, [0, 20]);
  stroke(b, id, WHITE, 2, { Transparency: 0.85 });
  return id;
}

/** The panel's title bar: the title on the left and a close button on the right. */
export function header(b: Builder, panelId: InstanceId, title: string, height = 0.13) {
  const bar = group(b, panelId, { Name: 'Header', Size: [1, 0, height, 0] });
  const titleId = label(b, bar, {
    Name: 'Title',
    Position: [0.04, 0, 0.2, 0],
    Size: [0.5, 0, 0.6, 0],
    Text: title,
    Font: 'FredokaOne',
    TextScaled: true,
    TextColor3: TEXT,
    TextXAlignment: 'Left',
  });
  stroke(b, titleId, DEEP, 2);
  const close = b.add(bar, 'TextButton', {
    Name: 'CloseButton',
    AnchorPoint: [1, 0.5],
    Position: [0.97, 0, 0.5, 0],
    Size: [0.2, 0, 0.6, 0],
    BackgroundColor3: RED,
    Text: 'X',
    Font: 'Gotham',
    FontWeight: 'Heavy',
    TextScaled: true,
    TextColor3: WHITE,
  });
  square(b, close);
  corner(b, close, [0, 10]);
  b.add(close, 'UIPadding', {
    PaddingTop: [0.24, 0],
    PaddingBottom: [0.24, 0],
    PaddingLeft: [0.24, 0],
    PaddingRight: [0.24, 0],
  });
  shine(b, close);
  return bar;
}

/** The light-to-dark sheen game buttons usually have. */
export const shine = (b: Builder, id: InstanceId) =>
  b.add(id, 'UIGradient', { Color: colorSequence(WHITE, [206, 212, 226]), Rotation: 90 });

/** A chunky game button whose text fills its middle half. */
export function button(
  b: Builder,
  parent: InstanceId,
  name: string,
  text: string,
  color: Color3,
  props: Partial<PropsOf<'TextButton'>> = {},
) {
  const id = b.add(parent, 'TextButton', {
    Name: name,
    BackgroundColor3: color,
    Text: text,
    Font: 'Gotham',
    FontWeight: 'Heavy',
    TextScaled: true,
    TextColor3: WHITE,
    ...props,
  });
  corner(b, id, [0, 10]);
  b.add(id, 'UIPadding', { PaddingTop: [0.26, 0], PaddingBottom: [0.26, 0] });
  shine(b, id);
  return id;
}

/** A gold coin, square inside the given size. */
export function coin(b: Builder, parent: InstanceId, props: Partial<PropsOf<'Frame'>>) {
  const id = b.add(parent, 'Frame', { Name: 'Coin', BackgroundColor3: WHITE, ...props });
  square(b, id);
  corner(b, id, [0.5, 0]);
  b.add(id, 'UIGradient', { Color: colorSequence([255, 236, 150], [222, 158, 30]), Rotation: 90 });
  stroke(b, id, [168, 104, 8], 2);
  return id;
}

/** A gem: a diamond in the given color, square inside the given size. */
export function gem(b: Builder, parent: InstanceId, props: Partial<PropsOf<'Frame'>>) {
  return item(b, parent, BLUE, 'gem', { Name: 'Gem', ...props });
}

/**
 * An item picture drawn with shapes: an orb (a shiny ball) or a gem (a diamond). Square inside
 * the given size, centered unless the props place it.
 */
export function item(
  b: Builder,
  parent: InstanceId,
  color: Color3,
  shape: 'orb' | 'gem',
  props: Partial<PropsOf<'Frame'>> = {},
) {
  const box = group(b, parent, {
    Name: 'Icon',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: [0.7, 0, 0.7, 0],
    ...props,
  });
  square(b, box);
  const body = b.add(box, 'Frame', {
    Name: shape === 'orb' ? 'Orb' : 'Diamond',
    AnchorPoint: [0.5, 0.5],
    Position: [0.5, 0, 0.5, 0],
    Size: shape === 'orb' ? [1, 0, 1, 0] : [0.7, 0, 0.7, 0],
    Rotation: shape === 'orb' ? 0 : 45,
    BackgroundColor3: WHITE,
  });
  corner(b, body, shape === 'orb' ? [0.5, 0] : [0.16, 0]);
  b.add(body, 'UIGradient', {
    Color: colorSequence(lighter(color), darker(color, 0.2)),
    Rotation: shape === 'orb' ? 90 : 45,
  });
  stroke(b, body, darker(color, 0.45), 2);
  const glint = b.add(body, 'Frame', {
    Name: 'Glint',
    Position: [0.2, 0, 0.16, 0],
    Size: [0.26, 0, 0.18, 0],
    BackgroundColor3: WHITE,
    BackgroundTransparency: 0.35,
  });
  corner(b, glint, [0.5, 0]);
  return box;
}

/** A dark rounded pill holding an icon on the left and an amount. */
export function counter(
  b: Builder,
  parent: InstanceId,
  name: string,
  amount: string,
  icon: 'coin' | 'gem',
  props: Partial<PropsOf<'Frame'>>,
) {
  const pill = b.add(parent, 'Frame', {
    Name: name,
    BackgroundColor3: DEEP,
    BackgroundTransparency: 0.15,
    ...props,
  });
  corner(b, pill, [0.5, 0]);
  stroke(b, pill, icon === 'coin' ? GOLD : BLUE, 2, { Transparency: 0.4 });
  const place = {
    AnchorPoint: [0, 0.5],
    Position: [0.03, 0, 0.5, 0],
    Size: [0.5, 0, 0.84, 0],
  } as const;
  if (icon === 'coin') coin(b, pill, place);
  else gem(b, pill, place);
  label(b, pill, {
    Name: 'Amount',
    Position: [0.3, 0, 0.2, 0],
    Size: [0.6, 0, 0.6, 0],
    Text: amount,
    Font: 'Gotham',
    FontWeight: 'Heavy',
    TextScaled: true,
    TextColor3: TEXT,
    TextXAlignment: 'Right',
  });
  return pill;
}

/** A rounded bar filled from the left to `fill` (0 to 1). */
export function bar(
  b: Builder,
  parent: InstanceId,
  name: string,
  fill: number,
  color: Color3,
  props: Partial<PropsOf<'Frame'>>,
) {
  const track = b.add(parent, 'Frame', {
    Name: name,
    BackgroundColor3: DEEP,
    BackgroundTransparency: 0.15,
    ...props,
  });
  corner(b, track, [0.5, 0]);
  const fillId = b.add(track, 'Frame', {
    Name: 'Fill',
    Size: [fill, 0, 1, 0],
    BackgroundColor3: WHITE,
  });
  corner(b, fillId, [0.5, 0]);
  b.add(fillId, 'UIGradient', { Color: colorSequence(lighter(color, 0.3), color), Rotation: 90 });
  return track;
}
