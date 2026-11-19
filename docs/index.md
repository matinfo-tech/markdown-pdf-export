---
layout: home

hero:
  name: Markdown PDF
  text: Editor, AI assistant or CLI
  tagline: Export Markdown to polished PDFs from Zed, VS Code or any editor task, from any MCP client, or from the command line — with structured headers, footers, and custom styling
  image:
    src: /logo.png
    alt: Markdown PDF Export
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Quick Start Templates
      link: /examples/quick-templates
    - theme: alt
      text: View on GitHub
      link: https://github.com/matinfo/markdown-pdf-export

features:
  - icon: ⌨️
    title: Task, Assistant or CLI
    details: One npm package, not tied to one editor — an editor task bound to a key (Zed, VS Code, JetBrains, Vim), any AI assistant that speaks MCP (Zed, Claude, Cursor), or the markdown-pdf-export command in a terminal or CI job. No extension to install.
  - icon: 📄
    title: Structured Headers & Footers
    details: Declarative configuration with zones (left, center, right) and typed elements — no raw HTML required.
  - icon: 🎨
    title: Custom Variables
    details: Use front matter fields as placeholders in headers and footers. Add company name, version, author, and more.
  - icon: 📅
    title: Date Formatting
    details: Format dates with date-fns patterns. Support for ISO, US, EU, and custom formats.
  - icon: 🖼️
    title: Image Embedding
    details: Embed logos and images (SVG, PNG, JPG) directly in headers and footers as base64 data URIs.
  - icon: ⚡
    title: Zero Configuration
    details: Works out of the box with sensible defaults. No install step — npx fetches the package — and it uses your installed Chrome or Edge.
  - icon: 🔧
    title: Per-Document Overrides
    details: Override any setting via YAML front matter. Perfect for different document types in the same project.
---

## Quick Example

Add a structured header and footer to your Markdown document:

```yaml
---
title: Project Report
author: Jane Smith
company: Acme Corp
pdf:
  header:
    height: 15mm
    left_text: "{company}"
    center_text: "{title}"
    right_text: "{date:MMMM d, yyyy}"
  footer:
    height: 10mm
    center_text: "Page {page} of {pages}"
---
```

Then export it — run the Zed task, ask Zed's AI assistant, or use the command line:

```sh
npx -y markdown-pdf-export report.md
```

> Export this file to PDF

That's it! The PDF will have a professional header with your company name, document title, and formatted date.

## Next Steps

- [Getting Started](/guide/getting-started) — What it is and the three ways to use it
- [Zed Task](/guide/zed-task) · [AI Assistant (MCP)](/guide/mcp) · [Command Line](/guide/cli) — Set up the one you want
- [Quick Start Templates](/examples/quick-templates) — Copy-paste ready configurations
- [Header & Footer Guide](/guide/header-footer) — Learn the structured configuration
- [Reference](/reference/settings) — Complete settings documentation