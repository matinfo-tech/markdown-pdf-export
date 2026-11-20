/**
 * @fileoverview `--settings` expands the same presets (look, font, template)
 * as a settings file.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "cli.mjs");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "mpe-cli-settings-"));
const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home, APPDATA: home };
delete env.MARKDOWN_PDF_SETTINGS;

const doctor = (settings) =>
  JSON.parse(execFileSync(process.execPath, [CLI, "doctor", "--json", "--settings", settings], { env, encoding: "utf8" }))
    .settings;

test("inline --settings expands look and font", () => {
  const s = doctor('{"look":"academic","font":"serif"}');
  assert.match(s.stylesheet_path, /academic\.css$/);
  assert.equal(s.margin.left, "25mm");
  assert.match(s.font_family, /Georgia/);
});

test("--settings file expands template", () => {
  const file = path.join(home, "s.json");
  fs.writeFileSync(file, JSON.stringify({ template: "simple" }));
  const s = doctor(file);
  assert.equal(s.header.left_text, "{title}");
  assert.equal(s.footer.center_text, "Page {page} of {pages}");
});

test.after(() => fs.rmSync(home, { recursive: true, force: true }));
