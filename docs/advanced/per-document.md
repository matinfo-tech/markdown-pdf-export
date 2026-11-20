# Per document

For people who want one document to look different from the others, or to print values from the document in its header and footer.

Put a front matter block at the very top of the Markdown file:

```markdown
---
title: Quarterly report
author: Jane Smith
client: Acme Corp
pdf:
  orientation: landscape
  margin:
    top: 25mm
  header:
    left_text: "{client}"
    right_text: "{date:d MMMM yyyy}"
  footer:
    center_text: "Page {page} of {pages}"
---

# Results
```

The block is written in YAML between two `---` lines. It is not printed in the PDF.

## The pdf: block

Settings under `pdf:` apply to this document only. They win over the settings file and over
command-line flags (see [which setting wins](/advanced/settings-file#which-setting-wins)).

These keys work in the `pdf:` block:

| Group | Keys |
|---|---|
| Page | `page_format`, `orientation`, `margin`, `scale`, `page_ranges`, `print_background` |
| Text | `font_family`, `heading_font_family`, `include_default_styles`, `breaks`, `emoji` |
| Code | `highlight`, `highlight_style` |
| Maths and contents | `math`, `math_options`, `heading_anchors`, `toc`, `toc_options` |
| Header and footer | `header`, `footer`, `display_header_footer` |

These work only in a settings file, not in front matter: the presets `look`, `font`,
`heading_font` and `template`, and the paths `stylesheet_path`, `output_directory` and
`assets_directory`. For a font, use `font_family` with a CSS font list, such as
`font_family: "Georgia, serif"`. Every key is described in [All settings](/reference/settings).

## Headers and footers in front matter

A header in front matter is combined with the header from your settings:

- Area keys such as `height`, `color` or `border_bottom` replace the same key from settings.
- A zone (`left`, `center`, `right`) you set replaces that whole zone. The other zones stay.
- `header: null` or `footer: null` removes it for this document.

```yaml
pdf:
  header: null
  footer:
    center_text: "Draft, page {page}"
```

Use the same form as your settings file. If the settings file fills a zone with the structured form
(`left:`), a flat key such as `left_text:` in front matter does not replace it; write `left:` there
too. Each zone holds one flat key: to swap text for an image, use the structured form. See
[Header and footer](/advanced/header-footer).

Image paths in front matter are relative to the Markdown file.

## Title, author and date

| Field | Used for |
|---|---|
| `title` | `{title}` and the PDF title. Without it, the first `# heading` is used, then the file name. |
| `author` | `{author}`. A list of authors is joined with commas. |
| `date` | Nothing in headers or footers: `{date}` always prints the export date. Use a custom variable for a fixed date. |

## Custom variables

Every other top-level field becomes a placeholder with the same name:

```markdown
---
title: Service agreement
client: Acme Corp
project_code: ACM-2041
version: 3
release_date: 12 March 2026
pdf:
  footer:
    left_text: "{client}, {project_code}"
    right_text: "Version {version}, {release_date}"
---
```

Rules:

- Names are not case sensitive: `Client:` is used as `{client}`.
- Use letters, digits and underscores only. `{project-code}` is not recognised; write
  `project_code`.
- Use plain text or numbers as values. Lists and nested objects do not print well. Quote dates
  written as `"2026-03-12"`, or YAML turns them into a long date and time.
- `title`, `author`, `date` and `pdf` are reserved. Do not reuse the built-in names `page`,
  `pages`, `time`, `datetime` or `filename`.
- A placeholder with no matching field is printed as it is, braces included. Check the spelling when
  you see `{clinet}` in the PDF.

Placeholders work in header and footer text only, not in the document body. The full list is in
[Placeholders](/reference/placeholders). A complete example is in
[Recipes](/advanced/recipes#custom-variables).

## YAML tips

Put quotes around a value that starts with `{` or `@`, or contains `: ` or ` #`:

```yaml
center_text: "{title}"        # right
center_text: {title}          # wrong: YAML reads this as an object
note: "Status: draft"         # right
```

If the YAML itself is invalid, the whole front matter is ignored and the export runs with your
settings. Problems inside the `pdf:` block are written to the debug log: run the export with
`MARKDOWN_PDF_DEBUG=1` and read `markdown-pdf-debug.log` in your temporary folder.
