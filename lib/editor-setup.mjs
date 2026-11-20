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
export const EDITOR_IDS = ["zed", "vscode", "cursor", "claude-code", "claude-desktop", "copilot-cli"];
/** Short names people type for an editor id. */
export const EDITOR_ALIASES = { claude: "claude-code", code: "vscode", copilot: "copilot-cli" };

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
 * @property {{cmd: string, args: string[], fallbacks?: string[]}} [run]
 *   CLI to run for "command"; `fallbacks` are full paths tried when `cmd` is not on PATH
 */

/**
 * @param {string} editor one of EDITOR_IDS
 * @param {{command: string, args: string[]}} launch
 * @param {{home?: string, platform?: string, env?: NodeJS.ProcessEnv}} [ctx]
 * @returns {{id: string, name: string, detected: boolean, items: SetupItem[]}}
 */
export function buildEditorSetup(editor, launch, ctx = {}) {
  editor = EDITOR_ALIASES[editor] ?? editor;
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
            // Zed files are JSONC: create a missing one, never edit an existing one.
            write: exists(path.join(dir, "tasks.json")) ? "print" : "create",
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
      const taskFile = path.join(userDir, "tasks.json");
      const addMcp = JSON.stringify({ name: MCP_KEY, ...server });
      /** @type {SetupItem[]} */
      const items = [
        {
          kind: "task",
          label: `${isCursor ? "Cursor" : "VS Code"} task (add to tasks.json)`,
          file: taskFile,
          write: exists(taskFile) ? "print" : "create",
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
              run: {
                cmd: "code",
                args: ["--add-mcp", addMcp],
                // macOS: `code` is only on PATH after "Install 'code' command in PATH".
                fallbacks:
                  platform === "darwin"
                    ? [
                        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                        path.join(home, "Applications", "Visual Studio Code.app", "Contents", "Resources", "app", "bin", "code"),
                      ]
                    : [],
              },
              snippet: shellJoin(["code", "--add-mcp", addMcp], platform),
            },
      ];
      return {
        id: editor,
        name: isCursor ? "Cursor" : "VS Code (Copilot)",
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
              args: ["mcp", "add", "--scope", "user", MCP_KEY, "--", server.command, ...server.args],
            },
            snippet: shellJoin(
              ["claude", "mcp", "add", "--scope", "user", MCP_KEY, "--", server.command, ...server.args],
              platform,
            ),
          },
        ],
      };

    case "copilot-cli": {
      // GitHub Copilot in the terminal keeps its own list (~/.copilot/mcp-config.json),
      // separate from VS Code's; its CLI writes it.
      const args = ["mcp", "add", MCP_KEY, "--", server.command, ...server.args];
      return {
        id: "copilot-cli",
        name: "Copilot CLI",
        detected: exists(path.join(home, ".copilot")),
        items: [
          {
            kind: "mcp",
            label: "Copilot CLI MCP server",
            file: null,
            write: "command",
            run: { cmd: "copilot", args },
            snippet: shellJoin(["copilot", ...args], platform),
          },
        ],
      };
    }

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
    let result =
      process.platform === "win32"
        ? spawnSync(item.snippet, { stdio, shell: true })
        : spawnSync(item.run.cmd, item.run.args, { stdio });
    for (const cmd of item.run.fallbacks ?? []) {
      if (result.error?.code !== "ENOENT") break;
      if (fs.existsSync(cmd)) result = spawnSync(cmd, item.run.args, { stdio });
    }
    return result.status === 0
      ? { done: true, message: `ran: ${item.snippet}` }
      : { done: false, message: `could not run "${item.run.cmd}" — run the command yourself` };
  }
  return { done: false, message: "existing file: paste the snippet yourself" };
}

// ── Status (doctor) ──────────────────────────────────────────────────────────

const readText = (file) => {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/** Task file: names our package. Settings/MCP file: has a "markdown-pdf" entry. */
const hasTask = (text) => text !== null && text.includes(SERVER_NAME);
const hasMcpKey = (text) => text !== null && text.includes(`"${MCP_KEY}"`);

/**
 * Claude Code keeps user-scope servers at the top of ~/.claude.json and
 * local-scope ones per project. "project" = only set up for some folders.
 * @returns {boolean|"project"}
 */
function claudeCodeMcp(file) {
  const text = readText(file);
  if (text === null) return false;
  try {
    const data = JSON.parse(text);
    if (data?.mcpServers?.[MCP_KEY]) return true;
    const inProject = Object.values(data?.projects ?? {}).some((p) => p?.mcpServers?.[MCP_KEY]);
    return inProject ? "project" : false;
  } catch {
    return hasMcpKey(text);
  }
}

/**
 * What is set up in each editor: read-only, for `doctor`.
 * `task` / `mcp` are undefined when the editor has no such thing.
 * `warnings` flags configs known to cause trouble (an old settings override).
 * @param {{home?: string, platform?: string, env?: NodeJS.ProcessEnv}} [ctx]
 * @returns {{id: string, name: string, detected: boolean, task?: boolean, mcp?: boolean|"project", warnings: string[]}[]}
 */
export function editorStatus(ctx = {}) {
  const home = ctx.home ?? os.homedir();
  const platform = ctx.platform ?? process.platform;
  const env = ctx.env ?? process.env;
  const r = roots({ home, platform, env });

  return EDITOR_IDS.map((id) => {
    const { name, detected } = buildEditorSetup(id, { command: "npx", args: [] }, { home, platform, env });
    const out = { id, name, detected, warnings: [] };
    let taskFile = null;
    switch (id) {
      case "zed":
        taskFile = path.join(r.zed, "tasks.json");
        out.mcp = hasMcpKey(readText(path.join(r.zed, "settings.json")));
        break;
      case "vscode":
      case "cursor": {
        const userDir = path.join(r.userData, id === "cursor" ? "Cursor" : "Code", "User");
        // ~/.cursor alone = Cursor Agent CLI without the app: no task to offer.
        if (id === "vscode" || fs.existsSync(userDir)) taskFile = path.join(userDir, "tasks.json");
        out.mcp = hasMcpKey(
          readText(id === "cursor" ? path.join(home, ".cursor", "mcp.json") : path.join(userDir, "mcp.json")),
        );
        break;
      }
      case "claude-code":
        out.mcp = claudeCodeMcp(path.join(home, ".claude.json"));
        break;
      case "claude-desktop":
        out.mcp = hasMcpKey(readText(path.join(r.appData, "Claude", "claude_desktop_config.json")));
        break;
      case "copilot-cli":
        out.mcp = hasMcpKey(readText(path.join(home, ".copilot", "mcp-config.json")));
        break;
    }
    if (taskFile) {
      const text = readText(taskFile);
      out.task = hasTask(text);
      if (out.task && text.includes("MARKDOWN_PDF_SETTINGS")) {
        out.warnings.push(
          `${taskFile} sets MARKDOWN_PDF_SETTINGS, which replaces your settings file`,
        );
      }
    }
    if (out.task || out.mcp) out.detected = true; // set up, even if its folder moved
    return out;
  });
}

/** What a setup item adds, in words. */
export const ITEM_LABELS = { task: "export task", mcp: "AI tools" };

/**
 * Items of one editor that are not set up yet, given its editorStatus() entry.
 * Claude Code set up only for some folders ("project") still counts as to do;
 * a kind the status does not list is skipped (it does not apply here).
 * @param {{items: SetupItem[]}} setup
 * @param {{task?: boolean, mcp?: boolean|"project"}|undefined} status
 * @returns {SetupItem[]}
 */
export function pendingItems(setup, status) {
  if (!status) return [...setup.items];
  // A kind missing from the status does not apply here (Cursor CLI without the app).
  return setup.items.filter((item) => item.kind in status && status[item.kind] !== true);
}
