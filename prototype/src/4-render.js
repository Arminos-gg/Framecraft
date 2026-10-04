/* ============================================================
   Layout engine: Roblox's UDim2 math, padding, list layouts
   ============================================================ */
let L = {};          // id -> layout box in screen pixels (Roblox AbsolutePosition/AbsoluteSize, rotation ignored)
const udimPx = (u, len) => u[0] * len + u[1];

function sizeOf(n, area) {
  const s = n.props.Size;
  let w = s[0] * area.w + s[1];
  let h = s[2] * area.h + s[3];
  const ar = modOf(n.id, 'UIAspectRatioConstraint');
  if (ar) { // FitWithinMaxSize: largest box of this ratio that fits inside Size
    const r = Math.max(0.01, +ar.props.AspectRatio || 1);
    if (h > 0 && w / h > r) w = h * r; else h = w / r;
  }
  return { w: Math.max(0, w), h: Math.max(0, h) };
}
function contentRectOf(n, box) {
  const pad = modOf(n.id, 'UIPadding');
  if (!pad) return { x: box.x, y: box.y, w: box.w, h: box.h };
  const P = pad.props;
  const l = udimPx(P.PaddingLeft, box.w), r = udimPx(P.PaddingRight, box.w);
  const t = udimPx(P.PaddingTop, box.h), b = udimPx(P.PaddingBottom, box.h);
  return { x: box.x + l, y: box.y + t, w: Math.max(0, box.w - l - r), h: Math.max(0, box.h - t - b) };
}
function placeFree(c, area) {
  const P = c.props;
  const { w, h } = sizeOf(c, area);
  const px = P.Position[0] * area.w + P.Position[1];
  const py = P.Position[2] * area.h + P.Position[3];
  L[c.id] = { x: area.x + px - P.AnchorPoint[0] * w, y: area.y + py - P.AnchorPoint[1] * h, w, h, rot: +P.Rotation || 0, visible: P.Visible !== false, area: { ...area }, listItem: false };
}
function layoutList(list, items, area) {
  const P = list.props;
  const vertical = P.FillDirection !== 'Horizontal';
  const shown = items.filter((c) => c.props.Visible !== false).map((c, i) => ({ c, i }));
  if (P.SortOrder === 'Name') shown.sort((a, b) => a.c.props.Name.localeCompare(b.c.props.Name, undefined, { numeric: true }) || a.i - b.i);
  else shown.sort((a, b) => (a.c.props.LayoutOrder - b.c.props.LayoutOrder) || a.i - b.i);
  const gap = udimPx(P.Padding, vertical ? area.h : area.w);
  const sizes = shown.map(({ c }) => sizeOf(c, area));
  const total = sizes.reduce((s, z) => s + (vertical ? z.h : z.w), 0) + gap * Math.max(0, sizes.length - 1);
  const mainLen = vertical ? area.h : area.w;
  const mainAlign = vertical ? P.VerticalAlignment : P.HorizontalAlignment;
  let cursor = mainAlign === 'Center' ? (mainLen - total) / 2 : (mainAlign === 'Bottom' || mainAlign === 'Right') ? mainLen - total : 0;
  shown.forEach(({ c }, k) => {
    const z = sizes[k];
    const crossLen = vertical ? area.w : area.h;
    const crossSize = vertical ? z.w : z.h;
    const crossAlign = vertical ? P.HorizontalAlignment : P.VerticalAlignment;
    const cross = crossAlign === 'Center' ? (crossLen - crossSize) / 2 : (crossAlign === 'Right' || crossAlign === 'Bottom') ? crossLen - crossSize : 0;
    L[c.id] = vertical
      ? { x: area.x + cross, y: area.y + cursor, w: z.w, h: z.h }
      : { x: area.x + cursor, y: area.y + cross, w: z.w, h: z.h };
    Object.assign(L[c.id], { rot: 0, visible: true, area: { ...area }, listItem: true });
    cursor += (vertical ? z.h : z.w) + gap;
  });
  items.filter((c) => c.props.Visible === false).forEach((c) => { placeFree(c, area); L[c.id].visible = false; L[c.id].listItem = true; });
}
function layoutChildren(pid, area) {
  const items = guiKids(pid);
  const list = modOf(pid, 'UIListLayout');
  if (list) layoutList(list, items, area);
  else items.forEach((c) => placeFree(c, area));
  for (const c of items) {
    const b = L[c.id];
    let base = b;
    if (CLASSES[c.cls].scroll) {
      const cs = c.props.CanvasSize;
      b.canvas = { x: b.x, y: b.y, w: Math.max(b.w, cs[0] * b.w + cs[1]), h: Math.max(b.h, cs[2] * b.h + cs[3]) };
      base = b.canvas;
    }
    b.content = contentRectOf(c, base);
    layoutChildren(c.id, b.content);
  }
}
function layoutAll() {
  const dev = DEVICES[ui.device];
  L = {};
  for (const sg of kids(doc.rootId)) {
    if (sg.cls !== 'ScreenGui') continue;
    const area = { x: 0, y: 0, w: dev.w, h: dev.h };
    const pad = modOf(sg.id, 'UIPadding');
    L[sg.id] = { x: 0, y: 0, w: dev.w, h: dev.h, rot: 0, visible: sg.props.Enabled !== false, content: pad ? contentRectOf(sg, area) : area };
    layoutChildren(sg.id, L[sg.id].content);
  }
}
/* Where a node really sits on screen, after its own and its ancestors' rotation */
function screenQuad(id) {
  const b = L[id];
  let cx = b.x + b.w / 2, cy = b.y + b.h / 2, angle = b.rot || 0;
  let p = node(id).parent;
  while (p && L[p] && isGui(node(p))) {
    const a = L[p];
    if (a.rot) {
      const ox = a.x + a.w / 2, oy = a.y + a.h / 2, r = a.rot * Math.PI / 180;
      const dx = cx - ox, dy = cy - oy;
      cx = ox + dx * Math.cos(r) - dy * Math.sin(r);
      cy = oy + dx * Math.sin(r) + dy * Math.cos(r);
      angle += a.rot;
    }
    p = node(p).parent;
  }
  return { cx, cy, w: b.w, h: b.h, angle };
}
function ancestorAngle(id) {
  let a = 0, p = node(id).parent;
  while (p && L[p] && isGui(node(p))) { a += L[p].rot || 0; p = node(p).parent; }
  return a;
}

/* ============================================================
   Renderer: the user's UI as real DOM, one element per object
   ============================================================ */
const ALIGN_X = { Left: 'flex-start', Center: 'center', Right: 'flex-end' };
const ALIGN_Y = { Top: 'flex-start', Center: 'center', Bottom: 'flex-end' };
const OBJECT_FIT = { Stretch: 'fill', Fit: 'contain', Crop: 'cover' };
const gradientCss = (g) => `linear-gradient(${90 + (+g.props.GradRotation || 0)}deg, ${rgb(g.props.GradColor[0])}, ${rgb(g.props.GradColor[1])})`;
const maskCss = (g) => `linear-gradient(${90 + (+g.props.GradRotation || 0)}deg, rgba(0,0,0,${roundTo(1 - g.props.GradTransparency[0], 3)}), rgba(0,0,0,${roundTo(1 - g.props.GradTransparency[1], 3)}))`;
const cornerPx = (corner, b) => clamp(udimPx(corner.props.CornerRadius, Math.min(b.w, b.h)), 0, Math.min(b.w, b.h) / 2);
const strokeOnText = (c, s) => !!CLASSES[c.cls].text && s.props.ApplyStrokeMode !== 'Border';
function textRing(th, color) { // an outline drawn as a ring of shadows
  const out = [];
  const n = th <= 1.5 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(`${roundTo(Math.cos(a) * th, 2)}px ${roundTo(Math.sin(a) * th, 2)}px 0 ${color}`);
  }
  return out.join(', ');
}
function makeText(c, b) {
  const P = c.props;
  const t = document.createElement('div');
  t.className = 'txt' + (P.TextWrapped ? ' wrap' : '');
  const ct = b.content;
  Object.assign(t.style, { left: ct.x - b.x + 'px', top: ct.y - b.y + 'px', width: ct.w + 'px', height: ct.h + 'px', justifyContent: ALIGN_X[P.TextXAlignment], alignItems: ALIGN_Y[P.TextYAlignment] });
  const sp = document.createElement('span');
  const isBox = !!CLASSES[c.cls].input;
  const ph = isBox && !P.Text;
  sp.textContent = ph && !ui.preview ? P.PlaceholderText : P.Text;
  const f = fontInfo(P.Font);
  Object.assign(sp.style, { fontFamily: f.family, fontWeight: f.weight, fontStyle: f.style, textAlign: P.TextXAlignment.toLowerCase(), color: rgba(ph && !ui.preview ? [178, 178, 178] : P.TextColor3, P.TextTransparency) });
  const strokes = kids(c.id).filter((k) => k.cls === 'UIStroke' && strokeOnText(c, k) && k.props.Thickness > 0);
  if (strokes.length) sp.style.textShadow = strokes.map((s) => textRing(+s.props.Thickness, rgba(s.props.Color, Math.max(s.props.Transparency, P.TextTransparency)))).join(', ');
  if (P.TextScaled) { t.dataset.fit = '1'; sp.style.fontSize = '10px'; } else sp.style.fontSize = P.TextSize + 'px';
  if (isBox && ui.preview) {
    sp.contentEditable = 'true';
    sp.spellcheck = false;
    sp.dataset.ph = P.PlaceholderText;
    t.style.pointerEvents = 'auto';
  }
  t.appendChild(sp);
  return t;
}
function makeImage(c) {
  const P = c.props;
  if (c.preview) {
    const img = new Image();
    img.className = 'pic';
    img.alt = '';
    img.src = c.preview;
    img.style.objectFit = OBJECT_FIT[P.ScaleType] || 'fill';
    img.style.opacity = roundTo(1 - P.ImageTransparency, 3);
    return img;
  }
  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.textContent = P.Image ? P.Image.replace(/^rbxassetid:\/\//, 'asset ') : 'no image';
  return ph;
}
function renderGui(c, origin) {
  const b = L[c.id], P = c.props, K = CLASSES[c.cls];
  const el = document.createElement('div');
  el.className = 'gui' + (K.button && P.AutoButtonColor ? ' btnlike' : '') + (K.scroll ? ' scroller' : '');
  el.dataset.id = c.id;
  const st = el.style;
  Object.assign(st, { left: b.x - origin.x + 'px', top: b.y - origin.y + 'px', width: b.w + 'px', height: b.h + 'px', zIndex: P.ZIndex });
  if (!b.visible) st.display = 'none';
  if (b.rot) st.transform = `rotate(${b.rot}deg)`;
  const grad = modOf(c.id, 'UIGradient');
  if (P.BackgroundTransparency < 1) {
    st.backgroundColor = rgba(P.BackgroundColor3, P.BackgroundTransparency);
    if (grad) { st.backgroundImage = gradientCss(grad); st.backgroundBlendMode = 'multiply'; }
  }
  const corner = modOf(c.id, 'UICorner');
  if (corner) st.borderRadius = cornerPx(corner, b) + 'px';
  const shadows = [];
  if (P.BorderSizePixel > 0 && !corner && P.BackgroundTransparency < 1) shadows.push(`0 0 0 ${P.BorderSizePixel}px ${rgba(P.BorderColor3, P.BackgroundTransparency)}`);
  kids(c.id).filter((k) => k.cls === 'UIStroke' && !strokeOnText(c, k) && k.props.Thickness > 0)
    .forEach((s) => shadows.push(`0 0 0 ${s.props.Thickness}px ${rgba(s.props.Color, s.props.Transparency)}`));
  if (shadows.length) st.boxShadow = shadows.join(', ');
  if (grad && (grad.props.GradTransparency[0] > 0 || grad.props.GradTransparency[1] > 0)) {
    const m = maskCss(grad);
    st.webkitMaskImage = m; st.maskImage = m;
  }
  if (P.ClipsDescendants || K.scroll) st.overflow = 'hidden';
  if (K.image) el.appendChild(makeImage(c));
  if (K.text) el.appendChild(makeText(c, b));
  const children = guiKids(c.id);
  if (children.length || K.scroll) {
    const box = document.createElement('div');
    box.className = 'content';
    if (K.scroll) {
      Object.assign(box.style, { left: 0, top: 0, width: b.w + 'px', height: b.h + 'px', overflow: ui.preview ? 'auto' : 'hidden' });
      const canvasEl = document.createElement('div');
      canvasEl.className = 'canvasbox';
      Object.assign(canvasEl.style, { width: b.canvas.w + 'px', height: b.canvas.h + 'px' });
      children.forEach((k) => canvasEl.appendChild(renderGui(k, { x: b.canvas.x, y: b.canvas.y })));
      box.appendChild(canvasEl);
    } else {
      Object.assign(box.style, { left: b.content.x - b.x + 'px', top: b.content.y - b.y + 'px', width: b.content.w + 'px', height: b.content.h + 'px' });
      children.forEach((k) => box.appendChild(renderGui(k, b.content)));
    }
    el.appendChild(box);
  }
  return el;
}
const fitCache = new Map();
function fitTexts(root) { // TextScaled: the largest whole size (max 100) that fits the box
  root.querySelectorAll('.txt[data-fit]').forEach((t) => {
    const sp = t.firstElementChild;
    const W = t.clientWidth, H = t.clientHeight;
    if (!sp || W <= 0 || H <= 0) return;
    const key = [sp.style.fontFamily, sp.style.fontWeight, sp.style.fontStyle, sp.textContent, W, H, t.className].join('|');
    let size = fitCache.get(key);
    if (size == null) {
      let lo = 1, hi = 100;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        sp.style.fontSize = mid + 'px';
        if (sp.scrollWidth <= W + 0.5 && sp.offsetWidth <= W + 0.5 && sp.offsetHeight <= H + 0.5) lo = mid; else hi = mid - 1;
      }
      size = lo;
      if (fitCache.size > 3000) fitCache.clear();
      fitCache.set(key, size);
    }
    sp.style.fontSize = size + 'px';
  });
}
function renderScreen() {
  const scr = $('#screen');
  scr.className = 'screen backdrop-' + ui.backdrop;
  scr.innerHTML = '';
  const guis = kids(doc.rootId).filter((n) => n.cls === 'ScreenGui').sort((a, b) => a.props.DisplayOrder - b.props.DisplayOrder);
  guis.forEach((sg, i) => {
    const layer = document.createElement('div');
    layer.className = 'sglayer';
    layer.dataset.id = sg.id;
    layer.style.cssText = `position:absolute;inset:0;z-index:${i + 1}`;
    if (sg.props.Enabled === false) layer.style.display = 'none';
    guiKids(sg.id).forEach((c) => layer.appendChild(renderGui(c, { x: 0, y: 0 })));
    scr.appendChild(layer);
  });
  fitTexts(scr);
}

/* ---------- viewport: zoom, device frame, selection overlay ---------- */
const PAD = 40;
function applyZoom() {
  const dev = DEVICES[ui.device];
  const cv = $('#canvas');
  const fit = Math.min((cv.clientWidth - PAD * 2) / dev.w, (cv.clientHeight - PAD * 2) / dev.h);
  ui.z = ui.zoom == null ? clamp(fit, 0.05, 2) : ui.zoom;
  const W = dev.w * ui.z, H = dev.h * ui.z;
  const innerW = Math.max(cv.clientWidth, W + PAD * 2), innerH = Math.max(cv.clientHeight, H + PAD * 2);
  const inner = $('#canvasInner');
  inner.style.width = innerW + 'px';
  inner.style.height = innerH + 'px';
  const left = Math.round((innerW - W) / 2), top = Math.round((innerH - H) / 2);
  const d = $('#device');
  Object.assign(d.style, { width: dev.w + 'px', height: dev.h + 'px', left: left + 'px', top: top + 'px', transform: `scale(${ui.z})` });
  const ov = $('#overlay');
  ov.style.left = left + 'px';
  ov.style.top = top + 'px';
  $('#zoomVal').textContent = Math.round(ui.z * 100) + '%';
}
function udimHtml(u) { // {0.5, 0},{0.5, 0} with scale teal and offset amber
  return `{<span class="s">${fmtNum(u[0])}</span>, <span class="o">${fmtNum(u[1], 0)}</span>},{<span class="s">${fmtNum(u[2])}</span>, <span class="o">${fmtNum(u[3], 0)}</span>}`;
}
function renderOverlay() {
  const ov = $('#overlay');
  ov.innerHTML = '';
  if (ui.preview) return;
  const z = ui.z;
  const boxAt = (id, cls) => {
    const q = screenQuad(id);
    const el = document.createElement('div');
    el.className = cls;
    Object.assign(el.style, { left: (q.cx - q.w / 2) * z + 'px', top: (q.cy - q.h / 2) * z + 'px', width: q.w * z + 'px', height: q.h * z + 'px' });
    if (q.angle) el.style.transform = `rotate(${q.angle}deg)`;
    ov.appendChild(el);
    return el;
  };
  const hov = node(ui.hover);
  if (hov && hov.id !== ui.sel && isGui(hov) && L[hov.id] && L[hov.id].visible) boxAt(hov.id, 'hoverbox');
  const n = node(ui.sel);
  if (isGui(n) && L[n.id] && L[n.id].visible) {
    const b = L[n.id];
    const box = boxAt(n.id, 'selbox' + (b.listItem ? ' locked' : ''));
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach((h) => {
      const hd = document.createElement('div');
      hd.className = 'handle';
      hd.dataset.h = h;
      hd.style.left = (h.includes('w') ? 0 : h.includes('e') ? 100 : 50) + '%';
      hd.style.top = (h.includes('n') ? 0 : h.includes('s') ? 100 : 50) + '%';
      box.appendChild(hd);
    });
    if (!b.listItem) {
      const a = document.createElement('div');
      a.className = 'anchor-dot';
      a.title = 'AnchorPoint';
      a.style.left = n.props.AnchorPoint[0] * 100 + '%';
      a.style.top = n.props.AnchorPoint[1] * 100 + '%';
      box.appendChild(a);
    }
    if (ui.drag && ui.drag.active) {
      const q = screenQuad(n.id);
      const r = document.createElement('div');
      r.className = 'readout';
      r.innerHTML = (b.listItem ? '' : `<span class="k">Position</span> ${udimHtml(n.props.Position)}<br>`) +
        `<span class="k">Size</span> ${udimHtml(n.props.Size)}<br><span class="k">${Math.round(b.w)} × ${Math.round(b.h)} px</span>`;
      r.style.left = (q.cx - q.w / 2) * z + 'px';
      r.style.top = ((q.cy + q.h / 2) * z + 10) + 'px';
      ov.appendChild(r);
    }
  }
  (ui.guides || []).forEach((g) => {
    const el = document.createElement('div');
    el.className = 'guide ' + g.t;
    if (g.t === 'v') Object.assign(el.style, { left: g.x * z + 'px', top: g.a * z + 'px', height: (g.b - g.a) * z + 'px' });
    else Object.assign(el.style, { top: g.y * z + 'px', left: g.a * z + 'px', width: (g.b - g.a) * z + 'px' });
    ov.appendChild(el);
  });
}
function renderStatus() {
  const s = $('#status');
  const n = node(ui.sel);
  const parts = [];
  if (isGui(n) && L[n.id]) {
    const b = L[n.id];
    parts.push(`<span>AbsolutePosition ${Math.round(b.x)}, ${Math.round(b.y)}</span>`, `<span>AbsoluteSize ${Math.round(b.w)} × ${Math.round(b.h)}</span>`);
  } else {
    const dev = DEVICES[ui.device];
    parts.push(`<span>Screen ${dev.w} × ${dev.h}</span>`);
  }
  if (ui.mouse) parts.push(`<span>Mouse ${Math.round(ui.mouse.x)}, ${Math.round(ui.mouse.y)}</span>`);
  const hint = ui.preview ? 'Preview: buttons react and text boxes take input. Press P or Preview to go back to editing.'
    : 'Drag to move · handles resize · Shift keeps proportions · arrows nudge · Ctrl+D duplicates';
  s.innerHTML = parts.join('') + `<span class="hint">${hint}</span>`;
}
function renderViewport() {
  layoutAll();
  applyZoom();
  renderScreen();
  renderOverlay();
  renderStatus();
  $('#app').classList.toggle('preview', ui.preview);
}
