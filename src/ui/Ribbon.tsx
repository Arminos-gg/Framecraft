/**
 * The ribbon: insert objects and modifiers, choose what dragging writes, and convert units.
 * The first tool follows the view: ScreenGui for the Roblox screens, Page for the website.
 */
import { useState } from 'react';
import type { UnitMode } from '../editor/geometry.ts';
import { insertParent } from '../editor/insert.ts';
import { OBJECT_CLASSES, type ClassName } from '../model/classes.ts';
import { getInstance } from '../model/document.ts';
import { isGui } from '../export/html.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { ClassIcon, Icon } from './icons.tsx';
import { Checkbox } from './properties/fields.tsx';
import { ShapesMenu } from './ShapesMenu.tsx';

const MODIFIERS: readonly (readonly [ClassName, string])[] = [
  ['UICorner', 'Corner'],
  ['UIStroke', 'Stroke'],
  ['UIGradient', 'Gradient'],
  ['UIPadding', 'Padding'],
  ['UIListLayout', 'List'],
  ['UIAspectRatioConstraint', 'Aspect'],
];

const UNITS: readonly (readonly [UnitMode, string, string | undefined])[] = [
  ['auto', 'Auto', undefined],
  ['scale', 'Percent', 'su'],
  ['offset', 'Pixels', 'ou'],
];

const UNIT_HINTS: Record<UnitMode, string> = {
  auto: 'Dragging keeps each value in the unit it already uses',
  scale: 'Dragging writes percents of the parent',
  offset: 'Dragging writes pixels',
};

export function Ribbon() {
  const editor = useEditor();
  const { doc, selection, view, preview, unit, snap } = useEditorState();
  const [shapes, setShapes] = useState<HTMLElement | null>(null);
  const sel = selection === null ? undefined : getInstance(doc, selection);
  const layer: ClassName = view.kind === 'page' ? 'Page' : 'ScreenGui';
  const convertible =
    !!sel && (isGui(sel) || sel.className === 'ScreenGui' || sel.className === 'Page');
  const group = preview ? 'rgroup off' : 'rgroup';
  return (
    <nav className="ribbon panel" aria-label="Insert and edit tools" inert={preview}>
      <div className={group} role="group" aria-label="Insert object">
        <div className="items">
          {[layer, ...OBJECT_CLASSES].map((c) => (
            <button
              key={c}
              className="tool"
              type="button"
              data-insert={c}
              title={`Insert ${c}`}
              onClick={() => editor.insert(c)}
            >
              <ClassIcon className={c} />
              {c}
            </button>
          ))}
          <button
            className={shapes ? 'tool is-pressed' : 'tool'}
            type="button"
            data-insert="shapes"
            title="Insert a shape"
            aria-haspopup="dialog"
            aria-expanded={!!shapes}
            onClick={(e) => setShapes(shapes ? null : e.currentTarget)}
          >
            <Icon name="shapes" />
            Shapes
          </button>
          {shapes && <ShapesMenu anchor={shapes} onClose={() => setShapes(null)} />}
        </div>
        <div className="cap">Insert object</div>
      </div>
      <div className={group} role="group" aria-label="Add modifier">
        <div className="items">
          <div className="stools">
            {MODIFIERS.map(([c, label]) => (
              <button
                key={c}
                className="stool"
                type="button"
                data-insert={c}
                title={`Add ${c} to the selection`}
                disabled={!insertParent(doc, c, selection)}
                onClick={() => editor.insert(c)}
              >
                <ClassIcon className={c} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="cap">Add modifier</div>
      </div>
      <div className={group} role="group" aria-label="Dragging edits">
        <div className="items">
          <div className="rstack">
            <div className="seg" role="group" aria-label="Units that dragging writes">
              {UNITS.map(([u, label, cls]) => (
                <button
                  key={u}
                  type="button"
                  className={[cls, unit === u && 'on'].filter(Boolean).join(' ') || undefined}
                  aria-pressed={unit === u}
                  title={UNIT_HINTS[u]}
                  onClick={() => editor.setUnit(u)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="toggle">
              <Checkbox label="Smart snapping" checked={snap} onChange={(v) => editor.setSnap(v)} />
              Smart snapping <small>Alt skips</small>
            </label>
          </div>
        </div>
        <div className="cap">Dragging edits</div>
      </div>
      <div className={group} role="group" aria-label="Convert units">
        <div className="items">
          <button
            className="tool"
            type="button"
            title="Rewrite Position and Size of the selection and its children in percent"
            disabled={!convertible}
            onClick={() => editor.convertUnits(true)}
          >
            <span className="ico s">
              <Icon name="toScale" />
            </span>
            To percent
          </button>
          <button
            className="tool"
            type="button"
            title="Rewrite Position and Size of the selection and its children in pixels"
            disabled={!convertible}
            onClick={() => editor.convertUnits(false)}
          >
            <span className="ico o">
              <Icon name="toOffset" />
            </span>
            To pixels
          </button>
        </div>
        <div className="cap">Convert units</div>
      </div>
    </nav>
  );
}
