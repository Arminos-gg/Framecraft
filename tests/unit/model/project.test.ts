import { describe, expect, it } from 'vitest';
import prototypeFile from './prototype-project.json';
import { addAsset, assetIdFor } from '../../../src/model/assets.ts';
import { applyCommand, insert, setPreview } from '../../../src/model/commands.ts';
import {
  childOfClass,
  createInstance,
  ModelError,
  serviceOf,
  single,
  type AnyInstance,
} from '../../../src/model/document.ts';
import {
  FILE_VERSION,
  loadProject,
  parseProject,
  serializeProject,
} from '../../../src/model/project.ts';
import { colorSequence, numberSequence } from '../../../src/model/values.ts';
import { bp, byName, childNames, expectValid, sample, shape, site } from './helpers.ts';

const v1 = () =>
  structuredClone(prototypeFile) as {
    format: string;
    version: number;
    doc: Record<string, unknown>;
  };

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const GIF = 'data:image/gif;base64,R0lGODlh';

/** A file as PR #2 saved it: StarterGui root, `className`, previews kept on the object. */
const v2 = () => ({
  format: 'framecraft',
  version: 2,
  doc: {
    rootId: 'root',
    instances: {
      root: {
        id: 'root',
        className: 'StarterGui',
        parent: null,
        children: ['menu'],
        props: { Name: 'StarterGui' },
      },
      menu: {
        id: 'menu',
        className: 'ScreenGui',
        parent: 'root',
        children: ['a', 'b'],
        props: { Name: 'Menu' },
      },
      a: {
        id: 'a',
        className: 'ImageLabel',
        parent: 'menu',
        children: [],
        props: { Name: 'A' },
        preview: PNG,
      },
      b: {
        id: 'b',
        className: 'ImageLabel',
        parent: 'menu',
        children: [],
        props: { Name: 'B' },
        preview: PNG,
      },
    },
  },
});

describe('opening prototype files (version 1)', () => {
  it('opens the prototype sample exactly as the ported sample', () => {
    const { doc, assets } = loadProject(v1());
    expectValid(doc);
    expect(shape(doc)).toEqual(shape(sample()));
    expect(assets).toEqual({});
  });

  it('puts the screens in StarterGui and adds an empty Site and the default breakpoints', () => {
    const { doc } = loadProject(v1());
    expect(doc.instances[doc.rootId]!.className).toBe('DataModel');
    expect(childNames(doc, doc.rootId)).toEqual(['StarterGui', 'Site', 'Tablet', 'Phone']);
    expect(childNames(doc, serviceOf(doc, 'StarterGui').id)).toEqual(['MainMenu']);
    expect(serviceOf(doc, 'Site').children).toEqual([]);
    // The old root keeps its id, so nothing else in the file needs renaming.
    expect(serviceOf(doc, 'StarterGui').id).toBe('root');
  });

  it('opens a prototype autosave, which is the bare document', () => {
    expect(shape(loadProject(v1().doc).doc)).toEqual(shape(sample()));
  });

  it('renames the UIGradient properties', () => {
    const { doc } = loadProject(v1());
    const gradient = childOfClass(doc, byName(doc, 'CoinIcon').id, 'UIGradient');
    expect(gradient?.props).toEqual({
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
    const panel = byName(loadProject(file).doc, 'Panel');
    expect(panel.props).toMatchObject({ Size: [0, 200, 0, 140], ZIndex: 1 });
    expect(panel.props).not.toHaveProperty('Glow');
  });
});

describe('opening version 2 files', () => {
  it('moves preview pictures into the image library, one copy per picture', () => {
    const { doc, assets } = loadProject(v2());
    expectValid(doc);
    const id = assetIdFor(PNG);
    expect(doc.instances.a!.preview).toBe(id);
    expect(doc.instances.b!.preview).toBe(id);
    expect(assets).toEqual({ [id]: PNG });
    expect(childNames(doc, serviceOf(doc, 'StarterGui').id)).toEqual(['Menu']);
  });

  it('drops a preview that is not an image', () => {
    const file = v2();
    (file.doc.instances.a as Record<string, unknown>).preview = 'javascript:alert(1)';
    const { doc, assets } = loadProject(file);
    expect(doc.instances.a!.preview).toBeUndefined();
    expect(Object.keys(assets)).toHaveLength(1);
  });

  it('refuses a version 2 file whose root is not a StarterGui', () => {
    const file = v2();
    (file.doc.instances.root as Record<string, unknown>).className = 'DataModel';
    expect(() => loadProject(file)).toThrow("isn't a Framecraft project");
  });
});

describe(`saving and opening (version ${FILE_VERSION})`, () => {
  it('round-trips the game menu', () => {
    const doc = sample();
    const text = serializeProject(doc);
    expect(JSON.parse(text)).toMatchObject({ format: 'framecraft', version: 3, assets: {} });
    expect(parseProject(text)).toEqual({ doc, assets: {} });
  });

  it('round-trips the website, with its changes per breakpoint', () => {
    const doc = site();
    const opened = parseProject(serializeProject(doc)).doc;
    expect(opened).toEqual(doc);
    expect(byName(opened, 'Headline').overrides).toEqual({
      [bp(doc, 'Tablet')]: { Size: [1, -96, 0, 140], TextSize: 44 },
      [bp(doc, 'Phone')]: { Size: [1, -48, 0, 160], TextSize: 34 },
    });
  });

  it('keeps image previews and writes only the images in use', () => {
    const base = sample();
    let library = addAsset({}, PNG);
    const used = library.id;
    library = addAsset(library.assets, GIF);
    const img = createInstance('ImageLabel', { Image: 'rbxassetid://1' }, 'img') as AnyInstance;
    const withImage = applyCommand(base, insert(byName(base, 'Panel').id, single(img))).doc;
    const doc = applyCommand(withImage, setPreview('img', used)).doc;

    const text = serializeProject(doc, library.assets);
    expect(Object.keys(JSON.parse(text).assets)).toEqual([used]);
    const opened = parseProject(text);
    expect(opened.doc.instances.img!.preview).toBe(used);
    expect(opened.assets).toEqual({ [used]: PNG });
  });

  it('drops changes for breakpoints that are gone and values that may not differ', () => {
    const doc = site();
    const file = JSON.parse(serializeProject(doc));
    const headline = file.doc.instances[byName(doc, 'Headline').id];
    headline.overrides[bp(doc, 'Tablet')] = { Text: 'Hi', TextSize: 'huge' };
    headline.overrides.gone = { TextSize: 10 };
    const opened = loadProject(file).doc;
    expectValid(opened);
    expect(byName(opened, 'Headline').overrides).toEqual({
      [bp(doc, 'Phone')]: { Size: [1, -48, 0, 160], TextSize: 34 },
    });
  });

  it('drops library entries that are not images', () => {
    const file = JSON.parse(serializeProject(sample()));
    file.assets = { img_abc: 'https://example.com/a.png', bad: PNG, [assetIdFor(GIF)]: GIF };
    expect(loadProject(file).assets).toEqual({ [assetIdFor(GIF)]: GIF });
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
    fails({ format: 'framecraft', version: FILE_VERSION + 1, doc: {} }, 'newer version');
    const unknownClass = v1();
    const nodes = unknownClass.doc.nodes as Record<string, { cls: string }>;
    Object.values(nodes)[2]!.cls = 'BillboardGui';
    fails(unknownClass, "class Framecraft doesn't know: BillboardGui");
    const broken = v1();
    (broken.doc.nodes as Record<string, unknown>)['n2pax0'] = undefined;
    fails(broken, 'damaged');
  });

  it('refuses a version 3 file without a Site', () => {
    const doc = sample();
    const file = JSON.parse(serializeProject(doc));
    const siteId = serviceOf(doc, 'Site').id;
    delete file.doc.instances[siteId];
    const root = file.doc.instances[doc.rootId];
    root.children = root.children.filter((c: string) => c !== siteId);
    fails(file, 'no Site');
  });
});
