#!/usr/bin/env node
// Build-time copy: puts Mermaid's single-file browser build in
// vendor/mermaid.min.js. Ships in the release tarball, so diagrams draw
// offline and Mermaid stays a devDependency (its npm tree is ~100 MB).

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(SERVER_DIR, "vendor", "mermaid.min.js");

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("mermaid/package.json"));
const { version } = JSON.parse(await fs.readFile(path.join(pkgDir, "package.json"), "utf8"));
const source = path.join(pkgDir, "dist", "mermaid.min.js");

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.copyFile(source, OUT_FILE);
const { size } = await fs.stat(OUT_FILE);
console.log(`Wrote ${OUT_FILE} (mermaid ${version}, ${(size / 1024 / 1024).toFixed(1)} MB)`);
