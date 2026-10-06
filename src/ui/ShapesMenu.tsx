/**
 * The Shapes menu, opened from the ribbon: a grid of shapes to insert, as in PowerPoint.
 * Rectangles, circles, pills and lines are Frames; the rest are tinted pictures (see
 * editor/shapes.ts), so they're grouped that way and the menu says what Roblox gets.
 */
import { SHAPES, type Shape } from '../editor/shapes.ts';
import { useEditor } from './editor-context.ts';
import { Icon } from './icons.tsx';
import { Popover } from './Popover.tsx';

/** A shape's thumbnail, in its starting proportions, in the current color. */
export function ShapeIcon({ shape }: { shape: Shape }) {
  const [w, h] = shape.size;
  const fit = 28 / Math.max(w, h);
  const width = Math.max(4, Math.round(w * fit));
  const height = Math.max(2, Math.round(h * fit));
  if (shape.kind === 'picture')
    return (
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={shape.path} fill="currentColor" fillRule={shape.evenOdd ? 'evenodd' : undefined} />
      </svg>
    );
  const [s, o] = shape.corner ?? [0, 0];
  const r = Math.min(s * Math.min(w, h) + o, Math.min(w, h) / 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect width={w} height={h} rx={r} fill="currentColor" />
    </svg>
  );
}

const GROUPS: readonly [string, string, readonly Shape[]][] = [
  [
    'Basic',
    'Frames, so they export to Roblox as they are.',
    SHAPES.filter((s) => s.kind === 'frame'),
  ],
  [
    'More shapes',
    'Pictures you color with ImageColor3.',
    SHAPES.filter((s) => s.kind === 'picture'),
  ],
];

export function ShapesMenu({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const editor = useEditor();
  return (
    <Popover anchor={anchor} label="Insert a shape" className="pop shapes" onClose={onClose}>
      <div className="pophead">
        Insert a shape
        <span className="spacer" />
        <button className="ibtn sm" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {GROUPS.map(([title, hint, list]) => (
        <div key={title} className="shapegroup" role="group" aria-label={title}>
          <h4>{title}</h4>
          <p className="shapehint">{hint}</p>
          <div className="shapegrid">
            {list.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className="shapebtn"
                data-shape={shape.id}
                title={shape.label}
                aria-label={shape.label}
                onClick={() => {
                  onClose();
                  editor.insertShape(shape.id);
                }}
              >
                <ShapeIcon shape={shape} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </Popover>
  );
}
