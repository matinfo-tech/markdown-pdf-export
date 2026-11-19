# markdown-pdf-export

Export Markdown to PDF with Chromium: syntax highlighting, KaTeX math, a table of contents,
structured headers and footers, and YAML front-matter overrides.

It ships as a **CLI** and an **MCP server**. In the [Zed](https://zed.dev) editor you run it as a
task (no extension needed), or you let the AI agent call it over MCP.

```sh
npx -y markdown-pdf-export README.md               # → README.pdf next to the file
npx -y markdown-pdf-export doc.md -o out.pdf --math --toc --page-format Letter
npx -y markdown-pdf-export doctor                  # check browser + settings
npx -y markdown-pdf-export --help                  # all options
```

## Browser

It uses an installed **Google Chrome** or **Microsoft Edge** first, then Playwright's Chromium.
Nothing is downloaded unless you ask for it:

```sh
npx -y markdown-pdf-export install-browser   # optional, ~150 MB
```

To pick a browser yourself, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or the path
to an executable.

## Zed: export the current file with a task

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

## Zed (or any MCP client): let the agent export

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

The server exposes two tools, `export_markdown_pdf` and `doctor_markdown_pdf`.

## Settings

Defaults come from `--settings <json|file>` or from the `MARKDOWN_PDF_SETTINGS` environment variable
(JSON). Command-line flags override them, and a `pdf:` block in a document's front matter overrides
everything for that document.

Set `MARKDOWN_PDF_DEBUG=1` to write a debug log to `<tmpdir>/markdown-pdf-debug.log`, or set it to a
file path to log there instead.

## License

MIT
