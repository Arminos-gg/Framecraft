/**
 * New from a template: the starter websites and Roblox screens, each with a live preview of
 * its first screen. Picking one replaces the open project; the message after it can undo that.
 */
import { useEffect, useMemo, useRef } from 'react';
import { DESKTOP } from '../editor/devices.ts';
import { buildScene, pagesOf, SCREENS } from '../editor/editor.ts';
import type { Backdrop } from '../export/html.ts';
import type { Assets } from '../model/assets.ts';
import type { Doc } from '../model/document.ts';
import { TEMPLATES, type Template } from '../model/templates/index.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { Icon } from './icons.tsx';
import { newFromTemplate } from './project-actions.ts';
import { Stage } from './viewport/Stage.tsx';
import { useDocFonts } from './viewport/useDocFonts.ts';

/** The preview's width in pixels; its height follows the laptop screen's shape. */
const THUMB_WIDTH = 224;
const NO_ASSETS: Assets = {};

const GROUPS = [
  ['site', 'Websites'],
  ['roblox', 'Roblox UI'],
] as const;

export function TemplateDialog({ onClose }: { onClose: () => void }) {
  const editor = useEditor();
  const { backdrop } = useEditorState();
  const dialog = useRef<HTMLDialogElement>(null);
  const docs = useMemo(() => TEMPLATES.map((t) => t.build()), []);
  useDocFonts(docs, 'framecraft-template-fonts');

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const pick = (template: Template) => {
    newFromTemplate(editor, template);
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      className="modal templates"
      aria-label="New from a template"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <header>
        <h2>New from a template</h2>
        <span className="spacer" />
        <button
          className="ibtn"
          type="button"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="how">
        <p>
          Pick a starting point and make it yours. It replaces the project you have open, and the
          message that follows can bring that one back.
        </p>
      </div>
      <div className="tplbody">
        {GROUPS.map(([kind, title]) => (
          <section key={kind} aria-label={title}>
            <h3>{title}</h3>
            <div className="tpls">
              {TEMPLATES.map((t, i) =>
                t.kind === kind ? (
                  <button key={t.id} className="tpl" type="button" onClick={() => pick(t)}>
                    <span className="thumb" aria-hidden="true">
                      <Preview doc={docs[i]!} backdrop={backdrop} />
                    </span>
                    <span className="name">{t.name}</span>
                    <span className="desc">{t.description}</span>
                  </button>
                ) : null,
              )}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}

/** The template's first screen, drawn by the viewport's own Stage and scaled down. */
function Preview({ doc, backdrop }: { doc: Doc; backdrop: Backdrop }) {
  const scene = useMemo(() => {
    const page = pagesOf(doc)[0];
    return buildScene({
      doc,
      view: page ? { kind: 'page', pageId: page.id } : SCREENS,
      screenDevice: 'laptop',
      pageDevice: DESKTOP.id,
    });
  }, [doc]);
  const screens = scene.view.kind === 'screens';
  return (
    <span
      className={screens ? `device backdrop-${backdrop}` : 'device'}
      style={{
        width: scene.width,
        height: scene.device.height,
        transform: `scale(${THUMB_WIDTH / scene.width})`,
      }}
    >
      <Stage doc={doc} scene={scene} assets={NO_ASSETS} preview={false} />
    </span>
  );
}
