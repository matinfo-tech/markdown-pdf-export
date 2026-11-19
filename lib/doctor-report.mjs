/**
 * @fileoverview Plain-language rendering of the doctor report: a checklist
 * where every problem comes with the one command that fixes it.
 */

/**
 * @param {object} report  result of doctorMarkdownPdf()
 * @param {{bin?: string, nodeVersion?: string}} [opts]
 * @returns {{text: string, ok: boolean}}
 */
export function formatDoctor(report, { bin = "markdown-pdf-export", nodeVersion = process.versions.node } = {}) {
  const lines = [];
  let ok = true;
  const good = (msg) => lines.push(`  ✓ ${msg}`);
  const bad = (msg, fix) => {
    ok = false;
    lines.push(`  ✗ ${msg}`);
    if (fix) lines.push(`      fix: ${fix}`);
  };
  const info = (msg, hint) => {
    lines.push(`  · ${msg}`);
    if (hint) lines.push(`      ${hint}`);
  };

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

  const head = ok ? "Everything is ready." : "Something needs attention:";
  return { text: `${head}\n\n${lines.join("\n")}\n`, ok };
}
