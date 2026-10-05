import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from '../../../src/export/zip.ts';

/** Reads a stored zip back: every entry from the central directory, checked against its local header. */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  // The central directory runs right up to the end record.
  expect(at + view.getUint32(end + 12, true)).toBe(end);
  const out: { path: string; text: string; crc: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const path = dec.decode(zip.subarray(at + 46, at + 46 + nameLen));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = zip.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out.push({ path, text: dec.decode(data), crc });
    at += 46 + nameLen;
  }
  return out;
}

describe('makeZip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('stores each file with its path, contents and checksum', () => {
    const zip = makeZip(
      [
        { path: 'index.html', contents: '<h1>Café</h1>\n' },
        { path: 'pricing/index.html', contents: 'Pricing' },
        { path: 'images/dot.png', contents: new Uint8Array([137, 80, 78, 71]) },
      ],
      new Date(2026, 9, 5, 12, 30, 10),
    );
    const files = readZip(zip);
    expect(files.map((f) => f.path)).toEqual([
      'index.html',
      'pricing/index.html',
      'images/dot.png',
    ]);
    expect(files[0]!.text).toBe('<h1>Café</h1>\n');
    expect(files[1]!.text).toBe('Pricing');
  });

  it('makes a valid empty zip', () => {
    expect(readZip(makeZip([]))).toEqual([]);
  });
});
