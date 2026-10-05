import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browserStorage, loadAutosave, startAutosave } from './editor/autosave.ts';
import { Editor } from './editor/editor.ts';
import { sampleProject } from './model/sample.ts';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './ui/App.tsx';
import { applyTheme } from './ui/theme.ts';

declare global {
  interface Window {
    /** The running editor, for tests and the console. Development builds only. */
    framecraft?: Editor;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

applyTheme();

// Pick up where you left off; the first visit opens the sample project.
const storage = browserStorage();
const saved = loadAutosave(storage);
const editor = saved
  ? new Editor(saved.doc, { assets: saved.assets })
  : new Editor(sampleProject());
if (saved) editor.setSaveStatus('saved');
startAutosave(editor, storage);
if (import.meta.env.DEV) window.framecraft = editor;

createRoot(root).render(
  <StrictMode>
    <App editor={editor} />
  </StrictMode>,
);
