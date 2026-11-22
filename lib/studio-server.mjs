/**
 * @fileoverview Studio: a local page for designing the PDF layout with a live
 * preview drawn by the real engine.
 *
 * This server writes files and starts a browser, so it is deliberately narrow:
 *   - listens on 127.0.0.1 only
 *   - every /api call needs the per-launch token in the x-studio-token header
 *     (a custom header also forces a CORS preflight, which is never answered)
 *   - Host and Origin must be this server (blocks DNS rebinding)
 *   - writes go to the settings file and its assets/ folder, nowhere else
 *   - exits by itself when the page has been closed for a while
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_PAGE_FORMATS,
  HIGHLIGHT_STYLES,
  SERVER_VERSION,
  doctorMarkdownPdf,
  exportMarkdownPdf,
  setProjectDiscovery,
  setSettings,
} from "../export.mjs";
import { CODE_THEMES, FONTS, FONT_LABELS, LOOKS, TEMPLATES, readTemplate } from "./looks.mjs";
import { SETTINGS_SCHEMA_URL } from "./settings-schema.mjs";
import {
  PROJECT_SETTINGS_FILENAME,
  deepMerge,
  findProjectSettingsFile,
  prepareSettings,
  readSettingsFile,
  userSettingsPath,
} from "./settings-loader.mjs";
import {
  EDITOR_IDS,
  applySetupItem,
  buildEditorSetup,
  editorStatus,
  launchSpec,
  pendingItems,
} from "./editor-setup.mjs";
import { IMAGE_FORMATS } from "./types.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUDIO_DIR = path.join(ROOT, "studio");

/** The only files the server hands out. */
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
  "/app.mjs": ["app.mjs", "text/javascript; charset=utf-8"],
  "/model.mjs": ["model.mjs", "text/javascript; charset=utf-8"],
};

/** List of logo files Studio uploaded, kept next to them. */
const MANIFEST = ".studio-files.json";

const MAX_JSON = 1024 * 1024;
/** A preview request of an embedded Studio may carry the document's unsaved text. */
const MAX_PREVIEW_JSON = 16 * 1024 * 1024;
/** Keeps the report header small whatever the document holds. */
const MAX_REPORT_ITEMS = 20;
const MAX_REPORT_TEXT = 300;
const MAX_LOGO = 5 * 1024 * 1024;

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; frame-src blob:; img-src 'self' blob: data:; object-src blob:; base-uri 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sameToken(given, expected) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        // Keep reading (and discarding) so the answer reaches the sender.
        chunks.length = 0;
        reject(new HttpError(413, `Too large (limit ${Math.round(limit / 1024 / 1024)} MB).`));
        return;
      }
      if (size <= limit) chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req, limit = MAX_JSON) {
  const body = await readBody(req, limit);
  try {
    const parsed = JSON.parse(body.toString("utf8") || "{}");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, "Body must be a JSON object.");
  }
}

/** Keep a logo file name harmless: no folders, plain characters, known image type. */
export function safeLogoName(name) {
  const base = path.basename(String(name ?? "").replaceAll("\\", "/"));
  const ext = path.extname(base).toLowerCase();
  if (!IMAGE_FORMATS[ext]) return null;
  const stem = base
    .slice(0, -ext.length)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${stem || "logo"}${ext}`;
}

/**
 * Image files a header/footer points to that are not on disk. The engine
 * skips them quietly; in Studio the person choosing a logo needs to be told.
 * @param {object} settings  prepared settings (paths already absolute)
 * @returns {string[]}
 */
export function missingImages(settings) {
  return imageRefs(settings).filter((value) => path.isAbsolute(value) && !fs.existsSync(value));
}

/** Every image path a header/footer refers to (shorthand keys and structured elements). */
export function imageRefs(settings) {
  const refs = [];
  const add = (value) => {
    if (typeof value === "string" && value) refs.push(value);
  };
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node === null || typeof node !== "object") return;
    if (node.type === "image") add(node.src);
    for (const [key, value] of Object.entries(node)) {
      if (/^(left|center|right)_image$/.test(key)) add(value);
      else if (typeof value === "object") walk(value);
    }
  };
  walk(settings?.header);
  walk(settings?.footer);
  return refs;
}

/**
 * What a preview had to change or leave out, as a response header value: an
 * editor showing Studio in its own panel reports it next to the document.
 * @param {{removed_html?: string[], diagram_errors?: string[]}} result
 * @returns {string}
 */
export function previewReport(result) {
  const list = (items) =>
    (items ?? []).slice(0, MAX_REPORT_ITEMS).map((item) => String(item).slice(0, MAX_REPORT_TEXT));
  return encodeURIComponent(
    JSON.stringify({ removed_html: list(result.removed_html), diagram_errors: list(result.diagram_errors) }),
  );
}

/**
 * @param {object} [opts]
 * @param {"user"|"project"} [opts.scope]   which settings file Studio edits
 * @param {string} [opts.cwd]               project folder for scope "project"
 * @param {string} [opts.file]              Markdown file to preview (default: built-in sample)
 * @param {boolean} [opts.projectSettings]  false: ignore the .markdown-pdf.json near `file`
 * @param {boolean} [opts.embedded]         an editor shows the page in its own panel and holds the
 *   token itself: each preview request may name the document to draw (and its unsaved text), and
 *   the "Add to my editor" steps are switched off
 * @param {number} [opts.port]              0 = any free port
 * @param {number} [opts.idleMs]            exit after this long without a request
 * @param {() => void} [opts.onIdle]
 * @returns {Promise<{url: string, port: number, token: string, settingsPath: string, close: () => Promise<void>}>}
 */
export async function startStudio(opts = {}) {
  const scope = opts.scope === "project" ? "project" : "user";
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const settingsPath =
    scope === "project" ? path.join(cwd, PROJECT_SETTINGS_FILENAME) : userSettingsPath();
  const settingsDir = path.dirname(settingsPath);
  const previewFile = opts.file ? path.resolve(opts.file) : path.join(STUDIO_DIR, "sample.md");
  if (!fs.statSync(previewFile, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Cannot read ${previewFile}`);
  }
  const token = crypto.randomBytes(24).toString("hex");
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-studio-"));
  const idleMs = opts.idleMs ?? 5 * 60 * 1000;
  let port = 0;
  let idleTimer = null;

  const touch = () => {
    clearTimeout(idleTimer);
    if (idleMs > 0 && opts.onIdle) {
      idleTimer = setTimeout(opts.onIdle, idleMs);
      idleTimer.unref();
    }
  };

  // ── logo files ─────────────────────────────────────────────────────────────
  // Studio removes logos nobody uses any more, but only its own: files it
  // uploaded (listed in a small manifest) and, in the user settings folder,
  // files the saved layout pointed to. A project's assets/ folder may hold
  // files Studio knows nothing about, so nothing else there is ever touched.
  const assetsDir = path.join(settingsDir, "assets");
  const manifestPath = path.join(assetsDir, MANIFEST);

  const readManifest = () => {
    try {
      const list = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      return new Set(Array.isArray(list) ? list.filter((n) => typeof n === "string") : []);
    } catch {
      return new Set();
    }
  };
  const writeManifest = (names) => {
    if (names.size === 0) fs.rmSync(manifestPath, { force: true });
    else fs.writeFileSync(manifestPath, `${JSON.stringify([...names].sort(), null, 2)}\n`);
  };
  /** File names inside assets/ that a settings object uses as header/footer images. */
  const logosUsedBy = (settings) => {
    const used = new Set();
    for (const value of imageRefs(settings)) {
      if (/^(~|@[\\/]|[a-z][a-z0-9+.-]*:)/i.test(value) && !path.isAbsolute(value)) continue;
      const abs = path.resolve(settingsDir, value);
      if (path.dirname(abs) === assetsDir) used.add(path.basename(abs));
    }
    return used;
  };
  const removeUnusedLogos = (before, after) => {
    const manifest = readManifest();
    const candidates = new Set(manifest);
    if (scope === "user") for (const name of logosUsedBy(before)) candidates.add(name);
    const keep = logosUsedBy(after);
    const removed = [];
    for (const name of candidates) {
      if (keep.has(name)) continue;
      manifest.delete(name);
      const file = path.join(assetsDir, name);
      const plainName = path.basename(name) === name && IMAGE_FORMATS[path.extname(name).toLowerCase()];
      if (!plainName || !fs.lstatSync(file, { throwIfNoEntry: false })?.isFile()) continue;
      fs.rmSync(file, { force: true });
      removed.push(name);
    }
    if (fs.existsSync(assetsDir)) {
      writeManifest(manifest);
      if (fs.readdirSync(assetsDir).length === 0) fs.rmdirSync(assetsDir);
    }
    return removed;
  };

  // ── settings file ──────────────────────────────────────────────────────────
  const readRaw = () => {
    if (!fs.existsSync(settingsPath)) return { exists: false, raw: {}, error: null };
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8").replace(/^\uFEFF/, ""));
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { exists: true, raw: {}, error: "The file does not contain a JSON object." };
      }
      return { exists: true, raw: parsed, error: null };
    } catch (error) {
      return { exists: true, raw: {}, error: `The file is not valid JSON: ${error.message}` };
    }
  };

  const state = () => {
    const file = readRaw();
    const templates = {};
    for (const name of TEMPLATES) templates[name] = readTemplate(name);
    const looks = {};
    for (const [name, def] of Object.entries(LOOKS)) {
      looks[name] = {
        description: def.description,
        margin: def.settings.margin ?? null,
        highlight: def.settings.highlight_style ?? null,
        accent: def.accent ?? null,
      };
    }
    return {
      version: SERVER_VERSION,
      scope,
      settingsPath,
      displayPath: settingsPath.startsWith(os.homedir())
        ? `~${settingsPath.slice(os.homedir().length)}`
        : settingsPath,
      exists: file.exists,
      fileError: file.error,
      raw: file.raw,
      looks,
      fonts: FONTS,
      fontLabels: FONT_LABELS,
      codeThemes: CODE_THEMES.filter((t) => HIGHLIGHT_STYLES.has(t.file)),
      pageFormats: [...ALLOWED_PAGE_FORMATS],
      templates,
      preview: {
        name: path.basename(previewFile),
        sample: !opts.file,
      },
      envOverride: Boolean((process.env.MARKDOWN_PDF_SETTINGS ?? "").trim()),
      embedded: Boolean(opts.embedded),
    };
  };

  const save = (settings) => {
    const before = readRaw().raw;
    const rest = { ...settings };
    delete rest.$schema;
    const text = `${JSON.stringify({ $schema: SETTINGS_SCHEMA_URL, ...rest }, null, 2)}\n`;
    fs.mkdirSync(settingsDir, { recursive: true });
    let backup = null;
    if (fs.existsSync(settingsPath)) {
      backup = `${settingsPath}.bak`;
      fs.copyFileSync(settingsPath, backup);
    }
    const tmp = `${settingsPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, settingsPath);
    // Only after the new layout is safely on disk: drop logos it replaced.
    return { path: settingsPath, backup, removed: removeUnusedLogos(before, rest) };
  };

  const saveLogo = (name, bytes) => {
    const safe = safeLogoName(name);
    if (!safe) {
      throw new HttpError(
        415,
        `Use an image file (${Object.keys(IMAGE_FORMATS).join(", ")}).`,
      );
    }
    if (bytes.length === 0) throw new HttpError(400, "The file is empty.");
    const dir = assetsDir;
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(safe);
    const stem = safe.slice(0, -ext.length);
    // Never overwrite a different file: reuse an identical one or add a number.
    for (let n = 0; n < 100; n++) {
      const candidate = path.join(dir, n === 0 ? safe : `${stem}-${n}${ext}`);
      if (!fs.existsSync(candidate)) {
        fs.writeFileSync(candidate, bytes, { flag: "wx" });
        writeManifest(readManifest().add(path.basename(candidate))); // ours to clean up later
        return { path: `assets/${path.basename(candidate)}` };
      }
      if (fs.readFileSync(candidate).equals(bytes)) {
        return { path: `assets/${path.basename(candidate)}` };
      }
    }
    throw new HttpError(409, "Too many files with that name.");
  };

  // ── preview: one render at a time, the newest request wins ──────────────────
  let rendering = Promise.resolve();
  let renderSeq = 0;

  /**
   * The document one preview request draws: the one Studio was started with,
   * or, for an embedded Studio only, the one the request names.
   */
  const previewDocument = (source) => {
    if (source === undefined) return { file: previewFile, text: undefined, own: Boolean(opts.file), named: false };
    if (!opts.embedded) throw new HttpError(400, "source is only accepted by a Studio started with --embedded.");
    const valid =
      source !== null &&
      typeof source === "object" &&
      typeof source.file === "string" &&
      path.isAbsolute(source.file) &&
      (source.text === undefined || typeof source.text === "string");
    if (!valid) throw new HttpError(400, "source needs an absolute file path and, optionally, its text.");
    if (!fs.statSync(source.file, { throwIfNoEntry: false })?.isFile()) {
      throw new HttpError(422, `Cannot read ${source.file}`);
    }
    return { file: path.resolve(source.file), text: source.text, own: true, named: true };
  };

  const render = (settings, doc) => {
    const seq = ++renderSeq;
    const job = rendering.then(async () => {
      if (seq !== renderSeq) throw new HttpError(409, "Superseded by a newer preview.");
      const { data } = prepareSettings(settings, settingsDir);
      // Rebuild the layers the real export would use, with the draft in place
      // of the file being edited.
      let stack = data;
      if (scope === "project") {
        const user = fs.existsSync(userSettingsPath()) ? readSettingsFile(userSettingsPath()) : null;
        if (user?.data) stack = deepMerge(user.data, data);
      } else if (doc.own && opts.projectSettings !== false) {
        const projectFile = findProjectSettingsFile(path.dirname(doc.file));
        const project = projectFile ? readSettingsFile(projectFile) : null;
        if (project?.data) stack = deepMerge(data, project.data);
      }
      const missing = missingImages(stack);
      if (missing.length) {
        throw new HttpError(422, `This image file was not found:\n${missing.join("\n")}`);
      }
      setProjectDiscovery(false);
      setSettings(stack, settingsPath);
      const output = path.join(workDir, `preview-${seq}.pdf`);
      const started = Date.now();
      const result = await exportMarkdownPdf(
        { input_path: doc.file, output_path: output, open_after_export: false },
        { source: doc.text },
      );
      const pdf = fs.readFileSync(output);
      fs.rmSync(output, { force: true });
      return { pdf, ms: Date.now() - started, result };
    });
    rendering = job.catch(() => {});
    return job;
  };

  // ── editors ────────────────────────────────────────────────────────────────
  const editors = () => {
    const launch = launchSpec(path.join(ROOT, "cli.mjs"));
    return EDITOR_IDS.map((id) => buildEditorSetup(id, launch));
  };

  // ── http ───────────────────────────────────────────────────────────────────
  const send = (res, status, body, type = "application/json; charset=utf-8", extra = {}) => {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(type.startsWith("application/json") ? JSON.stringify(body) : body);
    res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": type, "Content-Length": payload.length, ...extra });
    res.end(payload);
  };

  const api = async (req, res, route, query) => {
    if (!sameToken(req.headers["x-studio-token"], token)) throw new HttpError(401, "Missing or wrong token.");
    touch();

    if (req.method === "GET" && route === "/api/state") return send(res, 200, state());
    // An editor that embeds Studio is already set up; its panel has no say over other editors.
    if (opts.embedded && route.startsWith("/api/editors")) throw new HttpError(404, "Not found.");
    if (req.method === "GET" && route === "/api/editors") {
      const status = Object.fromEntries(editorStatus().map((e) => [e.id, e]));
      return send(
        res,
        200,
        editors().map((e) => {
          const todo = new Set(pendingItems(e, status[e.id]));
          return {
            id: e.id,
            name: e.name,
            detected: e.detected || Boolean(status[e.id]?.detected),
            items: e.items.map((i) => ({
              kind: i.kind,
              label: i.label,
              file: i.file ?? null,
              snippet: i.snippet,
              write: i.write,
              // not set up yet, and applies on this computer
              pending: todo.has(i),
            })),
          };
        }),
      );
    }
    if (req.method === "GET" && route === "/api/check") {
      const report = await doctorMarkdownPdf({});
      return send(res, 200, { browser: report.browser });
    }
    if (req.method !== "POST") throw new HttpError(404, "Not found.");

    if (route === "/api/ping") return send(res, 200, { ok: true });
    if (route === "/api/preview") {
      const { settings, source } = await readJson(req, opts.embedded ? MAX_PREVIEW_JSON : MAX_JSON);
      if (!settings || typeof settings !== "object") throw new HttpError(400, "settings is required.");
      const doc = previewDocument(source);
      try {
        const { pdf, ms, result } = await render(settings, doc);
        return send(res, 200, pdf, "application/pdf", {
          "X-Render-Ms": String(ms),
          "X-Preview-Report": previewReport(result),
          ...(doc.named ? { "X-Preview-Name": encodeURIComponent(path.basename(doc.file)) } : {}),
        });
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(422, error instanceof Error ? error.message : String(error));
      }
    }
    if (route === "/api/save") {
      const { settings } = await readJson(req);
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new HttpError(400, "settings is required.");
      }
      return send(res, 200, save(settings));
    }
    if (route === "/api/logo") {
      const bytes = await readBody(req, MAX_LOGO);
      return send(res, 200, saveLogo(query.get("name"), bytes));
    }
    if (route === "/api/editors/apply") {
      const { id, index } = await readJson(req);
      const editor = editors().find((e) => e.id === id);
      const item = editor?.items[index];
      if (!item) throw new HttpError(404, "Unknown editor step.");
      if (item.write === "print") throw new HttpError(409, "That file already exists: paste the snippet yourself.");
      // Adding to an existing file is not idempotent: never add the same step twice.
      const status = editorStatus().find((e) => e.id === id);
      if (!pendingItems(editor, status).includes(item)) {
        throw new HttpError(409, "Already set up.");
      }
      return send(res, 200, applySetupItem(item, { stdio: "ignore" }));
    }
    throw new HttpError(404, "Not found.");
  };

  const server = http.createServer((req, res) => {
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    const origin = req.headers.origin;
    const fail = (status, message) => send(res, status, { error: message });

    if (!allowedHosts.has(req.headers.host ?? "")) return fail(403, "Wrong host.");
    if (origin && !allowedHosts.has(origin.replace(/^http:\/\//, ""))) return fail(403, "Wrong origin.");
    if (req.headers["sec-fetch-site"] === "cross-site") return fail(403, "Cross-site request.");

    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith("/api/")) {
      api(req, res, url.pathname, url.searchParams).catch((error) => {
        if (res.headersSent) return res.end();
        fail(error instanceof HttpError ? error.status : 500, error instanceof Error ? error.message : String(error));
      });
      return;
    }
    const entry = STATIC[url.pathname];
    if (req.method !== "GET" || !entry) return fail(404, "Not found.");
    send(res, 200, fs.readFileSync(path.join(STUDIO_DIR, entry[0])), entry[1]);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 0, "127.0.0.1", resolve);
  });
  port = server.address().port;
  touch();

  return {
    url: `http://127.0.0.1:${port}/#${token}`,
    port,
    token,
    settingsPath,
    close: () =>
      new Promise((resolve) => {
        clearTimeout(idleTimer);
        setProjectDiscovery(true);
        fs.rmSync(workDir, { recursive: true, force: true });
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
