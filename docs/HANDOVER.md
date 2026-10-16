# Handover

Written 2026-10-15 so work can continue in a fresh Claude project. Everything a new session needs is in this repo. Memory from the old project does not carry over, so anything worth keeping is written down here.

## Kickoff prompt

Paste this as the first message of a new session:

> Read CLAUDE.md and docs/HANDOVER.md. Run `npm install`, `npm run build` and `npm test`, and tell me what passed. Then wait for what I want to build next.

In a Claude Code cloud session, Playwright's Chromium is already installed, so skip `npx playwright install chromium`.

## Where to read what

- `CLAUDE.md`: the repo map, Roblox rules, conventions and commands. It loads by itself in Claude Code.
- `.claude/rules/exporters.md`: rules for the Luau, model file, HTML and website exports. It loads when exporter files are touched.
- `docs/FEATURES.md`: how each feature was built and what it covers, plus the known gaps.
- `docs/DECISIONS.md`: what was decided, why, and when to revisit it.
- `docs/PLAN.md`: the product plan (audience, scope, roadmap, risks).

## Where things stand

The editor works end to end in the browser as a static site. It has the viewport, Explorer, Properties, ribbon, live code view, templates, components, export and project files, with autosave. A project holds Roblox screens (StarterGui) and a website (Site with Pages and Tablet and Phone breakpoints). Exports are a website zip (the main output), Luau for Studio, a Roblox model file (.rbxmx) and a single HTML page of the Roblox screens.

- Repo: https://github.com/Arminos-gg/Framecraft. `main` holds PRs #1 to #28 and the cleanup PR (flaky box-select test, ribbon width).
- Vercel builds a preview of every branch at `framecraft-git-<branch>-yuh-83e9.vercel.app`. GitHub has no CI, so run `npm run build && npm test` before saying a change works. That's about 850 unit tests and 140 browser tests, and the browser tests take about 2 minutes.

## What's built, by pull request

- **#1 to #11, the port:** the Vite + TypeScript app, the model (immutable document, commands, undo, image library, project file version 3), the website model (Site, Pages, Breakpoints, `resolveProps`), the layout engine, the exporters, the canvas and the panels. The prototype matched the app and was then deleted (it's in git history at `c9caac6`).
- **#12:** starter templates, three websites and four Roblox screens.
- **#13:** AutomaticSize.
- **#14:** one field per axis for Position and Size (`50% + 20px`). The editor never says Scale or Offset.
- **#15:** rulers and a measuring grid around the device.
- **#16:** side-by-side devices.
- **#17:** LineHeight and AutomaticCanvasSize; the templates grow with their text.
- **#18:** clicking a page's empty space selects the page, so you can change its background.
- **#19:** the .rbxmx model file export.
- **#20:** the Shapes menu, SVG pictures (upload, paste or drop) and ImageColor3 tints.
- **#21:** the Components drawer, 33 pre-made pieces in Light or Dark and Rounded or Sharp looks.
- **#22:** the accessibility pass (keyboard, screen readers, contrast checks on the editor and exports).
- **#23:** web extras: hover effects, background blur, appear on scroll, pinned objects, one-sided borders.
- **#24:** the color picker, and the delete popup with Undo.
- **#25:** 27 web fonts, font weights and letter spacing.
- **#26:** Folders, multi-select, the right-click menu and panning.
- **#27:** web extras, part two: forms, YouTube and map embeds, text decoration and case, gradient text, picture filters, cursors, smooth scrolling.
- **#28:** the live code view (a Code panel under the viewport), and popups that grow to fit long messages.
- **Cleanup (Oct 16):** the box-select browser test waits for fonts and a settled viewport; in windows up to 1480 px the ribbon's tools sit tighter and Convert units is two small buttons, so the ribbon fits a 1280 px window (a browser test checks it).

## How Armin works

- For bigger work, propose a plan and wait for his OK before writing code. For a clear ask, just build it.
- He wants something he can click and try (the Vercel preview), not only internals. Screenshots help.
- The main goal is building real websites; HTML and CSS are the main output. Roblox exports stay, but leave pictures out of them: asset ids only, no PNG conversion.
- The editor shows percents (teal) and pixels (amber), never Scale and Offset. Plain, short UI copy.
- Each feature gets one PR off `main`. He once chose stacked PRs for a sequence of steps. The repo keeps merged branches, though, so a stacked PR doesn't retarget when its base merges, and he merges fast. Avoid stacks unless "Automatically delete head branches" is on in the repo settings.
- His Claude usage limit runs out quickly. Keep sessions lean: start new work in a fresh session rather than one long one, and keep docs short.
- Deleting needs no confirmation step; the popup's Undo covers it.

## Open items

- **Share links:** projects need a server to be stored. Plan the server first and get his OK before building.
- **Flaky tests:** the browser test where a label grows to fit its text sometimes failed. #24 made it wait for web fonts, which may have fixed it. "Follows a link from the keyboard in preview" failed once under load and then passed. Tests that measure the viewport right after load should wait for `document.fonts.ready` and a settled box (see `settledBox` in `tests/e2e/selection.spec.ts`): the toolbar and the fit zoom shift once fonts load.
- **Components:** Add makes a plain copy. Linked copies (edit once, change everywhere) are undecided.
- **Folders** can't sit directly in StarterGui yet.
- **Repo setting:** "Automatically delete head branches" was suggested on Oct 5. Turn it on if stacked PRs are wanted.
- **Website questions** answered by the website features doc's recommendations until Armin says otherwise: one project for both Roblox and the web, static sites (no sign-in), Framer-style breakpoints (Tablet up to 1199 px, Phone up to 809 px).
- **Waiting on other features:** grid layouts, scripts and interactivity, BillboardGui and ViewportFrame pieces from the component ideas.
- **Never checked:** Firefox and Safari (tests run in Chromium), and real users (the user tests in `docs/PLAN.md` haven't run).
- Smaller gaps are listed under "Known gaps" in `docs/FEATURES.md`.

## Checks only Armin can run (Roblox Studio)

Nobody has opened an export in Studio yet. The Luau only passed a parser, and the model file only passed Rojo's reader (`tools/rbxcheck`).

1. Open a new Baseplate in Studio, set the device emulator to 1366×768, paste `tests/golden/sample-menu.luau` into the command bar and press Enter. Compare it with the editor at "Laptop · 1366×768". Write every difference into a new `docs/STUDIO_DIFFS.md`, with a screenshot of each side, and Claude can fix the exporter from that list.
2. Export the sample as "Roblox model", right-click StarterGui, choose Insert from File and pick the .rbxmx (or `tests/golden/sample-menu.rbxmx`). It should match what the Luau builds, fonts included.
3. LineHeight: check whether one line of text with LineHeight 2 is twice as tall. The editor gives every line, the first one included, LineHeight × TextSize, as CSS does.
4. AutomaticSize: check whether a TextLabel that doesn't wrap still grows on Y, whether wrapped text grows on X only as wide as its parent, and what Scale in children and in a UIPadding is measured against (the editor uses the object's Size).

## Links

These are private to Armin's claude.ai account. Claude Code can't open them, and the repo holds what they decided.

- Product plan (live version of `docs/PLAN.md`): https://claude.ai/code/artifact/f3841492-bcbd-409d-913e-f9982b6ad143
- Website features findings (Site, Pages, breakpoints, image library, Link values): https://claude.ai/code/artifact/d0980ca9-4396-4ec4-b9a6-b7b0784430c8
- Editor design (light and dark frames, component states, tokens; the tokens live in `src/styles/tokens.css`): https://claude.ai/artifact/K5n9EPnPAERGCCiebB2g2o
- Pre-made component ideas (about 150 ideas and kits by site type and game genre): https://claude.ai/code/artifact/7bc8f312-2c8c-4eee-b007-908a8bb3e03e
- Components browser mock-up, which #21 built: https://claude.ai/artifact/P1XM5UMeiQ7CM3ecT4kRRM
- The retired prototype, frozen: https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT

## Notes for Claude sessions

- Node 22.12 or newer (Vitest needs it). TypeScript stays on 6.0 until typescript-eslint supports 7. Playwright is pinned to 1.56.
- Dev builds expose the running editor as `window.framecraft`; the browser tests drive it.
- In cloud sessions, Playwright's Chromium rejects the proxy's certificate for Google Fonts, so screenshots fall back to system fonts. Fetch the fonts through Node and keep certificate checks on: `await context.route(/fonts\.(googleapis|gstatic)\.com/, async (r) => r.fulfill({ response: await r.fetch() }));`
- `npm run update-golden` rewrites `tests/golden/` only after an intentional exporter change. Say why in the commit message.
