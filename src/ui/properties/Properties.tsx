/**
 * The Properties panel: the selected object's properties by category, with an editor for
 * each value type, and the Code tab. On a page shown at a breakpoint, properties that may
 * differ per breakpoint change there only; a dot marks the ones changed there, and clicking
 * it goes back to the inherited value.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { pagesOf, sceneOf, viewOf } from '../../editor/editor.ts';
import { isGui } from '../../export/html.ts';
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
import { valueEquals, type Link } from '../../model/values.ts';
import { useEditor, useEditorState } from '../editor-context.ts';
import { MAX_PICTURE_BYTES, pickFile, readDataUrl } from '../files.ts';
import { ClassIcon, Icon } from '../icons.tsx';
import { InsertMenu } from '../InsertMenu.tsx';
import { SidePanel } from '../Panel.tsx';
import { CodePane } from './CodePane.tsx';
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
  const { selection } = useEditorState();
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
      aria-selected={tab === t}
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
        <div className="tabs" role="tablist" aria-label="Properties or code">
          {tabButton('props', 'Properties')}
          {tabButton('code', 'Code')}
        </div>
      }
    >
      {tab === 'props' ? (
        <div className="pbody" role="tabpanel" aria-label="Properties">
          <PropsBody
            key={selection ?? 'none'}
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
  const gesture = useMemo<Gesture>(
    () => ({ begin: () => editor.beginGesture(), end: () => editor.endGesture() }),
    [editor],
  );
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
  const notes = notesFor(inst, values, listItem);
  const q = filter.trim().toLowerCase();

  const keys = propNames(inst.className).filter((k) => {
    const spec = propSpec(inst.className, k)!;
    if (def.kind === 'service' && k === 'Name') return false;
    // Links and HTML tags only mean something on the website.
    if (spec.web && !onSite) return false;
    return !q || k.toLowerCase().includes(q);
  });
  const byCategory = new Map<Category, string[]>();
  for (const k of keys) {
    const c = propSpec(inst.className, k)!.category;
    byCategory.set(c, [...(byCategory.get(c) ?? []), k]);
  }

  const set = (key: string) => (v: unknown) => editor.setProp(inst.id, key, v);
  const upload = async (apply: (dataUrl: string) => void) => {
    const file = await pickFile('image/*');
    if (!file) return;
    if (file.size > MAX_PICTURE_BYTES)
      return editor.toast('Pick an image under 1.5 MB, so the project still fits in your browser.');
    apply(await readDataUrl(file));
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
    if (!valueEquals(v, spec.default)) cls.push('chg');
    if (dim) cls.push('dim');
    if (spec.type === 'udim2') cls.push('two');
    const marker =
      bpInst && isOverridable(inst.className, key) ? (
        here ? (
          <button
            className="bpdot on"
            type="button"
            aria-label={`${key} is changed for ${bpInst.props.Name}. Use the inherited value`}
            title={`Changed for ${bpInst.props.Name}. Click to use the inherited value.`}
            onClick={() => editor.resetProp(inst.id, key)}
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
          <label htmlFor={spec.type === 'udim2' ? `${id}-X` : id} title={key}>
            {key}
          </label>
          {editorFor(spec, key, id, v)}
          {marker}
        </div>
        {key === 'Image' && (
          <div className="prow">
            <label>Preview</label>
            <PictureField
              label="preview picture"
              src={inst.preview && state.assets[inst.preview]}
              onUpload={() => upload((url) => editor.setImagePreview(inst.id, url))}
              onRemove={() => editor.setImagePreview(inst.id, null)}
            />
            <span />
          </div>
        )}
      </div>
    );
  };

  function editorFor(spec: PropSpec, key: string, id: string, v: unknown): ReactNode {
    const onChange = set(key);
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
        return (
          <TextField
            id={id}
            label={key}
            value={v as string}
            placeholder="rbxassetid://"
            onCommit={(text) => {
              if (text.trim() !== v) onChange(text.trim());
              return true;
            }}
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
          <ColorSeqField label={key} value={v as never} onChange={onChange} gesture={gesture} />
        );
      case 'numseq':
        return <NumSeqField id={id} label={key} value={v as never} onChange={onChange} />;
      case 'asset': {
        const src = v ? state.assets[v as string] : undefined;
        return (
          <PictureField
            label={key}
            src={src}
            onUpload={() => upload((url) => editor.setPicture(inst!.id, key, url))}
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
      <SelHead inst={inst} />
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
            </div>
          </section>
        );
      })}
      {!keys.length && <p className="empty">No properties match “{filter}”.</p>}
    </>
  );
}

/** The selection's name and class, its actions, and its modifiers as chips. */
function SelHead({ inst }: { inst: AnyInstance }) {
  const editor = useEditor();
  const { doc } = useEditorState();
  const [adding, setAdding] = useState<HTMLElement | null>(null);
  const def = classDef(inst.className);
  const editable = def.kind === 'gui' || def.kind === 'container' || def.kind === 'modifier';
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
