# Markdown PDF — Quick Start

Export any Markdown file to a polished PDF from Zed — with a task or through the AI assistant (MCP).

> **Requires:** Node.js ≥ 18 and Google Chrome or Microsoft Edge (or see step 3).

---

## 1. Add a Zed Task

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

Open a `.md` file, run **task: spawn** and choose *Markdown: Export to PDF*. Optional key binding in
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

---

## 2. Enable the MCP Server (optional)

To let the AI assistant export, add this to Zed's `settings.json`:

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

Then open any `.md` file and ask the assistant:

```
Export this file to PDF
```

The PDF is saved next to your Markdown file by default.

---

## 3. Browser

Nothing is downloaded automatically. The exporter uses Google Chrome, then Microsoft Edge, then
Playwright's Chromium if it is already installed. If none is found, the export fails with
`No usable Chrome/Chromium browser found.` and a hint. Either install Chrome/Edge or run once:

```bash
npx -y markdown-pdf-export install-browser   # ~150 MB
```

To force a browser, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or an executable path.

---

## 4. Common Prompts

| What you want | What to ask |
|---|---|
| Basic export | `Export this file to PDF` |
| Custom output path | `Export to docs/report.pdf` |
| Dark code theme | `Export with the monokai theme` |
| Landscape layout | `Export in landscape orientation` |
| Header and footer | `Export with header and footer showing page numbers` |
| Check setup | `Run doctor_markdown_pdf` |

---

## 5. Settings

Set permanent defaults as JSON in the `MARKDOWN_PDF_SETTINGS` environment variable (for example in the
`env` of the `context_servers` entry) or pass `--settings <json|file>` to the CLI. A settings file
could look like this:

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

With the legacy dev extension, put the same object under `context_servers.markdown-pdf.settings` in
Zed's `settings.json`.

---

## 6. Syntax Highlighting

Highlighting is **on by default** using the `github.css` theme.

Change the theme in settings or ask the assistant directly:

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

To disable highlighting entirely:

```json
{ "highlight": false }
```

---

## 7. Header and Footer

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

## 8. Page Layout Options

| Setting | Values | Default |
|---|---|---|
| `page_format` | `A4`, `Letter`, `Legal`, `A3`, `A5`, … | `A4` |
| `orientation` | `portrait`, `landscape` | `portrait` |
| `scale` | `0.1` – `2` | `1` |
| `page_ranges` | `"1-5, 8"` | all pages |
| `print_background` | `true` / `false` | `true` |

---

## 9. Custom Stylesheet

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

## 10. Page Breaks

The built-in stylesheet includes a `.page` utility class:

```html
<div class="page"></div>
```

Place it anywhere in your Markdown — HTML pass-through is enabled by default.

---

## 11. Front Matter

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

## 12. Diagnostics

If something goes wrong, ask:

```
Run doctor_markdown_pdf
```

Or from a terminal:

```bash
npx -y markdown-pdf-export doctor
```

For a debug log, set `MARKDOWN_PDF_DEBUG=1` (for example in the `env` of the `context_servers` entry).
The log is written to `markdown-pdf-debug.log` in the OS temp directory — on macOS that is under
`/var/folders/…/T/`, not `/tmp`. Set `MARKDOWN_PDF_DEBUG=/some/file.log` to choose the path.

---

## Full Documentation

- [`README.md`](README.md) — Complete settings reference
- [`server/README.md`](server/README.md) — npm package: CLI options, task and MCP setup
- [Online Documentation](https://matinfo.github.io/zed-markdown-pdf/) — Full structured header/footer reference