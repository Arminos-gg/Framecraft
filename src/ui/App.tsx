import { useEffect, useState } from 'react';
import { Editor } from '../editor/editor.ts';
import { sampleProject } from '../model/sample.ts';
import { EditorContext, useEditor, useEditorState } from './editor-context.ts';
import { Explorer } from './Explorer.tsx';
import { Properties } from './Properties.tsx';
import { Ribbon } from './Ribbon.tsx';
import { Viewport } from './viewport/Viewport.tsx';

/** Which side panel is open as a sheet on narrow screens. Wide screens show both. */
type Sheet = 'explorer' | 'props' | null;

export function App({ editor }: { editor?: Editor }) {
  const [ed] = useState(() => editor ?? new Editor(sampleProject()));
  return (
    <EditorContext.Provider value={ed}>
      <Shell />
    </EditorContext.Provider>
  );
}

function Shell() {
  const editor = useEditor();
  const state = useEditorState();
  const [sheet, setSheet] = useState<Sheet>(null);
  const toggle = (next: Exclude<Sheet, null>) => setSheet((cur) => (cur === next ? null : next));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKey(editor, e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor]);

  return (
    <div className={state.preview ? 'app preview' : 'app'}>
      <header className="bar">
        <div className="wordmark">
          <svg viewBox="0 0 26 26" aria-hidden="true">
            <rect x="1" y="1" width="24" height="24" rx="6.5" fill="var(--accent)" />
            <rect
              x="7"
              y="7"
              width="12"
              height="12"
              rx="2.5"
              fill="none"
              stroke="var(--on-accent)"
              strokeWidth="2"
            />
            <circle cx="13" cy="13" r="2.3" fill="var(--on-accent)" />
            <path
              d="M19 13h4M13 19v4"
              stroke="var(--on-accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <b>Framecraft</b>
          <span className="chip wide-only">Early build</span>
        </div>
        <div className="spacer" />
        <div className="group">
          <button
            className="btn icon"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!state.canUndo}
            onClick={() => editor.undo()}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7.5 5 4 8.5 7.5 12" />
              <path d="M4.5 8.5H12a4 4 0 0 1 0 8H9" />
            </svg>
          </button>
          <button
            className="btn icon"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!state.canRedo}
            onClick={() => editor.redo()}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M12.5 5 16 8.5 12.5 12" />
              <path d="M15.5 8.5H8a4 4 0 0 0 0 8h3" />
            </svg>
          </button>
        </div>
        <button
          className={`btn narrow-only${sheet === 'explorer' ? ' on' : ''}`}
          aria-expanded={sheet === 'explorer'}
          onClick={() => toggle('explorer')}
        >
          Explorer
        </button>
        <button
          className={`btn narrow-only${sheet === 'props' ? ' on' : ''}`}
          aria-expanded={sheet === 'props'}
          onClick={() => toggle('props')}
        >
          Properties
        </button>
        <button
          className={state.preview ? 'btn on' : 'btn'}
          title="Try the UI: buttons react, text boxes take input, links work (P)"
          aria-pressed={state.preview}
          onClick={() => editor.setPreview(!state.preview)}
        >
          {state.preview ? 'Stop preview' : 'Preview'}
        </button>
      </header>

      <Ribbon />
      <Explorer open={sheet === 'explorer'} onClose={() => setSheet(null)} />
      <Viewport />
      <Properties open={sheet === 'props'} onClose={() => setSheet(null)} />
      {state.toast && (
        <div className="toast" role="status" key={state.toast.id}>
          {state.toast.text}
        </div>
      )}
    </div>
  );
}

/** Editor shortcuts. Keys typed into a field belong to the field. */
function handleKey(editor: Editor, e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  const typing =
    !!t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable);
  if (typing) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const { preview, selection, doc } = editor.state;
  if (mod) {
    const action = {
      z: () => (e.shiftKey ? editor.redo() : editor.undo()),
      y: () => editor.redo(),
      d: () => editor.duplicateSelection(),
      c: () => editor.copySelection(),
      x: () => editor.copySelection(true),
      v: () => editor.paste(),
    }[k];
    if (action && !(preview && k !== 'z' && k !== 'y')) {
      e.preventDefault();
      action();
    }
    return;
  }
  if (e.altKey) return;
  if (k === 'p') return editor.setPreview(!preview);
  if (preview) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    return editor.deleteSelection();
  }
  if (e.key === 'Escape') {
    // Up to the parent object, then nothing.
    const inst = selection === null ? undefined : doc.instances[selection];
    const parent = !inst || inst.parent === null ? undefined : doc.instances[inst.parent];
    const kind = parent?.className;
    return editor.select(
      parent && kind !== 'StarterGui' && kind !== 'Site' && kind !== 'DataModel' ? parent.id : null,
    );
  }
  const step = e.shiftKey ? 10 : 1;
  const arrows: Record<string, [number, number]> = {
    arrowleft: [-step, 0],
    arrowright: [step, 0],
    arrowup: [0, -step],
    arrowdown: [0, step],
  };
  const arrow = arrows[k];
  if (arrow && selection !== null) {
    e.preventDefault();
    editor.nudge(...arrow);
  }
}
