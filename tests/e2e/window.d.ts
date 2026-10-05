import type { Editor } from '../../src/editor/editor.ts';

declare global {
  interface Window {
    /** The running editor, which the dev server exposes for tests (see src/main.tsx). */
    framecraft?: Editor;
  }
}
