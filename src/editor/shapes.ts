/**
 * Shapes to insert, as in PowerPoint. Roblox has no shape objects, so each shape is made of
 * what Roblox does have. Rectangles, circles, pills and lines are Frames, with a UICorner where
 * they're round, so they export to Studio exactly. Every other shape is an ImageLabel showing a
 * white SVG picture, which ImageColor3 tints to the shape's color, the way Roblox games color
 * icons. Roblox can't load SVG, so for Studio the picture is saved as a PNG and uploaded.
 */
import { assetIdFor, svgDataUrl } from '../model/assets.ts';
import type { ClassName } from '../model/classes.ts';
import {
  createInstance,
  type AnyInstance,
  type InstanceId,
  type Subtree,
} from '../model/document.ts';
import type { Color3, UDim, UDim2 } from '../model/values.ts';

/** The color new shapes start with. */
export const SHAPE_COLOR: Color3 = [68, 114, 196];

interface ShapeBase {
  readonly id: string;
  /** Its name in the menu and, without spaces, the new object's Name. */
  readonly label: string;
  /** Width and height in pixels when inserted. */
  readonly size: readonly [number, number];
}
/** A Frame, rounded with a UICorner and kept in shape by a UIAspectRatioConstraint if given. */
export interface FrameShape extends ShapeBase {
  readonly kind: 'frame';
  readonly corner?: UDim;
  readonly aspect?: number;
}
/** An ImageLabel with a white picture, drawn from an SVG path on a 100 by 100 grid. */
export interface PictureShape extends ShapeBase {
  readonly kind: 'picture';
  readonly path: string;
  /** Holes cut by inner parts of the path, as in a ring. */
  readonly evenOdd?: boolean;
}
export type Shape = FrameShape | PictureShape;

/** A closed outline through points on the 100 by 100 grid. */
const poly = (...pts: number[]) => {
  const out: string[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(`${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`);
  return out.join('') + 'Z';
};

/** A star with `n` points, stretched to fill the grid. */
function star(n: number, inner: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : 1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const fit = (v: number, lo: number, hi: number) => Math.round(((v - lo) / (hi - lo)) * 1000) / 10;
  return poly(...pts.flatMap(([x, y]) => [fit(x, x0, x1), fit(y, y0, y1)]));
}

export const SHAPES: readonly Shape[] = [
  { id: 'rectangle', label: 'Rectangle', kind: 'frame', size: [160, 100] },
  { id: 'rounded', label: 'Rounded rectangle', kind: 'frame', size: [160, 100], corner: [0, 16] },
  { id: 'circle', label: 'Circle', kind: 'frame', size: [100, 100], corner: [0.5, 0], aspect: 1 },
  { id: 'pill', label: 'Pill', kind: 'frame', size: [160, 56], corner: [0.5, 0] },
  { id: 'line', label: 'Line', kind: 'frame', size: [160, 4] },
  {
    id: 'ellipse',
    label: 'Ellipse',
    kind: 'picture',
    size: [160, 100],
    path: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z',
  },
  {
    id: 'triangle',
    label: 'Triangle',
    kind: 'picture',
    size: [116, 100],
    path: poly(50, 0, 100, 100, 0, 100),
  },
  {
    id: 'right-triangle',
    label: 'Right triangle',
    kind: 'picture',
    size: [100, 100],
    path: poly(0, 0, 100, 100, 0, 100),
  },
  {
    id: 'diamond',
    label: 'Diamond',
    kind: 'picture',
    size: [100, 120],
    path: poly(50, 0, 100, 50, 50, 100, 0, 50),
  },
  {
    id: 'pentagon',
    label: 'Pentagon',
    kind: 'picture',
    size: [106, 100],
    path: poly(50, 0, 100, 38.2, 80.9, 100, 19.1, 100, 0, 38.2),
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    kind: 'picture',
    size: [116, 100],
    path: poly(25, 0, 75, 0, 100, 50, 75, 100, 25, 100, 0, 50),
  },
  {
    id: 'octagon',
    label: 'Octagon',
    kind: 'picture',
    size: [100, 100],
    path: poly(29.3, 0, 70.7, 0, 100, 29.3, 100, 70.7, 70.7, 100, 29.3, 100, 0, 70.7, 0, 29.3),
  },
  {
    id: 'parallelogram',
    label: 'Parallelogram',
    kind: 'picture',
    size: [160, 100],
    path: poly(25, 0, 100, 0, 75, 100, 0, 100),
  },
  {
    id: 'trapezoid',
    label: 'Trapezoid',
    kind: 'picture',
    size: [160, 100],
    path: poly(20, 0, 80, 0, 100, 100, 0, 100),
  },
  { id: 'star', label: 'Star', kind: 'picture', size: [106, 100], path: star(5, 0.382) },
  {
    id: 'star-4',
    label: 'Four-point star',
    kind: 'picture',
    size: [100, 100],
    path: star(4, 0.38),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    kind: 'picture',
    size: [160, 100],
    path: poly(0, 30, 60, 30, 60, 0, 100, 50, 60, 100, 60, 70, 0, 70),
  },
  {
    id: 'chevron',
    label: 'Chevron',
    kind: 'picture',
    size: [140, 100],
    path: poly(0, 0, 70, 0, 100, 50, 70, 100, 0, 100, 30, 50),
  },
  {
    id: 'plus',
    label: 'Plus',
    kind: 'picture',
    size: [100, 100],
    path: poly(
      35,
      0,
      65,
      0,
      65,
      35,
      100,
      35,
      100,
      65,
      65,
      65,
      65,
      100,
      35,
      100,
      35,
      65,
      0,
      65,
      0,
      35,
      35,
      35,
    ),
  },
  {
    id: 'heart',
    label: 'Heart',
    kind: 'picture',
    size: [110, 100],
    path: 'M50 100C20 76 0 56 0 30C0 13 13 0 28 0C38 0 46 6 50 14C54 6 62 0 72 0C87 0 100 13 100 30C100 56 80 76 50 100Z',
  },
  {
    id: 'speech',
    label: 'Speech bubble',
    kind: 'picture',
    size: [160, 120],
    path: 'M10 0H90A10 10 0 0 1 100 10V65A10 10 0 0 1 90 75H45L25 100V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z',
  },
  {
    id: 'ring',
    label: 'Ring',
    kind: 'picture',
    size: [100, 100],
    path: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0ZM50 22A28 28 0 1 0 50 78A28 28 0 1 0 50 22Z',
    evenOdd: true,
  },
  {
    id: 'half-circle',
    label: 'Half circle',
    kind: 'picture',
    size: [160, 80],
    path: 'M0 100A50 100 0 0 1 100 100Z',
  },
  {
    id: 'lightning',
    label: 'Lightning',
    kind: 'picture',
    size: [80, 120],
    path: poly(62, 0, 8, 58, 44, 58, 32, 100, 92, 36, 56, 36),
  },
];

export const shapeById = (id: string): Shape | undefined => SHAPES.find((s) => s.id === id);

/**
 * A picture shape's SVG: white, so ImageColor3 colors it, and stretched to whatever box it is
 * in, as a PowerPoint shape is.
 */
export function shapeSvg(shape: PictureShape): string {
  const rule = shape.evenOdd ? ' fill-rule="evenodd"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="#fff"${rule} d="${shape.path}"/></svg>`;
}

/** The picture a shape shows, as a data URL, or undefined for a Frame shape. */
export const shapePicture = (shape: Shape): string | undefined =>
  shape.kind === 'picture' ? svgDataUrl(shapeSvg(shape)) : undefined;

/** The new object's Name: the label in one word, as Roblox names usually are. */
export const shapeName = (shape: Shape): string =>
  shape.label.replace(/(^|[\s-]+)(\w)/g, (_, _sep: string, c: string) => c.toUpperCase());

/** The class a shape is made of. */
export const shapeClass = (shape: Shape): ClassName =>
  shape.kind === 'frame' ? 'Frame' : 'ImageLabel';

/** The new object's own properties, before Position. */
export function shapeProps(shape: Shape): Record<string, unknown> {
  const Size: UDim2 = [0, shape.size[0], 0, shape.size[1]];
  return shape.kind === 'frame'
    ? { Name: shapeName(shape), Size, BackgroundColor3: SHAPE_COLOR }
    : { Name: shapeName(shape), Size, BackgroundTransparency: 1, ImageColor3: SHAPE_COLOR };
}

/**
 * Finishes a shape made from `root` (a Frame or ImageLabel with `shapeProps`): adds its
 * UICorner and UIAspectRatioConstraint, or its picture.
 */
export function finishShape(shape: Shape, root: AnyInstance, makeId: () => InstanceId): Subtree {
  if (shape.kind === 'picture') {
    const preview = assetIdFor(shapePicture(shape)!);
    return { rootId: root.id, instances: { [root.id]: { ...root, preview } } };
  }
  const kids: AnyInstance[] = [];
  if (shape.corner)
    kids.push(createInstance('UICorner', { CornerRadius: shape.corner }, makeId()) as AnyInstance);
  if (shape.aspect)
    kids.push(
      createInstance(
        'UIAspectRatioConstraint',
        { AspectRatio: shape.aspect },
        makeId(),
      ) as AnyInstance,
    );
  const instances: Record<InstanceId, AnyInstance> = {
    [root.id]: { ...root, children: kids.map((k) => k.id) },
  };
  for (const k of kids) instances[k.id] = { ...k, parent: root.id };
  return { rootId: root.id, instances };
}
