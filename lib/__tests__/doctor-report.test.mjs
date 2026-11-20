import test from "node:test";
import assert from "node:assert/strict";
import { formatDoctor, formatEditors } from "../doctor-report.mjs";

const base = {
  browser: { available: true, version: "157", backend: "Chromium (Playwright)" },
  settings_sources: [{ kind: "user", path: "/h/settings.json", loaded: true, error: null }],
  settings: { page_format: "A4", orientation: "portrait", header: { left_text: "x" } },
};

test("healthy setup", () => {
  const { text, ok } = formatDoctor(base, { nodeVersion: "22.1.0" });
  assert.ok(ok);
  assert.match(text, /Everything is ready/);
  assert.match(text, /header\/footer: on/);
});

test("missing browser gives the fix", () => {
  const { text, ok } = formatDoctor({ ...base, browser: { available: false } }, { nodeVersion: "22.1.0" });
  assert.ok(!ok);
  assert.match(text, /install-browser/);
});

test("no settings file is informational, not a failure", () => {
  const r = formatDoctor(
    { ...base, settings_sources: [{ kind: "user", path: "/h/s.json", loaded: false, error: null }] },
    { nodeVersion: "22.1.0" },
  );
  assert.ok(r.ok);
  assert.match(r.text, /init/);
});

test("settings parse error fails", () => {
  const r = formatDoctor(
    { ...base, settings_sources: [{ kind: "user", path: "/h/s.json", loaded: false, error: "invalid JSON" }] },
    { nodeVersion: "22.1.0" },
  );
  assert.ok(!r.ok);
  assert.match(r.text, /invalid JSON/);
});

test("old Node fails", () => {
  assert.ok(!formatDoctor(base, { nodeVersion: "18.0.0" }).ok);
});

test("shows the package version", () => {
  const { text } = formatDoctor({ ...base, version: "9.9.9" }, { nodeVersion: "22.1.0" });
  assert.match(text, /markdown-pdf-export 9\.9\.9/);
});

test("editors section: done, missing with fix, warnings, not found", () => {
  const text = formatEditors([
    { id: "zed", name: "Zed", detected: true, task: true, mcp: true, warnings: [] },
    { id: "vscode", name: "VS Code", detected: true, task: true, mcp: false, warnings: ["x sets MARKDOWN_PDF_SETTINGS"] },
    { id: "claude-code", name: "Claude Code", detected: true, mcp: "project", warnings: [] },
    { id: "cursor", name: "Cursor", detected: false, task: false, mcp: false, warnings: [] },
  ]);
  assert.match(text, /✓ Zed: export task, AI tools/);
  assert.match(text, /VS Code: export task ✓, AI tools not set up/);
  assert.match(text, /setup vscode --write/);
  assert.match(text, /! x sets MARKDOWN_PDF_SETTINGS/);
  assert.match(text, /only in some project folders/);
  assert.match(text, /Not found: Cursor/);
});
