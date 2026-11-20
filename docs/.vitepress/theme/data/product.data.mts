// Build-time data for the docs site, read from the tool's own files so the
// site shows the real page styles, code colours and templates and cannot drift.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { LOOKS, FONTS, FONT_LABELS, CODE_THEMES, TEMPLATES } from "../../../../lib/looks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// highlight.js is a docs dependency too, so this works in the docs-only CI job.
const require = createRequire(path.join(ROOT, "docs", "package.json"));
const hljsStyles = path.join(path.dirname(require.resolve("highlight.js/package.json")), "styles");

// Same rule as export.mjs codeThemeBackground(): dark themes paint the block.
function themeBackground(css: string): string | null {
  for (const rule of css.matchAll(/(?:^|[},\s/])\.hljs\s*\{([^}]*)\}/g)) {
    const m = /background(?:-color)?\s*:\s*(#[0-9a-f]{3,8})\b/i.exec(rule[1]);
    if (!m) continue;
    const hex = m[1].toLowerCase();
    return hex === "#fff" || hex === "#ffffff" ? null : hex;
  }
  return null;
}

const LOOK_LABELS: Record<string, string> = {
  clean: "Clean",
  report: "Report",
  academic: "Academic",
  compact: "Compact",
  technical: "Technical",
};

export interface Product {
  defaultCss: string;
  looks: { id: string; label: string; description: string; css: string; margin: number; highlight: string }[];
  codeThemes: { file: string; label: string; css: string; background: string | null }[];
  fonts: Record<string, string>;
  fontLabels: Record<string, string>;
  templates: Record<string, object>;
}

export default {
  watch: ["../../../../looks/*.css", "../../../../templates/*.json", "../../../../default.css"],
  load(): Product {
    const looks = Object.entries(LOOKS).map(([id, look]: [string, any]) => ({
      id,
      label: LOOK_LABELS[id] ?? id,
      description: look.description,
      css: look.settings.stylesheet ? read("looks", look.settings.stylesheet) : "",
      margin: parseFloat(look.settings.margin?.left ?? "15"),
      highlight: look.settings.highlight_style ?? "github.css",
    }));
    const files = new Set([...CODE_THEMES.map((t) => t.file), ...looks.map((l) => l.highlight)]);
    const labels = Object.fromEntries(CODE_THEMES.map((t) => [t.file, t.label]));
    const codeThemes = [...files].map((file) => {
      const css = fs.readFileSync(path.join(hljsStyles, file), "utf8");
      return { file, label: labels[file] ?? file, css, background: themeBackground(css) };
    });
    const templates = Object.fromEntries(
      TEMPLATES.map((name: string) => {
        const data = JSON.parse(read("templates", `${name}.json`));
        delete data.$schema;
        return [name, data];
      }),
    );
    return { defaultCss: read("default.css"), looks, codeThemes, fonts: FONTS, fontLabels: FONT_LABELS, templates };
  },
};
