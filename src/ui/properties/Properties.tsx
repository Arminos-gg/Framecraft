/**
 * The Properties panel: the selected object's properties by category, with an editor for
 * each value type, and the Code tab. On a page shown at a breakpoint, properties that may
 * differ per breakpoint change there only; a dot marks the ones changed there, and clicking
 * it goes back to the inherited value. With several objects selected, it shows the properties
 * they all have, with the values of the one picked last, and an edit changes all of them.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { fmtRatio, textContrast, type TextContrast } from '../../editor/contrast.ts';
import { docColors } from '../../editor/color.ts';
import { pagesOf, sceneOf, viewOf, type Picture } from '../../editor/editor.ts';
import { isGui, isTinted, tintId, tintKey } from '../../export/html.ts';
import {
  CATEGORY_ORDER,
  classDef,
  isOverridable,
  propNames,
  propSpec,
  type Category,
  type PropSpec,
} from '../../model/classes.ts';
import { getInstance, resolveProps, type AnyInstance } from '../../model/document.ts';
import { rgb } from '../../export/format.ts';
import type { FontName, FontWeight } from '../../model/fonts.ts';
import { valueEquals, type Color3, type Link } from '../../model/values.ts';
import { useEditor, useEditorState } from '../editor-context.ts';
import { pickFile } from '../files.ts';
import { PICTURE_TYPES, pictureFromFile } from '../pictures.ts';
import { ClassIcon, Icon } from '../icons.tsx';
import { InsertMenu } from '../InsertMenu.tsx';
import { SidePanel } from '../Panel.tsx';
import { onTabKeys } from '../tabs.ts';
import { CodePane } from './CodePane.tsx';
import { FontField, FontWeightField } from './FontFields.tsx';
import {
  AlphaField,
  BoolField,
  ColorField,
  ColorSeqField,
  EnumField,
  LengthField,
  LinkField,
  NumberField,
  NumSeqField,
  PictureField,
  TextField,
  UDim2Field,
  UDim2Text,
  Vec2Field,
  type Gesture,
} from './fields.tsx';
import { notesFor } from './notes.ts';

type Tab = 'props' | 'code';

export function Properties({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selected } = useEditorState();
  const [tab, setTab] = useState<Tab>('props');
  // What stays open or closed as the selection changes.
  const [closed, setClosed] = useState<ReadonlySet<Category>>(new Set());
  const toggle = <T,>(set: ReadonlySet<T>, v: T) => {
    const next = new Set(set);
    if (!next.delete(v)) next.add(v);
    return next;
  };
  const tabButton = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${t}`}
      aria-selected={tab === t}
      aria-controls={`tabpanel-${t}`}
      tabIndex={tab === t ? 0 : -1}
      className={tab === t ? 'tab on' : 'tab'}
      onClick={() => setTab(t)}
    >
      {label}
    </button>
  );
  return (
    <SidePanel
      title="Properties"
      className="props"
      open={open}
      onClose={onClose}
      head={
        <div className="tabs" role="tablist" aria-label="Properties or code" onKeyDown={onTabKeys}>
          {tabButton('props', 'Properties')}
          {tabButton('code', 'Code')}
        </div>
      }
    >
      {tab === 'props' ? (
        <div
          className="pbody"
          role="tabpanel"
          id="tabpanel-props"
          aria-labelledby="tab-props"
          // It scrolls, so the keyboard can reach it even with no fields in it.
          tabIndex={0}
        >
          <PropsBody
            key={selected.join(' ') || 'none'}
            closed={closed}
            onToggleCategory={(c) => setClosed((s) => toggle(s, c))}
          />
        </div>
      ) : (
        <CodePane />
      )}
    </SidePanel>
  );
}

function Help() {
  return (
    <div className="empty">
      <h3>Nothing selected</h3>
      <p>Click an object in the viewport or the Explorer to edit it.</p>
      <div className="unitcard">
        <div className="u2demo">
          <UDim2Text value={[0.5, 20, 0, 200]} />
        </div>
        <p>
          Position and Size take a <b className="s">percent</b> of the parent, a number of{' '}
          <b className="o">pixels</b>, or both, like <code>50% + 20px</code>. Percents stretch with
          the screen, pixels stay the same. Studio’s <code>{'{0.5, 0},{0.5, 0}'}</code> works too.
        </p>
      </div>
      <h4>Shortcuts</h4>
      <dl className="keys">
        <dt>
          <kbd>Del</kbd>
        </dt>
        <dd>Delete</dd>
        <dt>
          <kbd>Ctrl</kbd> <kbd>D</kbd>
        </dt>
        <dd>Duplicate</dd>
        <dt>
          <kbd>Ctrl</kbd> or <kbd>Shift</kbd> + click
        </dt>
        <dd>Select several</dd>
        <dt>
          <kbd>Ctrl</kbd> <kbd>G</kbd>
        </dt>
        <dd>Group into a Folder</dd>
        <dt>
          <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>
        </dt>
        <dd>Nudge 1 px, 10 px with Shift</dd>
        <dt>
          <kbd>Esc</kbd>
        </dt>
        <dd>Select the parent</dd>
        <dt>
          <kbd>F2</kbd>
        </dt>
        <dd>Rename</dd>
        <dt>
          <kbd>P</kbd>
        </dt>
        <dd>Preview</dd>
        <dt>Middle button</dt>
        <dd>Drag to pan</dd>
        <dt>
          <kbd>F6</kbd>
        </dt>
        <dd>Move to the next panel</dd>
      </dl>
    </div>
  );
}

const SERVICE_HELP: Partial<Record<string, string>> = {
  StarterGui:
    'Holds your ScreenGuis. In a Roblox game, everything here is copied onto each player’s screen. Export it as Luau for Studio.',
};

interface BodyProps {
  closed: ReadonlySet<Category>;
  onToggleCategory: (c: Category) => void;
}

function PropsBody({ closed, onToggleCategory }: BodyProps) {
  const editor = useEditor();
  const state = useEditorState();
  const [filter, setFilter] = useState('');
  const { doc, selection } = state;
  const inst = selection === null ? undefined : getInstance(doc, selection);
  const all = state.selected.flatMap((id) => getInstance(doc, id) ?? []);
  const many = all.length > 1;
  const gesture = useMemo<Gesture>(
    () => ({ begin: () => editor.beginGesture(), end: () => editor.endGesture() }),
    [editor],
  );
  const projectColors = useMemo(() => () => docColors(editor.doc), [editor]);
  if (!inst) return <Help />;
  const help = SERVICE_HELP[inst.className];
  if (help)
    return (
      <div className="empty">
        <h3>{inst.className}</h3>
        <p>{help}</p>
      </div>
    );

  const scene = sceneOf(state);
  const def = classDef(inst.className);
  const bp = editor.breakpointFor(inst.id);
  const bpInst = bp === undefined ? undefined : getInstance(doc, bp);
  const values = resolveProps(doc, inst, bp) as Readonly<Record<string, unknown>>;
  const own: Readonly<Record<string, unknown>> = (bp && inst.overrides?.[bp]) || {};
  const box = scene.layout.get(inst.id);
  const listItem = !!box?.listItem;
  const onSite = viewOf(doc, inst.id)?.kind === 'page' || inst.className === 'Site';
  const notes = notesFor(inst, values, listItem, onSite);
  const contrast = def.text ? textContrast(doc, scene, inst.id) : undefined;
  const q = filter.trim().toLowerCase();

  const keys = propNames(inst.className).filter((k) => {
    const spec = propSpec(inst.className, k)!;
    if (def.kind === 'service' && k === 'Name') return false;
    // Several objects: the properties they all have. Pictures stay one object's.
    if (many && (spec.type === 'image' || spec.type === 'asset')) return false;
    if (many && !all.every((o) => propSpec(o.className, k))) return false;
    // Links and HTML tags only mean something on the website.
    if (spec.web && !onSite) return false;
    // Only objects straight on a page can be pinned to the window.
    if ((k as string) === 'Pinned' && getInstance(doc, inst.parent ?? '')?.className !== 'Page')
      return false;
    return !q || k.toLowerCase().includes(q);
  });
  const byCategory = new Map<Category, string[]>();
  for (const k of keys) {
    const c = propSpec(inst.className, k)!.category;
    byCategory.set(c, [...(byCategory.get(c) ?? []), k]);
  }

  const set = (key: string) => (v: unknown) =>
    many ? editor.setSelectedProp(key, v) : editor.setProp(inst.id, key, v);
  /** Whether the selected objects differ in a property. */
  const mixed = (key: string, v: unknown) =>
    many &&
    all.some(
      (o) =>
        !valueEquals(
          (resolveProps(doc, o, editor.breakpointFor(o.id)) as Record<string, unknown>)[key],
          v,
        ),
    );
  const upload = async (apply: (pic: Picture) => void) => {
    const file = await pickFile(PICTURE_TYPES);
    if (!file) return;
    try {
      apply(await pictureFromFile(file));
    } catch (err) {
      editor.toast(err instanceof Error ? err.message : 'That file couldn’t be read.');
    }
  };

  const row = (key: string) => {
    const spec = propSpec(inst.className, key)!;
    const v = values[key];
    const id = `p-${key}`;
    const here = Object.hasOwn(own, key);
    const dim =
      (listItem && (key === 'Position' || key === 'AnchorPoint' || key === 'Rotation')) ||
      (key === 'TextSize' && values.TextScaled === true);
    const cls = ['prow'];
    if (!valueEquals(v, spec.default) || (spec.type === 'image' && inst.preview)) cls.push('chg');
    if (dim) cls.push('dim');
    if (spec.type === 'udim2') cls.push('two');
    const differs = mixed(key, v);
    if (differs) cls.push('mixed');
    const marker =
      bpInst && isOverridable(inst.className, key) ? (
        here ? (
          <button
            className="bpdot on"
            type="button"
            aria-label={`${key} is changed for ${bpInst.props.Name}. Use the inherited value`}
            title={`Changed for ${bpInst.props.Name}. Click to use the inherited value.`}
            onClick={() => (many ? editor.resetSelectedProp(key) : editor.resetProp(inst.id, key))}
          />
        ) : (
          <span className="bpdot" title={`Changes here apply to ${bpInst.props.Name} only`} />
        )
      ) : (
        <span />
      );
    return (
      <div key={key}>
        <div className={cls.join(' ')}>
          <label
            htmlFor={spec.type === 'udim2' ? `${id}-X` : id}
            title={
              differs
                ? `${key} differs between the selected objects; this is ${inst.props.Name}’s`
                : key
            }
          >
            {key}
          </label>
          {editorFor(spec, key, id, v)}
          {marker}
        </div>
        {spec.type === 'image' && !onSite && (
          <div className="prow">
            <label htmlFor={`${id}-id`} title="The image’s id in Roblox, for the Roblox export">
              Asset id
            </label>
            <TextField
              id={`${id}-id`}
              label="Asset id"
              value={v as string}
              placeholder="rbxassetid:// for Studio"
              onCommit={(text) => {
                if (text.trim() !== v) set(key)(text.trim());
                return true;
              }}
            />
            <span />
          </div>
        )}
      </div>
    );
  };

  function editorFor(spec: PropSpec, key: string, id: string, v: unknown): ReactNode {
    const onChange = set(key);
    if (key === 'Font')
      return <FontField id={id} value={v as FontName} onSite={onSite} onChange={onChange} />;
    if (key === 'FontWeight')
      return (
        <FontWeightField
          id={id}
          font={values.Font as FontName}
          value={v as FontWeight}
          onChange={onChange}
        />
      );
    switch (spec.type) {
      case 'string':
        return (
          <TextField
            id={id}
            label={key}
            className="txt"
            value={v as string}
            onCommit={(text) => {
              // A name can't be blank; keep the old one.
              if (key === 'Name' && !text.trim()) return true;
              if (text !== v) onChange(key === 'Name' ? text.trim() : text);
              return true;
            }}
          />
        );
      case 'image':
        // The picture is what the editor and the website show. The Roblox asset id, which
        // browsers can't load, has its own row on the Roblox screens.
        return (
          <PictureField
            label={key}
            large
            src={inst!.preview && state.assets[inst!.preview]}
            tint={tintOf(values.ImageColor3)}
            onUpload={() => upload((pic) => editor.setImagePreview(inst!.id, pic))}
            onRemove={() => editor.setImagePreview(inst!.id, null)}
          />
        );
      case 'int':
      case 'number':
        return (
          <NumberField
            id={id}
            label={key}
            value={v as number}
            int={spec.type === 'int'}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            unit={key === 'LetterSpacing' ? 'px' : undefined}
            onChange={onChange}
          />
        );
      case 'bool':
        return <BoolField id={id} label={key} value={v as boolean} onChange={onChange} />;
      case 'enum':
        return (
          <EnumField
            id={id}
            label={key}
            value={v as string}
            options={spec.options ?? []}
            onChange={onChange}
          />
        );
      case 'alpha':
        return (
          <AlphaField
            id={id}
            label={key}
            value={v as number}
            onChange={onChange}
            gesture={gesture}
          />
        );
      case 'color':
        return (
          <ColorField
            id={id}
            label={key}
            value={v as never}
            onChange={onChange}
            gesture={gesture}
            swatches={projectColors}
          />
        );
      case 'vec2':
        return (
          <Vec2Field
            id={id}
            label={key}
            value={v as never}
            onChange={onChange}
            anchorPicker={key === 'AnchorPoint'}
          />
        );
      case 'udim':
        return <LengthField id={id} label={key} value={v as never} onChange={onChange} />;
      case 'udim2':
        return <UDim2Field id={id} label={key} value={v as never} onChange={onChange} />;
      case 'colorseq':
        return (
          <ColorSeqField
            label={key}
            value={v as never}
            onChange={onChange}
            gesture={gesture}
            swatches={projectColors}
          />
        );
      case 'numseq':
        return <NumSeqField id={id} label={key} value={v as never} onChange={onChange} />;
      case 'asset': {
        const src = v ? state.assets[v as string] : undefined;
        return (
          <PictureField
            label={key}
            src={src}
            onUpload={() => upload((pic) => editor.setPicture(inst!.id, key, pic.dataUrl))}
            onRemove={() => editor.setPicture(inst!.id, key, null)}
          />
        );
      }
      case 'link':
        return (
          <LinkField
            id={id}
            value={v as Link | null}
            pages={pagesOf(doc).map((p) => ({ id: p.id, name: p.props.Name }))}
            onChange={onChange}
          />
        );
    }
  }

  return (
    <>
      {many ? <ManyHead list={all} primary={inst} /> : <SelHead inst={inst} />}
      {bpInst?.className === 'Breakpoint' && (
        <div className="bpbar">
          <b>{bpInst.props.Name}</b>: layout, size, visibility, text size and colors change for{' '}
          {bpInst.props.Name} only. Other properties change everywhere.
        </div>
      )}
      <label className="filter pf">
        <span className="sr">Filter properties</span>
        <Icon name="search" />
        <input
          type="search"
          placeholder="Filter properties"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => {
        const isOpen = !!q || !closed.has(cat);
        const list = byCategory.get(cat)!;
        return (
          <section key={cat} className={isOpen ? 'cat open' : 'cat'}>
            <button
              className="ch"
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggleCategory(cat)}
            >
              <Icon name="chev" />
              {cat}
              {!isOpen && <span className="n">{list.length}</span>}
            </button>
            <div className="rows">
              {list.map(row)}
              {notes[cat] && !q && (
                <div className="note">
                  <Icon name="info" />
                  <span>{notes[cat]}</span>
                </div>
              )}
              {cat === 'Text' && contrast && !q && <ContrastNote c={contrast} />}
            </div>
          </section>
        );
      })}
      {!keys.length && <p className="empty">No properties match “{filter}”.</p>}
    </>
  );
}

/** How readable the text is against what's behind it, by WCAG's measure. */
function ContrastNote({ c }: { c: TextContrast }) {
  const ok = c.ratio >= c.needed;
  return (
    <div className={ok ? 'note contrast' : 'note contrast warn'} data-testid="contrast">
      <Icon name={ok ? 'check' : 'warn'} />
      <span>
        <span
          className="pair"
          aria-hidden="true"
          style={{ color: rgb(c.text), background: rgb(c.background) }}
        >
          Aa
        </span>
        Contrast {fmtRatio(c.ratio)}.{' '}
        {ok
          ? `Easy to read: text this size needs ${c.needed}:1.`
          : `Text this size needs ${c.needed}:1 to be easy to read. Make TextColor3 or the background behind it lighter or darker.`}
      </span>
    </div>
  );
}

/** Several objects selected: how many, of which classes, and their actions. */
function ManyHead({ list, primary }: { list: readonly AnyInstance[]; primary: AnyInstance }) {
  const editor = useEditor();
  const classes = [...new Set(list.map((i) => i.className))];
  return (
    <div className="selhead">
      <div className="who">
        <ClassIcon className={classes.length === 1 ? classes[0]! : 'Folder'} />
        <b>{list.length} objects</b>
        <span className="cls">{classes.length === 1 ? classes[0] : 'Mixed'}</span>
        <span className="acts">
          <button
            className="ibtn sm"
            type="button"
            aria-label="Group into a Folder"
            title="Group into a Folder (Ctrl+G)"
            onClick={() => editor.groupSelection()}
          >
            <Icon name="group" />
          </button>
          <button
            className="ibtn sm"
            type="button"
            aria-label="Duplicate"
            title="Duplicate (Ctrl+D)"
            onClick={() => editor.duplicateSelection()}
          >
            <Icon name="duplicate" />
          </button>
          <button
            className="ibtn sm"
            type="button"
            aria-label="Delete"
            title="Delete (Del)"
            onClick={() => editor.deleteSelection()}
          >
            <Icon name="trash" />
          </button>
        </span>
      </div>
      <div className="parentline">
        Edits change all of them. Values shown are {primary.props.Name}’s.
      </div>
    </div>
  );
}

/** The selection's name and class, its actions, and its modifiers as chips. */
function SelHead({ inst }: { inst: AnyInstance }) {
  const editor = useEditor();
  const { doc } = useEditorState();
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const def = classDef(inst.className);
  const editable = ['gui', 'container', 'modifier', 'folder'].includes(def.kind);
  const mods = inst.children
    .map((c) => getInstance(doc, c)!)
    .filter((c) => classDef(c.className).kind === 'modifier');
  const canMod = isGui(inst) || inst.className === 'Page' || inst.className === 'ScreenGui';
  const parent = inst.parent === null ? undefined : getInstance(doc, inst.parent);
  return (
    <div className="selhead">
      <div className="who">
        <ClassIcon className={inst.className} />
        <b>{inst.props.Name}</b>
        <span className="cls">{inst.className}</span>
        {editable && (
          <span className="acts">
            <button
              className="ibtn sm"
              type="button"
              aria-label="Duplicate"
              title="Duplicate (Ctrl+D)"
              onClick={() => editor.duplicateSelection()}
            >
              <Icon name="duplicate" />
            </button>
            <button
              className="ibtn sm"
              type="button"
              aria-label="Delete"
              title="Delete (Del)"
              onClick={() => editor.deleteSelection()}
            >
              <Icon name="trash" />
            </button>
          </span>
        )}
      </div>
      {canMod && (
        <div className="mods">
          {mods.map((m) => (
            <button
              key={m.id}
              className="chip"
              type="button"
              title={`Select this ${m.className}`}
              onClick={() => editor.select(m.id)}
            >
              <ClassIcon className={m.className} />
              {m.props.Name}
            </button>
          ))}
          <button
            className={mods.length ? 'chip add icon' : 'chip add'}
            type="button"
            aria-label="Add a modifier"
            title="Add a modifier"
            onClick={(e) => setAdding(adding ? null : e.currentTarget)}
          >
            <Icon name="plus" />
            {!mods.length && 'Add modifier'}
          </button>
        </div>
      )}
      {def.kind === 'modifier' && parent && (
        <div className="parentline">
          Modifier of{' '}
          <button className="link" type="button" onClick={() => editor.select(parent.id)}>
            {parent.props.Name}
          </button>
        </div>
      )}
      {adding && (
        <InsertMenu
          parentId={inst.id}
          anchor={adding}
          modifiersOnly
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

/** The filter the viewport tints a picture with (see Stage), for its thumbnail. */
function tintOf(color: unknown): string | undefined {
  const c = color as Color3 | undefined;
  return c && isTinted(c) ? `url(#${tintId(tintKey(c))})` : undefined;
}
