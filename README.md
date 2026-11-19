# Markdown PDF for Zed

[![Version](https://img.shields.io/github/v/release/matinfo/zed-markdown-pdf?label=version&color=blue)](https://github.com/matinfo/zed-markdown-pdf/releases)
[![CI](https://github.com/matinfo/zed-markdown-pdf/actions/workflows/server-release.yml/badge.svg)](https://github.com/matinfo/zed-markdown-pdf/actions/workflows/server-release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue?logo=gitbook)](https://matinfo.github.io/zed-markdown-pdf/)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey?logo=github)](https://github.com/matinfo/zed-markdown-pdf)

Export Markdown files to high-quality PDFs from Zed, from any MCP client, or from the command line, using Chromium.

The exporter ships as the npm package [`markdown-pdf-export`](server/README.md): a **CLI** and an **MCP server**. In Zed you run it as a **task** (no extension needed) or let the AI agent call it over **MCP**.

## Setup

You need Node.js 18 or newer and a Chrome-family browser (see [Browser](#browser)).

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

Then run **task: spawn** and choose *Markdown: Export to PDF*. To bind it to a key, add this to
`keymap.json`:

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
name is `io.github.matinfo/markdown-pdf-export`.

### 3. Command line

```sh
npx -y markdown-pdf-export README.md               # → README.pdf next to the file
npx -y markdown-pdf-export doc.md -o out.pdf --math --toc --page-format Letter
npx -y markdown-pdf-export doctor                  # check browser + settings
npx -y markdown-pdf-export --help                  # all options
```

Flags mirror the MCP tool's options in kebab-case (`--page-format Letter`, `--math`, `--toc`,
`--no-highlight`, `--margin 10mm` or `--margin '{"top":"10mm"}'`), plus `-o/--output` and
`--settings <json|file>`. The CLI prints the PDF path on stdout and exits with `0` (ok), `1` (error)
or `2` (usage error).

### Browser

The exporter uses an installed **Google Chrome** or **Microsoft Edge** first, then Playwright's
Chromium if it is already present. Nothing is downloaded unless you ask for it:

```sh
npx -y markdown-pdf-export install-browser   # optional, ~150 MB
```

To pick a browser yourself, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or the path
to an executable.

### Why not a Zed extension?

The Zed extension registry no longer accepts new MCP-server extensions (the official MCP registry
replaces them), and the extension API has no command surface yet for running an exporter. Zed tasks
cover this use case today. Zed is adding tasks support to the extension API, so a thin extension that
contributes a Markdown task may follow. The original extension remains available as a
[dev extension](#legacy-dev-extension) but is not in the Zed registry.

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

## Legacy: dev extension

The original Zed extension is kept for development and is **not** in the Zed registry. It downloads
the server as a release archive that already bundles its production `node_modules`, so nothing is
installed at runtime. It still needs a browser (see [Browser](#browser)).

Requirements to build it from source:

- Rust with the `wasm32-wasip1` target
- Node.js 18 or newer

```bash
rustup target add wasm32-wasip1
node --version   # must be ≥ 18
```

### Install as a dev extension

1. Open Zed
2. Open the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run `zed: install dev extension`
4. Select the root folder of this repository

Zed will compile and install the extension.

### Enable the context server

1. Open Zed Settings
2. Go to **Agent → Context Servers**
3. Enable **markdown-pdf**

With the dev extension, settings go under `context_servers.markdown-pdf.settings` (see [Settings](#settings)).

---

## Usage

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

Settings are a JSON object. Pass them through the `MARKDOWN_PDF_SETTINGS` environment variable
(for example in the `env` of the `context_servers` entry above) or with the CLI's
`--settings <json|file>`. CLI flags override them, and a `pdf:` block in a document's
[front matter](#front-matter) overrides everything for that document. With the legacy dev extension,
put the same object in Zed's `settings.json` under `context_servers.markdown-pdf.settings`:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "settings": {
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
    }
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

Every setting can also be passed directly in the tool call for a one-off override.
Just describe what you want to the assistant:

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

**Priority order:** Front matter settings override global settings, which override defaults.

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
├── src/
│   └── lib.rs                        # Rust Zed extension (legacy, dev only)
├── configuration/
│   ├── installation_instructions.md  # Shown in Zed's context server UI
│   ├── settings_schema.json          # JSON Schema for settings validation
│   └── default_settings.json        # Default values
├── server/                           # npm package `markdown-pdf-export`
│   ├── export.mjs                    # Core: export, doctor, browser launch/install
│   ├── cli.mjs                       # CLI (`markdown-pdf-export` bin)
│   ├── mcp.mjs                       # MCP stdio server
│   ├── tool-schemas.mjs              # Tool schemas shared by CLI and MCP
│   ├── markdown_pdf_server.mjs       # Shim importing mcp.mjs (legacy extension entry)
│   ├── lib/                          # Rendering, front matter, header/footer helpers
│   ├── default.css                   # Built-in neutral stylesheet
│   ├── server.json                   # MCP registry metadata
│   ├── README.md                     # npm package README
│   └── package.json
├── scripts/
│   └── package-server.sh             # Builds the legacy extension's server archive
├── test-fixtures/
├── Cargo.toml
└── extension.toml
```

---

## Development

### Server

```bash
cd server
npm install
npm run check          # syntax check
npm test               # unit tests
npm run test:export    # end-to-end export test
node cli.mjs ../test-fixtures/sample.md -o /tmp/sample.pdf
node cli.mjs doctor
```

The npm package is published by `.github/workflows/npm-publish.yml` when a tag matching `npm-v*` is
pushed (requires the `NPM_TOKEN` secret).

### Rust extension (legacy)

```bash
rustup target add wasm32-wasip1
```

### Testing in Zed

Point a task or a `context_servers` entry (see [Setup](#setup)) at your checkout, for example
`"command": "node", "args": ["/path/to/repo/server/mcp.mjs"]`, or use the legacy dev extension:

1. Install as a dev extension
2. Enable `markdown-pdf` in Agent → Context Servers
3. Open `test-fixtures/sample.md`
4. Ask: `Export this file to PDF`

---

## Troubleshooting

### Dev extension fails to build

Ensure Rust and the WASM target are installed:

```bash
rustup target add wasm32-wasip1
```

On macOS with multiple Rust installations, ensure `rustc`, `cargo`, and `rustup` all resolve from `~/.cargo/bin`.

### Context server does not start

- Confirm `markdown-pdf` is enabled in **Agent → Context Servers**
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

This reports browser availability, active settings, and the server directory in one call.

### No usable Chrome/Chromium browser found

The exporter does not download a browser on its own. Install Google Chrome or Microsoft Edge, point
`MARKDOWN_PDF_BROWSER` at a browser (`chrome`, `msedge`, `chromium` or an executable path), or download
Playwright's Chromium (~150 MB):

```bash
npx -y markdown-pdf-export install-browser
```

---

## Architecture

### Rust Zed extension (`src/lib.rs`)

Legacy, dev only — not in the Zed registry.

- Registers the extension with Zed
- Downloads the server release archive (with bundled `node_modules`)
- Exposes context server configuration and settings schema
- Passes `MARKDOWN_PDF_SETTINGS` env var to the Node server

### Node.js package (`server/`)

- `export.mjs` — core: renders Markdown → HTML with `markdown-it`, `highlight.js`, `markdown-it-emoji`,
  converts HTML → PDF with Playwright / Chromium, runs the diagnostic. No side effects at import.
- `cli.mjs` — the `markdown-pdf-export` command (export, `doctor`, `install-browser`, `mcp`)
- `mcp.mjs` — MCP stdio server exposing `export_markdown_pdf` and `doctor_markdown_pdf`
- `tool-schemas.mjs` — input schemas shared by the CLI flags and the MCP tools
- `markdown_pdf_server.mjs` — one-line shim importing `mcp.mjs`, kept for the legacy extension
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
