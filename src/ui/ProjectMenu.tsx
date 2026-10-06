/** The Project menu: start over or from a template, open and save project files, and pick the theme. */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useEditor } from './editor-context.ts';
import { Icon } from './icons.tsx';
import { Popover } from './Popover.tsx';
import { newProject, openProjectFile, openSample, saveProjectFile } from './project-actions.ts';
import { setTheme, useTheme, type Theme } from './theme.ts';

const THEMES: readonly (readonly [Theme, string])[] = [
  ['system', 'Match the system'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export function ProjectMenu({
  anchor,
  onClose,
  onTemplates,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  /** Opens the template picker. */
  onTemplates: () => void;
}) {
  const editor = useEditor();
  const theme = useTheme();
  const list = useRef<HTMLDivElement>(null);
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, []);

  const run = (action: () => void) => () => {
    onClose();
    anchor.focus();
    action();
  };

  // Arrow keys move between items, as in any menu.
  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
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

  const item = (label: string, action: () => void, keys?: string) => (
    <button className="mi" type="button" role="menuitem" tabIndex={-1} onClick={run(action)}>
      <span>{label}</span>
      {keys && <span className="d">{keys}</span>}
    </button>
  );

  return (
    <Popover anchor={anchor} label="Project" className="menu" onClose={onClose}>
      <div role="menu" aria-label="Project" ref={list} onKeyDown={onKeyDown}>
        {item('New website', () => newProject(editor, 'site'))}
        {item('New Roblox UI', () => newProject(editor, 'roblox'))}
        {item('New from a template…', onTemplates)}
        {item('Open the sample project', () => openSample(editor))}
        <hr />
        {item('Open project file…', () => void openProjectFile(editor), `${mod}O`)}
        {item('Save project file', () => saveProjectFile(editor), `${mod}S`)}
        <hr />
        <div role="group" aria-label="Theme">
          <h4>Theme</h4>
          {THEMES.map(([t, label]) => (
            <button
              key={t}
              className="mi"
              type="button"
              role="menuitemradio"
              aria-checked={theme === t}
              tabIndex={-1}
              onClick={() => setTheme(t)}
            >
              <span>{label}</span>
              {theme === t && <Icon name="check" className="d" />}
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}
