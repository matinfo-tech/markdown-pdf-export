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
// --settings replaces the user settings file, so the real home is fine here
// (faking USERPROFILE/APPDATA stops Chrome and Edge from starting on Windows).
const env = { ...process.env };
delete env.MARKDOWN_PDF_SETTINGS;

/** Effective settings from `doctor --json`. It exits 1 when no browser starts; the JSON is still printed. */
function doctor(settings) {
  let out;
  try {
    out = execFileSync(process.execPath, [CLI, "doctor", "--json", "--settings", settings], { env, encoding: "utf8" });
  } catch (error) {
    if (!error.stdout) throw error;
    out = error.stdout;
  }
  return JSON.parse(out).settings;
}

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

test("sanitize is safe unless a settings file says none", () => {
  assert.equal(doctor("{}").sanitize, "safe");
  assert.equal(doctor('{"sanitize":"none"}').sanitize, "none");
  assert.equal(doctor('{"sanitize":"off"}').sanitize, "safe");
});

test("--sanitize accepts only safe or none", () => {
  assert.throws(
    () => execFileSync(process.execPath, [CLI, "x.md", "--sanitize", "off"], { env, encoding: "utf8", stdio: "pipe" }),
    (error) => /--sanitize expects safe or none/.test(error.stderr),
  );
});

test.after(() => fs.rmSync(home, { recursive: true, force: true }));
