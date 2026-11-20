#!/usr/bin/env node
/**
 * Exports studio/sample.md once per page style with the real engine, for the
 * "download a real PDF" links on the docs home page (docs/public/samples/).
 * Run by hand after changing a look: node scripts/build-docs-samples.mjs
 * Needs a browser, so it is not part of CI.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportMarkdownPdf, setProjectDiscovery, setSettings } from "../export.mjs";
import { LOOKS } from "../lib/looks.mjs";
import { prepareSettings } from "../lib/settings-loader.mjs";
import { LAYOUTS, draftToSettings, emptyDraft, lookDefaults } from "../studio/model.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "public", "samples");
const ctx = {
  looks: Object.fromEntries(
    Object.entries(LOOKS).map(([id, l]) => [id, { margin: l.settings.margin, highlight: l.settings.highlight_style }]),
  ),
};

setProjectDiscovery(false);
fs.mkdirSync(OUT, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "mpe-samples-"));
const input = path.join(work, "quarterly-report.md");
fs.copyFileSync(path.join(ROOT, "studio", "sample.md"), input);

const titled = LAYOUTS.find((l) => l.id === "titled");
for (const look of Object.keys(LOOKS)) {
  const draft = { ...emptyDraft(), look, ...lookDefaults(look, ctx.looks), header: titled.header(), footer: titled.footer() };
  const { data } = prepareSettings(draftToSettings(draft, {}, ctx), work);
  setSettings(data);
  const output = path.join(OUT, `${look}.pdf`);
  await exportMarkdownPdf({ input_path: input, output_path: output });
  console.log(`wrote ${path.relative(ROOT, output)} (${Math.round(fs.statSync(output).size / 1024)} KB)`);
}
fs.rmSync(work, { recursive: true, force: true });
process.exit(0);
