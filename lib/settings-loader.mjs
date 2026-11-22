/**
 * @fileoverview Settings file discovery and reading.
 *
 * Layers (lowest to highest priority), resolved by export.mjs:
 *   1. built-in defaults
 *   2. user file  ($XDG_CONFIG_HOME/markdown-pdf-export/settings.json,
 *                  %APPDATA%\markdown-pdf-export\settings.json on Windows)
 *      — or MARKDOWN_PDF_SETTINGS / --settings, which replace it
 *   3. project file (nearest .markdown-pdf.json walking up from the Markdown file)
 *
 * Relative paths written inside a settings file resolve against that file's
 * directory, so a global logo needs no absolute path.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyPresets } from "./looks.mjs";

export const APP_DIR_NAME = "markdown-pdf-export";
export const USER_SETTINGS_FILENAME = "settings.json";
export const PROJECT_SETTINGS_FILENAME = ".markdown-pdf.json";

/**
 * Default location of the user settings file.
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [platform]
 * @param {string} [home]
 * @returns {string}
 */
export function userSettingsPath(
  env = process.env,
  platform = process.platform,
  home = os.homedir(),
) {
  if (platform === "win32") {
    const appData = env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, APP_DIR_NAME, USER_SETTINGS_FILENAME);
  }
  const base = env.XDG_CONFIG_HOME
    ? env.XDG_CONFIG_HOME
    : path.join(home, ".config");
  return path.join(base, APP_DIR_NAME, USER_SETTINGS_FILENAME);
}

/**
 * Find the nearest project settings file, walking up from `startDir`.
 * @param {string} startDir
 * @returns {string|null}
 */
export function findProjectSettingsFile(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, PROJECT_SETTINGS_FILENAME);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not here — keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const isPlainObject = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Paths we must not touch: absolute, ~, @/ asset alias, URLs, data URIs. */
function isRewritable(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (/^(~|@[\\/]|[a-z][a-z0-9+.-]*:)/i.test(value)) return false; // ~, @/, scheme:, C:
  return !path.isAbsolute(value);
}

const IMAGE_SHORTHANDS = new Set(["left_image", "center_image", "right_image"]);

function rewriteImages(node, dir) {
  if (Array.isArray(node)) {
    for (const item of node) rewriteImages(item, dir);
    return;
  }
  if (!isPlainObject(node)) return;
  if (node.type === "image" && isRewritable(node.src)) {
    node.src = path.resolve(dir, node.src);
  }
  for (const [key, value] of Object.entries(node)) {
    if (IMAGE_SHORTHANDS.has(key) && isRewritable(value)) {
      node[key] = path.resolve(dir, value);
    } else if (typeof value === "object") {
      rewriteImages(value, dir);
    }
  }
}

/**
 * Resolve relative asset paths in parsed settings against `dir`.
 * Returns a new object; the input is not mutated.
 * @param {object} data
 * @param {string} dir
 */
export function resolveSettingsPaths(data, dir) {
  if (!isPlainObject(data)) return data;
  const out = structuredClone(data);
  for (const key of ["stylesheet_path", "assets_directory"]) {
    if (isRewritable(out[key])) out[key] = path.resolve(dir, out[key]);
  }
  rewriteImages(out.header, dir);
  rewriteImages(out.footer, dir);
  return out;
}

/**
 * Parsed settings → what the engine consumes: presets expanded, relative
 * paths resolved against `dir`.
 * @param {object} parsed
 * @param {string} dir
 * @returns {{data: object, warnings: string[]}}
 */
export function prepareSettings(parsed, dir) {
  const { data, warnings } = applyPresets(parsed);
  return { data: resolveSettingsPaths(data, dir), warnings };
}

/**
 * Expand a leading `~`, `~/` or `$HOME` to the home directory. Anything else
 * (including `~user/...`) is returned unchanged.
 * @param {string} file
 * @param {string} [home]
 * @returns {string}
 */
export function expandHomePath(file, home = os.homedir()) {
  if (!home) return file;
  if (file === "~" || file === "$HOME") return home;
  if (file.startsWith("~/") || file.startsWith("~\\")) {
    return path.join(home, file.slice(2));
  }
  if (file.startsWith("$HOME/") || file.startsWith("$HOME\\")) {
    return path.join(home, file.slice("$HOME/".length));
  }
  return file;
}

/**
 * Read and parse a settings file.
 * @param {string} file
 * @returns {{path: string, data: object|null, error: string|null}}
 */
export function readSettingsFile(file) {
  const abs = path.resolve(expandHomePath(file));
  let text;
  try {
    text = fs.readFileSync(abs, "utf8");
  } catch (error) {
    return { path: abs, data: null, error: `cannot read: ${error.message}` };
  }
  try {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, "")); // PowerShell 5 writes a BOM
    if (!isPlainObject(parsed)) {
      return { path: abs, data: null, error: "top level must be a JSON object" };
    }
    const { data, warnings } = prepareSettings(parsed, path.dirname(abs));
    for (const w of warnings) console.error(`[markdown-pdf] ⚠️  ${abs}: ${w}`);
    return { path: abs, data, error: null };
  } catch (error) {
    return { path: abs, data: null, error: `invalid JSON: ${error.message}` };
  }
}

/**
 * Deep-merge plain objects (arrays and scalars in `over` replace `base`).
 * @param {object} base
 * @param {object} over
 */
export function deepMerge(base, over) {
  if (!isPlainObject(base)) return structuredClone(over);
  if (!isPlainObject(over)) return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    out[key] =
      isPlainObject(value) && isPlainObject(out[key])
        ? deepMerge(out[key], value)
        : structuredClone(value);
  }
  return out;
}
