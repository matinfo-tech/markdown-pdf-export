#!/usr/bin/env node
// Build-time bundler: produces vendor/katex-inline.css with every
// font file rewritten as a base64 data: URI. Ships in the release tarball
// so KaTeX renders correctly without external font requests.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inlineKatexFonts } from "../lib/katex-css.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(SCRIPT_DIR, "..");
const KATEX_DIST = path.join(SERVER_DIR, "node_modules", "katex", "dist");
const FONTS_DIR = path.join(KATEX_DIST, "fonts");
const SOURCE_CSS = path.join(KATEX_DIST, "katex.min.css");
const OUT_DIR = path.join(SERVER_DIR, "vendor");
const OUT_FILE = path.join(OUT_DIR, "katex-inline.css");

const fontCache = new Map();
async function woff2DataUri(file) {
  if (fontCache.has(file)) return fontCache.get(file);
  const buf = await fs.readFile(path.join(FONTS_DIR, file));
  const uri = `data:font/woff2;base64,${buf.toString("base64")}`;
  fontCache.set(file, uri);
  return uri;
}

async function main() {
  const css = await fs.readFile(SOURCE_CSS, "utf8");
  const out = await inlineKatexFonts(css, woff2DataUri);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, out, "utf8");
  const stat = await fs.stat(OUT_FILE);
  console.log(`Wrote ${OUT_FILE} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
