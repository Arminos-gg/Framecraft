/**
 * Export: the website as a zip of static files, the Roblox screens as one HTML page, as Luau
 * for Studio or as a Roblox model file, and the project file.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { pagesOf } from '../editor/editor.ts';
import { exportHtml } from '../export/html.ts';
import { exportLuau, type LuauTarget } from '../export/luau.ts';
import { exportRbxmx, screensOf } from '../export/rbxmx.ts';
import { exportSite } from '../export/site.ts';
import { makeZip } from '../export/zip.ts';
import { usedAssets } from '../model/assets.ts';
import { subtreeIds } from '../model/document.ts';
import { serializeProject } from '../model/project.ts';
import { CodeView } from './CodeView.tsx';
import { useEditor, useEditorState } from './editor-context.ts';
import { copyText, download, selectText } from './files.ts';
import { Icon } from './icons.tsx';
import { PROJECT_FILE, saveProjectFile } from './project-actions.ts';

export type ExportKind = 'site' | 'html' | 'luau' | 'rbxmx' | 'project';

const TABS: readonly (readonly [ExportKind, string])[] = [
  ['site', 'Website'],
  ['html', 'HTML page'],
  ['luau', 'Luau for Studio'],
  ['rbxmx', 'Roblox model'],
  ['project', 'Project file'],
];

const SITE_ZIP = 'website.zip';
const HTML_FILE = 'framecraft-ui.html';
const MODEL_FILE = 'framecraft-ui.rbxmx';
/** Every screen, or the id of one. */
const ALL = '';

/** A file name from a screen's Name, without characters file systems refuse. */
const modelFile = (name: string) =>
  // eslint-disable-next-line no-control-regex
  (name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim() || 'screen') + '.rbxmx';

const size = (n: number) =>
  n < 1000
    ? `${n} B`
    : n < 1e6
      ? `${Math.round(n / 100) / 10} KB`
      : `${Math.round(n / 1e5) / 10} MB`;
const byteLength = (c: string | Uint8Array) =>
  typeof c === 'string' ? new TextEncoder().encode(c).length : c.length;

export function ExportDialog({ kind, onClose }: { kind: ExportKind; onClose: () => void }) {
  const editor = useEditor();
  const { doc, assets } = useEditorState();
  const [tab, setTab] = useState(kind);
  const [target, setTarget] = useState<LuauTarget>('command');
  const [screen, setScreen] = useState(ALL);
  const dialog = useRef<HTMLDialogElement>(null);
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const site = useMemo(() => (tab === 'site' ? exportSite(doc, assets) : []), [tab, doc, assets]);
  const screens = screensOf(doc);
  // A screen picked earlier may have been deleted since.
  const picked = screens.find((s) => s.id === screen);
  const model = useMemo(() => {
    if (tab !== 'rbxmx') return '';
    const one = screensOf(doc).some((s) => s.id === screen);
    return exportRbxmx(doc, one ? [screen] : undefined);
  }, [tab, doc, screen]);
  const modelName = picked ? modelFile(picked.props.Name) : MODEL_FILE;
  const modelObjects = (picked ? [picked] : screens).reduce(
    (n, s) => n + subtreeIds(doc, s.id).length,
    0,
  );

  const text = useMemo(
    () =>
      tab === 'html'
        ? exportHtml(doc, { assets })
        : tab === 'luau'
          ? exportLuau(doc, target)
          : tab === 'project'
            ? serializeProject(doc, assets)
            : '',
    [tab, doc, assets, target],
  );

  const copy = async () => {
    if (await copyText(text)) return editor.toast('Copied to clipboard');
    selectText(pre.current);
    editor.toast('Copy is blocked here. The code is selected: press Ctrl+C.');
  };
  const downloadSite = () => {
    download(SITE_ZIP, makeZip(site), 'application/zip');
    editor.toast(`Downloaded ${SITE_ZIP}. Unzip it and upload the folder to any static host.`);
  };
  const downloadHtml = () => {
    download(HTML_FILE, text, 'text/html');
    editor.toast(`Downloaded ${HTML_FILE}.`);
  };

  const downloadModel = () => {
    download(modelName, model, 'application/xml');
    editor.toast(
      `Downloaded ${modelName}. In Studio, right-click StarterGui and choose Insert from File.`,
    );
  };

  const pages = pagesOf(doc).length;
  const objects = Object.keys(doc.instances).length;
  const pictures = [...usedAssets(doc)].filter((id) => assets[id]).length;

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label="Export"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog itself.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <header>
        <h2>Export</h2>
        <div className="seg" role="tablist" aria-label="What to export">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={tab === k ? 'on' : undefined}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
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

      {tab === 'site' && (
        <>
          <div className="how">
            <p>
              A folder with an HTML file for each page and the pictures they use. Tablet and Phone
              changes become media queries. Unzip it and upload the folder to any static host, such
              as Vercel, Netlify or GitHub Pages.
            </p>
          </div>
          {pages ? (
            <ul className="files" aria-label="Files">
              {site.map((f) => (
                <li key={f.path}>
                  <Icon name={f.path.endsWith('.html') ? 'file' : 'image'} />
                  <span className="path">{f.path}</span>
                  <span className="d">{size(byteLength(f.contents))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">
              Your site has no pages yet. Switch the viewport to the website and insert a Page.
            </p>
          )}
          <footer>
            <span className="count">
              {pages} {pages === 1 ? 'page' : 'pages'}, {site.length}{' '}
              {site.length === 1 ? 'file' : 'files'}
            </span>
            <button className="btn primary" type="button" disabled={!pages} onClick={downloadSite}>
              <Icon name="download" />
              Download {SITE_ZIP}
            </button>
          </footer>
        </>
      )}

      {(tab === 'html' || tab === 'luau') && (
        <>
          <div className="how">
            <p>
              {tab === 'html'
                ? 'Your Roblox screens as one web page. Percents and pixels become CSS calc(), so it resizes like it does in Roblox.'
                : target === 'command'
                  ? 'Paste into Studio’s command bar and press Enter. The UI lands in StarterGui, ready to edit like anything you built by hand.'
                  : 'Paste into a LocalScript in StarterPlayerScripts. Each player gets the UI when they join.'}
            </p>
            {tab === 'luau' && (
              <div className="seg" role="group" aria-label="Where the code runs">
                {(
                  [
                    ['command', 'Command bar'],
                    ['local', 'LocalScript'],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    className={target === t ? 'on' : undefined}
                    aria-pressed={target === t}
                    onClick={() => setTarget(t)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <CodeView
            ref={pre}
            text={text}
            lang={tab}
            label={tab === 'luau' ? 'Exported Luau' : 'Exported HTML'}
          />
          <footer>
            <span className="count">{text.split('\n').length - 1} lines</span>
            {tab === 'html' && (
              <button className="btn" type="button" onClick={downloadHtml}>
                <Icon name="download" />
                Download .html
              </button>
            )}
            <button className="btn primary" type="button" onClick={() => void copy()}>
              <Icon name="copy" />
              Copy
            </button>
          </footer>
        </>
      )}

      {tab === 'rbxmx' && (
        <>
          <div className="how">
            <p>
              A model file for Roblox Studio. In Studio’s Explorer, right-click StarterGui, choose
              Insert from File and pick this file. Your screens land there, ready to edit like
              anything you built by hand.
            </p>
            {screens.length > 1 && (
              <span className="selw">
                <select
                  className="fld txt"
                  aria-label="Which screens"
                  value={picked ? picked.id : ALL}
                  onChange={(e) => setScreen(e.target.value)}
                >
                  <option value={ALL}>All screens</option>
                  {screens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.props.Name}
                    </option>
                  ))}
                </select>
                <Icon name="chevDown" />
              </span>
            )}
          </div>
          {screens.length ? (
            <ul className="files" aria-label="Files">
              <li>
                <Icon name="file" />
                <span className="path">{modelName}</span>
                <span className="d">{size(byteLength(model))}</span>
              </li>
            </ul>
          ) : (
            <p className="empty">
              You have no Roblox screens yet. Switch the viewport to the Roblox screens and insert a
              ScreenGui.
            </p>
          )}
          <footer>
            <span className="count">
              {picked ? 1 : screens.length}{' '}
              {(picked ? 1 : screens.length) === 1 ? 'screen' : 'screens'}, {modelObjects}{' '}
              {modelObjects === 1 ? 'object' : 'objects'}
            </span>
            <button
              className="btn primary"
              type="button"
              disabled={!screens.length}
              onClick={downloadModel}
            >
              <Icon name="download" />
              Download .rbxmx
            </button>
          </footer>
        </>
      )}

      {tab === 'project' && (
        <>
          <div className="how">
            <p>
              Your whole project: the screens, the website and its pictures. Open it later from the
              Project menu to keep working, on this computer or another one.
            </p>
          </div>
          <p className="summary">
            {objects} objects, {pictures} {pictures === 1 ? 'picture' : 'pictures'},{' '}
            {size(byteLength(text))}
          </p>
          <footer>
            <span className="count">{PROJECT_FILE}</span>
            <button className="btn primary" type="button" onClick={() => saveProjectFile(editor)}>
              <Icon name="download" />
              Download project file
            </button>
          </footer>
        </>
      )}
    </dialog>
  );
}
