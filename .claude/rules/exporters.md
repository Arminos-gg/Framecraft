---
paths:
  - "tests/golden/**"
  - "src/export/**"
  - "src/**/export*"
---

# Exporter rules

The exporters turn the document into Luau for Roblox Studio and an HTML/CSS page. Both must reproduce what the editor shows.

## Luau

- Emit `Instance.new`, then properties, then children, and set each object's `Parent` last, after its own children are parented. Parent the ScreenGui to StarterGui (command bar version) or to the player's PlayerGui (LocalScript version) at the very end.
- Always emit `Size`, `BackgroundColor3`, `BorderSizePixel`, and for text objects `Font`, `Text`, `TextColor3` and `TextSize`. Their `Instance.new` defaults differ from what users expect.
- Only omit a property when its Roblox default is certain: Position 0, AnchorPoint 0, Rotation 0, BackgroundTransparency 0, ZIndex 1, LayoutOrder 0, Visible true, ClipsDescendants false, TextScaled false, TextWrapped false, TextXAlignment and TextYAlignment Center, TextTransparency 0, AutoButtonColor true, ImageColor3 white, ImageTransparency 0, ScaleType Stretch, ApplyStrokeMode Contextual. Check any new omission in Studio first.
- ScreenGuis always get `IgnoreGuiInset = true` and `ZIndexBehavior = Enum.ZIndexBehavior.Sibling`.
- Use `UDim2.fromScale` when both offsets are 0, `UDim2.fromOffset` when both scales are 0, otherwise `UDim2.new`.
- Variable names come from the object's Name in camelCase, de-duplicated with a number. Modifiers that keep their default name are named after their parent (`panelCorner`, `playButtonGradient`).
- Escape strings with `luaStr()`. The output must parse: `npm test` runs it through luaparse.
- Export the base (Desktop) values and skip everything with a `web` flag (Site, pages, web-only properties). Roblox has no breakpoints.
- UIGradient's Color, Transparency and Rotation use their Roblox names in its own schema, with colors and transparencies as keypoint sequences. Prototype project files (version 1) stored them as `GradColor`, `GradTransparency` and `GradRotation`; `src/model/project.ts` converts them on open.

## HTML/CSS

- A ScreenGui becomes `.screen` (fixed, full window). Position and Size become `calc(Scale% + Offset px)`, and AnchorPoint becomes `translate(-X%, -Y%)` before `rotate()`.
- UIPadding becomes an inner content box with insets. Never use CSS `padding` for it: absolutely positioned children ignore padding.
- UIListLayout becomes flexbox on the content box, and its children switch to `position: relative`.
- Scale-based UICorner radii, UIAspectRatioConstraint and TextScaled need the element's real size, so they are set by the small inline script at the end of the page. Keep that script dependency-free.
- Keep each object's Roblox name in `data-name` so people can find it in the page.

## Website (`src/export/site.ts`)

- A page is as wide as the window and grows with its content. On a page, vertical Scale is a share of the window height less the page padding (`--vh`), as in the layout engine. Free-placed sections grow the page through `min-height`. A page's own UIPadding is CSS padding on `.page`, the one exception to the rule above, because the page's content box is in normal flow.
- Elements come out in the base order. Each breakpoint is a media query with only the declarations that change, widest first, so Phone inherits Tablet's changes like `resolveProps`. A list whose order changes gets CSS `order`.
- Links are relative and name `index.html` in full, so the folder also works when opened from disk. Never nest links, and keep headings and paragraphs free of divs (use spans inside them).
- `tests/e2e/site-export.spec.ts` compares every exported box with the layout engine in Chromium. Keep it passing when either changes.

## Golden files

`tests/golden/` holds the exports of the untouched sample menu. They started as the prototype's exports, and `tests/unit/export/golden.test.ts` compares them byte for byte. After an intentional change, run `npm run update-golden` and explain the diff in the commit message.
