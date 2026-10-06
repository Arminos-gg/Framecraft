import { describe, expect, it } from 'vitest';
import { ENUM_TOKENS, exportRbxmx, fontFace, xmlText } from '../../../src/export/rbxmx.ts';
import {
  CLASSES,
  MODIFIER_CLASSES,
  OBJECT_CLASSES,
  propNames,
  propSpec,
  type ClassName,
  type PropsOf,
} from '../../../src/model/classes.ts';
import { applyCommand, insert } from '../../../src/model/commands.ts';
import {
  createInstance,
  serviceOf,
  single,
  subtreeIds,
  type AnyInstance,
  type Doc,
  type InstanceId,
} from '../../../src/model/document.ts';
import {
  FONT_NAMES,
  type FontName,
  type FontStyle,
  type FontWeight,
} from '../../../src/model/fonts.ts';
import { blankDoc } from '../../../src/model/sample.ts';
import { TEMPLATES } from '../../../src/model/templates/index.ts';
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
  return { screen: byName(doc, 'ScreenGui').id, add, xml: () => exportRbxmx(doc) };
}

/** The <Properties> block of the Item whose Name is `name`. */
function propsOf(xml: string, name: string): string {
  const at = xml.indexOf(`<string name="Name">${name}</string>`);
  expect(at, `an Item named ${name}`).toBeGreaterThan(-1);
  return xml.slice(at, xml.indexOf('</Properties>', at));
}

/** Fails unless every tag is closed in order: the file is well-formed XML. */
function expectWellFormed(xml: string) {
  const stack: string[] = [];
  for (const [, close, tag, selfClosing] of xml.matchAll(/<(\/?)([A-Za-z0-9]+)[^>]*?(\/?)>/g)) {
    if (selfClosing) continue;
    if (close) expect(stack.pop(), `closing ${tag}`).toBe(tag);
    else stack.push(tag!);
  }
  expect(stack).toEqual([]);
  expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|#13;)/);
}

describe('Roblox model file values', () => {
  it('has a Roblox number for every option of every enum it writes', () => {
    const FONT_FACE = new Set(['Font', 'FontWeight', 'FontStyle']);
    for (const className of Object.keys(CLASSES) as ClassName[]) {
      if ((CLASSES[className] as { web?: boolean }).web) continue;
      for (const prop of propNames(className) as string[]) {
        const spec = propSpec(className, prop)!;
        if (spec.type !== 'enum' || spec.web || FONT_FACE.has(prop)) continue;
        for (const option of spec.options!)
          expect(ENUM_TOKENS[prop]?.[option], `${className}.${prop} ${option}`).toBeTypeOf(
            'number',
          );
      }
    }
  });

  it('writes every font as the FontFace Studio gives it', () => {
    const face = (font: FontName, weight: FontWeight = 'Regular', style: FontStyle = 'Normal') =>
      fontFace({ font, weight, style });
    for (const font of FONT_NAMES) expect(face(font)).toMatch(/families\/\w+\.json/);
    expect(face('Gotham', 'Heavy')).toBe(
      '<Font name="FontFace"><Family><url>rbxasset://fonts/families/GothamSSm.json</url></Family><Weight>900</Weight><Style>Normal</Style></Font>',
    );
    expect(face('SourceSans', 'Regular', 'Italic')).toContain('<Style>Italic</Style>');
    expect(face('Arcade')).toContain('PressStart2P.json');
    // Roblox has Montserrat; Inter isn't in Roblox, so BuilderSans stands in.
    expect(face('Montserrat', 'SemiBold')).toContain('Montserrat.json</url></Family><Weight>600');
    expect(face('Inter', 'Bold')).toContain('BuilderSans.json</url></Family><Weight>700');
  });

  it('escapes text and drops characters XML can’t hold', () => {
    expect(xmlText('a & <b> "c"\r\n\u0001')).toBe('a &amp; &lt;b&gt; "c"&#13;\n');
  });
});

describe('Roblox model file export', () => {
  it('writes every Roblox property of every class, defaults included', () => {
    const s = scene();
    const frame = s.add(s.screen, 'Frame');
    for (const c of OBJECT_CLASSES) s.add(s.screen, c);
    for (const c of MODIFIER_CLASSES) s.add(frame, c);
    const xml = s.xml();
    expectWellFormed(xml);
    for (const c of ['ScreenGui', ...OBJECT_CLASSES, ...MODIFIER_CLASSES] as ClassName[]) {
      const props = propsOf(xml, c);
      for (const prop of propNames(c) as string[]) {
        // FontWeight and FontStyle go into the FontFace that Font writes.
        if (propSpec(c, prop)!.web || prop === 'FontWeight' || prop === 'FontStyle') {
          expect(props).not.toContain(`name="${prop}"`);
          continue;
        }
        expect(props, `${c}.${prop}`).toContain(`name="${prop === 'Font' ? 'FontFace' : prop}"`);
      }
    }
  });

  it('writes values in Roblox’s types', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame', {
      Name: 'Card',
      Position: [0.5, -10, 0, 20],
      AnchorPoint: [0.5, 0],
      BackgroundColor3: [255, 128, 0],
      BackgroundTransparency: 0.25,
    });
    s.add(card, 'UICorner', { CornerRadius: [0.5, 0] });
    s.add(card, 'UIGradient', {
      Color: colorSequence([255, 0, 0], [0, 0, 255]),
      Transparency: numberSequence(0, 0.5, 1),
    });
    s.add(card, 'TextLabel', {
      Name: 'Title',
      Text: 'Fish & <chips>',
      TextSize: 24,
      TextXAlignment: 'Left',
      AutomaticSize: 'Y',
    });
    s.add(card, 'ImageLabel', { Name: 'Icon', Image: 'rbxassetid://123', ScaleType: 'Fit' });
    s.add(card, 'ImageLabel', { Name: 'Blank' });
    const xml = s.xml();
    expectWellFormed(xml);

    const c = propsOf(xml, 'Card');
    expect(c).toContain(
      '<UDim2 name="Position"><XS>0.5</XS><XO>-10</XO><YS>0</YS><YO>20</YO></UDim2>',
    );
    expect(c).toContain('<Vector2 name="AnchorPoint"><X>0.5</X><Y>0</Y></Vector2>');
    expect(c).toContain('<Color3 name="BackgroundColor3"><R>1</R><G>0.501961</G><B>0</B></Color3>');
    expect(c).toContain('<float name="BackgroundTransparency">0.25</float>');
    expect(c).toContain('<int name="BorderSizePixel">0</int>');
    expect(xml).toContain('<UDim name="CornerRadius"><S>0.5</S><O>0</O></UDim>');
    expect(xml).toContain('<ColorSequence name="Color">0 1 0 0 0 1 0 0 1 0 </ColorSequence>');
    expect(xml).toContain(
      '<NumberSequence name="Transparency">0 0 0 0.5 0.5 0 1 1 0 </NumberSequence>',
    );

    const t = propsOf(xml, 'Title');
    expect(t).toContain('<string name="Text">Fish &amp; &lt;chips&gt;</string>');
    expect(t).toContain('<float name="TextSize">24</float>');
    expect(t).toContain('<token name="TextXAlignment">0</token>');
    expect(t).toContain('<token name="AutomaticSize">2</token>');
    expect(t).toContain('rbxasset://fonts/families/SourceSansPro.json');

    expect(propsOf(xml, 'Icon')).toContain(
      '<Content name="Image"><url>rbxassetid://123</url></Content>',
    );
    expect(propsOf(xml, 'Icon')).toContain('<token name="ScaleType">3</token>');
    expect(propsOf(xml, 'Blank')).toContain('<Content name="Image"><null></null></Content>');
  });

  it('gives each ScreenGui the full screen and sibling ZIndex, as the Luau does', () => {
    const s = scene();
    const sg = propsOf(s.xml(), 'ScreenGui');
    expect(sg).toContain('<bool name="IgnoreGuiInset">true</bool>');
    expect(sg).toContain('<token name="ZIndexBehavior">1</token>');
  });

  it('nests children inside their parent’s Item, with unique referents', () => {
    const s = scene();
    const card = s.add(s.screen, 'Frame', { Name: 'Card' });
    s.add(card, 'TextLabel', { Name: 'Title' });
    s.add(s.screen, 'Frame', { Name: 'Other' });
    const xml = s.xml();
    const at = (text: string) => xml.indexOf(text);
    const cardEnd = xml.indexOf('</Item>', at('>Title<'));
    expect(at('>Card<')).toBeLessThan(at('>Title<'));
    expect(cardEnd).toBeLessThan(at('>Other<'));
    const refs = [...xml.matchAll(/referent="(RBX[0-9A-F]{32})"/g)].map((m) => m[1]);
    expect(refs).toHaveLength(4);
    expect(new Set(refs).size).toBe(4);
  });

  it('exports one screen when asked', () => {
    const doc = sample();
    const one = exportRbxmx(doc, [byName(doc, 'MainMenu').id]);
    expect([...one.matchAll(/<Item /g)]).toHaveLength(
      subtreeIds(doc, byName(doc, 'MainMenu').id).length,
    );
  });

  it('leaves out the website', () => {
    const xml = exportRbxmx(site());
    expect(xml).not.toContain('<Item');
    expectWellFormed(xml);
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
    expect(propsOf(exportRbxmx(next), 'Bar')).toContain('<YO>40</YO>');
  });

  it('writes every object of every Roblox template', () => {
    for (const t of TEMPLATES.filter((t) => t.kind === 'roblox')) {
      const doc = t.build(counterIds());
      const xml = exportRbxmx(doc);
      expectWellFormed(xml);
      const objects = subtreeIds(doc, serviceOf(doc, 'StarterGui').id).length - 1;
      expect([...xml.matchAll(/<Item /g)], t.name).toHaveLength(objects);
    }
  });
});
