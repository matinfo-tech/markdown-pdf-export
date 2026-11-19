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
  buildEditorSetup,
  launchSpec,
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

  it("detects Zed and never writes its JSONC files", () => {
    const zed = buildEditorSetup("zed", NPX, ctx());
    assert.equal(zed.detected, true);
    assert.ok(zed.items.every((item) => item.write === "print"));
    const task = JSON.parse(zed.items.find((i) => i.kind === "task").snippet)[0];
    assert.equal(task.label, TASK_LABEL);
    assert.deepEqual(task.args, ["-y", SERVER_NAME, "$ZED_FILE"]);
    const mcp = JSON.parse(zed.items.find((i) => i.kind === "mcp").snippet);
    assert.deepEqual(mcp.context_servers[MCP_KEY], {
      command: "npx",
      args: ["-y", SERVER_NAME, "mcp"],
    });
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

  it("only offers to create files that do not exist", () => {
    const file = path.join(home, ".cursor", "mcp.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{}");
    const cursor = buildEditorSetup("cursor", NPX, ctx());
    assert.equal(cursor.detected, true);
    assert.equal(cursor.items.find((i) => i.kind === "mcp").write, "print");
  });

  it("Claude Code uses the claude CLI", () => {
    const item = buildEditorSetup("claude-code", NPX, ctx()).items[0];
    assert.equal(item.write, "command");
    assert.deepEqual(item.run, {
      cmd: "claude",
      args: ["mcp", "add", MCP_KEY, "--", "npx", "-y", SERVER_NAME, "mcp"],
    });
  });

  it("rejects unknown editors", () => {
    assert.throws(() => buildEditorSetup("emacs", NPX, ctx()), /Unknown editor/);
  });
});
