# Installation

Markdown PDF ships as the npm package `markdown-pdf-export`: a command-line tool and an MCP server.
No editor extension is needed.

## Requirements

- **Node.js 20 or newer** — it includes `npx`
- **A Chromium-based browser** — Google Chrome or Microsoft Edge (see [Browser](#browser))
- **An editor is optional** — VS Code or Zed if you want the task or the AI assistant; the command
  line works on its own

```bash
node --version   # Must be ≥ 20
```

## No Install Step

Every snippet in this guide runs the package with `npx`:

```sh
npx -y markdown-pdf-export README.md
```

`npx -y markdown-pdf-export …` downloads the package into npm's cache on first use and reuses it
afterwards. There is no separate install: the first run is slower because of the download, and later
runs start from the cache.

### Optional: Global Install

You can also install the package once:

```sh
npm install -g markdown-pdf-export
```

Then use `markdown-pdf-export` as the command instead of `npx`:

- VS Code task: `"command": "markdown-pdf-export", "args": ["${file}"]`
- Zed task: `"command": "markdown-pdf-export", "args": ["$ZED_FILE"]`
- MCP: `"command": "markdown-pdf-export", "args": ["mcp"]`

This starts faster, works offline, and the version changes only when you run
`npm update -g markdown-pdf-export`.

## Choose How to Use It

| | Setup | Guide |
|---|---|---|
| **VS Code task** | One entry in `tasks.json`, optional key binding | [VS Code](/guide/vscode) |
| **Zed task** | One entry in `tasks.json`, optional key binding | [Zed](/guide/zed-task) |
| **AI assistant** | One MCP entry in VS Code, Zed or another client | [AI Assistant (MCP)](/guide/mcp) |
| **Command line** | Nothing to set up | [Command Line](/guide/cli) |

You can set up more than one; they share the same [settings file](/guide/global-settings).

## Browser

PDFs are produced by Chromium's print-to-PDF engine, driven through Playwright, which implements PDF
generation only for Chromium. Firefox and Safari cannot be used for this, so one Chromium-based
browser must be present:

- Google Chrome and Microsoft Edge are detected automatically, in that order
- otherwise, download Playwright's Chromium once (~150 MB):

  ```bash
  npx -y markdown-pdf-export install-browser
  ```

Nothing is downloaded automatically, and your default browser is not changed or used. Other
Chromium-based browsers and the `MARKDOWN_PDF_BROWSER` variable are covered in [Browser](/guide/browser).

## Verify Installation

Run the diagnostic from a terminal:

```bash
npx -y markdown-pdf-export doctor
```

or, with the MCP server registered, ask the assistant: `Run doctor_markdown_pdf`.

You should see output like:

```json
{
  "browser": {
    "available": true,
    "version": "157.0.8103.79",
    "backend": "Chromium (Playwright)",
    "launch_options": {
      "channel": "chrome"
    }
  }
}
```

## Troubleshooting

### Node.js not found

Ensure Node.js is in your PATH:

```bash
which node   # Should return a path
node --version   # Should be ≥ 20
```

### No usable Chrome/Chromium browser found

See [Browser](/guide/browser#troubleshooting-no-usable-chrome-chromium-browser-found).

### MCP server doesn't start

See [AI Assistant (MCP)](/guide/mcp#troubleshooting).

### Debug log

Set `MARKDOWN_PDF_DEBUG=1` (in a terminal, or in the `env` of the task or MCP entry). The
log is written to `markdown-pdf-debug.log` in the OS temp directory — on macOS under
`/var/folders/…/T/`, not `/tmp`. Set `MARKDOWN_PDF_DEBUG=/some/file.log` to choose the path.

## Next Steps

- [VS Code](/guide/vscode) — export with a task or a key
- [Zed](/guide/zed-task) — export with a key
- [AI Assistant (MCP)](/guide/mcp) — export by asking
- [Command Line](/guide/cli) — every option
- [First Export](/guide/first-export) — create your first PDF
