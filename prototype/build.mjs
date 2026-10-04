// Builds the single-file prototype from prototype/src.
//
// Outputs
//   prototype/dist/framecraft.html           standalone page: open it in any browser
//   prototype/dist/framecraft.artifact.html  body-only version for publishing as a claude.ai artifact
//                                            (the artifact host adds its own doctype, head and reset)
//
// Run: npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, 'src', f), 'utf8');

const JS_PARTS = ['3-core.js', '4-render.js', '5-interact.js', '6-panels.js', '7-export.js'];
const js = JS_PARTS.map(read).join('\n');

// Fail fast on a syntax error (the browser would only show a blank editor)
new vm.Script(js, { filename: 'framecraft.js' });

// A literal "</script" or "<!--" inside an inline script ends or derails it in the HTML parser
if (/<\/script/i.test(js) || js.includes('<!--')) {
  throw new Error('The JS contains "</script" or "<!--". Write them as "<\\/script>" and "<\\!--" inside strings.');
}

const head = read('1-head.html');
const body = read('2-body.html');
const script = `<script>\n${js}</script>\n`;

// The same small reset the artifact host injects, so the standalone page behaves identically
const reset = '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}' +
  'body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>';

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${reset}
${head}</head>
<body>
${body}${script}</body>
</html>
`;

mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'framecraft.html'), standalone);
writeFileSync(join(here, 'dist', 'framecraft.artifact.html'), head + body + script);
console.log(`Built prototype/dist/framecraft.html (${(standalone.length / 1024).toFixed(0)} KB) and framecraft.artifact.html`);
