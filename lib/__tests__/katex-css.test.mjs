import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { inlineKatexFonts } from "../katex-css.mjs";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(path.join(path.dirname(require.resolve("katex/package.json")), "dist", "katex.min.css"), "utf8");
const fake = async (file) => `data:font/woff2;base64,${Buffer.from(file).toString("base64")}`;

/** The `@font-face { ... }` blocks of a stylesheet. */
const fontFaces = (css) => css.match(/@font-face\{[^}]*\}/g) ?? [];

test("every KaTeX font face keeps its own rule, with one woff2 data URI", async () => {
  const out = await inlineKatexFonts(source, fake);
  const before = fontFaces(source);
  const after = fontFaces(out);
  assert.ok(before.length >= 10, `katex.min.css has ${before.length} font faces`);
  assert.equal(after.length, before.length);
  for (const [i, rule] of after.entries()) {
    assert.equal(rule.match(/font-family:/g)?.length, 1, rule.slice(0, 80));
    assert.equal(rule.match(/src:/g)?.length, 1, rule.slice(0, 80));
    assert.match(rule, /src:url\(data:font\/woff2;base64,[^)]+\) format\("woff2"\)\}$/);
    // the same family, style and weight as the source rule
    assert.equal(rule.replace(/src:[^}]*/, ""), before[i].replace(/src:[^}]*/, ""));
  }
  assert.doesNotMatch(out, /fonts\//);
});

test("the rest of the stylesheet is unchanged", async () => {
  const out = await inlineKatexFonts(source, fake);
  const strip = (css) => css.replace(/@font-face\{[^}]*\}/g, "");
  assert.equal(strip(out), strip(source));
});

test("a src that ends a rule keeps its closing brace (regression: all rules merged into one)", async () => {
  const css =
    '@font-face{font-family:A;src:url(fonts/A.woff2) format("woff2"),url(fonts/A.woff) format("woff")}' +
    '@font-face{font-family:B;src:url(fonts/B.woff2) format("woff2");font-weight:700}.katex{color:red}';
  const out = await inlineKatexFonts(css, async (f) => `data:${f}`);
  assert.equal(
    out,
    '@font-face{font-family:A;src:url(data:A.woff2) format("woff2")}' +
      '@font-face{font-family:B;src:url(data:B.woff2) format("woff2");font-weight:700}.katex{color:red}',
  );
});
