/**
 * @fileoverview Unit tests for editor-setup.mjs
 *
 * Run with: node --test lib/__tests__/editor-setup.test.mjs
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  EDITOR_IDS,
  MCP_KEY,
  SERVER_NAME,
  TASK_LABEL,
  ZED_EXPORT_KEY,
  ZED_EXTENSION_ID,
  applySetupItem,
  backupPath,
  buildEditorSetup,
  editorStatus,
  launchSpec,
  pendingItems,
  shellJoin,
  stableNodePath,
} from "../editor-setup.mjs";

const NPX = { command: "npx", args: ["-y", SERVER_NAME] };

describe("launchSpec", () => {
  it("uses npx when launched from the npx cache", () => {
    const cli = path.join(path.resolve("/c"), "_npx", "abc", "node_modules", SERVER_NAME, "cli.mjs");
    assert.deepEqual(launchSpec(cli), NPX);
  });

  it("uses an absolute node + cli path otherwise", () => {
    const cli = path.resolve("/opt/lib/node_modules/markdown-pdf-export/cli.mjs");
    assert.deepEqual(launchSpec(cli, "/usr/bin/node"), {
      command: "/usr/bin/node",
      args: [cli],
    });
  });
});

describe("stableNodePath", () => {
  const home = path.resolve("/home/u");
  const volta = path.join(home, ".volta", "tools", "image", "node", "24.1.0", "bin", "node");

  it("swaps a Volta versioned node for the Volta shim", () => {
    const shim = stableNodePath(volta, home, () => true);
    assert.ok(shim.startsWith(path.join(home, ".volta", "bin")));
  });

  it("keeps the path when the shim does not exist", () => {
    assert.equal(stableNodePath(volta, home, () => false), volta);
  });

  it("keeps a plain system node", () => {
    assert.equal(stableNodePath("/usr/bin/node", home, () => true), "/usr/bin/node");
  });
});

describe("shellJoin", () => {
  const json = '{"name":"x","args":["a b"]}';

  it("single-quotes on POSIX", () => {
    assert.equal(shellJoin(["code", "--add-mcp", json], "linux"), `code --add-mcp '${json}'`);
    assert.equal(shellJoin(["it's"], "darwin"), `'it'\\''s'`);
  });

  it("double-quotes and escapes on Windows", () => {
    assert.equal(
      shellJoin(["code", "--add-mcp", json], "win32"),
      `code --add-mcp "${json.replaceAll('"', '\\"')}"`,
    );
    assert.equal(
      shellJoin(["C:\\Program Files\\node.exe", "mcp"], "win32"),
      '"C:\\Program Files\\node.exe" mcp',
    );
  });
});

describe("buildEditorSetup", () => {
  let home;
  before(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-setup-"));
    fs.mkdirSync(path.join(home, ".config", "zed"), { recursive: true });
  });
  after(() => fs.rmSync(home, { recursive: true, force: true }));

  const ctx = () => ({ home, platform: "linux", env: {} });

  it("covers every editor id", () => {
    for (const id of EDITOR_IDS) {
      const setup = buildEditorSetup(id, NPX, ctx());
      assert.equal(setup.id, id);
      assert.ok(setup.items.length > 0);
      for (const item of setup.items) {
        if (item.write !== "command") JSON.parse(item.snippet);
      }
    }
  });

  it("detects Zed, creates missing files and merges into existing ones", () => {
    const zed = buildEditorSetup("zed", NPX, ctx());
    assert.equal(zed.detected, true);
    assert.deepEqual(zed.items.map((i) => [i.kind, i.write]), [["task", "create"], ["key", "create"], ["mcp", "create"]]);
    fs.writeFileSync(path.join(home, ".config", "zed", "tasks.json"), "[]");
    fs.writeFileSync(path.join(home, ".config", "zed", "settings.json"), "{}");
    const again = buildEditorSetup("zed", NPX, ctx());
    assert.deepEqual(again.items.map((i) => i.write), ["merge", "create", "merge"]);
    const task = JSON.parse(zed.items.find((i) => i.kind === "task").snippet)[0];
    assert.equal(task.label, TASK_LABEL);
    assert.deepEqual(task.args, ["-y", SERVER_NAME, "$ZED_FILE"]);
    assert.deepEqual(again.items[0].merge, { at: [], value: task, append: true });
    const mcp = JSON.parse(zed.items.find((i) => i.kind === "mcp").snippet);
    assert.deepEqual(mcp.context_servers[MCP_KEY], {
      command: "npx",
      args: ["-y", SERVER_NAME, "mcp"],
    });
    assert.deepEqual(again.items[2].merge.at, ["context_servers", MCP_KEY]);
  });

  it("Zed shortcut runs the export task in Markdown files, cmd-k cmd-e on macOS", () => {
    const key = (platform) =>
      JSON.parse(buildEditorSetup("zed", NPX, { home, platform, env: {} }).items.find((i) => i.kind === "key").snippet)[0];
    const linux = key("linux");
    assert.equal(linux.context, "Editor && extension == md");
    assert.deepEqual(linux.bindings, { [ZED_EXPORT_KEY.other]: ["task::Spawn", { task_name: TASK_LABEL }] });
    assert.deepEqual(Object.keys(key("darwin").bindings), ["cmd-k cmd-e"]);
    assert.deepEqual(Object.keys(key("win32").bindings), ["ctrl-k ctrl-e"]);
  });

  it("VS Code task uses ${file} and MCP goes through code --add-mcp", () => {
    const vscode = buildEditorSetup("vscode", NPX, ctx());
    assert.equal(vscode.detected, false);
    const task = JSON.parse(vscode.items.find((i) => i.kind === "task").snippet);
    assert.deepEqual(task.tasks[0].args, ["-y", SERVER_NAME, "${file}"]);
    const mcpItem = vscode.items.find((i) => i.kind === "mcp");
    assert.equal(mcpItem.write, "command");
    assert.equal(mcpItem.run.cmd, "code");
    assert.deepEqual(JSON.parse(mcpItem.run.args[1]), {
      name: MCP_KEY,
      command: "npx",
      args: ["-y", SERVER_NAME, "mcp"],
    });
  });

  it("merges the MCP server into an existing Cursor mcp.json", () => {
    const file = path.join(home, ".cursor", "mcp.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{}");
    const cursor = buildEditorSetup("cursor", NPX, ctx());
    assert.equal(cursor.detected, true);
    const mcp = cursor.items.find((i) => i.kind === "mcp");
    assert.equal(mcp.write, "merge");
    assert.deepEqual(mcp.merge.at, ["mcpServers", MCP_KEY]);
  });

  it("creates a missing VS Code tasks.json, merges into an existing one", () => {
    const taskItem = () =>
      buildEditorSetup("vscode", NPX, ctx()).items.find((i) => i.kind === "task");
    assert.equal(taskItem().write, "create");
    const file = path.join(home, ".config", "Code", "User", "tasks.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{}");
    assert.equal(taskItem().write, "merge");
    assert.deepEqual(taskItem().merge.at, ["tasks"]);
  });

  it("VS Code on macOS falls back to the code CLI inside the app bundle", () => {
    const mac = buildEditorSetup("vscode", NPX, { home, platform: "darwin", env: {} });
    const run = mac.items.find((i) => i.kind === "mcp").run;
    assert.ok(run.fallbacks.some((p) => p.includes("Visual Studio Code.app")));
    const linux = buildEditorSetup("vscode", NPX, ctx());
    assert.deepEqual(linux.items.find((i) => i.kind === "mcp").run.fallbacks, []);
  });

  it("Claude Code uses the claude CLI", () => {
    const item = buildEditorSetup("claude-code", NPX, ctx()).items[0];
    assert.equal(item.write, "command");
    assert.deepEqual(item.run, {
      cmd: "claude",
      args: ["mcp", "add", "--scope", "user", MCP_KEY, "--", "npx", "-y", SERVER_NAME, "mcp"],
    });
  });

  it("accepts short editor names", () => {
    assert.equal(buildEditorSetup("claude", NPX, ctx()).id, "claude-code");
    assert.equal(buildEditorSetup("code", NPX, ctx()).id, "vscode");
    assert.equal(buildEditorSetup("copilot", NPX, ctx()).id, "copilot-cli");
  });

  it("Copilot CLI uses the copilot CLI", () => {
    const setup = buildEditorSetup("copilot-cli", NPX, ctx());
    assert.equal(setup.items[0].write, "command");
    assert.deepEqual(setup.items[0].run, {
      cmd: "copilot",
      args: ["mcp", "add", MCP_KEY, "--", "npx", "-y", SERVER_NAME, "mcp"],
    });
  });

  it("rejects unknown editors", () => {
    assert.throws(() => buildEditorSetup("emacs", NPX, ctx()), /Unknown editor/);
  });
});

describe("editorStatus", () => {
  let home;
  before(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-status-"));
    const zed = path.join(home, ".config", "zed");
    fs.mkdirSync(zed, { recursive: true });
    fs.writeFileSync(
      path.join(zed, "tasks.json"),
      '[{"command":"markdown-pdf-export","env":{"MARKDOWN_PDF_SETTINGS":"/old.json"}}]',
    );
    fs.writeFileSync(path.join(zed, "settings.json"), "{ // jsonc\n}");
    fs.writeFileSync(
      path.join(home, ".claude.json"),
      JSON.stringify({ projects: { "/p": { mcpServers: { [MCP_KEY]: {} } } } }),
    );
  });
  after(() => fs.rmSync(home, { recursive: true, force: true }));

  const status = () =>
    Object.fromEntries(editorStatus({ home, platform: "linux", env: {} }).map((e) => [e.id, e]));

  it("reports what is set up and flags a settings override", () => {
    const { zed } = status();
    assert.equal(zed.detected, true);
    assert.equal(zed.task, true);
    assert.equal(zed.mcp, false);
    assert.equal(zed.key, false);
    assert.equal(zed.extension, false);
    assert.match(zed.warnings[0], /MARKDOWN_PDF_SETTINGS/);
  });

  it("Zed: finds the shortcut, and the extension counts as AI tools set up", () => {
    fs.writeFileSync(
      path.join(home, ".config", "zed", "keymap.json"),
      `// keys\n[{ "bindings": { "ctrl-k ctrl-e": ["task::Spawn", { "task_name": "${TASK_LABEL}" }] } }]`,
    );
    fs.mkdirSync(path.join(home, ".local", "share", "zed", "extensions", "installed", ZED_EXTENSION_ID), { recursive: true });
    const { zed } = status();
    assert.equal(zed.key, true);
    assert.equal(zed.extension, true);
    assert.equal(zed.mcp, true);
    const setup = buildEditorSetup("zed", NPX, { home, platform: "linux", env: {} });
    assert.deepEqual(pendingItems(setup, zed).map((i) => i.kind), []);
  });

  it("tells user-scope Claude Code from project-only", () => {
    assert.equal(status()["claude-code"].mcp, "project");
    fs.writeFileSync(path.join(home, ".claude.json"), JSON.stringify({ mcpServers: { [MCP_KEY]: {} } }));
    assert.equal(status()["claude-code"].mcp, true);
  });

  it("marks editors that are not installed", () => {
    const s = status();
    assert.equal(s.cursor.detected, false);
    assert.equal("task" in s.cursor, false);
    assert.equal(s.vscode.task, false);
  });

  it("Cursor CLI without the app: only the AI tools are offered", () => {
    fs.mkdirSync(path.join(home, ".cursor"), { recursive: true });
    const s = status();
    assert.equal(s.cursor.detected, true);
    assert.equal("task" in s.cursor, false);
    const setup = buildEditorSetup("cursor", NPX, { home, platform: "linux", env: {} });
    assert.deepEqual(pendingItems(setup, s.cursor).map((i) => i.kind), ["mcp"]);
  });
});

describe("applySetupItem", () => {
  let home;
  before(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-apply-"));
  });
  after(() => fs.rmSync(home, { recursive: true, force: true }));

  const zedItem = (kind) => {
    const setup = buildEditorSetup("zed", NPX, { home, platform: "linux", env: {} });
    return setup.items.find((i) => i.kind === kind);
  };
  const zedFile = (name) => path.join(home, ".config", "zed", name);

  it("creates a missing file", () => {
    fs.mkdirSync(path.join(home, ".config", "zed"), { recursive: true });
    const { done, message } = applySetupItem(zedItem("key"));
    assert.equal(done, true, message);
    assert.equal(JSON.parse(fs.readFileSync(zedFile("keymap.json"), "utf8"))[0].context, "Editor && extension == md");
  });

  it("adds to an existing JSONC file, keeps the rest, and backs it up", () => {
    const before = '// Zed settings\n{\n  "theme": "One Dark", // mine\n}\n';
    fs.writeFileSync(zedFile("settings.json"), before);
    const { done, message } = applySetupItem(zedItem("mcp"));
    assert.equal(done, true, message);
    const after = fs.readFileSync(zedFile("settings.json"), "utf8");
    assert.ok(after.startsWith('// Zed settings\n{\n  "theme": "One Dark", // mine'));
    assert.ok(after.includes('"context_servers": {\n    "markdown-pdf": {'));
    assert.equal(fs.readFileSync(backupPath(zedFile("settings.json")), "utf8"), before);
  });

  it("leaves a file it cannot read untouched, without a backup", () => {
    const broken = '[\n  { "label": "a" }\n  { "label": "b" }\n]';
    fs.writeFileSync(zedFile("tasks.json"), broken);
    const { done, message } = applySetupItem(zedItem("task"));
    assert.equal(done, false);
    assert.match(message, /not valid JSON .*line 3.*Paste the snippet yourself/);
    assert.equal(fs.readFileSync(zedFile("tasks.json"), "utf8"), broken);
    assert.equal(fs.existsSync(backupPath(zedFile("tasks.json"))), false);
  });

  it("writes through a symlink (dotfiles) instead of replacing it", { skip: process.platform === "win32" }, () => {
    const real = path.join(home, "dotfiles-tasks.json");
    fs.writeFileSync(real, "[]\n");
    fs.rmSync(zedFile("tasks.json"), { force: true });
    fs.symlinkSync(real, zedFile("tasks.json"));
    const { done, message } = applySetupItem(zedItem("task"));
    assert.equal(done, true, message);
    assert.equal(fs.lstatSync(zedFile("tasks.json")).isSymbolicLink(), true);
    assert.equal(JSON.parse(fs.readFileSync(real, "utf8"))[0].label, TASK_LABEL);
  });
});

describe("pendingItems", () => {
  const setup = { items: [{ kind: "task" }, { kind: "mcp" }] };
  it("skips kinds that do not apply here", () => {
    assert.deepEqual(pendingItems(setup, { mcp: false }), [{ kind: "mcp" }]);
  });
  it("keeps only what is not set up", () => {
    assert.deepEqual(pendingItems(setup, { task: true, mcp: false }), [{ kind: "mcp" }]);
    assert.deepEqual(pendingItems(setup, { task: true, mcp: true }), []);
    assert.equal(pendingItems(setup, undefined).length, 2);
  });
  it("Claude Code set up for some folders only is still to do", () => {
    assert.equal(pendingItems({ items: [{ kind: "mcp" }] }, { mcp: "project" }).length, 1);
  });
});
