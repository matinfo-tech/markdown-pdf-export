# Command Line

`markdown-pdf-export` is a regular command-line tool. The [VS Code](/guide/vscode) or
[Zed](/guide/zed-task) task is this command with the current file as its argument, so everything on
this page also applies to a task's `args`.

## Usage

```
markdown-pdf-export <file.md> [options]
markdown-pdf-export doctor [file.md]
markdown-pdf-export init [--template <name>] [--project] [--force] [--list]
markdown-pdf-export setup [zed|vscode|cursor|claude-code|claude-desktop|all] [--write]
markdown-pdf-export install-browser
markdown-pdf-export mcp
```

Run it through `npx` (no install step) or directly after `npm install -g markdown-pdf-export`:

```sh
npx -y markdown-pdf-export README.md               # → README.pdf next to the file
npx -y markdown-pdf-export doc.md -o out.pdf --math --toc --page-format Letter
```

## Subcommands

| Command | What it does |
|---------|--------------|
| `<file.md> [options]` | Export one Markdown file to PDF |
| `doctor [file.md]` | Print browser status, the settings files that were loaded (`settings_sources`) and the active settings as JSON. With a file, its project settings file is included. |
| `init` | Create the user settings file `~/.config/markdown-pdf-export/settings.json` from a template — see [below](#init) |
| `setup [editor]` | Print the task and MCP entries for your editors — see [below](#setup) |
| `install-browser` | Download Playwright's Chromium (~200 MB). Only needed if no Chromium-based browser is installed — see [Browser](/guide/browser). |
| `mcp` | Start the MCP server on stdio — see [AI Assistant (MCP)](/guide/mcp) |

`--help` (`-h`) prints the usage and all options; `--version` (`-v`) prints the version.

### init

```sh
npx -y markdown-pdf-export init                        # choose a template interactively
npx -y markdown-pdf-export init --template corporate   # minimal, simple, corporate, academic, two-logo
npx -y markdown-pdf-export init --project              # write ./.markdown-pdf.json instead
```

`--list` prints the template names. An existing file is kept unless you add `--force`. See
[Global Settings](/guide/global-settings) for where the files live.

### setup

```sh
npx -y markdown-pdf-export setup           # editors found on this machine
npx -y markdown-pdf-export setup zed       # or vscode, cursor, claude-code, claude-desktop, all
```

Prints each editor task and MCP entry with the file it belongs in, then checks the browser. `--write`
creates the files that do not exist yet and runs `claude mcp add` for Claude Code; existing files are
never modified, so merge those snippets by hand.

## Options

These apply to the export command. Each one corresponds to a setting of the same name in
`snake_case` (see the [Settings Reference](/reference/settings)).

| Flag | Type | Description |
|------|------|-------------|
| `-o`, `--output <file.pdf>` | path | Output PDF path (alias of `--output-path`) |
| `--output-path <file.pdf>` | path | Output PDF path |
| `--stylesheet-path <file.css>` | path | CSS file applied after the built-in stylesheet |
| `--open-after-export` | boolean | Open the PDF after export |
| `--page-format <format>` | string | Paper format: `A4`, `Letter`, `Legal`, `Tabloid`, `Ledger`, `A0`–`A3`, `A5`, `A6` |
| `--orientation <value>` | string | `portrait` or `landscape` |
| `--scale <n>` | number | Scale of the page rendering (default `1`) |
| `--page-ranges <ranges>` | string | Pages to print, e.g. `'1-5, 8, 11-13'`. Empty means all pages. |
| `--print-background` | boolean | Print background colours and images |
| `--margin <value>` | length or JSON | Page margins: one value for all four sides, or a JSON object per side |
| `--font-family <value>` | string | CSS `font-family` for the document body and header/footer |
| `--include-default-styles` | boolean | Include the built-in default stylesheet |
| `--highlight` | boolean | Syntax highlighting for code blocks |
| `--highlight-style <file>` | string | highlight.js theme filename, e.g. `github.css`, `monokai.css` |
| `--breaks` | boolean | Hard line breaks in the Markdown renderer |
| `--emoji` | boolean | Render `:emoji:` shortcodes as Unicode characters |
| `--math` | boolean | Render LaTeX math via KaTeX |
| `--math-options <json>` | JSON | KaTeX options: `throw_on_error`, `error_color`, `macros` |
| `--heading-anchors` | boolean | Add `id` slugs to headings |
| `--toc` | boolean | Render a `[[toc]]` marker as a table of contents (also enables heading anchors) |
| `--toc-options <json>` | JSON | TOC options: `level` (heading levels), `list_type` (`ul` or `ol`) |
| `--display-header-footer` | boolean | Display header and footer on each page. Empty unless a `header` or `footer` is defined |
| `--header <json>` | JSON | Structured header, same shape as the [`header` setting](/guide/header-footer). Enables the header |
| `--footer <json>` | JSON | Structured footer, for example `'{"center_text":"Page {page} of {pages}"}'`. Enables the footer |
| `--settings <json\|file.json>` | JSON or path | Settings for this run, used instead of the user settings file |
| `--watch` | | Re-export whenever the Markdown file or a loaded settings file changes |

`--header` and `--footer` replace the header or footer from the settings file for this run; a `header` or
`footer` in [front matter](/guide/front-matter) still overrides them. `output_directory` and
`assets_directory` have no flag: put them in a [settings file](/guide/global-settings).

### Boolean Flags

A boolean flag can be written three ways:

```sh
--toc            # true
--toc=false      # false
--no-highlight   # false
```

### JSON-Valued Options

`--margin` accepts either one length for all four sides or a JSON object. Sides you omit keep their
configured value:

```sh
npx -y markdown-pdf-export doc.md --margin 10mm
npx -y markdown-pdf-export doc.md --margin '{"top":"10mm"}'
```

`--math-options` and `--toc-options` take JSON:

```sh
npx -y markdown-pdf-export doc.md --math --math-options '{"macros":{"\\RR":"\\mathbb{R}"}}'
npx -y markdown-pdf-export doc.md --toc --toc-options '{"level":[1,2],"list_type":"ol"}'
```

Quote the JSON so the shell passes it as one argument.

### Watch

```sh
npx -y markdown-pdf-export doc.md --watch
```

Exports once, then again on every change to the Markdown file or a settings file it loaded. With a
PDF viewer that reloads on change, this is a live preview while you design a header or footer. Stop it
with `Ctrl+C`.

### Settings

Settings files are found automatically (see [Global Settings](/guide/global-settings)).
`--settings` takes inline JSON or the path to a JSON file and replaces the user settings file for this
run:

```sh
npx -y markdown-pdf-export doc.md --settings ./print-settings.json
npx -y markdown-pdf-export doc.md --settings '{"page_format":"Letter"}'
```

Precedence, highest first: front matter `pdf:` block, flags, project `.markdown-pdf.json`, user
settings file (or `--settings` / `MARKDOWN_PDF_SETTINGS`), built-in defaults. See
[Global Settings](/guide/global-settings#priority-order).

## Environment Variables

| Variable | Value |
|----------|-------|
| `MARKDOWN_PDF_SETTINGS` | Inline JSON or the path to a JSON file, used instead of the user settings file. Overridden by `--settings`. |
| `MARKDOWN_PDF_BROWSER` | `chrome`, `msedge`, `chromium`, or the path to a browser executable — see [Browser](/guide/browser) |
| `MARKDOWN_PDF_DEBUG` | `1` writes a debug log to `markdown-pdf-debug.log` in the OS temp directory; a file path logs there instead. Off by default. |

On macOS the OS temp directory is under `/var/folders/…/T/`, not `/tmp`.

## Output and Exit Codes

On success the command prints the path of the PDF on stdout and nothing else, so it can be captured:

```sh
pdf="$(npx -y markdown-pdf-export report.md)"
echo "Wrote $pdf"
```

Errors go to stderr.

| Exit code | Meaning |
|-----------|---------|
| `0` | Success |
| `1` | Error (file not found, no browser, rendering failure). `doctor` also exits `1` when no browser is available. |
| `2` | Usage error (unknown option, invalid value, missing input file) |

## Shell Examples

Export every Markdown file in a folder:

```sh
for f in docs/*.md; do
  npx -y markdown-pdf-export "$f" -o "build/$(basename "${f%.md}").pdf"
done
```

The `build/` folder is created if it does not exist.

In CI, install the package once and make sure a browser is present:

```sh
npm install -g markdown-pdf-export
markdown-pdf-export doctor || markdown-pdf-export install-browser
markdown-pdf-export README.md -o dist/README.pdf
```

`doctor` exits with `1` when no browser is found, which triggers the download.

## Next Steps

- [VS Code](/guide/vscode) — run this command from VS Code
- [Zed](/guide/zed-task) — run this command from Zed
- [Browser](/guide/browser) — which browsers work and why
- [Settings Reference](/reference/settings) — every setting
