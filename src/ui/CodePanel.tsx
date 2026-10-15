/**
 * The live code view: a panel under the viewport showing what's being edited as exported
 * code, updating as you edit. A page shows its HTML file beside its CSS, the Roblox screens
 * their Luau (or their web page). The selection's lines are marked, hovering a line outlines
 * its object and clicking selects it, and lines that change flash for a moment.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { viewOf, type View } from '../editor/editor.ts';
import {
  codeOwner,
  liveLuau,
  liveWeb,
  type CodeText,
  type LiveLuau,
  type LiveWeb,
} from '../editor/live-code.ts';
import { exportLuauSubtree } from '../export/luau.ts';
import { classDef } from '../model/classes.ts';
import { getInstance, type Doc, type InstanceId } from '../model/document.ts';
import { CodeView, type CodeLang } from './CodeView.tsx';
import { useEditor, useEditorState } from './editor-context.ts';
import { copyText, selectText } from './files.ts';
import { Icon } from './icons.tsx';

type Mode = 'web' | 'luau';

const HEIGHT_KEY = 'framecraft.codeHeight';
const MIN_HEIGHT = 120;
/** The viewport keeps at least this much of the window. */
const KEEP = 300;

function storedHeight(): number {
  try {
    const h = Number(localStorage.getItem(HEIGHT_KEY));
    if (h >= MIN_HEIGHT) return h;
  } catch {
    // Storage can be blocked; the default height does.
  }
  return 280;
}

const clampHeight = (h: number) =>
  Math.round(Math.max(MIN_HEIGHT, Math.min(h, window.innerHeight - KEEP)));

/** The page whose code shows: the selection's, or else the viewport's. */
function pageShown(doc: Doc, selection: InstanceId | null, view: View): InstanceId | undefined {
  const where = (selection !== null && viewOf(doc, selection)) || view;
  return where.kind === 'page' ? where.pageId : undefined;
}

export function CodePanel() {
  const editor = useEditor();
  const state = useEditorState();
  const { selection, view, backdrop } = state;
  // Code follows the edits a moment behind when they come quickly, as in a drag.
  const doc = useDeferredValue(state.doc);
  const assets = useDeferredValue(state.assets);
  const inst = selection === null ? undefined : getInstance(doc, selection);
  const pageId = pageShown(doc, selection, view);
  // Follows the view until a language is picked: HTML and CSS for pages, Luau for screens.
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode = picked ?? (pageId === undefined ? 'luau' : 'web');
  const code: LiveWeb | LiveLuau | null = useMemo(
    () => (mode === 'luau' ? liveLuau(doc) : liveWeb(doc, assets, pageId, backdrop)),
    [mode, doc, assets, pageId, backdrop],
  );

  const [height, setHeight] = useState(storedHeight);
  useEffect(() => {
    try {
      localStorage.setItem(HEIGHT_KEY, String(height));
    } catch {
      // Not kept; nothing else depends on it.
    }
  }, [height]);
  const drag = useRef<{ y: number; h: number } | null>(null);

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) return editor.toast(`Copied ${what}`);
    // Copying is blocked (an iframe without permission): select the code instead.
    selectText(document.querySelector<HTMLElement>('.codepanel .code'));
    editor.toast('Copy is blocked here. The code is selected: press Ctrl+C.');
  };

  // A Roblox object's own Luau, as Studio would build it on its own.
  const def = inst && classDef(inst.className);
  const ownLuau =
    mode === 'luau' &&
    inst &&
    def &&
    !def.web &&
    ['container', 'gui', 'modifier', 'folder'].includes(def.kind);

  const pane = (text: CodeText, lang: CodeLang, label: string, title: string, note?: string) => {
    const marked = codeOwner(doc, selection, text);
    return (
      <div className="codepane">
        <div className="codehead">
          <b>{title}</b>
          {note && <span>{note}</span>}
        </div>
        <CodeView
          text=""
          lines={text.lines}
          owners={text.owners}
          folded={text.folded}
          marked={marked}
          lang={lang}
          label={label}
          onPick={(id: InstanceId) => editor.select(id)}
          onHover={(id) => editor.setHover(id)}
        />
      </div>
    );
  };

  const caption =
    code?.kind === 'web'
      ? pageId === undefined
        ? 'Your Roblox screens as one web page'
        : `${code.file} on the website`
      : pageId === undefined
        ? 'Every ScreenGui, for Studio’s command bar'
        : 'Pages are for the website, so this is the Luau for your Roblox screens';

  return (
    <section className="codepanel panel" aria-label="Code" style={{ height }}>
      <div
        className="coderesize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Code panel height"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={Math.max(MIN_HEIGHT, window.innerHeight - KEEP)}
        tabIndex={0}
        title="Drag to resize"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, h: height };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setHeight(clampHeight(d.h + d.y - e.clientY));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 64 : 16;
          const by = { ArrowUp: step, ArrowDown: -step }[e.key];
          if (by === undefined) return;
          e.preventDefault();
          setHeight((h) => clampHeight(h + by));
        }}
      />
      <div className="codebar">
        <Icon name="code" />
        <h2>Code</h2>
        <div className="seg" role="group" aria-label="Code language">
          {(['web', 'luau'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'on' : undefined}
              aria-pressed={mode === m}
              onClick={() => setPicked(m)}
            >
              {m === 'web' ? 'HTML & CSS' : 'Luau'}
            </button>
          ))}
        </div>
        <span className="codecap">{caption}</span>
        <span className="spacer" />
        {ownLuau && (
          <button
            className="btn sm ghost"
            type="button"
            title={`Copy the Luau that builds ${inst.props.Name} and everything inside it`}
            aria-label={`Copy ${inst.props.Name}`}
            onClick={() => void copy(exportLuauSubtree(doc, inst.id), `${inst.props.Name}’s Luau`)}
          >
            <Icon name="copy" />
            <span className="lbl">Copy {inst.props.Name}</span>
          </button>
        )}
        {code && (
          <button
            className="btn sm ghost"
            type="button"
            title={code.kind === 'web' ? `Copy ${code.file}, CSS included` : 'Copy all the Luau'}
            aria-label={code.kind === 'web' ? 'Copy file' : 'Copy all'}
            onClick={() => void copy(code.full, code.kind === 'web' ? code.file : 'the Luau')}
          >
            <Icon name="copy" />
            <span className="lbl">{code.kind === 'web' ? 'Copy file' : 'Copy all'}</span>
          </button>
        )}
        <button
          className="ibtn sm"
          type="button"
          aria-label="Close code"
          title="Close code"
          onClick={() => editor.setCodeOpen(false)}
        >
          <Icon name="close" />
        </button>
      </div>
      {/* A new file starts fresh, so switching pages doesn't flash every line. */}
      <div className="codepanes" key={code ? `${code.kind}:${pageId ?? ''}` : 'none'}>
        {code?.kind === 'web' ? (
          <>
            {pane(code.html, 'html', 'HTML', 'HTML', code.file)}
            {pane(code.css, 'css', 'CSS', 'CSS', 'in the page’s <style>')}
          </>
        ) : code?.kind === 'luau' ? (
          pane(code.luau, 'luau', 'Luau', 'Luau')
        ) : (
          <p className="codeempty">Add a page to see its code.</p>
        )}
      </div>
    </section>
  );
}
