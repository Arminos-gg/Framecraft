# Framecraft

**Design interfaces visually. Export them anywhere.**

Framecraft is a browser-based UI builder inspired by Roblox Studio. It combines a visual viewport, an Explorer-style hierarchy, and a Properties panel to make interface design more intuitive — without manually writing every element from scratch.

Design website layouts and Roblox interfaces in one editor, then export your work as a static website, Luau code for Roblox Studio, or a standalone HTML page.

<p align="center">
  <a href="https://framecraft-lake.vercel.app/">
    <strong>Live Demo</strong>
  </a>
</p>

<!-- Replace the placeholder above with your Vercel deployment URL. -->

## Features

- **Visual UI Editor** — Create and edit interfaces directly in the browser.
- **Explorer Hierarchy** — Organize interface elements in a tree, similar to Roblox Studio.
- **Properties Panel** — Configure the selected object's properties from a dedicated panel.
- **Scale + Offset Positioning** — Combine proportional positioning with fixed pixel offsets.
- **Drag & Resize** — Move elements around the viewport and resize them using handles.
- **Snapping Controls** — Align objects visually, with the option to hold `Alt` to bypass snapping.
- **Styling Tools** — Add corners, outlines, gradients, padding, and list layouts.
- **Multiple Templates** — Start with a website, portfolio, link-in-bio page, Roblox shop, inventory, settings menu, or HUD.
- **Responsive Preview** — Switch device sizes and see how Scale-based and Offset-based objects behave.
- **Multiple Export Formats** — Export static websites, Luau for Roblox Studio, standalone HTML, or a reusable project file.

## Preview

<img width="3423" height="1300" alt="image" src="https://github.com/user-attachments/assets/772d2a5d-066d-422f-9b25-da59004c76e6" />

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **22.12 or newer**
- npm
- An internet connection for fonts loaded from Google Fonts

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Arminos-gg/Framecraft.git
   cd Framecraft
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed in your terminal, usually:

   ```text
   http://localhost:5173
   ```

The editor opens with example website pages and a sample game menu so you can explore the workflow immediately.

## How to Use

1. **Choose a starting point** — Select a website page or Roblox screen, or create a project from a template.
2. **Select an object** — Browse the Explorer tree and choose the element you want to edit.
3. **Customize its properties** — Adjust positioning, sizing, styling, and layout through the Properties panel.
4. **Arrange your interface** — Drag elements, resize them with the handles, and use snapping to align objects.
5. **Preview different sizes** — Switch the viewport device size to inspect how your layout adapts.
6. **Export your project** — Choose the output format that fits your workflow.

## Export Formats

| Format | Intended use |
| --- | --- |
| Static website | Download a ZIP containing static website files. |
| Luau | Generate code for use in Roblox Studio's Command Bar. |
| Standalone HTML | Export a self-contained web page. |
| Framecraft project | Save a project file that can be reopened later. |

## Development

### Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Build the production application into `dist/`. |
| `npm test` | Run the unit and browser test suites. |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format the code using Prettier. |

### Browser Tests

Install Playwright's Chromium browser before running the browser tests for the first time:

```bash
npx playwright install chromium
```

### Production Build

Build the application:

```bash
npm run build
```

The resulting `dist/` directory contains the static site and can be uploaded to a compatible static web host.

## Tech Stack

- **TypeScript** — Application logic and core editor functionality.
- **React** — User interface components.
- **Vite** — Development server and production build tooling.
- **Playwright** — Browser-based end-to-end testing.
- **ESLint** — Code linting.
- **Prettier** — Code formatting.

## Project Structure

```text
Framecraft/
├── docs/           # Product plan and development handover
├── public/         # Static assets
├── src/
│   ├── ui/         # React UI components
│   ├── styles/     # Design tokens and styles
│   └── ...         # Editor model, layout and exporters
├── tests/
│   ├── unit/       # Unit tests
│   ├── e2e/        # Browser tests
│   └── golden/     # Reference export fixtures
├── CLAUDE.md       # Claude Code project instructions
├── package.json
└── vite.config.ts
```

For more information about the architecture, current implementation, planned features, and remaining work, see the `docs/` directory.

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

Before starting significant changes, consider opening an issue to discuss the proposed feature or implementation.

For code contributions:

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

3. Make your changes and run the relevant checks:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. Commit and push your changes.
5. Open a pull request describing what changed and how it was tested.

## Roadmap

Framecraft is an evolving project. Potential areas for further development include:

- Expanding the available UI components and styling options.
- Improving layout editing and responsive design workflows.
- Refining export quality and compatibility.
- Improving automated test coverage.
- Polishing the editor experience and documentation.

Check the repository's issues and `docs/` for the current priorities.

## Disclaimer

Framecraft is an independent project and is **not affiliated with, sponsored by, or endorsed by Roblox Corporation**.

Roblox, Roblox Studio, and related names are trademarks of their respective owners.

## License

The applicable license and usage terms should be confirmed in the repository before redistributing or reusing the project.
