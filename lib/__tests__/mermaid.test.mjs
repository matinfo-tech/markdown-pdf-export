/**
 * Mermaid fences: placeholders, substitution, fallback to a code block, and
 * the mermaid setting. Drawing itself needs a browser and is covered by
 * test-fixtures/test-export.mjs.
 *
 * Run with: node --test lib/__tests__/mermaid.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import MarkdownIt from "markdown-it";

import { DEFAULT_SETTINGS, normalizeSettings } from "../../export.mjs";
import { sanitizeRawHtml } from "../html-sanitizer.mjs";
import { insertDiagrams, mermaidFences } from "../mermaid.mjs";

const DOC = "Intro\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\n```js\nlet x = 1;\n```\n";

function render(src, env = { mermaid: [] }) {
  const md = new MarkdownIt({ html: true }).use(sanitizeRawHtml).use(mermaidFences);
  return { html: md.render(src, env), env };
}

describe("mermaid setting", () => {
  it("is on by default and can be turned off", () => {
    assert.equal(DEFAULT_SETTINGS.mermaid, true);
    assert.equal(normalizeSettings({}).mermaid, true);
    assert.equal(normalizeSettings({ mermaid: false }).mermaid, false);
  });
});

describe("mermaidFences", () => {
  it("collects mermaid sources and leaves other fences alone", () => {
    const { html, env } = render(DOC);
    assert.equal(env.mermaid.length, 1);
    assert.equal(env.mermaid[0].source, "flowchart LR\n  A --> B\n");
    assert.match(env.mermaid[0].fallback, /<pre><code class="language-mermaid">flowchart LR/);
    assert.match(html, new RegExp(`<!--mermaid:${env.mermaidNonce}:0-->`));
    assert.match(html, /<code class="language-js">let x = 1;/);
  });

  it("renders a normal code block when diagrams are not collected", () => {
    const { html } = render(DOC, {});
    assert.match(html, /<code class="language-mermaid">/);
    assert.doesNotMatch(html, /<!--mermaid:/);
  });

  it("uses a new nonce for each render", () => {
    assert.notEqual(render(DOC).env.mermaidNonce, render(DOC).env.mermaidNonce);
  });
});

describe("insertDiagrams", () => {
  it("puts each SVG in a figure", () => {
    const { html, env } = render(DOC);
    const out = insertDiagrams(html, env, [{ svg: "<svg>ok</svg>" }]);
    assert.match(out.html, /<figure class="mermaid"><svg>ok<\/svg><\/figure>/);
    assert.doesNotMatch(out.html, /<!--mermaid:/);
    assert.deepEqual(out.errors, []);
  });

  it("falls back to the code block and reports a failed diagram", () => {
    const { html, env } = render(DOC);
    const out = insertDiagrams(html, env, [{ error: "Parse error on line 2" }]);
    assert.match(out.html, /<code class="language-mermaid">flowchart LR/);
    assert.deepEqual(out.errors, ["Diagram 1: Parse error on line 2"]);
  });

  it("falls back silently when nothing was drawn", () => {
    const { html, env } = render(DOC);
    const out = insertDiagrams(html, env, null);
    assert.match(out.html, /<code class="language-mermaid">/);
    assert.deepEqual(out.errors, []);
  });

  it("ignores a placeholder written by the document", () => {
    const src = "<!--mermaid:0000000000000000:0-->\n\n" + DOC;
    const { html, env } = render(src);
    const out = insertDiagrams(html, env, [{ svg: "<svg>ok</svg>" }]);
    assert.equal(out.html.match(/<figure class="mermaid">/g).length, 1);
    assert.match(out.html, /<!--mermaid:0000000000000000:0-->/);
  });

  it("escapes HTML in the source of a fallback code block", () => {
    const { html, env } = render("```mermaid\nA[<script>alert(1)</script>]\n```\n");
    const out = insertDiagrams(html, env, [{ error: "bad" }]);
    assert.doesNotMatch(out.html, /<script/);
    assert.match(out.html, /&lt;script&gt;/);
  });
});
