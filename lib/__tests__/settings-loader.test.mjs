/**
 * @fileoverview Unit tests for settings-loader.mjs and the shipped templates.
 *
 * Run with: node --test lib/__tests__/settings-loader.test.mjs
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROJECT_SETTINGS_FILENAME,
  deepMerge,
  findProjectSettingsFile,
  readSettingsFile,
  resolveSettingsPaths,
  userSettingsPath,
} from "../settings-loader.mjs";
import { validateStructuredConfig } from "../schema-validator.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("userSettingsPath", () => {
  const home = path.resolve("/home/u");

  it("uses ~/.config on POSIX by default", () => {
    assert.equal(
      userSettingsPath({}, "linux", home),
      path.join(home, ".config", "markdown-pdf-export", "settings.json"),
    );
  });

  it("honours XDG_CONFIG_HOME", () => {
    const xdg = path.resolve("/xdg");
    assert.equal(
      userSettingsPath({ XDG_CONFIG_HOME: xdg }, "darwin", home),
      path.join(xdg, "markdown-pdf-export", "settings.json"),
    );
  });

  it("uses APPDATA on Windows", () => {
    const appData = path.resolve("/appdata");
    assert.equal(
      userSettingsPath({ APPDATA: appData }, "win32", home),
      path.join(appData, "markdown-pdf-export", "settings.json"),
    );
  });
});

describe("findProjectSettingsFile / readSettingsFile", () => {
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-settings-"));
    fs.mkdirSync(path.join(tmp, "a", "b"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "a", PROJECT_SETTINGS_FILENAME),
      JSON.stringify({
        stylesheet_path: "style.css",
        assets_directory: "assets",
        header: {
          left_image: "logo.svg",
          right_image: "@/partner.svg",
          center: [{ type: "image", src: "img/c.png" }],
        },
        footer: { center_image: "~/f.png" },
      }),
    );
    fs.writeFileSync(path.join(tmp, "bad.json"), "{ nope");
  });
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("finds the nearest file walking up", () => {
    assert.equal(
      findProjectSettingsFile(path.join(tmp, "a", "b")),
      path.join(tmp, "a", PROJECT_SETTINGS_FILENAME),
    );
  });

  it("returns null when there is none", () => {
    // tmp itself has no project file; its ancestors (os.tmpdir) normally neither.
    const found = findProjectSettingsFile(tmp);
    assert.ok(found === null || !found.startsWith(tmp));
  });

  it("resolves relative paths against the settings file directory", () => {
    const dir = path.join(tmp, "a");
    const { data, error } = readSettingsFile(path.join(dir, PROJECT_SETTINGS_FILENAME));
    assert.equal(error, null);
    assert.equal(data.stylesheet_path, path.join(dir, "style.css"));
    assert.equal(data.assets_directory, path.join(dir, "assets"));
    assert.equal(data.header.left_image, path.join(dir, "logo.svg"));
    assert.equal(data.header.right_image, "@/partner.svg");
    assert.equal(data.header.center[0].src, path.join(dir, "img", "c.png"));
    assert.equal(data.footer.center_image, "~/f.png");
  });

  it("accepts a UTF-8 BOM (PowerShell 5 output)", () => {
    const file = path.join(tmp, "bom.json");
    fs.writeFileSync(file, '\uFEFF{"page_format":"Letter"}');
    assert.deepEqual(readSettingsFile(file).data, { page_format: "Letter" });
  });

  it("reports parse errors without throwing", () => {
    const result = readSettingsFile(path.join(tmp, "bad.json"));
    assert.equal(result.data, null);
    assert.match(result.error, /invalid JSON/);
  });

  it("reports missing files without throwing", () => {
    const result = readSettingsFile(path.join(tmp, "missing.json"));
    assert.equal(result.data, null);
    assert.match(result.error, /cannot read/);
  });
});

describe("resolveSettingsPaths", () => {
  it("leaves absolute paths and URLs alone and does not mutate input", () => {
    const abs = path.resolve("/abs/x.css");
    const input = { stylesheet_path: abs, header: { left_image: "https://x/y.png" } };
    const out = resolveSettingsPaths(input, path.resolve("/dir"));
    assert.equal(out.stylesheet_path, abs);
    assert.equal(out.header.left_image, "https://x/y.png");
    assert.notEqual(out, input);
  });
});

describe("deepMerge", () => {
  it("merges nested objects, replaces arrays and scalars", () => {
    const base = { margin: { top: "1mm", bottom: "2mm" }, header: { left_text: "a" }, toc_options: { level: [1, 2] } };
    const over = { margin: { top: "9mm" }, header: { right_text: "b" }, toc_options: { level: [3] } };
    assert.deepEqual(deepMerge(base, over), {
      margin: { top: "9mm", bottom: "2mm" },
      header: { left_text: "a", right_text: "b" },
      toc_options: { level: [3] },
    });
    assert.deepEqual(base.margin, { top: "1mm", bottom: "2mm" });
  });
});

describe("shipped templates", () => {
  const dir = path.join(ROOT, "templates");
  const names = fs.readdirSync(dir).filter((n) => n.endsWith(".json"));

  it("ships the expected templates", () => {
    for (const name of ["minimal", "simple", "corporate", "academic", "two-logo"]) {
      assert.ok(names.includes(`${name}.json`), `missing template ${name}`);
    }
  });

  for (const name of names) {
    it(`${name} is valid JSON with a valid header/footer`, () => {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      assert.equal(typeof data.$schema, "string");
      const result = validateStructuredConfig(data);
      assert.equal(result.valid, true, JSON.stringify(result.errors));
    });
  }
});
