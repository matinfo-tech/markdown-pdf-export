# Markdown PDF for Zed

[![Version](https://img.shields.io/github/v/release/matinfo/zed-markdown-pdf?label=version&color=blue)](https://github.com/matinfo/zed-markdown-pdf/releases)
[![Publish](https://github.com/matinfo/zed-markdown-pdf/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/matinfo/zed-markdown-pdf/actions/workflows/npm-publish.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue?logo=gitbook)](https://matinfo.github.io/zed-markdown-pdf/)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?logo=github)](https://github.com/matinfo/zed-markdown-pdf)

Export Markdown files to high-quality PDFs from Zed, from any MCP client, or from the command line, using Chromium.

The exporter ships as the npm package `markdown-pdf-export`: a **CLI** and an **MCP server**. In Zed you run it as a **task** (no extension needed) or let the AI agent call it over **MCP**.

## Setup

You need **Node.js 20 or newer** (it includes `npx`) and a **Chromium-based browser** such as Google
Chrome or Microsoft Edge (see [Browser](#browser)).

There is no install step. `npx -y markdown-pdf-export …` downloads the package into npm's cache on
first use and reuses it afterwards, so the first run is slower and later runs start from the cache.

Optional: install it once with `npm install -g markdown-pdf-export`, then use
`"command": "markdown-pdf-export", "args": ["$ZED_FILE"]` in the task (and
`"command": "markdown-pdf-export", "args": ["mcp"]` for MCP). It starts faster, works offline, and the
version changes only when you run `npm update -g markdown-pdf-export`.

### 1. Zed task (recommended)

Add this to `~/.config/zed/tasks.json` (or to `.zed/tasks.json` in a project):

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

Then run **task: spawn** and choose *Markdown: Export to PDF*. The PDF is written next to the Markdown
file. To bind it to a key, add this to `keymap.json`:

```json
[
  {
    "context": "Workspace",
    "bindings": {
      "cmd-alt-e": ["task::Spawn", { "task_name": "Markdown: Export to PDF" }]
    }
  }
]
```

More: [Zed Task guide](https://matinfo.github.io/zed-markdown-pdf/guide/zed-task) — fixed options, several presets, settings file.

### 2. MCP: let the Zed agent (or any MCP client) export

Add this to Zed's `settings.json`:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"],
      "env": { "MARKDOWN_PDF_SETTINGS": "{\"page_format\":\"A4\"}" }
    }
  }
}
```

The server exposes two tools, `export_markdown_pdf` and `doctor_markdown_pdf`. Its MCP registry
name is `io.github.matinfo/markdown-pdf-export`. More: [AI Assistant (MCP) guide](https://matinfo.github.io/zed-markdown-pdf/guide/mcp).

### 3. Command line

```sh
npx -y markdown-pdf-export README.md               # → README.pdf next to the file
npx -y markdown-pdf-export doc.md -o out.pdf --math --toc --page-format Letter
npx -y markdown-pdf-export doctor                  # check browser + settings
npx -y markdown-pdf-export --help                  # all options
```

Flags mirror the MCP tool's options in kebab-case (`--page-format Letter`, `--math`, `--toc`,
`--no-highlight`, `--margin 10mm` or `--margin '{"top":"10mm"}'`), plus `-o/--output` and
`--settings <json|file.json>`. The CLI prints the PDF path on stdout and exits with `0` (ok), `1` (error)
or `2` (usage error). More: [Command Line guide](https://matinfo.github.io/zed-markdown-pdf/guide/cli) — every option.

### Browser

**Why Chromium, and not Firefox or Safari?** PDFs are produced by Chromium's print-to-PDF engine,
driven through Playwright's `page.pdf()`. Playwright implements PDF generation only for Chromium: its
Firefox and WebKit builds cannot produce PDFs, and Safari itself cannot be driven this way. The
header/footer templates, page ranges, margins, scale and background printing documented here are
options of that Chromium engine.

So any Chromium-based browser works:

- **Google Chrome** and **Microsoft Edge** are detected automatically, in that order.
- Then **Playwright's own Chromium**, if you installed it. Nothing is downloaded unless you ask for it:

  ```sh
  npx -y markdown-pdf-export install-browser   # optional, ~150 MB
  ```

- **Other Chromium-based browsers** (Brave, Vivaldi, Chromium builds, …) can be used by setting
  `MARKDOWN_PDF_BROWSER` to the path of the browser executable, for example
  `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` on macOS. These are not tested by
  the project.

`MARKDOWN_PDF_BROWSER` accepts `chrome`, `msedge`, `chromium`, or an executable path. The Chrome and
Edge channel variants `chrome-beta`, `chrome-dev`, `chrome-canary`, `msedge-beta`, `msedge-dev` and
`msedge-canary` are also accepted.

If you use Firefox or Safari, you only need one Chromium-based browser installed alongside, or the
one-time `install-browser` download (~150 MB). Your default browser is not changed or used.
More: [Browser guide](https://matinfo.github.io/zed-markdown-pdf/guide/browser).

### Why not a Zed extension?

The Zed extension registry no longer accepts new MCP-server extensions (the official MCP registry
replaces them), and the extension API has no command surface yet for running an exporter. Zed tasks
cover this use case today. Zed is adding tasks support to the extension API, so a thin extension that
contributes a Markdown task may follow.

---

## Overview

Markdown PDF exports Markdown documents to PDF with:

- **Syntax highlighting** for fenced code blocks via highlight.js (80+ themes)
- **[Math rendering](https://matinfo.github.io/zed-markdown-pdf/guide/math)** via KaTeX (`$inline$`, `$$display$$`) — fonts inlined, fully self-contained
- **[Table of contents](https://matinfo.github.io/zed-markdown-pdf/guide/toc-and-anchors)** auto-generated from `[[toc]]` marker with clickable heading anchors
- **Emoji shortcodes** rendered to Unicode via markdown-it-emoji
- **[Structured header/footer](https://matinfo.github.io/zed-markdown-pdf/guide/header-footer)** with zones (left, center, right), custom variables, and date formatting
- **[Per-document overrides](https://matinfo.github.io/zed-markdown-pdf/guide/front-matter)** via YAML front matter (`pdf:` block)
- **Configurable page layout** — format, orientation, scale, margins, page ranges
- **[Custom CSS](https://matinfo.github.io/zed-markdown-pdf/guide/custom-styling)** support appended after the built-in neutral stylesheet
- **No runtime installs** — dependencies come with the npm package; uses your installed Chrome or Edge

📖 **Full documentation:** <https://matinfo.github.io/zed-markdown-pdf/> · [Settings reference](https://matinfo.github.io/zed-markdown-pdf/reference/settings) · [Getting started](https://matinfo.github.io/zed-markdown-pdf/guide/getting-started)

---

## Features

- Zed integration through a task or a context server (MCP); standalone CLI
- Markdown to PDF powered by Playwright / Chromium
- Neutral, GitHub-style built-in stylesheet (or disable it and bring your own)
- Syntax highlighting via highlight.js — 80+ themes to choose from
- Math rendering via KaTeX (`$inline$` and `$$display$$` syntax), with custom macros
- Auto-generated table of contents from a `[[toc]]` marker; heading anchors for in-document links
- Emoji `:shortcode:` rendering via markdown-it-emoji
- Hard line-break mode for poetry or source-formatted text
- Structured header/footer with zones, typed elements, and custom variables
- Per-document settings via YAML front matter (`pdf:` block)
- Portrait and landscape orientation
- Page scale factor
- Page ranges (print only selected pages)
- Per-export overrides for every PDF option
- Automatic relative asset resolution (local images, fonts, …)
- Built-in diagnostic (`doctor` command / `doctor_markdown_pdf` tool)
- Cross-platform: macOS, Linux, Windows

---

## Usage

### Task and command line

Run the Zed task on the open Markdown file, or call the CLI. Options are flags (in a task, add them
to `args`):

```sh
npx -y markdown-pdf-export doc.md                                   # PDF next to the file
npx -y markdown-pdf-export doc.md -o build/report.pdf --highlight-style monokai.css
npx -y markdown-pdf-export doc.md --orientation landscape --page-format A4 --display-header-footer
npx -y markdown-pdf-export doctor                                   # browser status and settings
```

### Natural-language prompts

With the MCP server enabled, open any Markdown file and describe what you want to the assistant:

| Prompt | What happens |
|--------|-------------|
| `Export this file to PDF` | Generates a PDF next to the source file |
| `Export to build/report.pdf with monokai theme` | Custom output path + highlight theme |
| `Export in landscape A4 with header and footer` | Orientation + header/footer enabled |
| `Run export_markdown_pdf for file <path>` | Exports the specified Markdown file to PDF |
| `Run doctor_markdown_pdf` | Shows Chromium status and active settings |

### MCP tools

The MCP server exposes two tools directly callable by the AI:

- **`export_markdown_pdf`** — convert a Markdown file to PDF
- **`doctor_markdown_pdf`** — inspect Chromium availability and current settings

---

## Settings

Settings are a plain JSON object. Keep it in a file, for example
`~/.config/markdown-pdf/settings.json`, and reference it by absolute path (`~` is not expanded):

- **Zed task** — add `"env": { "MARKDOWN_PDF_SETTINGS": "/Users/me/.config/markdown-pdf/settings.json" }`
  to the task object in `tasks.json`.
- **MCP** — use the same `"env"` in the `context_servers.markdown-pdf` entry, next to `command` and `args`.
- **CLI** — pass `--settings /Users/me/.config/markdown-pdf/settings.json`.

`MARKDOWN_PDF_SETTINGS` and `--settings` accept either a path to a JSON file or inline JSON.
Precedence, highest first: front matter `pdf:` block, CLI flags / tool arguments, `--settings`,
`MARKDOWN_PDF_SETTINGS`, built-in defaults.

Example `settings.json`:

```json
{
  "page_format": "A4",
  "orientation": "portrait",
  "print_background": true,
  "highlight": true,
  "highlight_style": "github.css",
  "emoji": true,
  "display_header_footer": false,
  "open_after_export": false,
  "margin": {
    "top": "15mm",
    "right": "15mm",
    "bottom": "15mm",
    "left": "15mm"
  }
}
```

### Output

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `output_directory` | `string \| null` | `null` | Directory for the output PDF. Relative to the Markdown file. |
| `open_after_export` | `boolean` | `false` | Open the PDF in the system viewer after export. |

### Page Layout

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `page_format` | `string` | `"A4"` | Paper size: `A4`, `Letter`, `Legal`, `Tabloid`, `Ledger`, `A0`–`A3`, `A5`, `A6`. |
| `orientation` | `string` | `"portrait"` | `"portrait"` or `"landscape"`. |
| `scale` | `number` | `1` | Page rendering zoom (0.1 – 2). |
| `page_ranges` | `string` | `""` | Pages to print, e.g. `"1-5, 8, 11-13"`. Empty = all pages. |
| `print_background` | `boolean` | `true` | Print background colours and images. |
| `margin` | `object` | see below | Per-side page margins as CSS length strings. |

Default margins: `{ "top": "15mm", "right": "15mm", "bottom": "15mm", "left": "15mm" }`

### Content / Rendering

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `font_family` | `string \| null` | `null` | CSS `font-family` value for the document body **and** header/footer. `null` keeps the default system-font stack. Example: `"Georgia, 'Times New Roman', serif"`. |
| `include_default_styles` | `boolean` | `true` | Include the built-in neutral CSS. Set `false` to use only your own `stylesheet_path`. |
| `stylesheet_path` | `string \| null` | `null` | Path to a custom CSS file appended after built-in styles. Relative to the Markdown file. |
| `breaks` | `boolean` | `false` | Convert single newlines inside paragraphs to hard `<br>` line breaks. |
| `emoji` | `boolean` | `true` | Render `:shortcode:` emoji (`:wave:` → 👋). |

### Syntax Highlighting

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `highlight` | `boolean` | `true` | Enable syntax highlighting for fenced code blocks. |
| `highlight_style` | `string` | `"github.css"` | Highlight.js theme filename. See the list below. |

Popular themes:

| Theme | Style |
|-------|-------|
| `github.css` | Light GitHub (default) |
| `github-dark.css` | Dark GitHub |
| `monokai.css` | Classic Monokai |
| `atom-one-dark.css` | Atom One Dark |
| `vs.css` | Visual Studio light |
| `vs2015.css` | Visual Studio dark |
| `nord.css` | Nord |
| `tokyo-night-dark.css` | Tokyo Night dark |
| `rose-pine.css` | Rosé Pine |
| `a11y-light.css` | Accessible light |
| `a11y-dark.css` | Accessible dark |
| `obsidian.css` | Dark Obsidian |
| `stackoverflow-light.css` | Stack Overflow light |
| `stackoverflow-dark.css` | Stack Overflow dark |

Browse all 80+ themes at the [highlight.js demo](https://highlightjs.org/demo).

### Header and Footer

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `display_header_footer` | `boolean` | `false` | Show header and footer on every page. |
| `header` | `object \| null` | `null` | Structured header configuration. |
| `footer` | `object \| null` | `null` | Structured footer configuration. |

When `header` or `footer` is configured, `display_header_footer` is automatically enabled.

---

### Structured Header/Footer (Recommended)

The structured format uses zones (`left`, `center`, `right`) with typed elements:

```json
{
  "header": {
    "height": "15mm",
    "padding": "0 10mm",
    "font_size": "9px",
    "border_bottom": "1px solid #ddd",
    "left": {
      "type": "image",
      "src": "./logo.svg",
      "height": "12mm"
    },
    "center": {
      "type": "title",
      "font_style": "italic"
    },
    "right": {
      "type": "date",
      "format": "MMMM d, yyyy"
    }
  },
  "footer": {
    "height": "10mm",
    "center": {
      "type": "text",
      "content": "Page {page} of {pages}"
    }
  }
}
```

#### Element Types

| Type | Description | Key Properties |
|------|-------------|----------------|
| `text` | Static or dynamic text | `content` (with placeholders) |
| `image` | Embedded image (SVG, PNG, JPG) | `src`, `height`, `width` |
| `page_number` | Current page number | `format` (e.g., `"Page {page}"`) |
| `total_pages` | Total page count | `format` |
| `date` | Formatted date/time | `format` (date-fns pattern) |
| `title` | Document title | `fallback` |
| `spacer` | Flexible space | `width` (fixed) or flex |

#### Placeholders

Use placeholders in `text` elements or `format` strings:

| Placeholder | Description |
|-------------|-------------|
| `{page}` | Current page number (Chromium) |
| `{pages}` | Total pages (Chromium) |
| `{date}` | Current date (ISO format) |
| `{date:FORMAT}` | Formatted date (date-fns) |
| `{title}` | Document title |
| `{filename}` | Source filename |
| `{author}` | Author from front matter |
| `{custom}` | Any front matter variable |

#### Date Formats (date-fns)

| Format | Example |
|--------|---------|
| `yyyy-MM-dd` | 2025-06-14 |
| `MMMM d, yyyy` | June 14, 2025 |
| `MM/dd/yyyy` | 06/14/2025 |
| `dd.MM.yyyy` | 14.06.2025 |
| `d MMMM yyyy` | 14 June 2025 |

#### Shorthand Properties

For simple cases, use shorthand instead of full element definitions:

```json
{
  "header": {
    "left_image": "./logo.svg",
    "left_image_height": "12mm",
    "center_text": "{title}",
    "right_text": "{date:MMMM d, yyyy}"
  }
}
```

#### Container Properties

| Property | Description |
|----------|-------------|
| `height` | Header/footer height (e.g., `"15mm"`) |
| `padding` | CSS padding (e.g., `"0 10mm"`) |
| `font_family` | Default font for all text |
| `font_size` | Default font size |
| `color` | Default text color |
| `border_bottom` | Header bottom border |
| `border_top` | Footer top border |
| `background` | Background color |

---

## Per-Export Overrides

Every setting can also be passed for a one-off override: as a CLI flag (`--orientation landscape`)
or directly in the tool call. With MCP, just describe what you want to the assistant:

```
Export this to PDF in landscape, Letter format, with the monokai theme,
header and footer enabled, and output it to build/slides.pdf
```

Margin overrides are merged: omitted sides fall back to your configured defaults.

---

## Front Matter

### Document Title

The YAML front matter `title` field is used as the document title (HTML `<title>` and Chromium's `<span class="title">`).

```markdown
---
title: My Report
---

# Content starts here
```

If no `title` is present, the filename stem is used.

### Per-Document PDF Settings

Override any setting for a specific document using the `pdf:` block:

```markdown
---
title: Quarterly Report
author: Jane Smith
company: Acme Corp
version: 1.0.0
pdf:
  page_format: Letter
  orientation: landscape
  header:
    height: 18mm
    padding: 0 15mm
    border_bottom: 1px solid #ccc
    left:
      - type: text
        content: "{company}"
        font_weight: bold
    center:
      type: title
      font_style: italic
    right:
      type: date
      format: MMMM d, yyyy
  footer:
    height: 12mm
    left:
      type: text
      content: "v{version}"
      color: "#666"
    center:
      type: text
      content: "Page {page} of {pages}"
    right:
      type: text
      content: "{author}"
---

# Content starts here
```

**Custom variables:** Any front matter field (like `company`, `version`) becomes
available as a `{fieldname}` placeholder in headers and footers.

**Priority order:** Front matter settings override per-export options and global settings, which override defaults.

---

## Custom Styling

Append a custom stylesheet to control the PDF appearance:

```css
/* custom.css */
body {
  font-family: Georgia, serif;
  font-size: 12pt;
}

h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
}
```

In your settings file:

```json
{
  "stylesheet_path": "./custom.css"
}
```

Set `"include_default_styles": false` to use your stylesheet exclusively, without the built-in neutral CSS.

---

## Page Break Helper

The built-in stylesheet provides a `.page` utility class for hard page breaks:

```html
<div class="page"></div>
```

Place it anywhere in your Markdown (HTML pass-through is enabled by default).

---

## Project Structure

```
.
├── package.json                      # npm package `markdown-pdf-export`
├── cli.mjs                           # CLI (`markdown-pdf-export` bin)
├── export.mjs                        # Core: export, doctor, browser launch/install
├── mcp.mjs                           # MCP stdio server
├── tool-schemas.mjs                  # Tool schemas shared by CLI and MCP
├── lib/                              # Rendering, front matter, header/footer helpers
├── default.css                       # Built-in neutral stylesheet
├── server.json                       # MCP registry metadata
├── scripts/
│   └── bundle-katex-css.mjs          # Generates vendor/ (inlined KaTeX CSS)
├── vendor/                           # Generated
├── docs/                             # Documentation site (VitePress)
├── test-fixtures/                    # Sample documents and end-to-end test runner
├── test-mcp-init.sh                  # MCP handshake smoke test for mcp.mjs
└── README.md                         # This file (also the npm README)
```

---

## Development

From the repository root:

```bash
npm install
npm run check          # syntax check
npm test               # unit tests
npm run test:export    # end-to-end export test
node cli.mjs test-fixtures/sample.md -o /tmp/sample.pdf
node cli.mjs doctor
./test-mcp-init.sh     # MCP handshake smoke test
```

### Publishing

`.github/workflows/npm-publish.yml` publishes the package to npm and registers the server in the MCP
Registry when a tag matching `npm-v*` is pushed. It uses npm trusted publishing (OIDC), so no token
secret is needed.

- **One-time setup:** on npmjs.com, open the package's **Settings → Trusted Publisher** and enter user
  `matinfo`, repository `zed-markdown-pdf`, workflow filename `npm-publish.yml`. The package must exist
  first, so publish the very first version by hand with `npm publish`.
- **Later releases:** bump `version` in `package.json` and `SERVER_VERSION` in `export.mjs`, then push
  the tag `npm-v<version>`.

### Testing in Zed

Point a task or a `context_servers` entry (see [Setup](#setup)) at your checkout:

- Task: `"command": "node", "args": ["/path/to/repo/cli.mjs", "$ZED_FILE"]`
- MCP: `"command": "node", "args": ["/path/to/repo/mcp.mjs"]`

Then open `test-fixtures/sample.md` and run the task, or ask the assistant: `Export this file to PDF`.
See [TESTING.md](TESTING.md) for details.

---

## Troubleshooting

### Context server does not start

- Confirm the `markdown-pdf` entry is present and enabled in **Agent → Context Servers**
- Check that `npx -y markdown-pdf-export --help` works in a terminal
- Restart Zed
- Check Zed logs (**Help → View Logs**)
- Set `MARKDOWN_PDF_DEBUG=1` (in the `env` of the `context_servers` entry) and inspect
  `<tmpdir>/markdown-pdf-debug.log` — the OS temp directory, which on macOS is under `/var/folders/…/T/`,
  not `/tmp`. Set `MARKDOWN_PDF_DEBUG=/some/file.log` to log to a path of your choice.

### PDF export fails

Run the diagnostic, from a terminal or by asking the assistant:

```
npx -y markdown-pdf-export doctor
Run doctor_markdown_pdf
```

This reports browser availability (and which browser was picked, in `browser.launch_options`), the
active settings, and the package directory in one call.

### No usable Chrome/Chromium browser found

The exporter needs a Chromium-based browser (see [Browser](#browser)) and does not download one on its
own. Install Google Chrome or Microsoft Edge, point `MARKDOWN_PDF_BROWSER` at a browser (`chrome`,
`msedge`, `chromium` or an executable path), or download Playwright's Chromium (~150 MB):

```bash
npx -y markdown-pdf-export install-browser
```

---

## Architecture

The project is a single Node.js package at the repository root, published to npm as `markdown-pdf-export`:

- `export.mjs` — core: renders Markdown → HTML with `markdown-it`, `highlight.js`, `markdown-it-emoji`,
  converts HTML → PDF with Playwright / Chromium, runs the diagnostic. No side effects at import.
- `cli.mjs` — the `markdown-pdf-export` command (export, `doctor`, `install-browser`, `mcp`)
- `mcp.mjs` — MCP stdio server exposing `export_markdown_pdf` and `doctor_markdown_pdf`
- `tool-schemas.mjs` — input schemas shared by the CLI flags and the MCP tools
- Settings: `MARKDOWN_PDF_SETTINGS` (file path or inline JSON) or `--settings`, merged with per-export
  options and front matter
- Browser lookup: Google Chrome → Microsoft Edge → Playwright's Chromium (if present); nothing is
  installed at runtime

---

## Why Playwright

Playwright provides a full browser rendering engine, which means:

- accurate CSS rendering (Flexbox, Grid, custom fonts, `@media print`)
- reliable pagination and page breaks
- native PDF header/footer support with page numbers
- correct resolution of local assets (images, fonts)

---

## License

MIT
