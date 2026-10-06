# Handover: prototype to real codebase

Written 2026-10-05, at the end of the session that produced the plan and the prototype.

## Kickoff prompt

Paste this into Claude Code as the first message:

> Read CLAUDE.md and docs/HANDOVER.md. Then run `npm install`, `npx playwright install chromium`, `npm run build` and `npm test`, and tell me what passed. After that, propose a plan for step 1 of "For Claude Code" in HANDOVER.md (scaffold the Vite + TypeScript app) and wait for my OK before writing code.

## Where things stand

- **Plan:** `docs/PLAN.md`. The live version is a Claude Doc at https://claude.ai/code/artifact/f3841492-bcbd-409d-913e-f9982b6ad143
- **App:** the Vite + TypeScript editor at the repo root (`npm run dev`). Vercel builds a preview of every branch.
- **Prototype:** retired in step 7 after the app reached parity. It is in git history (`git show c9caac6:prototype/`) and still runs as a claude.ai artifact at https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT, which no longer gets updates.
- Both links are private to Armin's claude.ai account. Claude Code can't open them, and everything it needs is in this repo.

### Verified

`npm test` passed all 21 checks on 2026-10-05 (Playwright 1.56.0, Chromium 141):

- Exports of the untouched sample match the golden files, and both Luau variants parse.
- Layout numbers at Laptop 1366×768: Panel at 450.78, 107.52 sized 464.44 × 552.96; Coins at x 1170; CoinIcon at 1180, 29; Buttons at y 323.40; list items at y 342.19, 445.50 and 548.82.
- Dragging, resizing, click-to-select-child, undo, Studio shorthand input, To Scale, Explorer drag-to-reparent and preview mode.
- No page errors, and no sideways scrolling at 400 px wide.
- The exported HTML page places the Panel within 0.03 px of the editor.

### Not verified yet

- **The Luau has never run in Roblox Studio.** It only passed a syntax check. This is the most important open check (see "For you" below).
- Firefox and Safari. Tests ran in Chromium only.
- Real users. Nobody outside this session has tried the prototype.

## Decisions so far

| Decision | Why | Revisit when |
| --- | --- | --- |
| "Framecraft" is a working name | Needed something to call it | Before any public launch |
| Use Roblox's class and property names everywhere | Users already know them from Studio | Never |
| Lead with web output, keep the Roblox export | At least five tools already export Roblox UI; none builds web UI the Studio way | After the user tests (Roadmap, first gate) |
| One plain-JSON document; panels change it only through commands | Undo, exports and later multiplayer stay consistent | No plan to change |
| DOM renderer driven by our own layout engine | Real text and fonts, and the same output as the HTML export | If documents with 1,000+ objects get slow |
| Export Luau with `IgnoreGuiInset = true` | The editor treats the ScreenGui as the full screen | If we add a top-bar or safe-area preview |
| Snapshot undo (whole-document JSON strings) | Simplest thing that works for a prototype | Done in the port: `src/model/` uses commands with inverses |
| UIGradient props stored as `GradColor`, `GradTransparency`, `GradRotation` | One global property schema couldn't hold two different `Color` types | Done in the port: per-class schemas use Color, Transparency and Rotation; version 1 files are converted on open |
| One project holds both Roblox screens and a website: a DataModel root with StarterGui and Site | Pages reuse the same objects, layout and editor; the Luau export skips the web-only parts | If people never mix the two in one project |
| Changes per breakpoint are stored on each object, keyed by a Breakpoint object (Tablet up to 1199 px, Phone up to 809 px) | Breakpoints get undo and renaming for free, and `resolveProps` is the one place values are worked out | If we add hover or other states, which may need the same mechanism |
| Images live in a library next to the document, referenced by id | The document stays small enough to compare and undo; a picture used twice is stored once | When projects with pictures outgrow the autosave (see below) |
| The viewport shows the Roblox screens or one page, and a page shown at Tablet or Phone edits that breakpoint | What you see is what you change, and Desktop stays the base everything starts from | If people want to change the base while looking at a phone |
| Editor state lives in an `Editor` class outside React, read with `useSyncExternalStore` | Gestures and shortcuts are plain methods that unit tests drive without a browser | If the panels need finer-grained updates |
| The new app opens with both samples, the game menu and the coffee site | Both halves can be tried before New and Open exist | Done in step 6: the first visit opens the samples, later visits the autosave; the Project menu has New website, New Roblox UI and Open the sample project |
| Autosave writes the project file to `localStorage` once edits pause, and the app bar says Saved, or Not saved when the browser refuses | Simple, synchronous, and the same text as a project file | When a project with pictures passes about 5 MB: move it to IndexedDB |
| Fields commit on Enter or blur; Escape puts the value back. A UDim2 shows as colored text and turns into a shorthand field on click, with X and Y Scale and Offset fields one click away | Studio users type shorthand; the split fields teach Scale and Offset | If user tests show people miss the split fields |
| On a page shown at Tablet or Phone, only overridable properties (layout, size, visibility, text size, colors) change for that breakpoint; the rest change everywhere, and a banner says so | Matches `resolveProps` and keeps text and names the same on every device | If people want different text per device |
| The Code tab shows Luau for the selection, or the HTML file it ends up in with its element marked; it defaults to HTML on pages and Luau on screens | Each export is what the user would paste or upload | When the HTML export can write one element's CSS on its own |

## Known gaps in the prototype

The app inherited these from the prototype. Step 6 closed one of them: the Explorer has keyboard navigation now.

Layout and rendering

- UIListLayout flex features (HorizontalFlex, VerticalFlex, Wraps, UIFlexItem) are not modeled.
- UIAspectRatioConstraint only does FitWithinMaxSize; AspectType and DominantAxis are ignored.
- UIGradient has two stops, Linear only, and tints the background only. Roblox also tints text and images. Offset, Scale and TileMode are missing.
- UIStroke is drawn outside the box with `box-shadow`, and text outlines are approximated with a ring of text-shadows. BorderStrokePosition, LineJoinMode and StrokeSizingMode are missing.
- Missing classes: UIShadow, UISizeConstraint, UITextSizeConstraint, UIGridLayout, UIPageLayout, per-corner UICorner radii, SurfaceGui, BillboardGui.
- Missing properties: RichText, LineHeight, TextTruncate, ImageColor3 tint (stored and exported, not drawn), BorderMode (Outline assumed; the legacy border hides when a UICorner exists).
- ScrollingFrame can't scroll in edit mode (no CanvasPosition), the scrollbar isn't drawn, and AutomaticCanvasSize is missing.
- TextScaled is approximated by fitting text in the browser (whole sizes, max 100).
- Resizing a rotated object doesn't keep the opposite edge fixed on screen, and snapping is off for rotated objects.
- No safe-area or top-bar overlay.

Editing

- Single selection only: no marquee, align and distribute, lock or groups.
- The Explorer has no keyboard navigation, which is an accessibility gap.
- Copy and paste use an in-page clipboard, not the system clipboard.
- Undo history is lost on reload. The project itself autosaves to localStorage.

Exports

- No .rbxmx export and no import from Studio.
- The HTML export needs a small inline script for Scale corner radii, aspect ratios and TextScaled.

## Next steps

### For you (needs a PC or Mac with Roblox Studio)

1. Open a new Baseplate in Studio, set the device emulator to 1366×768, paste `tests/golden/sample-menu.luau` into the command bar and press Enter.
2. Compare it with the editor at "Laptop · 1366×768". Write every difference into a new `docs/STUDIO_DIFFS.md`, with a screenshot of each side. Claude Code can fix the exporter from that list.
3. Run the user tests from the Roadmap in `docs/PLAN.md`. Their result decides which export gets polished first.
4. Check AutomaticSize against Studio: whether a TextLabel that doesn't wrap still grows on Y (the editor grows it to its lines), whether wrapped text grows on X only as wide as its parent before it wraps, and what Scale in children and in a UIPadding is measured against (the editor uses the object's Size). See "Public beta" below.

### For Claude Code: Phase 2, port to a real codebase

`prototype/` was the reference until the new app reached parity in step 7. The suggested layout for the new code was:

```
src/
  model/     classes.ts (registry), document.ts, commands.ts (undo/redo), assets.ts (images)
  layout/    layout.ts (pure functions)
  export/    luau.ts, html.ts, json.ts
  render/    canvas.ts (DOM renderer), overlay.ts
  editor/    interactions.ts (drag, resize, snap), keyboard.ts
  ui/        Explorer, Properties, Ribbon, ExportDialog (React components)
tests/       Vitest unit tests and Playwright end-to-end tests
```

1. **Scaffold.** Vite, TypeScript (strict), React for the panels, Vitest, Playwright, ESLint and Prettier. Done when `npm run dev` serves an empty editor shell and `npm test` runs both the unit tests and the existing prototype smoke test.
2. **Model.** A typed class registry with per-class property schemas, so UIGradient uses its real names (Color, Transparency, Rotation). Document types, plus commands with undo and redo instead of snapshots. Done when unit tests cover insert, delete, reparent, property edits, undo and redo. Website follow-up, also done: the DataModel root with StarterGui and Site, Page and Breakpoint classes, changes per breakpoint read through `resolveProps`, the image library, Link values, and project file version 3, which still opens version 1 and 2 files. From here on, each step also builds its website part (findings: https://claude.ai/code/artifact/d0980ca9-4396-4ec4-b9a6-b7b0784430c8).
3. **Layout engine.** A pure function from document and screen size to boxes. Done when unit tests reproduce every number under "Verified" above, plus edge cases: AnchorPoint (1, 1), negative offsets, Scale padding, list alignment Center and Right, horizontal lists, aspect ratios and invisible list items. Done in `src/layout/`: every box of the sample menu matches the prototype on all five device presets. Website part, also done: pages are window-wide, Scale inside them is a fraction of the window, the page grows to fit its content, and layout reads each object's values at the current breakpoint.
4. **Exporters.** Luau, HTML and JSON as pure functions. Done when the output for the sample project is byte-identical to `prototype/examples/` (or every difference is intentional and explained) and the Luau parses with luaparse. Roblox part done in `src/export/`: the Luau (both targets) and HTML for the sample menu are byte-identical to the goldens. The project file is version 3 now, so it differs from `sample-project.json` on purpose (see step 2). Website part, also done: `exportSite` writes an HTML file per page (`/pricing` is `pricing/index.html`, NotFound is `404.html`) and the pictures it uses, with each breakpoint's changes as media queries. Objects gained web-only Link, HtmlTag and AltText. A Playwright test checks that every exported page matches the layout engine at desktop, tablet and phone widths. Still at the base values on every breakpoint: Scale corner radii under 0.5, aspect ratios and TextScaled.
5. **Renderer and interactions.** DOM canvas, selection overlay with handles and the AnchorPoint dot, drag, resize, smart snapping, nudge, zoom and device presets. Done when Playwright tests cover the same interactions as `tests/smoke.mjs`. Done in `src/editor/` and `src/ui/viewport/`: `tests/e2e/canvas.spec.ts` covers select, drag (Offset stays Offset), resize, click-to-select-child, undo and redo, preview, devices and phone width, plus snapping, nudging, zoom and the keyboard (delete, duplicate, copy, paste). The Properties and Explorer parts of the smoke test (shorthand input, To Scale, drag-to-reparent) belong to step 6. Website part, also done: the viewport shows the Roblox screens or one page; a page shows Desktop, Tablet or Phone and edits that breakpoint's values; pages are drawn as long as their content, with a line where the first screen ends; and links work in preview.
6. **Panels.** Explorer with drag-to-reparent, rename and keyboard navigation; Properties with typed editors and Studio shorthand; ribbon; export dialog; Code tab. Done when every Properties editor type has a test. Done in `src/ui/` and `src/editor/`, in the editor design's look (light and dark): `tests/e2e/panels.spec.ts` edits every value type (string, int, number, bool, enum, alpha, color, vec2, udim, udim2, image, colorseq, numseq, asset, link) and covers the rest of the smoke test (shorthand input, To Scale, drag-to-reparent), plus rename, the Explorer keys, insert menus, the Code tab, export downloads and project files. Website part, also done: on a page shown at Tablet or Phone, Properties edits that breakpoint (a dot marks values changed there, and clicking it goes back to the inherited value); Link, HtmlTag and AltText show only for objects on a page; pages and pictures (preview, favicon, social image) can be added from the panels; the export dialog downloads the site as `website.zip`. The Project menu starts a new website or Roblox UI, opens the sample, and opens and saves project files; the project autosaves in the browser.
7. **Parity and cleanup.** Walk through the prototype side by side, fix gaps, then move `prototype/` to `legacy/` or delete it. Parity checked: the sample menu renders the same as the prototype on every device (only sub-pixel text differences), every class has the prototype's properties, defaults and options (plus the web-only ones), and its editing behaviors work in the new app. The walkthrough found two gaps. Ctrl+Z with nothing to undo said nothing (the prototype shows a message), and the exported HTML page, in both apps, read sizes in whole pixels, so aspect ratios and Scale corners were up to half a pixel off. `tests/e2e/html-export.spec.ts` now checks every exported object against the layout engine on every device, and new browser tests cover what only the prototype's smoke test did (cut, Escape, Shift-resize, reordering in the Explorer, preview typing and scrolling). Cleanup, also done: Armin chose to delete `prototype/` rather than keep a `legacy/` copy that nothing would test. Its smoke test went with it, the golden exports moved to `tests/golden/`, and `npm run update-golden` rewrites them from the app.

### Public beta

After Phase 2 comes the public beta: templates, share links, side-by-side devices, the live code view, .rbxmx export and an accessibility pass. Armin picked templates first, then asked for AutomaticSize.

1. **Templates.** Done. "New from a template…" in the Project menu shows three websites (landing page, portfolio, link in bio) and four Roblox screens (shop, inventory, settings, HUD), each previewed by the viewport's own Stage. They are built in code in `src/model/templates/` with the `Builder` the samples use (`src/model/builder.ts`), so every edit goes through the same commands as the editor. The websites set Tablet and Phone values (stacked cards, smaller headlines, a hidden nav); the Roblox screens are sized in Scale with UIAspectRatioConstraints, so they fit every device. `tests/unit/model/templates.test.ts` checks each one is valid, survives a project file, stays on screen (or inside the window's width) on every device, and exports Luau that parses; the export browser tests check every template's HTML against the layout engine. The templates size text boxes by hand for line height 1, so long edits to template text may need taller boxes until they use AutomaticSize.
2. **AutomaticSize.** Done. Every object except a ScrollingFrame has AutomaticSize (None, X, Y or XY), right after Size in Properties, and it can differ per breakpoint. The layout engine grows the box to fit its content, and Size is the smallest it gets. Text counts by its bounds: wrapped at the box's width when TextWrapped is on, and on X growing only as wide as the parent before it wraps. A UIListLayout counts its items and gaps, free-placed children count to their far edge (AnchorPoint included, nothing above or left of the box), and UIPadding is added. The content is measured with the box at its Size, width first; then the children are placed in the grown box, so a child sized in Scale stretches with it. TextScaled text and hidden children don't count, and an empty TextBox counts its placeholder. Text is measured by the browser with the same styles the Stage and the exports draw with (`src/ui/viewport/text-measure.ts`), and again once web fonts load; Node tests use the estimate in `src/layout/text.ts`. The Luau export writes `AutomaticSize`. The HTML exports mark these objects with `data-auto` and a `--auto` CSS variable, which media queries can change, and the inline script grows them the same way and then lengthens the page. `tests/e2e/auto-size.spec.ts` checks every box of a screen and a site full of growing objects against the engine measuring text in the same page. Still missing: AutomaticCanvasSize, LineHeight and UISizeConstraint.

## The published prototype

The claude.ai artifact at https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT is a frozen copy of the prototype. The repo no longer builds it. If it ever needs an update, `git checkout c9caac6 -- prototype` brings the source back and `node prototype/build.mjs` writes `prototype/dist/framecraft.artifact.html`, the body-only version the artifact uses.
