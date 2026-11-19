/**
 * Markdown PDF core — Markdown → HTML → PDF (Playwright/Chromium).
 *
 * No stdio or process side effects at import time, so it can be used from the
 * CLI (cli.mjs), the MCP server (mcp.mjs) or any other Node program.
 * Dependencies come from `npm install`; nothing is installed at runtime.
 */

// ── Built-in imports only at top level ────────────────────────────────────────
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// ── Structured header/footer pipeline imports ─────────────────────────────────
import {
  parseFrontMatter,
  ensureYamlLoaded,
} from "./lib/frontmatter-parser.mjs";
import { mergeConfig } from "./lib/config-merger.mjs";
import { createAssetResolver } from "./lib/asset-resolver.mjs";
import {
  deepMerge,
  findProjectSettingsFile,
  readSettingsFile,
  userSettingsPath,
} from "./lib/settings-loader.mjs";
import { applyPresets } from "./lib/looks.mjs";
import {
  createPlaceholderResolver,
  createRenderContext,
  ensureDateFnsLoaded,
} from "./lib/placeholder-resolver.mjs";
import { createHtmlGenerator } from "./lib/html-generator.mjs";

// ── Debug logging (opt-in) ────────────────────────────────────────────────────
// Set MARKDOWN_PDF_DEBUG=1 to log to <tmpdir>/markdown-pdf-debug.log, or set it
// to a file path to log there. Disabled by default.
const DEBUG_ENV = process.env.MARKDOWN_PDF_DEBUG ?? "";
export const DEBUG_LOG =
  DEBUG_ENV === "" || DEBUG_ENV === "0" || DEBUG_ENV.toLowerCase() === "false"
    ? null
    : DEBUG_ENV === "1" || DEBUG_ENV.toLowerCase() === "true"
      ? path.join(os.tmpdir(), "markdown-pdf-debug.log")
      : path.resolve(DEBUG_ENV);

export function debugLog(message) {
  if (!DEBUG_LOG) return;
  try {
    fsSync.appendFileSync(
      DEBUG_LOG,
      `[${new Date().toISOString()}] ${message}\n`,
    );
  } catch {
    // Never let logging break the caller.
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const SERVER_NAME = "markdown-pdf";
// Single source of truth for the version: package.json.
export const SERVER_VERSION = createRequire(import.meta.url)(
  "./package.json",
).version;
const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Directory of an installed dependency. Works whether npm nested it under
 * server/node_modules or hoisted it (npx cache, global install, workspaces).
 */
function packageDir(name) {
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve(`${name}/package.json`));
}
const DEFAULT_CSS_PATH = path.join(SERVER_DIR, "default.css");

export const DEFAULT_SETTINGS = {
  // output
  stylesheet_path: null,
  output_directory: null,
  assets_directory: null,
  open_after_export: false,
  // page layout
  page_format: "A4",
  orientation: "portrait",
  scale: 1,
  page_ranges: "",
  print_background: true,
  margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
  // content / rendering
  font_family: null,
  include_default_styles: true,
  highlight: true,
  highlight_style: "github.css",
  breaks: false,
  emoji: true,
  // math (KaTeX)
  math: false,
  math_options: {
    throw_on_error: false,
    error_color: "#cc0000",
    macros: {},
  },
  // headings / TOC
  heading_anchors: false,
  toc: false,
  toc_options: {
    level: [1, 2, 3],
    list_type: "ul",
  },
  // header / footer
  display_header_footer: false,
};

const ALLOWED_ORIENTATIONS = new Set(["portrait", "landscape"]);

export const HIGHLIGHT_STYLES = new Set([
  "1c-light.css",
  "a11y-dark.css",
  "a11y-light.css",
  "agate.css",
  "an-old-hope.css",
  "androidstudio.css",
  "arduino-light.css",
  "arta.css",
  "ascetic.css",
  "atom-one-dark-reasonable.css",
  "atom-one-dark.css",
  "atom-one-light.css",
  "brown-paper.css",
  "codepen-embed.css",
  "color-brewer.css",
  "cybertopia-cherry.css",
  "cybertopia-dimmer.css",
  "cybertopia-icecap.css",
  "cybertopia-saturated.css",
  "dark.css",
  "default.css",
  "devibeans.css",
  "docco.css",
  "far.css",
  "felipec.css",
  "foundation.css",
  "github-dark-dimmed.css",
  "github-dark.css",
  "github.css",
  "gml.css",
  "googlecode.css",
  "gradient-dark.css",
  "gradient-light.css",
  "grayscale.css",
  "hybrid.css",
  "idea.css",
  "intellij-light.css",
  "ir-black.css",
  "isbl-editor-dark.css",
  "isbl-editor-light.css",
  "kimbie-dark.css",
  "kimbie-light.css",
  "lightfair.css",
  "lioshi.css",
  "magula.css",
  "mono-blue.css",
  "monokai-sublime.css",
  "monokai.css",
  "night-owl.css",
  "nnfx-dark.css",
  "nnfx-light.css",
  "nord.css",
  "obsidian.css",
  "panda-syntax-dark.css",
  "panda-syntax-light.css",
  "paraiso-dark.css",
  "paraiso-light.css",
  "pojoaque.css",
  "purebasic.css",
  "qtcreator-dark.css",
  "qtcreator-light.css",
  "rainbow.css",
  "rose-pine-dawn.css",
  "rose-pine-moon.css",
  "rose-pine.css",
  "routeros.css",
  "school-book.css",
  "shades-of-purple.css",
  "srcery.css",
  "stackoverflow-dark.css",
  "stackoverflow-light.css",
  "sunburst.css",
  "tokyo-night-dark.css",
  "tokyo-night-light.css",
  "tomorrow-night-blue.css",
  "tomorrow-night-bright.css",
  "vs.css",
  "vs2015.css",
  "xcode.css",
  "xt256.css",
]);

export const ALLOWED_PAGE_FORMATS = new Set([
  "A4",
  "Letter",
  "Legal",
  "Tabloid",
  "Ledger",
  "A0",
  "A1",
  "A2",
  "A3",
  "A5",
  "A6",
]);

// ── Settings ──────────────────────────────────────────────────────────────────
function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePageFormat(value, fallback = DEFAULT_SETTINGS.page_format) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return ALLOWED_PAGE_FORMATS.has(trimmed) ? trimmed : fallback;
}

function normalizeMargin(raw, fallback = DEFAULT_SETTINGS.margin) {
  const safe = raw && typeof raw === "object" ? raw : {};

  return {
    top:
      typeof safe.top === "string" && safe.top.trim() !== ""
        ? safe.top
        : fallback.top,
    right:
      typeof safe.right === "string" && safe.right.trim() !== ""
        ? safe.right
        : fallback.right,
    bottom:
      typeof safe.bottom === "string" && safe.bottom.trim() !== ""
        ? safe.bottom
        : fallback.bottom,
    left:
      typeof safe.left === "string" && safe.left.trim() !== ""
        ? safe.left
        : fallback.left,
  };
}

function normalizeMathOptions(raw, fallback = DEFAULT_SETTINGS.math_options) {
  const safe = raw && typeof raw === "object" ? raw : {};
  const macros =
    safe.macros && typeof safe.macros === "object" && !Array.isArray(safe.macros)
      ? safe.macros
      : fallback.macros;
  return {
    throw_on_error: normalizeBoolean(safe.throw_on_error, fallback.throw_on_error),
    error_color:
      typeof safe.error_color === "string" && safe.error_color.trim() !== ""
        ? safe.error_color
        : fallback.error_color,
    macros,
  };
}

function normalizeTocOptions(raw, fallback = DEFAULT_SETTINGS.toc_options) {
  const safe = raw && typeof raw === "object" ? raw : {};
  let level = fallback.level;
  if (Array.isArray(safe.level)) {
    const filtered = safe.level
      .map((n) => (typeof n === "number" ? Math.floor(n) : NaN))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
    if (filtered.length > 0) level = filtered;
  } else if (typeof safe.level === "number" && safe.level >= 1 && safe.level <= 6) {
    level = [Math.floor(safe.level)];
  }
  const list_type =
    safe.list_type === "ol" || safe.list_type === "ul"
      ? safe.list_type
      : fallback.list_type;
  return { level, list_type };
}

export function normalizeSettings(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  return {
    stylesheet_path: normalizeNonEmptyString(safe.stylesheet_path),
    output_directory: normalizeNonEmptyString(safe.output_directory),
    assets_directory: normalizeNonEmptyString(safe.assets_directory),
    open_after_export: normalizeBoolean(
      safe.open_after_export,
      DEFAULT_SETTINGS.open_after_export,
    ),
    page_format: normalizePageFormat(safe.page_format),
    orientation:
      typeof safe.orientation === "string" &&
      ALLOWED_ORIENTATIONS.has(safe.orientation.trim())
        ? safe.orientation.trim()
        : DEFAULT_SETTINGS.orientation,
    scale:
      typeof safe.scale === "number" && safe.scale > 0
        ? safe.scale
        : DEFAULT_SETTINGS.scale,
    page_ranges:
      typeof safe.page_ranges === "string" ? safe.page_ranges.trim() : "",
    print_background: normalizeBoolean(
      safe.print_background,
      DEFAULT_SETTINGS.print_background,
    ),
    margin: normalizeMargin(safe.margin, DEFAULT_SETTINGS.margin),
    include_default_styles: normalizeBoolean(
      safe.include_default_styles,
      DEFAULT_SETTINGS.include_default_styles,
    ),
    highlight: normalizeBoolean(safe.highlight, DEFAULT_SETTINGS.highlight),
    highlight_style:
      typeof safe.highlight_style === "string" &&
      HIGHLIGHT_STYLES.has(safe.highlight_style.trim())
        ? safe.highlight_style.trim()
        : DEFAULT_SETTINGS.highlight_style,
    breaks: normalizeBoolean(safe.breaks, DEFAULT_SETTINGS.breaks),
    emoji: normalizeBoolean(safe.emoji, DEFAULT_SETTINGS.emoji),
    math: normalizeBoolean(safe.math, DEFAULT_SETTINGS.math),
    math_options: normalizeMathOptions(safe.math_options),
    heading_anchors: normalizeBoolean(
      safe.heading_anchors,
      DEFAULT_SETTINGS.heading_anchors,
    ),
    toc: normalizeBoolean(safe.toc, DEFAULT_SETTINGS.toc),
    toc_options: normalizeTocOptions(safe.toc_options),
    display_header_footer: normalizeBoolean(
      safe.display_header_footer,
      DEFAULT_SETTINGS.display_header_footer,
    ),

    font_family: normalizeNonEmptyString(safe.font_family),

    // Structured header/footer configs – pass through as-is for the
    // config-merger / html-generator pipeline to consume.
    header: safe.header && typeof safe.header === "object" ? safe.header : null,
    footer: safe.footer && typeof safe.footer === "object" ? safe.footer : null,
  };
}

/**
 * Base settings layer (user level). Resolution:
 *   MARKDOWN_PDF_SETTINGS (inline JSON or a file path) when set,
 *   otherwise the user settings file if it exists.
 * Returns the raw (un-normalized) settings plus the sources that were consulted.
 */
function loadBaseSettings() {
  const env = (process.env.MARKDOWN_PDF_SETTINGS ?? "").trim();
  debugLog(`MARKDOWN_PDF_SETTINGS env: ${env}`);

  if (env && env !== "{}") {
    if (env.startsWith("{")) {
      try {
        const { data: parsed, warnings } = applyPresets(JSON.parse(env));
        for (const w of warnings) console.error(`[markdown-pdf] ⚠️  MARKDOWN_PDF_SETTINGS: ${w}`);
        return {
          raw: parsed,
          sources: [{ kind: "env", path: null, loaded: true, error: null }],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `[markdown-pdf] ⚠️  Could not parse MARKDOWN_PDF_SETTINGS — falling back to defaults.\n` +
            `  Reason : ${msg}`,
        );
        return {
          raw: {},
          sources: [{ kind: "env", path: null, loaded: false, error: msg }],
        };
      }
    }
    const file = readSettingsFile(env);
    if (file.error) {
      console.error(
        `[markdown-pdf] ⚠️  Could not load settings file ${file.path} — falling back to defaults.\n` +
          `  Reason : ${file.error}`,
      );
    }
    return {
      raw: file.data ?? {},
      sources: [
        { kind: "env", path: file.path, loaded: !file.error, error: file.error },
      ],
    };
  }

  const userFile = userSettingsPath();
  if (!fsSync.existsSync(userFile)) {
    return {
      raw: {},
      sources: [{ kind: "user", path: userFile, loaded: false, error: null }],
    };
  }
  const file = readSettingsFile(userFile);
  if (file.error) {
    console.error(
      `[markdown-pdf] ⚠️  Could not load ${file.path} — falling back to defaults.\n` +
        `  Reason : ${file.error}`,
    );
  }
  return {
    raw: file.data ?? {},
    sources: [{ kind: "user", path: file.path, loaded: !file.error, error: file.error }],
  };
}

const baseLoad = loadBaseSettings();
let baseRaw = baseLoad.raw;
let baseSources = baseLoad.sources;
let settings = normalizeSettings(baseRaw);

/** Re-read the base settings layer (env var / user file) — used by --watch. */
export function reloadSettings() {
  const load = loadBaseSettings();
  baseRaw = load.raw;
  baseSources = load.sources;
  settings = normalizeSettings(baseRaw);
}

/**
 * Replace the base settings layer (used by the CLI for --settings).
 * `sourcePath` (optional) records the file the settings came from.
 */
export function setSettings(raw, sourcePath = null) {
  baseRaw = raw && typeof raw === "object" ? raw : {};
  settings = normalizeSettings(baseRaw);
  baseSources = [
    {
      kind: "cli",
      path: sourcePath,
      loaded: true,
      error: null,
    },
  ];
}
debugLog(
  `final loaded settings.display_header_footer: ${settings.display_header_footer}`,
);

/**
 * Effective settings for one document: base layer deep-merged with the
 * nearest .markdown-pdf.json found walking up from the document.
 */
function resolveDocumentSettings(inputDir) {
  const sources = [...baseSources];
  const projectFile = findProjectSettingsFile(inputDir);
  if (!projectFile) return { settings, sources };

  const file = readSettingsFile(projectFile);
  sources.push({
    kind: "project",
    path: file.path,
    loaded: !file.error,
    error: file.error,
  });
  if (file.error) {
    console.error(
      `[markdown-pdf] ⚠️  Could not load ${file.path} — ignoring it.\n  Reason : ${file.error}`,
    );
    return { settings, sources };
  }
  return {
    settings: normalizeSettings(deepMerge(baseRaw, file.data)),
    sources,
  };
}

function buildEffectiveOptions(args = {}, settings) {
  return {
    stylesheet_path:
      normalizeNonEmptyString(args.stylesheet_path) ?? settings.stylesheet_path,
    output_path: normalizeNonEmptyString(args.output_path),
    open_after_export:
      typeof args.open_after_export === "boolean"
        ? args.open_after_export
        : settings.open_after_export,
    page_format: normalizePageFormat(args.page_format, settings.page_format),
    orientation:
      typeof args.orientation === "string" &&
      ALLOWED_ORIENTATIONS.has(args.orientation.trim())
        ? args.orientation.trim()
        : settings.orientation,
    scale:
      typeof args.scale === "number" && args.scale > 0
        ? args.scale
        : settings.scale,
    page_ranges:
      typeof args.page_ranges === "string"
        ? args.page_ranges.trim()
        : settings.page_ranges,
    print_background:
      typeof args.print_background === "boolean"
        ? args.print_background
        : settings.print_background,
    margin: normalizeMargin(args.margin, settings.margin),
    include_default_styles:
      typeof args.include_default_styles === "boolean"
        ? args.include_default_styles
        : settings.include_default_styles,
    highlight:
      typeof args.highlight === "boolean" ? args.highlight : settings.highlight,
    highlight_style:
      typeof args.highlight_style === "string" &&
      HIGHLIGHT_STYLES.has(args.highlight_style.trim())
        ? args.highlight_style.trim()
        : settings.highlight_style,
    breaks: typeof args.breaks === "boolean" ? args.breaks : settings.breaks,
    emoji: typeof args.emoji === "boolean" ? args.emoji : settings.emoji,
    math: typeof args.math === "boolean" ? args.math : settings.math,
    math_options:
      args.math_options && typeof args.math_options === "object"
        ? normalizeMathOptions(args.math_options, settings.math_options)
        : settings.math_options,
    heading_anchors:
      typeof args.heading_anchors === "boolean"
        ? args.heading_anchors
        : settings.heading_anchors,
    toc: typeof args.toc === "boolean" ? args.toc : settings.toc,
    toc_options:
      args.toc_options && typeof args.toc_options === "object"
        ? normalizeTocOptions(args.toc_options, settings.toc_options)
        : settings.toc_options,
    display_header_footer:
      typeof args.display_header_footer === "boolean"
        ? args.display_header_footer
        : settings.display_header_footer,
    // Structured header/footer: a per-call object replaces the one from settings.
    header:
      args.header && typeof args.header === "object"
        ? args.header
        : settings.header,
    footer:
      args.footer && typeof args.footer === "object"
        ? args.footer
        : settings.footer,

    font_family:
      normalizeNonEmptyString(args.font_family) ?? settings.font_family,
  };
}

// ── Dependency loading ────────────────────────────────────────────────────────
// Packages are resolved by npm at install time. These two just preload the
// lazily-imported helpers used by lib/*.
let dependenciesPromise = null;

function ensureDependencies() {
  if (!dependenciesPromise) {
    dependenciesPromise = Promise.all([
      ensureYamlLoaded(),
      ensureDateFnsLoaded(),
    ]).catch((error) => {
      dependenciesPromise = null;
      throw error;
    });
  }
  return dependenciesPromise;
}

// ── Lazy module loading ───────────────────────────────────────────────────────
let chromiumSingleton = null;
async function getChromium() {
  if (!chromiumSingleton) {
    await ensureDependencies();
    const playwright = await import("playwright-core");
    chromiumSingleton = playwright.chromium;
  }
  return chromiumSingleton;
}

let hljs_module = null;
async function getHljs() {
  if (!hljs_module) {
    await ensureDependencies();
    hljs_module = (await import("highlight.js")).default;
  }
  return hljs_module;
}

let katexPlugin = null;
async function getKatexPlugin() {
  if (!katexPlugin) {
    await ensureDependencies();
    const mod = await import("@vscode/markdown-it-katex");
    // The CJS->ESM bridge nests the plugin under .default.default
    let plugin = mod.default ?? mod;
    if (typeof plugin !== "function" && typeof plugin?.default === "function") {
      plugin = plugin.default;
    }
    katexPlugin = plugin;
  }
  return katexPlugin;
}

let anchorPlugin = null;
async function getAnchorPlugin() {
  if (!anchorPlugin) {
    await ensureDependencies();
    const mod = await import("markdown-it-anchor");
    anchorPlugin = mod.default ?? mod;
  }
  return anchorPlugin;
}

let tocPlugin = null;
async function getTocPlugin() {
  if (!tocPlugin) {
    await ensureDependencies();
    const mod = await import("markdown-it-toc-done-right");
    tocPlugin = mod.default ?? mod;
  }
  return tocPlugin;
}

function ghSlugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^\w\sÀ-￿-]/g, "")
    .replace(/\s+/g, "-");
}

let emojiPlugin = null;
async function getEmojiPlugin() {
  if (!emojiPlugin) {
    await ensureDependencies();
    // markdown-it-emoji v3 uses named exports; `full` includes all emoji sets
    const mod = await import("markdown-it-emoji");
    emojiPlugin = mod.full ?? mod.bare ?? mod.default;
  }
  return emojiPlugin;
}

async function createMarkdown(options) {
  await ensureDependencies();
  const MarkdownIt = (await import("markdown-it")).default;

  let highlightFn = undefined;
  if (options.highlight) {
    const hljs = await getHljs();
    highlightFn = (str, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            '<pre class="hljs"><code>' +
            hljs.highlight(str, { language: lang, ignoreIllegals: true })
              .value +
            "</code></pre>"
          );
        } catch {
          // fall through to plain escaping
        }
      }
      return (
        '<pre class="hljs"><code>' +
        MarkdownIt().utils.escapeHtml(str) +
        "</code></pre>"
      );
    };
  }

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: options.breaks ?? false,
    highlight: highlightFn,
  });

  if (options.emoji) {
    try {
      const emoji = await getEmojiPlugin();
      md.use(emoji);
    } catch {
      debugLog("markdown-it-emoji not available, skipping emoji support");
    }
  }

  if (options.math) {
    try {
      const katex = await getKatexPlugin();
      // Inject our own katex so the rendered markup and the stylesheet
      // (vendor/katex-inline.css, built from the same package) always match.
      // The plugin's bundled katex is pinned to an older release line.
      const katexModule = await import("katex");
      md.use(katex, {
        katex: katexModule.default ?? katexModule,
        throwOnError: options.math_options.throw_on_error,
        errorColor: options.math_options.error_color,
        macros: options.math_options.macros,
      });
    } catch (error) {
      debugLog(
        `KaTeX plugin not available: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (options.heading_anchors || options.toc) {
    try {
      const anchor = await getAnchorPlugin();
      md.use(anchor, { permalink: false, slugify: ghSlugify });
    } catch (error) {
      debugLog(
        `markdown-it-anchor not available: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (options.toc) {
    try {
      const toc = await getTocPlugin();
      md.use(toc, {
        level: options.toc_options.level,
        listType: options.toc_options.list_type,
        containerClass: "markdown-toc",
        slugify: ghSlugify,
      });
    } catch (error) {
      debugLog(
        `markdown-it-toc-done-right not available: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return md;
}

// ── Browser setup ─────────────────────────────────────────────────────────────
// Order: system Chrome → system Edge → Playwright's own Chromium.
// Override with MARKDOWN_PDF_BROWSER = chrome | msedge | chromium | <path to executable>.
// A browser is NEVER downloaded implicitly — see installBrowser().
export const INSTALL_BROWSER_HINT = "npx -y markdown-pdf-export install-browser";

// Playwright's own Chromium. `install-browser` installs the full browser
// (`--no-shell`), which is selected with channel "chromium"; plain `{}` is the
// separate headless-shell build, tried last in case only that one is present.
const PLAYWRIGHT_CHROMIUM = [{ channel: "chromium" }, {}];

function browserCandidates() {
  const override = (process.env.MARKDOWN_PDF_BROWSER ?? "").trim();
  if (!override) {
    return [{ channel: "chrome" }, { channel: "msedge" }, ...PLAYWRIGHT_CHROMIUM];
  }
  if (override === "chromium") return PLAYWRIGHT_CHROMIUM;
  if (/^(chrome|msedge)(-(beta|dev|canary))?$/.test(override)) {
    return [{ channel: override }];
  }
  return [{ executablePath: path.resolve(override) }];
}

let workingBrowserOptions = null;

export async function launchBrowser() {
  const chromium = await getChromium();
  const candidates = workingBrowserOptions
    ? [workingBrowserOptions]
    : browserCandidates();
  const failures = [];

  for (const candidate of candidates) {
    try {
      const browser = await chromium.launch({ headless: true, ...candidate });
      workingBrowserOptions = candidate;
      debugLog(`browser launched: ${JSON.stringify(candidate)}`);
      return browser;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${JSON.stringify(candidate)} → ${message.split("\n")[0]}`);
    }
  }

  const message =
    `No usable Chrome/Chromium browser found.\n` +
    `Tried:\n  ${failures.join("\n  ")}\n` +
    `Install Google Chrome or Microsoft Edge, set MARKDOWN_PDF_BROWSER to a ` +
    `browser executable, or download Playwright's Chromium (~200 MB) with:\n` +
    `  ${INSTALL_BROWSER_HINT}`;
  debugLog(message);
  throw new Error(message);
}

/** Explicit, user-initiated download of Playwright's Chromium. */
export async function installBrowser({ onOutput } = {}) {
  const { spawn } = await import("node:child_process");
  // playwright-core's "exports" map does not expose ./cli.js, so locate the
  // package directory through its package.json and join the path.
  const playwrightCliPath = path.join(packageDir("playwright-core"), "cli.js");

  await new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [playwrightCliPath, "install", "--no-shell", "chromium"],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env } },
    );

    let output = "";
    const collect = (chunk) => {
      output += chunk.toString();
      onOutput?.(chunk.toString());
    };
    proc.stdout?.on("data", collect);
    proc.stderr?.on("data", collect);

    proc.on("exit", (code) => {
      if (code === 0) {
        workingBrowserOptions = null;
        resolve();
        return;
      }
      reject(new Error(`Chromium install failed (exit ${code}).\n${output.trim()}`));
    });
    proc.on("error", (error) =>
      reject(new Error(`Failed to start Chromium installer: ${error.message}`)),
    );
  });
}

// ── Tool implementations ──────────────────────────────────────────────────────
export async function doctorMarkdownPdf(args) {
  await ensureDependencies();
  const inputPath = args.input_path
    ? await resolveInputPath(args.input_path)
    : null;

  let browserInfo;
  try {
    const browser = await launchBrowser();
    const version = browser.version();
    await browser.close();

    browserInfo = {
      available: true,
      version,
      backend: "Chromium (Playwright)",
      launch_options: workingBrowserOptions,
    };
  } catch (error) {
    browserInfo = {
      available: false,
      error: error instanceof Error ? error.message : String(error),
      hint: `Install Chrome/Edge, set MARKDOWN_PDF_BROWSER, or run: ${INSTALL_BROWSER_HINT}`,
    };
  }

  const doc = resolveDocumentSettings(
    inputPath ? path.dirname(inputPath) : process.cwd(),
  );

  return {
    browser: browserInfo,
    settings_sources: doc.sources,
    settings: {
      stylesheet_path: doc.settings.stylesheet_path,
      output_directory: doc.settings.output_directory,
      assets_directory: doc.settings.assets_directory,
      open_after_export: doc.settings.open_after_export,
      page_format: doc.settings.page_format,
      orientation: doc.settings.orientation,
      scale: doc.settings.scale,
      page_ranges: doc.settings.page_ranges,
      print_background: doc.settings.print_background,
      margin: doc.settings.margin,
      include_default_styles: doc.settings.include_default_styles,
      highlight: doc.settings.highlight,
      highlight_style: doc.settings.highlight_style,
      breaks: doc.settings.breaks,
      emoji: doc.settings.emoji,
      display_header_footer: doc.settings.display_header_footer,
      font_family: doc.settings.font_family,
    },
    default_settings: DEFAULT_SETTINGS,
    server_dir: SERVER_DIR,
    input_path: inputPath,
    debug_log: DEBUG_LOG,
  };
}

export async function exportMarkdownPdf(args) {
  await ensureDependencies();
  const inputPath = await resolveInputPath(args.input_path);
  debugLog(`exportMarkdownPdf args: ${JSON.stringify(args)}`);
  debugLog(
    `exportMarkdownPdf args.display_header_footer: ${args.display_header_footer} (type: ${typeof args.display_header_footer})`,
  );

  // ── Step 1: Read source and parse front matter ────────────────────────────
  const source = await fs.readFile(inputPath, "utf8");
  const filename = path.basename(inputPath);

  const {
    data: frontMatterData,
    body: markdownBody,
    validation: fmValidation,
    parseError: fmParseError,
  } = parseFrontMatter(source, { filename, validate: true });

  if (fmParseError) {
    debugLog(`Front matter parse error: ${fmParseError}`);
  }
  if (fmValidation && !fmValidation.valid) {
    debugLog(
      `Front matter validation errors: ${JSON.stringify(fmValidation.errors)}`,
    );
  }
  if (fmValidation && fmValidation.warnings.length > 0) {
    debugLog(
      `Front matter validation warnings: ${JSON.stringify(fmValidation.warnings)}`,
    );
  }

  const {
    title,
    author,
    pdfConfig: frontMatterPdfConfig,
    customVariables,
  } = frontMatterData;
  debugLog(
    `Parsed front matter - title: ${title}, author: ${author}, pdfConfig: ${JSON.stringify(frontMatterPdfConfig)}`,
  );

  // ── Step 2: Build effective options from args (tool call params) ──────────
  const { settings: docSettings, sources: settingsSources } =
    resolveDocumentSettings(path.dirname(inputPath));
  debugLog(`settings sources: ${JSON.stringify(settingsSources)}`);
  const options = buildEffectiveOptions(args, docSettings);
  debugLog(
    `exportMarkdownPdf options.display_header_footer: ${options.display_header_footer}`,
  );

  // ── Step 3: Merge config (defaults < settings < front matter) ─────────────
  // Build settings object from current options (which already merged args with global settings)
  const settingsForMerge = {
    page_format: options.page_format,
    orientation: options.orientation,
    scale: options.scale,
    page_ranges: options.page_ranges,
    print_background: options.print_background,
    margin: options.margin,
    font_family: options.font_family,
    include_default_styles: options.include_default_styles,
    highlight: options.highlight,
    highlight_style: options.highlight_style,
    breaks: options.breaks,
    emoji: options.emoji,
    display_header_footer: options.display_header_footer,
    // Structured header/footer from the call arguments, else from settings
    header: options.header || null,
    footer: options.footer || null,
  };

  const { config: mergedConfig, hasHeaderFooter } = mergeConfig(
    settingsForMerge,
    frontMatterPdfConfig,
    {
      applyDefaults: false,
    },
  );

  debugLog(`hasHeaderFooter: ${hasHeaderFooter}`);
  debugLog(`Merged config: ${JSON.stringify(mergedConfig)}`);

  // Override options with merged config values that may have come from front matter
  const effectiveOptions = {
    ...options,
    page_format: mergedConfig.page_format ?? options.page_format,
    orientation: mergedConfig.orientation ?? options.orientation,
    scale: mergedConfig.scale ?? options.scale,
    page_ranges: mergedConfig.page_ranges ?? options.page_ranges,
    print_background: mergedConfig.print_background ?? options.print_background,
    margin: mergedConfig.margin ?? options.margin,
    font_family: mergedConfig.font_family ?? options.font_family,
    include_default_styles:
      mergedConfig.include_default_styles ?? options.include_default_styles,
    highlight: mergedConfig.highlight ?? options.highlight,
    highlight_style: mergedConfig.highlight_style ?? options.highlight_style,
    breaks: mergedConfig.breaks ?? options.breaks,
    emoji: mergedConfig.emoji ?? options.emoji,
    math: mergedConfig.math ?? options.math,
    math_options:
      mergedConfig.math_options ?? options.math_options,
    heading_anchors:
      mergedConfig.heading_anchors ?? options.heading_anchors,
    toc: mergedConfig.toc ?? options.toc,
    toc_options: mergedConfig.toc_options ?? options.toc_options,
    display_header_footer:
      hasHeaderFooter ||
      mergedConfig.display_header_footer ||
      options.display_header_footer,
  };

  const outputPath = await resolveOutputPath(
    inputPath,
    options.output_path,
    docSettings,
  );

  // ── Step 4: Render Markdown to HTML ───────────────────────────────────────
  const { html } = await renderMarkdownToHtmlWithBody(
    inputPath,
    markdownBody,
    title,
    effectiveOptions,
  );

  const browser = await launchBrowser();

  let displayHeaderFooterResult;

  try {
    const page = await browser.newPage();

    // Write HTML to a uniquely-named temp file so parallel exports don't collide
    const { randomUUID } = await import('node:crypto');
    const tempHtmlPath = path.join(path.dirname(inputPath), `.${randomUUID()}.temp_render.html`);
    await fs.writeFile(tempHtmlPath, html, 'utf8');

    try {
      const tempUrl = pathToFileURL(tempHtmlPath).href;
      await page.goto(tempUrl, { waitUntil: "networkidle" });
    } finally {
      try {
        await fs.unlink(tempHtmlPath);
      } catch {
        // ignore cleanup errors
      }
    }

    const pdfOptions = {
      path: outputPath,
      format: effectiveOptions.page_format,
      landscape: effectiveOptions.orientation === "landscape",
      scale: effectiveOptions.scale,
      printBackground: effectiveOptions.print_background,
      margin: effectiveOptions.margin,
    };

    if (
      effectiveOptions.page_ranges &&
      effectiveOptions.page_ranges.trim() !== ""
    ) {
      pdfOptions.pageRanges = effectiveOptions.page_ranges;
    }

    debugLog(`pdfOptions before header/footer: ${JSON.stringify(pdfOptions)}`);
    debugLog(`hasHeaderFooter: ${hasHeaderFooter}`);

    // ── Step 5: Generate header/footer templates ────────────────────────────
    if (hasHeaderFooter || effectiveOptions.display_header_footer) {
      debugLog("BRANCH: header/footer is enabled");
      pdfOptions.displayHeaderFooter = true;

      // Create render context for placeholders
      const renderContext = createRenderContext({
        inputPath,
        title: title || "",
        author: author || "",
        frontMatter: { ...customVariables },
        now: new Date(),
      });

      // Create resolvers
      const placeholderResolver = createPlaceholderResolver(renderContext);
      const assetResolver = createAssetResolver({
        basePath: inputPath,
        assetsDirectory: docSettings.assets_directory,
      });

      // Create HTML generator
      const htmlGenerator = createHtmlGenerator({
        placeholderResolver,
        assetResolver,
        fontFamily: effectiveOptions.font_family,
      });

      // Generate header template
      if (mergedConfig.header) {
        try {
          pdfOptions.headerTemplate = await htmlGenerator.generateHeader(
            mergedConfig.header,
          );
          debugLog(
            `Generated structured header: ${pdfOptions.headerTemplate.substring(0, 200)}...`,
          );
        } catch (err) {
          debugLog(`Error generating structured header: ${err.message}`);
          pdfOptions.headerTemplate = "<span></span>";
        }
      } else {
        pdfOptions.headerTemplate = "<span></span>";
      }

      // Generate footer template
      if (mergedConfig.footer) {
        try {
          pdfOptions.footerTemplate = await htmlGenerator.generateFooter(
            mergedConfig.footer,
          );
          debugLog(
            `Generated structured footer: ${pdfOptions.footerTemplate.substring(0, 200)}...`,
          );
        } catch (err) {
          debugLog(`Error generating structured footer: ${err.message}`);
          pdfOptions.footerTemplate = "<span></span>";
        }
      } else {
        pdfOptions.footerTemplate = "<span></span>";
      }

      // Log any asset warnings
      const assetWarnings = assetResolver.getWarnings();
      if (assetWarnings.length > 0) {
        debugLog(`Asset warnings: ${JSON.stringify(assetWarnings)}`);
      }
    } else {
      debugLog("BRANCH: header/footer is disabled");
      pdfOptions.displayHeaderFooter = false;
      pdfOptions.headerTemplate = "";
      pdfOptions.footerTemplate = "";
    }

    debugLog(`final pdfOptions: ${JSON.stringify(pdfOptions)}`);
    displayHeaderFooterResult = pdfOptions.displayHeaderFooter;
    await page.pdf(pdfOptions);
  } finally {
    await browser.close();
  }

  if (effectiveOptions.open_after_export) {
    void openFile(outputPath);
  }

  return {
    input_path: inputPath,
    output_path: outputPath,
    backend: "Playwright/Chromium",
    page_format: effectiveOptions.page_format,
    orientation: effectiveOptions.orientation,
    scale: effectiveOptions.scale,
    print_background: effectiveOptions.print_background,
    margin: effectiveOptions.margin,
    open_after_export: effectiveOptions.open_after_export,
    display_header_footer: displayHeaderFooterResult,
    settings_files: settingsSources
      .filter((source) => source.loaded && source.path)
      .map((source) => source.path),
  };
}

// ── Path helpers ──────────────────────────────────────────────────────────────
async function resolveInputPath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") {
    throw new Error("input_path must be a non-empty string");
  }

  const absolutePath = path.resolve(inputPath);
  await assertFileExists(absolutePath, "Markdown input");
  return absolutePath;
}

async function resolveOutputPath(inputPath, outputPath, settings) {
  if (typeof outputPath === "string" && outputPath.trim() !== "") {
    const resolved = path.resolve(path.dirname(inputPath), outputPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    return resolved;
  }

  const baseDirectory = settings.output_directory
    ? path.resolve(path.dirname(inputPath), settings.output_directory)
    : path.dirname(inputPath);

  await fs.mkdir(baseDirectory, { recursive: true });
  return path.join(baseDirectory, `${path.parse(inputPath).name}.pdf`);
}

function resolveStylesheetPath(baseDirectory, stylesheetPath) {
  if (!stylesheetPath) return null;
  return path.resolve(baseDirectory, stylesheetPath);
}

// ── HTML rendering ────────────────────────────────────────────────────────────

/**
 * Render Markdown to HTML with pre-parsed body and title.
 * Used by the new structured header/footer pipeline where front matter
 * is already parsed.
 */
async function renderMarkdownToHtmlWithBody(inputPath, body, title, options) {
  const markdown = await createMarkdown(options);
  const rendered = markdown.render(body);

  // Build style blocks
  let styleBlocks = "";

  if (options.include_default_styles) {
    const defaultCss = await fs.readFile(DEFAULT_CSS_PATH, "utf8");
    styleBlocks += `<style>${defaultCss}</style>\n    `;
  }

  // Font family override (after default CSS so it wins over the root stack)
  if (options.font_family) {
    styleBlocks += `<style>:root { font-family: ${options.font_family}; }</style>\n    `;
  }

  // KaTeX stylesheet (with inlined fonts when bundled, else read from node_modules)
  if (options.math) {
    try {
      const vendorCss = path.join(SERVER_DIR, "vendor", "katex-inline.css");
      const katexCssPath = (await fileExists(vendorCss))
        ? vendorCss
        : path.join(packageDir("katex"), "dist", "katex.min.css");
      const katexCss = await fs.readFile(katexCssPath, "utf8");
      styleBlocks += `<style>${katexCss}</style>\n    `;
    } catch (error) {
      debugLog(
        `Could not load KaTeX CSS: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Highlight.js stylesheet
  if (options.highlight && options.highlight_style) {
    try {
      const hljsStylesDir = path.join(packageDir("highlight.js"), "styles");
      const hljsCssPath = path.join(hljsStylesDir, options.highlight_style);
      const hljsCss = await fs.readFile(hljsCssPath, "utf8");
      styleBlocks += `<style>${hljsCss}</style>\n    `;
    } catch {
      debugLog(`Could not load highlight style: ${options.highlight_style}`);
    }
  }

  // Custom stylesheet
  const stylesheetPath = resolveStylesheetPath(
    path.dirname(inputPath),
    options.stylesheet_path,
  );
  if (stylesheetPath) {
    try {
      const customCss = await fs.readFile(stylesheetPath, "utf8");
      styleBlocks += `<style>${customCss}</style>\n    `;
    } catch {
      debugLog(`Could not load stylesheet: ${stylesheetPath}`);
    }
  }

  const baseHref = `${pathToFileURL(path.dirname(inputPath)).href}/`;

  return {
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <base href="${baseHref}">
    ${styleBlocks}
  </head>
  <body>
    <main>
      ${rendered}
    </main>
  </body>
</html>`,
    title,
  };
}

// ── Filesystem helpers ────────────────────────────────────────────────────────
async function assertFileExists(filePath, label) {
  if (!(await fileExists(filePath))) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

async function fileExists(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

// ── Open file with OS default application ─────────────────────────────────────
async function openFile(filePath) {
  const { spawn } = await import("node:child_process");

  let command;
  let args;

  if (process.platform === "darwin") {
    command = "open";
    args = [filePath];
  } else if (process.platform === "win32") {
    command = "cmd";
    args = ["/C", "start", "", filePath];
  } else {
    command = "xdg-open";
    args = [filePath];
  }

  spawn(command, args, {
    detached: true,
    stdio: "ignore",
  }).unref();
}

// ── Misc utilities ────────────────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
