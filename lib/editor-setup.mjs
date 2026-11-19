/**
 * @fileoverview Editor wiring: builds the exact task + MCP snippets (and target
 * files) for Zed, VS Code, Cursor, Claude Code and Claude Desktop.
 *
 * Pure functions — no I/O except `fs.existsSync` for detection — so the
 * output is unit-testable with a fake home directory.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** npm package name (what npx runs). */
export const SERVER_NAME = "markdown-pdf-export";
/** Key of the MCP server entry and task label — match the docs. */
export const MCP_KEY = "markdown-pdf";
export const TASK_LABEL = "Markdown: Export to PDF";
export const EDITOR_IDS = ["zed", "vscode", "cursor", "claude-code", "claude-desktop"];

/**
 * Version managers install node under a version-specific directory; editors
 * should call the manager's stable shim instead so the entry survives a
 * Node upgrade. Returns `execPath` unchanged when no shim applies.
 * @param {string} execPath
 * @param {string} [home]
 * @param {(p: string) => boolean} [exists]
 */
export function stableNodePath(execPath, home = os.homedir(), exists = fs.existsSync) {
  const exe = process.platform === "win32" ? "node.exe" : "node";
  const shims = [
    [/[\\/]\.volta[\\/]tools[\\/]image[\\/]node[\\/]/, path.join(home, ".volta", "bin", exe)],
    [/[\\/]\.asdf[\\/]installs[\\/]nodejs[\\/]/, path.join(home, ".asdf", "shims", "node")],
    [/[\\/]mise[\\/]installs[\\/]node[\\/]/, path.join(home, ".local", "share", "mise", "shims", "node")],
  ];
  for (const [pattern, shim] of shims) {
    if (pattern.test(execPath) && exists(shim)) return shim;
  }
  return execPath;
}

/**
 * How to launch the tool. `npx -y` when we were started through npx,
 * otherwise an absolute `node <cli.mjs>` (immune to PATH problems with
 * GUI-launched editors), using a version-manager shim for node when available.
 * @param {string} [cliPath] absolute path of cli.mjs
 * @param {string} [execPath] node binary
 * @param {string} [home]
 */
export function launchSpec(cliPath, execPath = process.execPath, home = os.homedir()) {
  const viaNpx = typeof cliPath === "string" && /[\\/]_npx[\\/]/.test(cliPath);
  if (viaNpx || !cliPath) {
    return { command: "npx", args: ["-y", SERVER_NAME] };
  }
  return { command: stableNodePath(execPath, home), args: [path.resolve(cliPath)] };
}

/**
 * Quote argv for display / execution through the platform shell
 * (POSIX sh single quotes, cmd.exe double quotes).
 * @param {string[]} argv
 * @param {string} [platform]
 */
export function shellJoin(argv, platform = process.platform) {
  return argv
    .map((arg) => {
      if (/^[\w@%+=:,./\\-]+$/.test(arg)) return arg;
      return platform === "win32"
        ? `"${arg.replaceAll('"', '\\"')}"`
        : `'${arg.replaceAll("'", "'\\''")}'`;
    })
    .join(" ");
}

const json = (value) => JSON.stringify(value, null, 2);

/** Per-OS config roots. */
function roots({ home, platform, env }) {
  if (platform === "win32") {
    const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
    return { appData, userData: appData, zed: path.join(appData, "Zed") };
  }
  if (platform === "darwin") {
    const appSupport = path.join(home, "Library", "Application Support");
    return {
      appData: appSupport,
      userData: appSupport,
      zed: path.join(home, ".config", "zed"),
    };
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(home, ".config");
  return { appData: xdg, userData: xdg, zed: path.join(xdg, "zed") };
}

/**
 * @typedef {object} SetupItem
 * @property {"mcp"|"task"} kind
 * @property {string} label
 * @property {string|null} file       target file (null for CLI-only)
 * @property {string} snippet         text to show / write
 * @property {"create"|"print"|"command"} write   safe-write strategy
 * @property {{cmd: string, args: string[]}} [run] CLI to run for "command"
 */

/**
 * @param {string} editor one of EDITOR_IDS
 * @param {{command: string, args: string[]}} launch
 * @param {{home?: string, platform?: string, env?: NodeJS.ProcessEnv}} [ctx]
 * @returns {{id: string, name: string, detected: boolean, items: SetupItem[]}}
 */
export function buildEditorSetup(editor, launch, ctx = {}) {
  const home = ctx.home ?? os.homedir();
  const platform = ctx.platform ?? process.platform;
  const env = ctx.env ?? process.env;
  const r = roots({ home, platform, env });
  const server = { command: launch.command, args: [...launch.args, "mcp"] };
  const exportArgs = (fileVar) => [...launch.args, fileVar];
  const exists = (p) => fs.existsSync(p);

  switch (editor) {
    case "zed": {
      const dir = r.zed;
      return {
        id: "zed",
        name: "Zed",
        detected: exists(dir),
        items: [
          {
            kind: "task",
            label: "Zed task (add to tasks.json)",
            file: path.join(dir, "tasks.json"),
            write: "print",
            snippet: json([
              {
                label: TASK_LABEL,
                command: launch.command,
                args: exportArgs("$ZED_FILE"),
                use_new_terminal: false,
                reveal: "never",
              },
            ]),
          },
          {
            kind: "mcp",
            label: "Zed MCP server (merge into settings.json)",
            file: path.join(dir, "settings.json"),
            write: "print",
            snippet: json({ context_servers: { [MCP_KEY]: server } }),
          },
        ],
      };
    }

    case "vscode":
    case "cursor": {
      const isCursor = editor === "cursor";
      const userDir = path.join(r.userData, isCursor ? "Cursor" : "Code", "User");
      const mcpFile = path.join(home, ".cursor", "mcp.json");
      const addMcp = JSON.stringify({ name: MCP_KEY, ...server });
      /** @type {SetupItem[]} */
      const items = [
        {
          kind: "task",
          label: `${isCursor ? "Cursor" : "VS Code"} task (add to tasks.json)`,
          file: path.join(userDir, "tasks.json"),
          write: "print",
          snippet: json({
            version: "2.0.0",
            tasks: [
              {
                label: TASK_LABEL,
                type: "process",
                command: launch.command,
                args: exportArgs("${file}"),
                problemMatcher: [],
              },
            ],
          }),
        },
        isCursor
          ? {
              kind: "mcp",
              label: "Cursor MCP server",
              file: mcpFile,
              write: exists(mcpFile) ? "print" : "create",
              snippet: json({ mcpServers: { [MCP_KEY]: server } }),
            }
          : {
              // VS Code's own CLI writes the right file for the installed version.
              kind: "mcp",
              label: "VS Code MCP server",
              file: null,
              write: "command",
              run: { cmd: "code", args: ["--add-mcp", addMcp] },
              snippet: shellJoin(["code", "--add-mcp", addMcp], platform),
            },
      ];
      return {
        id: editor,
        name: isCursor ? "Cursor" : "VS Code",
        detected: exists(userDir) || (isCursor && exists(path.join(home, ".cursor"))),
        items,
      };
    }

    case "claude-code":
      return {
        id: "claude-code",
        name: "Claude Code",
        detected: exists(path.join(home, ".claude")),
        items: [
          {
            kind: "mcp",
            label: "Claude Code MCP server",
            file: null,
            write: "command",
            run: {
              cmd: "claude",
              args: ["mcp", "add", MCP_KEY, "--", server.command, ...server.args],
            },
            snippet: shellJoin(
              ["claude", "mcp", "add", MCP_KEY, "--", server.command, ...server.args],
              platform,
            ),
          },
        ],
      };

    case "claude-desktop": {
      const file = path.join(r.appData, "Claude", "claude_desktop_config.json");
      return {
        id: "claude-desktop",
        name: "Claude Desktop",
        detected: exists(path.dirname(file)),
        items: [
          {
            kind: "mcp",
            label: "Claude Desktop MCP server",
            file,
            write: exists(file) ? "print" : "create",
            snippet: json({ mcpServers: { [MCP_KEY]: server } }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown editor "${editor}". Use one of: ${EDITOR_IDS.join(", ")}, all`);
  }
}

/**
 * Carry out one setup item when that is safe: create a file that does not
 * exist yet, or run the editor's own CLI. Existing files are never modified.
 * @param {SetupItem} item
 * @param {{stdio?: import("node:child_process").StdioOptions}} [opts]
 * @returns {{done: boolean, message: string}}
 */
export function applySetupItem(item, { stdio = "inherit" } = {}) {
  if (item.write === "create") {
    try {
      fs.mkdirSync(path.dirname(item.file), { recursive: true });
      fs.writeFileSync(item.file, `${item.snippet}\n`, { flag: "wx" });
      return { done: true, message: `created ${item.file}` };
    } catch (error) {
      return { done: false, message: `could not create ${item.file}: ${error.message}` };
    }
  }
  if (item.write === "command") {
    // Windows: code/claude are .cmd shims, which need the shell; pass one
    // pre-quoted command line so JSON arguments survive cmd.exe.
    const result =
      process.platform === "win32"
        ? spawnSync(item.snippet, { stdio, shell: true })
        : spawnSync(item.run.cmd, item.run.args, { stdio });
    return result.status === 0
      ? { done: true, message: `ran: ${item.snippet}` }
      : { done: false, message: `could not run "${item.run.cmd}" — run the command yourself` };
  }
  return { done: false, message: "existing file: paste the snippet yourself" };
}
