---
description: "Export Markdown to PDF from VS Code (Copilot), Copilot CLI, Zed, Cursor, Claude Code, Claude Desktop, JetBrains, Vim or the terminal."
title: Your editor
---

# Your editor

<p class="lead">Export the file you are writing with one keystroke, or ask your AI assistant. One-time setup, then nothing more.</p>

The easy way: open [Studio](/studio) and press **Add to my editor**. Or paste this in a terminal; it
finds your editors and asks, one by one, whether to set them up:

<CopyCommand command="npx -y markdown-pdf-export setup" />

In VS Code, install the [Markdown PDF Export extension](https://marketplace.visualstudio.com/items?itemName=matinfo-tech.markdown-pdf-export) instead: the PDF beside
your Markdown as you type, Studio in the editor, export and the Copilot tools, with no Node.js.

Or pick yours:

<PickTabs group="editor" tabs="vscode:VS Code,copilot-cli:Copilot CLI,claude-code:Claude Code,claude-desktop:Claude Desktop,cursor:Cursor,zed:Zed,other:JetBrains and Vim,terminal:Terminal">
<template #vscode>

**The extension (easiest).** Install **Markdown PDF Export** from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=matinfo-tech.markdown-pdf-export), or search for it in the Extensions view. Nothing else to install,
not even Node.js. It brings:

- **Open PDF Preview to the Side:** the real PDF next to your Markdown, drawn again as you type.
- **Design pages:** Studio inside the editor, on your document.
- **Export to PDF:** <kbd>Cmd</kbd>+<kbd>K</kbd> <kbd>Cmd</kbd>+<kbd>E</kbd> on a Mac,
  <kbd>Ctrl</kbd>+<kbd>K</kbd> <kbd>Ctrl</kbd>+<kbd>E</kbd> on Windows and Linux, or the button at the
  top right of a Markdown file.
- **Copilot tools:** in Copilot Chat agent mode, ask *Export this file to PDF*.

It is also on [Open VSX](https://open-vsx.org/extension/matinfo-tech/markdown-pdf-export). It uses the same settings file as everything on this page.

**Without the extension**

**1. Set up, once.** Press **Add to my editor** in Studio, or do it by hand:

*For the export command.* Run **Tasks: Open User Tasks** from the Command Palette and add:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Markdown: Export to PDF",
      "type": "process",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "${file}"],
      "problemMatcher": []
    }
  ]
}
```

*For Copilot Chat.* Run this once in a terminal:

```sh
code --add-mcp '{"name":"markdown-pdf","command":"npx","args":["-y","markdown-pdf-export","mcp"]}'
```

**2. Use it.**

- **Export:** open a Markdown file, then **Terminal → Run Task… → Markdown: Export to PDF**.
- **Ask:** in Copilot Chat agent mode, type *Export this file to PDF*.

</template>
<template #copilot-cli>

**1. Set up, once.** Press **Add to my editor** in Studio, or run this in a terminal. GitHub Copilot in the
terminal has its own list of tools, separate from VS Code's.

```sh
copilot mcp add markdown-pdf -- npx -y markdown-pdf-export mcp
```

**2. Use it.** Start `copilot` and type *Export report.md to PDF*.

</template>
<template #claude-code>

**1. Set up, once.** Press **Add to my editor** in Studio, or run this in a terminal:

```sh
claude mcp add --scope user markdown-pdf -- npx -y markdown-pdf-export mcp
```

**2. Use it.** Start `claude` and type *Export report.md to PDF*.

</template>
<template #claude-desktop>

**1. Set up, once.** Press **Add to my editor** in Studio, or do it by hand: in Claude Desktop, open
**Settings → Developer → Edit Config**, add this to `claude_desktop_config.json`, then restart
Claude Desktop:

```json
{
  "mcpServers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

**2. Use it.** Type *Export ~/Documents/report.md to PDF*. Give the full path of the file.

</template>
<template #cursor>

**1. Set up, once.** Press **Add to my editor** in Studio, or do it by hand:

*For the chat.* Add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

*For the export command (optional).* Use the VS Code task: Cursor reads the same `tasks.json`.

**2. Use it.**

- **Ask:** in the chat, type *Export this file to PDF*.
- **Export:** with the task added, **Terminal → Run Task… → Markdown: Export to PDF**.

</template>
<template #zed>

**1. Set up, once.** Press **Add to my editor** in Studio, or run
`npx -y markdown-pdf-export setup zed`. It adds three things to the files in `~/.config/zed/`
(`%APPDATA%\Zed\` on Windows) and leaves everything else in them as it was, comments included. A
copy of each changed file is kept as `<file>.markdown-pdf.bak`.

| What | File | Gives you |
|---|---|---|
| Export task | `tasks.json` | **task: spawn → Markdown: Export to PDF** |
| Keyboard shortcut | `keymap.json` | **⌘K ⌘E** on a Mac, **Ctrl+K Ctrl+E** on Windows and Linux, in Markdown files |
| AI tools | `settings.json` | the tools in the Agent panel (skipped when the *Markdown PDF Export* extension is installed: it provides them) |

<details>
<summary>Or add them by hand</summary>

`tasks.json`:

```json
[
  {
    "label": "Markdown: Export to PDF",
    "command": "npx",
    "args": ["-y", "markdown-pdf-export", "$ZED_FILE"],
    "use_new_terminal": false,
    "reveal": "never"
  }
]
```

`keymap.json` (use `ctrl-k ctrl-e` on Windows and Linux):

```json
[
  {
    "context": "Editor && extension == md",
    "bindings": {
      "cmd-k cmd-e": ["task::Spawn", { "task_name": "Markdown: Export to PDF" }]
    }
  }
]
```

`settings.json`:

```json
{
  "context_servers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

</details>

**2. Use it.**

- **Export:** in a Markdown file, press **⌘K ⌘E** (**Ctrl+K Ctrl+E**), or **task: spawn → Markdown: Export to PDF**.
- **Ask:** in the Agent panel, type *Export this file to PDF*. The Agent can also *open Studio* to
  design your pages, and *install the PDF browser* if Chrome and Edge are missing.

<details>
<summary>Zed tips</summary>

**Another key.** Change `cmd-k cmd-e` in `keymap.json`. The `context` line limits it to Markdown
files, so the key keeps its usual job elsewhere. Avoid ⌘⇧O / Ctrl+Shift+O: in Zed it opens the
outline of the file. To check a key is free, open the keymap editor (⌘K ⌘S) and search for it.

**Export again.** **task: rerun** repeats the last export without picking it from the list.

**One project only.** Put the task in `.zed/tasks.json` inside the project instead of `~/.config/zed/tasks.json`.

</details>

</template>
<template #other>

**JetBrains** (IntelliJ, WebStorm, PyCharm…). **1. Set up, once:** **Settings → Tools → External Tools → +**

| Field | Value |
|---|---|
| Program | `npx` |
| Arguments | `-y markdown-pdf-export $FilePath$` |

**2. Use it:** **Tools → External Tools** exports the open file. You can give it a key in **Keymap**.

**Vim and Neovim.** Nothing to set up. Run:

```vim
:!npx -y markdown-pdf-export %:S
```

</template>
<template #terminal>

<CopyCommand command="npx -y markdown-pdf-export report.md" />

The PDF appears next to the file. To export again each time you save:

<CopyCommand command="npx -y markdown-pdf-export report.md --watch" />

</template>
</PickTabs>

All of these use the look you saved in [Studio](/studio). The PDF is written next to your Markdown
file, with the same name.

[Every command and option: Advanced](/advanced/cli){.more}
