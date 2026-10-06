# Framecraft

A browser app for building UI the way Roblox Studio does: an Explorer tree, a Properties panel, and every Position and Size as UDim2 Scale + Offset. It exports websites (static HTML/CSS), Luau for Studio, and an HTML page of the Roblox screens. "Framecraft" is a working name.

Current stage: a Vite + TypeScript app at the repo root that works end to end (viewport, Explorer, Properties, ribbon, Code tab, export, project files and autosave), plus a product plan. It was ported from a single-file prototype, which reached parity and was deleted in step 7; it is in git history (`git show c9caac6:prototype/`). Read `docs/HANDOVER.md` before starting any task; the product plan is `docs/PLAN.md`.

## Commands

- First time: `npm install`, then `npx playwright install chromium`
- `npm run dev`: serves the app (Vite)
- `npm run build`: type-checks and builds the app into `dist/`, a static site
- `npm test`: runs `test:unit` (Vitest) and `test:e2e` (Playwright against the dev server)
- `npm run lint`, `npm run typecheck`, `npm run format` (Prettier; docs and golden files are excluded)
- `npm run update-golden`: rewrites the golden files in `tests/golden/`; only after an intentional exporter change

## Repo map

- `src/`: the app (Vite, strict TypeScript, React). `main.tsx` restores the autosave and mounts `ui/App.tsx`; `styles/tokens.css` holds the design tokens from the editor design, `styles/app.css` the editor styles
- `src/model/`: value types, class registry with per-class property schemas, immutable document, commands, undo history, image library, project files (opens the prototype's version 1 files too) and the samples. The root is a DataModel holding StarterGui (Roblox screens), Site (web pages) and the Breakpoints
- `src/model/templates/`: the starter templates (three websites, four Roblox screens) behind "New from a template", built in code with `Builder` (`src/model/builder.ts`), as the samples are
- `src/layout/`: the layout engine, pure functions from a document, window size and breakpoint to boxes in pixels (Roblox's AbsolutePosition and AbsoluteSize). Pages are window-wide and grow to fit their content. AutomaticSize needs text sizes from `text.ts`: the browser measures them in the app (`src/ui/viewport/text-measure.ts`), an estimate stands in for Node tests
- `src/export/`: the exporters as pure functions: Luau and an HTML page for the Roblox screens, and the website (`site.ts`: an HTML file per page, pictures, breakpoints as media queries; `zip.ts` packs it for download). The project file is `serializeProject` in `src/model/project.ts`
- `src/editor/`: editor state outside React (`editor.ts`): the undo history, selection, view (the Roblox screens or one page), device, zoom and preview, plus every panel action (insert, rename, reparent, property edits per breakpoint, unit conversion, opening projects) as commands. `geometry.ts` is the pure editing math (UDim2 from pixels, smart snapping, resizing), `insert.ts` where and how new objects land, `text-values.ts` Studio shorthand parsing, `autosave.ts` the browser-storage autosave
- `src/ui/viewport/`: the canvas: `Stage` draws the user's UI from the layout, `Overlay` the selection, handles and guides, `Rulers` the rulers in device pixels, which line up with the measuring grid around the device and behind the Roblox screens (`rulers.ts` spaces both for the zoom). Dev builds expose the running editor as `window.framecraft`, which the e2e tests use
- `src/ui/`: the panels: `Explorer` (rename, drag to reparent, keyboard), `properties/` (`Properties`, an editor per value type in `fields.tsx`, the Code tab), `Ribbon`, `ExportDialog`, `ProjectMenu` and the insert menu
- `tests/unit/`: Vitest tests; `tests/e2e/`: Playwright tests, which also check every exported HTML page against the layout engine in Chromium
- `tests/golden/`: the exports of the untouched sample menu (Luau for both targets and the HTML page), compared byte for byte by `tests/unit/export/golden.test.ts`

## Roblox rules the code must follow

These are facts about Roblox, not style preferences. Breaking them makes exports wrong.

- Use Roblox's own class and property names (Frame, TextLabel, BackgroundTransparency, AnchorPoint). Users know them from Studio.
- UDim2 is stored as `[xScale, xOffset, yScale, yOffset]` and UDim as `[scale, offset]`. Offsets are integers, as in Roblox. Colors are `[r, g, b]` from 0 to 255. Transparency runs 0 to 1, where 1 is invisible.
- Layout, per axis: `AbsSize = ParentSize * Scale + Offset` and `AbsPos = ParentPos + ParentSize * Scale + Offset - AnchorPoint * AbsSize`. A UIPadding shrinks the parent area first.
- Under a UIListLayout, children ignore Position, AnchorPoint and Rotation. Invisible children take no space. Order is LayoutOrder, or Name when SortOrder is Name.
- Modifiers (UICorner, UIStroke, UIGradient, UIPadding, UIListLayout, UIAspectRatioConstraint) are child objects, not properties.
- AutomaticSize grows an object to fit its text and children, UIPadding included, and Size becomes its minimum. Wrapped text wraps at the object's width.
- UICorner Scale is measured on the shorter side, so 0.5 makes a pill. A UIStroke on a text object outlines the letters unless ApplyStrokeMode is Border.
- By default children draw above their parent and ZIndex orders siblings (ZIndexBehavior Sibling).
- Studio shorthand in UDim2 fields: `0.25,40,0.1,20` is a full UDim2; a single number of 1 or less means Scale, a larger one means Offset. The editor's length fields take it too.
- When unsure how Roblox behaves, check https://create.roblox.com/docs and treat Roblox Studio as the source of truth.

## Conventions

- Documents are immutable and every edit is a command (`src/model/commands.ts`) run through `History`. Gestures (drags, sliders, the color picker) go between `begin()` and `commit()` so they are one undo step.
- Values can differ per breakpoint (Desktop is the base, then Tablet, then Phone). Layout, rendering and exporters read values through `resolveProps(doc, inst, breakpoint)`, never `inst.props` directly. Classes and properties with no Roblox counterpart carry a `web` flag in the registry, and the Luau export skips them.
- The document is what gets saved and exported; editor-only state (selection, view, zoom, preview) lives in `Editor`. Components read both through `useEditorState()` and change them only through `Editor` methods.
- UI copy is plain and short, in sentence case. The editor shows Scale as a percent of the parent and Offset as pixels (`50% + 20px`, see `fmtLength`), never as Scale and Offset; only exported code and Roblox property names keep them. Percents are teal (`--scale`) and pixels amber (`--offset`) everywhere in the editor.
- All editor colors come from the tokens in `src/styles/tokens.css`; light and dark themes must both work. The user's own UI inside the viewport uses only its own property colors.

## Gotchas

- The Luau export sets `IgnoreGuiInset = true` so Studio uses the same full-screen area as the editor.
- Fonts are Google look-alikes (Gotham is Montserrat, BuilderSans is Figtree, Arial is Arimo). Exports keep the real `Enum.Font` names.
- Roblox images (`rbxassetid://`) can't load in a browser. ImageLabels show an uploaded preview picture in the editor and export the asset id.
- Exporter-specific rules are in `.claude/rules/exporters.md` and load when you touch exporter files.

## Working agreements

- Run `npm run build && npm test` before saying a change works. If a golden file changes, say why.
- Prefer small, reviewable commits.
- Keep this file short; put longer notes in `docs/`.
