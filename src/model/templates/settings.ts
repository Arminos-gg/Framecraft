/**
 * A game settings menu: volume sliders, a graphics quality picker, on/off toggles, and Reset
 * and Save buttons.
 */
import { Builder } from '../builder.ts';
import { newId, type Doc, type InstanceId } from '../document.ts';
import {
  BLUE,
  button,
  DEEP,
  dim,
  GREEN,
  header,
  NAVY_2,
  NAVY_3,
  panel,
  SUB,
  TEXT,
  WHITE,
} from './game.ts';
import { corner, group, label, square, stroke } from './kit.ts';

type Control =
  | { kind: 'slider'; value: number }
  | { kind: 'toggle'; on: boolean }
  | { kind: 'choice'; options: string[]; picked: number };

const OPTIONS: [string, string, Control][] = [
  ['Music', 'Music', { kind: 'slider', value: 0.7 }],
  ['Effects', 'Sound effects', { kind: 'slider', value: 0.45 }],
  ['Graphics', 'Graphics', { kind: 'choice', options: ['Low', 'Medium', 'High'], picked: 2 }],
  ['ShowFps', 'Show FPS', { kind: 'toggle', on: true }],
  ['CameraShake', 'Camera shake', { kind: 'toggle', on: false }],
];

export function settingsTemplate(makeId: () => InstanceId = newId): Doc {
  const b = new Builder(makeId);
  const sg = b.add(b.starterGui, 'ScreenGui', { Name: 'Settings' });
  dim(b, sg);
  const menu = panel(b, sg, [0.8, 0, 0.82, 0], 1.15);
  header(b, menu, 'SETTINGS');

  const list = group(b, menu, {
    Name: 'Options',
    Position: [0.05, 0, 0.15, 0],
    Size: [0.9, 0, 0.67, 0],
  });
  b.add(list, 'UIListLayout', { Padding: [0.03, 0] });
  OPTIONS.forEach(([name, text, control], i) => {
    const row = b.add(list, 'Frame', {
      Name: name,
      LayoutOrder: i + 1,
      Size: [1, 0, 0.176, 0],
      BackgroundColor3: NAVY_2,
    });
    corner(b, row, [0, 12]);
    label(b, row, {
      Name: 'Label',
      Position: [0.05, 0, 0.3, 0],
      Size: [0.45, 0, 0.4, 0],
      Text: text,
      Font: 'Gotham',
      FontWeight: 'Bold',
      TextScaled: true,
      TextColor3: TEXT,
      TextXAlignment: 'Left',
    });
    if (control.kind === 'slider') addSlider(b, row, control.value);
    else if (control.kind === 'toggle') addToggle(b, row, control.on);
    else addChoice(b, row, control.options, control.picked);
  });

  const actions = group(b, menu, {
    Name: 'Actions',
    Position: [0.05, 0, 0.85, 0],
    Size: [0.9, 0, 0.1, 0],
  });
  b.add(actions, 'UIListLayout', {
    FillDirection: 'Horizontal',
    HorizontalAlignment: 'Right',
    Padding: [0.03, 0],
  });
  button(b, actions, 'ResetButton', 'RESET', NAVY_3, { LayoutOrder: 1, Size: [0.3, 0, 1, 0] });
  button(b, actions, 'SaveButton', 'SAVE', GREEN, { LayoutOrder: 2, Size: [0.3, 0, 1, 0] });
  return b.doc;
}

/** The right-hand side of a row, where its control goes. */
const controlPlace = (width: number, height: number) =>
  ({
    AnchorPoint: [1, 0.5],
    Position: [0.95, 0, 0.5, 0],
    Size: [width, 0, height, 0],
  }) as const;

function addSlider(b: Builder, row: InstanceId, value: number) {
  const slider = group(b, row, { Name: 'Slider', ...controlPlace(0.42, 0.42) });
  const track = b.add(slider, 'Frame', {
    Name: 'Track',
    AnchorPoint: [0, 0.5],
    Position: [0, 0, 0.5, 0],
    Size: [1, 0, 0.3, 0],
    BackgroundColor3: DEEP,
  });
  corner(b, track, [0.5, 0]);
  const fill = b.add(track, 'Frame', {
    Name: 'Fill',
    Size: [value, 0, 1, 0],
    BackgroundColor3: BLUE,
  });
  corner(b, fill, [0.5, 0]);
  const knob = b.add(slider, 'TextButton', {
    Name: 'Knob',
    AnchorPoint: [0.5, 0.5],
    Position: [value, 0, 0.5, 0],
    Size: [1, 0, 1, 0],
    BackgroundColor3: WHITE,
    Text: '',
  });
  square(b, knob);
  corner(b, knob, [0.5, 0]);
  stroke(b, knob, BLUE, 3, { ApplyStrokeMode: 'Border' });
}

function addToggle(b: Builder, row: InstanceId, on: boolean) {
  const toggle = b.add(row, 'TextButton', {
    Name: 'Toggle',
    ...controlPlace(0.15, 0.5),
    BackgroundColor3: on ? [56, 186, 92] : NAVY_3,
    Text: '',
  });
  corner(b, toggle, [0.5, 0]);
  const knob = b.add(toggle, 'Frame', {
    Name: 'Knob',
    AnchorPoint: [on ? 1 : 0, 0.5],
    Position: [on ? 0.94 : 0.06, 0, 0.5, 0],
    Size: [1, 0, 0.78, 0],
    BackgroundColor3: WHITE,
  });
  square(b, knob);
  corner(b, knob, [0.5, 0]);
}

function addChoice(b: Builder, row: InstanceId, options: string[], picked: number) {
  const choice = b.add(row, 'Frame', {
    Name: 'Choice',
    ...controlPlace(0.46, 0.56),
    BackgroundColor3: DEEP,
  });
  corner(b, choice, [0.5, 0]);
  b.add(choice, 'UIPadding', {
    PaddingTop: [0.1, 0],
    PaddingBottom: [0.1, 0],
    PaddingLeft: [0.02, 0],
    PaddingRight: [0.02, 0],
  });
  b.add(choice, 'UIListLayout', { FillDirection: 'Horizontal', Padding: [0.02, 0] });
  options.forEach((text, i) => {
    const on = i === picked;
    const id = b.add(choice, 'TextButton', {
      Name: text,
      LayoutOrder: i + 1,
      Size: [0.32, 0, 1, 0],
      BackgroundColor3: BLUE,
      BackgroundTransparency: on ? 0 : 1,
      Text: text,
      Font: 'Gotham',
      FontWeight: 'Bold',
      TextScaled: true,
      TextColor3: on ? WHITE : SUB,
    });
    corner(b, id, [0.5, 0]);
    b.add(id, 'UIPadding', { PaddingTop: [0.24, 0], PaddingBottom: [0.24, 0] });
  });
}
