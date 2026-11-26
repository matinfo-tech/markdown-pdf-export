#!/usr/bin/env node
/**
 * Generates studio/strings.json: every English text Studio shows, the keys an editor gives in
 * `window.studioHost.text` to show Studio in another language (see studio/app.mjs). Collected
 * from the code, so the list cannot drift from it:
 *   - studio/app.mjs and studio/model.mjs: each say("…") and toTranslate("…");
 *   - studio/index.html: each text, title, aria-label and placeholder, as app.mjs translates it
 *     (an element marked data-say is one sentence, its child elements numbered {0}, {1}…; the
 *     text of <code> is never translated);
 *   - lib/looks.mjs: the page styles' descriptions, font names and code colour names the server
 *     sends.
 * The "Add to my editor" dialog is left out (its <dialog>, and its code has no say()): an editor
 * showing Studio hides it.
 *
 * Usage: node scripts/build-studio-strings.mjs [--check]
 *   --check  exit 1 if the file is out of date instead of writing it
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CODE_THEMES, FONT_LABELS, LOOKS } from "../lib/looks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TARGET = path.join(ROOT, "studio", "strings.json");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const STRING = String.raw`"(?:[^"\\]|\\.)*"`;
const squeeze = (text) => text.replace(/\s+/g, " ").trim();

/** say("…") and toTranslate("…") in a script. */
export function scriptStrings(code) {
  const pattern = new RegExp(String.raw`(?<![\w.$])(?:say|toTranslate)\(\s*(${STRING})`, "g");
  return [...code.matchAll(pattern)].map((m) => JSON.parse(m[1]));
}

/** The texts app.mjs translates in a page, found in its source. */
export function pageStrings(html) {
  if (/&\w+;|&#/.test(html)) throw new Error("studio/index.html: write characters as they are, not as entities.");
  const found = [];
  let page = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "").replace(/<dialog\b[\s\S]*?<\/dialog>/g, "");
  // One sentence around elements: "{0}: a {1} block…". The elements stay, for their own text.
  page = page.replace(/<(\w+)\b([^>]*\bdata-say\b[^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attributes, inner) => {
    const elements = [];
    const sentence = inner.replace(/<(\w+)\b[^>]*>[\s\S]*?<\/\1>/g, (element) => `{${elements.push(element) - 1}}`);
    found.push(squeeze(sentence));
    return `<${tag}${attributes.replace(/\s*\bdata-say\b/, "")}>${elements.join("")}</${tag}>`;
  });
  page = page.replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, "<code></code>");
  for (const m of page.matchAll(/\s(?:title|aria-label|placeholder)="([^"]*)"/g)) found.push(m[1]);
  for (const m of page.matchAll(/>([^<]+)</g)) if (squeeze(m[1])) found.push(squeeze(m[1]));
  return found;
}

export function buildStudioStrings() {
  const strings = new Set([
    ...scriptStrings(read("studio/app.mjs")),
    ...scriptStrings(read("studio/model.mjs")),
    ...pageStrings(read("studio/index.html")),
    ...Object.values(LOOKS).map((look) => look.description),
    ...Object.values(FONT_LABELS),
    ...CODE_THEMES.map((theme) => theme.label),
  ]);
  return `${JSON.stringify([...strings].sort(), null, 2)}\n`;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const text = buildStudioStrings();
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8").replaceAll("\r\n", "\n") : null;
  if (current === text) {
    process.exitCode = 0;
  } else if (process.argv.includes("--check")) {
    console.error(`✗ ${path.relative(ROOT, TARGET)} is out of date — run: npm run build:studio-strings`);
    process.exitCode = 1;
  } else {
    fs.writeFileSync(TARGET, text);
    console.log(`wrote ${path.relative(ROOT, TARGET)}`);
  }
}
