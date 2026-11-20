# Header and footer

For people who want page numbers, a title, a date or a logo on every page, written by hand instead of with Studio.

The smallest working footer, in your [settings file](/advanced/settings-file):

```json
{
  "footer": { "center_text": "Page {page} of {pages}" }
}
```

The same for one document, in its front matter:

```yaml
---
pdf:
  footer:
    center_text: "Page {page} of {pages}"
---
```

The header and footer appear as soon as `header` or `footer` is set. You do not need
`display_header_footer`.

## Header and footer together

```json
{
  "margin": { "top": "25mm", "bottom": "20mm" },
  "header": {
    "height": "15mm",
    "border_bottom": "1px solid #ddd",
    "left_text": "{title}",
    "right_text": "{date:d MMMM yyyy}"
  },
  "footer": {
    "height": "10mm",
    "font_size": "8px",
    "color": "#666",
    "center_text": "Page {page} of {pages}"
  }
}
```

If you set a header and no footer, you get a small centred `{page} / {pages}` footer. To have a
header with no footer, set `"footer": null`.

## Three zones

Each header and footer has three zones: left, center and right. The center zone stays at the middle
of the page whatever the left and right zones contain.

Fill a zone with one flat key:

| Key | Puts in the zone |
|---|---|
| `left_text`, `center_text`, `right_text` | Text. Placeholders such as `{title}` are replaced. |
| `left_image`, `center_image`, `right_image` | An image (SVG, PNG or JPG). |
| `left_image_height`, `center_image_height`, `right_image_height` | The height of that image, for example `"12mm"`. The width follows. |

A zone holds one item with flat keys. If you set both `left_text` and `left_image`, only the text is
shown. For a logo and text in the same zone, or for different styles per item, use the
[structured form](#structured-form).

## Area keys

These keys style the whole header or footer:

| Key | Example | Default |
|---|---|---|
| `height` | `"15mm"` | fits the content |
| `padding` | `"0 15mm"` (top and bottom, left and right) | `"0 10mm"` |
| `font_family` | `"Georgia, serif"` | the document font |
| `font_size` | `"9px"`, `"8pt"` | `"10px"` |
| `font_weight` | `"bold"`, `600` | |
| `font_style` | `"italic"` | |
| `color` | `"#666"` | |
| `background` | `"#f5f5f5"` | |
| `border_bottom` | `"1px solid #ddd"` (header only) | |
| `border_top` | `"1px solid #ddd"` (footer only) | |
| `style` | any extra CSS, `"letter-spacing: 1px"` | |

Sizes use CSS units: `mm`, `cm`, `in`, `pt` or `px`. A border stops at the side padding, like the
text.

## Leave room in the margin

The header is drawn inside the top page margin and the footer inside the bottom margin. Make each
margin larger than the height of what goes in it, or the header overlaps the text, as in the example
above (15 mm header, 25 mm top margin). The default margin is 15 mm on every side, enough for a
10 mm footer.

## Images and logos

Images are embedded in the PDF, so the PDF works anywhere. SVG gives the sharpest result. Files over
500 KB print a warning; make them smaller.

Where the path starts from:

| Written as | Looked up |
|---|---|
| `"logo.svg"` in a settings file | next to that settings file |
| `"logo.svg"` in front matter or in a `--header` flag | next to the Markdown file |
| `"~/brand/logo.svg"` | from your home folder |
| `"/Users/me/brand/logo.svg"`, `"C:\\brand\\logo.svg"` | exactly there |
| `"@/logo.svg"` | inside `assets_directory` |

### The assets folder

`assets_directory` names a folder for shared images. Set it once in a settings file; it is relative
to that file. Then write `@/` in front of the image name anywhere, including front matter:

```json
{
  "assets_directory": "assets",
  "header": {
    "left_image": "@/company-logo.svg",
    "left_image_height": "14mm",
    "right_text": "{title}"
  }
}
```

With this in the user file, the logo is `~/.config/markdown-pdf-export/assets/company-logo.svg`.
The `corporate` and `two-logo` templates work this way.

A missing image, or `@/` without `assets_directory`, prints a warning in the terminal and the PDF is
made without the image.

## Placeholders

Text can contain `{page}`, `{pages}`, `{title}`, `{author}`, `{filename}`, `{date}`, `{time}`,
`{datetime}`, a date in your own format such as `{date:d MMMM yyyy}`, and any custom field from
front matter such as `{client}`. Every placeholder and date format is listed in
[Placeholders](/reference/placeholders).

## Structured form

Flat keys are a short way of writing zones. The full form lets you put several items in one zone and
style each one:

```json
{
  "header": {
    "height": "18mm",
    "padding": "0 15mm",
    "left": [
      { "type": "image", "src": "@/logo.svg", "height": "12mm" },
      { "type": "text", "content": "Acme Corp", "font_weight": "bold" }
    ],
    "center": { "type": "title", "font_size": "11px" },
    "right": { "type": "date", "format": "MMMM d, yyyy", "color": "#888" }
  }
}
```

A zone is one item, a list of items, or `null` for empty. Item types: `text`, `image`, `title`,
`date`, `page_number`, `total_pages` and `spacer`. Each type and its keys are listed in the
[Header and footer reference](/reference/header-footer).

## One export only

On the command line, `--header` and `--footer` take JSON and replace the header or footer from your
settings for this export:

```sh
npx -y markdown-pdf-export report.md --footer '{"right_text":"Draft, page {page}"}'
```

An AI assistant can pass the same objects. Front matter still wins; see
[Per document](/advanced/per-document#headers-and-footers-in-front-matter).

## When it looks wrong

| Problem | Fix |
|---|---|
| The header covers the first lines of text | Make `margin.top` larger than the header `height`. |
| No header or footer at all | Check that the settings file is loaded: `npx -y markdown-pdf-export doctor`. |
| The logo is missing | Check the path rules above. Run the export in a terminal and read the warning. |
| `{title}` is printed as is | In YAML, quote the value: `"{title}"`. Check the spelling of custom fields. |
| Text is too small or too large | Set `font_size` on the header or footer. |
| A `left_text` in front matter has no effect | The settings file uses `left:`; use `left:` in front matter too. |
