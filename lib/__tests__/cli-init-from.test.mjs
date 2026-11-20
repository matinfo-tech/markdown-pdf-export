/**
 * @fileoverview `init --from <file>` installs a settings file (for example the
 * one downloaded from the online designer) after checking it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "cli.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mpe-init-from-"));

/** Run `init` with a private config folder so the real settings file is never touched. */
function init(args, name) {
  const xdg = path.join(root, name, "xdg");
  const cwd = path.join(root, name, "cwd");
  fs.mkdirSync(cwd, { recursive: true });
  const env = { ...process.env, XDG_CONFIG_HOME: xdg, APPDATA: xdg };
  delete env.MARKDOWN_PDF_SETTINGS;
  const result = spawnSync(process.execPath, [CLI, "init", ...args], { env, cwd, encoding: "utf8" });
  return { ...result, target: path.join(xdg, "markdown-pdf-export", "settings.json"), cwd };
}

function download(name, content) {
  const file = path.join(root, `${name}.json`);
  fs.writeFileSync(file, content);
  return file;
}

test("installs the file as the user settings, text unchanged", () => {
  const text = '{\n  "look": "report",\n  "font": "serif"\n}\n';
  const r = init(["--from", download("ok", text)], "ok");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(r.target, "utf8"), text);
  assert.equal(r.stdout.trim(), r.target);
});

test("--project writes .markdown-pdf.json in the current folder", () => {
  const r = init(["--from", download("proj", '{"look":"compact"}'), "--project"], "proj");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(r.cwd, ".markdown-pdf.json")));
  assert.ok(!fs.existsSync(r.target));
});

test("strips a byte order mark", () => {
  const r = init(["--from", download("bom", '﻿{"look":"clean"}')], "bom");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(r.target, "utf8").charCodeAt(0), "{".charCodeAt(0));
});

test("refuses invalid JSON and writes nothing", () => {
  const r = init(["--from", download("bad", "{ nope")], "bad");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not valid JSON/);
  assert.ok(!fs.existsSync(r.target));
});

test("refuses a missing file and a non-object", () => {
  assert.equal(init(["--from", path.join(root, "missing.json")], "missing").status, 2);
  const r = init(["--from", download("arr", "[1]")], "arr");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /JSON object/);
});

test("warns about an unknown preset but still installs", () => {
  const r = init(["--from", download("warn", '{"look":"fancy"}')], "warn");
  assert.equal(r.status, 0);
  assert.match(r.stderr, /fancy/);
  assert.ok(fs.existsSync(r.target));
});

test("does not overwrite without --force, keeps a .bak with it", () => {
  const first = init(["--from", download("a", '{"look":"report"}')], "force");
  assert.equal(first.status, 0, first.stderr);
  const second = init(["--from", download("b", '{"look":"compact"}')], "force");
  assert.equal(second.status, 1);
  assert.match(fs.readFileSync(first.target, "utf8"), /report/);
  const third = init(["--from", download("b", '{"look":"compact"}'), "--force"], "force");
  assert.equal(third.status, 0, third.stderr);
  assert.match(fs.readFileSync(first.target, "utf8"), /compact/);
  assert.match(fs.readFileSync(`${first.target}.bak`, "utf8"), /report/);
});

test("tells where to put a missing logo, and stays quiet once it exists", () => {
  const text = JSON.stringify({ header: { left_image: "assets/logo.png" } });
  const r = init(["--from", download("logo", text)], "logo");
  assert.equal(r.status, 0, r.stderr);
  const expected = path.join(path.dirname(r.target), "assets", "logo.png");
  assert.ok(r.stderr.includes(`Put your logo at ${expected}`), r.stderr);

  fs.mkdirSync(path.dirname(expected), { recursive: true });
  fs.writeFileSync(expected, "x");
  const again = init(["--from", download("logo", text), "--force"], "logo");
  assert.ok(!again.stderr.includes("Put your logo"), again.stderr);
});

test("--from cannot be mixed with --look", () => {
  const r = init(["--from", download("mix", "{}"), "--look", "report"], "mix");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot be combined/);
});
