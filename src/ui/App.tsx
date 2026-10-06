import { useCallback, useEffect, useState } from 'react';
import { Editor, type SaveStatus } from '../editor/editor.ts';
import { sampleProject } from '../model/sample.ts';
import { EditorContext, useEditor, useEditorState } from './editor-context.ts';
import { ExportDialog, type ExportKind } from './ExportDialog.tsx';
import { Explorer } from './Explorer.tsx';
import { Icon, Mark } from './icons.tsx';
import { openProjectFile, saveProjectFile } from './project-actions.ts';
import { ProjectMenu } from './ProjectMenu.tsx';
import { Properties } from './properties/Properties.tsx';
import { Ribbon } from './Ribbon.tsx';
import { TemplateDialog } from './TemplateDialog.tsx';
import { Toasts } from './Toasts.tsx';
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
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [picking, setPicking] = useState(false);
  const toggle = (next: Exclude<Sheet, null>) => setSheet((cur) => (cur === next ? null : next));
  // Export opens on what the viewport shows: the website, or Luau for the screens.
  const openExport = useCallback(
    () => setExporting(editor.state.view.kind === 'page' ? 'site' : 'luau'),
    [editor],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKey(editor, e, openExport);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editor, openExport]);

  const { preview, saveStatus } = state;
  return (
    <div className={preview ? 'app preview' : 'app'}>
      <header className="topbar">
        <span className="brand">
          <Mark />
          <span className="wide-only">Framecraft</span>
        </span>
        <span className="vsep wide-only" />
        <button
          className="projbtn"
          type="button"
          title="Project menu"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          onClick={(e) => setMenu(menu ? null : e.currentTarget)}
        >
          <span>Project</span>
          <Icon name="chevDown" />
        </button>
        <SaveStatusText status={saveStatus} />
        <span className="spacer" />
        <button
          className="ibtn"
          type="button"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={!state.canUndo}
          onClick={() => editor.undo()}
        >
          <Icon name="undo" />
        </button>
        <button
          className="ibtn wide-only"
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          disabled={!state.canRedo}
          onClick={() => editor.redo()}
        >
          <Icon name="redo" />
        </button>
        <button
          className={`ibtn narrow-only${sheet === 'explorer' ? ' on' : ''}`}
          type="button"
          aria-label="Explorer"
          title="Explorer"
          aria-expanded={sheet === 'explorer'}
          onClick={() => toggle('explorer')}
        >
          <Icon name="tree" />
        </button>
        <button
          className={`ibtn narrow-only${sheet === 'props' ? ' on' : ''}`}
          type="button"
          aria-label="Properties"
          title="Properties"
          aria-expanded={sheet === 'props'}
          onClick={() => toggle('props')}
        >
          <Icon name="sliders" />
        </button>
        <span className="vsep wide-only" />
        <button
          className={preview ? 'btn on' : 'btn'}
          type="button"
          title="Try the UI: buttons react, text boxes take input, links work (P)"
          aria-pressed={preview}
          onClick={() => editor.setPreview(!preview)}
        >
          <Icon name={preview ? 'stop' : 'play'} />
          <span className="wide-only">{preview ? 'Stop preview' : 'Preview'}</span>
        </button>
        <button className="btn primary" type="button" title="Export (Ctrl+E)" onClick={openExport}>
          <Icon name="export" />
          <span className="wide-only">Export</span>
        </button>
      </header>

      <Ribbon />
      <Explorer open={sheet === 'explorer'} onClose={() => setSheet(null)} />
      <Viewport />
      <Properties open={sheet === 'props'} onClose={() => setSheet(null)} />
      {menu && (
        <ProjectMenu
          anchor={menu}
          onClose={() => setMenu(null)}
          onTemplates={() => setPicking(true)}
        />
      )}
      {exporting && <ExportDialog kind={exporting} onClose={() => setExporting(null)} />}
      {picking && <TemplateDialog onClose={() => setPicking(false)} />}
      <Toasts />
    </div>
  );
}

function SaveStatusText({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  if (status === 'off')
    return (
      <span
        className="saved off wide-only"
        title="Your browser isn’t keeping changes. Save a project file from the Project menu."
      >
        <Icon name="info" />
        Not saved
      </span>
    );
  return (
    <span className="saved wide-only" title="Kept in this browser" aria-live="polite">
      {status === 'saved' && <Icon name="check" />}
      {status === 'saved' ? 'Saved' : 'Saving…'}
    </span>
  );
}

/** Editor shortcuts. Keys typed into a field, or used by a menu or dialog, belong to it. */
function handleKey(editor: Editor, e: KeyboardEvent, openExport: () => void) {
  if (e.defaultPrevented) return;
  const t = e.target as HTMLElement | null;
  const typing =
    !!t &&
    (t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable);
  if (t?.closest?.('dialog, [role="dialog"], [role="menu"]')) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  // Saving, opening and exporting work from inside a field too.
  if (typing && !(mod && 'soe'.includes(k))) return;
  const { preview, selection, doc } = editor.state;
  if (mod) {
    const action = {
      z: () => (e.shiftKey ? editor.redo() : editor.undo()),
      y: () => editor.redo(),
      d: () => editor.duplicateSelection(),
      c: () => editor.copySelection(),
      x: () => editor.copySelection(true),
      v: () => editor.paste(),
      s: () => saveProjectFile(editor),
      o: () => void openProjectFile(editor),
      e: openExport,
    }[k];
    if (action && !(preview && 'dcxv'.includes(k))) {
      e.preventDefault();
      action();
    }
    return;
  }
  if (e.altKey) return;
  if (k === 'p') return editor.setPreview(!preview);
  if (preview) return;
  if (e.key === 'F2') {
    e.preventDefault();
    return editor.startRename();
  }
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
