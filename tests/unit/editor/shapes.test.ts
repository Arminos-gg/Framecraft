import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../../src/editor/editor.ts';
import { SHAPE_COLOR, SHAPES, shapeName, shapePicture } from '../../../src/editor/shapes.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { isImageDataUrl, svgDataUrl } from '../../../src/model/assets.ts';
import { validateDoc, type AnyInstance, type InstanceId } from '../../../src/model/document.ts';
import { sampleProject } from '../../../src/model/sample.ts';

let ed: Editor;
beforeEach(() => {
  ed = new Editor(sampleProject());
  ed.select(id('MainMenu'));
});

const byName = (name: string): AnyInstance =>
  Object.values(ed.doc.instances).find((i) => i.props.Name === name)!;
const id = (name: string): InstanceId => byName(name).id;
const inst = (i: InstanceId) => ed.doc.instances[i]!;
const props = (i: InstanceId) => inst(i).props as Record<string, unknown>;

describe('shapes', () => {
  it('have unique ids and one-word names', () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    for (const s of SHAPES) expect(shapeName(s)).toMatch(/^[A-Z][A-Za-z]*$/);
    expect(shapeName(SHAPES.find((s) => s.id === 'right-triangle')!)).toBe('RightTriangle');
  });

  it('draw picture shapes as white SVGs that stretch', () => {
    for (const s of SHAPES) {
      const url = shapePicture(s);
      if (s.kind === 'frame') expect(url).toBeUndefined();
      else {
        expect(isImageDataUrl(url)).toBe(true);
        const svg = new TextDecoder().decode(
          Uint8Array.from(atob(url!.split(',')[1]!), (c) => c.charCodeAt(0)),
        );
        expect(svg).toContain('preserveAspectRatio="none"');
        expect(svg).toContain('fill="#fff"');
      }
    }
  });

  it('inserts a circle as a Frame with a UICorner and an aspect ratio', () => {
    const circle = ed.insertShape('circle')!;
    expect(inst(circle).className).toBe('Frame');
    expect(inst(circle).parent).toBe(id('MainMenu'));
    expect(props(circle)).toMatchObject({
      Name: 'Circle',
      Size: [0, 100, 0, 100],
      BackgroundColor3: SHAPE_COLOR,
    });
    const kids = inst(circle).children.map(inst);
    expect(kids.map((k) => k.className)).toEqual(['UICorner', 'UIAspectRatioConstraint']);
    expect(kids[0]!.props).toMatchObject({ CornerRadius: [0.5, 0] });
    expect(validateDoc(ed.doc)).toEqual([]);
    expect(ed.state.selection).toBe(circle);
    ed.undo();
    expect(ed.doc.instances[circle]).toBeUndefined();
  });

  it('inserts a star as a tinted ImageLabel with its picture in the library', () => {
    const star = ed.insertShape('star')!;
    const i = inst(star);
    expect(i.className).toBe('ImageLabel');
    expect(props(star)).toMatchObject({
      Name: 'Star',
      BackgroundTransparency: 1,
      ImageColor3: SHAPE_COLOR,
    });
    expect(ed.state.assets[i.preview!]).toBe(shapePicture(SHAPES.find((s) => s.id === 'star')!));
    // Roblox gets the ImageLabel and its tint; the picture needs an uploaded asset id there.
    expect(exportLuau(ed.doc)).toContain('ImageColor3 = Color3.fromRGB(68, 114, 196)');
    // The same shape twice keeps one picture.
    ed.insertShape('star');
    expect(Object.keys(ed.state.assets)).toHaveLength(1);
  });

  it('ignores an unknown shape', () => {
    expect(ed.insertShape('blob')).toBeNull();
  });
});

describe('pictures', () => {
  const svg = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>');

  it('inserts a pasted picture at its size, up to 400 px a side', () => {
    const small = ed.insertPicture({ dataUrl: svg, width: 24, height: 24, name: 'Bell' })!;
    expect(props(small)).toMatchObject({
      Name: 'Bell',
      Size: [0, 24, 0, 24],
      BackgroundTransparency: 1,
      ImageColor3: [255, 255, 255],
    });
    expect(ed.state.assets[inst(small).preview!]).toBe(svg);
    const big = ed.insertPicture({ dataUrl: svg, width: 1600, height: 900 })!;
    expect(props(big)).toMatchObject({ Name: 'ImageLabel', Size: [0, 400, 0, 225] });
  });

  it('colors a one-color SVG black, so ImageColor3 can recolor it', () => {
    const icon = ed.insertPicture({ dataUrl: svg, width: 24, height: 24, recolor: true })!;
    expect(props(icon).ImageColor3).toEqual([0, 0, 0]);

    const image = ed.insert('ImageLabel')!;
    ed.setImagePreview(image, { dataUrl: svg, recolor: true });
    expect(props(image).ImageColor3).toEqual([0, 0, 0]);
    // One undo step takes back both.
    ed.undo();
    expect(inst(image).preview).toBeUndefined();
    expect(props(image).ImageColor3).toEqual([255, 255, 255]);

    // A color the user chose stays.
    ed.setProp(image, 'ImageColor3', [255, 0, 0]);
    ed.setImagePreview(image, { dataUrl: svg, recolor: true });
    expect(props(image).ImageColor3).toEqual([255, 0, 0]);
  });
});
