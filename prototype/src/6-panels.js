/* ============================================================
   Explorer, Properties, ribbon state, menus
   ============================================================ */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  children.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
  return el;
}

/* ---------- Explorer ---------- */
function renderExplorer() {
  const out = [];
  const walk = (id, depth) => {
    const n = node(id);
    const hasKids = n.children.length > 0, open = ui.expanded.has(id), sel = id === ui.sel;
    const togg = isGui(n) || n.cls === 'ScreenGui';
    const hidden = (isGui(n) && n.props.Visible === false) || (n.cls === 'ScreenGui' && n.props.Enabled === false);
    out.push(`<div class="row${sel ? ' sel' : ''}${hidden ? ' hidden-obj' : ''}" role="treeitem" aria-selected="${sel}"${hasKids ? ` aria-expanded="${open}"` : ''} data-id="${id}" draggable="${id !== doc.rootId}" style="padding-left:${4 + depth * 14}px" title="${esc(n.cls)}">` +
      `<button class="twisty${open ? ' open' : ''}" data-twisty tabindex="-1" aria-label="${open ? 'Collapse' : 'Expand'}"${hasKids ? '' : ' style="visibility:hidden"'}>${ICONS.chevron}</button>` +
      `<span class="ico ${iconClass(n.cls)}">${ICONS[n.cls]}</span>` +
      `<span class="name">${ui.renaming === id ? `<input id="rename-${id}" value="${esc(n.props.Name)}" data-rename aria-label="Name">` : esc(n.props.Name)}</span>` +
      (togg ? `<button class="eye${hidden ? ' off' : ''}" data-eye tabindex="-1" aria-label="${hidden ? 'Show' : 'Hide'} ${esc(n.props.Name)}">${hidden ? ICONS.eyeOff : ICONS.eye}</button>` : '') +
      `</div>`);
    if (hasKids && open) n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(doc.rootId, 0);
  $('#tree').innerHTML = out.join('');
  const inp = $('#tree [data-rename]');
  if (inp) { inp.focus(); inp.select(); }
}
function startRename(id) {
  if (!node(id) || id === doc.rootId) return;
  ui.renaming = id;
  renderExplorer();
}
function finishRename(commit) {
  const id = ui.renaming;
  const inp = $('#tree [data-rename]');
  ui.renaming = null;
  if (commit && inp && node(id)) {
    const v = inp.value.trim();
    if (v && v !== node(id).props.Name) { mutate(() => { node(id).props.Name = v; }); return; }
  }
  renderExplorer();
}
function initExplorer() {
  const tree = $('#tree');
  tree.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row || e.target.closest('[data-rename]')) return;
    const id = row.dataset.id;
    if (e.target.closest('[data-twisty]')) {
      if (ui.expanded.has(id)) ui.expanded.delete(id); else ui.expanded.add(id);
      renderExplorer();
      return;
    }
    if (e.target.closest('[data-eye]')) {
      const n = node(id);
      mutate(() => { if (n.cls === 'ScreenGui') n.props.Enabled = n.props.Enabled === false; else n.props.Visible = n.props.Visible === false; });
      return;
    }
    select(id);
  });
  tree.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.row');
    if (row && e.target.closest('.name') && !e.target.closest('[data-rename]')) startRename(row.dataset.id);
  });
  tree.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-rename]')) return;
    if (e.key === 'Enter') { e.preventDefault(); finishRename(true); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finishRename(false); }
  });
  tree.addEventListener('focusout', (e) => { if (e.target.matches('[data-rename]')) finishRename(true); });
  tree.addEventListener('pointerover', (e) => {
    const row = e.target.closest('.row');
    const id = row ? row.dataset.id : null;
    if (id !== ui.hover) { ui.hover = id; renderOverlay(); }
  });
  tree.addEventListener('pointerleave', () => { ui.hover = null; renderOverlay(); });

  // drag a row onto another to reparent it, or onto its top/bottom edge to reorder
  let dragId = null;
  const clearMarks = () => $$('.row.drop-in, .row.drop-before, .row.drop-after', tree).forEach((r) => r.classList.remove('drop-in', 'drop-before', 'drop-after'));
  const dropMode = (e, row) => {
    const target = node(row.dataset.id), moving = node(dragId);
    if (!target || !moving || target.id === moving.id || isAncestor(moving.id, target.id)) return null;
    const r = row.getBoundingClientRect();
    const f = (e.clientY - r.top) / r.height;
    const parent = node(target.parent);
    const sibOk = parent && canParent(moving.cls, parent);
    if (f < 0.28 && sibOk) return 'before';
    if (f > 0.72 && sibOk && !ui.expanded.has(target.id)) return 'after';
    if (canParent(moving.cls, target)) return 'in';
    return sibOk ? (f < 0.5 ? 'before' : 'after') : null;
  };
  tree.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    dragId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node(dragId).props.Name);
  });
  tree.addEventListener('dragover', (e) => {
    const row = e.target.closest('.row');
    clearMarks();
    if (!row || !dragId) return;
    const mode = dropMode(e, row);
    if (!mode) return;
    e.preventDefault();
    row.classList.add('drop-' + mode);
  });
  tree.addEventListener('dragleave', (e) => { if (!tree.contains(e.relatedTarget)) clearMarks(); });
  tree.addEventListener('drop', (e) => {
    const row = e.target.closest('.row');
    const mode = row && dragId ? dropMode(e, row) : null;
    clearMarks();
    if (!mode) return;
    e.preventDefault();
    const moving = dragId, target = row.dataset.id;
    mutate(() => {
      const m = node(moving);
      detach(moving);
      if (mode === 'in') { attach(m, target); ui.expanded.add(target); }
      else {
        const parent = node(node(target).parent);
        const idx = parent.children.indexOf(target) + (mode === 'after' ? 1 : 0);
        attach(m, parent.id, idx);
      }
      ui.sel = moving;
    });
    select(moving);
  });
  tree.addEventListener('dragend', () => { dragId = null; clearMarks(); });
}

/* ---------- value parsing (accepts Studio's shorthand) ---------- */
function parseNums(s) {
  const parts = String(s).replace(/[{}\[\]()]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number);
  return parts.length && parts.every(Number.isFinite) ? parts : null;
}
const inferUdim = (v) => (v !== 0 && Math.abs(v) <= 1 ? [v, 0] : [0, Math.round(v)]);
function parseUDim2(s) {
  const a = parseNums(s);
  if (!a) return null;
  if (a.length === 4) return [a[0], Math.round(a[1]), a[2], Math.round(a[3])];
  if (a.length === 1) { const u = inferUdim(a[0]); return [u[0], u[1], u[0], u[1]]; }
  if (a.length === 2) { const x = inferUdim(a[0]), y = inferUdim(a[1]); return [x[0], x[1], y[0], y[1]]; }
  return null;
}
function parseVec2(s) { const a = parseNums(s); return !a ? null : a.length === 1 ? [a[0], a[0]] : a.length === 2 ? a : null; }
function parseColor(s) {
  const hx = fromHex(String(s));
  if (hx) return hx;
  const a = parseNums(s);
  return a && a.length === 3 ? a.map((v) => clamp(Math.round(v), 0, 255)) : null;
}
const fmtUDim2 = (u) => `{${fmtNum(u[0])}, ${fmtNum(u[1], 0)}},{${fmtNum(u[2])}, ${fmtNum(u[3], 0)}}`;
const fmtColor = (c) => `[${c[0]}, ${c[1]}, ${c[2]}]`;

/* ---------- Properties ---------- */
function setProp(id, key, value) { mutate(() => { node(id).props[key] = value; }); }
function liveProp(id, key) { // continuous edits (sliders, color picker) become one undo step
  let before = null;
  return {
    input(v) { if (before == null) before = snapshot(); node(id).props[key] = v; renderViewport(); },
    commit(v) { if (before == null) before = snapshot(); node(id).props[key] = v; const b = before; before = null; record(b); renderAll(); },
  };
}
function numField(id, key, value, opts = {}) {
  const fid = opts.fid || `p-${key}`;
  const inp = h('input', { class: 'fld' + (opts.tone ? ' ' + opts.tone : ''), id: fid, value: fmtNum(value, opts.int ? 0 : 4), inputmode: 'decimal', 'aria-label': opts.label || key, autocomplete: 'off' });
  const apply = (v) => {
    if (!Number.isFinite(v)) { inp.classList.add('bad'); return; }
    if (opts.min != null) v = Math.max(opts.min, v);
    if (opts.max != null) v = Math.min(opts.max, v);
    if (opts.int) v = Math.round(v);
    opts.set(roundTo(v, 4));
  };
  inp.addEventListener('change', () => { const a = parseNums(inp.value); apply(a && a.length === 1 ? a[0] : NaN); });
  inp.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const base = opts.step || (opts.int ? 1 : 1);
    const step = base * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    const cur = parseNums(inp.value);
    apply(roundTo((cur ? cur[0] : value) + step, 4));
  });
  return inp;
}
function textField(key, value, onSet, opts = {}) {
  const inp = h('input', { class: 'fld' + (opts.tone ? ' ' + opts.tone : ''), id: opts.fid || `p-${key}`, value, 'aria-label': opts.label || key, autocomplete: 'off', spellcheck: 'false' });
  inp.addEventListener('change', () => { if (onSet(inp.value) === false) inp.classList.add('bad'); });
  return inp;
}
function colorEditor(id, key, value, fid) {
  const live = liveProp(id, key);
  const sw = h('span');
  sw.style.background = rgb(value);
  const pick = h('input', { type: 'color', id: fid + '-pick', value: hex(value), 'aria-label': key + ' picker' });
  pick.addEventListener('input', () => { const c = fromHex(pick.value); sw.style.background = pick.value; txt.value = fmtColor(c); live.input(c); });
  pick.addEventListener('change', () => live.commit(fromHex(pick.value)));
  const txt = textField(key, fmtColor(value), (s) => { const c = parseColor(s); if (!c) return false; setProp(id, key, c); }, { fid });
  return h('div', { class: 'combo' }, h('label', { class: 'swatch', title: 'Pick a color' }, sw, pick), txt);
}
function editorFor(n, key) {
  const S = PROPS[key], v = n.props[key], id = n.id;
  switch (S.type) {
    case 'string': return textField(key, v, (s) => setProp(id, key, key === 'Name' ? (s.trim() || v) : s));
    case 'int': return numField(id, key, v, { int: true, min: S.min, max: S.max, set: (x) => setProp(id, key, x) });
    case 'number': return numField(id, key, v, { min: S.min, max: S.max, step: S.step, set: (x) => setProp(id, key, x) });
    case 'bool': {
      const cb = h('input', { type: 'checkbox', id: `p-${key}`, checked: !!v, 'aria-label': key });
      cb.addEventListener('change', () => setProp(id, key, cb.checked));
      return h('div', { class: 'combo' }, cb);
    }
    case 'enum': {
      const sel = h('select', { class: 'fld', id: `p-${key}`, 'aria-label': key }, S.options.map((o) => h('option', { value: o }, o)));
      sel.value = v;
      sel.addEventListener('change', () => setProp(id, key, sel.value));
      return sel;
    }
    case 'alpha': {
      const live = liveProp(id, key);
      const num = numField(id, key, v, { min: 0, max: 1, step: 0.05, set: (x) => setProp(id, key, x) });
      const rng = h('input', { type: 'range', class: 'slider', id: `p-${key}-range`, min: 0, max: 1, step: 0.01, value: v, 'aria-label': key + ' slider' });
      rng.addEventListener('input', () => { num.value = rng.value; live.input(+rng.value); });
      rng.addEventListener('change', () => live.commit(+rng.value));
      return h('div', { class: 'combo' }, h('div', { style: 'flex:0 0 64px' }, num), rng);
    }
    case 'color': return colorEditor(id, key, v, `p-${key}`);
    case 'vec2': return textField(key, `${fmtNum(v[0])}, ${fmtNum(v[1])}`, (s) => { const a = parseVec2(s); if (!a) return false; setProp(id, key, a); });
    case 'udim': return h('div', { class: 'pair' },
      numField(id, key, v[0], { fid: `p-${key}-s`, tone: 's', step: 0.01, label: key + ' Scale', set: (x) => setProp(id, key, [x, v[1]]) }),
      numField(id, key, v[1], { fid: `p-${key}-o`, tone: 'o', int: true, label: key + ' Offset', set: (x) => setProp(id, key, [v[0], x]) }));
    case 'udim2': return textField(key, fmtUDim2(v), (s) => { const a = parseUDim2(s); if (!a) return false; setProp(id, key, a); });
    case 'colorseq': return h('div', { class: 'pair' }, ...[0, 1].map((i) => {
      const live = liveProp(id, key);
      const sw = h('span');
      sw.style.background = rgb(v[i]);
      const pick = h('input', { type: 'color', id: `p-${key}-${i}`, value: hex(v[i]), 'aria-label': (i ? 'End' : 'Start') + ' color' });
      const val = () => { const c = deep(node(id).props[key]); c[i] = fromHex(pick.value); return c; };
      pick.addEventListener('input', () => { sw.style.background = pick.value; live.input(val()); });
      pick.addEventListener('change', () => live.commit(val()));
      return h('div', { class: 'combo' }, h('label', { class: 'swatch' }, sw, pick), h('span', { class: 'note' }, i ? 'end' : 'start'));
    }));
    case 'numseq': return h('div', { class: 'pair' },
      numField(id, key, v[0], { fid: `p-${key}-0`, min: 0, max: 1, step: 0.05, label: 'Start transparency', set: (x) => setProp(id, key, [x, v[1]]) }),
      numField(id, key, v[1], { fid: `p-${key}-1`, min: 0, max: 1, step: 0.05, label: 'End transparency', set: (x) => setProp(id, key, [v[0], x]) }));
    case 'image': return textField(key, v, (s) => setProp(id, key, s.trim()), { label: 'Image asset id' });
    default: return h('span', {}, String(v));
  }
}
function udim2Rows(n, key) { // expanded X/Y Scale/Offset fields under a UDim2 row
  const v = n.props[key], id = n.id;
  const set = (i) => (x) => { const u = node(id).props[key].slice(); u[i] = i % 2 ? Math.round(x) : x; setProp(id, key, u); };
  return [['X', 0], ['Y', 2]].map(([ax, i]) => h('div', { class: 'prow sub' },
    h('label', {}, ax),
    h('div', { class: 'pair' },
      numField(id, key, v[i], { fid: `p-${key}-${ax}s`, tone: 's', step: 0.01, label: `${key} ${ax} Scale`, set: set(i) }),
      numField(id, key, v[i + 1], { fid: `p-${key}-${ax}o`, tone: 'o', int: true, label: `${key} ${ax} Offset`, set: set(i + 1) }))));
}
function propNotes(n) {
  const notes = {};
  const b = L[n.id];
  if (b && b.listItem) notes.Transform = 'A UIListLayout in the parent sets this object\'s position. Size still applies; LayoutOrder sets the order.';
  if (n.cls === 'ScreenGui') notes.Behavior = 'Export turns IgnoreGuiInset on, so Roblox\'s top bar does not push your layout down.';
  if (n.cls === 'UIStroke') notes.Stroke = 'On text objects, Contextual outlines the letters. Border outlines the box instead.';
  if (n.cls === 'UIGradient') notes.Gradient = 'Multiplies the parent\'s background colors. Rotation 0 runs left to right, 90 runs top to bottom.';
  if (n.cls === 'UIListLayout') notes.Layout = 'Stacks the parent\'s children in LayoutOrder and ignores their Position.';
  if (n.cls === 'UIAspectRatioConstraint') notes.Constraint = 'Keeps width ÷ height at this ratio, shrinking whichever side is too long.';
  if (n.cls === 'UIPadding') notes.Padding = 'Shrinks the area children are laid out in. Scale is a fraction of the parent\'s width or height.';
  if (n.cls === 'UICorner') notes.Corner = 'Scale is measured on the shorter side, so 0.5 makes a pill or circle.';
  if (CLASSES[n.cls].image) notes.Image = 'Roblox images can\'t load in a browser, so upload a preview picture. The asset id is what the export uses.';
  return notes;
}
function renderProps() {
  if (ui.tab !== 'props') return;
  const body = $('#propsBody');
  const active = document.activeElement;
  const focusId = active && body.contains(active) ? active.id : null;
  body.innerHTML = '';
  const n = node(ui.sel);
  if (!n) {
    body.append(h('div', { class: 'empty', html:
      '<h3>Nothing selected</h3><p>Click an object in the viewport or the Explorer to edit it.</p>' +
      '<p>Every Position and Size is two pairs: <code>{Scale, Offset}</code> for X and Y. <span style="color:var(--scale);font-weight:600">Scale</span> is a fraction of the parent, <span style="color:var(--offset);font-weight:600">Offset</span> is pixels. Fields accept Studio shorthand like <code>0.5</code> or <code>0.25,40,0.1,20</code>.</p>' +
      '<p>Shortcuts: Delete, Ctrl+D duplicate, Ctrl+C / Ctrl+V, arrows nudge (Shift for 10 px), Esc selects the parent, F2 renames, P previews.</p>' }));
    return;
  }
  if (n.cls === 'StarterGui') {
    body.append(h('div', { class: 'empty', html: '<h3>StarterGui</h3><p>Holds your ScreenGuis. In a Roblox game, everything here is copied onto each player\'s screen.</p>' }));
    return;
  }
  const head = h('div', { class: 'selhead' },
    h('div', { class: 'who' }, h('span', { class: iconClass(n.cls), html: ICONS[n.cls] }), h('b', {}, n.props.Name), h('span', {}, n.cls)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: duplicateSelection, html: ICONS.duplicate + 'Duplicate' }),
      CLASSES[n.cls].image ? h('button', { class: 'btn', onclick: () => $('#imageInput').click(), html: ICONS.upload + (n.preview ? 'Replace preview' : 'Upload preview') }) : null,
      CLASSES[n.cls].image && n.preview ? h('button', { class: 'btn', onclick: () => mutate(() => { delete node(n.id).preview; }) }, 'Remove preview') : null,
      h('button', { class: 'btn', onclick: deleteSelection, html: ICONS.trash + 'Delete' })));
  body.append(head);
  const notes = propNotes(n);
  const byCat = {};
  CLASSES[n.cls].props.forEach((k) => { (byCat[PROPS[k].cat] = byCat[PROPS[k].cat] || []).push(k); });
  CAT_ORDER.filter((c) => byCat[c]).forEach((cat) => {
    const open = !ui.closedCats.has(cat);
    const rows = h('div', { class: 'rows' });
    byCat[cat].forEach((key) => {
      const S = PROPS[key];
      const dim = (key === 'Position' && L[n.id] && L[n.id].listItem) || (key === 'TextSize' && n.props.TextScaled) || (key === 'Rotation' && L[n.id] && L[n.id].listItem);
      const row = h('div', { class: 'prow' + (dim ? ' dim' : '') }, h('label', { for: `p-${key}`, title: key }, S.label || key));
      if (S.type === 'udim2') {
        const isOpen = ui.openUdim.has(key);
        const exp = h('button', { class: 'expand' + (isOpen ? ' open' : ''), 'aria-label': `Show ${key} parts`, html: ICONS.chevron, onclick: () => { if (isOpen) ui.openUdim.delete(key); else ui.openUdim.add(key); renderProps(); } });
        row.append(h('div', { class: 'combo' }, exp, editorFor(n, key)));
        rows.append(row);
        if (isOpen) udim2Rows(n, key).forEach((r) => rows.append(r));
      } else {
        row.append(editorFor(n, key));
        rows.append(row);
      }
    });
    if (notes[cat]) rows.append(h('div', { class: 'note' }, notes[cat]));
    const sec = h('section', { class: 'cat' + (open ? ' open' : '') },
      h('button', { 'aria-expanded': String(open), html: ICONS.chevron + esc(cat), onclick: () => { if (open) ui.closedCats.add(cat); else ui.closedCats.delete(cat); renderProps(); } }),
      rows);
    body.append(sec);
  });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (el.select && el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'range' && el.type !== 'color') el.select(); } }
}

/* ---------- ribbon + bar state ---------- */
function buildRibbon() {
  $('#insertObjects').append(...['ScreenGui', ...OBJECT_CLASSES].map((cls) =>
    h('button', { class: 'tool', 'data-insert': cls, title: `Insert ${cls}`, onclick: () => insertObject(cls), html: `<span class="${iconClass(cls)}">${ICONS[cls]}</span>${SHORT[cls] || cls}` })));
  $('#insertMods').append(...MOD_CLASSES.map((cls) =>
    h('button', { class: 'tool', 'data-mod': cls, title: `Add ${cls}`, onclick: () => insertModifier(cls), html: `<span class="${iconClass(cls)}">${ICONS[cls]}</span>${SHORT[cls] || cls}` })));
  $$('[data-icon]').forEach((s) => { s.outerHTML = ICONS[s.dataset.icon]; });
}
function updateToolbar() {
  $('#btnUndo').disabled = !hist.undo.length;
  $('#btnRedo').disabled = !hist.redo.length;
  const n = node(ui.sel);
  $$('[data-mod]').forEach((b) => { b.disabled = !n || !canParent(b.dataset.mod, n); });
  const conv = !!n && (isGui(n) || n.cls === 'ScreenGui');
  $('#toScale').disabled = !conv;
  $('#toOffset').disabled = !conv;
  $$('#unitSeg button').forEach((b) => b.classList.toggle('on', b.dataset.u === ui.unit));
}

/* ---------- menus ---------- */
function closeMenus() { $$('.menu').forEach((m) => m.remove()); }
function openMenu(anchor, items) {
  closeMenus();
  const m = h('div', { class: 'menu', role: 'menu' }, items.map((it) => it === '-' ? h('hr') :
    h('button', { role: 'menuitem', disabled: it.disabled, html: (it.icon ? ICONS[it.icon] : '') + esc(it.label) + (it.hint ? `<small>${esc(it.hint)}</small>` : ''), onclick: () => { closeMenus(); it.run(); } })));
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = r.bottom + 6 + 'px';
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { closeMenus(); document.removeEventListener('pointerdown', off, true); } };
    document.addEventListener('pointerdown', off, true);
  });
  const first = m.querySelector('button:not([disabled])');
  if (first) first.focus();
}
function replaceDoc(d, message) {
  mutate(() => { doc = d; ui.sel = null; ui.expanded = new Set(['root', ...kids('root').map((n) => n.id)]); });
  select(null);
  toast(message);
}
function projectMenu() {
  openMenu($('#btnFile'), [
    { label: 'New blank project', icon: 'blank', run: () => replaceDoc(blankDoc(), 'Started a blank project. Undo brings the old one back.') },
    { label: 'Load the sample menu', icon: 'reset', run: () => replaceDoc(buildSample(), 'Loaded the sample menu. Undo brings your work back.') },
    '-',
    { label: 'Import project file…', icon: 'upload', hint: '.json', run: () => $('#fileInput').click() },
    { label: 'Export project file…', icon: 'download', hint: '.json', run: () => openExport('json') },
  ]);
}
