# AI Assistant (MCP)

The package includes an MCP server. Once it is registered, the AI assistant in Zed (or any other MCP
client) can export a Markdown file when you ask it to.

## Register the Server in Zed

Add this to Zed's `settings.json`:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

The entry appears under **Agent → Context Servers**. `npx -y` downloads the package on first use and
runs it from npm's cache afterwards (see [Installation](/guide/installation)).

If you installed the package with `npm install -g markdown-pdf-export`, use
`"command": "markdown-pdf-export", "args": ["mcp"]` instead.

## Tools

The server exposes two tools:

| Tool | Purpose |
|------|---------|
| `export_markdown_pdf` | Render a Markdown file to PDF. Takes `input_path` (required) and, optionally, `output_path` and any per-export option (`page_format`, `orientation`, `math`, `toc`, `highlight_style`, …). |
| `doctor_markdown_pdf` | Report whether a browser is available, which one was picked, and the active settings. Takes an optional `input_path`. |

The export options are the same as the [command-line flags](/guide/cli#options), written in
`snake_case` instead of `--kebab-case`.

## Example Prompts

Open a Markdown file and describe what you want:

```
Export this file to PDF
```

```
Export to build/report.pdf with the monokai theme
```

```
Export this file to PDF in landscape, Letter format, with math and a table of contents
```

```
Run doctor_markdown_pdf
```

The assistant translates the request into tool arguments. Options you do not mention come from your
settings.

## Settings

Default settings are loaded from the `MARKDOWN_PDF_SETTINGS` environment variable. Point it at your
[settings file](/guide/global-settings) with an absolute path:

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

`MARKDOWN_PDF_SETTINGS` also accepts inline JSON, for example `"{\"page_format\":\"A4\"}"`.
Tool arguments override these defaults, and a `pdf:` block in the document's
[front matter](/guide/front-matter) overrides both.

The same `env` block can set [`MARKDOWN_PDF_BROWSER`](/guide/browser) and
[`MARKDOWN_PDF_DEBUG`](/guide/cli#environment-variables).

## Other MCP Clients

The server speaks MCP over stdio, so any client that can launch a command works. Configure it with:

- **command:** `npx`
- **args:** `-y markdown-pdf-export mcp`
- **env (optional):** `MARKDOWN_PDF_SETTINGS`, `MARKDOWN_PDF_BROWSER`, `MARKDOWN_PDF_DEBUG`

Its name in the MCP Registry is `io.github.matinfo/markdown-pdf-export`.

Ready-made snippets for Claude Code, Claude Desktop, Cursor and VS Code are in
[Other Editors & MCP Clients](/guide/other-editors).

## Troubleshooting

If the tools do not appear in the assistant:

1. Check that `npx -y markdown-pdf-export --help` works in a terminal
2. Confirm the `markdown-pdf` entry is present and enabled in **Agent → Context Servers**
3. Restart Zed
4. Check Zed logs: **Help → View Logs**

If an export fails with `No usable Chrome/Chromium browser found.`, see [Browser](/guide/browser).

## Next Steps

- [Zed Task](/guide/zed-task) — export with a key, without the assistant
- [Global Settings](/guide/global-settings) — the settings file
- [Settings Reference](/reference/settings) — every option
