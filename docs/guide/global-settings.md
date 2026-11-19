# Global Settings

Configure default options for all PDF exports.

## Configuration Location

Settings are a plain JSON object. Keep it in a file, for example
`~/.config/markdown-pdf/settings.json`:

```json
{
  "page_format": "A4",
  "highlight_style": "github.css"
}
```

Then point Markdown PDF at that file. Use an absolute path (`~` is not expanded).

**Zed task** — add `env` to the task in `tasks.json`:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "env": { "MARKDOWN_PDF_SETTINGS": "/Users/me/.config/markdown-pdf/settings.json" },
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

**MCP server** — add `env` to the `context_servers` entry in Zed's `settings.json`:

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

**Command line** — pass the file with `--settings`:

```sh
npx -y markdown-pdf-export doc.md --settings /Users/me/.config/markdown-pdf/settings.json
```

`MARKDOWN_PDF_SETTINGS` accepts either the path to a JSON file or inline JSON
(`"{\"page_format\":\"A4\"}"`). `--settings` accepts the same two forms.

The JSON examples on this site show the content of that settings file. See
[Priority Order](#priority-order) for how the sources combine.

## One-Off Overrides

Most settings can also be given for a single export without touching the settings file:

- **CLI / Zed task:** the flag of the same name in kebab-case, for example `page_format` →
  `--page-format Letter`, `toc` → `--toc`, `highlight` → `--no-highlight`. See
  [Command Line](/guide/cli#options) for the full list.
- **AI assistant:** say it in the prompt, for example `Export this file to PDF in Letter format`.

`header` and `footer` take JSON (`--header '{"center_text":"{title}"}'`). `output_directory` and
`assets_directory` have no flag; set them in the settings file.

## Complete Example

`settings.json`:

```json
{
  "page_format": "A4",
  "orientation": "portrait",
  "scale": 1,
  "print_background": true,
  "margin": {
    "top": "20mm",
    "right": "15mm",
    "bottom": "20mm",
    "left": "15mm"
  },
  "font_family": "Georgia, serif",
  "include_default_styles": true,
  "highlight": true,
  "highlight_style": "github.css",
  "emoji": true,
  "open_after_export": false,
  "header": {
    "height": "15mm",
    "left_image": "./logo.svg",
    "left_image_height": "12mm",
    "center_text": "{title}",
    "right_text": "{date:MMMM d, yyyy}"
  },
  "footer": {
    "height": "10mm",
    "center_text": "Page {page} of {pages}"
  }
}
```

## Page Settings

### page_format

Paper size for the PDF.

| Value | Description |
|-------|-------------|
| `"A4"` | 210 × 297 mm (default) |
| `"Letter"` | 8.5 × 11 inches |
| `"Legal"` | 8.5 × 14 inches |
| `"Tabloid"` | 11 × 17 inches |
| `"A3"` | 297 × 420 mm |
| `"A5"` | 148 × 210 mm |

```json
{ "page_format": "Letter" }
```

### orientation

Page orientation.

| Value | Description |
|-------|-------------|
| `"portrait"` | Vertical (default) |
| `"landscape"` | Horizontal |

```json
{ "orientation": "landscape" }
```

### scale

Zoom factor for page rendering.

- **Type**: `number`
- **Range**: `0.1` to `2`
- **Default**: `1`

```json
{ "scale": 0.9 }
```

### margin

Page margins as CSS length values.

```json
{
  "margin": {
    "top": "20mm",
    "right": "15mm",
    "bottom": "20mm",
    "left": "15mm"
  }
}
```

Supported units: `mm`, `cm`, `in`, `px`, `pt`

### page_ranges

Print only specific pages.

- **Type**: `string`
- **Default**: `""` (all pages)

```json
{ "page_ranges": "1-5, 8, 10-12" }
```

### print_background

Include background colors and images.

- **Type**: `boolean`
- **Default**: `true`

```json
{ "print_background": true }
```

## Content Settings

### font_family

CSS font-family for the document body and header/footer.

- **Type**: `string | null`
- **Default**: `null` (system fonts)

```json
{ "font_family": "Georgia, 'Times New Roman', serif" }
```

### include_default_styles

Include the built-in neutral stylesheet.

- **Type**: `boolean`
- **Default**: `true`

```json
{ "include_default_styles": false }
```

Set to `false` to use only your custom stylesheet.

### stylesheet_path

Path to a custom CSS file.

- **Type**: `string | null`
- **Default**: `null`

```json
{ "stylesheet_path": "./styles/custom.css" }
```

Relative paths are resolved from the Markdown file's directory.

### breaks

Convert single newlines to `<br>` elements.

- **Type**: `boolean`
- **Default**: `false`

```json
{ "breaks": true }
```

### emoji

Render emoji shortcodes (`:smile:` → 😄).

- **Type**: `boolean`
- **Default**: `true`

```json
{ "emoji": true }
```

## Syntax Highlighting

### highlight

Enable syntax highlighting for code blocks.

- **Type**: `boolean`
- **Default**: `true`

```json
{ "highlight": true }
```

### highlight_style

Highlight.js theme filename.

- **Type**: `string`
- **Default**: `"github.css"`

```json
{ "highlight_style": "atom-one-dark.css" }
```

Popular themes:

| Theme | Style |
|-------|-------|
| `github.css` | Light GitHub (default) |
| `github-dark.css` | Dark GitHub |
| `monokai.css` | Classic Monokai |
| `atom-one-dark.css` | Atom One Dark |
| `nord.css` | Nord |
| `vs.css` | VS Light |
| `vs2015.css` | VS Dark |

Browse all themes at [highlightjs.org/demo](https://highlightjs.org/demo).

## Header & Footer

### header

Structured header configuration.

- **Type**: `object | null`
- **Default**: `null`

```json
{
  "header": {
    "height": "15mm",
    "padding": "0 10mm",
    "font_size": "9px",
    "left": { "type": "image", "src": "./logo.svg", "height": "12mm" },
    "center": { "type": "title" },
    "right": { "type": "date", "format": "MMMM d, yyyy" }
  }
}
```

See [Header & Footer](/guide/header-footer) for complete documentation.

### footer

Structured footer configuration.

- **Type**: `object | null`
- **Default**: `null`

```json
{
  "footer": {
    "height": "10mm",
    "center": { "type": "text", "content": "Page {page} of {pages}" }
  }
}
```

### Shorthand Syntax

For simple headers/footers:

```json
{
  "header": {
    "height": "15mm",
    "left_image": "./logo.svg",
    "left_image_height": "12mm",
    "center_text": "{title}",
    "right_text": "{date:yyyy-MM-dd}"
  }
}
```

## Output Settings

### assets_directory

Global directory for shared assets (images, logos). Supports `~` for home directory.

- **Type**: `string | null`
- **Default**: `null`

```json
{ "assets_directory": "~/.config/markdown-pdf/assets" }
```

Paths starting with `@/` in image sources are resolved relative to this directory:

```json
{
  "assets_directory": "~/.config/markdown-pdf/assets",
  "header": {
    "left_image": "@/company-logo.svg"
  }
}
```

The `~` expands to your home directory on all platforms:
- **macOS/Linux**: `$HOME` (e.g., `/Users/john`)
- **Windows**: `%USERPROFILE%` (e.g., `C:\Users\john`)

### output_directory

Default directory for output PDFs.

- **Type**: `string | null`
- **Default**: `null` (same directory as source)

```json
{ "output_directory": "./build" }
```

### open_after_export

Open the PDF in the default viewer after export.

- **Type**: `boolean`
- **Default**: `false`

```json
{ "open_after_export": true }
```

## Priority Order

Highest priority first:

1. **Front matter** — the `pdf:` block of the document
2. **Per-export options** — CLI flags (`--page-format Letter`) or MCP tool arguments (from the prompt)
3. **`--settings <json|file.json>`** — CLI only
4. **`MARKDOWN_PDF_SETTINGS`** — environment variable (file path or inline JSON)
5. **Built-in defaults**

## Minimal Configuration

A minimal setup with header and footer:

```json
{
  "header": {
    "center_text": "{title}",
    "right_text": "{date:yyyy-MM-dd}"
  },
  "footer": {
    "center_text": "Page {page} of {pages}"
  }
}
```

## Organization-Wide Settings

For consistent branding across all documents, use the global assets directory:

```json
{
  "assets_directory": "~/.config/markdown-pdf/assets",
  "font_family": "Helvetica, Arial, sans-serif",
  "header": {
    "height": "20mm",
    "padding": "0 15mm",
    "border_bottom": "2px solid #0066cc",
    "left_image": "@/logos/company-logo.svg",
    "left_image_height": "15mm",
    "right_text": "{date:MMMM d, yyyy}"
  },
  "footer": {
    "height": "12mm",
    "padding": "0 15mm",
    "font_size": "8px",
    "color": "#666",
    "left_text": "© 2025 Company Name",
    "center_text": "Page {page} of {pages}",
    "right_text": "Confidential"
  }
}
```

Each team member places their copy of the brand assets in the configured `assets_directory`.

::: tip Team Setup
Share a ZIP of your brand assets with team members. They extract it to `~/.config/markdown-pdf/assets/` and the same settings work for everyone.
:::

## Next Steps

- [Front Matter](/guide/front-matter) — Per-document overrides
- [Header & Footer](/guide/header-footer) — Complete header/footer guide
- [Custom Styling](/guide/custom-styling) — CSS customization