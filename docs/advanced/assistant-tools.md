# Assistant tools

For people who want to connect an AI assistant by hand, or want to know exactly what it can ask the exporter to do.

The package includes an MCP server, so any assistant that supports MCP can export your Markdown
files. `npx -y markdown-pdf-export setup` prints the entry for each editor it finds, and `--write`
adds it where that is safe. See [Editors](/editors) for the guided version.

## Register the server by hand

The server talks over standard input and output. Any MCP client can start it with:

- command: `npx`
- arguments: `-y`, `markdown-pdf-export`, `mcp`

Most clients (Claude Desktop, Cursor and many others) use this JSON:

```json
{
  "mcpServers": {
    "markdown-pdf": {
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

| Client | Where it goes |
|---|---|
| Claude Desktop | `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`) |
| Cursor | `~/.cursor/mcp.json` |
| Zed | `settings.json`, under `"context_servers"` instead of `"mcpServers"` |
| VS Code | run the command below |
| Claude Code | run the command below |

```sh
code --add-mcp '{"name":"markdown-pdf","command":"npx","args":["-y","markdown-pdf-export","mcp"]}'
claude mcp add --scope user markdown-pdf -- npx -y markdown-pdf-export mcp
```

After `npm install -g markdown-pdf-export`, use `"command": "markdown-pdf-export"` with
`"args": ["mcp"]`. If the editor is started from the dock or start menu and cannot find `npx`, use
the full path to `npx` (or to `node` and `cli.mjs`); `setup` writes these paths for you.

In MCP registries the server is listed as `io.github.matinfo-tech/markdown-pdf-export`.

The server reads the same [settings files](/advanced/settings-file) as the command line. An `env`
object in the entry can set `MARKDOWN_PDF_SETTINGS`, `MARKDOWN_PDF_BROWSER` or
`MARKDOWN_PDF_DEBUG`, for example `"env": { "MARKDOWN_PDF_BROWSER": "msedge" }`.

## The tools

### export_markdown_pdf

Exports one Markdown file to PDF and returns the PDF path.

| Argument | Value |
|---|---|
| `input_path` | Required. The Markdown file. Use an absolute path: a relative one starts from the folder the server was started in. |
| `output_path` | The PDF file. Relative paths start from the Markdown file's folder. |
| `page_format`, `orientation`, `margin`, `scale`, `page_ranges`, `print_background` | Page layout. |
| `font_family`, `heading_font_family`, `stylesheet_path`, `include_default_styles` | Text and CSS. |
| `highlight`, `highlight_style` | Code colours. |
| `math`, `math_options`, `toc`, `toc_options`, `heading_anchors`, `breaks`, `emoji` | Content. |
| `header`, `footer`, `display_header_footer` | Header and footer, as JSON objects. They replace the ones from settings. |
| `open_after_export` | Open the PDF when done. |

These are the [command-line options](/advanced/cli#export-options) with `_` instead of `-`. Any
argument left out comes from the settings files, and the document's front matter wins over all of
them. The presets `look`, `font` and `template` are not tool arguments; put them in the settings
file.

### doctor_markdown_pdf

Reports whether a browser was found and which one, which settings files were loaded, and the
effective settings. Optional argument: `input_path`, to include the project settings of that
document.

## Example prompts

```text
Export this file to PDF.
Export docs/guide.md to PDF in landscape on Letter paper, with a table of contents.
Export report.md with the monokai code theme and "Page {page} of {pages}" in the footer.
Export this file to PDF with maths, and save it as build/notes.pdf.
Run doctor_markdown_pdf and tell me which browser and settings are used.
```

The assistant turns your request into tool arguments. Everything else comes from your settings files.

## When the tools do not show up

Check that `npx -y markdown-pdf-export --help` works in a terminal, then restart the server from the
client's server list, or restart the editor. For "No usable Chrome/Chromium browser found", see
[Browser](/advanced/browser). More help: [Help](/help).
