# Styling

For people who want to change how the document body looks: page style, fonts, code colours, their own CSS and page breaks.

The quickest change, in your [settings file](/advanced/settings-file):

```json
{
  "look": "report",
  "font": "serif",
  "heading_font": "geometric",
  "highlight_style": "atom-one-light.css"
}
```

## Page styles

`look` picks a ready-made style for the whole document:

| Value | Description |
|---|---|
| `clean` | Default. GitHub-style, neutral. |
| `report` | Serif headings, strong title rule. Business reports. |
| `academic` | Serif body, justified, minimal colour, 25 mm margins, black and white code. |
| `compact` | Dense and small, 10 mm margins. More text per page. |
| `technical` | Framed code blocks, blue accents, Atom One light code colours. |

A look is a stylesheet plus a few settings. Keys you write next to it win, so
`"look": "academic", "margin": {"top": "20mm"}` keeps the academic style with a smaller top margin.

## Fonts

| Key | Sets |
|---|---|
| `font` | the text font, from a preset name |
| `heading_font` | the title font (h1 to h6), from a preset name |
| `font_family` | the text font, as a CSS font list |
| `heading_font_family` | the title font, as a CSS font list |

The preset names are `sans`, `serif`, `book`, `humanist`, `geometric`, `mono` and `system` (see
[Settings file](/advanced/settings-file)). For any other font:

```json
{
  "font_family": "\"Source Sans 3\", \"Segoe UI\", Arial, sans-serif",
  "heading_font_family": "Georgia, serif"
}
```

The font must be installed on the computer that makes the PDF. List a common font last as a
fallback. A font you choose always wins over the font of the page style.

The header and footer use the text font unless you set `font_family` on them.

## Your own CSS

```json
{
  "stylesheet_path": "pdf.css"
}
```

The path is relative to the settings file. On the command line, `--stylesheet-path pdf.css` is
relative to the Markdown file.

Your stylesheet is added after the built-in styles, so your rules win:

```css
h1 { color: #0b4f8a; border-bottom: 2px solid #0b4f8a; }
table { font-size: 0.9em; }
th { background: #f0f4f8; }
blockquote { border-left-color: #0b4f8a; }
a { color: inherit; text-decoration: underline; }
```

A page style is a stylesheet too, and only one stylesheet is used: `stylesheet_path` replaces the
look's stylesheet. Use one or the other.

The styles are added in this order (later wins):

1. The built-in stylesheet.
2. The maths stylesheet, when `math` is on.
3. The code colour theme.
4. Your stylesheet, or the look's stylesheet.
5. The fonts you chose.

### Start from a blank page

```json
{
  "include_default_styles": false,
  "stylesheet_path": "my-print.css"
}
```

With `include_default_styles` set to `false`, the built-in stylesheet is left out and only your CSS
(plus the code colours) applies. Headings, tables and code blocks then use the browser's plain
defaults until you style them.

Background colours are printed by default; set `"print_background": false` to save ink.

## Code colours

`highlight_style` picks the colour theme for code blocks. It takes the file name of any
[highlight.js](https://highlightjs.org/examples) theme. A few of them:

| Light | Dark |
|---|---|
| `github.css` (default) | `github-dark.css` |
| `atom-one-light.css` | `atom-one-dark.css` |
| `vs.css` | `vs2015.css` |
| `xcode.css` | `monokai.css` |
| `ascetic.css` (black and white) | `nord.css`, `tokyo-night-dark.css` |

The `$schema` autocomplete lists all of them. Dark themes also darken the code block background.

Code is coloured only when the block names its language after the opening backticks, for example
`python`. Set `"highlight": false` to print all code in one colour.

## Page breaks

Put this line where a new page should start:

```markdown
<div class="page"></div>
```

It needs the built-in stylesheet. For more control, use CSS in your own stylesheet:

```css
h1 { break-before: page; }               /* each h1 starts a new page */
h2 { break-after: avoid; }               /* keep a heading with its text */
table, pre, figure { break-inside: avoid; }
```

A table of contents made with `[[toc]]` is followed by a page break. See [Content](/advanced/content).

Paper size, orientation and margins: see [All settings](/reference/settings).
