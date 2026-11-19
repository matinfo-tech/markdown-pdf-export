# Getting Started

Markdown PDF exports Markdown files to high-quality PDFs using Playwright and Chromium.

It is an npm package, `markdown-pdf-export`, that contains a **command-line tool** and an
**MCP server**. There is no Zed extension to install: in Zed you run the command as a task, or let
the AI assistant call the MCP server.

## Three Ways to Use It

| | How you trigger an export | Guide |
|---|---|---|
| **Zed task** | **task: spawn** or a key binding, on the open file | [Zed Task](/guide/zed-task) |
| **AI assistant** | Ask the assistant: "Export this file to PDF" | [AI Assistant (MCP)](/guide/mcp) |
| **Command line** | `npx -y markdown-pdf-export doc.md` in a terminal, script or CI job | [Command Line](/guide/cli) |

All three run the same exporter and read the same settings, so everything in the rest of this guide
applies to each of them.

## Requirements

- **Node.js 20 or newer** (it includes `npx`)
- **A Chromium-based browser** — Google Chrome or Microsoft Edge are detected automatically
  (see [Browser](/guide/browser))

There is no install step: `npx` downloads the package on first use. See
[Installation](/guide/installation).

## Features

- **Zed integration** — run it as a task or from the AI assistant (MCP)
- **Structured headers & footers** — declarative configuration with zones and typed elements
- **Custom placeholders** — use front matter variables in headers/footers
- **Date formatting** — flexible date-fns patterns
- **Image embedding** — SVG, PNG, JPG converted to data URIs
- **Syntax highlighting** — 80+ highlight.js themes
- **Math and table of contents** — KaTeX and a `[[toc]]` marker
- **Custom CSS** — bring your own stylesheet
- **Per-document overrides** — configure via YAML front matter

## How It Works

1. You run the Zed task, the CLI, or ask the AI assistant to export a Markdown file
2. The exporter parses the Markdown and any front matter configuration
3. HTML is generated with syntax highlighting and emoji rendering
4. Chromium, driven through Playwright, converts the HTML to PDF
5. The PDF is saved next to your source file (or to a custom path)

## Quick Example

From a terminal:

```sh
npx -y markdown-pdf-export report.md
npx -y markdown-pdf-export report.md --orientation landscape --display-header-footer
```

In Zed, run the *Markdown: Export to PDF* task on the open file, or ask the assistant:

```
Export this file to PDF
```

```
Export this file to PDF in landscape with header and footer
```

## Structured Header/Footer

Markdown PDF supports a declarative header/footer system. In your
[settings file](/guide/global-settings):

```json
{
  "header": {
    "height": "15mm",
    "left": { "type": "image", "src": "./logo.svg", "height": "12mm" },
    "center": { "type": "title" },
    "right": { "type": "date", "format": "MMMM d, yyyy" }
  },
  "footer": {
    "center": { "type": "text", "content": "Page {page} of {pages}" }
  }
}
```

Or configure per-document via front matter:

```yaml
---
title: My Report
author: Jane Smith
pdf:
  header:
    left_text: "{author}"
    center_text: "{title}"
    right_text: "{date:yyyy-MM-dd}"
---
```

## Next Steps

- [Installation](/guide/installation) — requirements and how the package is fetched
- [Zed Task](/guide/zed-task), [AI Assistant (MCP)](/guide/mcp), [Command Line](/guide/cli) — set up
  the way you want to use it
- [First Export](/guide/first-export) — your first PDF
- [Header & Footer](/guide/header-footer) — configure headers and footers
