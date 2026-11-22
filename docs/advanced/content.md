# Content

For people who write maths, want a table of contents, or wonder how emoji and line breaks are handled.

Each feature below is switched on in your [settings file](/advanced/settings-file), in a document's
[front matter](/advanced/per-document) under `pdf:`, or for one export with a command-line flag.

## Maths

```json
{ "math": true }
```

Or `math: true` under `pdf:` in front matter, or `--math` for one export. Then write LaTeX between
dollar signs:

```markdown
The area of a circle is $A = \pi r^2$.

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
```

`$...$` is inline maths, `$$...$$` is a centred block. Formulas are drawn with
[KaTeX](https://katex.org/docs/supported); its fonts are embedded in the PDF.

`math_options` defines shortcuts (`macros`) and what happens on a LaTeX mistake. By default the
mistake is printed in red and the export goes on; `throw_on_error` stops it instead.

```json
{
  "math": true,
  "math_options": {
    "macros": { "\\RR": "\\mathbb{R}", "\\eps": "\\varepsilon" },
    "throw_on_error": false,
    "error_color": "#cc0000"
  }
}
```

In JSON, every backslash is written twice.

## Table of contents

```json
{
  "toc": true,
  "toc_options": { "level": [2, 3], "list_type": "ol" }
}
```

Then put `[[toc]]` on its own line where the list should go:

```markdown
# Annual report

[[toc]]

## Introduction
## Results
### By region
```

The table of contents links to each heading and is followed by a page break. `toc_options` is
optional: the default is levels 1 to 3 as a bullet list (`"ul"`); `"ol"` numbers the entries.

## Links to headings

Each heading gets an id, so you can link to it inside the PDF:

```markdown
See [the results](#results) and [regional figures](#by-region).
```

The id is the heading text in lower case, with punctuation removed and spaces replaced by hyphens:
`## Q3: Next steps` becomes `#q3-next-steps`. Accented letters are kept. Repeated headings get
`-1`, `-2`: `#notes`, `#notes-1`, `#notes-2`.

To turn ids off, set `"heading_anchors": false` (or pass `--no-heading-anchors`). The table of
contents (`toc`) needs them and turns them back on.

## Emoji

Emoji shortcodes are on by default: `:tada:` prints the party popper emoji, drawn with the emoji
font of the computer. Emoji typed directly also work. Set `"emoji": false` to print shortcodes as
plain text.

## Line breaks

By default Markdown joins the lines of a paragraph. To end a line, finish it with two spaces or a
backslash. To make every new line a line break, as in a chat message, set `"breaks": true`.

## Other Markdown details

- HTML in the Markdown is kept, so `<div>`, `<br>` or `<sup>` work, apart from the few tags
  listed in [Raw HTML and safety](#raw-html-and-safety).
- Bare web addresses become links.
- Straight quotes become curly quotes, and `--` and `...` become dashes and ellipses.
- Images in the document are relative to the Markdown file.
- Code blocks are coloured when they name a language; see [Styling](/advanced/styling#code-colours).

## Raw HTML and safety

A Markdown file is not always written by you: it may come from a cloned project, a download or an
assistant. So that a document cannot run code or read files while it is printed, raw HTML is
filtered by default (`"sanitize": "safe"`):

- `<script>`, `<iframe>`, `<object>`, `<applet>`, `<frameset>`, `<noembed>` and `<noframes>` are
  removed together with their content.
- `<embed>`, `<frame>`, `<meta>`, `<base>`, `<link>`, `<form>`, `<title>`, `<textarea>`, `<xmp>` and
  `<plaintext>` are shown as text.
- Event handlers such as `onclick` or `onerror` do nothing, and `javascript:`, `vbscript:` and
  `data:` links (other than `data:image/...`) become `#`.
- The page is printed with JavaScript switched off and a Content Security Policy that blocks
  scripts, frames and plugins.

Everything else stays: `<div>`, `<span>`, `<img>`, `<sup>`, `<br>`, page breaks, inline `style=""`
and `<style>` blocks. Code blocks are never changed. When something is removed, the command line
says so, and the assistant tool lists it in `removed_html`.

For documents you trust that need the old behaviour, turn the filter off in a settings file
(your user settings or the project's `.markdown-pdf.json`):

```json
{ "sanitize": "none" }
```

or for one export from the command line: `--sanitize none`. Front matter and the assistant tool
cannot turn it off, so a document or a prompt cannot unlock itself.

