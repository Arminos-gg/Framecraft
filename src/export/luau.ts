/**
 * Luau export: code that builds the ScreenGuis in Roblox Studio, either from the command bar
 * (into StarterGui) or from a LocalScript (into each player's PlayerGui). It uses the base
 * (Desktop) values and skips everything web only, such as the Site and its pages.
 */
import { classDef, type ClassName } from '../model/classes.ts';
import {
  childrenOf,
  getInstance,
  requireInstance,
  serviceOf,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../model/document.ts';
import type {
  Color3,
  ColorSequence,
  NumberSequence,
  UDim,
  UDim2,
  Vector2,
} from '../model/values.ts';
import { fmtNum } from './format.ts';

export type LuauTarget = 'command' | 'local';

const LUA_KEYWORDS = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
  'continue',
  'export',
  'type',
  'typeof',
  'game',
  'script',
  'workspace',
]);

/** Short names for modifiers in variable names: `panelCorner`, `playButtonGradient`. */
const SHORT: Partial<Record<ClassName, string>> = {
  UIListLayout: 'List',
  UIAspectRatioConstraint: 'Aspect',
  UICorner: 'Corner',
  UIStroke: 'Stroke',
  UIGradient: 'Gradient',
  UIPadding: 'Padding',
};

export const luaStr = (s: string): string =>
  '"' +
  s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') +
  '"';
const luaNum = fmtNum;

export function luaUDim2(u: UDim2): string {
  if (u[1] === 0 && u[3] === 0 && (u[0] !== 0 || u[2] !== 0))
    return `UDim2.fromScale(${luaNum(u[0])}, ${luaNum(u[2])})`;
  if (u[0] === 0 && u[2] === 0) return `UDim2.fromOffset(${luaNum(u[1], 0)}, ${luaNum(u[3], 0)})`;
  return `UDim2.new(${luaNum(u[0])}, ${luaNum(u[1], 0)}, ${luaNum(u[2])}, ${luaNum(u[3], 0)})`;
}
const luaUDim = (u: UDim) => `UDim.new(${luaNum(u[0])}, ${luaNum(u[1], 0)})`;
const luaColor = (c: Color3) => `Color3.fromRGB(${c[0]}, ${c[1]}, ${c[2]})`;
const luaVec2 = (v: Vector2) => `Vector2.new(${luaNum(v[0])}, ${luaNum(v[1])})`;
const isWhite = (c: Color3) => c[0] === 255 && c[1] === 255 && c[2] === 255;

/** Two keypoints use the short constructor; more spell out every keypoint. */
function luaColorSequence(seq: ColorSequence): string {
  if (seq.length === 2)
    return `ColorSequence.new(${luaColor(seq[0]!.value)}, ${luaColor(seq[1]!.value)})`;
  const kps = seq.map((k) => `ColorSequenceKeypoint.new(${luaNum(k.time)}, ${luaColor(k.value)})`);
  return `ColorSequence.new({ ${kps.join(', ')} })`;
}
function luaNumberSequence(seq: NumberSequence): string {
  if (seq.length === 2)
    return `NumberSequence.new(${luaNum(seq[0]!.value)}, ${luaNum(seq[1]!.value)})`;
  const kps = seq.map((k) => `NumberSequenceKeypoint.new(${luaNum(k.time)}, ${luaNum(k.value)})`);
  return `NumberSequence.new({ ${kps.join(', ')} })`;
}

/**
 * The property lines for one instance. Properties whose Roblox default is certain are left
 * out; the rest are always written (see .claude/rules/exporters.md).
 */
function luauProps(inst: AnyInstance): [string, string | number][] {
  const out: [string, string | number][] = [];
  const add = (k: string, v: string | number) => out.push([k, v]);
  const def = classDef(inst.className);
  switch (inst.className) {
    case 'ScreenGui': {
      const p = inst.props;
      add('IgnoreGuiInset', 'true');
      add('ResetOnSpawn', String(p.ResetOnSpawn));
      add('ZIndexBehavior', 'Enum.ZIndexBehavior.Sibling');
      if (p.DisplayOrder) add('DisplayOrder', p.DisplayOrder);
      if (!p.Enabled) add('Enabled', 'false');
      return out;
    }
    case 'UICorner':
      add('CornerRadius', luaUDim(inst.props.CornerRadius));
      return out;
    case 'UIStroke': {
      const p = inst.props;
      add('Color', luaColor(p.Color));
      add('Thickness', luaNum(p.Thickness));
      if (p.Transparency) add('Transparency', luaNum(p.Transparency));
      if (p.ApplyStrokeMode === 'Border') add('ApplyStrokeMode', 'Enum.ApplyStrokeMode.Border');
      return out;
    }
    case 'UIGradient': {
      const p = inst.props;
      add('Color', luaColorSequence(p.Color));
      if (p.Transparency.some((k) => k.value))
        add('Transparency', luaNumberSequence(p.Transparency));
      if (p.Rotation) add('Rotation', luaNum(p.Rotation));
      return out;
    }
    case 'UIPadding': {
      const p = inst.props;
      for (const k of ['PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight'] as const)
        if (p[k][0] || p[k][1]) add(k, luaUDim(p[k]));
      return out;
    }
    case 'UIListLayout': {
      const p = inst.props;
      for (const k of ['FillDirection', 'HorizontalAlignment', 'VerticalAlignment'] as const)
        add(k, `Enum.${k}.${p[k]}`);
      if (p.Padding[0] || p.Padding[1]) add('Padding', luaUDim(p.Padding));
      add('SortOrder', 'Enum.SortOrder.' + p.SortOrder);
      return out;
    }
    case 'UIAspectRatioConstraint':
      add('AspectRatio', luaNum(inst.props.AspectRatio));
      return out;
  }
  if (def.kind !== 'gui') return out;

  const p = inst.props as GuiProps;
  if (p.AnchorPoint[0] || p.AnchorPoint[1]) add('AnchorPoint', luaVec2(p.AnchorPoint));
  if (p.Position.some((x) => x !== 0)) add('Position', luaUDim2(p.Position));
  add('Size', luaUDim2(p.Size));
  if (p.Rotation) add('Rotation', luaNum(p.Rotation));
  add('BackgroundColor3', luaColor(p.BackgroundColor3));
  if (p.BackgroundTransparency) add('BackgroundTransparency', luaNum(p.BackgroundTransparency));
  add('BorderSizePixel', p.BorderSizePixel);
  if (p.BorderSizePixel > 0) add('BorderColor3', luaColor(p.BorderColor3));
  if (p.ZIndex !== 1) add('ZIndex', p.ZIndex);
  if (p.LayoutOrder) add('LayoutOrder', p.LayoutOrder);
  if (!p.Visible) add('Visible', 'false');
  if (p.ClipsDescendants) add('ClipsDescendants', 'true');
  if (def.text) {
    const t = inst.props as TextProps;
    add('Font', 'Enum.Font.' + t.Font);
    add('Text', luaStr(t.Text));
    if (def.input && t.PlaceholderText) add('PlaceholderText', luaStr(t.PlaceholderText));
    add('TextColor3', luaColor(t.TextColor3));
    add('TextSize', t.TextSize);
    if (t.TextScaled) add('TextScaled', 'true');
    if (t.TextWrapped) add('TextWrapped', 'true');
    if (t.TextXAlignment !== 'Center')
      add('TextXAlignment', 'Enum.TextXAlignment.' + t.TextXAlignment);
    if (t.TextYAlignment !== 'Center')
      add('TextYAlignment', 'Enum.TextYAlignment.' + t.TextYAlignment);
    if (t.TextTransparency) add('TextTransparency', luaNum(t.TextTransparency));
  }
  if (def.image) {
    const i = inst.props as ImageProps;
    add('Image', luaStr(i.Image));
    if (!isWhite(i.ImageColor3)) add('ImageColor3', luaColor(i.ImageColor3));
    if (i.ImageTransparency) add('ImageTransparency', luaNum(i.ImageTransparency));
    if (i.ScaleType !== 'Stretch') add('ScaleType', 'Enum.ScaleType.' + i.ScaleType);
  }
  if (def.button && (inst.props as ButtonProps).AutoButtonColor === false)
    add('AutoButtonColor', 'false');
  if (inst.className === 'ScrollingFrame') {
    add('CanvasSize', luaUDim2(inst.props.CanvasSize));
    add('ScrollBarThickness', inst.props.ScrollBarThickness);
  }
  return out;
}

type GuiProps = Extract<AnyInstance, { className: 'Frame' }>['props'];
type TextProps = Extract<AnyInstance, { className: 'TextBox' }>['props'];
type ImageProps = Extract<AnyInstance, { className: 'ImageLabel' }>['props'];
type ButtonProps = Extract<AnyInstance, { className: 'TextButton' }>['props'];

/** Gives each instance a unique camelCase variable name. */
function makeNamer() {
  const used = new Map<string, number>();
  return (inst: AnyInstance, parentVar: string | null): string => {
    const name = inst.props.Name;
    let base = name.replace(/[^A-Za-z0-9_]+(.)?/g, (_, c?: string) => (c ? c.toUpperCase() : ''));
    if (classDef(inst.className).kind === 'modifier' && name === inst.className && parentVar)
      base = parentVar + (SHORT[inst.className] ?? inst.className);
    if (!base) base = inst.className;
    base = base[0]!.toLowerCase() + base.slice(1);
    if (/^[0-9]/.test(base)) base = '_' + base;
    if (LUA_KEYWORDS.has(base)) base += 'Gui';
    const k = used.get(base) ?? 0;
    used.set(base, k + 1);
    return k ? base + (k + 1) : base;
  };
}

/** Writes the code for an instance and everything inside it; returns its variable name. */
function luauBlock(
  doc: Doc,
  rootId: InstanceId,
  namer: ReturnType<typeof makeNamer>,
  lines: string[],
): string {
  const emit = (id: InstanceId, parentVar: string | null): string => {
    const inst = requireInstance(doc, id);
    const v = namer(inst, parentVar);
    if (classDef(inst.className).kind !== 'modifier')
      lines.push('', `-- ${inst.props.Name} (${inst.className})`);
    lines.push(`local ${v} = Instance.new("${inst.className}")`);
    if (inst.props.Name !== inst.className) lines.push(`${v}.Name = ${luaStr(inst.props.Name)}`);
    for (const [k, val] of luauProps(inst)) lines.push(`${v}.${k} = ${val}`);
    for (const c of inst.children) {
      const cv = emit(c, v);
      lines.push(`${cv}.Parent = ${v}`);
    }
    return v;
  };
  return emit(rootId, null);
}

/** Code that builds every ScreenGui in the project. */
export function exportLuau(doc: Doc, target: LuauTarget = 'command'): string {
  const namer = makeNamer();
  const cmd = target === 'command';
  const lines = cmd
    ? [
        '-- Built with Framecraft (prototype)',
        "-- Paste this into Roblox Studio's command bar and press Enter.",
        '-- It creates the UI in StarterGui, where you can keep editing it.',
        'local StarterGui = game:GetService("StarterGui")',
      ]
    : [
        '-- Built with Framecraft (prototype)',
        '-- Put this in a LocalScript inside StarterPlayerScripts.',
        "-- It builds the UI on each player's screen when they join.",
        'local Players = game:GetService("Players")',
        'local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")',
      ];
  const roots: string[] = [];
  for (const sg of childrenOf(doc, serviceOf(doc, 'StarterGui').id)) {
    const v = luauBlock(doc, sg.id, namer, lines);
    lines.push(`${v}.Parent = ${cmd ? 'StarterGui' : 'playerGui'}`);
    roots.push(v);
  }
  if (cmd && roots.length)
    lines.push(
      '',
      '-- Select the new UI so it shows up in the Explorer',
      `game:GetService("Selection"):Set({ ${roots.join(', ')} })`,
    );
  return lines.join('\n') + '\n';
}

/** Code for one object and everything inside it, as the Code tab shows it. */
export function exportLuauSubtree(doc: Doc, id: InstanceId): string {
  const inst = getInstance(doc, id);
  const def = inst && classDef(inst.className);
  // The root, services, breakpoints and pages have no Roblox code of their own.
  if (!inst || !def || def.web || !['container', 'gui', 'modifier'].includes(def.kind))
    return exportLuau(doc, 'command');
  const lines = [
    `-- Code that builds ${inst.props.Name} and everything inside it.`,
    '-- It updates as you edit.',
  ];
  const v = luauBlock(doc, id, makeNamer(), lines);
  const parent = inst.parent === null ? undefined : getInstance(doc, inst.parent);
  const inStarterGui = parent?.className === 'StarterGui';
  lines.push(
    '',
    parent && !inStarterGui
      ? `-- Then parent it to your ${parent.props.Name}:`
      : '-- Then parent it:',
    `-- ${v}.Parent = ${inStarterGui ? 'game:GetService("StarterGui")' : '<' + (parent ? parent.props.Name : 'parent') + '>'}`,
  );
  return lines.join('\n') + '\n';
}
