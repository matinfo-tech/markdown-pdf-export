/**
 * KaTeX's stylesheet with its fonts inlined, so formulas print in KaTeX's own fonts without any
 * font file next to the HTML. Used at build time by scripts/bundle-katex-css.mjs.
 */

/**
 * Replace each `src:` of KaTeX's `@font-face` rules by one woff2 data URI (Chromium reads woff2,
 * the smallest format). The `.woff` and `.ttf` fallbacks are dropped so the browser never asks for
 * a missing file.
 *
 * In katex.min.css `src` is the last declaration of each rule, so it ends with `}`, not `;`. The
 * terminator is kept as it was: swallowing it would merge every rule into one and no KaTeX font
 * would load.
 *
 * @param {string} css  the content of katex.min.css
 * @param {(file: string) => Promise<string>} woff2DataUri  `data:` URI of a font file, by base name
 * @returns {Promise<string>}
 */
export async function inlineKatexFonts(css, woff2DataUri) {
  const SRC_RE = /src:\s*([^;}]+)([;}])/g;
  const URL_RE = /url\(\s*(?:'([^']+)'|"([^"]+)"|([^)]+?))\s*\)/g;

  const parts = [];
  let last = 0;
  for (const match of css.matchAll(SRC_RE)) {
    const [whole, value, end] = match;
    let woff2 = null;
    for (const url of value.matchAll(URL_RE)) {
      const ref = (url[1] || url[2] || url[3] || "").trim();
      if (ref.startsWith("fonts/") && ref.toLowerCase().endsWith(".woff2")) {
        woff2 = ref.slice("fonts/".length);
        break;
      }
    }
    if (!woff2) continue;
    parts.push(css.slice(last, match.index), `src:url(${await woff2DataUri(woff2)}) format("woff2")${end}`);
    last = match.index + whole.length;
  }
  parts.push(css.slice(last));
  return parts.join("");
}
