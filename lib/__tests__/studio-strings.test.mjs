/**
 * @fileoverview studio/strings.json lists every text Studio shows, for an editor that shows Studio
 * in another language. It is generated from the code and must be committed up to date.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { TARGET, buildStudioStrings, pageStrings, scriptStrings } from "../../scripts/build-studio-strings.mjs";
import { LAYOUTS, layoutsIn, matchLayout, emptyDraft } from "../../studio/model.mjs";

const strings = JSON.parse(buildStudioStrings());

test("studio/strings.json is up to date", () => {
  const current = fs.readFileSync(TARGET, "utf8").replaceAll("\r\n", "\n");
  assert.equal(current, buildStudioStrings(), "run: npm run build:studio-strings");
});

test("it holds the texts of the page, the script, the model and the server's lists", () => {
  for (const text of [
    "Design your pages", // index.html
    "Help: page styles", // aria-label
    "{0}: a {1} block at the top of a Markdown file changes only that document.", // data-say
    "This is the real PDF of {0}, drawn in {1} s.", // app.mjs
    "Page {page} of {pages}", // model.mjs, written into a footer
    "Serif headings, strong title rule. Business reports.", // lib/looks.mjs
    "GitHub light",
  ]) {
    assert.ok(strings.includes(text), text);
  }
  assert.ok(!strings.includes("pdf:"), "code is not translated");
  assert.ok(!strings.includes("Do this once per editor. After that, exporting a Markdown file uses the layout you saved here."), "the editors dialog is left out");
});

test("a sentence around a link and code is one text, its elements numbered", () => {
  const html = '<ul><li data-say><a href="x">Link</a>: a <code>pdf:</code> block\n    here.</li></ul><p title="Tip">Hi <b>there</b></p>';
  assert.deepEqual(pageStrings(html).sort(), ["{0}: a {1} block here.", "Link", "Tip", "Hi", "there"].sort());
  assert.deepEqual(scriptStrings('say("A {0}", x); toTranslate("B"); mysay("C"); say(variable)'), ["A {0}", "B"]);
});

test("the starting layouts in another language keep their ids, and both forms are recognised", () => {
  const french = { "Page {page} of {pages}": "Page {page} sur {pages}", "Title and date": "Titre et date" };
  const local = layoutsIn((english) => french[english] ?? english);
  assert.deepEqual(local.map((l) => l.id), LAYOUTS.map((l) => l.id));
  const titled = local.find((l) => l.id === "titled");
  assert.equal(titled.label, "Titre et date");
  assert.equal(titled.footer().center.text, "Page {page} sur {pages}");
  assert.equal(titled.header().left.text, "{title}");
  assert.equal(LAYOUTS.find((l) => l.id === "titled").footer().center.text, "Page {page} of {pages}", "the English layouts are unchanged");

  const draft = emptyDraft();
  draft.header = titled.header();
  draft.footer = titled.footer();
  assert.equal(matchLayout(draft, local), "titled");
  assert.equal(matchLayout(draft), null, "the English layouts do not match the French text");
  const english = LAYOUTS.find((l) => l.id === "titled");
  draft.footer = english.footer();
  assert.equal(matchLayout(draft, local) ?? matchLayout(draft), "titled", "a file saved in English is still recognised");
});
