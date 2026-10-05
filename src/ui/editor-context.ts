import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Editor, EditorState } from '../editor/editor.ts';

export const EditorContext = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (!editor) throw new Error('useEditor needs an EditorContext provider');
  return editor;
}

/** The editor's state; the component re-renders whenever it changes. */
export function useEditorState(): EditorState {
  const editor = useEditor();
  return useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
}
