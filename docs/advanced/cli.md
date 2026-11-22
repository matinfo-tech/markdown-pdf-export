# Command line

For people who export from a terminal, a script or CI, and want every command and flag.

```sh
npx -y markdown-pdf-export report.md
```

This writes `report.pdf` next to `report.md` and prints its path. `npx -y` downloads the package the
first time and reuses it after that. After `npm install -g markdown-pdf-export`, the command is
simply `markdown-pdf-export`. Node.js 20 or newer is needed.

## Commands

| Command | What it does |
|---|---|
| `markdown-pdf-export <file.md> [options]` | Export one file. |
| `markdown-pdf-export` | In a terminal: a short menu (set up an editor, open Studio, check, help). |
| `markdown-pdf-export studio [--project] [--file <doc.md>] [--port <n>] [--no-open]` | Open [Studio](/studio). `--project` edits `./.markdown-pdf.json`; `--file` previews your own document; `--no-open` only prints the link. |
| `markdown-pdf-export init [--look <n>] [--font <n>] [--template <n>] [--project] [--force] [--list]` | Create the settings file. See [Settings file](/advanced/settings-file#create-it-with-init). |
| `markdown-pdf-export init --from <file> [--project] [--force]` | Install a settings file you already have, such as the one from [Design online](/online). See [Install a file you already have](/advanced/settings-file#install-a-file-you-already-have). |
| `markdown-pdf-export setup [zed\|vscode\|cursor\|claude-code\|claude-desktop\|copilot-cli\|all] [--write\|--print]` | Set up the export task and AI tools in the editors found. In a terminal it asks editor by editor and skips what is already set up. `--write` sets up everything without asking; `--print` only shows what to add. Missing files are created and the editor's own command is run. In an existing file only the new entry is added (comments and formatting are kept, a copy is saved as `<file>.markdown-pdf.bak`); a file that cannot be read is left alone and you get the snippet to paste. In Zed it also adds a keyboard shortcut, ⌘K ⌘E (Ctrl+K Ctrl+E). |
| `markdown-pdf-export doctor [file.md] [--json]` | Show the version and check Node, the browser, the settings files and what is set up in each editor. |
| `markdown-pdf-export install-browser` | Download Chromium (about 200 MB). See [Browser](/advanced/browser). |
| `markdown-pdf-export mcp` | Run as an assistant tool server. See [Assistant tools](/advanced/assistant-tools). |
| `markdown-pdf-export --help`, `--version` | Show help or the version. |

## Export options

Each option is also a settings key (written with `_` instead of `-`). An option given on the command
line wins over the settings files; front matter wins over both.

| Option | Value |
|---|---|
| `-o`, `--output`, `--output-path <file.pdf>` | Output file. |
| `--page-format <name>` | `A4`, `Letter`, `Legal`, `Tabloid`, `Ledger`, `A0` to `A6`. |
| `--orientation <name>` | `portrait` or `landscape`. |
| `--margin <size or json>` | `20mm` for all sides, or `'{"top":"25mm"}'`. |
| `--scale <n>` | Zoom of the content, default `1`. |
| `--page-ranges <ranges>` | Pages to keep, for example `'1-5, 8'`. |
| `--print-background` | Print background colours (on by default). |
| `--font-family <css>` | Text font, as a CSS font list. |
| `--heading-font-family <css>` | Title font. |
| `--accent-color <#hex>` | Theme colour of the `report` and `technical` looks. |
| `--stylesheet-path <file.css>` | Your CSS, relative to the Markdown file. |
| `--include-default-styles` | Use the built-in stylesheet (on by default). |
| `--highlight` | Colour code blocks (on by default). |
| `--highlight-style <theme.css>` | Code colour theme, for example `monokai.css`. |
| `--breaks` | Every new line is a line break. |
| `--emoji` | Turn `:shortcodes:` into emoji (on by default). |
| `--math` | Draw `$...$` maths with KaTeX. |
| `--math-options <json>` | `'{"macros":{"\\RR":"\\mathbb{R}"}}'` |
| `--toc` | Replace `[[toc]]` with a table of contents. |
| `--toc-options <json>` | `'{"level":[2,3],"list_type":"ol"}'` |
| `--heading-anchors` | Give headings ids for links. |
| `--header <json>`, `--footer <json>` | Replace the header or footer, for example `'{"center_text":"Page {page}"}'`. |
| `--display-header-footer` | Show the header and footer area. Not needed when a header or footer is set. |
| `--open-after-export` | Open the PDF when done. |
| `--settings <file.json or json>` | Use these settings instead of the user file. |
| `--watch` | Export again when the file or a settings file changes. |

Yes/no options accept `--toc`, `--toc=true`, `--toc=false` and `--no-toc`. JSON values need single
quotes in a POSIX shell.

What each option does in detail: [All settings](/reference/settings).

### Where the PDF goes

Without `-o`, the PDF goes next to the Markdown file, or into `output_directory` when the settings
set one (relative to the Markdown file). A relative `-o` path is also relative to the Markdown
file's folder, not to the current folder. Missing folders are created.

### --settings

`--settings` takes a JSON file or inline JSON. It replaces the user file (and
`MARKDOWN_PDF_SETTINGS`); a project `.markdown-pdf.json` still applies on top. It reads the same
keys as a settings file, presets `look`, `font`, `heading_font` and `template` included.

### --watch

`npx -y markdown-pdf-export notes.md --watch` exports once, then again each time you save the
Markdown file or a settings file it uses. Stop with Ctrl+C.

## Environment variables

| Variable | Value |
|---|---|
| `MARKDOWN_PDF_SETTINGS` | Inline JSON or a path to a JSON file, used instead of the user settings file. |
| `MARKDOWN_PDF_BROWSER` | `chrome`, `msedge`, `chromium`, or the path to a browser. See [Browser](/advanced/browser). |
| `MARKDOWN_PDF_DEBUG` | `1` writes `markdown-pdf-debug.log` in the temporary folder; a file path writes there. |

## Output and exit codes

On success, the only thing printed on standard output is the PDF path. Messages and errors go to
standard error.

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | The export failed (file not found, no browser, rendering error). `doctor` also returns `1` when something needs fixing. |
| `2` | Wrong usage: unknown option, bad value, missing file. |

## Scripts

Export every Markdown file of a folder into `build/`:

```sh
mkdir -p build
for f in docs/*.md; do
  npx -y markdown-pdf-export "$f" -o "$PWD/build/$(basename "${f%.md}").pdf"
done
```

## CI

GitHub Actions on Ubuntu already has Google Chrome, so this is enough:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npx -y markdown-pdf-export doctor || npx -y markdown-pdf-export install-browser
- run: npx -y markdown-pdf-export README.md -o "$PWD/dist/README.pdf"
```

`doctor` fails when no browser is found, which triggers the download. Commit a
`.markdown-pdf.json` to the repository so CI uses the same settings as you.
