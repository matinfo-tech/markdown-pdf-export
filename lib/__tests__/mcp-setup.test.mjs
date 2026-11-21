import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserInstaller, launchStudio } from "../mcp-setup.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = path.join(ROOT, "cli.mjs");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── createBrowserInstaller ───────────────────────────────────────────────────

test("installer: a quick install reports installed", async () => {
  const installer = createBrowserInstaller(async () => {}, { waitMs: 1000 });
  assert.equal(await installer.run(), "installed");
  assert.equal(installer.status(), "idle");
});

test("installer: a slow install reports installing, and later calls join it", async () => {
  let calls = 0;
  const installer = createBrowserInstaller(
    async () => {
      calls += 1;
      await delay(80);
    },
    { waitMs: 10 },
  );
  assert.equal(await installer.run(), "installing");
  assert.equal(installer.status(), "installing");
  assert.equal(await installer.run(), "installing");
  await delay(120);
  assert.equal(installer.status(), "idle");
  assert.equal(calls, 1);
});

test("installer: a quick failure rejects and is remembered", async () => {
  const installer = createBrowserInstaller(
    async () => {
      throw new Error("disk full");
    },
    { waitMs: 1000 },
  );
  await assert.rejects(installer.run(), /disk full/);
  assert.equal(installer.status(), "failed");
  assert.equal(installer.lastError(), "disk full");
});

test("installer: a failure after the caller stopped waiting does not throw", async () => {
  const installer = createBrowserInstaller(
    async () => {
      await delay(40);
      throw new Error("network down");
    },
    { waitMs: 5 },
  );
  assert.equal(await installer.run(), "installing");
  await delay(80);
  assert.equal(installer.status(), "failed");
  assert.equal(installer.lastError(), "network down");
});

// ── launchStudio ─────────────────────────────────────────────────────────────

test("launchStudio: starts Studio in its own process and returns its link", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-studio-"));
  const studio = await launchStudio({ cliPath: CLI, projectFolder: dir, openBrowser: false });
  try {
    assert.match(studio.url, /^http:\/\/127\.0\.0\.1:\d+\/#[0-9a-f]+$/);
    assert.equal(studio.settingsPath, path.join(dir, ".markdown-pdf.json"));
    assert.notEqual(studio.pid, process.pid);
    const res = await fetch(studio.url.replace(/#.*$/, ""));
    assert.equal(res.status, 200);
  } finally {
    process.kill(studio.pid);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("launchStudio: reports why Studio could not start", async () => {
  await assert.rejects(
    launchStudio({
      cliPath: CLI,
      file: path.join(os.tmpdir(), "does-not-exist-mcp-studio.md"),
      projectFolder: os.tmpdir(),
      openBrowser: false,
    }),
    /Studio stopped before it was ready[\s\S]*Cannot read/,
  );
});

// ── MCP server ───────────────────────────────────────────────────────────────

test("mcp: lists the export, doctor and setup tools", async () => {
  const child = spawn(process.execPath, [path.join(ROOT, "mcp.mjs")], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  try {
    const reply = new Promise((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += chunk.toString();
        const line = out.split("\n").find((l) => l.includes('"id":1'));
        if (line) resolve(JSON.parse(line));
      });
      child.on("exit", (code) => reject(new Error(`mcp exited ${code}`)));
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`);
    const { result } = await reply;
    assert.deepEqual(
      result.tools.map((t) => t.name),
      [
        "export_markdown_pdf",
        "doctor_markdown_pdf",
        "install_browser_markdown_pdf",
        "open_studio_markdown_pdf",
      ],
    );
  } finally {
    child.kill();
  }
});
