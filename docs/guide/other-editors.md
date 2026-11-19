# Other Editors & MCP Clients

`markdown-pdf-export` is not tied to one editor. It is a command-line tool and a standard MCP server
(stdio), so it works anywhere you can run a command on the current file or register an MCP server.

Zed is the editor this project is developed with, and has its own pages: [Zed Task](/guide/zed-task)
and [AI Assistant (MCP)](/guide/mcp). The snippets below follow each tool's documented configuration
format; the project has not tested every one of them. The exporter behind them is the same.

Requirements are the same everywhere: Node.js 20 or newer and a Chromium-based browser
(see [Browser](/guide/browser)).

## Run It on the Current File

Any editor that can run a shell command with the current file path can export with one key press.

### VS Code

Add a task to `.vscode/tasks.json` (or to your user tasks):

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

Run it with **Tasks: Run Task**.

### JetBrains IDEs

**Settings → Tools → External Tools → +**

| Field | Value |
|---|---|
| Program | `npx` |
| Arguments | `-y markdown-pdf-export $FilePath$` |
| Working directory | `$FileDir$` |

### Vim and Neovim

```vim
:!npx -y markdown-pdf-export %:S
```

### Terminal, Scripts and CI

See [Command Line](/guide/cli) for every option, exit codes and scripting examples.

```sh
npx -y markdown-pdf-export README.md
```

## Use It from an AI Assistant (MCP)

The MCP server is started with:

```sh
npx -y markdown-pdf-export mcp
```

It speaks MCP over stdio and exposes two tools, `export_markdown_pdf` and `doctor_markdown_pdf`. In
clients that browse the official MCP Registry, look for `io.github.matinfo/markdown-pdf-export`.

### Claude Code

```sh
claude mcp add markdown-pdf -- npx -y markdown-pdf-export mcp
```

### Claude Desktop and Cursor

Both use the same `mcpServers` shape — in `claude_desktop_config.json` for Claude Desktop, in
`~/.cursor/mcp.json` or `.cursor/mcp.json` for Cursor:

```json
{
  "mcpServers": {
    "markdown-pdf": {
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

### VS Code

In `.vscode/mcp.json`:

```json
{
  "servers": {
    "markdown-pdf": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "markdown-pdf-export", "mcp"]
    }
  }
}
```

### Any Other MCP Client

Register a stdio server with command `npx` and arguments `-y markdown-pdf-export mcp`.

## Settings and Paths

- **Settings** work the same in every client: set the `MARKDOWN_PDF_SETTINGS` environment variable to
  the absolute path of a settings file (see [Global Settings](/guide/global-settings)). Most clients
  accept an `env` object next to `command` and `args`.
- **Paths:** a relative `input_path` is resolved against the folder the client starts the server in,
  which is not always your project. If an export reports that the file was not found, ask the
  assistant to use the absolute path.
- **Browser:** to choose the browser, set `MARKDOWN_PDF_BROWSER` in the same `env` object
  (see [Browser](/guide/browser)).

## Next Steps

- [Command Line](/guide/cli) — every option
- [Global Settings](/guide/global-settings) — defaults for all exports
- [First Export](/guide/first-export)
