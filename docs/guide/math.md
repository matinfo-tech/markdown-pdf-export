# Math (KaTeX)

Markdown PDF can render LaTeX math via [KaTeX](https://katex.org/). Math is
rendered server-side (no JavaScript in the PDF), and fonts are inlined so the
output is fully self-contained.

## Enable

In your settings file (see [Global Settings](/guide/global-settings#configuration-location) for how it is loaded):

```json
{
  "math": true
}
```

Or per document, via front matter:

```markdown
---
title: Lecture Notes
pdf:
  math: true
---
```

For a single export — CLI: `--math` (add it to the `args` of a [VS Code](/guide/vscode) or
[Zed](/guide/zed-task) task), or ask the assistant: `Export this file to PDF with math rendering`.
KaTeX options go in `--math-options '<json>'`.

## Syntax

| Syntax | Renders as |
|--------|------------|
| `$x^2$` | Inline math |
| `$$\int_0^1 x\,dx$$` | Display math (centered block) |

Examples:

```markdown
The area of a circle is $A = \pi r^2$.

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$
```

## Macros

Define custom LaTeX macros to reuse across all documents:

```json
{
  "math_options": {
    "macros": {
      "\\RR": "\\mathbb{R}",
      "\\NN": "\\mathbb{N}",
      "\\eps": "\\varepsilon"
    }
  }
}
```

> **JSON gotcha:** every LaTeX backslash must be doubled inside JSON strings.

## Error handling

By default, invalid LaTeX is rendered inline in red rather than aborting the
export. Override:

```json
{
  "math_options": {
    "throw_on_error": true,
    "error_color": "#ff0000"
  }
}
```

## Performance

KaTeX runs at HTML generation time, before Playwright opens the page. Adding
math has no measurable impact on PDF rendering speed beyond the markdown-it
pass itself.
