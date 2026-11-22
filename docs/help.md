---
description: "Fix common problems when exporting Markdown to PDF: browser not found, settings not used, logo missing."
title: Help
---

# Help

<p class="lead">Start here: this checks everything and tells you what to fix.</p>

<CopyCommand command="npx -y markdown-pdf-export doctor" />

When all is well it says **Everything is ready**. Otherwise each line with a cross tells you what to
do. The most common problems:

## "No usable Chrome/Chromium browser found"

Install [Google Chrome](https://www.google.com/chrome/) or Microsoft Edge, or let the tool download
its own copy (about 200 MB, once):

<CopyCommand command="npx -y markdown-pdf-export install-browser" />

## "npx: command not found" or "node is not recognized"

Node.js is missing or the terminal was open before you installed it. Install it from
[nodejs.org](https://nodejs.org), then close the terminal and open a new one.

## The PDF does not use my header, footer or style

Run `doctor` and look at the **Settings** line: it shows which settings file is used. Save again in
[Studio](/studio) if it shows none. A `.markdown-pdf.json` file in your project folder wins over your
own settings for documents in that folder.

## My editor does not show the task or the assistant cannot export

Restart the editor after adding the task or the assistant entry. In Zed and VS Code, check that the
assistant is in agent mode. Then follow the steps for your editor again: [Your editor](/editors).

## My logo or image does not appear

Use PNG, JPG or SVG. In Studio, drop the image on a spot again and press **Save**. Images in your
document are found next to the Markdown file: `![Chart](images/chart.png)`.

## Some of my HTML is shown as text or missing

Raw HTML that can run code or load other pages (`<script>`, `<iframe>`, `<object>`, `<meta>`,
`<link>`, `onclick`…) is filtered out of the document by default. See
[Raw HTML and safety](/advanced/content#raw-html-and-safety) for the full list and how to turn it
off for documents you trust.

## The first export is slow

The first run downloads the tool, later runs start from a cache. For the fastest start, install it
once with `npm install -g markdown-pdf-export` and use `markdown-pdf-export` instead of
`npx -y markdown-pdf-export`.

## Still stuck?

[Open an issue on GitHub](https://github.com/matinfo-tech/markdown-pdf-export/issues) and paste what
`doctor` prints.
