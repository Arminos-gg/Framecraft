/** The editor theme: follow the system, or always light or dark. Kept per browser. */
import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'framecraft:theme';
const listeners = new Set<() => void>();

function stored(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

let current: Theme = typeof window === 'undefined' ? 'system' : stored();

/** Puts the theme on <html>, where the tokens read it. */
export function applyTheme(theme: Theme = current) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  current = theme;
  applyTheme(theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage is blocked; the theme still applies until the page reloads.
  }
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => 'system',
  );
}
