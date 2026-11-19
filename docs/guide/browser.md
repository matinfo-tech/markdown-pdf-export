# Browser

Markdown PDF needs a Chromium-based browser to produce the PDF. This page explains why, which
browsers are picked, and what to do when none is found.

## Why Chromium

PDF output is produced by Chromium's print-to-PDF engine, driven through Playwright's `page.pdf()`.
Playwright implements PDF generation only for Chromium: its Firefox and WebKit builds cannot produce
PDFs, and Safari itself cannot be driven this way.

The header/footer templates, page ranges, margins, scale and background printing documented on this
site are options of that Chromium engine.

## Which Browser Is Used

Any Chromium-based browser works. Without configuration, the exporter tries, in this order:

1. **Google Chrome**
2. **Microsoft Edge**
3. **Playwright's own Chromium**, if it was installed with `markdown-pdf-export install-browser`

Nothing is downloaded automatically.

### Firefox and Safari Users

You only need one Chromium-based browser installed alongside, or the one-time download below. Your
default browser is not changed or used.

### Installing Playwright's Chromium

If you do not want to install Chrome or Edge, download Playwright's Chromium once (~150 MB):

```sh
npx -y markdown-pdf-export install-browser
```

## Choosing a Browser: `MARKDOWN_PDF_BROWSER`

Set the `MARKDOWN_PDF_BROWSER` environment variable to skip the automatic order:

| Value | Browser |
|-------|---------|
| `chrome` | Google Chrome |
| `msedge` | Microsoft Edge |
| `chromium` | Playwright's Chromium |
| `chrome-beta`, `chrome-dev`, `chrome-canary` | Chrome channel variants |
| `msedge-beta`, `msedge-dev`, `msedge-canary` | Edge channel variants |
| a path | The browser executable at that path |

When the variable is set, only that browser is tried.

On the command line:

```sh
MARKDOWN_PDF_BROWSER=msedge npx -y markdown-pdf-export doc.md
```

In a [VS Code](/guide/vscode) task, add it to `options.env`:

```json
"options": { "env": { "MARKDOWN_PDF_BROWSER": "msedge" } }
```

In a [Zed](/guide/zed-task) task or the [MCP entry](/guide/mcp), add it to `env`:

```json
"env": { "MARKDOWN_PDF_BROWSER": "msedge" }
```

### Other Chromium-Based Browsers

Brave, Vivaldi, Chromium builds and other Chromium-based browsers can be used by setting
`MARKDOWN_PDF_BROWSER` to the path of the browser executable. For example, on macOS:

```sh
MARKDOWN_PDF_BROWSER="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  npx -y markdown-pdf-export doc.md
```

These browsers are not tested by the project.

## Checking Which Browser Was Picked

Run the diagnostic:

```sh
npx -y markdown-pdf-export doctor
```

The `browser` section shows whether a browser is available, its version, and in
`browser.launch_options` which one was picked:

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

| `launch_options` | Browser picked |
|------------------|----------------|
| `{ "channel": "chrome" }` | Google Chrome |
| `{ "channel": "msedge" }` | Microsoft Edge |
| `{}` | Playwright's Chromium |
| `{ "executablePath": "…" }` | The executable set in `MARKDOWN_PDF_BROWSER` |

`backend` names the engine and is the same whichever browser is picked. With the AI assistant, ask
`Run doctor_markdown_pdf` to get the same report.

## Troubleshooting: "No usable Chrome/Chromium browser found."

The export stops with this message when none of the candidates could be started. The message lists
what was tried and why each attempt failed. Fix it with one of:

1. Install Google Chrome or Microsoft Edge
2. Download Playwright's Chromium: `npx -y markdown-pdf-export install-browser`
3. Set `MARKDOWN_PDF_BROWSER` to the path of a Chromium-based browser executable

If `MARKDOWN_PDF_BROWSER` is set, check its value first: only that browser is tried, so a wrong path
or a channel that is not installed produces this error even when Chrome is present.

For more detail, enable the debug log with `MARKDOWN_PDF_DEBUG=1`
(see [Environment Variables](/guide/cli#environment-variables)).

## Next Steps

- [Installation](/guide/installation) — requirements
- [Command Line](/guide/cli) — `doctor`, `install-browser` and all options
