/**
 * @fileoverview Editor wiring: builds the exact task + MCP snippets (and target
 * files) for Zed, VS Code, Cursor, Claude Code and Claude Desktop.
 *
 * Building is pure — no I/O except `fs.existsSync` for detection — so the
 * output is unit-testable with a fake home directory. `applySetupItem` does
 * the writing: it creates missing files, adds one entry to existing JSON(C)
 * files (lib/jsonc-merge.mjs) or runs an editor CLI.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { formatJson, mergeJsonc } from "./jsonc-merge.mjs";

/** npm package name (what npx runs). */
export const SERVER_NAME = "markdown-pdf-export";
/** Key of the MCP server entry and task label — match the docs. */
export const MCP_KEY = "markdown-pdf";
export const TASK_LABEL = "Markdown: Export to PDF";
/** Id of the Zed extension (zed-markdown-pdf-export) that provides the MCP server. */
export const ZED_EXTENSION_ID = "markdown-pdf-export";
/**
 * Zed shortcut for the export task. Free in Zed's default keymaps on every
 * platform; cmd/ctrl-shift-o would hide the outline (outline::Toggle).
 */
export const ZED_EXPORT_KEY = { darwin: "cmd-k cmd-e", other: "ctrl-k ctrl-e" };
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

const json = (value) => formatJson(value);

/** Per-OS config roots. */
function roots({ home, platform, env }) {
  if (platform === "win32") {
    const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
    const localAppData = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    return { appData, userData: appData, zed: path.join(appData, "Zed"), zedData: path.join(localAppData, "Zed") };
  }
  if (platform === "darwin") {
    const appSupport = path.join(home, "Library", "Application Support");
    return {
      appData: appSupport,
      userData: appSupport,
      zed: path.join(home, ".config", "zed"),
      zedData: path.join(appSupport, "Zed"),
    };
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(home, ".config");
  const data = env.FLATPAK_XDG_DATA_HOME || env.XDG_DATA_HOME || path.join(home, ".local", "share");
  return { appData: xdg, userData: xdg, zed: path.join(xdg, "zed"), zedData: path.join(data, "zed") };
}

/**
 * @typedef {object} SetupItem
 * @property {"mcp"|"task"|"key"} kind
 * @property {string} label
 * @property {string|null} file       target file (null for CLI-only)
 * @property {string} snippet         text to show / write
 * @property {"create"|"merge"|"print"|"command"} write   safe-write strategy:
 *   create a missing file, merge one entry into an existing one, only print, or run a CLI
 * @property {{at: (string|number)[], value: unknown, append?: boolean}} [merge]
 *   the entry `merge` adds (see mergeJsonc)
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
      const tasks = path.join(dir, "tasks.json");
      const keymap = path.join(dir, "keymap.json");
      const settings = path.join(dir, "settings.json");
      const task = {
        label: TASK_LABEL,
        command: launch.command,
        args: exportArgs("$ZED_FILE"),
        use_new_terminal: false,
        reveal: "never",
      };
      const binding = {
        context: "Editor && extension == md",
        bindings: {
          [platform === "darwin" ? ZED_EXPORT_KEY.darwin : ZED_EXPORT_KEY.other]: [
            "task::Spawn",
            { task_name: TASK_LABEL },
          ],
        },
      };
      return {
        id: "zed",
        name: "Zed",
        detected: exists(dir),
        items: [
          {
            kind: "task",
            label: "Zed task (tasks.json)",
            file: tasks,
            write: exists(tasks) ? "merge" : "create",
            merge: { at: [], value: task, append: true },
            snippet: json([task]),
          },
          {
            kind: "key",
            label: "Zed keyboard shortcut (keymap.json)",
            file: keymap,
            write: exists(keymap) ? "merge" : "create",
            merge: { at: [], value: binding, append: true },
            snippet: json([binding]),
          },
          {
            kind: "mcp",
            label: "Zed MCP server (settings.json)",
            file: settings,
            write: exists(settings) ? "merge" : "create",
            merge: { at: ["context_servers", MCP_KEY], value: server },
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
      const vscodeTask = {
        label: TASK_LABEL,
        type: "process",
        command: launch.command,
        args: exportArgs("${file}"),
        problemMatcher: [],
      };
      /** @type {SetupItem[]} */
      const items = [
        {
          kind: "task",
          label: `${isCursor ? "Cursor" : "VS Code"} task (tasks.json)`,
          file: taskFile,
          write: exists(taskFile) ? "merge" : "create",
          merge: { at: ["tasks"], value: vscodeTask, append: true },
          snippet: json({ version: "2.0.0", tasks: [vscodeTask] }),
        },
        isCursor
          ? {
              kind: "mcp",
              label: "Cursor MCP server",
              file: mcpFile,
              write: exists(mcpFile) ? "merge" : "create",
              merge: { at: ["mcpServers", MCP_KEY], value: server },
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
            write: exists(file) ? "merge" : "create",
            merge: { at: ["mcpServers", MCP_KEY], value: server },
            snippet: json({ mcpServers: { [MCP_KEY]: server } }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown editor "${editor}". Use one of: ${EDITOR_IDS.join(", ")}, all`);
  }
}

/** Backup kept next to a file before `setup` changes it. */
export const backupPath = (file) => `${file}.markdown-pdf.bak`;

/**
 * Replace a file's content safely: write the real file behind a symlink
 * (dotfiles setups), keep its mode, back it up first, and swap it in with a
 * rename so an editor never reads a half-written file.
 */
function replaceFile(file, content) {
  const real = fs.realpathSync(file);
  const { mode } = fs.statSync(real);
  fs.copyFileSync(real, backupPath(file));
  const tmp = `${real}.markdown-pdf-${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, content, { mode });
    fs.renameSync(tmp, real);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

/**
 * Carry out one setup item: create a file that does not exist yet, add one
 * entry to an existing JSON(C) file (nothing else in it changes; a backup is
 * kept), or run the editor's own CLI.
 * @param {SetupItem} item
 * @param {{stdio?: import("node:child_process").StdioOptions}} [opts]
 * @returns {{done: boolean, message: string}}
 */
export function applySetupItem(item, { stdio = "inherit" } = {}) {
  if (item.write === "merge" && fs.existsSync(item.file)) {
    try {
      const before = fs.readFileSync(item.file, "utf8");
      replaceFile(item.file, mergeJsonc(before, item.merge));
      return { done: true, message: `added to ${item.file} (backup: ${path.basename(backupPath(item.file))})` };
    } catch (error) {
      return { done: false, message: `could not update ${item.file}: ${error.message}. Paste the snippet yourself` };
    }
  }
  if (item.write === "create" || item.write === "merge") {
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

/** Task file: names our package. Settings/MCP file: has a "markdown-pdf" entry. Keymap: runs our task. */
const hasTask = (text) => text !== null && text.includes(SERVER_NAME);
const hasMcpKey = (text) => text !== null && text.includes(`"${MCP_KEY}"`);
const hasKey = (text) => text !== null && text.includes(TASK_LABEL);

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
 * `task` / `mcp` / `key` are undefined when the editor has no such thing.
 * Zed's MCP counts as set up when the Markdown PDF Export extension is
 * installed: it provides the server, and a settings entry would replace it.
 * `warnings` flags configs known to cause trouble (an old settings override).
 * @param {{home?: string, platform?: string, env?: NodeJS.ProcessEnv}} [ctx]
 * @returns {{id: string, name: string, detected: boolean, task?: boolean, mcp?: boolean|"project", key?: boolean, extension?: boolean, warnings: string[]}[]}
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
        out.extension = fs.existsSync(path.join(r.zedData, "extensions", "installed", ZED_EXTENSION_ID));
        out.mcp = out.extension || hasMcpKey(readText(path.join(r.zed, "settings.json")));
        out.key = hasKey(readText(path.join(r.zed, "keymap.json")));
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
export const ITEM_LABELS = { task: "export task", key: "keyboard shortcut", mcp: "AI tools" };

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
