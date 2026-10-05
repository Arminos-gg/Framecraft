import { describe, expect, it } from 'vitest';
import prototypeFile from '../../../prototype/examples/sample-project.json';
import { applyCommand, insert, setPreview } from '../../../src/model/commands.ts';
import {
  createInstance,
  ModelError,
  single,
  type AnyInstance,
} from '../../../src/model/document.ts';
import { loadProject, parseProject, serializeProject } from '../../../src/model/project.ts';
import { colorSequence, numberSequence } from '../../../src/model/values.ts';
import { byName, expectValid, sample, shape } from './helpers.ts';

const v1 = () =>
  structuredClone(prototypeFile) as {
    format: string;
    version: number;
    doc: Record<string, unknown>;
  };

describe('opening prototype files (version 1)', () => {
  it('opens the prototype sample exactly as the ported sample', () => {
    const doc = loadProject(v1());
    expectValid(doc);
    expect(shape(doc)).toEqual(shape(sample()));
  });

  it('opens a prototype autosave, which is the bare document', () => {
    expect(shape(loadProject(v1().doc))).toEqual(shape(sample()));
  });

  it('renames the UIGradient properties', () => {
    const doc = loadProject(v1());
    const icon = byName(doc, 'CoinIcon');
    const gradient = icon.children
      .map((c) => doc.instances[c]!)
      .find((c) => c.className === 'UIGradient')!;
    expect(gradient.props).toEqual({
      Name: 'UIGradient',
      Color: colorSequence([255, 255, 255], [222, 158, 30]),
      Transparency: numberSequence(0, 0),
      Rotation: 90,
    });
  });

  it('falls back to defaults for missing or invalid properties and drops unknown ones', () => {
    const file = v1();
    const nodes = file.doc.nodes as Record<string, { props: Record<string, unknown> }>;
    const panelKey = Object.keys(nodes).find((k) => nodes[k]!.props.Name === 'Panel')!;
    const props = nodes[panelKey]!.props;
    props.Size = 'big';
    delete props.ZIndex;
    props.Glow = true;
    const panel = byName(loadProject(file), 'Panel');
    expect(panel.props).toMatchObject({ Size: [0, 200, 0, 140], ZIndex: 1 });
    expect(panel.props).not.toHaveProperty('Glow');
  });
});

describe('saving and opening (version 2)', () => {
  it('round-trips a document', () => {
    const doc = sample();
    const text = serializeProject(doc);
    expect(JSON.parse(text)).toMatchObject({ format: 'framecraft', version: 2 });
    expect(parseProject(text)).toEqual(doc);
  });

  it('keeps image previews', () => {
    const base = sample();
    const img = createInstance('ImageLabel', { Image: 'rbxassetid://1' }, 'img') as AnyInstance;
    const withImage = applyCommand(base, insert(byName(base, 'Panel').id, single(img))).doc;
    const doc = applyCommand(withImage, setPreview('img', 'data:image/png;base64,AAAA')).doc;
    expect(parseProject(serializeProject(doc)).instances.img!.preview).toBe(
      'data:image/png;base64,AAAA',
    );
  });
});

describe('files that cannot be opened', () => {
  const fails = (data: unknown, message: string) =>
    expect(() => loadProject(data)).toThrow(
      expect.objectContaining({ name: 'ModelError', message: expect.stringContaining(message) }),
    );

  it('explains what is wrong', () => {
    expect(() => parseProject('{nope')).toThrow(ModelError);
    fails({ hello: 1 }, "isn't a Framecraft project");
    fails({ format: 'framecraft', version: 3, doc: {} }, 'newer version');
    const unknownClass = v1();
    const nodes = unknownClass.doc.nodes as Record<string, { cls: string }>;
    Object.values(nodes)[2]!.cls = 'BillboardGui';
    fails(unknownClass, "class Framecraft doesn't know: BillboardGui");
    const broken = v1();
    (broken.doc.nodes as Record<string, unknown>)['n2pax0'] = undefined;
    fails(broken, 'damaged');
  });
});
