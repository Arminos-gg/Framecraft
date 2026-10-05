import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import goldenHtml from '../../../prototype/examples/sample-menu.html?raw';
import goldenLocal from '../../../prototype/examples/sample-menu.localscript.luau?raw';
import goldenCommand from '../../../prototype/examples/sample-menu.luau?raw';
import { exportHtml } from '../../../src/export/html.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { sample } from '../model/helpers.ts';

describe('exports of the sample menu match the prototype byte for byte', () => {
  const doc = sample();

  it('Luau for the command bar', () => {
    expect(exportLuau(doc, 'command')).toBe(goldenCommand);
  });

  it('Luau for a LocalScript', () => {
    expect(exportLuau(doc, 'local')).toBe(goldenLocal);
  });

  it('the HTML page', () => {
    expect(exportHtml(doc)).toBe(goldenHtml);
  });

  it('Luau that parses', () => {
    expect(() => luaparse.parse(exportLuau(doc, 'command'), { luaVersion: '5.1' })).not.toThrow();
    expect(() => luaparse.parse(exportLuau(doc, 'local'), { luaVersion: '5.1' })).not.toThrow();
  });
});
