/**
 * The right-click menu for objects, in the Explorer and the viewport: insert, rename, cut,
 * copy, paste, duplicate, group into a Folder, show or hide, and delete. Its actions work on
 * the whole selection, as the shortcuts do.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Editor } from '../editor/editor.ts';
import { insertableInto } from '../editor/insert.ts';
import { isGui } from '../export/html.ts';
import { classDef } from '../model/classes.ts';
import { getInstance, resolveProps } from '../model/document.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { Icon, type IconName } from './icons.tsx';

interface Item {
  readonly label: string;
  readonly icon: IconName;
  readonly keys?: string;
  readonly danger?: boolean;
  readonly run: () => void;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const key = (k: string) => (MOD ? '⌘' : 'Ctrl+') + k;

/** The menu's items for the current selection, in groups. */
function itemsFor(editor: Editor, onInsert?: () => void): Item[][] {
  const { doc, selection, selected } = editor.state;
  const inst = selection === null ? undefined : getInstance(doc, selection);
  if (!inst) return [];
  const count = editor.targetCount;
  const many = selected.length > 1;
  const kind = classDef(inst.className).kind;
  const ins = insertableInto(doc, inst.id);
  const canInsert =
    !many && !!onInsert && kind !== 'modifier' && ins.objects.length + ins.modifiers.length > 0;
  const objects = selected.flatMap((id) => {
    const i = getInstance(doc, id);
    return i && (isGui(i) || i.className === 'ScreenGui') ? [i] : [];
  });
  const hidden = objects.some((i) =>
    i.className === 'ScreenGui'
      ? !i.props.Enabled
      : isGui(i) && !resolveProps(doc, i, editor.breakpointFor(i.id)).Visible,
  );
  const groupable = selected.some((id) => {
    const k = getInstance(doc, id) && classDef(getInstance(doc, id)!.className).kind;
    return k === 'gui' || k === 'folder';
  });
  const folders = selected.some((id) => getInstance(doc, id)?.className === 'Folder');

  const first: Item[] = [];
  if (canInsert) first.push({ label: 'Insert object…', icon: 'plus', run: onInsert });
  if (!many && editor.canRename(inst.id))
    first.push({ label: 'Rename', icon: 'rename', keys: 'F2', run: () => editor.startRename() });
  const clip: Item[] = [];
  if (count) {
    clip.push(
      { label: 'Cut', icon: 'cut', keys: key('X'), run: () => editor.copySelection(true) },
      { label: 'Copy', icon: 'copy', keys: key('C'), run: () => editor.copySelection() },
    );
  }
  if (editor.canPaste && !many)
    clip.push({ label: 'Paste into', icon: 'paste', keys: key('V'), run: () => editor.paste() });
  if (count)
    clip.push({
      label: 'Duplicate',
      icon: 'duplicate',
      keys: key('D'),
      run: () => editor.duplicateSelection(),
    });
  const arrange: Item[] = [];
  if (groupable)
    arrange.push({
      label: 'Group into a Folder',
      icon: 'group',
      keys: key('G'),
      run: () => editor.groupSelection(),
    });
  if (folders)
    arrange.push({
      label: 'Ungroup',
      icon: 'Folder',
      keys: key('Shift+G'),
      run: () => editor.ungroupSelection(),
    });
  if (objects.length)
    arrange.push({
      label: hidden ? 'Show' : 'Hide',
      icon: hidden ? 'eye' : 'eyeOff',
      run: () => editor.setSelectedVisible(hidden),
    });
  const last: Item[] = [];
  if (count)
    last.push({
      label: many ? `Delete ${count} objects` : 'Delete',
      icon: 'trash',
      keys: 'Del',
      danger: true,
      run: () => editor.deleteSelection(),
    });
  return [first, clip, arrange, last].filter((g) => g.length);
}

interface ObjectMenuProps {
  /** Where it opens, in window pixels. */
  x: number;
  y: number;
  /** Opens the insert menu; leave out where there's nothing to anchor it to. */
  onInsert?: () => void;
  onClose: () => void;
}

export function ObjectMenu({ x, y, onInsert, onClose }: ObjectMenuProps) {
  const editor = useEditor();
  useEditorState();
  const ref = useRef<HTMLDivElement>(null);
  const groups = itemsFor(editor, onInsert);

  // Open where it was asked for, kept inside the window.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - el.offsetWidth - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, innerHeight - el.offsetHeight - 8))}px`;
  });

  // Where focus goes back to when the menu is done with from the keyboard or a choice.
  const [before] = useState(() => document.activeElement as HTMLElement | null);
  const done = () => {
    onClose();
    if (before?.isConnected) before.focus();
  };
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close.current();
    };
    const onBlur = () => close.current();
    // Escape closes it even when focus is elsewhere, such as after a click on the canvas.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || ref.current?.contains(document.activeElement)) return;
      e.preventDefault();
      e.stopPropagation();
      close.current();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, []);

  if (!groups.length) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      return done();
    }
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to =
      e.key === 'ArrowDown'
        ? (at + 1) % items.length
        : e.key === 'ArrowUp'
          ? (at - 1 + items.length) % items.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    items[to]?.focus();
  };

  return (
    <div
      ref={ref}
      className="menu ctxmenu"
      role="menu"
      aria-label="Object actions"
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {groups.map((group, g) => (
        <div key={g} role="none">
          {g > 0 && <hr />}
          {group.map((item) => (
            <button
              key={item.label}
              className={item.danger ? 'mi danger' : 'mi'}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                done();
                item.run();
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.keys && <span className="d">{item.keys}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
