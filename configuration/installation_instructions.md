# Installation Instructions

This is the legacy development extension. It is not in the Zed registry. The recommended setup is
the npm package `markdown-pdf-export`, used from a Zed task or as an MCP server
(`npx -y markdown-pdf-export mcp`, MCP registry name `io.github.matinfo/markdown-pdf-export`).
See the [project README](https://github.com/matinfo/zed-markdown-pdf#setup).

## What this extension needs

- **Node.js 18 or newer.**
- **A browser:** Google Chrome or Microsoft Edge is used if installed; otherwise Playwright's
  Chromium, if present. Nothing is downloaded automatically. To install Chromium (~150 MB), run
  `npx -y markdown-pdf-export install-browser`, or set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`,
  `chromium` or an executable path.

On first use the extension downloads the server archive from the matching GitHub release. The
archive bundles its npm dependencies, so nothing is installed at runtime.

## Usage

1. Open any Markdown file in Zed.
2. Ask the assistant, for example:
   - *"Export this to PDF"*
   - *"Export in landscape with the monokai theme"*
   - *"Export with header and footer showing page numbers"*
3. The `export_markdown_pdf` tool writes the PDF next to the source file (or in
   `output_directory` if configured). Use `doctor_markdown_pdf` to check the browser and settings.

## Settings

Put settings in your Zed `settings.json` under `context_servers.markdown-pdf.settings`, or pass them
as tool-call arguments for a single export:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "settings": {
        "page_format": "Letter",
        "orientation": "portrait",
        "margin": { "top": "20mm", "right": "18mm", "bottom": "20mm", "left": "18mm" },
        "highlight": true,
        "highlight_style": "github.css",
        "emoji": true,
        "display_header_footer": false,
        "open_after_export": false
      }
    }
  }
}
```

Full settings and header/footer reference: <https://matinfo.github.io/zed-markdown-pdf/>.

## Page-break helper

The built-in stylesheet provides a `.page` utility class that forces a page break:

```html
<div class="page"></div>
```
