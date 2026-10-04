---
paths:
  - "prototype/src/7-export.js"
  - "prototype/examples/**"
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
- In the editor, UIGradient's Color, Transparency and Rotation are stored as `GradColor`, `GradTransparency` and `GradRotation` to avoid clashing with UIStroke's `Color`. Export them under their real Roblox names. The TypeScript port should use per-class schemas and drop the prefix.

## HTML/CSS

- A ScreenGui becomes `.screen` (fixed, full window). Position and Size become `calc(Scale% + Offset px)`, and AnchorPoint becomes `translate(-X%, -Y%)` before `rotate()`.
- UIPadding becomes an inner content box with insets. Never use CSS `padding` for it: absolutely positioned children ignore padding.
- UIListLayout becomes flexbox on the content box, and its children switch to `position: relative`.
- Scale-based UICorner radii, UIAspectRatioConstraint and TextScaled need the element's real size, so they are set by the small inline script at the end of the page. Keep that script dependency-free.
- Keep each object's Roblox name in `data-name` so people can find it in the page.

## Golden files

`prototype/examples/` holds the exports of the untouched sample project. `npm test` compares byte for byte. After an intentional change, run `npm run examples` and explain the diff in the commit message.
