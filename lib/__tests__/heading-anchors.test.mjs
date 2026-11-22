/**
 * Heading anchors are on by default, can be turned off, and the raw HTML
 * filter leaves them (and hand-written anchors) alone.
 *
 * Run with: node --test lib/__tests__/heading-anchors.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";

import { DEFAULT_SETTINGS, normalizeSettings } from "../../export.mjs";
import { sanitizeRawHtml } from "../html-sanitizer.mjs";

function ghSlugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^\w\sÀ-￿-]/g, "")
    .replace(/\s+/g, "-");
}

function render(md, env = {}) {
  const it = new MarkdownIt({ html: true })
    .use(anchor, { permalink: false, slugify: ghSlugify })
    .use(sanitizeRawHtml);
  return it.render(md, env);
}

describe("heading_anchors setting", () => {
  it("is on by default", () => {
    assert.equal(DEFAULT_SETTINGS.heading_anchors, true);
    assert.equal(normalizeSettings({}).heading_anchors, true);
  });

  it("can be turned off", () => {
    assert.equal(normalizeSettings({ heading_anchors: false }).heading_anchors, false);
  });
});

describe("heading ids", () => {
  it("slugs the heading text", () => {
    assert.match(render("## Q3: Next steps\n"), /<h2 id="q3-next-steps"[ >]/);
  });

  it("numbers repeated headings", () => {
    const html = render("# Notes\n\n# Notes\n\n# Notes\n");
    assert.match(html, /id="notes"/);
    assert.match(html, /id="notes-1"/);
    assert.match(html, /id="notes-2"/);
  });

  it("cannot break out of the id attribute", () => {
    const html = render('## x" onload="y <b> z\n');
    const id = /<h2 id="([^"]*)"/.exec(html)?.[1];
    assert.ok(id !== undefined, html);
    assert.ok(!/["<>]/.test(id), `unsafe id: ${id}`);
    assert.ok(!/<h2[^>]*\sonload=/.test(html), html);
  });
});

describe("raw HTML filter and anchors", () => {
  it("keeps hand-written anchors and #links", () => {
    const env = {};
    const html = render('<a id="top"></a>\n\n<a href="#top">up</a>\n', env);
    assert.match(html, /<a id="top"><\/a>/);
    assert.match(html, /<a href="#top">up<\/a>/);
    assert.deepEqual([...(env.removedHtml ?? [])], []);
  });
});
