/**
 * @fileoverview Raw HTML filter (safe mode). The end-to-end proof that nothing
 * runs in the browser is test-fixtures/test-sanitize.mjs.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import MarkdownIt from "markdown-it";
import katex from "@vscode/markdown-it-katex";

import {
  cssForStyleElement,
  dangerousScheme,
  sanitizeHtmlFragment,
  sanitizeRawHtml,
} from "../html-sanitizer.mjs";
import { pageBreakComments } from "../page-breaks.mjs";

function render(markdown, { safe = true } = {}) {
  const md = new MarkdownIt({ html: true }).use(pageBreakComments);
  if (safe) md.use(sanitizeRawHtml);
  const env = {};
  const html = md.render(markdown, env);
  return { html, removed: [...(env.removedHtml ?? [])] };
}

describe("sanitizeHtmlFragment", () => {
  const clean = (html) => {
    const removed = new Set();
    return { html: sanitizeHtmlFragment(html, removed), removed: [...removed] };
  };

  for (const tag of ["script", "iframe", "object", "applet", "frameset", "noembed", "noframes"]) {
    it(`removes <${tag}> with its content`, () => {
      const out = clean(`<div>a<${tag.toUpperCase()} x="1">secret</${tag} >b</div>`);
      assert.equal(out.html, "<div>ab</div>");
      assert.deepEqual(out.removed, [`<${tag}>`]);
    });
  }

  for (const tag of ["embed", "frame", "meta", "base", "link", "form", "title", "textarea", "xmp", "plaintext"]) {
    it(`escapes <${tag}>`, () => {
      const out = clean(`<${tag} a="b">x</${tag}>`);
      assert.equal(out.html, `&lt;${tag} a="b">x&lt;/${tag}>`);
    });
  }

  it("escapes an unclosed <script> and one hidden in an attribute or comment", () => {
    assert.equal(clean("<script>alert(1)").html, "&lt;script>alert(1)");
    assert.equal(clean('<a title="<script>">').html, '<a title="&lt;script>">');
    assert.equal(clean("<!-- <iframe src=x> -->").html, "<!-- &lt;iframe src=x> -->");
    assert.equal(clean("<script/src=x>").html, "&lt;script/src=x>");
  });

  it("leaves look-alike tag names alone", () => {
    assert.equal(clean("<scripts><metadata><baseline>").html, "<scripts><metadata><baseline>");
  });

  it("disarms event handlers and srcdoc", () => {
    assert.equal(clean("<img src=x onerror=alert(1)>").html, "<img src=x data-removed-onerror=alert(1)>");
    assert.equal(clean('<svg/onload="x">').html, '<svg/data-removed-onload="x">');
    assert.equal(clean('<b class="a"onclick="x">').html, '<b class="a"data-removed-onclick="x">');
    assert.equal(clean("<p ONMOUSEOVER = x>").html, "<p data-removed-ONMOUSEOVER = x>");
    assert.deepEqual(clean("<p ONMOUSEOVER = x>").removed, ["onmouseover"]);
  });

  it("replaces javascript:, vbscript: and data: URLs", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "jav&#x09;ascript:alert(1)",
      "jav&#9;ascript:alert(1)",
      "&#106;avascript:alert(1)",
      "javascript&colon;alert(1)",
      "vbscript:msgbox",
      "data:text/html,<b>",
    ]) {
      const out = clean(`<a href="${href}">x</a>`);
      assert.equal(out.html, '<a href="#">x</a>', href);
    }
    assert.equal(clean("<form action=javascript:x>").html, '&lt;form action="#">');
  });

  it("keeps normal links and data:image", () => {
    for (const html of [
      '<a href="https://example.com">x</a>',
      '<a href="#intro">x</a>',
      '<img src="logo.svg">',
      '<img src="data:image/png;base64,AAAA">',
    ]) {
      assert.equal(clean(html).html, html);
    }
  });

  it("keeps <style> and inline styles", () => {
    const html = '<style>h1{color:red}</style><div style="page-break-after: always"></div>';
    assert.equal(clean(html).html, html);
  });
});

describe("dangerousScheme", () => {
  it("names the scheme or returns null", () => {
    assert.equal(dangerousScheme('"javascript:x"'), "javascript");
    assert.equal(dangerousScheme("'data:text/html,x'"), "data");
    assert.equal(dangerousScheme("data:image/svg+xml,x"), null);
    assert.equal(dangerousScheme("https://x"), null);
  });
});

describe("sanitizeRawHtml plugin", () => {
  it("removes block HTML and reports it", () => {
    const { html, removed } = render("Hello\n\n<script>\nalert(1)\n</script>\n\nWorld\n");
    assert.equal(html, "<p>Hello</p>\n\n<p>World</p>\n");
    assert.deepEqual(removed, ["<script>"]);
  });

  it("removes an inline <script> pair together with the text between", () => {
    const { html } = render("Hi <script>alert(1)</script> there");
    assert.equal(html, "<p>Hi  there</p>\n");
  });

  it("escapes an inline opening tag without its closing tag", () => {
    const { html } = render("Hi <iframe src=x> there");
    assert.equal(html, "<p>Hi &lt;iframe src=x> there</p>\n");
  });

  it("never touches code", () => {
    const md = "```html\n<script>keep()</script>\n<b onclick=\"x\">\n```\n\n`<iframe>` and `onclick=x`\n";
    assert.equal(render(md).html, render(md, { safe: false }).html);
  });

  it("keeps page break markers working", () => {
    const { html } = render('a\n\n<!-- page-break -->\n\nb\n\n<div class="page"></div>\n');
    assert.match(html, /<div class="page-break"><\/div>/);
    assert.match(html, /<div class="page"><\/div>/);
  });

  it("does not touch generated KaTeX markup", () => {
    const md = new MarkdownIt({ html: true }).use(katex.default ?? katex).use(sanitizeRawHtml);
    const plain = new MarkdownIt({ html: true }).use(katex.default ?? katex);
    assert.equal(md.render("$x^2$ and $$\\frac{a}{b}$$"), plain.render("$x^2$ and $$\\frac{a}{b}$$"));
  });

  it("passes everything through when not installed (sanitize: none)", () => {
    assert.match(render("<script>x</script>", { safe: false }).html, /<script>x<\/script>/);
  });
});

describe("cssForStyleElement", () => {
  it("cannot close the <style> element", () => {
    const out = cssForStyleElement("x}</style><script>alert(1)</script><STYLE>");
    assert.ok(!/<\/style/i.test(out));
    assert.equal(cssForStyleElement("Georgia, serif"), "Georgia, serif");
  });
});
