/**
 * Autosave: the project is kept in the browser's storage, so a reload or a closed tab picks
 * up where you left off. Saving waits until edits pause, and the app bar shows whether the
 * latest change is saved.
 */
import { parseProject, serializeProject, type Project } from '../model/project.ts';
import type { Editor } from './editor.ts';

export const AUTOSAVE_KEY = 'framecraft:project:v3';

/** The part of `localStorage` autosave uses, so tests can pass their own. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's storage, or undefined where it's blocked (some private windows, sandboxed frames). */
export function browserStorage(): KeyValueStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** The autosaved project, if there is one and it can still be read. */
export function loadAutosave(store: KeyValueStore | undefined): Project | null {
  try {
    const text = store?.getItem(AUTOSAVE_KEY);
    return text ? parseProject(text) : null;
  } catch {
    return null;
  }
}

/**
 * Saves the project after each change, once edits pause for `delay` ms. Returns a function
 * that stops autosaving and writes any pending change.
 */
export function startAutosave(editor: Editor, store: KeyValueStore | undefined, delay = 400) {
  if (!store) {
    editor.setSaveStatus('off');
    return () => {};
  }
  let { doc, assets } = editor.state;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;

  const save = () => {
    timer = undefined;
    try {
      store.setItem(AUTOSAVE_KEY, serializeProject(editor.state.doc, editor.state.assets));
      editor.setSaveStatus('saved');
      warned = false;
    } catch {
      editor.setSaveStatus('off');
      // Say it once until a save works again.
      if (!warned)
        editor.toast(
          'Your browser’s storage is full, so changes aren’t kept here. Save a project file from the Project menu.',
        );
      warned = true;
    }
  };

  const unsubscribe = editor.subscribe(() => {
    const s = editor.state;
    if (s.doc === doc && s.assets === assets) return;
    doc = s.doc;
    assets = s.assets;
    if (s.saveStatus !== 'pending') editor.setSaveStatus('pending');
    clearTimeout(timer);
    timer = setTimeout(save, delay);
  });

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      save();
    }
  };
  // Closing or hiding the tab mid-pause still saves.
  const page = typeof window === 'undefined' ? undefined : window;
  page?.addEventListener('pagehide', flush);
  page?.document.addEventListener('visibilitychange', flush);
  return () => {
    unsubscribe();
    page?.removeEventListener('pagehide', flush);
    page?.document.removeEventListener('visibilitychange', flush);
    flush();
  };
}
