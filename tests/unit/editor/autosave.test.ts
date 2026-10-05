import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_KEY,
  loadAutosave,
  startAutosave,
  type KeyValueStore,
} from '../../../src/editor/autosave.ts';
import { Editor } from '../../../src/editor/editor.ts';
import { serializeProject } from '../../../src/model/project.ts';
import { sampleProject } from '../../../src/model/sample.ts';

function memoryStore(full = false): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (full) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      data.set(k, v);
    },
  };
}

const rename = (editor: Editor, name: string) => {
  const id = Object.values(editor.doc.instances).find((i) => i.props.Name === 'Version')!.id;
  editor.setProp(id, 'Text', name);
};

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves once edits pause, and reads the project back', () => {
    const store = memoryStore();
    const editor = new Editor(sampleProject());
    const stop = startAutosave(editor, store, 400);
    rename(editor, 'one');
    rename(editor, 'two');
    expect(editor.state.saveStatus).toBe('pending');
    expect(store.data.has(AUTOSAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(400);
    expect(editor.state.saveStatus).toBe('saved');
    expect(store.data.get(AUTOSAVE_KEY)).toBe(serializeProject(editor.doc, editor.state.assets));
    const back = loadAutosave(store);
    expect(back?.doc).toEqual(editor.doc);
    stop();
  });

  it('ignores selection and view changes', () => {
    const store = memoryStore();
    const editor = new Editor(sampleProject());
    const stop = startAutosave(editor, store);
    editor.setZoom(2);
    editor.select(null);
    vi.runAllTimers();
    expect(editor.state.saveStatus).toBe('idle');
    expect(store.data.size).toBe(0);
    stop();
  });

  it('writes a pending change when it stops', () => {
    const store = memoryStore();
    const editor = new Editor(sampleProject());
    const stop = startAutosave(editor, store);
    rename(editor, 'last');
    stop();
    expect(loadAutosave(store)?.doc).toEqual(editor.doc);
  });

  it('says once when the storage is full', () => {
    const editor = new Editor(sampleProject());
    const stop = startAutosave(editor, memoryStore(true));
    rename(editor, 'a');
    vi.advanceTimersByTime(400);
    expect(editor.state.saveStatus).toBe('off');
    expect(editor.state.toast?.text).toMatch(/storage is full/);
    editor.dismissToast();
    rename(editor, 'b');
    vi.advanceTimersByTime(400);
    expect(editor.state.toast).toBeNull();
    stop();
  });

  it('turns off without storage, and skips a broken save', () => {
    const editor = new Editor(sampleProject());
    startAutosave(editor, undefined)();
    expect(editor.state.saveStatus).toBe('off');
    const store = memoryStore();
    store.data.set(AUTOSAVE_KEY, '{ not json');
    expect(loadAutosave(store)).toBeNull();
    expect(loadAutosave(undefined)).toBeNull();
  });
});
