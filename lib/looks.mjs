/**
 * @fileoverview Beginner-facing presets. A settings file can be as short as
 *   { "look": "report", "font": "serif", "template": "corporate" }
 *
 * - look     → stylesheet + code theme + margins   (looks/*.css)
 * - font     → a safe font stack for the text (heading_font: same, for titles)
 * - template → header/footer preset                 (templates/*.json)
 *
 * Explicit keys in the same file always win over presets; template wins over look.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Record<string, {description: string, settings: object}>} */
export const LOOKS = {
  clean: {
    description: "Default. GitHub-style, neutral.",
    settings: {},
  },
  report: {
    description: "Serif headings, strong title rule. Business reports.",
    settings: { stylesheet: "report.css", highlight_style: "github.css" },
  },
  academic: {
    description: "Serif body, justified, minimal colour. Papers and theses.",
    settings: {
      stylesheet: "academic.css",
      highlight_style: "ascetic.css",
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
    },
  },
  compact: {
    description: "Dense and small. More text per page.",
    settings: {
      stylesheet: "compact.css",
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    },
  },
  technical: {
    description: "For documents with code: framed code blocks, blue accents.",
    settings: { stylesheet: "technical.css", highlight_style: "atom-one-light.css" },
  },
};

export const FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  book: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  humanist: 'Seravek, "Gill Sans Nova", "Gill Sans", Ubuntu, Calibri, "DejaVu Sans", sans-serif',
  geometric: 'Avenir, "Avenir Next", Montserrat, Corbel, "Century Gothic", "URW Gothic", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  system: "system-ui, sans-serif",
};

/** Names shown to people (Studio, init). */
export const FONT_LABELS = {
  sans: "Sans",
  serif: "Serif",
  book: "Book serif",
  humanist: "Humanist sans",
  geometric: "Geometric sans",
  mono: "Mono",
  system: "System",
};

/** Short list of code colour themes offered in Studio (any highlight.js theme works in a file). */
export const CODE_THEMES = [
  { file: "github.css", label: "GitHub light" },
  { file: "github-dark.css", label: "GitHub dark" },
  { file: "atom-one-light.css", label: "Atom One light" },
  { file: "atom-one-dark.css", label: "Atom One dark" },
  { file: "vs.css", label: "Visual Studio light" },
  { file: "vs2015.css", label: "Visual Studio dark" },
  { file: "xcode.css", label: "Xcode light" },
  { file: "monokai.css", label: "Monokai dark" },
  { file: "nord.css", label: "Nord dark" },
  { file: "tokyo-night-dark.css", label: "Tokyo Night dark" },
  { file: "ascetic.css", label: "Black and white" },
];

export const TEMPLATES = ["minimal", "simple", "corporate", "academic", "two-logo"];

export const looksDir = () => path.join(ROOT, "looks");
export const templatesDir = () => path.join(ROOT, "templates");

/** Read a shipped header/footer template (without its $schema line). */
export function readTemplate(name) {
  if (!TEMPLATES.includes(name)) return null;
  const data = JSON.parse(fs.readFileSync(path.join(templatesDir(), `${name}.json`), "utf8"));
  delete data.$schema;
  return data;
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlain(v) && isPlain(out[k]) ? merge(out[k], v) : v;
  }
  return out;
}

/**
 * Expand `look` / `font` / `template` in one raw settings object.
 * Unknown names are reported in `warnings` and ignored.
 * @param {object} data
 * @returns {{data: object, warnings: string[]}}
 */
export function applyPresets(data) {
  if (!isPlain(data)) return { data, warnings: [] };
  const { look, font, heading_font, template, ...explicit } = data;
  if (look === undefined && font === undefined && heading_font === undefined && template === undefined) {
    return { data, warnings: [] };
  }
  const warnings = [];
  let base = {};

  if (look !== undefined) {
    const def = LOOKS[look];
    if (!def) {
      warnings.push(`unknown look "${look}" (use: ${Object.keys(LOOKS).join(", ")})`);
    } else {
      const { stylesheet, ...rest } = def.settings;
      base = merge(base, rest);
      if (stylesheet) base.stylesheet_path = path.join(looksDir(), stylesheet);
    }
  }
  if (template !== undefined) {
    const tpl = typeof template === "string" ? readTemplate(template) : null;
    if (!tpl) {
      warnings.push(`unknown template "${template}" (use: ${TEMPLATES.join(", ")})`);
    } else {
      base = merge(base, tpl);
    }
  }
  if (font !== undefined) {
    if (!FONTS[font]) warnings.push(`unknown font "${font}" (use: ${Object.keys(FONTS).join(", ")})`);
    else base.font_family = FONTS[font];
  }
  if (heading_font !== undefined) {
    if (!FONTS[heading_font]) {
      warnings.push(`unknown heading_font "${heading_font}" (use: ${Object.keys(FONTS).join(", ")})`);
    } else base.heading_font_family = FONTS[heading_font];
  }
  return { data: merge(base, explicit), warnings };
}
