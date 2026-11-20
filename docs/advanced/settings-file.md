# Settings file

For people who want to edit their settings by hand, keep different settings per project, or understand which setting wins.

A settings file is a small JSON file. This one is complete:

```json
{
  "$schema": "https://markdown-pdf.matinfo.tech/schema/settings.schema.json",
  "look": "report",
  "font": "serif",
  "template": "simple"
}
```

Studio and `init` write this file for you, and `init --from` installs one you downloaded. Every export reads it: the command line, editor tasks and
the AI assistant tools.

## Where it lives

| System | Path |
|---|---|
| macOS, Linux | `~/.config/markdown-pdf-export/settings.json` (or `$XDG_CONFIG_HOME/markdown-pdf-export/settings.json` when `XDG_CONFIG_HOME` is set) |
| Windows | `%APPDATA%\markdown-pdf-export\settings.json` |

The file is optional. Without it, the built-in defaults are used (A4, 15 mm margins, no header or
footer).

To use another file instead, set `MARKDOWN_PDF_SETTINGS` to a file path or to inline JSON. The user
file is then not read at all:

```sh
MARKDOWN_PDF_SETTINGS=~/work/pdf-settings.json npx -y markdown-pdf-export report.md
```

## Create it with init

```sh
npx -y markdown-pdf-export init
```

In a terminal, `init` asks for a page style, a font, a header and footer, the paper size and an
optional logo. With flags it asks nothing:

```sh
npx -y markdown-pdf-export init --look report --font serif --template simple
npx -y markdown-pdf-export init --template corporate --project
```

| Flag | Effect |
|---|---|
| `--look <name>` | Page style preset (see below). |
| `--font <name>` | Font preset (see below). |
| `--template <name>` | Header and footer preset. Default: `minimal`. |
| `--project` | Write `.markdown-pdf.json` in the current folder instead of the user file. |
| `--force` | Overwrite an existing file. Without it, `init` refuses. |
| `--list` | Print the template names and stop. |

With `--look` or `--font`, `init` writes the short form shown at the top of this page. With
`--template` alone, it copies the whole template so you can edit every line.

### Install a file you already have

If you designed your settings in [Design online](/online), or got a settings file from a colleague,
`init --from` checks it and puts it where the tool looks for it:

```sh
npx -y markdown-pdf-export init --from ~/Downloads/settings.json
npx -y markdown-pdf-export init --from ~/Downloads/settings.json --project
```

| Behaviour | Detail |
|---|---|
| Destination | The user file, or `.markdown-pdf.json` in the current folder with `--project`. |
| Check | The file must be a JSON object. Invalid JSON stops with an error and writes nothing. An unknown preset name (such as `"look": "fancy"`) prints a warning; the file is still installed. |
| Content | Copied as written (nothing is rewritten). A byte order mark is removed. |
| Existing file | Refused unless you add `--force`. With `--force`, the old file is kept next to it as `settings.json.bak`. |
| Logo | Image paths are relative to the destination file. If a logo the file mentions does not exist, `init` prints where to put it, for example `…/markdown-pdf-export/assets/logo.png`. |

`--from` cannot be combined with `--look`, `--font` or `--template`.

## Project settings

Put a `.markdown-pdf.json` file in a project folder to change settings for the documents inside it.
It uses the same keys as the user file.

```json
{
  "template": "corporate",
  "page_format": "Letter"
}
```

For each document, the tool looks for the nearest `.markdown-pdf.json` in the document's folder,
then in each parent folder. Only the nearest one is used. It is combined with the user file key by
key: keys you set replace the same keys from the user file, and nested objects such as `margin` or
`header` are merged. To remove something the user file sets, such as its header, write
`"header": null`.

To edit a project file in Studio, run `npx -y markdown-pdf-export studio --project` in that folder.

## Which setting wins

From lowest to highest priority:

1. Built-in defaults.
2. The user file, or `MARKDOWN_PDF_SETTINGS`, or `--settings` on the command line (each replaces the
   user file).
3. The nearest project file `.markdown-pdf.json`.
4. Options for one export: command-line flags such as `--orientation landscape`, or the arguments an
   AI assistant passes to the export tool.
5. The `pdf:` block in the document's front matter. See [Per document](/advanced/per-document).

## Short presets

Four keys set many things at once. Write the keys you want to change next to them: keys written in
the same file always win over a preset.

### look: the page style

| Value | Description |
|---|---|
| `clean` | Default. GitHub-style, neutral. |
| `report` | Serif headings, strong title rule. Business reports. |
| `academic` | Serif body, justified, minimal colour, 25 mm margins. Papers and theses. |
| `compact` | Dense and small, 10 mm margins. More text per page. |
| `technical` | Framed code blocks, blue accents. Documents with code. |

A look sets `stylesheet_path`, and some looks also set `highlight_style` and `margin`. See
[Styling](/advanced/styling).

### font and heading_font: the fonts

`font` sets the text font, `heading_font` the titles (h1 to h6). Both take the same values:

| Value | Uses the first one installed of |
|---|---|
| `sans` | system UI font, Segoe UI, Helvetica, Arial |
| `serif` | Georgia, Times New Roman, Times |
| `book` | Iowan Old Style, Palatino, Book Antiqua, Georgia |
| `humanist` | Seravek, Gill Sans, Ubuntu, Calibri, DejaVu Sans |
| `geometric` | Avenir, Montserrat, Corbel, Century Gothic |
| `mono` | SF Mono, Menlo, Consolas |
| `system` | the system UI font |

For any other font, use `font_family` and `heading_font_family` with a CSS font list.

### template: the header and footer

Values: `minimal`, `simple`, `corporate`, `academic`, `two-logo`. Each one is shown with a drawing
in [Recipes](/advanced/recipes). When `template` and `look` both set the margins, the template wins.

## Paths inside a settings file

Relative paths in a settings file (`stylesheet_path`, `assets_directory`, header and footer images)
are relative to the folder of that settings file. A logo next to your user file can be written as
`"logo.svg"`. Paths starting with `~/` start from your home folder.

To share images, set `assets_directory` once, then write `@/` before an image name, for example
`"@/logo.svg"`. This also works in a document's front matter. See
[The assets folder](/advanced/header-footer#the-assets-folder).

## Autocomplete

Keep the `$schema` line at the top. VS Code, Zed and other editors with a JSON language server then
complete the keys, list the allowed values and underline mistakes.

All keys are listed in [All settings](/reference/settings).

## Check what is used

```sh
npx -y markdown-pdf-export doctor docs/report.md
```

`doctor` lists the settings files it loaded, any JSON error in them, and the browser it found. With a
Markdown file, it includes the project file for that document. `--json` prints the effective
settings. An unknown preset name (for example `"look": "fancy"`) prints a warning and is ignored.
