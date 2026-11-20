# Contributing

Thanks for helping. This page covers the development setup, tests, how the code is laid out, and
how releases work. User documentation lives on the
[docs site](https://matinfo.github.io/markdown-pdf-export/).

## Development setup

You need Node.js 20 or newer and Google Chrome or Microsoft Edge. From the repository root:

```sh
npm install
node cli.mjs test-fixtures/sample.md -o /tmp/sample.pdf
node cli.mjs doctor
node cli.mjs studio
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run check` | Syntax check of the entry files |
| `npm run lint` | ESLint |
| `npm run build` | Check, bundle the KaTeX CSS into `vendor/`, check the settings schema is up to date |
| `npm run build:schema` | Regenerate `schema/settings.schema.json` and the docs copy |
| `npm test` | Unit tests (`node --test lib/__tests__/*.test.mjs`) |
| `npm run test:export` | End-to-end export of the test fixtures (needs a browser) |
| `npm run test:all` | Unit and end-to-end tests |
| `npm run smoke:pack` | Build the npm tarball, install it in a clean folder, run the CLI and MCP server |
| `npm run ci` | Lint, build and all tests, as CI runs them |

Run `npm run build:schema` after changing a setting, or `npm run build` will fail.
`./test-mcp-init.sh` checks the MCP handshake. [TESTING.md](TESTING.md) has more detail.

## Testing in an editor

Point a task or an MCP entry at your checkout instead of `npx`:

- VS Code task: `node /path/to/repo/cli.mjs ${file}`
- Zed task: `node /path/to/repo/cli.mjs $ZED_FILE`
- MCP server: `node /path/to/repo/mcp.mjs`

Then open `test-fixtures/sample.md` and run the task, or ask the assistant "Export this file to PDF".

## Project structure

```
cli.mjs              the markdown-pdf-export command
export.mjs           core: Markdown to HTML to PDF, doctor, browser lookup
mcp.mjs              MCP server on stdio
tool-schemas.mjs     options shared by CLI flags and MCP tools
default.css          built-in stylesheet (the Clean style)
looks/               CSS for the Report, Academic, Compact and Technical styles
templates/           starting settings files for init --template
studio/              the Studio page (HTML, CSS, browser code, sample document)
lib/                 settings, front matter, header/footer, editor setup, Studio server
lib/__tests__/       unit tests
schema/              generated JSON schema for the settings file
scripts/             build and packaging scripts
vendor/              generated KaTeX CSS
test-fixtures/       sample documents and the end-to-end test
docs/                documentation site (VitePress)
server.json          MCP registry metadata
```

## Architecture

- One Node.js package with two front ends: the CLI (`cli.mjs`) and the MCP server (`mcp.mjs`).
  Both call the core in `export.mjs`, which has no side effects at import.
- CLI flags are generated from the same schemas as the MCP tools (`tool-schemas.mjs`), so they
  cannot drift apart.
- Rendering: `markdown-it` with highlight.js, KaTeX, emoji and contents-list plugins builds HTML;
  Chromium prints it to PDF.
- Settings: the user file, then the nearest `.markdown-pdf.json`, then CLI flags or tool
  arguments, then the document's front matter `pdf:` block. Later wins.
- Browser: Chrome, then Edge, then Playwright's Chromium if installed. Nothing is downloaded at run
  time.
- Studio (`lib/studio-server.mjs`) listens on 127.0.0.1 only, needs a per-launch token, writes only
  to the settings file and its `assets/` folder, and stops when the page has been closed.

## Why Chromium and Playwright

Playwright gives a full browser engine: real CSS (flexbox, grid, web fonts, `@media print`), reliable
page breaks, page numbers in headers and footers, and local images and fonts. Playwright can only
make PDFs with Chromium, so Firefox and Safari cannot be used. We use `playwright-core` and the
Chrome or Edge already installed, so no browser is bundled.

## Why not an editor extension

A task plus the MCP server works in any editor, with one settings file for all of them. The Zed
extension registry no longer takes new MCP-server extensions, and its extension API cannot yet run
an exporter. A thin extension that adds a Markdown task may follow once Zed supports tasks in
extensions.

## Docs site

```sh
cd docs && bun install && bun run dev
```

## Releases

`.github/workflows/npm-publish.yml` publishes to npm and to the MCP Registry when a tag
`npm-v<version>` is pushed. It uses npm trusted publishing (OIDC), so no token is stored.

1. Bump `version` in `package.json` (and `server.json`; `npm run smoke:pack` checks they match).
2. Push the tag: `git tag npm-v<version> && git push origin npm-v<version>`.

The first version had to be published by hand before trusted publishing could be set up on npmjs.com.
