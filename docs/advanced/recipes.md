# Recipes

For people who want a ready-made header and footer to start from.

Each recipe below is a template shipped with the package. Use one in two ways:

- Short: add `"template": "<name>"` to your [settings file](/advanced/settings-file). Keys you write
  next to it win, so you can change one line of the template.
- Full copy: run `npx -y markdown-pdf-export init --template <name>` to write the whole template into
  your settings file and edit it. Add `--project` to write `.markdown-pdf.json` in the current folder
  instead, and `--force` to replace an existing file.

How the keys work: [Header and footer](/advanced/header-footer).

## Minimal

Page numbers at the bottom and nothing else. Good for notes and drafts.

<LayoutDiagram template="minimal" />

<<< @/../templates/minimal.json

Use it: `"template": "minimal"` in the settings file, or `npx -y markdown-pdf-export init --template minimal`.

## Simple

Title and date on top, "Page x of y" at the bottom. Good for most documents.

<LayoutDiagram template="simple" />

<<< @/../templates/simple.json

Use it: `"template": "simple"` in the settings file, or `npx -y markdown-pdf-export init --template simple`.

## Corporate

Company logo, title and long date on top with a blue rule. For reports and letters sent outside.

<LayoutDiagram template="corporate" />

<<< @/../templates/corporate.json

Put your logo at `assets/company-logo.svg` next to the settings file, or change `left_image`.

Use it: `"template": "corporate"` in the settings file, or `npx -y markdown-pdf-export init --template corporate`.

## Academic

Author and title in small italics on top, page number centred at the bottom, Times-style text and
25 mm margins. For papers and theses. Set `author` in the front matter.

<LayoutDiagram template="academic" />

<<< @/../templates/academic.json

Use it: `"template": "academic"` in the settings file, or `npx -y markdown-pdf-export init --template academic`. Combine it with `"look": "academic"` for the
matching body style.

## Two logos

Your logo on the left, a partner's logo on the right, the title between them, and a "Confidential"
footer. For joint projects and agreements.

<LayoutDiagram template="two-logo" />

<<< @/../templates/two-logo.json

Put `our-logo.svg` and `partner-logo.svg` in an `assets` folder next to the settings file, and change
"Company Name" in `left_text`.

Use it: `"template": "two-logo"` in the settings file, or `npx -y markdown-pdf-export init --template two-logo`.

## Custom variables

Print values from each document, such as a client name or a version number, in the header and
footer. Write the layout once in the settings file:

```json
{
  "margin": { "top": "25mm", "bottom": "20mm" },
  "header": {
    "height": "15mm",
    "padding": "0 15mm",
    "border_bottom": "1px solid #ddd",
    "left_text": "{client}",
    "center_text": "{title}",
    "right_text": "{project_code}"
  },
  "footer": {
    "height": "10mm",
    "padding": "0 15mm",
    "font_size": "8px",
    "color": "#666",
    "left_text": "Version {version}, {status}",
    "right_text": "Page {page} of {pages}"
  }
}
```

Then fill the values in each document's front matter:

```markdown
---
title: Website redesign proposal
client: Acme Corp
project_code: ACM-2041
version: "1.2"
status: Draft
---

# Website redesign proposal
```

The header shows "Acme Corp", the title and "ACM-2041"; the footer shows "Version 1.2, Draft" and the
page numbers. A document without one of these fields shows the placeholder as written, so give every
document the same fields.

Rules for the field names (letters, digits and underscores; not case sensitive; reserved names) are
in [Per document](/advanced/per-document#custom-variables).
