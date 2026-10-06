---
paths:
  - "tests/golden/**"
  - "src/export/**"
  - "src/**/export*"
---

# Exporter rules

The exporters turn the document into Luau and a model file for Roblox Studio and an HTML/CSS page. Both must reproduce what the editor shows.

## Luau

- Emit `Instance.new`, then properties, then children, and set each object's `Parent` last, after its own children are parented. Parent the ScreenGui to StarterGui (command bar version) or to the player's PlayerGui (LocalScript version) at the very end.
- Always emit `Size`, `BackgroundColor3`, `BorderSizePixel`, and for text objects the font, `Text`, `TextColor3` and `TextSize`. Their `Instance.new` defaults differ from what users expect.
- A font that is exactly a Roblox `Enum.Font` (Gotham at Bold is `GothamBold`, see `legacyFontOf`) is written as `Font = Enum.Font.X`, so the sample's goldens stay the same. Any other face is `FontFace = Font.new(family file, Enum.FontWeight, Enum.FontStyle)`, leaving out Regular and Normal at the end. A web font Roblox doesn't have uses its `roblox` stand-in from `FONTS`, with a comment saying so. LetterSpacing is web only and never written.
- Only omit a property when its Roblox default is certain: Position 0, AnchorPoint 0, Rotation 0, BackgroundTransparency 0, ZIndex 1, LayoutOrder 0, Visible true, ClipsDescendants false, TextScaled false, TextWrapped false, LineHeight 1, TextXAlignment and TextYAlignment Center, TextTransparency 0, AutoButtonColor true, ImageColor3 white, ImageTransparency 0, ScaleType Stretch, ApplyStrokeMode Contextual. Check any new omission in Studio first.
- ScreenGuis always get `IgnoreGuiInset = true` and `ZIndexBehavior = Enum.ZIndexBehavior.Sibling`.
- Use `UDim2.fromScale` when both offsets are 0, `UDim2.fromOffset` when both scales are 0, otherwise `UDim2.new`.
- Variable names come from the object's Name in camelCase, de-duplicated with a number. Modifiers that keep their default name are named after their parent (`panelCorner`, `playButtonGradient`).
- Write `AutomaticSize` and a ScrollingFrame's `AutomaticCanvasSize` only when they aren't None.
- Escape strings with `luaStr()`. The output must parse: `npm test` runs it through luaparse.
- Export the base (Desktop) values and skip everything with a `web` flag (Site, pages, web-only properties). Roblox has no breakpoints.
- UIGradient's Color, Transparency and Rotation use their Roblox names in its own schema, with colors and transparencies as keypoint sequences. Prototype project files (version 1) stored them as `GradColor`, `GradTransparency` and `GradRotation`; `src/model/project.ts` converts them on open.

## Roblox model file (`src/export/rbxmx.ts`)

- The XML Studio reads with Insert from File: `<roblox version="4">`, then an `<Item class referent>` per object with its `<Properties>`, children nested inside their parent's Item. Referents are `RBX` and 32 hex digits from a counter, so the file is stable.
- Write every non-web property, defaults included, so nothing depends on Studio's defaults for a missing one. Same objects, base values and ScreenGui extras (`IgnoreGuiInset` true, `ZIndexBehavior` Sibling) as the Luau.
- Types follow Roblox's, not the editor's: TextSize is a `float`, colors are `Color3` from 0 to 1, enums are `<token>` numbers from `ENUM_TOKENS` (Roblox's API dump), images are `<Content><url>` or `<null>`, and sequences are `time r g b 0` or `time value 0` per keypoint.
- Fonts are written as `FontFace` (family file, weight, style), as Studio saves them, from Font, FontWeight and FontStyle, which are not written on their own; Rojo's reader can't turn a BuilderSans Font enum into one. IgnoreGuiInset, CornerRadius and Image keep their scriptable names, which the API dump marks loadable.
- Nothing in `npm test` can open the file in Studio. When changing types or names, check the output with `tools/rbxcheck` (Rojo's rbx_xml and Roblox's reflection database; `cargo run --release --manifest-path tools/rbxcheck/Cargo.toml -- file.rbxmx`) or in Studio.

## HTML/CSS

- A ScreenGui becomes `.screen` (fixed, full window). Position and Size become `calc(Scale% + Offset px)`, and AnchorPoint becomes `translate(-X%, -Y%)` before `rotate()`.
- UIPadding becomes an inner content box with insets. Never use CSS `padding` for it: absolutely positioned children ignore padding.
- UIListLayout becomes flexbox on the content box, and its children switch to `position: relative`.
- Scale-based UICorner radii, UIAspectRatioConstraint, AutomaticSize and TextScaled need the element's real size, so they are set by the small inline script at the end of the page. Keep that script dependency-free.
- An object with AutomaticSize at the base or any breakpoint gets `data-auto`, a `--auto` declaration (`none`, `x`, `y` or `xy`, which media queries change) and always a content box, where the script reads its padding. The script grows it with `min-width` and `min-height` exactly as the layout engine does, and lengthens a page marked `data-grow`. `tests/e2e/auto-size.spec.ts` compares it with the engine measuring text in the same page.
- A ScrollingFrame with AutomaticCanvasSize at the base or any breakpoint gets `data-canvas`, a `--canvas` declaration and always its canvas and content box; the script grows the canvas with `min-width` and `min-height` the way it grows a box.
- LineHeight becomes `line-height` on the text, written only when it isn't 1 (the page's default).
- The font becomes `font-family` (the Google family and a fallback of its kind), `font-weight` (the nearest weight the web font has, `webWeight`) and `font-style`; the page links Google Fonts for exactly the faces it uses. LetterSpacing becomes `letter-spacing` in px on websites only (`HtmlWriter.site`); the Roblox screens' page leaves it out, as the editor does on screens.
- Keep each object's Roblox name in `data-name` so people can find it in the page.

## Website (`src/export/site.ts`)

- A page is as wide as the window and grows with its content. On a page, vertical Scale is a share of the window height less the page padding (`--vh`), as in the layout engine. Free-placed sections grow the page through `min-height`. A page's own UIPadding is CSS padding on `.page`, the one exception to the rule above, because the page's content box is in normal flow.
- Elements come out in the base order. Each breakpoint is a media query with only the declarations that change, widest first, so Phone inherits Tablet's changes like `resolveProps`. A list whose order changes gets CSS `order`.
- Links are relative and name `index.html` in full, so the folder also works when opened from disk. Never nest links, and keep headings and paragraphs free of divs (use spans inside them).
- `tests/e2e/site-export.spec.ts` compares every exported box with the layout engine in Chromium. Keep it passing when either changes.

## Golden files

`tests/golden/` holds the exports of the untouched sample menu. They started as the prototype's exports, and `tests/unit/export/golden.test.ts` compares them byte for byte. After an intentional change, run `npm run update-golden` and explain the diff in the commit message. `sample-menu.rbxmx` was written by this app (there was no prototype version).
