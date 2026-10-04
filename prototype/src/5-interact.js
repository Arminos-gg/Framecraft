/* ============================================================
   Editing: select, move, resize, snap, nudge, insert, convert
   ============================================================ */
function screenPoint(e) {
  const r = $('#device').getBoundingClientRect();
  return { x: (e.clientX - r.left) / ui.z, y: (e.clientY - r.top) / ui.z };
}
const rotVec = (x, y, deg) => { const r = deg * Math.PI / 180; return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]; };

/* Write a pixel value back into a [scale, offset] pair, honoring the "Dragging edits" setting */
function writeAxis(u, px, len) {
  let mode = ui.unit;
  if (mode === 'auto') mode = (u[1] === 0 && u[0] !== 0) ? 'scale' : 'offset';
  if (mode === 'scale' && len > 0) return [roundTo((px - u[1]) / len, 4), u[1]];
  return [u[0], Math.round(px - u[0] * len)];
}
function setPosFromAbs(n, x, y, w, h) {
  const area = L[n.id].area, A = n.props.AnchorPoint, P = n.props.Position;
  const px = x + A[0] * w - area.x, py = y + A[1] * h - area.y;
  const X = writeAxis([P[0], P[1]], px, area.w), Y = writeAxis([P[2], P[3]], py, area.h);
  n.props.Position = [X[0], X[1], Y[0], Y[1]];
}
function setSizeFromAbs(n, w, h) {
  const area = L[n.id].area, S = n.props.Size;
  const X = writeAxis([S[0], S[1]], w, area.w), Y = writeAxis([S[2], S[3]], h, area.h);
  n.props.Size = [X[0], X[1], Y[0], Y[1]];
}

/* ---------- smart snapping against the parent and siblings ---------- */
function snapTargets(id) {
  const b = L[id], area = b.area;
  const xs = [area.x, area.x + area.w / 2, area.x + area.w];
  const ys = [area.y, area.y + area.h / 2, area.y + area.h];
  guiKids(node(id).parent).forEach((s) => {
    const sb = L[s.id];
    if (s.id === id || !sb || !sb.visible || sb.rot) return;
    xs.push(sb.x, sb.x + sb.w / 2, sb.x + sb.w);
    ys.push(sb.y, sb.y + sb.h / 2, sb.y + sb.h);
  });
  return { xs, ys, area };
}
function nearest(values, targets, th) { // best [delta, line] for any of the moving edges
  let best = null;
  values.forEach((v) => targets.forEach((t) => {
    const d = t - v;
    if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t };
  }));
  return best;
}
function guideV(x, T, y, h) { return { t: 'v', x, a: Math.min(T.area.y, y), b: Math.max(T.area.y + T.area.h, y + h) }; }
function guideH(y, T, x, w) { return { t: 'h', y, a: Math.min(T.area.x, x), b: Math.max(T.area.x + T.area.w, x + w) }; }

/* ---------- pointer handling on the viewport ---------- */
function guiIdFromTarget(t) {
  const el = t && t.closest ? t.closest('#screen .gui') : null;
  return el ? el.dataset.id : null;
}
function beginDrag(e, kind, id, handle) {
  const b = L[id];
  ui.drag = {
    kind, id, handle, active: false, pointerId: e.pointerId, start: screenPoint(e), box: { ...b },
    before: snapshot(), parentAngle: ancestorAngle(id), angle: screenQuad(id).angle, warned: false,
  };
  $('#canvas').setPointerCapture(e.pointerId);
}
function onPointerDown(e) {
  if (e.button !== 0 || ui.preview) return;
  const h = e.target.closest('.handle');
  if (h && ui.sel) { e.preventDefault(); beginDrag(e, 'resize', ui.sel, h.dataset.h); return; }
  const id = guiIdFromTarget(e.target);
  if (!id) { if (e.target.closest('#canvas')) select(null); return; }
  e.preventDefault();
  const cur = node(ui.sel);
  if (cur && isGui(cur) && id !== cur.id && isAncestor(cur.id, id)) {
    beginDrag(e, 'move', cur.id); // drag moves the selected object; a plain click selects the child under the cursor
    ui.drag.clickId = id;
    return;
  }
  if (ui.sel !== id) select(id);
  beginDrag(e, 'move', id);
}
function onPointerMove(e) {
  const p = screenPoint(e);
  ui.mouse = p;
  const d = ui.drag;
  if (!d) {
    if (ui.preview) return;
    const id = guiIdFromTarget(e.target);
    if (id !== ui.hover) { ui.hover = id; renderOverlay(); }
    scheduleStatus();
    return;
  }
  if (e.pointerId !== d.pointerId) return;
  let dx = p.x - d.start.x, dy = p.y - d.start.y;
  if (!d.active) {
    if (Math.hypot(dx, dy) * ui.z < 3) return;
    d.active = true;
  }
  const n = node(d.id);
  const snapOn = ui.snap && !e.altKey;
  ui.guides = [];
  if (d.kind === 'move') {
    if (d.box.listItem) {
      if (!d.warned) { toast('A UIListLayout places this object. Change LayoutOrder to reorder it.'); d.warned = true; }
      return;
    }
    if (d.parentAngle) [dx, dy] = rotVec(dx, dy, -d.parentAngle);
    let x = d.box.x + dx, y = d.box.y + dy;
    if (snapOn && !d.parentAngle && !d.box.rot) {
      const T = snapTargets(d.id), th = 6 / ui.z;
      const sx = nearest([x, x + d.box.w / 2, x + d.box.w], T.xs, th);
      const sy = nearest([y, y + d.box.h / 2, y + d.box.h], T.ys, th);
      if (sx) { x += sx.d; ui.guides.push(guideV(sx.line, T, y, d.box.h)); }
      if (sy) { y += sy.d; ui.guides.push(guideH(sy.line, T, x, d.box.w)); }
    }
    setPosFromAbs(n, x, y, d.box.w, d.box.h);
  } else {
    if (d.angle) [dx, dy] = rotVec(dx, dy, -d.angle);
    const hd = d.handle, B = d.box;
    let x = B.x, y = B.y, w = B.w, h = B.h;
    if (hd.includes('e')) w = B.w + dx;
    if (hd.includes('w')) { w = B.w - dx; x = B.x + dx; }
    if (hd.includes('s')) h = B.h + dy;
    if (hd.includes('n')) { h = B.h - dy; y = B.y + dy; }
    if (snapOn && !d.angle) {
      const T = snapTargets(d.id), th = 6 / ui.z;
      if (hd.includes('e')) { const s = nearest([x + w], T.xs, th); if (s) { w += s.d; ui.guides.push(guideV(s.line, T, y, h)); } }
      if (hd.includes('w')) { const s = nearest([x], T.xs, th); if (s) { x += s.d; w -= s.d; ui.guides.push(guideV(s.line, T, y, h)); } }
      if (hd.includes('s')) { const s = nearest([y + h], T.ys, th); if (s) { h += s.d; ui.guides.push(guideH(s.line, T, x, w)); } }
      if (hd.includes('n')) { const s = nearest([y], T.ys, th); if (s) { y += s.d; h -= s.d; ui.guides.push(guideH(s.line, T, x, w)); } }
    }
    if (e.shiftKey && hd.length === 2 && B.w > 0 && B.h > 0) {
      const ratio = B.w / B.h;
      if (Math.abs(w / B.w) > Math.abs(h / B.h)) h = w / ratio; else w = h * ratio;
      if (hd.includes('w')) x = B.x + B.w - w;
      if (hd.includes('n')) y = B.y + B.h - h;
      ui.guides = [];
    }
    if (w < 1) { if (hd.includes('w')) x -= 1 - w; w = 1; }
    if (h < 1) { if (hd.includes('n')) y -= 1 - h; h = 1; }
    setSizeFromAbs(n, w, h);
    if (!B.listItem) setPosFromAbs(n, x, y, w, h);
  }
  layoutAll();
  renderScreen();
  renderOverlay();
  scheduleStatus();
}
function onPointerUp(e) {
  const d = ui.drag;
  if (!d || e.pointerId !== d.pointerId) return;
  ui.drag = null;
  ui.guides = [];
  if (d.active && record(d.before)) renderAll();
  else if (!d.active && d.clickId) select(d.clickId);
  else renderOverlay();
}
let statusQueued = false;
function scheduleStatus() {
  if (statusQueued) return;
  statusQueued = true;
  requestAnimationFrame(() => { statusQueued = false; renderStatus(); });
}

/* ---------- zoom around the cursor ---------- */
function zoomTo(z, clientX, clientY) {
  const cv = $('#canvas');
  const r = cv.getBoundingClientRect();
  const cx = clientX != null ? clientX : r.left + r.width / 2;
  const cy = clientY != null ? clientY : r.top + r.height / 2;
  const before = screenPoint({ clientX: cx, clientY: cy });
  ui.zoom = clamp(z, 0.1, 3);
  applyZoom();
  renderOverlay();
  const dr = $('#device').getBoundingClientRect();
  cv.scrollLeft += dr.left + before.x * ui.z - cx;
  cv.scrollTop += dr.top + before.y * ui.z - cy;
}

/* ---------- selection ---------- */
function select(id) {
  ui.sel = id;
  let p = id && node(id) ? node(id).parent : null;
  while (p) { ui.expanded.add(p); p = node(p).parent; }
  renderExplorer();
  renderProps();
  renderCode();
  renderOverlay();
  renderStatus();
  updateToolbar();
  const row = id && $(`.row[data-id="${id}"]`);
  if (row) row.scrollIntoView({ block: 'nearest' });
}

/* ---------- commands ---------- */
function firstScreenGui() { return kids(doc.rootId).find((n) => n.cls === 'ScreenGui'); }
function insertObject(cls) {
  mutate(() => {
    let parent;
    if (cls === 'ScreenGui') parent = node(doc.rootId);
    else {
      parent = node(ui.sel);
      while (parent && !canParent(cls, parent)) parent = node(parent.parent);
      if (!parent) parent = firstScreenGui();
      if (!parent) { parent = makeNode('ScreenGui', { Name: 'ScreenGui' }); attach(parent, doc.rootId); }
    }
    const n = makeNode(cls, cls === 'ScreenGui' ? { Name: 'ScreenGui' } : {});
    if (CLASSES[cls].kind === 'gui') {
      const area = L[parent.id] && L[parent.id].content ? L[parent.id].content : { x: 0, y: 0, w: DEVICES[ui.device].w, h: DEVICES[ui.device].h };
      const sz = sizeOf(n, area);
      const nudge = 12 * guiKids(parent.id).length % 96;
      n.props.Position = [0, Math.round(area.w / 2 - sz.w / 2 + nudge), 0, Math.round(area.h / 2 - sz.h / 2 + nudge)];
    }
    attach(n, parent.id);
    ui.sel = n.id;
    ui.expanded.add(parent.id);
  });
  select(ui.sel);
}
const MOD_DEFAULTS = { UIPadding: { PaddingTop: [0, 8], PaddingBottom: [0, 8], PaddingLeft: [0, 8], PaddingRight: [0, 8] }, UIStroke: { Thickness: 2 } };
function insertModifier(cls) {
  const target = node(ui.sel);
  if (!target || !canParent(cls, target)) {
    toast(cls === 'UIListLayout' ? 'Select a ScreenGui, Frame or other object to lay out its children.' : 'Select a Frame, label, button or image first.');
    return;
  }
  if (cls !== 'UIStroke') {
    const existing = modOf(target.id, cls);
    if (existing) { select(existing.id); toast(`${target.props.Name} already has a ${cls}.`); return; }
  }
  mutate(() => {
    const n = makeNode(cls, MOD_DEFAULTS[cls] || {});
    attach(n, target.id);
    ui.sel = n.id;
    ui.expanded.add(target.id);
  });
  select(ui.sel);
}
function deleteSelection() {
  const n = node(ui.sel);
  if (!n || n.id === doc.rootId) return;
  const parent = n.parent;
  const name = n.props.Name;
  mutate(() => { removeTree(n.id); ui.sel = parent === doc.rootId ? null : parent; });
  select(ui.sel);
  toast(`Deleted ${name}`);
}
function duplicateSelection() {
  const n = node(ui.sel);
  if (!n || n.id === doc.rootId) return;
  mutate(() => {
    const clip = cloneTree(n.id);
    const parent = node(n.parent);
    const id = pasteTree(clip, parent.id, parent.children.indexOf(n.id) + 1);
    const c = node(id);
    if (isGui(c)) { const P = c.props.Position; c.props.Position = [P[0], P[1] + 12, P[2], P[3] + 12]; }
    ui.sel = id;
  });
  select(ui.sel);
  toast('Duplicated ' + node(ui.sel).props.Name);
}
function copySelection(cut) {
  const n = node(ui.sel);
  if (!n || n.id === doc.rootId) return;
  ui.clipboard = cloneTree(n.id);
  if (cut) deleteSelection(); else toast('Copied ' + n.props.Name);
}
function pasteClipboard() {
  if (!ui.clipboard) return toast('Copy something first (Ctrl+C).');
  const clip = reIdClip(ui.clipboard);
  const cls = clip.nodes[clip.rootId].cls;
  let parent = node(ui.sel);
  while (parent && !canParent(cls, parent)) parent = node(parent.parent);
  if (!parent) parent = cls === 'ScreenGui' ? node(doc.rootId) : firstScreenGui();
  if (!parent) return toast('Add a ScreenGui first.');
  mutate(() => { ui.sel = pasteTree(clip, parent.id); ui.expanded.add(parent.id); });
  select(ui.sel);
}
function nudge(dx, dy) {
  const n = node(ui.sel);
  if (!isGui(n) || !L[n.id]) return;
  const b = L[n.id];
  if (b.listItem) return toast('A UIListLayout places this object. Change LayoutOrder to reorder it.');
  mutate(() => setPosFromAbs(n, b.x + dx, b.y + dy, b.w, b.h));
}
function convertUnits(toScale) {
  const n = node(ui.sel);
  if (!n || !(isGui(n) || n.cls === 'ScreenGui')) return toast('Select an object to convert.');
  let count = 0;
  mutate(() => {
    const walk = (id) => {
      const c = node(id);
      if (isGui(c) && L[id]) {
        const area = L[id].area, P = c.props.Position, S = c.props.Size;
        const pX = P[0] * area.w + P[1], pY = P[2] * area.h + P[3], sW = S[0] * area.w + S[1], sH = S[2] * area.h + S[3];
        if (toScale && area.w > 0 && area.h > 0) {
          c.props.Position = [roundTo(pX / area.w, 4), 0, roundTo(pY / area.h, 4), 0];
          c.props.Size = [roundTo(sW / area.w, 4), 0, roundTo(sH / area.h, 4), 0];
        } else if (!toScale) {
          c.props.Position = [0, Math.round(pX), 0, Math.round(pY)];
          c.props.Size = [0, Math.round(sW), 0, Math.round(sH)];
        }
        count++;
      }
      c.children.forEach(walk);
    };
    walk(n.id);
  });
  toast(`Rewrote ${count} object${count === 1 ? '' : 's'} as ${toScale ? 'Scale' : 'Offset'}. Switch devices to see the difference.`);
}
function setPreview(on) {
  ui.preview = on;
  ui.hover = null;
  const b = $('#btnPreview');
  b.classList.toggle('on', on);
  b.innerHTML = (on ? ICONS.stop : ICONS.play) + `<span class="wide-only">${on ? 'Stop preview' : 'Preview'}</span>`;
  renderViewport();
}

/* ---------- keyboard ---------- */
function onKeyDown(e) {
  const t = e.target;
  const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if ($('#modalRoot').firstChild) { if (e.key === 'Escape') closeModal(); return; }
  if (e.key === 'Escape' && document.querySelector('.menu')) { closeMenus(); return; }
  if (typing) return;
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (mod && k === 'c') { e.preventDefault(); copySelection(false); return; }
  if (mod && k === 'x') { e.preventDefault(); copySelection(true); return; }
  if (mod && k === 'v') { e.preventDefault(); pasteClipboard(); return; }
  if (mod) return;
  if (k === 'p') { setPreview(!ui.preview); return; }
  if (ui.preview) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.key === 'Escape') { const n = node(ui.sel); if (n && n.parent && n.parent !== doc.rootId) select(n.parent); else select(null); return; }
  if (e.key === 'F2' && ui.sel) { e.preventDefault(); startRename(ui.sel); return; }
  const step = e.shiftKey ? 10 : 1;
  const arrows = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
  if (arrows[k] && ui.sel) { e.preventDefault(); nudge(...arrows[k]); }
}
