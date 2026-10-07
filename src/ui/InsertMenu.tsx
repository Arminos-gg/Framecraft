/**
 * Studio's insert menu: what can go into one object, with a search box. Arrow keys choose,
 * Enter inserts. A modifier the object already has is listed but can't be picked.
 */
import { useId, useState } from 'react';
import { CLASS_HINTS, hasModifier, insertableInto } from '../editor/insert.ts';
import type { ClassName } from '../model/classes.ts';
import { getInstance, type InstanceId } from '../model/document.ts';
import { useEditor, useEditorState } from './editor-context.ts';
import { ClassIcon, Icon } from './icons.tsx';
import { Popover } from './Popover.tsx';

interface InsertMenuProps {
  parentId: InstanceId;
  anchor: HTMLElement;
  placement?: 'below' | 'right';
  /** Only modifiers, for the "Add modifier" chip. */
  modifiersOnly?: boolean;
  onClose: () => void;
}

export function InsertMenu({
  parentId,
  anchor,
  placement,
  modifiersOnly,
  onClose,
}: InsertMenuProps) {
  const editor = useEditor();
  const { doc } = useEditorState();
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const listId = useId();
  const parent = getInstance(doc, parentId);
  if (!parent) return null;

  const { objects, modifiers } = insertableInto(doc, parentId);
  const q = query.trim().toLowerCase();
  const matches = (c: ClassName) =>
    !q || c.toLowerCase().includes(q) || (CLASS_HINTS[c] ?? '').toLowerCase().includes(q);
  const groups: [string, ClassName[]][] = [
    ['Objects', modifiersOnly ? [] : objects.filter(matches)],
    ['Modifiers', modifiers.filter(matches)],
  ];
  const choices = groups.flatMap(([, list]) => list).filter((c) => !hasModifier(doc, parentId, c));
  const current = choices[Math.min(hi, choices.length - 1)];

  const pick = (c: ClassName) => {
    onClose();
    editor.insert(c, parentId);
  };

  return (
    <Popover
      anchor={anchor}
      placement={placement}
      label={`Insert into ${parent.props.Name}`}
      onClose={onClose}
    >
      <div className="pophead">
        {modifiersOnly ? 'Add to' : 'Insert into'} <b>{parent.props.Name}</b>
        <span className="spacer" />
        <button className="ibtn sm" type="button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <label className="filter">
        <span className="sr">Search objects</span>
        <Icon name="search" />
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current ? `${listId}-${current}` : undefined}
          placeholder={modifiersOnly ? 'Search modifiers' : 'Search objects'}
          autoComplete="off"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHi(0);
          }}
          onKeyDown={(e) => {
            const i = current ? choices.indexOf(current) : -1;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const step = e.key === 'ArrowDown' ? 1 : -1;
              setHi(Math.max(0, Math.min(choices.length - 1, i + step)));
            } else if (e.key === 'Enter' && current) {
              e.preventDefault();
              pick(current);
            }
          }}
        />
      </label>
      <div className="poplist" role="listbox" id={listId} aria-label="Objects you can insert">
        {groups.map(
          ([title, list]) =>
            list.length > 0 && (
              <div key={title} role="group" aria-label={title}>
                <h4 aria-hidden="true">{title}</h4>
                {list.map((c) => {
                  const taken = hasModifier(doc, parentId, c);
                  return (
                    <button
                      key={c}
                      id={`${listId}-${c}`}
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={c === current}
                      className={c === current ? 'mi hi' : 'mi'}
                      disabled={taken}
                      onClick={() => pick(c)}
                      onPointerEnter={() => !taken && setHi(choices.indexOf(c))}
                    >
                      <ClassIcon className={c} />
                      <span>{c}</span>
                      <span className="d">{taken ? 'Already added' : CLASS_HINTS[c]}</span>
                    </button>
                  );
                })}
              </div>
            ),
        )}
        {!choices.length && <p className="popempty">Nothing here matches “{query}”.</p>}
      </div>
      <div className="popfoot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>choose
        </span>
        <span>
          <kbd>Enter</kbd>insert
        </span>
        <span>
          <kbd>Esc</kbd>close
        </span>
      </div>
    </Popover>
  );
}
