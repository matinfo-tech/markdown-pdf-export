#!/usr/bin/env node
/**
 * Generates schema/settings.schema.json (shipped in the package) and the copy
 * published on the docs site (docs/public/schema/).
 *
 * Usage: node scripts/build-settings-schema.mjs [--check]
 *   --check  exit 1 if the files are out of date instead of writing them
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSettingsSchema } from "../lib/settings-schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [
  path.join(ROOT, "schema", "settings.schema.json"),
  path.join(ROOT, "docs", "public", "schema", "settings.schema.json"),
];
const text = `${JSON.stringify(buildSettingsSchema(), null, 2)}\n`;
const check = process.argv.includes("--check");

let stale = 0;
for (const file of TARGETS) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === text) continue;
  if (check) {
    console.error(`✗ ${path.relative(ROOT, file)} is out of date — run: npm run build:schema`);
    stale++;
    continue;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  console.log(`wrote ${path.relative(ROOT, file)}`);
}
process.exitCode = stale ? 1 : 0;
