# Framecraft

Build UI the way Roblox Studio does, in the browser: an Explorer tree, a Properties panel, and Scale + Offset positioning. Export the result as a website, as Luau for Roblox Studio, or as a single web page.

"Framecraft" is a working name. This repo holds the editor (a Vite + TypeScript app) and the product plan. The editor started as a single-file prototype, which was ported here and then retired; it is in git history and still runs at https://claude.ai/artifact/UsJ62VRUdtaqmAUBzdjhsT.

## Try it

Run `npm install` and `npm run dev`, then open http://localhost:5173 in Chrome, Edge or Firefox. It opens on a sample website and a sample game menu. Fonts load from Google Fonts, so you need an internet connection for them.

- Pick the website's pages or the Roblox screens above the viewport, and a device size to see Scale-based objects adapt while Offset-based ones stay put.
- Insert objects from the ribbon; add corners, outlines, gradients, padding and list layouts to the selected object.
- Drag to move, use the handles to resize, and hold Alt to skip snapping.
- Start from a template in the Project menu: a landing page, a portfolio or a link-in-bio page, or a Roblox shop, inventory, settings menu or HUD.
- Export downloads the website as a zip of static files. It also gives you Luau for Studio's command bar, a standalone web page, or a project file you can open later.

## Continue with Claude Code

The repo is set up for Claude Code: `CLAUDE.md` loads automatically and points to `docs/HANDOVER.md`, which ends with the next tasks. The kickoff prompt is at the top of `docs/HANDOVER.md`.

- **On your computer:** install Claude Code ([setup guide](https://code.claude.com/docs/en/setup)), open a terminal in this folder, run `claude` and paste the kickoff prompt.
- **In the browser or the Claude app** ([claude.ai/code](https://claude.ai/code)): cloud sessions work from GitHub repositories, so pick this repo when you start a session.

## Scripts

You need Node.js 22.12 or newer.

```
npm install
npx playwright install chromium   # first time only, for the tests
npm run dev                        # serves the app at http://localhost:5173
npm run build                      # builds the app into dist/
npm test                           # unit tests and browser tests
npm run lint                       # ESLint; `npm run format` applies Prettier
```

`dist/` is a static site: upload its contents to any web host.

## Repo map

- `CLAUDE.md`: instructions Claude Code reads at the start of every session
- `docs/PLAN.md`: product and technical plan (audience, scope, architecture, roadmap, risks)
- `docs/HANDOVER.md`: what works, what's missing, decisions so far, next tasks
- `src/`: the app (model, layout and exporters as plain TypeScript; React panels in `src/ui/`; design tokens in `src/styles/`)
- `tests/`: unit tests (`unit/`), browser tests (`e2e/`) and the golden exports of the sample menu (`golden/`)

Not affiliated with, sponsored by, or endorsed by Roblox Corporation.
