/**
 * Drawn over the device, in viewport pixels: the hover outline, the selection with its resize
 * handles and AnchorPoint dot, snapping guides, and the readout while dragging.
 */
import type { EditorState, Scene } from '../../editor/editor.ts';
import { HANDLES } from '../../editor/geometry.ts';
import { fmtNum } from '../../export/format.ts';
import { isGui } from '../../export/html.ts';
import { screenQuad } from '../../layout/layout.ts';
import { getInstance, resolveProps, type Instance, type InstanceId } from '../../model/document.ts';
import type { UDim2 } from '../../model/values.ts';

export function UDim2Text({ value }: { value: UDim2 }) {
  return (
    <>
      {'{'}
      <span className="s">{fmtNum(value[0])}</span>,{' '}
      <span className="o">{fmtNum(value[1], 0)}</span>
      {'},{'}
      <span className="s">{fmtNum(value[2])}</span>,{' '}
      <span className="o">{fmtNum(value[3], 0)}</span>
      {'}'}
    </>
  );
}

export function Overlay({
  state,
  scene,
  zoom,
}: {
  state: EditorState;
  scene: Scene;
  zoom: number;
}) {
  if (state.preview) return null;
  const { doc } = state;
  const z = zoom;

  /** An outline where the object really is, rotation included. */
  const outline = (id: InstanceId) => {
    const q = screenQuad(doc, scene.layout, id);
    if (!q) return undefined;
    return {
      left: (q.cx - q.w / 2) * z,
      top: (q.cy - q.h / 2) * z,
      width: q.w * z,
      height: q.h * z,
      transform: q.angle ? `rotate(${q.angle}deg)` : undefined,
    };
  };
  const shown = (id: InstanceId | null): id is InstanceId => {
    if (id === null) return false;
    const inst = getInstance(doc, id);
    return !!inst && isGui(inst) && !!scene.layout.get(id)?.visible;
  };

  const hover =
    state.hover !== state.selection && shown(state.hover) ? outline(state.hover) : undefined;
  const sel = shown(state.selection) ? state.selection : null;
  const box = sel === null ? undefined : scene.layout.get(sel);
  const selStyle = sel === null ? undefined : outline(sel);
  const inst = sel === null ? undefined : getInstance(doc, sel);
  const props =
    inst && isGui(inst)
      ? resolveProps(doc, inst as Instance<'Frame'>, scene.breakpoint)
      : undefined;
  const dragging = state.gesture !== null && state.gesture.id === sel;
  const q = sel === null ? undefined : screenQuad(doc, scene.layout, sel);

  return (
    <>
      {scene.height > scene.device.height && (
        <div className="fold" style={{ top: scene.device.height * z, width: scene.width * z }}>
          <span>End of first screen</span>
        </div>
      )}
      {hover && <div className="hoverbox" style={hover} />}
      {box && selStyle && props && (
        <div className={box.listItem ? 'selbox locked' : 'selbox'} style={selStyle}>
          {HANDLES.map((h) => (
            <div
              key={h}
              className="handle"
              data-h={h}
              style={{
                left: `${h.includes('w') ? 0 : h.includes('e') ? 100 : 50}%`,
                top: `${h.includes('n') ? 0 : h.includes('s') ? 100 : 50}%`,
              }}
            />
          ))}
          {!box.listItem && (
            <div
              className="anchor-dot"
              title="AnchorPoint"
              style={{
                left: `${props.AnchorPoint[0] * 100}%`,
                top: `${props.AnchorPoint[1] * 100}%`,
              }}
            />
          )}
        </div>
      )}
      {dragging && box && props && q && (
        <div
          className="readout"
          style={{ left: (q.cx - q.w / 2) * z, top: (q.cy + q.h / 2) * z + 10 }}
        >
          {!box.listItem && (
            <>
              <span className="k">Position</span> <UDim2Text value={props.Position} />
              <br />
            </>
          )}
          <span className="k">Size</span> <UDim2Text value={props.Size} />
          <br />
          <span className="k">
            {Math.round(box.w)} × {Math.round(box.h)} px
          </span>
        </div>
      )}
      {state.gesture?.guides.map((g, i) => (
        <div
          key={i}
          className={`guide ${g.axis}`}
          style={
            g.axis === 'v'
              ? { left: g.at * z, top: g.from * z, height: (g.to - g.from) * z }
              : { top: g.at * z, left: g.from * z, width: (g.to - g.from) * z }
          }
        />
      ))}
    </>
  );
}
