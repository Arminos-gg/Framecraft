import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { exportLuau, exportLuauSubtree, luaStr, luaUDim2 } from '../../../src/export/luau.ts';
import type { ClassName, PropsOf } from '../../../src/model/classes.ts';
import { applyCommand, insert } from '../../../src/model/commands.ts';
import {
  createInstance,
  serviceOf,
  single,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { colorSequence, numberSequence } from '../../../src/model/values.ts';
import { bp, byName, counterIds, sample, site } from '../model/helpers.ts';

/** A blank project with one ScreenGui, plus a way to add objects. */
function scene() {
  let doc: Doc = blankDoc(counterIds('s'));
  let n = 0;
  const add = <C extends ClassName>(
    parent: InstanceId,
    className: C,
    props: Partial<PropsOf<C>> = {},
  ) => {
    const inst = createInstance(className, props, `o${++n}`) as unknown as AnyInstance;
    doc = applyCommand(doc, insert(parent, single(inst))).doc;
    return inst.id;
  };
  return { screen: byName(doc, 'ScreenGui').id, add, luau: () => exportLuau(doc) };
}

const parses = (code: string) =>
  expect(() => luaparse.parse(code, { luaVersion: '5.1' })).not.toThrow();

describe('Luau values', () => {
  it('picks the shortest UDim2 constructor', () => {
    expect(luaUDim2([0.5, 0, 1, 0])).toBe('UDim2.fromScale(0.5, 1)');
    expect(luaUDim2([0, 20, 0, -4])).toBe('UDim2.fromOffset(20, -4)');
    expect(luaUDim2([0, 0, 0, 0])).toBe('UDim2.fromOffset(0, 0)');
    expect(luaUDim2([1, -20, 0, 52])).toBe('UDim2.new(1, -20, 0, 52)');
  });

  it('escapes strings', () => {
    expect(luaStr('say "hi"\n\tback\\slash')).toBe('"say \\"hi\\"\\n\\tback\\\\slash"');
  });
});

describe('Luau export', () => {
  it('names variables in camelCase, without clashes or keywords', () => {
    const s = scene();
    s.add(s.screen, 'Frame', { Name: 'Play button' });
    s.add(s.screen, 'Frame', { Name: 'Play button' });
    s.add(s.screen, 'Frame', { Name: 'end' });
    s.add(s.screen, 'Frame', { Name: '1st' });
    const code = s.luau();
    expect(code).toContain('local playButton = Instance.new("Frame")');
    expect(code).toContain('local playButton2 = Instance.new("Frame")');
    expect(code).toContain('local endGui = Instance.new("Frame")');
    expect(code).toContain('local _1st = Instance.new("Frame")');
    parses(code);
  });

  it('names modifiers after their parent', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame', { Name: 'Card' });
    s.add(card, 'UICorner');
    s.add(card, 'UIStroke', { Name: 'Outline' });
    const code = s.luau();
    expect(code).toContain('local cardCorner = Instance.new("UICorner")');
    expect(code).toContain('local outline = Instance.new("UIStroke")');
  });

  it('writes gradients with more than two keypoints in full', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame', { Name: 'Card' });
    s.add(card, 'UIGradient', {
      Color: colorSequence([255, 0, 0], [0, 255, 0], [0, 0, 255]),
      Transparency: numberSequence(0, 0.5),
    });
    const code = s.luau();
    expect(code).toContain(
      'cardGradient.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 0, 0)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(0, 255, 0)), ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 0, 255)) })',
    );
    expect(code).toContain('cardGradient.Transparency = NumberSequence.new(0, 0.5)');
    parses(code);
  });

  it('parents each object after its children, and the ScreenGui last', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame', { Name: 'Card' });
    s.add(card, 'TextLabel', { Name: 'Title' });
    const lines = s.luau().split('\n');
    const at = (line: string) => lines.indexOf(line);
    expect(at('title.Parent = card')).toBeLessThan(at('card.Parent = screenGui'));
    expect(at('card.Parent = screenGui')).toBeLessThan(at('screenGui.Parent = StarterGui'));
  });

  it('leaves out the website: no pages, only the ScreenGuis', () => {
    const code = exportLuau(site());
    expect(code).not.toContain('Instance.new');
    expect(code).not.toContain('Selection');
    parses(code);
  });

  it('writes AutomaticSize when it is on', () => {
    const s = scene();
    s.add(s.screen, 'TextLabel', { Name: 'Tag', AutomaticSize: 'XY' });
    s.add(s.screen, 'Frame', { Name: 'Plain' });
    const code = s.luau();
    expect(code).toContain('tag.AutomaticSize = Enum.AutomaticSize.XY');
    expect(code).not.toContain('plain.AutomaticSize');
    parses(code);
  });

  it('writes LineHeight and AutomaticCanvasSize when they aren’t the defaults', () => {
    const s = scene();
    s.add(s.screen, 'TextLabel', { Name: 'Story', LineHeight: 1.25 });
    s.add(s.screen, 'TextLabel', { Name: 'Plain' });
    s.add(s.screen, 'ScrollingFrame', { Name: 'List', AutomaticCanvasSize: 'Y' });
    s.add(s.screen, 'ScrollingFrame', { Name: 'Fixed' });
    const code = s.luau();
    expect(code).toContain('story.LineHeight = 1.25');
    expect(code).not.toContain('plain.LineHeight');
    expect(code).toContain('list.AutomaticCanvasSize = Enum.AutomaticSize.Y');
    expect(code).not.toContain('fixed.AutomaticCanvasSize');
    parses(code);
  });

  it('writes a Roblox font as Enum.Font, and any other face as FontFace', () => {
    const s = scene();
    s.add(s.screen, 'TextLabel', { Name: 'Bold', Font: 'Gotham', FontWeight: 'Bold' });
    s.add(s.screen, 'TextLabel', { Name: 'Italic', Font: 'SourceSans', FontStyle: 'Italic' });
    s.add(s.screen, 'TextLabel', { Name: 'Semi', Font: 'Gotham', FontWeight: 'SemiBold' });
    s.add(s.screen, 'TextLabel', { Name: 'Mont', Font: 'Montserrat' });
    s.add(s.screen, 'TextLabel', {
      Name: 'Web',
      Font: 'Inter',
      FontWeight: 'Bold',
      FontStyle: 'Italic',
      LetterSpacing: 2,
    });
    const code = s.luau();
    expect(code).toContain('bold.Font = Enum.Font.GothamBold');
    expect(code).toContain('italic.Font = Enum.Font.SourceSansItalic');
    expect(code).toContain(
      'semi.FontFace = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.SemiBold)',
    );
    expect(code).toContain('mont.FontFace = Font.new("rbxasset://fonts/families/Montserrat.json")');
    // Roblox has no Inter, so the closest Roblox font stands in, and it says so.
    expect(code).toContain(
      'web.FontFace = Font.new("rbxasset://fonts/families/BuilderSans.json", Enum.FontWeight.Bold, Enum.FontStyle.Italic) -- Inter isn\'t in Roblox, so BuilderSans stands in',
    );
    // Letter spacing is web only.
    expect(code).not.toContain('LetterSpacing');
    expect(code).not.toContain('FontWeight =');
    parses(code);
  });

  it('uses the base values, not a breakpoint’s', () => {
    const doc = site();
    const sg = createInstance('ScreenGui', { Name: 'Hud' }, 'hud') as AnyInstance;
    const bar = createInstance('Frame', { Name: 'Bar', Size: [1, 0, 0, 40] }, 'bar') as AnyInstance;
    let next = applyCommand(doc, insert(serviceOf(doc, 'StarterGui').id, single(sg))).doc;
    next = applyCommand(next, insert('hud', single(bar))).doc;
    next = applyCommand(next, {
      type: 'setProps',
      id: 'bar',
      props: { Size: [1, 0, 0, 80] },
      breakpoint: bp(next, 'Phone'),
    }).doc;
    const code = exportLuau(next);
    expect(code).toContain('bar.Size = UDim2.new(1, 0, 0, 40)');
    expect(code).not.toContain('80');
  });
});

describe('Luau for one object', () => {
  it('builds the object and says where to parent it', () => {
    const doc = sample();
    const code = exportLuauSubtree(doc, byName(doc, 'Coins').id);
    expect(code.split('\n')[0]).toBe('-- Code that builds Coins and everything inside it.');
    expect(code).toContain('local coinIcon = Instance.new("Frame")');
    expect(code).toContain('-- Then parent it to your MainMenu:\n-- coins.Parent = <MainMenu>');
    expect(code).not.toContain('ScreenGui');
    parses(code);
  });

  it('parents a ScreenGui to StarterGui', () => {
    const doc = sample();
    expect(exportLuauSubtree(doc, byName(doc, 'MainMenu').id)).toContain(
      '-- mainMenu.Parent = game:GetService("StarterGui")',
    );
  });

  it('falls back to the whole project for services, breakpoints and pages', () => {
    const doc = sample();
    const whole = exportLuau(doc);
    expect(exportLuauSubtree(doc, serviceOf(doc, 'StarterGui').id)).toBe(whole);
    expect(exportLuauSubtree(doc, serviceOf(doc, 'Site').id)).toBe(whole);
    expect(exportLuauSubtree(doc, doc.rootId)).toBe(whole);
    expect(exportLuauSubtree(doc, 'missing')).toBe(whole);
  });
});
