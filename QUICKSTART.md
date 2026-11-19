# Markdown PDF — Quick Start

Export any Markdown file to a polished PDF from VS Code or Zed — with a task or through the AI
assistant (MCP) — or from the command line.

This quick start shows VS Code first and Zed second. The same tool works from JetBrains, Vim/Neovim,
Claude Code, Claude Desktop, Cursor or any MCP client — see
[Other Editors & MCP Clients](https://matinfo.github.io/markdown-pdf-export/guide/other-editors).

---

## 1. Requirements

- **Node.js 20 or newer** (it includes `npx`)
- **A Chromium-based browser** — Google Chrome or Microsoft Edge (see [step 4](#4-browser))

There is nothing to install first. The task and the MCP entry below run
`npx -y markdown-pdf-export …`, which downloads the package into npm's cache on first use and reuses
it afterwards. The first run is slower because of the download; later runs start from the cache.

Optional: install it once with `npm install -g markdown-pdf-export`, then use
`"command": "markdown-pdf-export", "args": ["${file}"]` in the VS Code task or
`"command": "markdown-pdf-export", "args": ["$ZED_FILE"]` in the Zed task (and
`"command": "markdown-pdf-export", "args": ["mcp"]` for MCP). It starts faster, works offline, and the
version changes only when you run `npm update -g markdown-pdf-export`.

---

## 2. Add an Editor Task

### VS Code

Run **Tasks: Open User Tasks** from the Command Palette (or create `.vscode/tasks.json` in a project)
and add:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Markdown: Export to PDF",
      "type": "shell",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "${file}"],
      "presentation": { "reveal": "silent" },
      "problemMatcher": []
    }
  ]
}
```

Open a `.md` file, run **Tasks: Run Task** from the Command Palette (or **Terminal → Run Task…**) and
choose *Markdown: Export to PDF*. The PDF is saved next to your Markdown file. VS Code runs tasks only
when a folder is open, not on a single loose file. Optional key binding in `keybindings.json`:

```json
[
  {
    "key": "ctrl+alt+e",
    "command": "workbench.action.tasks.runTask",
    "args": "Markdown: Export to PDF",
    "when": "editorLangId == markdown"
  }
]
```

More: [VS Code guide](https://matinfo.github.io/markdown-pdf-export/guide/vscode).

### Zed

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

Open a `.md` file, run **task: spawn** and choose *Markdown: Export to PDF*. The PDF is saved next to
your Markdown file. Optional key binding in `keymap.json`:

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

More: [Zed guide](https://matinfo.github.io/markdown-pdf-export/guide/zed-task).

---

## 3. Enable the MCP Server (optional)

To let the AI assistant export, register the MCP server.

### VS Code

Run **MCP: Add Server** from the Command Palette, choose a local command (stdio) server and enter
`npx -y markdown-pdf-export mcp`. Or add the entry yourself; current VS Code releases read
`~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "markdown-pdf": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

### Zed

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

### Ask the Assistant

Open any `.md` file and ask the assistant:

```
Export this file to PDF
```

The PDF is saved next to your Markdown file by default.

---

## 4. Browser

PDFs are produced by Chromium's print-to-PDF engine, driven through Playwright's `page.pdf()`.
Playwright implements PDF generation only for Chromium — its Firefox and WebKit builds cannot produce
PDFs, and Safari cannot be driven this way — so a Chromium-based browser is required.

Google Chrome and Microsoft Edge are detected automatically, in that order, then Playwright's own
Chromium if you installed it. Nothing is downloaded automatically. If no browser is found, the export
fails with `No usable Chrome/Chromium browser found.` and a hint. Either install Chrome/Edge or run once:

```bash
npx -y markdown-pdf-export install-browser   # ~150 MB
```

Firefox and Safari users only need one Chromium-based browser installed alongside, or that one-time
download; the default browser is not changed or used.

To choose a browser, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or an executable
path. Other Chromium-based browsers (Brave, Vivaldi, …) can be used through their executable path, for
example `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` on macOS, but are not tested by
the project.

---

## 5. Common Exports

The prompts are for the AI assistant (MCP). With the task or the command line, use the flag instead —
in a task, add it to `args`.

| What you want | Ask the assistant (MCP) | CLI / task flag |
|---|---|---|
| Basic export | `Export this file to PDF` | *(none)* |
| Custom output path | `Export to docs/report.pdf` | `-o docs/report.pdf` |
| Dark code theme | `Export with the monokai theme` | `--highlight-style monokai.css` |
| Landscape layout | `Export in landscape orientation` | `--orientation landscape` |
| Header and footer | `Export with a footer showing page numbers` | `--footer '{"center_text":"Page {page} of {pages}"}'` |
| Check setup | `Run doctor_markdown_pdf` | `npx -y markdown-pdf-export doctor` |

```sh
npx -y markdown-pdf-export report.md -o docs/report.pdf --highlight-style monokai.css --orientation landscape
```

`--header` and `--footer` take the same JSON as the `header` / `footer` settings (section 8) and switch
the header and footer on. `--display-header-footer` alone only shows what your settings file or front
matter already defines; with nothing defined, the header and footer are empty.

---

## 6. Settings

Keep permanent defaults in a settings file, for example `~/.config/markdown-pdf/settings.json`:

```json
{
  "font_family": null,
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

Load it by absolute path (`~` is not expanded):

- **Task (VS Code):** add
  `"options": { "env": { "MARKDOWN_PDF_SETTINGS": "${userHome}/.config/markdown-pdf/settings.json" } }`
  to the task in `tasks.json` (`${userHome}` expands to your home folder)
- **Task (Zed):** add `"env": { "MARKDOWN_PDF_SETTINGS": "/Users/me/.config/markdown-pdf/settings.json" }`
  to the task in `tasks.json`
- **MCP:** put the same `"env"` as the Zed task, with the full path, in the `mcpServers.markdown-pdf`
  entry (VS Code) or the `context_servers.markdown-pdf` entry (Zed)
- **CLI:** `--settings /Users/me/.config/markdown-pdf/settings.json`

`MARKDOWN_PDF_SETTINGS` also accepts inline JSON. The JSON snippets in the sections below go in this
settings file. Full details: [Global Settings](https://matinfo.github.io/markdown-pdf-export/guide/global-settings).

---

## 7. Syntax Highlighting

Highlighting is **on by default** using the `github.css` theme.

Change the theme in settings, with `--highlight-style atom-one-dark.css`, or ask the assistant directly:

```
Export this file to PDF using the atom-one-dark theme
```

Popular themes:

| `github.css` | Light GitHub (default) |
|---|---|
| `github-dark.css` | Dark GitHub |
| `monokai.css` | Classic Monokai dark |
| `atom-one-dark.css` | Atom One Dark |
| `nord.css` | Nord |
| `tokyo-night-dark.css` | Tokyo Night |
| `rose-pine.css` | Rosé Pine |
| `vs.css` | Visual Studio light |
| `vs2015.css` | Visual Studio dark |
| `a11y-light.css` | Accessible light |
| `a11y-dark.css` | Accessible dark |

80+ themes available — browse them at [highlightjs.org/demo](https://highlightjs.org/demo).

To disable highlighting entirely (CLI: `--no-highlight`):

```json
{ "highlight": false }
```

---

## 8. Header and Footer

There are two ways to add headers and footers:

### Structured (Recommended)

Use zones (`left`, `center`, `right`) with typed elements:

```json
{
  "header": {
    "height": "15mm",
    "left_image": "./logo.svg",
    "left_image_height": "12mm",
    "center_text": "{title}",
    "right_text": "{date:MMMM d, yyyy}"
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

**Placeholders:** `{page}`, `{pages}`, `{date}`, `{date:FORMAT}`, `{title}`, `{filename}`, `{author}`, plus any front matter variable.

**Element types:** `text`, `image`, `page_number`, `total_pages`, `date`, `title`, `spacer`.

---

## 9. Page Layout Options

| Setting | Values | Default |
|---|---|---|
| `page_format` | `A4`, `Letter`, `Legal`, `A3`, `A5`, … | `A4` |
| `orientation` | `portrait`, `landscape` | `portrait` |
| `scale` | `0.1` – `2` | `1` |
| `page_ranges` | `"1-5, 8"` | all pages |
| `print_background` | `true` / `false` | `true` |

---

## 10. Custom Stylesheet

Append your own CSS on top of the built-in neutral styles:

```json
{ "stylesheet_path": "./custom.css" }
```

To use **only** your stylesheet (no built-in CSS):

```json
{
  "include_default_styles": false,
  "stylesheet_path": "./custom.css"
}
```

---

## 11. Page Breaks

The built-in stylesheet includes a `.page` utility class:

```html
<div class="page"></div>
```

Place it anywhere in your Markdown — HTML pass-through is enabled by default.

---

## 12. Front Matter

### Document Title

The `title` field sets the document title used in headers and the HTML `<title>`:

```markdown
---
title: Project Report Q2
---
```

### Per-Document PDF Settings

Override any setting for a specific document with `pdf:`:

```markdown
---
title: Quarterly Report
author: Jane Smith
company: Acme Corp
pdf:
  page_format: Letter
  header:
    left_text: "{company}"
    center_text: "{title}"
    right_text: "{date:MMMM d, yyyy}"
  footer:
    center_text: "Page {page} of {pages}"
---
```

Custom front matter fields (`company`, `author`) become `{placeholders}` in headers/footers.

---

## 13. Diagnostics

If something goes wrong, run the diagnostic from a terminal:

```bash
npx -y markdown-pdf-export doctor
```

Or ask the assistant:

```
Run doctor_markdown_pdf
```

For a debug log, set `MARKDOWN_PDF_DEBUG=1` (for example in the `env` of the MCP entry).
The log is written to `markdown-pdf-debug.log` in the OS temp directory — on macOS that is under
`/var/folders/…/T/`, not `/tmp`. Set `MARKDOWN_PDF_DEBUG=/some/file.log` to choose the path.

---

## Full Documentation

- [`README.md`](README.md) — Complete settings reference
- [Online Documentation](https://matinfo.github.io/markdown-pdf-export/) — Full structured header/footer reference