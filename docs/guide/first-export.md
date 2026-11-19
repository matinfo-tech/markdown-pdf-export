# First Export

This guide walks you through creating your first PDF export with Markdown PDF.

## Basic Export

Pick the way you set up. All of them produce the same PDF, next to your source file.

**1. VS Code task** ([setup](/guide/vscode))

1. Open any Markdown file in VS Code (with its folder open)
2. Run **Tasks: Run Task** and choose *Markdown: Export to PDF* (or press your key binding)

**2. Zed task** ([setup](/guide/zed-task))

1. Open any Markdown file in Zed
2. Run **task: spawn** and choose *Markdown: Export to PDF* (or press your key binding)

**3. Command line** ([reference](/guide/cli))

```sh
npx -y markdown-pdf-export report.md
```

The command prints the path of the PDF.

**4. AI assistant** ([setup](/guide/mcp))

1. Open any Markdown file in VS Code or Zed
2. Open the assistant — the chat in VS Code, the assistant panel in Zed (`Cmd+Enter` / `Ctrl+Enter`)
3. Type:

   ```
   Export this file to PDF
   ```

If the export reports `No usable Chrome/Chromium browser found.`, install Google Chrome or Microsoft
Edge, or run `npx -y markdown-pdf-export install-browser` once (see [Browser](/guide/browser)).

## Export with Options

On the command line, options are flags. In a VS Code or Zed task, add the same flags to `args`:

```sh
npx -y markdown-pdf-export report.md --orientation landscape
npx -y markdown-pdf-export report.md -o docs/output.pdf --highlight-style monokai.css
npx -y markdown-pdf-export report.md --display-header-footer
```

`--display-header-footer` shows the header and footer you configured (see the next section).

With the assistant, specify options directly in your prompt:

```
Export this file to PDF in landscape orientation
```

```
Export to docs/output.pdf with the monokai theme
```

```
Export with header and footer showing page numbers
```

## Add a Header and Footer

To add a structured header and footer, use front matter:

```yaml
---
title: My Document
pdf:
  header:
    height: 15mm
    center_text: "{title}"
    right_text: "{date:yyyy-MM-dd}"
  footer:
    center_text: "Page {page} of {pages}"
---

# My Document

Content goes here...
```

Then export normally, with the task, the command line or the prompt `Export this file to PDF`. Front
matter applies to all of them.

## Output Location

By default, PDFs are saved next to the source file:

```
docs/
├── report.md
└── report.pdf    ← Generated here
```

To specify a different location, use `-o` on the command line (or in the task's `args`):

```sh
npx -y markdown-pdf-export report.md -o build/output.pdf
```

Or ask the assistant:

```
Export to build/output.pdf
```

Or configure a default output directory in your settings file (see [Global Settings](/guide/global-settings#configuration-location) for how it is loaded):

```json
{
  "output_directory": "./build"
}
```

## Open After Export

To automatically open the PDF after export, add to your settings file:

```json
{
  "open_after_export": true
}
```

Or pass `--open-after-export` on the command line, or ask the assistant:

```
Export this file to PDF and open it
```

## Syntax Highlighting

Code blocks are automatically syntax-highlighted using the `github.css` theme. To change the theme,
pass `--highlight-style atom-one-dark.css` on the command line, or ask the assistant:

```
Export with the atom-one-dark theme
```

Or set a default in your settings file:

```json
{
  "highlight_style": "atom-one-dark.css"
}
```

## Verify Your Setup

If something doesn't work, run the diagnostic from a terminal:

```sh
npx -y markdown-pdf-export doctor
```

Or ask the assistant:

```
Run doctor_markdown_pdf
```

This shows:
- Browser availability, version, and which browser was picked
- Current settings
- Package directory path

## Next Steps

- [Header & Footer](/guide/header-footer) — Add professional headers and footers
- [Placeholders](/guide/placeholders) — Use dynamic content
- [Examples](/examples/basic) — Copy-paste ready configurations