# Changelog

All notable changes to `markdown-pdf-export`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `--json` on export: prints the result as JSON (PDF path, settings files used, raw HTML removed,
  diagrams left as code) instead of the PDF path, for scripts and editors.
- `studio --embedded`, for an editor extension that shows Studio in its own panel. A preview
  request can then name the document to draw and carry its unsaved text; the page draws again on
  a `studio:refresh` event and hands each PDF to `window.studioHost.showPdf` when the panel
  provides one. See [Studio inside an editor](https://markdown-pdf.matinfo.tech/advanced/cli#studio-inside-an-editor).
- Every Studio preview answer has an `X-Preview-Report` header with the raw HTML removed and the
  diagrams left as code.

### Changed

- Studio's page script imports its model with a relative path, so the page can be bundled.

## [2.6.0] - 2026-11-22

### Security

- Windows: opening the PDF (`open_after_export`) no longer goes through `cmd /C start`. A file
  name with `&` (for example `a&calc&.md`) could start another program. Files now open through
  `explorer.exe`, which does not read the name as commands. Studio's link still opens as before.

### Added

- `--no-project-settings`: ignore `.markdown-pdf.json` files, for documents you do not trust (a
  project file can set `"sanitize": "none"`, a stylesheet or an output folder). Works with export,
  `--watch`, `doctor` and `studio --file`. Command line only, like `--sanitize`.

### Changed

- Editor setup (`setup` and Studio's *Add to my editor*) run from inside an Electron app used as
  Node, such as an upcoming VS Code extension, now writes the `npx -y markdown-pdf-export` command
  instead of that app's internal binary, which other editors cannot run.

### Fixed

- `open_after_export` no longer crashes the command line when the system has no opener (no
  `xdg-open` on a server); the PDF was already written.
- Opening the PDF or Studio no longer passes `ELECTRON_RUN_AS_NODE` to the opened app.

## [2.5.0] - 2026-11-22

### Added

- Mermaid diagrams: a ` ```mermaid ` code block is drawn as a diagram (flowchart, sequence,
  Gantt, class, state, pie and the rest). On by default, works offline; set `"mermaid": false`
  or `--no-mermaid` to print the code instead. Diagrams are drawn in a separate page before
  printing, so the document page still runs no JavaScript. A diagram with a mistake stays a
  code block and is listed in the new `diagram_errors` result field.
- Task lists (`- [x]`), footnotes (`[^1]`) and GitHub alerts (`> [!NOTE]`, `[!TIP]`,
  `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) now render instead of printing as plain text.
  Always on, no setting.

### Changed

- Headings get an id by default, so `[text](#heading)` links work in the PDF without any setting.
  Set `"heading_anchors": false` (or `--no-heading-anchors`) to turn it off. A custom stylesheet
  with `#slug` selectors may now match headings.

## [2.4.0] - 2026-11-22

### Security

- Raw HTML in the Markdown can no longer run code or load other pages while the PDF is printed.
  By default (`"sanitize": "safe"`) `<script>`, `<iframe>`, `<object>`, `<applet>`, `<frameset>`,
  `<noembed>` and `<noframes>` are removed with their content; `<embed>`, `<frame>`, `<meta>`,
  `<base>`, `<link>`, `<form>`, `<title>`, `<textarea>`, `<xmp>` and `<plaintext>` are shown as
  text; `on*` event handlers and `javascript:` / `vbscript:` / non-image `data:` links are
  disarmed. The page is also printed with JavaScript off, under a Content Security Policy that
  blocks scripts, frames and plugins, and an export that tries to navigate away is stopped.
  `<style>`, inline styles, images and page breaks keep working; code blocks are never changed.
- `font_family`, `heading_font_family` and the custom stylesheet can no longer close the
  `<style>` element they are placed in.

### Changed

- **Behaviour change:** documents that relied on raw `<script>` or `<iframe>` lose them. Set
  `"sanitize": "none"` in a settings file, or pass `--sanitize none`, for documents you trust.
  Front matter and the MCP tool cannot change this setting.
- The export result has `sanitize` and `removed_html` (what the filter took out); the command
  line prints the latter. `doctor` shows the `sanitize` setting.

## [2.3.1] - 2026-11-22

### Fixed

- The temporary render HTML is written to the system temp folder, no longer next to the
  Markdown file, so it never shows up in the project (or in the editor's file watcher) and a
  crash cannot leave it behind there. If the browser cannot read the temp folder, the export
  falls back to the old location once and still cleans up after itself.
- Temp render files that earlier versions left behind next to the Markdown file are removed
  on the next export of that file (only exact `.{uuid}.temp_render.html` names older than an hour).

### Changed

- A settings file path (`MARKDOWN_PDF_SETTINGS`, `--settings`) may start with `~` or `$HOME`.

## [2.3.0] - 2026-11-22

### Added

- Zed: `setup` (and **Add to my editor** in Studio) adds a keyboard shortcut for the export task,
  ⌘K ⌘E on a Mac and Ctrl+K Ctrl+E on Windows and Linux, in Markdown files only. `doctor` reports it.
- `setup` now adds its entry to a file that already exists (Zed `tasks.json`, `keymap.json` and
  `settings.json`, VS Code and Cursor `tasks.json`, Cursor `mcp.json`, Claude Desktop config)
  instead of asking you to paste it. Only the new entry is added: comments, trailing commas and
  your formatting stay as they were, and a copy of the file is kept as `<file>.markdown-pdf.bak`.
  A file that cannot be read is left alone and you get the snippet to paste.

### Changed

- Zed: when the *Markdown PDF Export* extension is installed, `setup` and `doctor` count the AI
  tools as set up and no longer add a `context_servers` entry, which would replace the extension's.
- The documented Zed shortcut is no longer ⌘⇧O / Ctrl+Shift+O, which hid Zed's outline.
- Snippets are written the way config files usually are, with short lists on one line.

## [2.2.2] - 2026-11-22

### Fixed

- MCP Registry listing: the new description ("Markdown to PDF with your header, footer, page
  numbers and logo. Pages designed in Studio.") was meant for 2.2.1 but was not saved.

## [2.2.1] - 2026-11-22

### Changed

- MCP Registry listing: display title, website, icon, and the `MARKDOWN_PDF_DEBUG` variable.
  `MARKDOWN_PDF_SETTINGS` is described as a file path or JSON.
- Editors page, Zed: the Agent can also open Studio and install the PDF browser.

## [2.2.0] - 2026-11-21

### Added

- MCP tool `install_browser_markdown_pdf`: an assistant can download Chromium when no Chrome or Edge
  is found, without a terminal. Nothing is downloaded if a browser already works. A long download
  keeps running in the background and `doctor_markdown_pdf` tells when it is done.
- MCP tool `open_studio_markdown_pdf`: an assistant can open Studio, optionally with your own
  document as the preview or for one project folder only. Studio runs in its own process and stops
  by itself a few minutes after its page is closed.

### Changed

- The MCP server re-reads the settings file on every export and doctor call, so changes saved in
  Studio (or by hand) apply without restarting the server.
- When no browser is found, the MCP error and the doctor hint point the assistant to
  `install_browser_markdown_pdf` instead of an `npx` command.
- Release tags are now `v<version>` instead of `npm-v<version>`, so tools that look for a tag
  matching the published version find it. Earlier `npm-v*` tags stay in place.

## [2.1.1] - 2026-11-20

### Added

- `accent_color`: the theme colour of the `report` and `technical` looks (title rule, section titles,
  code and quote bars). Studio offers it as *Theme colour*, folded under the title font, only for
  those two page styles.
- `office` font preset: Aptos, then Calibri (the Microsoft Office fonts), for `font` and `heading_font`.
- The Studio sample document now has a short maths (LaTeX) section, so you can see formulas in your
  page style and fonts.

## [2.1.0] - 2026-11-20

### Added

- `setup` now asks, editor by editor, whether to set it up, and skips what is already set up. `--write`
  sets everything up without asking (for scripts) and the new `--print` only shows what to add. It also
  accepts the short names `claude`, `code` and `copilot`.
- `doctor` shows the version and, for each editor found, whether its export command and AI tools are set
  up, with the command that fixes a missing one. It warns when a task sets `MARKDOWN_PDF_SETTINGS`, which
  replaces your settings file. `doctor --json` includes `version` and `editors`.
- Studio's "Add to my editor" lists the editors found on this computer with one switch each, already on.
  Steps that are already done are skipped; the per-editor tabs stay under "All editors and manual steps".
- Coloured terminal output for `doctor` and `setup` (green for ready, red for broken, yellow for worth a
  look). It is off when the output is piped or `NO_COLOR` is set; `FORCE_COLOR` turns it on.
- Documentation: Zed keyboard shortcut tips, and `doctor` and `setup` in Get started.

### Fixed

- `setup --write` now creates a missing `tasks.json` for VS Code, Cursor and Zed instead of asking you to
  paste it. It still never changes an existing file.
- `setup vscode --write` finds the `code` command inside the VS Code app on macOS when it is not on the PATH.
- `setup claude-code` adds the server with `--scope user`, so it works in every folder, not only the one
  you ran it from.
- Cursor: `setup` offers the export command only when the Cursor app is installed. The Cursor Agent
  command-line tool on its own gets just the AI tools.

## [2.0.3] - 2026-11-20

### Changed

- The project moved to the GitHub organisation `matinfo-tech`:
  <https://github.com/matinfo-tech/markdown-pdf-export>. The documentation is now at
  <https://markdown-pdf.matinfo.tech/>, and the settings `$schema` URL changed with it.
- The MCP Registry name is now `io.github.matinfo-tech/markdown-pdf-export`.

## [2.0.2] - 2026-11-20

### Added

- Copilot CLI: `setup copilot-cli` and a tab in Studio's "Add to my editor", which now shows one tab per
  editor. The VS Code tab is labelled "VS Code (Copilot)".
- `init --from <file>` installs a settings file you already have, such as the one downloaded from
  Design online. It checks the file, refuses to overwrite without `--force` (and then keeps a `.bak`
  copy) and says where to put a missing logo. Design online now shows this command.
- More ways to start a new page: the classes `page-break`, `pagebreak`, `page_break`, `new-page`,
  `newpage` and `break-page` (besides `page`), and the comments `<!-- page-break -->`,
  `<!-- pagebreak -->`, `<!-- new-page -->` and `<!-- page -->`. They also work when the default
  stylesheet is off.

### Changed

- Release workflow waits until a new version is visible on npm before registering it in the MCP
  Registry.
- Docs site: Google Search Console verification.
- README and link previews: new banner image.
- The "Your editor" page explains each editor in order: set up once, then use.

## [2.0.1] - 2026-11-20

### Changed

- Clearer npm page: new description, more keywords, npm version and downloads badges, README
  images and links that also work on npmjs.com.
- Docs site: `sitemap.xml`, share image for link previews, and a title, description and canonical
  URL for each page.

## [2.0.0] - 2026-11-20

First release on npm. The Zed extension is gone: the tool is now one npm package with a CLI and an
MCP server, usable from any editor or AI assistant.

### Added

- **Studio** (`markdown-pdf-export studio`): a local page in your browser to pick the page style,
  fonts, paper, margins, code colours, header, footer and logo, with a live preview of the real
  PDF. Saves to your settings file, keeps a backup, and can add the tool to your editors.
- **Page styles**: Clean, Report, Academic, Compact and Technical.
- **Short presets** in settings files: `look`, `font`, `heading_font` and `template`.
- Separate fonts for text and titles (`font_family`, `heading_font_family`).
- **One settings file** found automatically by every editor, the MCP server and the CLI
  (`~/.config/markdown-pdf-export/settings.json`, `%APPDATA%\markdown-pdf-export\settings.json` on
  Windows), plus a per-project `.markdown-pdf.json`.
- JSON Schema for settings files, for autocomplete and validation in editors.
- Commands: `init` (create a settings file), `setup` (add the tool to VS Code, Zed, Cursor, Claude),
  `--watch` (export again on save), a guided menu when run without arguments, and a
  plain-language `doctor`.
- Header and footer options for the CLI and the MCP tools.
- Named date formats such as `{date:iso}` and `{date:us-long}`.
- New documentation site, with a "Design online" page that needs no install.
- Published to the MCP Registry as `io.github.matinfo/markdown-pdf-export`.

### Changed

- Fonts chosen in settings now win over the page style.
- Header and footer lines stop at the page margins, like the text.
- Dark code colour themes keep their own background, so code stays readable.
- `--settings` reads the same presets as a settings file.
- Requires Node.js 20 or newer.

### Fixed

- `install-browser` failed, and the Chromium it downloads was never used.
- Settings files saved with a UTF-8 byte order mark were rejected.
- `font_style` and `font_weight` on the header or footer were ignored.

## [0.2.0] - 2026-05-27

### Added

- Maths with KaTeX (`$inline$` and `$$display$$`), fonts bundled.
- Table of contents from a `[[toc]]` marker, and heading anchors.

## [0.1.4] - 2026-05-27

### Changed

- Smaller default margins (15 mm) and a grey background for code blocks.
- The header and footer centre zone sits at the true middle of the page.
- Long lines in code blocks wrap instead of being cut.

### Fixed

- Exports running at the same time could interfere with each other.

## [0.1.3] - 2026-04-12

### Fixed

- Header and footer settings were lost in some cases.
- The Zed extension showed the effective settings incorrectly.

## [0.1.2] - 2026-04-12

### Changed

- The front matter key is now `pdf:` (was `markdown-pdf:`).

### Fixed

- The server could crash at start-up.

## [0.1.1] - 2026-04-12

### Changed

- Release workflow fixes.

## [0.1.0] - 2026-04-12

### Added

- First release, as a Zed extension: Markdown to PDF with Chromium, syntax highlighting,
  structured headers and footers, placeholders and date formats.

[Unreleased]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.6.0...HEAD
[2.6.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.2.2...v2.3.0
[2.2.2]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.1.0...npm-v2.1.1
[2.1.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.0.3...npm-v2.1.0
[2.0.3]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.0.2...npm-v2.0.3
[2.0.2]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.0.1...npm-v2.0.2
[2.0.1]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.0.0...npm-v2.0.1
[2.0.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.2.0...npm-v2.0.0
[0.2.0]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/matinfo-tech/markdown-pdf-export/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/matinfo-tech/markdown-pdf-export/releases/tag/v0.1.0
