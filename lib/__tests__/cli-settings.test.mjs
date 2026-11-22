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

/** `doctor --json` for a Markdown file, with extra CLI arguments. */
function doctorFor(file, ...extra) {
  let out;
  try {
    out = execFileSync(process.execPath, [CLI, "doctor", file, "--json", "--settings", "{}", ...extra], {
      env,
      encoding: "utf8",
    });
  } catch (error) {
    if (!error.stdout) throw error;
    out = error.stdout;
  }
  return JSON.parse(out);
}

test("--no-project-settings ignores .markdown-pdf.json", () => {
  const dir = fs.mkdtempSync(path.join(home, "project-"));
  fs.writeFileSync(path.join(dir, ".markdown-pdf.json"), JSON.stringify({ page_format: "Letter", sanitize: "none" }));
  const md = path.join(dir, "doc.md");
  fs.writeFileSync(md, "# Doc\n");

  const withProject = doctorFor(md);
  assert.equal(withProject.settings.page_format, "Letter");
  assert.ok(withProject.settings_sources.some((s) => s.kind === "project"));

  const without = doctorFor(md, "--no-project-settings");
  assert.equal(without.settings.page_format, "A4");
  assert.equal(without.settings.sanitize, "safe");
  assert.ok(!without.settings_sources.some((s) => s.kind === "project"));
});

test("--no-project-settings takes no value", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [CLI, "x.md", "--no-project-settings=false"], {
        env,
        encoding: "utf8",
        stdio: "pipe",
      }),
    (error) => /Unknown option: --no-project-settings=false/.test(error.stderr),
  );
});

test("--json prints the export result instead of the PDF path", (t) => {
  const dir = fs.mkdtempSync(path.join(home, "json-"));
  const md = path.join(dir, "doc.md");
  fs.writeFileSync(md, "# Doc\n\n<script>1</script>\n");
  const run = (...extra) =>
    execFileSync(process.execPath, [CLI, md, "--settings", "{}", "--no-project-settings", ...extra], {
      env,
      encoding: "utf8",
      stdio: "pipe",
    });
  let out;
  try {
    out = run("--json");
  } catch (error) {
    if (/browser|chrom/i.test(error.stderr)) return t.skip("no browser on this machine");
    throw error;
  }
  const result = JSON.parse(out);
  assert.equal(result.output_path, path.join(dir, "doc.pdf"));
  assert.ok(fs.existsSync(result.output_path));
  assert.deepEqual(result.removed_html, ["<script>"]);
  assert.deepEqual(result.diagram_errors, []);
  assert.ok(Array.isArray(result.settings_files));

  assert.throws(
    () => run("--json", "--watch"),
    (error) => /--json cannot be used with --watch/.test(error.stderr),
  );
});

test.after(() => fs.rmSync(home, { recursive: true, force: true }));
