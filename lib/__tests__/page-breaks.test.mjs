import test from "node:test";
import assert from "node:assert/strict";
import MarkdownIt from "markdown-it";

import { PAGE_BREAK_CLASSES, PAGE_BREAK_CSS, pageBreakComments } from "../page-breaks.mjs";

const md = new MarkdownIt({ html: true }).use(pageBreakComments);

test("css covers every class", () => {
  for (const c of PAGE_BREAK_CLASSES) assert.ok(PAGE_BREAK_CSS.includes(`.${c}`), c);
  assert.match(PAGE_BREAK_CSS, /\.page-break-before\{break-before:page/);
});

test("html comments become a page break", () => {
  for (const c of ["page-break", "pagebreak", "page_break", "new-page", "newpage", "page", "PAGE BREAK", "  newpage  "]) {
    const html = md.render(`one\n\n<!-- ${c} -->\n\ntwo`);
    assert.match(html, /<div class="page-break"><\/div>/, c);
    assert.doesNotMatch(html, /<!--/, c);
  }
});

test("inline comment becomes a page break", () => {
  assert.match(md.render("one <!-- page-break --> two"), /<span class="page-break"><\/span>/);
});

test("other comments and code blocks are untouched", () => {
  assert.match(md.render("<!-- note to self -->"), /<!-- note to self -->/);
  assert.doesNotMatch(md.render("```html\n<!-- page-break -->\n```"), /class="page-break"/);
  assert.doesNotMatch(md.render("`<!-- page-break -->`"), /class="page-break"/);
});
