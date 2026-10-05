/** Project menu actions, shared with their keyboard shortcuts. */
import type { Editor } from '../editor/editor.ts';
import { ModelError } from '../model/document.ts';
import { parseProject, serializeProject } from '../model/project.ts';
import { blankDoc, blankSiteDoc, sampleProject } from '../model/sample.ts';
import { download, pickFile, readText } from './files.ts';

export const PROJECT_FILE = 'framecraft-project.json';

export function newProject(editor: Editor, kind: 'site' | 'roblox') {
  const doc = kind === 'site' ? blankSiteDoc() : blankDoc();
  editor.openProject({ doc, assets: {} }, 'Started a new project.');
}

export function openSample(editor: Editor) {
  editor.openProject({ doc: sampleProject(), assets: {} }, 'Opened the sample project.');
}

export async function openProjectFile(editor: Editor) {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  try {
    const project = parseProject(await readText(file));
    editor.openProject(project, `Opened ${file.name}.`);
  } catch (e) {
    editor.toast(
      e instanceof ModelError
        ? `${file.name} can't be opened. ${e.message}`
        : `${file.name} can't be opened.`,
    );
  }
}

export function saveProjectFile(editor: Editor) {
  const { doc, assets } = editor.state;
  download(PROJECT_FILE, serializeProject(doc, assets), 'application/json');
  editor.toast(`Downloaded ${PROJECT_FILE}. Open it from the Project menu to keep working.`);
}
