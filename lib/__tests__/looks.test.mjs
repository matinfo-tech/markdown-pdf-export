import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LOOKS, FONTS, TEMPLATES, looksDir, applyPresets, readTemplate } from "../looks.mjs";
import { HIGHLIGHT_STYLES } from "../../export.mjs";

test("every look has its css file and a valid highlight theme", () => {
  for (const [name, def] of Object.entries(LOOKS)) {
    if (def.settings.stylesheet) {
      assert.ok(fs.existsSync(path.join(looksDir(), def.settings.stylesheet)), name);
    }
    if (def.settings.highlight_style) {
      assert.ok(HIGHLIGHT_STYLES.has(def.settings.highlight_style), name);
    }
  }
});

test("every template loads", () => {
  for (const t of TEMPLATES) assert.ok(readTemplate(t), t);
});

test("presets expand; explicit keys win", () => {
  const { data, warnings } = applyPresets({
    look: "academic",
    font: "serif",
    template: "simple",
    margin: { top: "40mm" },
  });
  assert.deepEqual(warnings, []);
  assert.equal(data.margin.top, "40mm");
  assert.equal(data.margin.left, "25mm");
  assert.equal(data.font_family, FONTS.serif);
  assert.ok(path.isAbsolute(data.stylesheet_path));
  assert.equal(data.header.left_text, "{title}");
  assert.equal(data.look, undefined);
});

test("unknown names warn and are ignored", () => {
  const { data, warnings } = applyPresets({ look: "nope", font: "x" });
  assert.equal(warnings.length, 2);
  assert.equal(data.stylesheet_path, undefined);
});

test("data without presets is returned untouched", () => {
  const input = { page_format: "A4" };
  assert.equal(applyPresets(input).data, input);
});
