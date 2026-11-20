/**
 * @fileoverview Plain-language rendering of the doctor report: a checklist
 * where every problem comes with the one command that fixes it.
 */

import { plain } from "./term-style.mjs";

/**
 * @param {object} report  result of doctorMarkdownPdf()
 * @param {{bin?: string, nodeVersion?: string, style?: typeof plain}} [opts]
 * @returns {{text: string, ok: boolean}}
 */
export function formatDoctor(
  report,
  { bin = "markdown-pdf-export", nodeVersion = process.versions.node, style = plain } = {},
) {
  const c = style;
  const lines = [];
  let ok = true;
  const good = (msg) => lines.push(`  ${c.green("✓")} ${msg}`);
  const bad = (msg, fix) => {
    ok = false;
    lines.push(`  ${c.red("✗")} ${msg}`);
    if (fix) lines.push(`      fix: ${c.cyan(fix)}`);
  };
  const info = (msg, hint) => {
    lines.push(`  ${c.dim("·")} ${msg}`);
    if (hint) lines.push(`      ${c.cyan(hint)}`);
  };

  if (report.version) {
    good(`${c.bold(`${bin} ${report.version}`)}` + (report.server_dir ? c.dim(`  (${report.server_dir})`) : ""));
  }

  const major = Number.parseInt(nodeVersion, 10);
  if (major >= 20) good(`Node ${nodeVersion}`);
  else bad(`Node ${nodeVersion} is too old (needs 20 or newer)`, "install Node 20+ from nodejs.org");

  const b = report.browser ?? {};
  if (b.available) good(`Browser: ${b.backend ?? "Chromium"} ${b.version ?? ""}`.trim());
  else bad("No browser found (needed to draw the PDF)", `${bin} install-browser   (or install Chrome / Edge)`);

  const sources = report.settings_sources ?? [];
  const loaded = sources.filter((s) => s.loaded);
  for (const s of sources) {
    if (s.error) bad(`Settings file has an error: ${s.path ?? s.kind}\n      ${s.error}`, "open the file and fix the JSON");
    else if (s.loaded) good(`Settings: ${s.path ?? "MARKDOWN_PDF_SETTINGS (inline)"}`);
  }
  if (loaded.length === 0 && !sources.some((s) => s.error)) {
    info("No settings file — built-in defaults are used", `create one: ${bin} init`);
  }

  const st = report.settings ?? {};
  const hf = st.display_header_footer || st.header || st.footer;
  info(
    `Page: ${st.page_format ?? "A4"}, ${st.orientation ?? "portrait"} · header/footer: ${hf ? "on" : "off"}` +
      (st.font_family ? " · custom font" : ""),
  );

  const head = ok
    ? c.green(c.bold("✨ Everything is ready."))
    : c.red(c.bold("Something needs attention:"));
  const editors = report.editors ? `\n${formatEditors(report.editors, bin, c)}` : "";
  return { text: `${head}\n\n${lines.join("\n")}\n${editors}`, ok };
}

const PARTS = { task: "export task", mcp: "AI tools" };

/**
 * Editors section: what is set up where. Never fails the check — a missing
 * editor is a choice, not an error.
 * @param {ReturnType<typeof import("./editor-setup.mjs").editorStatus>} editors
 * @param {string} bin
 */
export function formatEditors(editors, bin = "markdown-pdf-export", style = plain) {
  const c = style;
  const lines = [c.bold("Editors:")];
  for (const e of editors.filter((x) => x.detected)) {
    const parts = Object.keys(PARTS).filter((k) => e[k] !== undefined);
    const done = parts.filter((k) => e[k] === true);
    const missing = parts.filter((k) => e[k] !== true);
    const label = (ks) => ks.map((k) => PARTS[k]).join(", ");
    if (missing.length === 0) {
      lines.push(`  ${c.green("✓")} ${c.bold(e.name)}: ${label(done)}`);
    } else {
      const note = e.mcp === "project" ? " (only in some project folders)" : "";
      lines.push(
        `  ${c.yellow("·")} ${c.bold(e.name)}: ${done.length ? `${label(done)} ${c.green("✓")}, ` : ""}` +
          c.yellow(`${label(missing)} not set up${note}`),
        `      add: ${c.cyan(`${bin} setup ${e.id} --write`)}`,
      );
    }
    for (const w of e.warnings ?? []) lines.push(`  ${c.yellow("!")} ${c.yellow(w)}`);
  }
  const absent = editors.filter((x) => !x.detected).map((x) => x.name);
  // Not installed is a choice, not a problem: neutral grey, never red.
  if (absent.length) lines.push(c.dim(`  · Not found: ${absent.join(", ")}`));
  return `${lines.join("\n")}\n`;
}
