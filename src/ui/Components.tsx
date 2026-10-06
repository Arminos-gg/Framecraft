/**
 * The Components drawer: pre-made pieces to add to the project, beside the Explorer. It shows
 * the ones made for the view (websites or Roblox) or all of them, by category, with search.
 * Clicking a card opens its preview, where Light or Dark and Rounded or Sharp change the look;
 * Add drops a plain copy into the selected object, like Insert. Cards can also be dragged onto
 * the viewport, or double-clicked.
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { SCREENS, buildScene, type Scene } from '../editor/editor.ts';
import type { Backdrop } from '../export/html.ts';
import { layoutContainer } from '../layout/layout.ts';
import { textVersion } from '../layout/text.ts';
import type { Assets } from '../model/assets.ts';
import {
  COMPONENTS,
  buildComponent,
  defaultLook,
  fitsTarget,
  styleOf,
  type ComponentDef,
  type ComponentOptions,
  type Corners,
  type Look,
  type Target,
} from '../model/components/index.ts';
import { rgb } from '../export/format.ts';
import { subtreeIds, type Doc } from '../model/document.ts';
import { themeFor } from '../model/components/theme.ts';
import { COMPONENT_MIME, encodeComponentDrag } from './component-drag.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { Icon } from './icons.tsx';
import { rulerSteps } from './viewport/rulers.ts';
import { Stage } from './viewport/Stage.tsx';
import { useDocFonts } from './viewport/useDocFonts.ts';

const NO_ASSETS: Assets = {};
/** The window width website components are previewed at. */
const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 760;

const GROUP_TITLES = { site: 'Website', roblox: 'Roblox', both: 'For both' } as const;

interface Preview {
  readonly doc: ComponentDoc;
  readonly scene: Scene;
  readonly rootId: string;
  readonly screens: boolean;
  readonly background: string;
}
type ComponentDoc = Doc;

/** One copy of every component in each style, for the fonts they use. */
const fontDocs = () =>
  COMPONENTS.flatMap((def) =>
    (['site', 'roblox'] as const).map(
      (target) => buildComponent(def, { look: 'light', corners: 'rounded', target }, 'other').doc,
    ),
  );

/** Built previews by component and look, kept while the fonts measure the same. */
const previews = new Map<string, Preview>();
let previewsFor = -1;

function previewOf(def: ComponentDef, options: ComponentOptions): Preview {
  if (previewsFor !== textVersion()) {
    previews.clear();
    previewsFor = textVersion();
  }
  const key = [def.id, options.look, options.corners, options.target].join('|');
  const known = previews.get(key);
  if (known) return known;
  const style = styleOf(def, options.target);
  const theme = themeFor({ ...options, target: style });
  let preview: Preview;
  if (style === 'site') {
    const built = buildComponent(def, options, 'page');
    const layout = layoutContainer(built.doc, built.holderId, {
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    const device = { id: 'preview', label: 'Preview', width: PAGE_WIDTH, height: PAGE_HEIGHT };
    const scene: Scene = {
      view: { kind: 'page', pageId: built.holderId },
      device,
      devices: [device],
      breakpoint: undefined,
      layout,
      width: PAGE_WIDTH,
      height: layout.get(built.holderId)?.canvas?.h ?? PAGE_HEIGHT,
      roots: [built.holderId],
    };
    preview = {
      doc: built.doc,
      scene,
      rootId: built.rootId,
      screens: false,
      background: rgb(theme.c.bg),
    };
  } else {
    const built = buildComponent(def, options, 'other');
    const scene = buildScene({
      doc: built.doc,
      view: SCREENS,
      screenDevice: 'laptop',
      pageDevice: 'desktop',
    });
    preview = { doc: built.doc, scene, rootId: built.rootId, screens: true, background: '' };
  }
  previews.set(key, preview);
  return preview;
}

/** The component drawn by the viewport's own Stage, scaled to fit a box of the given size. */
function ComponentPreview({
  preview,
  width,
  height,
  backdrop,
}: {
  preview: Preview;
  width: number;
  height: number;
  backdrop: Backdrop;
}) {
  const { scene, doc, rootId, screens } = preview;
  const box = scene.layout.get(rootId);
  // A full-width section fills the preview; anything smaller gets a margin around it.
  const margin = !screens && box !== undefined && box.w >= scene.width - 1 ? 0 : 0.12;
  const bw = Math.max(1, box?.w ?? scene.width);
  const bh = Math.max(1, box?.h ?? scene.height);
  const z = Math.min((width * (1 - margin * 2)) / bw, (height * (1 - margin * 2)) / bh, 1);
  const tx = Math.round(width / 2 - ((box?.x ?? 0) + bw / 2) * z);
  const ty = Math.round(height / 2 - ((box?.y ?? 0) + bh / 2) * z);
  const steps = rulerSteps(z);
  // Around the screen, the backdrop's grid carries on in line with the one on it.
  const around = screens
    ? {
        '--grid-minor': `${steps.minor * z}px`,
        '--grid-major': `${steps.major * z}px`,
        backgroundPosition: `${tx}px ${ty}px`,
      }
    : { background: preview.background };
  return (
    <span
      className={screens ? `cpreview backdrop-${backdrop}` : 'cpreview'}
      style={{ width, height, ...around } as CSSProperties}
      aria-hidden="true"
    >
      <span
        className={screens ? `device backdrop-${backdrop}` : 'device'}
        style={
          {
            width: scene.width,
            height: scene.height,
            transform: `translate(${tx}px, ${ty}px) scale(${z})`,
            background: screens ? undefined : preview.background,
            '--zoom': z,
            '--grid-minor': `${steps.minor}px`,
            '--grid-major': `${steps.major}px`,
          } as CSSProperties
        }
      >
        <Stage doc={doc} scene={scene} assets={NO_ASSETS} preview={false} />
      </span>
    </span>
  );
}

/** A preview as wide as its card, which follows the drawer's width. */
function Thumb({
  preview,
  width,
  height,
  backdrop,
}: {
  preview: Preview;
  width: number;
  height: number;
  backdrop: Backdrop;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(width);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.round(el.clientWidth) || width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <span className="thumb" ref={ref} style={{ height }}>
      <ComponentPreview preview={preview} width={w} height={height} backdrop={backdrop} />
    </span>
  );
}

type Show = 'fits' | 'all';

export function ComponentsDrawer() {
  const editor = useEditor();
  const state = useEditorState();
  const target: Target = state.view.kind === 'page' ? 'site' : 'roblox';
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<Show>('fits');
  const [category, setCategory] = useState('All');
  const [picked, setPicked] = useState<string | null>(null);
  const [look, setLook] = useState<Look | null>(null);
  const [corners, setCorners] = useState<Corners>('rounded');

  const pool = COMPONENTS.filter((c) => show === 'all' || fitsTarget(c, target));
  const q = query.trim().toLowerCase();
  const matched = pool.filter(
    (c) => !q || `${c.name} ${c.summary} ${c.category}`.toLowerCase().includes(q),
  );
  const shown = matched.filter((c) => category === 'All' || c.category === category);
  const groups = (
    target === 'site'
      ? (['site', 'roblox', 'both'] as const)
      : (['roblox', 'site', 'both'] as const)
  )
    .map((kind) => {
      const inGroup = matched.filter((c) => c.kind === kind);
      const names = [...new Set(inGroup.map((c) => c.category))];
      return {
        kind,
        cats: names.map((name) => ({ name, n: inGroup.filter((c) => c.category === name).length })),
      };
    })
    .filter((g) => g.cats.length > 0);

  // Cards show each component's usual look; the preview shows the look picked.
  const cardOptions = shown.map((def): ComponentOptions => ({
    look: defaultLook(def, target),
    corners: 'rounded',
    target,
  }));
  const cardPreviews = shown.map((def, i) => previewOf(def, cardOptions[i]!));
  const selected = picked === null ? undefined : shown.find((c) => c.id === picked);
  const selectedOptions: ComponentOptions | null = selected
    ? { look: look ?? defaultLook(selected, target), corners, target }
    : null;
  const selectedPreview = selected && selectedOptions ? previewOf(selected, selectedOptions) : null;
  const objects = selectedPreview
    ? subtreeIds(selectedPreview.doc, selectedPreview.rootId).length
    : 0;
  useDocFonts(
    useMemo(() => fontDocs(), []),
    'framecraft-component-fonts',
  );

  const close = () => editor.setComponentsOpen(false);
  const pick = (def: ComponentDef) => {
    if (def.id !== picked) {
      setLook(null);
      setCorners('rounded');
    }
    setPicked(def.id);
  };
  const add = (def: ComponentDef, options: ComponentOptions) => {
    if (editor.addComponent(def, options)) setPicked(null);
  };
  const destination = selected ? editor.componentParentName(selected) : '';

  const onKeyDown = (e: KeyboardEvent) => {
    // Keys typed here belong to the drawer, except shortcuts such as Ctrl+Z.
    if (!(e.ctrlKey || e.metaKey)) e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (picked !== null) setPicked(null);
      else close();
    }
  };

  return (
    <section className="drawerwrap" aria-label="Components" onKeyDown={onKeyDown}>
      <div className="panel drawer">
        <div className="dhead">
          <div className="dtitle">
            <h2>Components</h2>
            <span className="count">
              {matched.length} {matched.length === 1 ? 'component' : 'components'}
            </span>
            <span className="spacer" />
            <button
              className="ibtn"
              type="button"
              aria-label="Close components"
              title="Close (Esc)"
              onClick={close}
            >
              <Icon name="close" />
            </button>
          </div>
          <label className="filter">
            <span className="sr">Search components</span>
            <Icon name="search" />
            <input
              type="search"
              placeholder={
                target === 'site' ? 'Search, like pricing or footer' : 'Search, like hotbar or shop'
              }
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCategory('All');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && shown[0]) {
                  e.preventDefault();
                  pick(shown[0]);
                }
              }}
            />
          </label>
          <div className="drow">
            <div className="seg" role="group" aria-label="Which components">
              <button
                type="button"
                className={show === 'fits' ? 'on' : undefined}
                aria-pressed={show === 'fits'}
                onClick={() => {
                  setShow('fits');
                  setCategory('All');
                }}
              >
                {target === 'site' ? 'For websites' : 'For Roblox'}
              </button>
              <button
                type="button"
                className={show === 'all' ? 'on' : undefined}
                aria-pressed={show === 'all'}
                onClick={() => {
                  setShow('all');
                  setCategory('All');
                }}
              >
                All
              </button>
            </div>
            <span className="hint">
              Click to preview, drag onto the {target === 'site' ? 'page' : 'screen'} to add
            </span>
          </div>
        </div>
        <div className="dmain">
          <nav className="cats" aria-label="Categories">
            <button
              type="button"
              className={category === 'All' ? 'cat on' : 'cat'}
              aria-pressed={category === 'All'}
              onClick={() => setCategory('All')}
            >
              <span>All</span>
              <span>{matched.length}</span>
            </button>
            {groups.map((g) => (
              <div key={g.kind} className="catgroup" role="group" aria-label={GROUP_TITLES[g.kind]}>
                <h3>{GROUP_TITLES[g.kind]}</h3>
                {g.cats.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className={category === c.name ? 'cat on' : 'cat'}
                    aria-pressed={category === c.name}
                    onClick={() => setCategory(c.name)}
                  >
                    <span>{c.name}</span>
                    <span>{c.n}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="cgrid">
            {shown.map((def, i) => (
              <button
                key={def.id}
                type="button"
                className={def.id === picked ? 'ccard on' : 'ccard'}
                data-component={def.id}
                aria-pressed={def.id === picked}
                draggable
                onClick={() => pick(def)}
                onDoubleClick={() => add(def, cardOptions[i]!)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && def.id === picked) {
                    e.preventDefault();
                    add(def, selectedOptions ?? cardOptions[i]!);
                  }
                }}
                onDragStart={(e) => {
                  const options =
                    def.id === picked && selectedOptions ? selectedOptions : cardOptions[i]!;
                  e.dataTransfer.setData(COMPONENT_MIME, encodeComponentDrag(def.id, options));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <Thumb
                  preview={cardPreviews[i]!}
                  width={THUMB.w}
                  height={THUMB.h}
                  backdrop={state.backdrop}
                />
                <span className="meta">
                  <span className="nm">
                    {def.name}
                    {def.lookOnly && <span className="still">Look only</span>}
                  </span>
                  <span className="ds">{def.summary}</span>
                </span>
              </button>
            ))}
            {!shown.length && <p className="cempty">Nothing matches “{query}”.</p>}
          </div>
        </div>
      </div>

      {selected && selectedOptions && selectedPreview && (
        <div className="cdetail" role="group" aria-label={selected.name}>
          <Thumb
            preview={selectedPreview}
            width={DETAIL.w}
            height={DETAIL.h}
            backdrop={state.backdrop}
          />
          <div className="cbody">
            <div className="ctitle">
              <h3>{selected.name}</h3>
              <button
                className="ibtn"
                type="button"
                aria-label="Close preview"
                onClick={() => setPicked(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p>{selected.description}</p>
            <div className="facts">
              <span className="fact">
                {selected.kind === 'site'
                  ? 'Website'
                  : selected.kind === 'roblox'
                    ? 'Roblox screens'
                    : 'Website and Roblox'}
              </span>
              <span className="fact">Made of {objects} objects</span>
              <span className="fact">
                {styleOf(selected, target) === 'roblox'
                  ? 'Scales with the screen'
                  : selected.place === 'section'
                    ? 'Fits Desktop, Tablet and Phone'
                    : 'Sized in pixels'}
              </span>
            </div>
            {selected.lookOnly && (
              <div className="warn">
                <b>Look only for now.</b> {selected.lookOnly}
              </div>
            )}
            <div className="opt">
              <span id="clook">Look</span>
              <div className="seg" role="group" aria-labelledby="clook">
                {(['light', 'dark'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={selectedOptions.look === l ? 'on' : undefined}
                    aria-pressed={selectedOptions.look === l}
                    onClick={() => setLook(l)}
                  >
                    {l === 'light' ? 'Light' : 'Dark'}
                  </button>
                ))}
              </div>
            </div>
            <div className="opt">
              <span id="ccorners">Corners</span>
              <div className="seg" role="group" aria-labelledby="ccorners">
                {(['rounded', 'sharp'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={selectedOptions.corners === c ? 'on' : undefined}
                    aria-pressed={selectedOptions.corners === c}
                    onClick={() => setCorners(c)}
                  >
                    {c === 'rounded' ? 'Rounded' : 'Sharp'}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn primary wide"
              type="button"
              data-add-component={selected.id}
              onClick={() => add(selected, selectedOptions)}
            >
              Add to {destination}
            </button>
            <span className="hint center">
              {selected.place === 'section'
                ? 'Lands at the end of the page. '
                : 'Lands inside the selected object, like Insert. '}
              It’s a plain copy, so edit it freely.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

const THUMB = { w: 196, h: 118 };
const DETAIL = { w: 380, h: 228 };
