/* ============================================================
   Exporters: Luau for Studio, a standalone HTML page, JSON
   ============================================================ */
const LUA_KEYWORDS = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue', 'export', 'type', 'typeof', 'game', 'script', 'workspace']);
const luaStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
const luaNum = (v, d = 4) => fmtNum(v, d);
function luaUDim2(u) {
  if (u[1] === 0 && u[3] === 0 && (u[0] !== 0 || u[2] !== 0)) return `UDim2.fromScale(${luaNum(u[0])}, ${luaNum(u[2])})`;
  if (u[0] === 0 && u[2] === 0) return `UDim2.fromOffset(${luaNum(u[1], 0)}, ${luaNum(u[3], 0)})`;
  return `UDim2.new(${luaNum(u[0])}, ${luaNum(u[1], 0)}, ${luaNum(u[2])}, ${luaNum(u[3], 0)})`;
}
const luaUDim = (u) => `UDim.new(${luaNum(u[0])}, ${luaNum(u[1], 0)})`;
const luaColor = (c) => `Color3.fromRGB(${c[0]}, ${c[1]}, ${c[2]})`;
const luaVec2 = (v) => `Vector2.new(${luaNum(v[0])}, ${luaNum(v[1])})`;
const isWhite = (c) => c[0] === 255 && c[1] === 255 && c[2] === 255;

function luauProps(n) {
  const P = n.props, K = CLASSES[n.cls], out = [];
  const add = (k, v) => out.push([k, v]);
  if (n.cls === 'ScreenGui') {
    add('IgnoreGuiInset', 'true');
    add('ResetOnSpawn', String(!!P.ResetOnSpawn));
    add('ZIndexBehavior', 'Enum.ZIndexBehavior.Sibling');
    if (P.DisplayOrder) add('DisplayOrder', P.DisplayOrder);
    if (P.Enabled === false) add('Enabled', 'false');
  } else if (K.kind === 'gui') {
    if (P.AnchorPoint[0] || P.AnchorPoint[1]) add('AnchorPoint', luaVec2(P.AnchorPoint));
    if (P.Position.some((x) => x !== 0)) add('Position', luaUDim2(P.Position));
    add('Size', luaUDim2(P.Size));
    if (P.Rotation) add('Rotation', luaNum(P.Rotation));
    add('BackgroundColor3', luaColor(P.BackgroundColor3));
    if (P.BackgroundTransparency) add('BackgroundTransparency', luaNum(P.BackgroundTransparency));
    add('BorderSizePixel', P.BorderSizePixel);
    if (P.BorderSizePixel > 0) add('BorderColor3', luaColor(P.BorderColor3));
    if (P.ZIndex !== 1) add('ZIndex', P.ZIndex);
    if (P.LayoutOrder) add('LayoutOrder', P.LayoutOrder);
    if (P.Visible === false) add('Visible', 'false');
    if (P.ClipsDescendants) add('ClipsDescendants', 'true');
    if (K.text) {
      add('Font', 'Enum.Font.' + P.Font);
      add('Text', luaStr(P.Text));
      if (K.input && P.PlaceholderText) add('PlaceholderText', luaStr(P.PlaceholderText));
      add('TextColor3', luaColor(P.TextColor3));
      add('TextSize', P.TextSize);
      if (P.TextScaled) add('TextScaled', 'true');
      if (P.TextWrapped) add('TextWrapped', 'true');
      if (P.TextXAlignment !== 'Center') add('TextXAlignment', 'Enum.TextXAlignment.' + P.TextXAlignment);
      if (P.TextYAlignment !== 'Center') add('TextYAlignment', 'Enum.TextYAlignment.' + P.TextYAlignment);
      if (P.TextTransparency) add('TextTransparency', luaNum(P.TextTransparency));
    }
    if (K.image) {
      add('Image', luaStr(P.Image));
      if (!isWhite(P.ImageColor3)) add('ImageColor3', luaColor(P.ImageColor3));
      if (P.ImageTransparency) add('ImageTransparency', luaNum(P.ImageTransparency));
      if (P.ScaleType !== 'Stretch') add('ScaleType', 'Enum.ScaleType.' + P.ScaleType);
    }
    if (K.button && P.AutoButtonColor === false) add('AutoButtonColor', 'false');
    if (K.scroll) { add('CanvasSize', luaUDim2(P.CanvasSize)); add('ScrollBarThickness', P.ScrollBarThickness); }
  } else if (n.cls === 'UICorner') add('CornerRadius', luaUDim(P.CornerRadius));
  else if (n.cls === 'UIStroke') {
    add('Color', luaColor(P.Color));
    add('Thickness', luaNum(P.Thickness));
    if (P.Transparency) add('Transparency', luaNum(P.Transparency));
    if (P.ApplyStrokeMode === 'Border') add('ApplyStrokeMode', 'Enum.ApplyStrokeMode.Border');
  } else if (n.cls === 'UIGradient') {
    add('Color', `ColorSequence.new(${luaColor(P.GradColor[0])}, ${luaColor(P.GradColor[1])})`);
    if (P.GradTransparency[0] || P.GradTransparency[1]) add('Transparency', `NumberSequence.new(${luaNum(P.GradTransparency[0])}, ${luaNum(P.GradTransparency[1])})`);
    if (P.GradRotation) add('Rotation', luaNum(P.GradRotation));
  } else if (n.cls === 'UIPadding') {
    ['PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight'].forEach((k) => { if (P[k][0] || P[k][1]) add(k, luaUDim(P[k])); });
  } else if (n.cls === 'UIListLayout') {
    ['FillDirection', 'HorizontalAlignment', 'VerticalAlignment'].forEach((k) => add(k, `Enum.${k}.${P[k]}`));
    if (P.Padding[0] || P.Padding[1]) add('Padding', luaUDim(P.Padding));
    add('SortOrder', 'Enum.SortOrder.' + P.SortOrder);
  } else if (n.cls === 'UIAspectRatioConstraint') add('AspectRatio', luaNum(P.AspectRatio));
  return out;
}
function makeNamer() {
  const used = new Map();
  return (n, parentVar) => {
    let base = String(n.props.Name).replace(/[^A-Za-z0-9_]+(.)?/g, (m, c) => (c ? c.toUpperCase() : ''));
    if (CLASSES[n.cls].kind === 'mod' && n.props.Name === n.cls && parentVar) base = parentVar + (SHORT[n.cls] || n.cls);
    if (!base) base = n.cls;
    base = base[0].toLowerCase() + base.slice(1);
    if (/^[0-9]/.test(base)) base = '_' + base;
    if (LUA_KEYWORDS.has(base)) base += 'Gui';
    const k = used.get(base) || 0;
    used.set(base, k + 1);
    return k ? base + (k + 1) : base;
  };
}
function luauBlock(rootId, namer, lines) { // emits rootId's subtree; returns its variable name
  const emit = (id, parentVar) => {
    const n = node(id);
    const v = namer(n, parentVar);
    if (CLASSES[n.cls].kind !== 'mod') lines.push('', `-- ${n.props.Name} (${n.cls})`);
    lines.push(`local ${v} = Instance.new("${n.cls}")`);
    if (n.props.Name !== n.cls) lines.push(`${v}.Name = ${luaStr(n.props.Name)}`);
    luauProps(n).forEach(([k, val]) => lines.push(`${v}.${k} = ${val}`));
    n.children.forEach((c) => { const cv = emit(c, v); lines.push(`${cv}.Parent = ${v}`); });
    return v;
  };
  return emit(rootId, null);
}
function exportLuau(target = ui.luauTarget) {
  const namer = makeNamer();
  const cmd = target === 'command';
  const lines = cmd
    ? ['-- Built with Framecraft (prototype)', '-- Paste this into Roblox Studio\'s command bar and press Enter.', '-- It creates the UI in StarterGui, where you can keep editing it.', 'local StarterGui = game:GetService("StarterGui")']
    : ['-- Built with Framecraft (prototype)', '-- Put this in a LocalScript inside StarterPlayerScripts.', '-- It builds the UI on each player\'s screen when they join.', 'local Players = game:GetService("Players")', 'local playerGui = Players.LocalPlayer:WaitForChild("PlayerGui")'];
  const roots = [];
  kids(doc.rootId).forEach((sg) => {
    const v = luauBlock(sg.id, namer, lines);
    lines.push(`${v}.Parent = ${cmd ? 'StarterGui' : 'playerGui'}`);
    roots.push(v);
  });
  if (cmd && roots.length) lines.push('', '-- Select the new UI so it shows up in the Explorer', `game:GetService("Selection"):Set({ ${roots.join(', ')} })`);
  return lines.join('\n') + '\n';
}
function exportLuauSubtree(id) {
  const n = node(id);
  if (!n || n.cls === 'StarterGui') return exportLuau('command');
  const lines = [`-- Code that builds ${n.props.Name} and everything inside it.`, '-- It updates as you edit.'];
  const v = luauBlock(id, makeNamer(), lines);
  const parent = node(n.parent);
  lines.push('', parent && parent.cls !== 'StarterGui' ? `-- Then parent it to your ${parent.props.Name}:` : '-- Then parent it:', `-- ${v}.Parent = ${parent && parent.cls === 'StarterGui' ? 'game:GetService("StarterGui")' : '<' + (parent ? parent.props.Name : 'parent') + '>'}`);
  return lines.join('\n') + '\n';
}

/* ---------- HTML/CSS export ---------- */
const STATIC_FAMILIES = new Set(['Luckiest Guy', 'Bangers', 'Press Start 2P', 'Permanent Marker']);
function googleFontsHref(names) {
  const fams = {};
  names.forEach((nm) => { const f = FONTS[nm] || FONTS.SourceSans; (fams[f[0]] = fams[f[0]] || new Set()).add((f[2] === 'italic' ? '1,' : '0,') + f[1]); });
  const parts = Object.entries(fams).map(([fam, set]) => {
    const name = fam.replace(/ /g, '+');
    if (STATIC_FAMILIES.has(fam)) return 'family=' + name;
    const specs = [...set].sort();
    if (specs.some((s) => s.startsWith('1,'))) return `family=${name}:ital,wght@${specs.join(';')}`;
    return `family=${name}:wght@${specs.map((s) => s.slice(2)).sort((a, b) => a - b).join(';')}`;
  });
  return parts.length ? `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap` : null;
}
const BACKDROP_CSS = {
  game: 'radial-gradient(120% 60% at 30% 108%, #5d9c46 0 34%, transparent 34.5%), radial-gradient(90% 50% at 85% 112%, #4c8a3b 0 38%, transparent 38.5%), linear-gradient(#7ec3f2 0%, #b7e0fa 58%, #e3f3fd 100%)',
  night: 'linear-gradient(#0d1424, #1b2741 70%, #24324f)',
  checker: '#f2f2f2',
};
function calcU(s, o) {
  s = roundTo(s * 100, 4); o = Math.round(o);
  if (!s) return o + 'px';
  if (!o) return s + '%';
  return `calc(${s}% + ${o}px)`;
}
function exportHtml() {
  const css = [];
  const fontsUsed = new Set();
  let seq = 0;
  let needsScript = false;
  const insetOf = (n) => {
    const pad = modOf(n.id, 'UIPadding');
    if (!pad) return 'inset:0;';
    const P = pad.props;
    return `left:${calcU(...P.PaddingLeft)};top:${calcU(...P.PaddingTop)};right:${calcU(...P.PaddingRight)};bottom:${calcU(...P.PaddingBottom)};`;
  };
  const listCss = (list) => {
    const P = list.props, v = P.FillDirection !== 'Horizontal';
    const main = v ? P.VerticalAlignment : P.HorizontalAlignment;
    const cross = v ? P.HorizontalAlignment : P.VerticalAlignment;
    const map = { Left: 'flex-start', Top: 'flex-start', Center: 'center', Right: 'flex-end', Bottom: 'flex-end' };
    return `display:flex;flex-direction:${v ? 'column' : 'row'};gap:${calcU(...P.Padding)};justify-content:${map[main]};align-items:${map[cross]};`;
  };
  const sortedKids = (id) => {
    const items = guiKids(id), list = modOf(id, 'UIListLayout');
    if (!list) return items;
    const order = items.map((c, i) => ({ c, i }));
    if (list.props.SortOrder === 'Name') order.sort((a, b) => a.c.props.Name.localeCompare(b.c.props.Name, undefined, { numeric: true }) || a.i - b.i);
    else order.sort((a, b) => (a.c.props.LayoutOrder - b.c.props.LayoutOrder) || a.i - b.i);
    return order.map((o) => o.c);
  };
  const emit = (n, inList, depth) => {
    const P = n.props, K = CLASSES[n.cls], cls = 'e' + (++seq);
    const r = [];
    const attrs = [];
    if (inList) r.push('position:relative;flex:none;');
    else {
      r.push(`left:${calcU(P.Position[0], P.Position[1])};top:${calcU(P.Position[2], P.Position[3])};`);
      const t = [];
      if (P.AnchorPoint[0] || P.AnchorPoint[1]) t.push(`translate(${roundTo(-P.AnchorPoint[0] * 100, 4)}%, ${roundTo(-P.AnchorPoint[1] * 100, 4)}%)`);
      if (P.Rotation) t.push(`rotate(${roundTo(P.Rotation, 3)}deg)`);
      if (t.length) r.push(`transform:${t.join(' ')};`);
    }
    r.push(`width:${calcU(P.Size[0], P.Size[1])};height:${calcU(P.Size[2], P.Size[3])};`);
    if (P.ZIndex !== 1) r.push(`z-index:${P.ZIndex};`);
    if (P.Visible === false) r.push('display:none;');
    const grad = modOf(n.id, 'UIGradient');
    if (P.BackgroundTransparency < 1) {
      r.push(`background-color:${rgba(P.BackgroundColor3, P.BackgroundTransparency)};`);
      if (grad) r.push(`background-image:${gradientCss(grad)};background-blend-mode:multiply;`);
    }
    if (grad && (grad.props.GradTransparency[0] || grad.props.GradTransparency[1])) { const m = maskCss(grad); r.push(`-webkit-mask-image:${m};mask-image:${m};`); }
    const corner = modOf(n.id, 'UICorner');
    if (corner) {
      const [s, o] = corner.props.CornerRadius;
      if (s >= 0.5) r.push('border-radius:9999px;');
      else if (!s) r.push(`border-radius:${Math.round(o)}px;`);
      else { attrs.push(`data-r="${luaNum(s)},${Math.round(o)}"`); needsScript = true; }
    }
    const shadows = [];
    if (P.BorderSizePixel > 0 && !corner && P.BackgroundTransparency < 1) shadows.push(`0 0 0 ${P.BorderSizePixel}px ${rgba(P.BorderColor3, P.BackgroundTransparency)}`);
    kids(n.id).filter((k) => k.cls === 'UIStroke' && !strokeOnText(n, k) && k.props.Thickness > 0).forEach((s) => shadows.push(`0 0 0 ${luaNum(s.props.Thickness)}px ${rgba(s.props.Color, s.props.Transparency)}`));
    if (shadows.length) r.push(`box-shadow:${shadows.join(', ')};`);
    if (P.ClipsDescendants) r.push('overflow:hidden;');
    if (K.scroll) r.push('overflow:auto;');
    if (modOf(n.id, 'UIAspectRatioConstraint')) { attrs.push(`data-ar="${luaNum(modOf(n.id, 'UIAspectRatioConstraint').props.AspectRatio)}"`); needsScript = true; }
    if (K.button && P.AutoButtonColor) attrs.push('data-btn');
    css.push(`.${cls}{${r.join('')}}`);
    const ind = '  '.repeat(depth + 2);
    let inner = '';
    if (K.image) {
      const fitMode = OBJECT_FIT[P.ScaleType] || 'fill';
      inner += n.preview
        ? `\n${ind}  <img class="img" src="${n.preview}" alt="" style="object-fit:${fitMode};opacity:${roundTo(1 - P.ImageTransparency, 3)}">`
        : `\n${ind}  <div class="ph">${esc(P.Image || 'image')}</div>`;
    }
    if (K.text) {
      fontsUsed.add(P.Font);
      const f = fontInfo(P.Font);
      const tc = cls + 't';
      const strokes = kids(n.id).filter((k) => k.cls === 'UIStroke' && strokeOnText(n, k) && k.props.Thickness > 0);
      css.push(`.${tc}{${insetOf(n)}justify-content:${ALIGN_X[P.TextXAlignment]};align-items:${ALIGN_Y[P.TextYAlignment]};}`);
      const ts = [`font-family:${f.family}`, `font-weight:${f.weight}`, f.style !== 'normal' ? `font-style:${f.style}` : '', `color:${rgba(P.TextColor3, P.TextTransparency)}`, `text-align:${P.TextXAlignment.toLowerCase()}`, `white-space:${P.TextWrapped ? 'pre-wrap' : 'pre'}`, P.TextScaled ? '' : `font-size:${P.TextSize}px`,
        strokes.length ? `text-shadow:${strokes.map((s) => textRing(+s.props.Thickness, rgba(s.props.Color, Math.max(s.props.Transparency, P.TextTransparency)))).join(', ')}` : ''].filter(Boolean).join(';');
      css.push(`.${tc} > *{${ts};}`);
      if (P.TextScaled) needsScript = true;
      const body = K.input
        ? `<input value="${esc(P.Text)}" placeholder="${esc(P.PlaceholderText)}" aria-label="${esc(P.Name)}">`
        : `<span>${esc(P.Text)}</span>`;
      inner += `\n${ind}  <div class="t ${tc}"${P.TextScaled && !K.input ? ' data-fit' : ''}>${body}</div>`;
    }
    const children = sortedKids(n.id);
    if (children.length) {
      const list = modOf(n.id, 'UIListLayout');
      const cc = cls + 'c';
      const kidsHtml = children.map((c) => emit(c, !!list, depth + (K.scroll ? 3 : 2))).join('');
      if (K.scroll) {
        const cs = P.CanvasSize;
        css.push(`.${cls}v{position:absolute;left:0;top:0;width:max(100%, ${calcU(cs[0], cs[1])});height:max(100%, ${calcU(cs[2], cs[3])});}`);
        css.push(`.${cc}{${insetOf(n)}${list ? listCss(list) : ''}}`);
        inner += `\n${ind}  <div class="${cls}v">\n${ind}    <div class="c ${cc}">${kidsHtml}\n${ind}    </div>\n${ind}  </div>`;
      } else {
        css.push(`.${cc}{${insetOf(n)}${list ? listCss(list) : ''}}`);
        inner += `\n${ind}  <div class="c ${cc}">${kidsHtml}\n${ind}  </div>`;
      }
    }
    return `\n${ind}<div class="g ${cls}"${attrs.length ? ' ' + attrs.join(' ') : ''} data-name="${esc(P.Name)}">${inner}${inner ? '\n' + ind : ''}</div>`;
  };
  const screens = kids(doc.rootId).map((sg, i) => {
    const list = modOf(sg.id, 'UIListLayout');
    const sc = 's' + (i + 1);
    css.push(`.${sc}{z-index:${i + 1};${sg.props.Enabled === false ? 'display:none;' : ''}${list ? listCss(list) : ''}}`);
    return `\n  <div class="screen ${sc}" data-name="${esc(sg.props.Name)}">${sortedKids(sg.id).map((c) => emit(c, !!list, 0)).join('')}\n  </div>`;
  }).join('');
  const fontsHref = googleFontsHref([...fontsUsed]);
  const title = esc((kids(doc.rootId)[0] || { props: { Name: 'Framecraft export' } }).props.Name);
  const script = needsScript ? `
<scr${''}ipt>
  // Sizes that need the real box: rounded corners in Scale, aspect ratios, and TextScaled
  (function () {
    function fit() {
      var ar = document.querySelectorAll('[data-ar]');
      ar.forEach(function (el) { el.style.width = ''; el.style.height = ''; });
      ar.forEach(function (el) {
        var r = +el.dataset.ar, w = el.offsetWidth, h = el.offsetHeight;
        if (h > 0 && w / h > r) w = h * r; else h = w / r;
        el.style.width = w + 'px'; el.style.height = h + 'px';
      });
      document.querySelectorAll('[data-r]').forEach(function (el) {
        var p = el.dataset.r.split(','), m = Math.min(el.offsetWidth, el.offsetHeight);
        el.style.borderRadius = Math.max(0, Math.min(+p[0] * m + +p[1], m / 2)) + 'px';
      });
      document.querySelectorAll('[data-fit]').forEach(function (t) {
        var s = t.firstElementChild, W = t.clientWidth, H = t.clientHeight, lo = 1, hi = 100;
        while (lo < hi) {
          var mid = (lo + hi + 1) >> 1;
          s.style.fontSize = mid + 'px';
          if (s.scrollWidth <= W + 0.5 && s.offsetWidth <= W + 0.5 && s.offsetHeight <= H + 0.5) lo = mid; else hi = mid - 1;
        }
        s.style.fontSize = lo + 'px';
      });
    }
    addEventListener('resize', fit);
    if (document.fonts) document.fonts.ready.then(fit);
    fit();
  })();
<\/script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<\!-- Built with Framecraft (prototype). Every object keeps its Roblox name in data-name. -->${fontsHref ? `\n<link rel="stylesheet" href="${fontsHref}">` : ''}
<style>
  html, body { margin: 0; height: 100%; }
  body { background: ${BACKDROP_CSS[ui.backdrop] || BACKDROP_CSS.game}; overflow: hidden; }
  /* A ScreenGui covers the window. Position and Size are {Scale, Offset} pairs: calc(Scale% + Offset px). */
  .screen { position: fixed; inset: 0; }
  .g { position: absolute; box-sizing: border-box; }
  .c, .t { position: absolute; }
  .t { display: flex; pointer-events: none; }
  .t > * { line-height: 1; }
  .t > input { pointer-events: auto; width: 100%; height: 100%; border: 0; background: transparent; outline: none; padding: 0; font-size: inherit; }
  .img { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ph { position: absolute; inset: 0; display: grid; place-items: center; font: 12px monospace; color: #555;
        background: repeating-linear-gradient(45deg, #ddd 0 6px, #eee 6px 12px); }
  [data-btn] { cursor: pointer; }
  [data-btn]:hover { filter: brightness(0.9); }
  [data-btn]:active { filter: brightness(0.75); }
  ${css.join('\n  ')}
</style>
</head>
<body>${screens}${script}
</body>
</html>
`;
}
function exportJson() { return JSON.stringify({ format: 'framecraft', version: 1, doc }, null, 2) + '\n'; }

/* ---------- code view (Code tab) ---------- */
function highlightLuau(src) {
  return esc(src).split('\n').map((line) => {
    const c = line.indexOf('--');
    let code = c >= 0 ? line.slice(0, c) : line;
    const cm = c >= 0 ? `<span class="cm">${line.slice(c)}</span>` : '';
    code = code.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)|\b(local|true|false|nil|function|end|return|if|then|else)\b|(\b-?\d+(?:\.\d+)?\b)/g,
      (m, s, kw, num) => s ? `<span class="st">${s}</span>` : kw ? `<span class="kw">${kw}</span>` : `<span class="nu">${num}</span>`);
    return code + cm;
  }).join('\n');
}
async function copyText(text, preEl) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch (e) {
    if (preEl) { const r = document.createRange(); r.selectNodeContents(preEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('Copy is blocked here. The code is selected: press Ctrl+C.');
  }
}
function renderCode() {
  const pane = $('#codePane');
  if (ui.tab !== 'code') return;
  const n = node(ui.sel);
  const src = n && n.cls !== 'StarterGui' ? exportLuauSubtree(n.id) : exportLuau('command');
  pane.innerHTML = '';
  const pre = h('pre', { class: 'code', tabindex: '0', 'aria-label': 'Luau code', html: highlightLuau(src) });
  pane.append(
    h('div', { class: 'codebar' },
      h('span', { class: 'note', style: 'flex:1;min-width:0' }, n && n.cls !== 'StarterGui' ? `Luau for ${n.props.Name}` : 'Luau for the whole project'),
      h('button', { class: 'btn', html: ICONS.copy + 'Copy', onclick: () => copyText(src, pre) })),
    pre);
}

/* ---------- export dialog ---------- */
let downloads = null;
function closeModal() { $('#modalRoot').innerHTML = ''; }
function openExport(kind = 'luau') {
  const state = { kind };
  const root = $('#modalRoot');
  const draw = () => {
    const text = state.kind === 'luau' ? exportLuau() : state.kind === 'html' ? exportHtml() : exportJson();
    const how = {
      luau: ui.luauTarget === 'command'
        ? 'Paste into Studio\'s command bar and press Enter. The UI lands in StarterGui, ready to edit like anything you built by hand.'
        : 'Paste into a LocalScript in StarterPlayerScripts. Each player gets the UI when they join.',
      html: 'A standalone web page. Scale and Offset become CSS calc(), so it resizes like it does in Roblox. Save it as an .html file and open it in any browser.',
      json: 'Your whole project. Import it later from the Project menu to keep working.',
    }[state.kind];
    const pre = h('pre', { class: 'code', tabindex: '0', 'aria-label': 'Exported code', html: state.kind === 'luau' ? highlightLuau(text) : esc(text) });
    const tab = (k, label) => h('button', { class: state.kind === k ? 'on' : '', onclick: () => { state.kind = k; draw(); } }, label);
    const files = { html: 'framecraft-ui.html', json: 'framecraft-project.json' };
    const saveBtn = downloads && files[state.kind] ? h('button', { class: 'btn', html: ICONS.download + `Download .${state.kind}`, onclick: async () => {
      try { await downloads.save({ filename: files[state.kind], data: text }); toast('Saved ' + files[state.kind]); }
      catch (err) { if (!err || err.code !== 'declined') toast(err && err.message ? err.message : 'The download did not go through.'); }
    } }) : null;
    root.innerHTML = '';
    const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Export' },
      h('header', {},
        h('h3', {}, 'Export'),
        h('div', { class: 'seg', role: 'tablist' }, tab('luau', 'Luau for Studio'), tab('html', 'HTML page'), tab('json', 'Project file')),
        h('div', { class: 'spacer' }),
        h('button', { class: 'btn icon', 'aria-label': 'Close', onclick: closeModal }, '✕')),
      h('div', { class: 'how' }, h('p', {}, how),
        state.kind === 'luau' ? h('div', { class: 'seg' },
          ...[['command', 'Command bar'], ['local', 'LocalScript']].map(([k, label]) => h('button', { class: ui.luauTarget === k ? 'on' : '', onclick: () => { ui.luauTarget = k; draw(); } }, label))) : null),
      pre,
      h('footer', {},
        h('span', { class: 'note', style: 'margin-right:auto' }, `${text.split('\n').length} lines`),
        saveBtn,
        h('button', { class: 'btn primary', html: ICONS.copy + 'Copy', onclick: () => copyText(text, pre) })));
    root.append(h('div', { class: 'scrim', onclick: (e) => { if (e.target === e.currentTarget) closeModal(); } }, modal));
  };
  draw();
}

/* ---------- import ---------- */
function importProject(text) {
  try {
    const data = JSON.parse(text);
    const d = data && data.format === 'framecraft' ? data.doc : data;
    if (!validDoc(d)) throw new Error('bad');
    replaceDoc(normalizeDoc(d), 'Imported the project. Undo brings your previous work back.');
  } catch (e) {
    toast('That file is not a Framecraft project. Export one from Project → Export project file.');
  }
}

/* ============================================================
   Boot
   ============================================================ */
function renderAll() {
  renderViewport();
  renderExplorer();
  renderProps();
  renderCode();
  updateToolbar();
}
function init() {
  buildRibbon();
  $('#deviceSel').append(...Object.entries(DEVICES).map(([k, d]) => h('option', { value: k }, d.label)));
  $('#deviceSel').value = ui.device;
  $('#deviceSel').addEventListener('change', (e) => { ui.device = e.target.value; ui.zoom = null; renderAll(); });
  $('#backdropSel').addEventListener('change', (e) => { ui.backdrop = e.target.value; renderScreen(); });
  $('#zoomIn').addEventListener('click', () => zoomTo(ui.z * 1.25));
  $('#zoomOut').addEventListener('click', () => zoomTo(ui.z / 1.25));
  $('#zoomFit').addEventListener('click', () => { ui.zoom = null; renderViewport(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnPreview').addEventListener('click', () => setPreview(!ui.preview));
  $('#btnExport').addEventListener('click', () => openExport('luau'));
  $('#btnFile').addEventListener('click', projectMenu);
  $('#toScale').addEventListener('click', () => convertUnits(true));
  $('#toOffset').addEventListener('click', () => convertUnits(false));
  $$('#unitSeg button').forEach((b) => b.addEventListener('click', () => { ui.unit = b.dataset.u; updateToolbar(); }));
  $('#snapToggle').addEventListener('change', (e) => { ui.snap = e.target.checked; });
  $$('.props .tabs button').forEach((b) => b.addEventListener('click', () => {
    ui.tab = b.dataset.tab;
    $$('.props .tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('#propsBody').hidden = ui.tab !== 'props';
    $('#codePane').hidden = ui.tab !== 'code';
    renderProps();
    renderCode();
  }));
  $('#btnShowExplorer').addEventListener('click', () => { $('#props').classList.remove('sheet-open'); $('#explorer').classList.toggle('sheet-open'); });
  $('#btnShowProps').addEventListener('click', () => { $('#explorer').classList.remove('sheet-open'); $('#props').classList.toggle('sheet-open'); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => $('#' + b.dataset.close).classList.remove('sheet-open')));
  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importProject(String(r.result));
    r.readAsText(f);
    e.target.value = '';
  });
  $('#imageInput').addEventListener('change', (e) => {
    const f = e.target.files[0], id = ui.sel;
    e.target.value = '';
    if (!f || !node(id) || !CLASSES[node(id).cls].image) return;
    if (f.size > 1.5e6) { toast('Pick an image under 1.5 MB so the project still fits in your browser\'s storage.'); return; }
    const r = new FileReader();
    r.onload = () => mutate(() => { node(id).preview = String(r.result); });
    r.readAsDataURL(f);
  });
  const cv = $('#canvas');
  cv.addEventListener('pointerdown', onPointerDown);
  cv.addEventListener('pointermove', onPointerMove);
  cv.addEventListener('pointerup', onPointerUp);
  cv.addEventListener('pointercancel', onPointerUp);
  cv.addEventListener('pointerleave', () => { if (!ui.drag) { ui.mouse = null; if (ui.hover) { ui.hover = null; renderOverlay(); } scheduleStatus(); } });
  cv.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomTo(ui.z * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }, { passive: false });
  document.addEventListener('keydown', onKeyDown);
  let resizeT = 0;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(renderViewport, 60); });
  if (document.fonts) {
    document.fonts.ready.then(() => { fitCache.clear(); renderViewport(); });
    document.fonts.addEventListener('loadingdone', () => { fitCache.clear(); renderViewport(); });
  }
  initExplorer();

  doc = loadSaved() || buildSample();
  ui.expanded = new Set(['root']);
  kids('root').forEach((sg) => { ui.expanded.add(sg.id); guiKids(sg.id).forEach((c) => { if (c.props.Name === 'Panel') ui.expanded.add(c.id); }); });
  renderAll();
  const panel = Object.values(doc.nodes).find((n) => n.props.Name === 'Panel' && isGui(n));
  select(panel ? panel.id : null);

  const use = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : Promise.resolve(null);
  Promise.resolve(use).then((d) => { downloads = d || null; }).catch(() => { downloads = null; });
}
init();
