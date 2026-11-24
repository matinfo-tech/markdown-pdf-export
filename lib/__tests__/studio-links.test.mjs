import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_URL } from "../types.mjs";

// Studio's help links point at the documentation site built from docs/. A renamed page or heading
// must not leave a link to nowhere.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** Every documentation link in Studio's page and script. */
const links = [...`${read("studio/index.html")}\n${read("studio/app.mjs")}`.matchAll(/https:\/\/markdown-pdf\.matinfo\.tech\/[^"'`\s<>]*/g)].map(
  (m) => m[0],
);

/** VitePress's heading anchors: lower case, punctuation dropped, spaces to dashes. */
const slug = (heading) =>
  heading
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

/** The Markdown file behind a site URL (clean URLs; a folder is its index.md). */
function pageFile(url) {
  const route = new URL(url).pathname.replace(/^\//, "");
  return path.join("docs", route === "" || route.endsWith("/") ? `${route}index.md` : `${route}.md`);
}

test("Studio has documentation links", () => {
  assert.ok(links.length >= 6, `found ${links.length}`);
  assert.ok(links.every((url) => url.startsWith(DOCS_URL)));
});

test("every Studio documentation link names an existing page and heading", () => {
  for (const url of links) {
    const file = pageFile(url);
    assert.ok(fs.existsSync(path.join(root, file)), `${url}: no ${file}`);
    const hash = new URL(url).hash.slice(1);
    if (!hash) continue;
    const anchors = [...read(file).matchAll(/^#{2,4} (.+)$/gm)].map((m) => slug(m[1]));
    assert.ok(anchors.includes(hash), `${url}: no heading "${hash}" in ${file}`);
  }
});

test("Studio's documentation links open in a new tab without a referrer", () => {
  const html = read("studio/index.html");
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  assert.ok(anchors.length > 0);
  for (const tag of anchors) {
    assert.match(tag, /target="_blank"/, tag);
    assert.match(tag, /rel="noopener noreferrer"/, tag);
  }
});
