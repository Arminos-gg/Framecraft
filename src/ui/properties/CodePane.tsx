/**
 * The Code tab: the selection as exported code. Luau for Roblox, or the HTML file it ends up
 * in (its page on the website, or the screens as one page). It updates as you edit.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { pagesOf, viewOf } from '../../editor/editor.ts';
import { exportHtml } from '../../export/html.ts';
import { exportLuau, exportLuauSubtree } from '../../export/luau.ts';
import { exportSite, pageFiles } from '../../export/site.ts';
import { esc } from '../../export/format.ts';
import { classDef } from '../../model/classes.ts';
import type { Assets } from '../../model/assets.ts';
import { getInstance, type AnyInstance, type Doc, type Instance } from '../../model/document.ts';
import { useEditor, useEditorState } from '../editor-context.ts';
import { copyText, selectText } from '../files.ts';
import { CodeView, type CodeLang } from '../CodeView.tsx';
import { Icon } from '../icons.tsx';

interface Code {
  readonly text: string;
  readonly caption: ReactNode;
  /** The line where the selected object starts, if it's somewhere in the middle. */
  readonly mark?: number;
}

/** The line of the HTML where an object's element starts: the first with its data-name. */
function lineOf(text: string, inst: AnyInstance | undefined): number | undefined {
  if (!inst || classDef(inst.className).kind !== 'gui') return undefined;
  const at = text.indexOf(`data-name="${esc(inst.props.Name)}"`);
  return at < 0 ? undefined : text.slice(0, at).split('\n').length - 1;
}

function luauFor(doc: Doc, inst: AnyInstance | undefined): Code {
  const def = inst && classDef(inst.className);
  const own =
    inst && def && !def.web && ['container', 'gui', 'modifier', 'folder'].includes(def.kind);
  if (inst && own)
    return {
      text: exportLuauSubtree(doc, inst.id),
      caption: (
        <>
          <b>{inst.props.Name}</b> and everything inside it, as Luau for Studio
        </>
      ),
    };
  return {
    text: exportLuau(doc, 'command'),
    caption:
      inst && viewOf(doc, inst.id)?.kind === 'page'
        ? 'Pages are for the website, so this is the Luau for your Roblox screens'
        : 'Every ScreenGui, as Luau for Studio’s command bar',
  };
}

function htmlFor(
  doc: Doc,
  assets: Assets,
  pageId: string | undefined,
  inst: AnyInstance | undefined,
): Code {
  const page = pageId === undefined ? undefined : getInstance(doc, pageId);
  if (page?.className === 'Page') {
    const pages = pagesOf(doc).filter((p): p is Instance<'Page'> => p.className === 'Page');
    const file = pageFiles(pages).get(page.id)?.file;
    const out = exportSite(doc, assets).find((f) => f.path === file);
    if (file && typeof out?.contents === 'string')
      return {
        text: out.contents,
        mark: lineOf(out.contents, inst),
        caption: (
          <>
            <b>{page.props.Name}</b> on the website, saved as {file}
          </>
        ),
      };
  }
  const text = exportHtml(doc, { assets });
  return { text, mark: lineOf(text, inst), caption: 'Your Roblox screens as one web page' };
}

export function CodePane() {
  const editor = useEditor();
  const { doc, assets, selection, view } = useEditorState();
  const inst = selection === null ? undefined : getInstance(doc, selection);
  const where = (inst && viewOf(doc, inst.id)) ?? view;
  const pageId = where.kind === 'page' ? where.pageId : undefined;
  // Follows the view until a language is picked: HTML for pages, Luau for screens.
  const [picked, setPicked] = useState<CodeLang | null>(null);
  const lang = picked ?? (pageId === undefined ? 'luau' : 'html');
  const pre = useRef<HTMLPreElement>(null);
  const code = useMemo(
    () => (lang === 'luau' ? luauFor(doc, inst) : htmlFor(doc, assets, pageId, inst)),
    [lang, doc, assets, inst, pageId],
  );

  const copy = async () => {
    if (await copyText(code.text)) return editor.toast('Copied to clipboard');
    // Copying is blocked (an iframe without permission): select the code instead.
    selectText(pre.current);
    editor.toast('Copy is blocked here. The code is selected: press Ctrl+C.');
  };

  return (
    <div className="pbody codepane" role="tabpanel" aria-label="Code">
      <div className="codebar">
        <div className="seg" role="group" aria-label="Code language">
          {(['luau', 'html'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={lang === l ? 'on' : undefined}
              aria-pressed={lang === l}
              onClick={() => setPicked(l)}
            >
              {l === 'luau' ? 'Luau' : 'HTML'}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn sm ghost" type="button" onClick={() => void copy()}>
          <Icon name="copy" />
          Copy
        </button>
      </div>
      <p className="codecap">{code.caption}</p>
      <CodeView
        ref={pre}
        text={code.text}
        mark={code.mark}
        lang={lang}
        label={lang === 'luau' ? 'Luau' : 'HTML'}
      />
    </div>
  );
}
