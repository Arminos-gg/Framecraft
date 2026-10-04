'use strict';
/* ============================================================
   Framecraft prototype: core data model, class registry, history
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const roundTo = (v, d = 4) => { const m = 10 ** d; const r = Math.round(v * m) / m; return Object.is(r, -0) ? 0 : r; };
const fmtNum = (v, d = 4) => String(roundTo(v, d));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deep = (o) => JSON.parse(JSON.stringify(o));

/* ---------- icons ---------- */
const SVG = (inner, extra = '') => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${inner}</svg>`;
const ICONS = {
  file: SVG('<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/>'),
  undo: SVG('<path d="M7.5 5 4 8.5 7.5 12"/><path d="M4.5 8.5H12a4 4 0 0 1 0 8H9"/>'),
  redo: SVG('<path d="M12.5 5 16 8.5 12.5 12"/><path d="M15.5 8.5H8a4 4 0 0 0 0 8h3"/>'),
  tree: SVG('<rect x="3" y="3" width="5" height="4" rx="1"/><rect x="10" y="9" width="7" height="3.5" rx="1"/><rect x="10" y="14" width="7" height="3.5" rx="1"/><path d="M5.5 7v8.75H10M5.5 10.75H10"/>'),
  sliders: SVG('<path d="M3 6h14M3 14h14"/><circle cx="8" cy="6" r="2.2" fill="currentColor"/><circle cx="13" cy="14" r="2.2" fill="currentColor"/>'),
  play: SVG('<path d="M6 4.5v11l9-5.5z" fill="currentColor" stroke="none"/>'),
  stop: SVG('<rect x="5" y="5" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>'),
  export: SVG('<path d="M10 3v9M6.5 6.5 10 3l3.5 3.5"/><path d="M4 11v5.5h12V11"/>'),
  copy: SVG('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>'),
  download: SVG('<path d="M10 3v9.5M6.5 9 10 12.5 13.5 9"/><path d="M4 14.5V17h12v-2.5"/>'),
  upload: SVG('<path d="M10 13V3.5M6.5 7 10 3.5 13.5 7"/><path d="M4 13v4h12v-4"/>'),
  eye: SVG('<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>'),
  eyeOff: SVG('<path d="M3 3l14 14"/><path d="M8.2 4.8A8 8 0 0 1 10 4.5c5 0 8 5.5 8 5.5a14 14 0 0 1-2.4 3.1M5.4 6.3A14 14 0 0 0 2 10s3 5.5 8 5.5a7.6 7.6 0 0 0 3.2-.7"/>'),
  chevron: SVG('<path d="M7 4l6 6-6 6"/>', 'stroke-width="2.2"'),
  toScale: SVG('<path d="M5 15 15 5"/><circle cx="6" cy="6" r="2"/><circle cx="14" cy="14" r="2"/>'),
  toOffset: SVG('<rect x="2.5" y="6.5" width="15" height="7" rx="1.5"/><path d="M6 6.5v3M9.5 6.5v2M13 6.5v3"/>'),
  trash: SVG('<path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/>'),
  duplicate: SVG('<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7"/>'),
  plus: SVG('<path d="M10 4v12M4 10h12"/>'),
  reset: SVG('<path d="M4 10a6 6 0 1 0 2-4.5"/><path d="M4 3.5V7h3.5"/>'),
  blank: SVG('<rect x="4" y="3" width="12" height="14" rx="2"/><path d="M10 7.5v5M7.5 10h5"/>'),
  StarterGui: SVG('<path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.5l1.5 2H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/>'),
  ScreenGui: SVG('<rect x="2.5" y="3.5" width="15" height="10" rx="1.5"/><path d="M7 17h6M10 13.5V17"/>'),
  Frame: SVG('<rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/>'),
  TextLabel: SVG('<path d="M5 5h10M10 5v10"/>', 'stroke-width="2"'),
  TextButton: SVG('<rect x="2.5" y="5.5" width="15" height="9" rx="4.5"/><path d="M7.5 10h5"/>'),
  TextBox: SVG('<rect x="2.5" y="5.5" width="15" height="9" rx="1.5"/><path d="M6.5 8v4"/>'),
  ImageLabel: SVG('<rect x="3" y="3.5" width="14" height="13" rx="1.5"/><circle cx="7.5" cy="8" r="1.5"/><path d="M3.5 15l4.5-4.5 3 3 2-2 3.5 3.5"/>'),
  ImageButton: SVG('<rect x="3" y="3.5" width="14" height="13" rx="4"/><circle cx="7.5" cy="8" r="1.5"/><path d="M4 15l4-4 3 3 2-2 3 3"/>'),
  ScrollingFrame: SVG('<rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M13.5 3v14"/><path d="M15.3 6v3" stroke-width="2"/>'),
  UICorner: SVG('<path d="M4 16V9a5 5 0 0 1 5-5h7"/>', 'stroke-width="2"'),
  UIStroke: SVG('<rect x="3" y="3" width="14" height="14" rx="2"/><rect x="6" y="6" width="8" height="8" rx="1"/>'),
  UIGradient: SVG('<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3.5 13 13 3.5M7 16.5 16.5 7"/>'),
  UIPadding: SVG('<rect x="3" y="3" width="14" height="14" rx="2"/><rect x="6.5" y="6.5" width="7" height="7" rx="1" stroke-dasharray="2 1.6"/>'),
  UIListLayout: SVG('<rect x="3.5" y="3.5" width="13" height="3" rx="1"/><rect x="3.5" y="8.5" width="13" height="3" rx="1"/><rect x="3.5" y="13.5" width="13" height="3" rx="1"/>'),
  UIAspectRatioConstraint: SVG('<rect x="2.5" y="5" width="15" height="10" rx="1.5"/><path d="M6 12.5V7.5h3M14 7.5v5h-3"/>'),
};

/* ---------- fonts: Roblox Enum.Font names mapped to web look-alikes ---------- */
const FONTS = {
  SourceSans: ['Source Sans 3', 400], SourceSansLight: ['Source Sans 3', 300], SourceSansSemibold: ['Source Sans 3', 600],
  SourceSansBold: ['Source Sans 3', 700], SourceSansItalic: ['Source Sans 3', 400, 'italic'],
  Gotham: ['Montserrat', 400], GothamMedium: ['Montserrat', 500], GothamBold: ['Montserrat', 700], GothamBlack: ['Montserrat', 900],
  BuilderSans: ['Figtree', 400], BuilderSansMedium: ['Figtree', 500], BuilderSansBold: ['Figtree', 700], BuilderSansExtraBold: ['Figtree', 800],
  Arial: ['Arimo', 400], ArialBold: ['Arimo', 700],
  FredokaOne: ['Fredoka', 600], LuckiestGuy: ['Luckiest Guy', 400], Bangers: ['Bangers', 400], Arcade: ['Press Start 2P', 400],
  Oswald: ['Oswald', 400], Nunito: ['Nunito', 400], PermanentMarker: ['Permanent Marker', 400],
  Roboto: ['Roboto', 400], RobotoMono: ['Roboto Mono', 400], Code: ['Roboto Mono', 400],
  Ubuntu: ['Ubuntu', 400], Merriweather: ['Merriweather', 400],
};
const FONT_NAMES = Object.keys(FONTS);
function fontInfo(name) {
  const f = FONTS[name] || FONTS.SourceSans;
  const mono = /Mono/.test(f[0]) || f[0] === 'Press Start 2P';
  const serif = f[0] === 'Merriweather';
  const fallback = mono ? 'ui-monospace, monospace' : serif ? 'Georgia, serif' : 'system-ui, sans-serif';
  return { family: `"${f[0]}", ${fallback}`, weight: f[1], style: f[2] || 'normal', google: f[0] };
}

/* ---------- property schema (mirrors Roblox's own property names) ---------- */
const CAT_ORDER = ['Data', 'Transform', 'Appearance', 'Text', 'Image', 'Scrolling', 'Behavior', 'Corner', 'Stroke', 'Gradient', 'Padding', 'Layout', 'Constraint'];
const PROPS = {
  Name: { type: 'string', cat: 'Data' },
  LayoutOrder: { type: 'int', cat: 'Data' },
  Enabled: { type: 'bool', cat: 'Behavior' },
  DisplayOrder: { type: 'int', cat: 'Behavior' },
  ResetOnSpawn: { type: 'bool', cat: 'Behavior' },
  AnchorPoint: { type: 'vec2', cat: 'Transform' },
  Position: { type: 'udim2', cat: 'Transform' },
  Size: { type: 'udim2', cat: 'Transform' },
  Rotation: { type: 'number', cat: 'Transform', step: 1 },
  BackgroundColor3: { type: 'color', cat: 'Appearance' },
  BackgroundTransparency: { type: 'alpha', cat: 'Appearance' },
  BorderColor3: { type: 'color', cat: 'Appearance' },
  BorderSizePixel: { type: 'int', cat: 'Appearance', min: 0 },
  Visible: { type: 'bool', cat: 'Appearance' },
  ZIndex: { type: 'int', cat: 'Appearance' },
  ClipsDescendants: { type: 'bool', cat: 'Behavior' },
  AutoButtonColor: { type: 'bool', cat: 'Behavior' },
  Text: { type: 'string', cat: 'Text' },
  PlaceholderText: { type: 'string', cat: 'Text' },
  Font: { type: 'enum', cat: 'Text', options: FONT_NAMES },
  TextColor3: { type: 'color', cat: 'Text' },
  TextSize: { type: 'int', cat: 'Text', min: 1, max: 100 },
  TextScaled: { type: 'bool', cat: 'Text' },
  TextWrapped: { type: 'bool', cat: 'Text' },
  TextXAlignment: { type: 'enum', cat: 'Text', options: ['Left', 'Center', 'Right'] },
  TextYAlignment: { type: 'enum', cat: 'Text', options: ['Top', 'Center', 'Bottom'] },
  TextTransparency: { type: 'alpha', cat: 'Text' },
  Image: { type: 'image', cat: 'Image' },
  ImageColor3: { type: 'color', cat: 'Image' },
  ImageTransparency: { type: 'alpha', cat: 'Image' },
  ScaleType: { type: 'enum', cat: 'Image', options: ['Stretch', 'Fit', 'Crop'] },
  CanvasSize: { type: 'udim2', cat: 'Scrolling' },
  ScrollBarThickness: { type: 'int', cat: 'Scrolling', min: 0 },
  CornerRadius: { type: 'udim', cat: 'Corner' },
  Color: { type: 'color', cat: 'Stroke' },
  Thickness: { type: 'number', cat: 'Stroke', min: 0, step: 0.5 },
  Transparency: { type: 'alpha', cat: 'Stroke' },
  ApplyStrokeMode: { type: 'enum', cat: 'Stroke', options: ['Contextual', 'Border'] },
  GradColor: { type: 'colorseq', cat: 'Gradient', label: 'Color' },
  GradTransparency: { type: 'numseq', cat: 'Gradient', label: 'Transparency' },
  GradRotation: { type: 'number', cat: 'Gradient', label: 'Rotation', step: 1 },
  PaddingTop: { type: 'udim', cat: 'Padding' },
  PaddingBottom: { type: 'udim', cat: 'Padding' },
  PaddingLeft: { type: 'udim', cat: 'Padding' },
  PaddingRight: { type: 'udim', cat: 'Padding' },
  FillDirection: { type: 'enum', cat: 'Layout', options: ['Vertical', 'Horizontal'] },
  HorizontalAlignment: { type: 'enum', cat: 'Layout', options: ['Left', 'Center', 'Right'] },
  VerticalAlignment: { type: 'enum', cat: 'Layout', options: ['Top', 'Center', 'Bottom'] },
  Padding: { type: 'udim', cat: 'Layout' },
  SortOrder: { type: 'enum', cat: 'Layout', options: ['LayoutOrder', 'Name'] },
  AspectRatio: { type: 'number', cat: 'Constraint', min: 0.01, step: 0.05 },
};

const GUI_BASE = ['Name', 'LayoutOrder', 'AnchorPoint', 'Position', 'Size', 'Rotation', 'BackgroundColor3', 'BackgroundTransparency', 'BorderColor3', 'BorderSizePixel', 'Visible', 'ZIndex', 'ClipsDescendants'];
const TEXT_PROPS = ['Text', 'Font', 'TextColor3', 'TextSize', 'TextScaled', 'TextWrapped', 'TextXAlignment', 'TextYAlignment', 'TextTransparency'];
const IMAGE_PROPS = ['Image', 'ImageColor3', 'ImageTransparency', 'ScaleType'];
const GUI_DEFAULTS = {
  AnchorPoint: [0, 0], Position: [0, 0, 0, 0], Rotation: 0, BackgroundColor3: [255, 255, 255], BackgroundTransparency: 0,
  BorderColor3: [27, 42, 53], BorderSizePixel: 0, Visible: true, ZIndex: 1, LayoutOrder: 0, ClipsDescendants: false,
};
const TEXT_DEFAULTS = {
  Font: 'SourceSans', TextColor3: [0, 0, 0], TextSize: 14, TextScaled: false, TextWrapped: false,
  TextXAlignment: 'Center', TextYAlignment: 'Center', TextTransparency: 0,
};
const IMAGE_DEFAULTS = { Image: '', ImageColor3: [255, 255, 255], ImageTransparency: 0, ScaleType: 'Stretch' };

const CLASSES = {
  StarterGui: { kind: 'root', props: [], defaults: {} },
  ScreenGui: { kind: 'container', props: ['Name', 'Enabled', 'DisplayOrder', 'ResetOnSpawn'], defaults: { Enabled: true, DisplayOrder: 0, ResetOnSpawn: false } },
  Frame: { kind: 'gui', props: GUI_BASE, defaults: { ...GUI_DEFAULTS, Size: [0, 200, 0, 140] } },
  TextLabel: { kind: 'gui', text: true, props: [...GUI_BASE, ...TEXT_PROPS], defaults: { ...GUI_DEFAULTS, ...TEXT_DEFAULTS, Size: [0, 200, 0, 50], Text: 'Label' } },
  TextButton: { kind: 'gui', text: true, button: true, props: [...GUI_BASE, ...TEXT_PROPS, 'AutoButtonColor'], defaults: { ...GUI_DEFAULTS, ...TEXT_DEFAULTS, Size: [0, 200, 0, 50], Text: 'Button', AutoButtonColor: true } },
  TextBox: { kind: 'gui', text: true, input: true, props: [...GUI_BASE, ...TEXT_PROPS, 'PlaceholderText'], defaults: { ...GUI_DEFAULTS, ...TEXT_DEFAULTS, Size: [0, 200, 0, 50], Text: '', PlaceholderText: 'Type here' } },
  ImageLabel: { kind: 'gui', image: true, props: [...GUI_BASE, ...IMAGE_PROPS], defaults: { ...GUI_DEFAULTS, ...IMAGE_DEFAULTS, Size: [0, 100, 0, 100] } },
  ImageButton: { kind: 'gui', image: true, button: true, props: [...GUI_BASE, ...IMAGE_PROPS, 'AutoButtonColor'], defaults: { ...GUI_DEFAULTS, ...IMAGE_DEFAULTS, Size: [0, 100, 0, 100], AutoButtonColor: true } },
  ScrollingFrame: { kind: 'gui', scroll: true, props: [...GUI_BASE, 'CanvasSize', 'ScrollBarThickness'], defaults: { ...GUI_DEFAULTS, Size: [0, 240, 0, 200], CanvasSize: [0, 0, 2, 0], ScrollBarThickness: 12 } },
  UICorner: { kind: 'mod', props: ['Name', 'CornerRadius'], defaults: { CornerRadius: [0, 8] } },
  UIStroke: { kind: 'mod', props: ['Name', 'Color', 'Thickness', 'Transparency', 'ApplyStrokeMode'], defaults: { Color: [0, 0, 0], Thickness: 1, Transparency: 0, ApplyStrokeMode: 'Contextual' } },
  UIGradient: { kind: 'mod', props: ['Name', 'GradColor', 'GradTransparency', 'GradRotation'], defaults: { GradColor: [[255, 255, 255], [0, 0, 0]], GradTransparency: [0, 0], GradRotation: 0 } },
  UIPadding: { kind: 'mod', props: ['Name', 'PaddingTop', 'PaddingBottom', 'PaddingLeft', 'PaddingRight'], defaults: { PaddingTop: [0, 0], PaddingBottom: [0, 0], PaddingLeft: [0, 0], PaddingRight: [0, 0] } },
  UIListLayout: { kind: 'mod', layout: true, props: ['Name', 'FillDirection', 'HorizontalAlignment', 'VerticalAlignment', 'Padding', 'SortOrder'], defaults: { FillDirection: 'Vertical', HorizontalAlignment: 'Left', VerticalAlignment: 'Top', Padding: [0, 0], SortOrder: 'LayoutOrder' } },
  UIAspectRatioConstraint: { kind: 'mod', props: ['Name', 'AspectRatio'], defaults: { AspectRatio: 1 } },
};
const OBJECT_CLASSES = ['Frame', 'TextLabel', 'TextButton', 'TextBox', 'ImageLabel', 'ImageButton', 'ScrollingFrame'];
const MOD_CLASSES = ['UICorner', 'UIStroke', 'UIGradient', 'UIPadding', 'UIListLayout', 'UIAspectRatioConstraint'];
const SHORT = { TextLabel: 'Label', TextButton: 'Button', TextBox: 'TextBox', ImageLabel: 'Image', ImageButton: 'ImgButton', ScrollingFrame: 'Scroll', UIListLayout: 'List', UIAspectRatioConstraint: 'Aspect', UICorner: 'Corner', UIStroke: 'Stroke', UIGradient: 'Gradient', UIPadding: 'Padding' };
const isGui = (n) => !!n && CLASSES[n.cls].kind === 'gui';
const isMod = (n) => !!n && CLASSES[n.cls].kind === 'mod';
const iconClass = (cls) => ({ root: 'ico-root', container: 'ico-container', gui: 'ico-gui', mod: CLASSES[cls].layout ? 'ico-layout' : 'ico-mod' }[CLASSES[cls].kind]);

/* ---------- document ---------- */
let doc = null;
let idSeq = 1;
const newId = () => 'n' + (idSeq++).toString(36) + Math.random().toString(36).slice(2, 6);

function makeNode(cls, props = {}) {
  const def = deep(CLASSES[cls].defaults);
  return { id: newId(), cls, parent: null, children: [], props: { Name: cls, ...def, ...deep(props) } };
}
const node = (id) => doc.nodes[id];
const kids = (id) => (node(id) ? node(id).children.map(node).filter(Boolean) : []);
const guiKids = (id) => kids(id).filter(isGui);
const modOf = (id, cls) => kids(id).find((k) => k.cls === cls);

function canParent(childCls, parentNode) {
  if (!parentNode) return false;
  const pk = CLASSES[parentNode.cls].kind, ck = CLASSES[childCls].kind;
  if (ck === 'container') return pk === 'root';
  if (ck === 'gui') return pk === 'container' || pk === 'gui';
  if (ck === 'mod') {
    if (childCls === 'UIListLayout') return pk === 'gui' || pk === 'container';
    return pk === 'gui';
  }
  return false;
}
function isAncestor(aId, bId) { // is a an ancestor of b?
  let p = node(bId) && node(bId).parent;
  while (p) { if (p === aId) return true; p = node(p).parent; }
  return false;
}
function attach(n, parentId, index) {
  const p = node(parentId);
  n.parent = parentId;
  doc.nodes[n.id] = n;
  if (index == null || index > p.children.length) p.children.push(n.id);
  else p.children.splice(index, 0, n.id);
}
function detach(id) {
  const n = node(id); if (!n || !n.parent) return;
  const p = node(n.parent);
  p.children = p.children.filter((c) => c !== id);
}
function removeTree(id) {
  const n = node(id); if (!n) return;
  n.children.slice().forEach(removeTree);
  detach(id);
  delete doc.nodes[id];
}
function cloneTree(id) { // returns a detached subtree: {rootId, nodes}
  const out = {};
  const walk = (oid, parentNew) => {
    const o = node(oid);
    const c = { id: newId(), cls: o.cls, parent: parentNew, children: [], props: deep(o.props) };
    if (o.preview) c.preview = o.preview;
    out[c.id] = c;
    c.children = o.children.map((k) => walk(k, c.id));
    return c.id;
  };
  const rootId = walk(id, null);
  return { rootId, nodes: out };
}
function pasteTree(clip, parentId, index) {
  Object.values(clip.nodes).forEach((n) => { doc.nodes[n.id] = n; });
  const r = clip.nodes[clip.rootId];
  r.parent = parentId;
  const p = node(parentId);
  if (index == null) p.children.push(r.id); else p.children.splice(index, 0, r.id);
  return r.id;
}
function reIdClip(clip) { // fresh ids so one clipboard can be pasted many times
  const map = {};
  Object.keys(clip.nodes).forEach((k) => { map[k] = newId(); });
  const nodes = {};
  Object.values(clip.nodes).forEach((n) => {
    nodes[map[n.id]] = { ...deep(n), id: map[n.id], parent: n.parent ? map[n.parent] : null, children: n.children.map((c) => map[c]) };
    if (n.preview) nodes[map[n.id]].preview = n.preview;
  });
  return { rootId: map[clip.rootId], nodes };
}
function screenGuiOf(id) {
  let n = node(id);
  while (n && n.cls !== 'ScreenGui') n = node(n.parent);
  return n || null;
}
function validDoc(d) {
  return d && d.nodes && d.rootId && d.nodes[d.rootId] && Object.values(d.nodes).every((n) => n && CLASSES[n.cls] && Array.isArray(n.children) && n.props);
}
function normalizeDoc(d) { // fill properties that older files may lack
  Object.values(d.nodes).forEach((n) => { n.props = { ...deep(CLASSES[n.cls].defaults), ...n.props }; });
  return d;
}

/* ---------- sample project: a game main menu ---------- */
function buildSample() {
  const d = { nodes: {}, rootId: 'root', version: 1 };
  d.nodes.root = { id: 'root', cls: 'StarterGui', parent: null, children: [], props: { Name: 'StarterGui' } };
  const saved = doc; doc = d;
  const add = (parent, cls, props) => { const n = makeNode(cls, props); attach(n, parent); return n.id; };

  const sg = add('root', 'ScreenGui', { Name: 'MainMenu' });

  const coins = add(sg, 'Frame', { Name: 'Coins', AnchorPoint: [1, 0], Position: [1, -20, 0, 20], Size: [0, 176, 0, 52], BackgroundColor3: [22, 24, 38], BackgroundTransparency: 0.12 });
  add(coins, 'UICorner', { CornerRadius: [0.5, 0] });
  add(coins, 'UIStroke', { Color: [255, 204, 77], Thickness: 2, Transparency: 0.25 });
  const icon = add(coins, 'Frame', { Name: 'CoinIcon', AnchorPoint: [0, 0.5], Position: [0, 10, 0.5, 0], Size: [0, 34, 0, 34], BackgroundColor3: [255, 201, 60] });
  add(icon, 'UICorner', { CornerRadius: [0.5, 0] });
  add(icon, 'UIGradient', { GradColor: [[255, 255, 255], [222, 158, 30]], GradRotation: 90 });
  add(icon, 'UIStroke', { Color: [168, 104, 8], Thickness: 2 });
  add(coins, 'TextLabel', { Name: 'Amount', Position: [0, 54, 0, 0], Size: [1, -68, 1, 0], BackgroundTransparency: 1, Text: '12,450', Font: 'GothamBold', TextSize: 24, TextColor3: [255, 255, 255], TextXAlignment: 'Left' });

  const panel = add(sg, 'Frame', { Name: 'Panel', AnchorPoint: [0.5, 0.5], Position: [0.5, 0, 0.5, 0], Size: [0.34, 0, 0.72, 0], BackgroundColor3: [19, 21, 33], BackgroundTransparency: 0.06 });
  add(panel, 'UICorner', { CornerRadius: [0, 18] });
  add(panel, 'UIStroke', { Color: [255, 255, 255], Thickness: 1.5, Transparency: 0.84 });
  add(panel, 'UIPadding', { PaddingTop: [0, 24], PaddingBottom: [0, 24], PaddingLeft: [0, 24], PaddingRight: [0, 24] });
  const title = add(panel, 'TextLabel', { Name: 'Title', Size: [1, 0, 0.2, 0], BackgroundTransparency: 1, Text: 'SKY RAIDERS', Font: 'LuckiestGuy', TextScaled: true, TextColor3: [255, 214, 92] });
  add(title, 'UIStroke', { Color: [92, 44, 0], Thickness: 3 });
  add(panel, 'TextLabel', { Name: 'Subtitle', Position: [0, 0, 0.2, 6], Size: [1, 0, 0.05, 0], BackgroundTransparency: 1, Text: 'Season 3 · Storm Front', Font: 'GothamMedium', TextScaled: true, TextColor3: [168, 176, 204] });
  const buttons = add(panel, 'Frame', { Name: 'Buttons', AnchorPoint: [0, 1], Position: [0, 0, 1, 0], Size: [1, 0, 0.62, 0], BackgroundTransparency: 1 });
  add(buttons, 'UIListLayout', { FillDirection: 'Vertical', HorizontalAlignment: 'Center', VerticalAlignment: 'Bottom', Padding: [0.05, 0], SortOrder: 'LayoutOrder' });
  const mkBtn = (name, order, text, bg, fg) => {
    const b = add(buttons, 'TextButton', { Name: name, LayoutOrder: order, Size: [1, 0, 0.28, 0], BackgroundColor3: bg, Text: text, Font: 'GothamBlack', TextScaled: true, TextColor3: fg });
    add(b, 'UICorner', { CornerRadius: [0, 12] });
    add(b, 'UIPadding', { PaddingTop: [0.26, 0], PaddingBottom: [0.26, 0] });
    add(b, 'UIGradient', { GradColor: [[255, 255, 255], [206, 212, 226]], GradRotation: 90 });
  };
  mkBtn('PlayButton', 1, 'PLAY', [72, 199, 102], [255, 255, 255]);
  mkBtn('ShopButton', 2, 'SHOP', [64, 132, 245], [255, 255, 255]);
  mkBtn('SettingsButton', 3, 'SETTINGS', [58, 63, 86], [226, 230, 244]);

  add(sg, 'TextLabel', { Name: 'Version', AnchorPoint: [0, 1], Position: [0, 18, 1, -14], Size: [0, 260, 0, 20], BackgroundTransparency: 1, Text: 'v0.1 · made with Framecraft', Font: 'SourceSans', TextSize: 16, TextColor3: [255, 255, 255], TextTransparency: 0.3, TextXAlignment: 'Left' });

  doc = saved;
  return d;
}
function blankDoc() {
  const d = { nodes: {}, rootId: 'root', version: 1 };
  d.nodes.root = { id: 'root', cls: 'StarterGui', parent: null, children: [], props: { Name: 'StarterGui' } };
  const saved = doc; doc = d;
  attach(makeNode('ScreenGui', { Name: 'ScreenGui' }), 'root');
  doc = saved;
  return d;
}

/* ---------- editor state ---------- */
const DEVICES = {
  laptop: { label: 'Laptop · 1366×768', w: 1366, h: 768 },
  hd: { label: 'Desktop · 1920×1080', w: 1920, h: 1080 },
  tablet: { label: 'Tablet · 1024×768', w: 1024, h: 768 },
  phoneL: { label: 'Phone landscape · 844×390', w: 844, h: 390 },
  phoneP: { label: 'Phone portrait · 390×844', w: 390, h: 844 },
};
const ui = {
  sel: null, hover: null, expanded: new Set(['root']), device: 'laptop', zoom: null, backdrop: 'game',
  unit: 'auto', snap: true, preview: false, tab: 'props', codeLang: 'luau', luauTarget: 'command',
  clipboard: null, closedCats: new Set(), openUdim: new Set(), renaming: null, drag: null,
};

/* ---------- history (snapshots) + autosave ---------- */
const hist = { undo: [], redo: [] };
const STORE_KEY = 'framecraft:project:v1';
const snapshot = () => JSON.stringify(doc);
let saveTimer = 0;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, snapshot()); } catch (e) { /* storage unavailable: autosave is a convenience */ } }, 400);
}
function loadSaved() {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return validDoc(d) ? normalizeDoc(d) : null;
  } catch (e) { return null; }
}
function record(before) {
  if (before === snapshot()) return false;
  hist.undo.push(before);
  if (hist.undo.length > 150) hist.undo.shift();
  hist.redo = [];
  scheduleSave();
  return true;
}
function mutate(fn) { // run a change as one undo step, then redraw
  const before = snapshot();
  const result = fn();
  record(before);
  renderAll();
  return result;
}
function restore(json) {
  doc = JSON.parse(json);
  if (ui.sel && !node(ui.sel)) ui.sel = null;
  scheduleSave();
  renderAll();
}
function undo() { if (!hist.undo.length) return toast('Nothing to undo'); hist.redo.push(snapshot()); restore(hist.undo.pop()); }
function redo() { if (!hist.redo.length) return toast('Nothing to redo'); hist.undo.push(snapshot()); restore(hist.redo.pop()); }

/* ---------- small helpers ---------- */
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const rgba = (c, t = 0) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${roundTo(1 - clamp(t, 0, 1), 3)})`;
const hex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fromHex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (!m) return null; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}
