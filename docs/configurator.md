---
title: Configurator
description: Design your PDF header, footer and page layout once, save it to one settings file, and every editor, MCP client and the CLI use it.
aside: false
outline: false
pageClass: configurator-page
---

# Configurator

**Design once → save to one file → every editor uses it.**

Your PDF look lives in a single settings file. Every editor task (VS Code, Zed, Cursor…), every MCP
client (Claude Code, Claude Desktop, VS Code, Zed, Cursor) and the command line read it
automatically — the editor entries themselves never change and need no `env`:

| OS | Central settings file |
|----|-----------------------|
| macOS / Linux | `~/.config/markdown-pdf-export/settings.json` (`$XDG_CONFIG_HOME` if set) |
| Windows | `%APPDATA%\markdown-pdf-export\settings.json` |

A project can still override it with a `.markdown-pdf.json` in the repository (the nearest one above
the Markdown file, merged over the central file). See [Global Settings](/guide/global-settings).

Pick a starter template, adjust it, then copy or download the result. Everything runs in your
browser; nothing is sent anywhere.

<ClientOnly>
  <Configurator />
</ClientOnly>

Prefer the terminal? `npx -y markdown-pdf-export init` writes the same templates, and
`npx -y markdown-pdf-export setup` prints the editor entries.
