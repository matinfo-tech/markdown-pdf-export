# Testing Markdown PDF

This guide covers local testing of the exporter as a CLI, as a standalone MCP server, and from Zed.

## Prerequisites

1. **Node.js** version 20 or higher
2. **A Chromium-based browser:** Google Chrome or Microsoft Edge, or Playwright's Chromium. PDF
   generation uses Chromium's print-to-PDF engine through Playwright, which does not support Firefox
   or WebKit/Safari for PDFs. Nothing is downloaded automatically. To install Chromium (~150 MB):
   ```sh
   node cli.mjs install-browser
   ```
   To force a browser, set `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or an executable path.

Install the dependencies once, from the repository root:

```sh
npm install
```

All commands below run from the repository root.

## CLI

```sh
node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf   # prints the PDF path on stdout
node cli.mjs doctor                                  # browser + settings
node cli.mjs --help                                  # all options
```

Exit codes: `0` success, `1` error, `2` usage error. Flags mirror the MCP tool's options in kebab-case,
for example:

```sh
node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf --page-format Letter --toc --no-highlight
node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf --margin '{"top":"10mm"}'
node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf --settings '{"orientation":"landscape"}'
node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf --settings /path/to/settings.json
MARKDOWN_PDF_SETTINGS=/path/to/settings.json node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf
```

Settings precedence, highest first: front matter `pdf:` block, CLI flags, `--settings`,
`MARKDOWN_PDF_SETTINGS` (file path or inline JSON), built-in defaults.

## Automated Tests

```sh
npm run check          # syntax check of export.mjs, mcp.mjs, cli.mjs, tool-schemas.mjs
npm test               # unit tests (lib/__tests__)
npm run test:export    # end-to-end: runs the MCP server against test-fixtures/
npm run test:all       # both
```

`test:export` starts the MCP server (`mcp.mjs`) once, runs `doctor_markdown_pdf`, then a set of
`export_markdown_pdf` scenarios, and prints a pass/fail summary. Options (run the script directly):

```sh
node test-fixtures/test-export.mjs --keep      # keep the generated PDFs
node test-fixtures/test-export.mjs --verbose   # print every server stderr line
```

If no browser is found, the doctor step reports it with the `install-browser` hint.

## Testing in Zed

### As a task

Add a task to `.zed/tasks.json` that points at your checkout:

```json
[
  {
    "label": "Markdown: Export to PDF (dev)",
    "command": "node",
    "args": ["/path/to/markdown-pdf-export/cli.mjs", "$ZED_FILE"],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

Open `test-fixtures/sample.md`, run **task: spawn** and choose the task. `sample.pdf` should appear
next to the file.

### As an MCP server

Add a `context_servers` entry in Zed's `settings.json` that runs your checkout:

```json
{
  "context_servers": {
    "markdown-pdf": {
      "command": "node",
      "args": ["/path/to/markdown-pdf-export/mcp.mjs"],
      "env": {
        "MARKDOWN_PDF_SETTINGS": "/path/to/settings.json",
        "MARKDOWN_PDF_DEBUG": "1"
      }
    }
  }
}
```

Then open `test-fixtures/sample.md` and ask the assistant: "Export this Markdown file to PDF". The AI
uses the `export_markdown_pdf` tool and writes `sample.pdf` next to the source file.

`MARKDOWN_PDF_SETTINGS` is optional. It takes the absolute path of a JSON file containing the plain
settings object, or inline JSON. The same `env` works in the task above.

To check the MCP handshake without Zed, run `./test-mcp-init.sh` from the repository root; it sends an
`initialize` request to `mcp.mjs`.

## MCP Tools

### `export_markdown_pdf`

Converts a Markdown file to PDF. Main arguments:

- `input_path` (required): Path to the Markdown file
- `output_path` (optional): Where to save the PDF
- `stylesheet_path` (optional): Custom CSS file
- `open_after_export` (optional): Auto-open the PDF

Any setting can be passed as an argument for a one-off override. Example prompts:

- "Export this file to PDF"
- "Convert docs/README.md to PDF with custom styling from print.css"
- "Export this to build/output.pdf"

### `doctor_markdown_pdf`

Reports browser availability and the active settings.

- `input_path` (optional): Markdown file for resolving relative paths

Example prompts:

- "Check the Markdown PDF setup"
- "Verify the PDF exporter is working"

## Troubleshooting

### No usable Chrome/Chromium browser found

The export fails with `No usable Chrome/Chromium browser found.` followed by the browsers it tried and
a hint. Fix it by one of:

1. Installing Google Chrome or Microsoft Edge
2. Setting `MARKDOWN_PDF_BROWSER` to `chrome`, `msedge`, `chromium` or an executable path
3. Downloading Playwright's Chromium (~150 MB): `npx -y markdown-pdf-export install-browser`
   (or `node cli.mjs install-browser` from a checkout)

### Debug log

The debug log is off by default. Set `MARKDOWN_PDF_DEBUG=1` to write
`markdown-pdf-debug.log` in the OS temp directory (on macOS under `/var/folders/…/T/`, not `/tmp`), or
`MARKDOWN_PDF_DEBUG=/some/file.log` to choose the path:

```sh
MARKDOWN_PDF_DEBUG=/tmp/mdpdf.log node cli.mjs test-fixtures/sample.md -o /tmp/x.pdf
```

### MCP server not starting

**Symptom:** Tools don't appear in the Assistant

1. Verify the server is enabled in Agent settings
2. Check that Node.js is available: `which node`
3. Check that the command runs in a terminal (`npx -y markdown-pdf-export --help` or
   `node cli.mjs --help`)
4. View the MCP server logs in Zed (Agent panel → Server logs)
5. Run `doctor_markdown_pdf` to check configuration

### PDF export fails

**Symptom:** Export completes but no PDF is created

1. Check file permissions in the output directory
2. Verify the input Markdown file exists
3. Run the CLI on the same file to isolate the issue
4. Check for error messages in the terminal or Assistant panel

### Windows-specific issues

1. `install-browser` puts Playwright's Chromium under `%USERPROFILE%\AppData\Local\ms-playwright\`
2. Ensure you have sufficient disk space (~150 MB) if you download it
3. If Windows Defender or antivirus blocks the download, add an exception for Playwright
4. File paths in settings should use forward slashes or escaped backslashes in JSON

## Test Fixtures

The `test-fixtures` directory contains:

- **`sample.md`**: Comprehensive Markdown document with various features
- **`structured-header-test.md`**: Structured header/footer document
- **`custom.css`**: Example custom stylesheet
- **`test-export.mjs`**: End-to-end MCP test script
- **`README.md`**: Detailed fixture documentation

Use these to validate:

- Basic Markdown rendering (headings, lists, code blocks)
- Advanced features (tables, blockquotes, inline HTML)
- Custom styling
- Cross-platform compatibility

## Development Workflow

1. **Code changes** (`*.mjs`, `lib/`):
   ```sh
   npm run check
   npm test
   npm run test:export
   ```
   Restart the MCP server in Zed (disable/enable in settings) to pick up changes.

2. **CSS changes** (`default.css`): take effect on the next export.

3. **Dependency changes** (`package.json`):
   ```sh
   npm install
   ```

## Releasing

Publishing is done by `.github/workflows/npm-publish.yml` with npm trusted publishing (OIDC); no token
secret is involved. Bump `version` in `package.json`, then push
the tag `npm-v<version>`. The one-time Trusted Publisher setup and the manual first publish are
described in the README's "Publishing" section.

## Feedback

If you encounter issues not covered here, check:

- The main README.md for architecture details
- GitHub Issues for similar problems
- The MCP server logs in Zed for detailed error messages
- Playwright documentation: https://playwright.dev/
