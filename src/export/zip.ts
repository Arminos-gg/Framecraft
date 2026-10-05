/**
 * A .zip file of the exported site, built in the browser. Files are stored uncompressed: the
 * site is small, most of its weight is pictures that are compressed already, and every
 * system's unzip tool reads stored entries.
 */

export interface ZipEntry {
  /** Path inside the zip, with forward slashes, such as `pricing/index.html`. */
  readonly path: string;
  readonly contents: string | Uint8Array;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS time and date, which zip files use, in local time. */
function dosDateTime(d: Date): [time: number, date: number] {
  const year = Math.max(1980, d.getFullYear());
  return [
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  ];
}

/** Bit 11: names are UTF-8. */
const UTF8_NAMES = 0x0800;

export function makeZip(entries: readonly ZipEntry[], date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const [time, day] = dosDateTime(date);
  const files = entries.map((e) => {
    const data = typeof e.contents === 'string' ? enc.encode(e.contents) : e.contents;
    return { name: enc.encode(e.path), data, crc: crc32(data) };
  });
  const localSize = files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0);
  const centralSize = files.reduce((n, f) => n + 46 + f.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;
  const u16 = (v: number) => {
    view.setUint16(at, v, true);
    at += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at, v, true);
    at += 4;
  };
  const bytes = (b: Uint8Array) => {
    out.set(b, at);
    at += b.length;
  };

  const offsets: number[] = [];
  for (const f of files) {
    offsets.push(at);
    u32(0x04034b50);
    u16(20);
    u16(UTF8_NAMES);
    u16(0); // stored
    u16(time);
    u16(day);
    u32(f.crc);
    u32(f.data.length);
    u32(f.data.length);
    u16(f.name.length);
    u16(0);
    bytes(f.name);
    bytes(f.data);
  }
  const centralStart = at;
  files.forEach((f, i) => {
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(UTF8_NAMES);
    u16(0);
    u16(time);
    u16(day);
    u32(f.crc);
    u32(f.data.length);
    u32(f.data.length);
    u16(f.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(offsets[i]!);
    bytes(f.name);
  });
  const centralLength = at - centralStart;
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(files.length);
  u16(files.length);
  u32(centralLength);
  u32(centralStart);
  u16(0);
  return out;
}
