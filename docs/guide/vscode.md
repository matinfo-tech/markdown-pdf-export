# VS Code

In VS Code you export the open Markdown file with a **task** — one entry in `tasks.json`, optionally
bound to a key. No extension is needed. You can also let the AI assistant export through
[MCP](#ai-assistant-mcp).

Requirements: Node.js 20 or newer and a Chromium-based browser (see [Installation](/guide/installation)).

## Add the Task

VS Code runs tasks only when a folder is open; they are not available when you edit a single loose
file.

- **For every project:** run **Tasks: Open User Tasks** from the Command Palette and add the task
  there.
- **For one project:** create `.vscode/tasks.json` in the project folder.

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Markdown: Export to PDF",
      "type": "shell",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "${file}"],
      "presentation": { "reveal": "silent" },
      "problemMatcher": []
    }
  ]
}
```

`${file}` is the file in the active editor. Keep it as its own item in `args`: VS Code quotes
arguments that contain spaces.

## Run It

1. Open a Markdown file
2. Run **Tasks: Run Task** from the Command Palette, or **Terminal → Run Task…**
3. Choose **Markdown: Export to PDF**

The PDF is written next to the Markdown file.

### Key Binding

Open the Keyboard Shortcuts editor (**Preferences: Open Keyboard Shortcuts**), switch to the JSON file
with the **Open Keyboard Shortcuts (JSON)** button, and add:

```json
[
  {
    "key": "ctrl+alt+e",
    "command": "workbench.action.tasks.runTask",
    "args": "Markdown: Export to PDF",
    "when": "editorLangId == markdown"
  }
]
```

`args` is the task's `label`. The `when` clause keeps the key free in other file types. On macOS use
`cmd+alt+e` if you prefer.

### Or Use the Build Shortcut

Mark the task as the default build task and it runs with **Run Build Task**
(`Ctrl+Shift+B`, `Cmd+Shift+B` on macOS) — no custom key binding needed. Do this in a project's
`.vscode/tasks.json` for documentation projects that have no other build:

```json
{
  "label": "Markdown: Export to PDF",
  "type": "shell",
  "command": "npx",
  "args": ["-y", "markdown-pdf-export", "${file}"],
  "group": { "kind": "build", "isDefault": true },
  "presentation": { "reveal": "silent" },
  "problemMatcher": []
}
```

## Where the PDF Goes

Next to the Markdown file, with the same name. To change that:

- one export: add `"-o", "${fileDirname}/out/${fileBasenameNoExtension}.pdf"` to `args`
- every export: set `output_directory` in your [settings file](/guide/global-settings)

## Fixed Options

Add any [command-line flag](/guide/cli#options) to `args`:

```json
"args": ["-y", "markdown-pdf-export", "${file}", "--math", "--toc", "--page-format", "Letter"]
```

## Several Presets

Define one task per preset; each gets its own entry in **Run Task**:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Markdown: Export to PDF",
      "type": "shell",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "${file}"],
      "presentation": { "reveal": "silent" },
      "problemMatcher": []
    },
    {
      "label": "Markdown: Export to PDF (Letter, landscape)",
      "type": "shell",
      "command": "npx",
      "args": [
        "-y", "markdown-pdf-export", "${file}",
        "--page-format", "Letter",
        "--orientation", "landscape"
      ],
      "presentation": { "reveal": "silent" },
      "problemMatcher": []
    }
  ]
}
```

## Settings File

Keep your defaults in a [settings file](/guide/global-settings) and point the task at it with
`options.env`. `${userHome}` expands to your home folder:

```json
{
  "label": "Markdown: Export to PDF",
  "type": "shell",
  "command": "npx",
  "args": ["-y", "markdown-pdf-export", "${file}"],
  "options": {
    "env": { "MARKDOWN_PDF_SETTINGS": "${userHome}/.config/markdown-pdf/settings.json" }
  },
  "presentation": { "reveal": "silent" },
  "problemMatcher": []
}
```

The same `env` object takes `MARKDOWN_PDF_BROWSER` (see [Browser](/guide/browser)) and
`MARKDOWN_PDF_DEBUG`.

## Global Install Variant

`npx` downloads the package on first use and then runs it from npm's cache. If you prefer a fixed,
offline-capable install:

```sh
npm install -g markdown-pdf-export
```

Then call the command directly:

```json
"command": "markdown-pdf-export",
"args": ["${file}"]
```

## Terminal Behaviour

`presentation.reveal` controls the terminal panel:

| Value | Behaviour |
|---|---|
| `"always"` | Always show the terminal (VS Code's default) |
| `"silent"` | Stay in the background; the panel comes forward when the export fails |
| `"never"` | Never bring the terminal forward |

Other useful `presentation` options: `"panel": "dedicated"` keeps a terminal for this task only, and
`"clear": true` clears it before each run.

## When It Fails

The command prints the reason in the task terminal and exits with a non-zero code:

| Exit code | Meaning |
|---|---|
| `0` | PDF written; its path is printed |
| `1` | Export failed — file not found, no browser, invalid settings |
| `2` | Wrong usage — unknown flag, missing file argument |

The most common first-run message is `No usable Chrome/Chromium browser found.` — see
[Browser](/guide/browser).

## AI Assistant (MCP)

The package also contains an MCP server, so the chat assistant in VS Code can export for you
("Export this file to PDF in landscape").

1. Run **MCP: Add Server** from the Command Palette
2. Choose a local command (stdio) server
3. Enter the command `npx -y markdown-pdf-export mcp` and name it `markdown-pdf`

Or add it to the MCP configuration file yourself. Current VS Code releases read
`~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "markdown-pdf": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

::: tip Older configuration format
VS Code's MCP configuration has changed between releases. Versions that still use `.vscode/mcp.json`
(or the profile `mcp.json`) expect the same entry under a top-level `servers` key instead of
`mcpServers`. That format is deprecated; **MCP: Add Server** writes the right file for your version.
:::

VS Code asks you to trust the server the first time it starts. After that, ask in chat:

```
Export this file to PDF
```

To load a settings file, add `"env": { "MARKDOWN_PDF_SETTINGS": "/absolute/path/settings.json" }` to
the entry. Tools, prompts and troubleshooting are described in [AI Assistant (MCP)](/guide/mcp).

## Next Steps

- [First Export](/guide/first-export)
- [Command Line](/guide/cli) — every flag you can put in `args`
- [Global Settings](/guide/global-settings) — defaults for all exports
- [Header & Footer](/guide/header-footer)
