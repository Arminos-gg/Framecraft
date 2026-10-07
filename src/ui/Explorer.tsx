/**
 * The Explorer: the project's tree, as in Studio. StarterGui holds the Roblox screens, Site
 * holds the pages, and the breakpoints sit beside them. Click to select (Ctrl or Cmd adds one,
 * Shift a range), double-click or F2 to rename, right-click for the object menu, drag rows onto
 * another to move them in, or onto its top or bottom edge to reorder. Arrow keys walk the tree.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { isGui } from '../export/html.ts';
import { insertableInto } from '../editor/insert.ts';
import { canParent, classDef } from '../model/classes.ts';
import {
  getInstance,
  isAncestor,
  resolveProps,
  type Doc,
  type InstanceId,
} from '../model/document.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { ClassIcon, Icon } from './icons.tsx';
import { InsertMenu } from './InsertMenu.tsx';
import { ObjectMenu } from './ObjectMenu.tsx';
import { SidePanel } from './Panel.tsx';

interface Row {
  readonly id: InstanceId;
  readonly depth: number;
  readonly hasKids: boolean;
  readonly open: boolean;
}

type DropMode = 'before' | 'after' | 'in';

/** The rows shown: open branches, or with a filter, the matches and everything above them. */
function visibleRows(doc: Doc, expanded: ReadonlySet<InstanceId>, filter: string): Row[] {
  const q = filter.trim().toLowerCase();
  let keep: Set<InstanceId> | null = null;
  if (q) {
    keep = new Set();
    for (const inst of Object.values(doc.instances)) {
      if (inst.id === doc.rootId) continue;
      const hit =
        inst.props.Name.toLowerCase().includes(q) || inst.className.toLowerCase().includes(q);
      for (let p: InstanceId | null = hit ? inst.id : null; p && p !== doc.rootId;) {
        keep.add(p);
        p = getInstance(doc, p)?.parent ?? null;
      }
    }
  }
  const rows: Row[] = [];
  const walk = (id: InstanceId, depth: number) => {
    for (const c of getInstance(doc, id)?.children ?? []) {
      if (keep && !keep.has(c)) continue;
      const inst = getInstance(doc, c)!;
      const open = keep ? true : expanded.has(c);
      rows.push({ id: c, depth, hasKids: inst.children.length > 0, open });
      if (open) walk(c, depth + 1);
    }
  };
  walk(doc.rootId, 0);
  return rows;
}

const movable = (doc: Doc, id: InstanceId) => {
  const inst = getInstance(doc, id);
  const kind = inst && classDef(inst.className).kind;
  return kind === 'gui' || kind === 'container' || kind === 'modifier' || kind === 'folder';
};

/** The right-click menu, where it opened and for which row. */
interface Menu {
  readonly x: number;
  readonly y: number;
  readonly row: HTMLElement;
  readonly id: InstanceId;
}

export function Explorer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const editor = useEditor();
  const state = useEditorState();
  const { doc, selection, selected, expanded, renaming, hover } = state;
  const [filter, setFilter] = useState('');
  const [insertFor, setInsertFor] = useState<{ id: InstanceId; anchor: HTMLElement } | null>(null);
  const [drop, setDrop] = useState<{ id: InstanceId; mode: DropMode } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  /** The rows being dragged: the one under the pointer, with the rest of the selection. */
  const dragIds = useRef<readonly InstanceId[]>([]);
  const treeRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => visibleRows(doc, expanded, filter), [doc, expanded, filter]);

  // Keep the selected row in sight, and keyboard focus on it while the tree has focus.
  useEffect(() => {
    const tree = treeRef.current;
    if (!tree || selection === null) return;
    const row = tree.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(selection)}"]`);
    if (!row) return;
    row.scrollIntoView?.({ block: 'nearest' });
    if (tree.contains(document.activeElement) && document.activeElement !== row) {
      if (!(document.activeElement instanceof HTMLInputElement)) row.focus();
    }
  }, [selection, rows]);

  const go = (row: Row | undefined) => row && editor.select(row.id);

  /** Ctrl or Cmd adds a row to the selection or takes it out; Shift selects a range. */
  const onRowClick = (e: MouseEvent, id: InstanceId) => {
    if (e.ctrlKey || e.metaKey) return editor.toggleSelected(id);
    if (e.shiftKey && selection !== null) {
      const a = rows.findIndex((r) => r.id === selection);
      const b = rows.findIndex((r) => r.id === id);
      if (a >= 0 && b >= 0) {
        const range = rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((r) => r.id);
        // The row picked first stays first; the clicked one is shown in Properties.
        return editor.selectMany(a < b ? range : range.reverse(), id);
      }
    }
    editor.select(id);
  };

  const openMenu = (row: HTMLElement, id: InstanceId, x: number, y: number) => {
    if (!selected.includes(id)) editor.select(id);
    setInsertFor(null);
    setMenu({ x, y, row, id });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || state.preview) return;
    const i = rows.findIndex((r) => r.id === selection);
    const row = rows[i];
    switch (e.key) {
      case 'ArrowDown':
        go(rows[Math.min(rows.length - 1, i + 1)]);
        break;
      case 'ArrowUp':
        go(rows[Math.max(0, i - 1)]);
        break;
      case 'Home':
        go(rows[0]);
        break;
      case 'End':
        go(rows[rows.length - 1]);
        break;
      case 'ArrowRight':
        if (!row) return go(rows[0]);
        if (row.hasKids && !row.open) editor.setExpanded(row.id, true);
        else if (row.open) go(rows[i + 1]);
        break;
      case 'ArrowLeft':
        if (!row) return go(rows[0]);
        if (row.open && row.hasKids && !filter) editor.setExpanded(row.id, false);
        else go(rows.slice(0, i).findLast((r) => r.depth === row.depth - 1));
        break;
      case 'Enter':
      case 'F2':
        editor.startRename();
        break;
      case 'ContextMenu':
      case 'F10': {
        if (e.key === 'F10' && !e.shiftKey) return;
        const el = treeRef.current?.querySelector<HTMLElement>(
          `.row[data-id="${CSS.escape(selection ?? '')}"]`,
        );
        if (!el || selection === null) return;
        const r = el.getBoundingClientRect();
        openMenu(el, selection, r.left + 24, r.bottom);
        break;
      }
      default:
        return;
    }
    // Handled here, so the editor's shortcuts (arrows nudge) leave it alone.
    e.preventDefault();
  };

  const dropMode = (e: DragEvent, targetId: InstanceId): DropMode | null => {
    const moving = dragIds.current.flatMap((id) => getInstance(doc, id) ?? []);
    const target = getInstance(doc, targetId);
    if (
      !moving.length ||
      !target ||
      moving.some((m) => m.id === target.id || isAncestor(doc, m.id, target.id))
    )
      return null;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    const parent = target.parent === null ? undefined : getInstance(doc, target.parent);
    const fits = (p: { className: Parameters<typeof canParent>[1] }) =>
      moving.every((m) => canParent(m.className, p.className));
    const besideOk = !!parent && fits(parent);
    const openRow = expanded.has(target.id) && target.children.length > 0;
    if (f < 0.28 && besideOk) return 'before';
    if (f > 0.72 && besideOk && !openRow) return 'after';
    if (fits(target)) return 'in';
    return besideOk ? (f < 0.5 ? 'before' : 'after') : null;
  };
  const onDrop = (e: DragEvent, targetId: InstanceId) => {
    const mode = dropMode(e, targetId);
    const moving = dragIds.current;
    setDrop(null);
    if (!mode || !moving.length) return;
    e.preventDefault();
    const many = moving.length > 1;
    if (mode === 'in') {
      if (many) editor.moveManyTo(moving, targetId);
      else editor.moveTo(moving[0]!, targetId);
      return;
    }
    const parentId = getInstance(doc, targetId)!.parent!;
    const others = getInstance(doc, parentId)!.children.filter((c) => !moving.includes(c));
    const index = others.indexOf(targetId) + (mode === 'after' ? 1 : 0);
    if (many) editor.moveManyTo(moving, parentId, index);
    else editor.moveTo(moving[0]!, parentId, index);
  };

  const header = (
    <button
      className="ibtn sm"
      type="button"
      title="Insert an object into the selection"
      aria-label="Insert object"
      onClick={(e) => {
        const target =
          selection ?? (state.view.kind === 'page' ? state.view.pageId : null) ?? rows[0]?.id;
        if (target) setInsertFor({ id: target, anchor: e.currentTarget });
      }}
    >
      <Icon name="plus" />
    </button>
  );

  return (
    <SidePanel title="Explorer" className="explorer" open={open} onClose={onClose} actions={header}>
      <label className="filter">
        <span className="sr">Filter objects</span>
        <Icon name="search" />
        <input
          type="search"
          placeholder="Filter objects"
          autoComplete="off"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </label>
      <div className="pbody">
        <div
          ref={treeRef}
          className="tree"
          role="tree"
          aria-label="Objects"
          aria-multiselectable="true"
          onKeyDown={onKeyDown}
          onPointerLeave={() => editor.setHover(null)}
        >
          {rows.map((row, i) => {
            const inst = getInstance(doc, row.id)!;
            const name = inst.props.Name;
            const sel = selected.includes(row.id);
            const inside = !sel && selection !== null && isAncestor(doc, selection, row.id);
            const kind = classDef(inst.className).kind;
            let hidden = false;
            if (inst.className === 'ScreenGui') hidden = !inst.props.Enabled;
            else if (isGui(inst))
              hidden = !resolveProps(doc, inst, editor.breakpointFor(inst.id)).Visible;
            const canInsert = kind !== 'root' && kind !== 'setting' && kind !== 'modifier';
            const ins = canInsert ? insertableInto(doc, row.id) : null;
            const cls = ['row'];
            if (sel) cls.push('sel');
            if (inside) cls.push('sub');
            if (hidden) cls.push('off');
            if (kind === 'modifier') cls.push('modrow');
            if (hover === row.id && !sel) cls.push('hov');
            if (insertFor?.id === row.id) cls.push('pin');
            if (drop?.id === row.id) cls.push('drop-' + drop.mode);
            const focusable = sel || (selection === null && i === 0);
            return (
              <div
                key={row.id}
                className={cls.join(' ')}
                role="treeitem"
                aria-selected={sel}
                aria-expanded={row.hasKids ? row.open : undefined}
                aria-level={row.depth + 1}
                aria-label={name}
                data-id={row.id}
                tabIndex={focusable ? 0 : -1}
                title={inst.className}
                style={
                  {
                    paddingLeft: 4 + row.depth * 14,
                    // Where a drop line starts: under the row's icon.
                    '--dl': `${22 + row.depth * 14}px`,
                  } as CSSProperties
                }
                draggable={movable(doc, row.id) && renaming !== row.id}
                onClick={(e) => onRowClick(e, row.id)}
                onContextMenu={(e) => {
                  if (state.preview) return;
                  e.preventDefault();
                  openMenu(e.currentTarget, row.id, e.clientX, e.clientY);
                }}
                onDoubleClick={(e) => {
                  if ((e.target as Element).closest('.nm')) editor.startRename(row.id);
                }}
                onPointerEnter={() => editor.setHover(row.id)}
                onDragStart={(e) => {
                  const many = selected.includes(row.id) && selected.length > 1;
                  dragIds.current = many ? editor.targetIds : [row.id];
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', name);
                }}
                onDragOver={(e) => {
                  const mode = dropMode(e, row.id);
                  if (mode) e.preventDefault();
                  if (drop?.id !== row.id || drop.mode !== mode)
                    setDrop(mode ? { id: row.id, mode } : null);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
                }}
                onDrop={(e) => onDrop(e, row.id)}
                onDragEnd={() => {
                  dragIds.current = [];
                  setDrop(null);
                }}
              >
                {Array.from({ length: row.depth }, (_, d) => (
                  <i key={d} className="ig" style={{ left: 12 + d * 14 }} />
                ))}
                <button
                  className={row.open ? 'tw open' : 'tw'}
                  type="button"
                  tabIndex={-1}
                  aria-label={`${row.open ? 'Collapse' : 'Expand'} ${name}`}
                  style={row.hasKids ? undefined : { visibility: 'hidden' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    editor.setExpanded(row.id);
                  }}
                >
                  <Icon name="chev" />
                </button>
                <ClassIcon className={inst.className} />
                <span className="nm">
                  {renaming === row.id ? (
                    <RenameInput initial={name} onDone={(n) => editor.endRename(n)} />
                  ) : (
                    name
                  )}
                </span>
                <span className="ra">
                  {ins && (ins.objects.length > 0 || ins.modifiers.length > 0) && (
                    <button
                      className={insertFor?.id === row.id ? 'rb on' : 'rb'}
                      type="button"
                      tabIndex={-1}
                      aria-label={`Insert into ${name}`}
                      title="Insert object"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsertFor({ id: row.id, anchor: e.currentTarget });
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                  )}
                  {(isGui(inst) || inst.className === 'ScreenGui') && (
                    <button
                      className={hidden ? 'rb eye off' : 'rb eye'}
                      type="button"
                      tabIndex={-1}
                      aria-label={`${hidden ? 'Show' : 'Hide'} ${name}`}
                      title={hidden ? 'Show' : 'Hide'}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.toggleVisible(row.id);
                      }}
                    >
                      <Icon name={hidden ? 'eyeOff' : 'eye'} />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {!rows.length && <p className="treeempty">No objects match “{filter}”.</p>}
        </div>
      </div>
      {menu && getInstance(doc, menu.id) && (
        <ObjectMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          onInsert={() => setInsertFor({ id: menu.id, anchor: menu.row })}
        />
      )}
      {insertFor && getInstance(doc, insertFor.id) && (
        <InsertMenu
          parentId={insertFor.id}
          anchor={insertFor.anchor}
          placement={insertFor.anchor.closest('.row') ? 'right' : 'below'}
          onClose={() => setInsertFor(null)}
        />
      )}
    </SidePanel>
  );
}

/** The name field while renaming. Enter or leaving the field keeps the name; Escape cancels. */
function RenameInput({ initial, onDone }: { initial: string; onDone: (name?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (name?: string) => {
    if (done.current) return;
    done.current = true;
    // Give focus back to the row, so the arrow keys keep walking the tree.
    ref.current?.closest<HTMLElement>('.row')?.focus();
    onDone(name);
  };
  return (
    <input
      ref={ref}
      defaultValue={initial}
      aria-label={`Rename ${initial}`}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish();
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}
