# Header and footer reference

For people who need every key of the header and footer format, including the structured form and each element type.

The guide with examples is [Header and footer](/advanced/header-footer).

## Shape

`header` and `footer` take the same object. It has three kinds of keys:

```json
{
  "header": {
    "height": "18mm",
    "padding": "0 15mm",
    "border_bottom": "1px solid #ddd",

    "left": { "type": "image", "src": "@/logo.svg", "height": "12mm" },
    "center": { "type": "title" },

    "right_text": "{date:d MMMM yyyy}"
  }
}
```

- Area keys style the whole header or footer.
- Zone keys (`left`, `center`, `right`) hold elements.
- Flat keys (`left_text`, `right_image`, ...) are a short way to fill a zone with one element.

The same object works in a settings file, in front matter under `pdf:`, in the `--header` and
`--footer` command-line flags, and in the `header` and `footer` arguments of the assistant tool.

## Area keys

| Key | Value | Default |
|---|---|---|
| `height` | CSS length, for example `"15mm"` | fits the content |
| `padding` | CSS padding, for example `"0 15mm"` | `"0 10mm"` |
| `font_family` | CSS font list | the document font (`font_family`), else the system font |
| `font_size` | CSS size, for example `"9px"` | `"10px"` |
| `font_weight` | `"normal"`, `"bold"`, `600`, ... | |
| `font_style` | `"normal"`, `"italic"`, `"oblique"` | |
| `color` | CSS colour | |
| `background` | CSS background | |
| `border_bottom` | CSS border, header only | |
| `border_top` | CSS border, footer only | |
| `style` | extra CSS for the area, for example `"letter-spacing: 1px"` | |
| `left`, `center`, `right` | an element, a list of elements, or `null` | empty |

Lengths accept `mm`, `cm`, `in`, `pt` and `px`. Font size, weight, style and colour set on the area
apply to every element in it unless the element sets its own.

## Layout

- `left` is aligned to the left edge, `right` to the right edge.
- `center` is centred on the page, whatever the width of the other zones.
- Elements in a list are placed side by side, 4px apart, vertically centred.
- A border stops at the side padding, like the text. A background fills the full width.

## Flat keys

| Key | Same as |
|---|---|
| `left_text` | `"left": { "type": "text", "content": ... }` |
| `left_image` | `"left": { "type": "image", "src": ... }` |
| `left_image_height` | the `height` of that image |
| `center_text`, `center_image`, `center_image_height` | the same for `center` |
| `right_text`, `right_image`, `right_image_height` | the same for `right` |

Rules:

- A flat key is ignored when the same zone is also set with `left`, `center` or `right`.
- A zone gets one element from flat keys. With `left_text` and `left_image` both set, the text is
  shown and the image is not.

## Element types

Every element has a `type`. Keys marked "style" are `font_size`, `color` and `style` (extra CSS).

### text

| Key | Value |
|---|---|
| `content` | Required. Text with [placeholders](/reference/placeholders). |
| `font_weight` | `"bold"`, `600`, ... |
| `font_style` | `"normal"`, `"italic"`, `"oblique"` |
| style | `font_size`, `color`, `style` |

### image

| Key | Value |
|---|---|
| `src` | Required. SVG, PNG or JPG file. See the path rules below. |
| `height` | CSS height, for example `"12mm"`. |
| `width` | CSS width. Leave it out to keep the proportions. |
| `alt` | Alternative text. |
| `style` | Extra CSS. |

```json
{ "type": "image", "src": "@/logo.svg", "height": "12mm" }
```

### title

Prints the document title (front matter `title`, else the first `# heading`, else the file name).

| Key | Value |
|---|---|
| `fallback` | Text used when the title is empty. |
| `font_weight` | `"bold"`, `600`, ... |
| style | `font_size`, `color`, `style` |

### date

Prints the export date.

| Key | Value |
|---|---|
| `format` | [Date format](/reference/placeholders#date-formats). Default `yyyy-MM-dd`. |
| style | `font_size`, `color`, `style` |

```json
{ "type": "date", "format": "MMMM d, yyyy" }
```

### page_number and total_pages

| Key | Value |
|---|---|
| `format` | Text around the number, for example `"Page {page}"` or `"{pages} pages"`. Default: the number alone. |
| style | `font_size`, `color`, `style` |

A `text` element with `"Page {page} of {pages}"` does the same as both together.

### spacer

Adds space between elements in the same zone.

| Key | Value |
|---|---|
| `width` | Fixed width, for example `"5mm"`. Leave it out to fill the free space. |

## Image paths

| `src` written as | Looked up |
|---|---|
| relative, in a settings file | next to that settings file |
| relative, in front matter or a flag | next to the Markdown file |
| starting with `~/` | from the home folder |
| absolute | exactly there |
| starting with `@/` | inside `assets_directory` |

Images are embedded in the PDF. Files over 500 KB print a warning. A missing image prints a warning
and is left out.

## How the layers combine

1. A project `.markdown-pdf.json` is merged into the user file key by key.
2. A `header` or `footer` given for one export (flag or tool argument) replaces the one from the
   settings files.
3. Front matter is combined with the result: area keys replace the same keys, a zone key replaces
   the whole zone, and `null` removes the header, the footer or a zone.

The header and footer are shown as soon as either is set. When a header is set and the footer is not,
a default footer prints `{page} / {pages}` in 9px; set `"footer": null` to remove it.

## Full example

Settings file:

```json
{
  "assets_directory": "assets",
  "margin": { "top": "25mm", "bottom": "20mm" },
  "header": {
    "height": "18mm",
    "padding": "0 15mm",
    "border_bottom": "1px solid #ddd",
    "left": { "type": "image", "src": "@/logo.svg", "height": "12mm" },
    "center": { "type": "title", "font_weight": "bold" },
    "right": { "type": "date", "format": "d MMMM yyyy", "color": "#888" }
  },
  "footer": {
    "height": "10mm",
    "padding": "0 15mm",
    "font_size": "8px",
    "color": "#666",
    "left": { "type": "text", "content": "{author}" },
    "right": { "type": "page_number", "format": "Page {page} of {pages}" }
  }
}
```

The same header in front matter:

```yaml
---
pdf:
  header:
    height: 18mm
    padding: 0 15mm
    border_bottom: "1px solid #ddd"
    left: { type: image, src: "@/logo.svg", height: 12mm }
    center: { type: title, font_weight: bold }
    right: { type: date, format: d MMMM yyyy }
---
```

Quote values that contain `#` or start with `@` or `{`: YAML reads them otherwise.
