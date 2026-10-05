import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from './editor/editor.ts';
import { sampleProject } from './model/sample.ts';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './ui/App.tsx';

declare global {
  interface Window {
    /** The running editor, for tests and the console. Development builds only. */
    framecraft?: Editor;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

const editor = new Editor(sampleProject());
if (import.meta.env.DEV) window.framecraft = editor;

createRoot(root).render(
  <StrictMode>
    <App editor={editor} />
  </StrictMode>,
);
