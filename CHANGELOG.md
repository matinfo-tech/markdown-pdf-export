# Changelog

All notable changes to `markdown-pdf-export`. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/matinfo-tech/markdown-pdf-export/compare/npm-v2.1.1...HEAD
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
