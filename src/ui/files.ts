/** Opening files from the user's computer and saving files to it, in the browser. */

/** Asks for a file. Resolves with null if the chooser is closed without one. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => done(null));
    document.body.append(input);
    input.click();
  });
}

export function readText(file: File): Promise<string> {
  return file.text();
}

export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('The file could not be read'));
    r.readAsDataURL(file);
  });
}

/** Pictures stay small enough to keep the project in the browser's storage. */
export const MAX_PICTURE_BYTES = 1.5e6;

/** Saves a file to the user's downloads. */
export function download(name: string, contents: string | Uint8Array, type: string) {
  const part = typeof contents === 'string' ? contents : new Uint8Array(contents);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copies text, or returns false when the browser won't allow it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Selects the text of an element, for when copying is blocked and the user has to press Ctrl+C. */
export function selectText(el: HTMLElement | null) {
  const sel = window.getSelection();
  if (!el || !sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}
