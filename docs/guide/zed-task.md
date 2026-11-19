# Zed Task

A Zed task runs the exporter on the file you have open. It needs no extension and no AI assistant:
you trigger it from the command palette or with a key.

## Add the Task

Add this to `~/.config/zed/tasks.json` to have it in every project, or to `.zed/tasks.json` in a
project folder to have it only there:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

`$ZED_FILE` is the path of the file in the active editor. `npx -y` downloads the package on first use
and runs it from npm's cache afterwards (see [Installation](/guide/installation)).

## Run It

1. Open a Markdown file
2. Open the command palette and run **task: spawn**
3. Choose *Markdown: Export to PDF*

### Key Binding

Add this to `keymap.json`:

```json
[
  {
    "context": "Workspace",
    "bindings": {
      "cmd-alt-e": ["task::Spawn", { "task_name": "Markdown: Export to PDF" }]
    }
  }
]
```

`task_name` must match the task's `label`.

## Where the PDF Goes

By default the PDF is written next to the Markdown file, with the same name and a `.pdf` extension.
To change that:

- set `output_directory` in your [settings file](/guide/global-settings) (relative to the Markdown
  file), or
- pass an explicit path with `-o` in `args`.

Missing output folders are created.

## Fixed Options

Everything after the package name in `args` is passed to the [command line](/guide/cli), so any flag
can be made permanent for a task:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE", "--math", "--toc"],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

## Several Presets

Define one task per preset and pick the one you need from **task: spawn**:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "reveal": "no_focus",
    "hide": "on_success"
  },
  {
    "label": "Markdown: Export to PDF (Letter, landscape)",
    "command": "npx",
    "args": [
      "-y", "markdown-pdf-export", "$ZED_FILE",
      "--page-format", "Letter",
      "--orientation", "landscape"
    ],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

## Settings File

For defaults that are longer than a few flags (headers, footers, margins), keep a
[settings file](/guide/global-settings) and load it through `env`. Use an absolute path:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "env": { "MARKDOWN_PDF_SETTINGS": "/Users/me/.config/markdown-pdf/settings.json" },
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

Flags in `args` override the settings file, and a `pdf:` block in the document's
[front matter](/guide/front-matter) overrides both.

## Global Install Variant

If you installed the package with `npm install -g markdown-pdf-export`, call the command directly:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "markdown-pdf-export",
    "args": ["$ZED_FILE"],
    "reveal": "no_focus",
    "hide": "on_success"
  }
]
```

This starts faster and works offline. The version changes only when you run
`npm update -g markdown-pdf-export`.

## Terminal Behaviour: `reveal` and `hide`

The task runs in a terminal tab. Two task fields control what you see:

| Field | Values | In the examples |
|-------|--------|-----------------|
| `reveal` | `always`, `no_focus`, `never` | `no_focus` — the terminal is shown but your editor keeps focus |
| `hide` | `never`, `always`, `on_success` | `on_success` — the terminal closes when the export succeeds |

On success the command prints the path of the PDF and exits with code `0`, so the terminal tab closes.

## When It Fails

With `"hide": "on_success"`, the terminal tab stays open when the export fails and shows the error
message. The exit code tells you the kind of failure:

| Exit code | Meaning |
|-----------|---------|
| `0` | Success |
| `1` | Export error (file not found, no browser, rendering failure, …) |
| `2` | Usage error (unknown flag, invalid value) |

If the message is `No usable Chrome/Chromium browser found.`, see [Browser](/guide/browser).

## A Note on Extensions

Zed is adding tasks to its extension API. Once that is available, a small extension may provide this
task automatically, so you would not have to edit `tasks.json`. Until then, the snippet above is the
whole setup.

## Next Steps

- [Command Line](/guide/cli) — every flag you can put in `args`
- [Global Settings](/guide/global-settings) — the settings file
- [AI Assistant (MCP)](/guide/mcp) — export by asking the assistant
