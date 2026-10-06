import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import { exportHtml } from '../../../src/export/html.ts';
import { exportLuau } from '../../../src/export/luau.ts';
import { exportRbxmx } from '../../../src/export/rbxmx.ts';
import { sample } from '../model/helpers.ts';

/**
 * The exports of the untouched sample menu, byte for byte, against the golden files in
 * tests/golden/. They started as the prototype's exports. After an intentional exporter
 * change, `npm run update-golden` rewrites them; say why in the commit.
 */
describe('exports of the sample menu match the golden files', () => {
  const doc = sample();

  it('Luau for the command bar', async () => {
    await expect(exportLuau(doc, 'command')).toMatchFileSnapshot('../../golden/sample-menu.luau');
  });

  it('Luau for a LocalScript', async () => {
    await expect(exportLuau(doc, 'local')).toMatchFileSnapshot(
      '../../golden/sample-menu.localscript.luau',
    );
  });

  it('the HTML page', async () => {
    await expect(exportHtml(doc)).toMatchFileSnapshot('../../golden/sample-menu.html');
  });

  it('the Roblox model file', async () => {
    await expect(exportRbxmx(doc)).toMatchFileSnapshot('../../golden/sample-menu.rbxmx');
  });

  it('Luau that parses', () => {
    expect(() => luaparse.parse(exportLuau(doc, 'command'), { luaVersion: '5.1' })).not.toThrow();
    expect(() => luaparse.parse(exportLuau(doc, 'local'), { luaVersion: '5.1' })).not.toThrow();
  });
});
