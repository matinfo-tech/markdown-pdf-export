/**
 * @fileoverview {author}: from the front matter, else from the settings file;
 * "author: none" in a document prints no author even when the settings set one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureYamlLoaded, extractAuthor, normalizeAuthor, parseFrontMatter, resolveAuthor } from "../frontmatter-parser.mjs";
import { normalizeSettings } from "../../export.mjs";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "cli.mjs");

const author = async (frontMatter) => {
  await ensureYamlLoaded();
  const { data } = parseFrontMatter(`---\n${frontMatter}\n---\n# Doc\n`, { filename: "doc.md" });
  return data.author;
};

test("normalizeAuthor: one name, a list, and the ways to say none", () => {
  assert.equal(normalizeAuthor(" Jane Smith "), "Jane Smith");
  assert.equal(normalizeAuthor(["Jane", " Paul ", "", null]), "Jane, Paul");
  assert.equal(normalizeAuthor(2026), "2026");
  for (const none of ["none", "None", " NONE ", "", "  ", null, undefined, [], [""], {}, true]) {
    assert.equal(normalizeAuthor(none), null, JSON.stringify(none));
  }
  assert.equal(normalizeAuthor(["none", "Jane"]), "none, Jane", "a list is names, even one called none");
});

test("front matter: absent key is null, none or empty is an explicit empty author", async () => {
  assert.equal(await author("title: T"), null);
  assert.equal(await author("author: Jane Smith"), "Jane Smith");
  assert.equal(await author("author: [Jane, Paul]"), "Jane, Paul");
  assert.equal(await author("author: none"), "");
  assert.equal(await author("author:"), "");
  assert.equal(await author('author: ""'), "");
  assert.equal(extractAuthor(null), null);
});

test("resolveAuthor: the document wins, then the settings, then nothing", () => {
  assert.equal(resolveAuthor("Jane", "Team"), "Jane");
  assert.equal(resolveAuthor(null, "Team"), "Team");
  assert.equal(resolveAuthor("", "Team"), "", "author: none in the document");
  assert.equal(resolveAuthor(null, null), "");
  assert.equal(resolveAuthor(null, undefined), "");
});

test("settings: author is optional, a name or a list", () => {
  assert.equal(normalizeSettings({}).author, null);
  assert.equal(normalizeSettings({ author: "Team" }).author, "Team");
  assert.equal(normalizeSettings({ author: ["A", "B"] }).author, "A, B");
  assert.equal(normalizeSettings({ author: 5 }).author, "5");
  assert.equal(normalizeSettings({ author: "none" }).author, null);
});

test("doctor --json shows the settings author", () => {
  let out;
  try {
    out = execFileSync(process.execPath, [CLI, "doctor", "--json", "--settings", '{"author":"Docs Team"}'], { encoding: "utf8" });
  } catch (error) {
    out = error.stdout; // exits 1 without a browser; the JSON is printed anyway
  }
  assert.equal(JSON.parse(out).settings.author, "Docs Team");
});
