# Installation

Markdown PDF ships as the npm package `markdown-pdf-export`: a command-line tool and an MCP server.
In Zed you run it as a **task** or let the AI assistant call it over **MCP**. No Zed extension is
needed.

## Prerequisites

- **Zed Editor** — [Download from zed.dev](https://zed.dev)
- **Node.js 20+** — provides `npx`
- **A browser** — Google Chrome or Microsoft Edge (see [Browser](#browser))

```bash
node --version   # Must be ≥ 20
```

## Zed Task (Recommended)

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

## MCP Server (Zed Agent or Any MCP Client)

Add this to Zed's `settings.json`:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"],
      "env": { "MARKDOWN_PDF_SETTINGS": "/Users/me/.config/markdown-pdf/settings.json" }
    }
  }
}
```

`env` is optional: `MARKDOWN_PDF_SETTINGS` is the absolute path of your settings file (or inline JSON).

The server exposes two tools, `export_markdown_pdf` and `doctor_markdown_pdf`. Its MCP registry name
is `io.github.matinfo/markdown-pdf-export`.

The same `env` works in the task. See [Global Settings](/guide/global-settings#configuration-location)
for the settings file and precedence.

## Command Line

```sh
npx -y markdown-pdf-export README.md               # → README.pdf next to the file
npx -y markdown-pdf-export doc.md -o out.pdf --math --toc --page-format Letter
npx -y markdown-pdf-export doctor                  # check browser + settings
npx -y markdown-pdf-export --help                  # all options
```

Flags mirror the MCP tool's options in kebab-case, plus `-o/--output` and `--settings <json|file>`.
The PDF path is printed on stdout.

## Browser

Nothing is downloaded automatically. The exporter looks for, in order:

1. Google Chrome
2. Microsoft Edge
3. Playwright's Chromium, if already installed

If none is found, the export fails with `No usable Chrome/Chromium browser found.` and a hint. Install
Chrome or Edge, or download Playwright's Chromium (~150 MB):

```bash
npx -y markdown-pdf-export install-browser
```

To pick a browser yourself, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or the path
to an executable.

## Verify Installation

Run the diagnostic from a terminal:

```bash
npx -y markdown-pdf-export doctor
```

or ask the assistant: `Run doctor_markdown_pdf`.

You should see output like:

```json
{
  "browser": {
    "available": true,
    "backend": "Chromium (Playwright)",
    "version": "147.0.7727.15"
  }
}
```

## Troubleshooting

### Context server doesn't start

1. Check that `npx -y markdown-pdf-export --help` works in a terminal
2. Confirm the `markdown-pdf` entry is present and enabled in **Agent → Context Servers**
3. Restart Zed
4. Check Zed logs: **Help → View Logs**
5. Enable the debug log with `MARKDOWN_PDF_DEBUG=1` (in the `env` of the `context_servers` entry).
   It is written to `markdown-pdf-debug.log` in the OS temp directory — on macOS under
   `/var/folders/…/T/`, not `/tmp`. Set `MARKDOWN_PDF_DEBUG=/some/file.log` to choose the path.

### Node.js not found

Ensure Node.js is in your PATH:

```bash
which node   # Should return a path
node --version   # Should be ≥ 20
```

## Next Steps

- [First Export](/guide/first-export) — Create your first PDF
- [Header & Footer](/guide/header-footer) — Add professional headers and footers
- [Global Settings](/guide/global-settings) — Configure default options
