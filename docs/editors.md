---
title: Your editor
---

# Your editor

<p class="lead">Export the file you are writing with one keystroke, or ask your AI assistant. One-time setup, then nothing more.</p>

The easy way: open [Studio](/studio) and press **Add to my editor**. Or paste this in a terminal; it
finds your editors and shows what to add:

<CopyCommand command="npx -y markdown-pdf-export setup" />

Or pick yours:

<PickTabs group="editor" tabs="vscode:VS Code,zed:Zed,cursor:Cursor,claude-code:Claude Code,claude-desktop:Claude Desktop,other:JetBrains and Vim,terminal:Terminal">
<template #vscode>

- **Export:** open a Markdown file, then **Terminal → Run Task… → Markdown: Export to PDF**.
- **Ask:** in Copilot Chat agent mode, type *Export this file to PDF*.

<details>
<summary>Do it by hand</summary>

Run **Tasks: Open User Tasks** from the Command Palette and add:

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

For the AI assistant, run this once in a terminal:

```sh
code --add-mcp '{"name":"markdown-pdf","command":"npx","args":["-y","markdown-pdf-export","mcp"]}'
```

</details>
</template>
<template #zed>

- **Export:** open a Markdown file, then **task: spawn → Markdown: Export to PDF**.
- **Ask:** in the Agent panel, type *Export this file to PDF*.

<details>
<summary>Do it by hand</summary>

Add to `~/.config/zed/tasks.json`:

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

For the AI assistant, add to Zed's `settings.json`:

```json
{
  "context_servers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

A key for the task, in `keymap.json`:

```json
[{ "context": "Workspace", "bindings": { "cmd-alt-e": ["task::Spawn", { "task_name": "Markdown: Export to PDF" }] } }]
```

</details>
</template>
<template #cursor>

**Ask:** in the chat, type *Export this file to PDF*.

<details>
<summary>Do it by hand</summary>

Add to `~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

```json
{
  "mcpServers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

For a task, use the VS Code one: Cursor reads the same `tasks.json`.

</details>
</template>
<template #claude-code>

**Ask:** *Export report.md to PDF*.

<details>
<summary>Do it by hand</summary>

Run once in a terminal:

```sh
claude mcp add markdown-pdf -- npx -y markdown-pdf-export mcp
```

</details>
</template>
<template #claude-desktop>

**Ask:** *Export ~/Documents/report.md to PDF*. Give the full path of the file.

<details>
<summary>Do it by hand</summary>

In Claude Desktop, open **Settings → Developer → Edit Config** and add to
`claude_desktop_config.json`, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "markdown-pdf": { "command": "npx", "args": ["-y", "markdown-pdf-export", "mcp"] }
  }
}
```

</details>
</template>
<template #other>

**JetBrains** (IntelliJ, WebStorm, PyCharm…): **Settings → Tools → External Tools → +**

| Field | Value |
|---|---|
| Program | `npx` |
| Arguments | `-y markdown-pdf-export $FilePath$` |

Then **Tools → External Tools** exports the open file. You can give it a key in **Keymap**.

**Vim and Neovim:**

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
