#!/usr/bin/env node
/**
 * End-to-end check of the raw HTML filter: a hostile document must not run
 * scripts or load frames while it is printed.
 *
 * A local HTTP server counts requests. Every probe in the document asks it
 * for a distinct path, so the paths that arrive show what ran or loaded:
 *
 *   - default (safe) mode: only the plain <img> probe arrives;
 *   - "sanitize": "none" passed by an MCP call: ignored, still safe;
 *   - trusted { sanitize: "none" } (CLI --sanitize none): the script probe
 *     arrives, which proves the test can see execution at all.
 *
 * Needs a browser (same as test-export.mjs). Usage: node test-fixtures/test-sanitize.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { exportMarkdownPdf, setProjectDiscovery, setSettings } from "../export.mjs";

const hits = new Set();
const server = http.createServer((req, res) => {
  hits.add(new URL(req.url, "http://x").pathname.slice(1));
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const U = `http://127.0.0.1:${server.address().port}`;
const ping = (name) => `new Image().src='${U}/${name}'`;

const doc = `---
title: Hostile document
pdf:
  sanitize: none
  font_family: "x}</style><script>${ping("font-family")}</script><style>"
---
# Hostile document

<script>${ping("script")}</script>

Inline <script>${ping("inline-script")}</script> script.

<img src="missing.png" onerror="${ping("onerror")}">

<svg><script>${ping("svg-script")}</script></svg>

<iframe src="${U}/iframe"></iframe>

<object data="${U}/object"></object>

<embed src="${U}/embed">

<link rel="stylesheet" href="${U}/link">

<meta http-equiv="refresh" content="0;url=${U}/meta">

<a href="javascript:${ping("javascript-url")}">link</a>

<img src="${U}/allowed-img" alt="">

<style>h1 { color: rgb(200, 0, 0); }</style>

<div class="page"></div>

The end.
`;

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "markdown-pdf-sanitize-"));
const input = path.join(dir, "hostile.md");
await fs.writeFile(input, doc, "utf8");

setSettings({});
setProjectDiscovery(false);

async function run(label, args, trusted) {
  hits.clear();
  const result = await exportMarkdownPdf({ input_path: input, output_path: path.join(dir, `${label}.pdf`), ...args }, trusted);
  // With raw HTML kept, <meta refresh> navigates away and an empty page is
  // printed: that is the legacy danger, so only the safe runs check content.
  if (result.sanitize === "safe") {
    const size = (await fs.stat(result.output_path)).size;
    assert.ok(size > 1000, `${label}: PDF is too small (${size} bytes)`);
  }
  return { result, hits: [...hits].sort() };
}

let failed = false;
async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}\n  ${error instanceof Error ? error.message : error}`);
  }
}

try {
  await check("safe by default: nothing runs or loads except the plain image", async () => {
    const { result, hits: seen } = await run("safe", {});
    assert.deepEqual(seen, ["allowed-img"]);
    assert.equal(result.sanitize, "safe");
    for (const tag of ["<script>", "<iframe>", "<object>", "<embed>", "<link>", "<meta>", "onerror"]) {
      assert.ok(result.removed_html.includes(tag), `removed_html lacks ${tag}: ${result.removed_html}`);
    }
  });

  await check("an MCP argument cannot switch the filter off", async () => {
    const { result, hits: seen } = await run("mcp-none", { sanitize: "none" });
    assert.deepEqual(seen, ["allowed-img"]);
    assert.equal(result.sanitize, "safe");
  });

  await check("trusted sanitize none (CLI) keeps raw HTML: the test sees scripts run", async () => {
    const { result, hits: seen } = await run("trusted-none", {}, { sanitize: "none" });
    assert.equal(result.sanitize, "none");
    assert.deepEqual(result.removed_html, []);
    assert.ok(seen.includes("script"), `script probe did not arrive: ${seen}`);
    // The font_family value can never close the <style> element, in any mode.
    assert.ok(!seen.includes("font-family"), "font_family broke out of <style>");
  });
} finally {
  server.close();
  await fs.rm(dir, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : 0;
