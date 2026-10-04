# Handover: prototype to real codebase

Written 2026-10-05, at the end of the session that produced the plan and the prototype.

## Kickoff prompt

Paste this into Claude Code as the first message:

> Read CLAUDE.md and docs/HANDOVER.md. Then run `npm install`, `npx playwright install chromium`, `npm run build` and `npm test`, and tell me what passed. After that, propose a plan for step 1 of "For Claude Code" in HANDOVER.md (scaffold the Vite + TypeScript app) and wait for my OK before writing code.

## Where things stand

- **Plan:** `docs/PLAN.md`. The live version is a Claude Doc at https://claude.ai/code/artifact/f3841492-bcbd-409d-913e-f9982b6ad143
- **Prototype:** `prototype/dist/framecraft.html` (open it in a browser). It is also published as a claude.ai artifact at https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT
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
| Snapshot undo (whole-document JSON strings) | Simplest thing that works for a prototype | During the port: switch to commands or patches |
| UIGradient props stored as `GradColor`, `GradTransparency`, `GradRotation` | One global property schema couldn't hold two different `Color` types | During the port: per-class schemas with the real names |

## Known gaps in the prototype

Layout and rendering

- UIListLayout flex features (HorizontalFlex, VerticalFlex, Wraps, UIFlexItem) are not modeled.
- UIAspectRatioConstraint only does FitWithinMaxSize; AspectType and DominantAxis are ignored.
- UIGradient has two stops, Linear only, and tints the background only. Roblox also tints text and images. Offset, Scale and TileMode are missing.
- UIStroke is drawn outside the box with `box-shadow`, and text outlines are approximated with a ring of text-shadows. BorderStrokePosition, LineJoinMode and StrokeSizingMode are missing.
- Missing classes: UIShadow, UISizeConstraint, UITextSizeConstraint, UIGridLayout, UIPageLayout, per-corner UICorner radii, SurfaceGui, BillboardGui.
- Missing properties: AutomaticSize, RichText, LineHeight, TextTruncate, ImageColor3 tint (stored and exported, not drawn), BorderMode (Outline assumed; the legacy border hides when a UICorner exists).
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

1. Open a new Baseplate in Studio, set the device emulator to 1366×768, paste `prototype/examples/sample-menu.luau` into the command bar and press Enter.
2. Compare it with the editor at "Laptop · 1366×768". Write every difference into a new `docs/STUDIO_DIFFS.md`, with a screenshot of each side. Claude Code can fix the exporter from that list.
3. Run the user tests from the Roadmap in `docs/PLAN.md`. Their result decides which export gets polished first.

### For Claude Code: Phase 2, port to a real codebase

Keep `prototype/` working as the reference until the new app reaches parity. A suggested layout for the new code:

```
src/
  model/     classes.ts (registry), document.ts, commands.ts (undo/redo)
  layout/    layout.ts (pure functions)
  export/    luau.ts, html.ts, json.ts
  render/    canvas.ts (DOM renderer), overlay.ts
  editor/    interactions.ts (drag, resize, snap), keyboard.ts
  ui/        Explorer, Properties, Ribbon, ExportDialog (React components)
tests/       Vitest unit tests and Playwright end-to-end tests
```

1. **Scaffold.** Vite, TypeScript (strict), React for the panels, Vitest, Playwright, ESLint and Prettier. Done when `npm run dev` serves an empty editor shell and `npm test` runs both the unit tests and the existing prototype smoke test.
2. **Model.** A typed class registry with per-class property schemas, so UIGradient uses its real names (Color, Transparency, Rotation). Document types, plus commands with undo and redo instead of snapshots. Done when unit tests cover insert, delete, reparent, property edits, undo and redo.
3. **Layout engine.** A pure function from document and screen size to boxes. Done when unit tests reproduce every number under "Verified" above, plus edge cases: AnchorPoint (1, 1), negative offsets, Scale padding, list alignment Center and Right, horizontal lists, aspect ratios and invisible list items.
4. **Exporters.** Luau, HTML and JSON as pure functions. Done when the output for the sample project is byte-identical to `prototype/examples/` (or every difference is intentional and explained) and the Luau parses with luaparse.
5. **Renderer and interactions.** DOM canvas, selection overlay with handles and the AnchorPoint dot, drag, resize, smart snapping, nudge, zoom and device presets. Done when Playwright tests cover the same interactions as `tests/smoke.mjs`.
6. **Panels.** Explorer with drag-to-reparent, rename and keyboard navigation; Properties with typed editors and Studio shorthand; ribbon; export dialog; Code tab. Done when every Properties editor type has a test.
7. **Parity and cleanup.** Walk through the prototype side by side, fix gaps, then move `prototype/` to `legacy/` or delete it.

After Phase 2 comes the public beta: templates, share links, side-by-side devices, the live code view, .rbxmx export and an accessibility pass.

## Updating the published prototype

`npm run build` also writes `prototype/dist/framecraft.artifact.html`, the body-only version the claude.ai artifact uses. To update the live prototype, ask Claude in a claude.ai conversation to publish that file to https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT. The artifact uses the `downloads` capability for its "Download .html" and "Download .json" buttons.
