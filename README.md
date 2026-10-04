# Framecraft

Build UI the way Roblox Studio does, in the browser: an Explorer tree, a Properties panel, and Scale + Offset positioning. Export the result as Luau for Roblox Studio or as a web page.

"Framecraft" is a working name. This repo holds the clickable prototype, the product plan, and the handover for building the real app.

## Try the prototype

Open `prototype/dist/framecraft.html` in Chrome, Edge or Firefox. It opens on a sample game menu. Fonts load from Google Fonts, so you need an internet connection for them.

- Insert objects from the top bar; add corners, outlines, gradients, padding and list layouts to the selected object.
- Drag to move, use the handles to resize, and hold Alt to skip snapping.
- Switch the device size above the viewport to see Scale-based objects adapt while Offset-based ones stay put.
- Export gives you Luau for Studio's command bar, a standalone web page, or a project file you can import later.

## Continue with Claude Code

The repo is set up for Claude Code: `CLAUDE.md` loads automatically and points to `docs/HANDOVER.md`, which ends with the next tasks. The kickoff prompt is at the top of `docs/HANDOVER.md`.

- **On your computer:** install Claude Code ([setup guide](https://code.claude.com/docs/en/setup)), open a terminal in this folder, run `claude` and paste the kickoff prompt.
- **In the browser or the Claude app** ([claude.ai/code](https://claude.ai/code)): cloud sessions work from GitHub repositories, so push this folder to a GitHub repo first, then pick it when you start a session. The folder is already a git repository with one commit.

## Scripts

You need Node.js 18 or newer.

```
npm install
npx playwright install chromium   # first time only, for the tests
npm run build                      # builds prototype/dist/ from prototype/src/
npm test                           # smoke test: exports, layout numbers, editor interactions
```

## Repo map

- `CLAUDE.md`: instructions Claude Code reads at the start of every session
- `docs/PLAN.md`: product and technical plan (audience, scope, architecture, roadmap, risks)
- `docs/HANDOVER.md`: what works, what's missing, decisions so far, next tasks
- `prototype/`: the single-file prototype, its source parts, and golden example exports
- `tests/smoke.mjs`: the Playwright smoke test

Not affiliated with, sponsored by, or endorsed by Roblox Corporation.
