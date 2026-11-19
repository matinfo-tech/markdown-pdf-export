import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { CODE_THEMES, LOOKS, FONTS, TEMPLATES, looksDir, applyPresets, readTemplate } from "../looks.mjs";
import { HIGHLIGHT_STYLES, codeThemeBackground } from "../../export.mjs";

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

test("heading_font expands to heading_font_family", () => {
  const { data, warnings } = applyPresets({ font: "humanist", heading_font: "book" });
  assert.deepEqual(warnings, []);
  assert.equal(data.font_family, FONTS.humanist);
  assert.equal(data.heading_font_family, FONTS.book);
  assert.equal(data.heading_font, undefined);
  assert.equal(applyPresets({ heading_font: "nope" }).warnings.length, 1);
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

test("every Studio code theme exists", () => {
  for (const t of CODE_THEMES) assert.ok(HIGHLIGHT_STYLES.has(t.file), t.file);
});

test("dark and tinted code themes keep their own background", () => {
  assert.equal(codeThemeBackground(".hljs{color:#c9d1d9;background:#0d1117}"), "#0d1117");
  assert.equal(codeThemeBackground(".hljs {\n  color: #333;\n  background: #FDF6E3;\n}"), "#fdf6e3");
  assert.equal(codeThemeBackground(".hljs{background:#fff;color:#000}"), null, "white keeps the grey box");
  assert.equal(codeThemeBackground(".hljs{background:#ffffff}"), null);
  assert.equal(codeThemeBackground(".hljs{background:url(x.png)}"), null);
  assert.equal(codeThemeBackground(".hljs-keyword{color:red}"), null);
  assert.equal(
    codeThemeBackground("pre code.hljs{display:block}code.hljs{padding:3px}/* t */.hljs{color:#eee;background:#111}"),
    "#111",
    "layout rules before the colour rule are skipped",
  );
});

test("the shipped themes are read correctly", () => {
  const dir = path.join(path.dirname(createRequire(import.meta.url).resolve("highlight.js/package.json")), "styles");
  const bg = (file) => codeThemeBackground(fs.readFileSync(path.join(dir, file), "utf8"));
  assert.equal(bg("github-dark.css"), "#0d1117");
  assert.equal(bg("github.css"), null);
  for (const t of CODE_THEMES.filter((t) => /dark/i.test(t.label))) {
    assert.match(bg(t.file) ?? "", /^#[0-9a-f]{3,8}$/, t.file);
  }
});
