/**
 * Mermaid diagrams: ```mermaid fences become SVG drawn before the PDF page
 * loads, so the document page still runs without JavaScript.
 *
 * 1. While Markdown renders, `mermaidFences` swaps each mermaid fence for a
 *    placeholder comment and keeps the source (and the plain code block, as
 *    a fallback) in `env.mermaid`.
 * 2. `renderMermaid` draws every diagram in a separate page that has
 *    JavaScript but no network, using the bundled Mermaid script in strict
 *    security mode. The diagram text is passed as data, never run as code.
 * 3. `insertDiagrams` puts each SVG (or the fallback code block) in place.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_SCRIPT = path.join(SERVER_DIR, "vendor", "mermaid.min.js");
const RENDER_TIMEOUT_MS = 30_000;

/**
 * markdown-it plugin. Pass `env.mermaid = []` to collect diagrams; without
 * it mermaid fences render as ordinary code blocks.
 * @param {import("markdown-it")} md
 */
export function mermaidFences(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const fallback = fence(tokens, idx, options, env, self);
    const lang = tokens[idx].info.trim().split(/\s+/)[0].toLowerCase();
    if (lang !== "mermaid" || !Array.isArray(env?.mermaid)) return fallback;

    // A random nonce per render, so the document cannot forge a placeholder.
    env.mermaidNonce ??= randomBytes(8).toString("hex");
    const index = env.mermaid.push({ source: tokens[idx].content, fallback }) - 1;
    return `<!--mermaid:${env.mermaidNonce}:${index}-->\n`;
  };
}

/**
 * Replace the placeholders left by `mermaidFences`.
 * @param {string} html
 * @param {{ mermaid?: {source: string, fallback: string}[], mermaidNonce?: string }} env
 * @param {({svg?: string, error?: string})[] | null} results one per diagram, or null when not drawn
 * @returns {{ html: string, errors: string[] }}
 */
export function insertDiagrams(html, env, results) {
  const diagrams = env.mermaid ?? [];
  const errors = [];
  if (diagrams.length === 0) return { html, errors };

  const marker = new RegExp(`<!--mermaid:${env.mermaidNonce}:(\\d+)-->\\n?`, "g");
  const out = html.replace(marker, (_, i) => {
    const diagram = diagrams[Number(i)];
    const result = results?.[Number(i)];
    if (result?.svg) return `<figure class="mermaid">${result.svg}</figure>\n`;
    if (result?.error) errors.push(`Diagram ${Number(i) + 1}: ${result.error}`);
    return diagram.fallback;
  });
  return { html: out, errors };
}

async function mermaidScriptPath() {
  try {
    await fs.access(VENDOR_SCRIPT);
    return VENDOR_SCRIPT;
  } catch {
    // Development checkout without a build: use the package directly.
    const require = createRequire(import.meta.url);
    return path.join(path.dirname(require.resolve("mermaid/package.json")), "dist", "mermaid.min.js");
  }
}

/**
 * Draw diagrams to SVG in a fresh page of `browser`.
 * @param {import("playwright-core").Browser} browser
 * @param {string[]} sources
 * @returns {Promise<({svg: string} | {error: string})[]>}
 */
export async function renderMermaid(browser, sources) {
  let scriptPath;
  try {
    scriptPath = await mermaidScriptPath();
  } catch {
    return sources.map(() => ({ error: "Mermaid is not installed" }));
  }

  const page = await browser.newPage({ javaScriptEnabled: true });
  let timer;
  try {
    // Nothing a diagram contains may reach the network or the disk.
    await page.route("**/*", (route) => route.abort());
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({ path: scriptPath });

    // Mermaid scopes each diagram's CSS by element id; keep ids unguessable
    // so they never match a heading id or a selector in the document.
    const idPrefix = `mermaid-${randomBytes(4).toString("hex")}`;
    const draw = page.evaluate(async ({ texts, idPrefix }) => {
      /* global mermaid, document */
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: 'Helvetica, Arial, "Segoe UI", sans-serif',
      });
      const out = [];
      for (let i = 0; i < texts.length; i++) {
        const id = `${idPrefix}-${i}`;
        try {
          const { svg } = await mermaid.render(id, texts[i]);
          out.push({ svg });
        } catch (error) {
          // Parse errors span several lines; keep the first and the last
          // ("Expecting ..."), which together say where and what.
          const lines = String(error?.message ?? error).split("\n").filter((l) => l.trim());
          out.push({ error: [...new Set([lines[0], lines.at(-1)])].join(" ") });
        } finally {
          document.getElementById(`d${id}`)?.remove();
        }
      }
      return out;
    }, { texts: sources, idPrefix });

    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Mermaid took longer than ${RENDER_TIMEOUT_MS / 1000}s`)),
        RENDER_TIMEOUT_MS,
      );
    });
    return await Promise.race([draw, timeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sources.map(() => ({ error: message }));
  } finally {
    clearTimeout(timer);
    await page.close().catch(() => {});
  }
}
