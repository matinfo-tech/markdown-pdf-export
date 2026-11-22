/**
 * Always-on GitHub syntax: footnotes, task lists and alerts, rendered with
 * the same plugin order as createMarkdown(), raw HTML filter included.
 *
 * Run with: node --test lib/__tests__/gfm-extras.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";

import { sanitizeRawHtml } from "../html-sanitizer.mjs";
import { githubAlerts } from "../alerts.mjs";

function render(src, { sanitize = true } = {}) {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  if (sanitize) md.use(sanitizeRawHtml);
  md.use(footnote).use(taskLists).use(githubAlerts);
  return md.render(src, {});
}

describe("task lists", () => {
  it("renders disabled checkboxes, checked and unchecked", () => {
    const html = render("- [x] done\n- [ ] todo\n");
    assert.match(html, /<ul class="contains-task-list">/);
    assert.match(html, /<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox"> done/);
    assert.match(html, /<input class="task-list-item-checkbox" disabled="" type="checkbox"> todo/);
  });

  it("leaves ordinary lists alone", () => {
    const html = render("- [link](x)\n- plain\n");
    assert.doesNotMatch(html, /checkbox/);
  });
});

describe("footnotes", () => {
  it("links the reference to the note and back", () => {
    const html = render("Text[^a].\n\n[^a]: The note.\n");
    assert.match(html, /<sup class="footnote-ref"><a href="#fn1" id="fnref1">\[1\]<\/a><\/sup>/);
    assert.match(html, /<section class="footnotes">/);
    assert.match(html, /<li id="fn1" class="footnote-item"><p>The note\./);
    assert.match(html, /href="#fnref1" class="footnote-backref"/);
  });

  it("filters raw HTML inside a footnote", () => {
    const html = render(
      'Text[^a].\n\n[^a]: Hi <script>alert(1)</script> <img src="x" onerror="alert(1)">\n',
    );
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /\sonerror=/i);
  });
});

describe("GitHub alerts", () => {
  for (const [marker, title] of [
    ["NOTE", "Note"],
    ["TIP", "Tip"],
    ["IMPORTANT", "Important"],
    ["WARNING", "Warning"],
    ["CAUTION", "Caution"],
  ]) {
    it(`renders [!${marker}]`, () => {
      const html = render(`> [!${marker}]\n> Body *text*.\n`);
      const type = marker.toLowerCase();
      assert.match(html, new RegExp(`<div class="markdown-alert markdown-alert-${type}">`));
      assert.match(html, new RegExp(`<p class="markdown-alert-title">${title}</p>`));
      assert.match(html, /<p>Body <em>text<\/em>\.<\/p>/);
      assert.doesNotMatch(html, /\[!/);
      assert.doesNotMatch(html, /blockquote/);
    });
  }

  it("accepts a lower-case marker", () => {
    assert.match(render("> [!note]\n> Body\n"), /markdown-alert-note/);
  });

  it("drops the empty paragraph when the marker stands alone", () => {
    const html = render("> [!TIP]\n>\n> Body\n");
    assert.doesNotMatch(html, /<p><\/p>/);
    assert.match(html, /<p>Body<\/p>/);
  });

  it("keeps a plain blockquote when there is no marker", () => {
    const html = render("> Just a quote\n");
    assert.match(html, /<blockquote>/);
    assert.doesNotMatch(html, /markdown-alert/);
  });

  it("ignores unknown markers and text after the marker, like GitHub", () => {
    assert.doesNotMatch(render("> [!DANGER]\n> Body\n"), /markdown-alert/);
    assert.doesNotMatch(render("> [!NOTE] Custom title\n> Body\n"), /markdown-alert/);
  });

  it("never puts document text into the title", () => {
    const html = render('> [!NOTE] <img src=x onerror="alert(1)">\n> Body\n');
    assert.doesNotMatch(html, /markdown-alert-title">[^<]*</);
    assert.doesNotMatch(html, /\sonerror=/i);
  });

  it("keeps a nested blockquote inside the alert", () => {
    const html = render("> [!NOTE]\n> Intro\n>\n> > Quoted\n>\n> Outro\n");
    const open = html.indexOf('<div class="markdown-alert');
    const inner = html.indexOf("<blockquote>");
    const innerClose = html.indexOf("</blockquote>");
    const outro = html.indexOf("<p>Outro</p>");
    const close = html.lastIndexOf("</div>");
    assert.ok(open < inner && inner < innerClose && innerClose < outro && outro < close, html);
  });

  it("filters raw HTML inside an alert body", () => {
    const html = render("> [!WARNING]\n> <script>alert(1)</script> careful\n");
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /markdown-alert-warning/);
  });
});
