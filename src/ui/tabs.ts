import type { KeyboardEvent } from 'react';

/**
 * Arrow keys, Home and End in a tab list move to another tab and pick it, as screen reader
 * users expect. Only the picked tab is in the Tab order (each tab sets its own tabIndex).
 */
export function onTabKeys(e: KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(e.target as HTMLElement);
  if (at < 0) return;
  const to =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (at + 1) % tabs.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? (at - 1 + tabs.length) % tabs.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? tabs.length - 1
            : -1;
  if (to < 0) return;
  e.preventDefault();
  tabs[to]!.focus();
  tabs[to]!.click();
}
