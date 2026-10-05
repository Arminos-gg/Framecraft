# Framecraft

A browser app for building UI the way Roblox Studio does: an Explorer tree, a Properties panel, and every Position and Size as UDim2 Scale + Offset. It exports Luau for Studio and an HTML/CSS page for the web. "Framecraft" is a working name.

Current stage: a working single-file prototype plus a product plan, and the port to a Vite + TypeScript app at the repo root (the viewport works; the Explorer, Properties and ribbon come next). Read `docs/HANDOVER.md` before starting any task; the product plan is `docs/PLAN.md`.

## Commands

- First time: `npm install`, then `npx playwright install chromium`
- `npm run dev`: serves the new app (Vite)
- `npm run build`: builds the app into `dist/` and the prototype into `prototype/dist/` (`build:app`, `build:prototype` do one each)
- `npm test`: runs `test:unit` (Vitest), `test:e2e` (Playwright against the dev server) and `test:prototype` (the prototype smoke test: golden exports, Luau syntax, layout numbers, editor interactions, phone width)
- `npm run lint`, `npm run typecheck`, `npm run format` (Prettier; the prototype and docs are excluded)
- `npm run examples`: rewrites the golden files in `prototype/examples/`; only after an intentional exporter change
- Use the prototype: open `prototype/dist/framecraft.html` in a browser

## Repo map

- `src/`: the new app (Vite, strict TypeScript, React). `main.tsx` mounts `ui/App.tsx`; `styles/tokens.css` holds the design tokens copied from the prototype
- `src/model/`: value types, class registry with per-class property schemas, immutable document, commands, undo history, image library, project files (opens prototype files too) and the samples. The root is a DataModel holding StarterGui (Roblox screens), Site (web pages) and the Breakpoints
- `src/layout/`: the layout engine, pure functions from a document, window size and breakpoint to boxes in pixels (Roblox's AbsolutePosition and AbsoluteSize). Pages are window-wide and grow to fit their content
- `src/export/`: the exporters as pure functions: Luau and an HTML page for the Roblox screens, and the website (`site.ts`: an HTML file per page, pictures, breakpoints as media queries). The project file is `serializeProject` in `src/model/project.ts`
- `src/editor/`: editor state outside React (`editor.ts`): the undo history, selection, view (the Roblox screens or one page), device, zoom and preview, plus viewport gestures turned into commands. `geometry.ts` is the pure editing math (UDim2 from pixels, smart snapping, resizing)
- `src/ui/viewport/`: the canvas: `Stage` draws the user's UI from the layout, `Overlay` the selection, handles and guides. Dev builds expose the running editor as `window.framecraft`, which the e2e tests use
- `tests/unit/`: Vitest tests; `tests/e2e/`: Playwright tests for the new app
- `prototype/src/1-head.html`: title, fonts and all CSS; design tokens are the `:root` block at the top
- `prototype/src/2-body.html`: app shell markup
- `prototype/src/3-core.js`: class registry (`CLASSES`, `PROPS`), document model, sample project, undo history, autosave
- `prototype/src/4-render.js`: layout engine (UDim2, UIPadding, UIListLayout, UIAspectRatioConstraint), DOM renderer, selection overlay
- `prototype/src/5-interact.js`: select, move, resize, smart snapping, nudge, insert, copy/paste, unit conversion, keyboard
- `prototype/src/6-panels.js`: Explorer (rename, drag to reparent) and Properties editors (Studio shorthand parsing)
- `prototype/src/7-export.js`: Luau, HTML/CSS and JSON exporters, Code tab, export dialog, boot
- `prototype/build.mjs`: concatenates the parts into `dist/`; `dist/` is generated, never edit it by hand
- `prototype/examples/`: golden exports of the sample project, compared by `npm test`
- `tests/smoke.mjs`: Playwright smoke test; writes screenshots and exports to `tests/output/`

## Roblox rules the code must follow

These are facts about Roblox, not style preferences. Breaking them makes exports wrong.

- Use Roblox's own class and property names (Frame, TextLabel, BackgroundTransparency, AnchorPoint). Users know them from Studio.
- UDim2 is stored as `[xScale, xOffset, yScale, yOffset]` and UDim as `[scale, offset]`. Offsets are integers, as in Roblox. Colors are `[r, g, b]` from 0 to 255. Transparency runs 0 to 1, where 1 is invisible.
- Layout, per axis: `AbsSize = ParentSize * Scale + Offset` and `AbsPos = ParentPos + ParentSize * Scale + Offset - AnchorPoint * AbsSize`. A UIPadding shrinks the parent area first.
- Under a UIListLayout, children ignore Position, AnchorPoint and Rotation. Invisible children take no space. Order is LayoutOrder, or Name when SortOrder is Name.
- Modifiers (UICorner, UIStroke, UIGradient, UIPadding, UIListLayout, UIAspectRatioConstraint) are child objects, not properties.
- UICorner Scale is measured on the shorter side, so 0.5 makes a pill. A UIStroke on a text object outlines the letters unless ApplyStrokeMode is Border.
- By default children draw above their parent and ZIndex orders siblings (ZIndexBehavior Sibling).
- Studio shorthand in UDim2 fields: `0.25,40,0.1,20` is a full UDim2; a single number of 1 or less means Scale on both axes, a larger one means Offset.
- When unsure how Roblox behaves, check https://create.roblox.com/docs and treat Roblox Studio as the source of truth.

## Conventions

- The new app's design tokens live in `src/styles/tokens.css`; the same rules on tokens, themes and Scale/Offset colors apply there.
- In the new app, documents are immutable and every edit is a command (`src/model/commands.ts`) run through `History`. Gestures (drags, sliders) go between `begin()` and `commit()` so they are one undo step.
- Values can differ per breakpoint (Desktop is the base, then Tablet, then Phone). Layout, rendering and exporters read values through `resolveProps(doc, inst, breakpoint)`, never `inst.props` directly. Classes and properties with no Roblox counterpart carry a `web` flag in the registry, and the Luau export skips them.
- The prototype is plain JS with no dependencies inside the page. It also runs as a claude.ai artifact, whose content security policy only allows Google Fonts and a few script CDNs.
- Every document edit goes through `mutate()`, which makes one undo step. Continuous edits (drags, sliders, the color picker) snapshot first and call `record()` when they end.
- State lives in `doc` (saved and exported) and `ui` (editor-only). Render functions rebuild their DOM from that state and must stay side-effect free.
- UI copy is plain and short, in sentence case. Scale values are teal (`--scale`) and Offset values amber (`--offset`) everywhere in the editor.
- All editor colors come from the tokens in `1-head.html`; light and dark themes must both work. The user's own UI inside the viewport uses only its own property colors.

## Gotchas

- Never put a literal `</script` or `<!--` in the JS: it ends or derails the inline script. Exporter templates write `<\/script>` and `<\!--`, and `build.mjs` fails if the raw sequences appear.
- The Luau export sets `IgnoreGuiInset = true` so Studio uses the same full-screen area as the editor.
- Fonts are Google look-alikes (Gotham is Montserrat, BuilderSans is Figtree, Arial is Arimo). Exports keep the real `Enum.Font` names.
- Roblox images (`rbxassetid://`) can't load in a browser. ImageLabels show an uploaded preview (a data URL) in the editor and export the asset id.
- Exporter-specific rules are in `.claude/rules/exporters.md` and load when you touch exporter files.

## Working agreements

- Run `npm run build && npm test` before saying a change works. If a golden file changes, say why.
- Prefer small, reviewable commits. Don't add dependencies to the prototype page.
- Keep this file short; put longer notes in `docs/`.
