#!/usr/bin/env node
/**
 * markdown-pdf-export — CLI front-end for the Markdown → PDF core.
 *
 *   markdown-pdf-export <file.md> [options]   export a file
 *   markdown-pdf-export doctor [file.md]      check browser + settings
 *   markdown-pdf-export init [--template t]   create the settings file
 *   markdown-pdf-export setup [editor]        print editor task + MCP snippets
 *   markdown-pdf-export install-browser       download Playwright's Chromium (~200 MB)
 *   markdown-pdf-export mcp                   run as an MCP server on stdio
 *
 * Export options are generated from the same JSON schema the MCP tool uses
 * (tool-schemas.mjs), so the CLI and MCP surfaces cannot drift apart.
 *
 * Exit codes: 0 success · 1 runtime error · 2 usage error.
 * On success the output PDF path is printed on stdout (everything else → stderr).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

import {
  SERVER_VERSION,
  doctorMarkdownPdf,
  exportMarkdownPdf,
  installBrowser,
  reloadSettings,
  setSettings,
} from "./export.mjs";
import { EXPORT_INPUT_SCHEMA } from "./tool-schemas.mjs";
import {
  PROJECT_SETTINGS_FILENAME,
  resolveSettingsPaths,
  userSettingsPath,
} from "./lib/settings-loader.mjs";
import { formatDoctor } from "./lib/doctor-report.mjs";
import { LOOKS, FONTS } from "./lib/looks.mjs";
import { EDITOR_IDS, buildEditorSetup, launchSpec } from "./lib/editor-setup.mjs";

const BIN = "markdown-pdf-export";
const CLI_PATH = fileURLToPath(import.meta.url);
const TEMPLATES_DIR = path.join(path.dirname(CLI_PATH), "templates");

class UsageError extends Error {}

const kebab = (name) => name.replaceAll("_", "-");
const snake = (name) => name.replaceAll("-", "_");

// Options whose schema type is "object" accept JSON; margin also accepts "10mm".
const SCHEMA_PROPS = EXPORT_INPUT_SCHEMA.properties;
const FLAG_ALIASES = { o: "output_path", output: "output_path" };

function usage() {
  const lines = Object.entries(SCHEMA_PROPS)
    .filter(([name]) => name !== "input_path")
    .map(([name, def]) => {
      const flag = `--${kebab(name)}`;
      const kind =
        def.type === "boolean"
          ? "[=true|false]"
          : def.type === "object"
            ? "<json>"
            : def.type === "number"
              ? "<n>"
              : "<value>";
      const first = (def.description ?? "").split(/(?<=\.)\s/)[0];
      return `  ${`${flag} ${kind}`.padEnd(37)} ${first}`;
    });

  return `${BIN} ${SERVER_VERSION}

Usage:
  ${BIN} <file.md> [options]
  ${BIN}                       (no arguments: guided menu)
  ${BIN} doctor [file.md] [--json]
  ${BIN} init [--look <n>] [--font <n>] [--template <n>] [--project] [--force] [--list]
  ${BIN} setup [${EDITOR_IDS.join("|")}|all] [--write]
  ${BIN} install-browser
  ${BIN} mcp

Options (for export):
  -o, --output <file.pdf>           Output PDF path (alias of --output-path).
${lines.join("\n")}
  --settings <json|file.json>       Default settings (same shape as the MCP "settings" block).
  --margin <10mm>                   --margin also accepts one value for all four sides.
  --watch                           Re-export when the file or a settings file changes.

Booleans: --flag, --flag=false or --no-flag.
Objects take JSON, e.g. --margin '{"top":"10mm"}'.

Settings (lowest to highest priority):
  built-in defaults
  user file      ${userSettingsPath()}
                 (replaced by MARKDOWN_PDF_SETTINGS or --settings when set)
  project file   nearest ${PROJECT_SETTINGS_FILENAME}, searched upward from the Markdown file
  options above, then the front matter "pdf:" block

Environment:
  MARKDOWN_PDF_SETTINGS   Settings as JSON or a file path (replaces the user file).
  MARKDOWN_PDF_BROWSER    chrome | msedge | chromium | /path/to/browser
  MARKDOWN_PDF_DEBUG      1 (or a file path) to enable the debug log
`;
}

function coerce(name, def, raw) {
  switch (def.type) {
    case "boolean": {
      if (raw === undefined || raw === "true") return true;
      if (raw === "false") return false;
      throw new UsageError(`--${kebab(name)} expects true or false, got "${raw}"`);
    }
    case "number": {
      const n = Number(raw);
      if (raw === undefined || raw === "" || Number.isNaN(n)) {
        throw new UsageError(`--${kebab(name)} expects a number, got "${raw}"`);
      }
      return n;
    }
    case "object": {
      if (raw === undefined) throw new UsageError(`--${kebab(name)} needs a value`);
      if (name === "margin" && !/^\s*\{/.test(raw)) {
        return { top: raw, right: raw, bottom: raw, left: raw };
      }
      try {
        return JSON.parse(raw);
      } catch (error) {
        throw new UsageError(`--${kebab(name)} expects JSON: ${error.message}`);
      }
    }
    default: {
      if (raw === undefined) throw new UsageError(`--${kebab(name)} needs a value`);
      if (def.enum && !def.enum.includes(raw)) {
        throw new UsageError(
          `--${kebab(name)} must be one of ${def.enum.join(", ")} (got "${raw}")`,
        );
      }
      return raw;
    }
  }
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  let settings;
  let watch = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      positional.push(arg);
      continue;
    }

    const isLong = arg.startsWith("--");
    const body = arg.slice(isLong ? 2 : 1);
    const eq = body.indexOf("=");
    let key = eq === -1 ? body : body.slice(0, eq);
    let value = eq === -1 ? undefined : body.slice(eq + 1);

    if (key === "help" || key === "h") return { help: true, positional, options };
    if (key === "version" || key === "v") return { version: true, positional, options };
    if (key === "watch" && isLong) {
      watch = true;
      continue;
    }

    let negate = false;
    if (isLong && key.startsWith("no-") && SCHEMA_PROPS[snake(key.slice(3))]) {
      negate = true;
      key = key.slice(3);
    }

    const name = FLAG_ALIASES[key] ?? snake(key);

    if (name === "settings") {
      if (value === undefined) value = argv[++i];
      if (value === undefined) throw new UsageError("--settings needs a value");
      settings = value;
      continue;
    }

    const def = SCHEMA_PROPS[name];
    if (!def || name === "input_path") {
      throw new UsageError(`Unknown option: ${arg}`);
    }

    // Non-boolean options take the next argument when no "=value" was given.
    if (def.type !== "boolean" && value === undefined) value = argv[++i];

    options[name] = negate ? false : coerce(name, def, value);
  }

  return { positional, options, settings, watch };
}

function loadSettingsArg(value) {
  if (value === undefined) return null;
  const inline = /^\s*\{/.test(value);
  const file = inline ? null : path.resolve(value);
  const text = inline ? value : fs.readFileSync(file, "utf8");
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new UsageError(`--settings is not valid JSON: ${error.message}`);
  }
  return { data: file ? resolveSettingsPaths(data, path.dirname(file)) : data, file };
}

async function main(argv) {
  const [first, ...rest] = argv;

  if (first === undefined && process.stdin.isTTY && process.stderr.isTTY) {
    return runMenu();
  }
  if (first === undefined || first === "-h" || first === "--help" || first === "help") {
    process.stdout.write(usage());
    return first === undefined ? 2 : 0;
  }
  if (first === "-v" || first === "--version" || first === "version") {
    process.stdout.write(`${BIN} ${SERVER_VERSION}\n`);
    return 0;
  }

  if (first === "mcp") {
    // Importing the module starts the stdio server; it keeps the process alive.
    await import("./mcp.mjs");
    return null;
  }

  if (first === "install-browser") {
    process.stderr.write("Downloading Chromium (~200 MB)…\n");
    await installBrowser({ onOutput: (text) => process.stderr.write(text) });
    process.stderr.write("Chromium installed.\n");
    return 0;
  }

  if (first === "init") return runInit(rest);
  if (first === "setup") return runSetup(rest);

  const isDoctor = first === "doctor";
  const asJson = isDoctor && rest.includes("--json");
  const { positional, options, settings, watch, help, version } = parseArgs(
    isDoctor ? rest.filter((a) => a !== "--json") : argv,
  );
  if (help) {
    process.stdout.write(usage());
    return 0;
  }
  if (version) {
    process.stdout.write(`${BIN} ${SERVER_VERSION}\n`);
    return 0;
  }

  const fromArg = loadSettingsArg(settings);
  if (fromArg) setSettings(fromArg.data, fromArg.file);

  if (isDoctor) {
    const report = await doctorMarkdownPdf({ input_path: positional[0] });
    if (asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report.browser.available ? 0 : 1;
    }
    const { text, ok } = formatDoctor(report, { bin: BIN });
    process.stdout.write(text);
    return ok ? 0 : 1;
  }

  if (positional.length !== 1) {
    throw new UsageError(
      positional.length === 0
        ? "Missing input file."
        : `Expected one input file, got ${positional.length}: ${positional.join(" ")}`,
    );
  }

  const args = { ...options, input_path: positional[0] };
  if (watch) {
    return runWatch(args, () =>
      fromArg ? setSettings(loadSettingsArg(settings).data, fromArg.file) : reloadSettings(),
    );
  }

  const result = await exportMarkdownPdf(args);
  process.stdout.write(`${result.output_path}\n`);
  return 0;
}

// ── menu (no arguments, interactive terminal) ───────────────────────────────

async function runMenu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write(
      `\n${BIN} ${SERVER_VERSION} — Markdown to PDF\n\n` +
        "  1) Set up my editor (VS Code, Zed, Cursor, Claude…)\n" +
        "  2) Choose a page style and header/footer\n" +
        "  3) Check that everything works\n" +
        "  4) Show all commands\n\n",
    );
    const pick = (await rl.question("Choose 1-4: ")).trim();
    rl.close();
    if (pick === "1") return runSetup([]);
    if (pick === "2") return runInit([]);
    if (pick === "3") {
      const { text, ok } = formatDoctor(await doctorMarkdownPdf({}), { bin: BIN });
      process.stdout.write(text);
      return ok ? 0 : 1;
    }
    process.stdout.write(usage());
    return 0;
  } finally {
    rl.close();
  }
}

// ── init ─────────────────────────────────────────────────────────────────────

/** Parse "--flag", "--flag value" and "--flag=value" for the small subcommands. */
function parseSubArgs(argv, spec) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split(/=(.*)/s, 2);
    if (key === "help") {
      out.help = true;
      continue;
    }
    if (!(key in spec)) throw new UsageError(`Unknown option: ${arg}`);
    if (spec[key] === "boolean") {
      out[key] = inline === undefined ? true : inline !== "false";
    } else {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new UsageError(`--${key} needs a value`);
      out[key] = value;
    }
  }
  return out;
}

function listTemplates() {
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();
}

function readTemplate(name) {
  const file = path.join(TEMPLATES_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    throw new UsageError(
      `Unknown template "${name}". Available: ${listTemplates().join(", ")}`,
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Ask for one item of a list by number or name. */
async function choose(rl, title, names, describe, fallback) {
  process.stderr.write(`\n${title}\n`);
  names.forEach((n, i) => process.stderr.write(`  ${i + 1}) ${n.padEnd(10)} ${describe(n)}\n`));
  const raw = (await rl.question(`Choose 1-${names.length} [${fallback}]: `)).trim();
  if (!raw) return fallback;
  const byNumber = names[Number(raw) - 1];
  return byNumber ?? (names.includes(raw) ? raw : fallback);
}

const TEMPLATE_HINTS = {
  minimal: "title and page number only",
  simple: "title + date on top, page x of y at the bottom",
  corporate: "logo, title, date, blue rule",
  academic: "centred title, page numbers",
  "two-logo": "two logos, confidential footer",
};

/** Short interactive prompt (TTY only): look, font, header/footer, page, logo. */
async function promptInit(templates) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const look = await choose(rl, "Page style", Object.keys(LOOKS), (n) => LOOKS[n].description, "clean");
    const font = await choose(rl, "Font", Object.keys(FONTS), () => "", "sans");
    const template = await choose(
      rl,
      "Header and footer",
      templates,
      (n) => TEMPLATE_HINTS[n] ?? "",
      "minimal",
    );
    const pageFormat = (await rl.question("\nPage format (A4, Letter, …) [A4]: ")).trim();
    const logo = (await rl.question("Logo image for the header (path, optional): ")).trim();
    return { template, look, font, pageFormat, logo };
  } finally {
    rl.close();
  }
}

async function runInit(argv) {
  const flags = parseSubArgs(argv, {
    template: "string",
    look: "string",
    font: "string",
    project: "boolean",
    force: "boolean",
    list: "boolean",
  });
  if (flags.help) {
    process.stdout.write(
      `Usage: ${BIN} init [--look <n>] [--font <n>] [--template <n>] [--project] [--force] [--list]\n\n` +
        `Creates ${userSettingsPath()}\n` +
        `(or ./${PROJECT_SETTINGS_FILENAME} with --project) from a template.\n`,
    );
    return 0;
  }

  const templates = listTemplates();
  if (flags.list) {
    process.stdout.write(`${templates.join("\n")}\n`);
    return 0;
  }

  const target = flags.project
    ? path.resolve(PROJECT_SETTINGS_FILENAME)
    : userSettingsPath();
  if (fs.existsSync(target) && !flags.force) {
    process.stderr.write(
      `${BIN}: ${target} already exists — not overwriting (use --force).\n`,
    );
    return 1;
  }

  if (flags.look && !LOOKS[flags.look]) {
    throw new UsageError(`Unknown look "${flags.look}". Available: ${Object.keys(LOOKS).join(", ")}`);
  }
  if (flags.font && !FONTS[flags.font]) {
    throw new UsageError(`Unknown font "${flags.font}". Available: ${Object.keys(FONTS).join(", ")}`);
  }

  const interactive =
    !flags.template && !flags.look && !flags.font && process.stdin.isTTY && process.stderr.isTTY;
  const answers = interactive
    ? await promptInit(templates)
    : {
        template: flags.template ?? "minimal",
        look: flags.look,
        font: flags.font,
        pageFormat: "",
        logo: "",
      };

  // Short form when a look/font is chosen: the file stays 3 lines and readable.
  const short = Boolean(answers.look || answers.font);
  const data = short
    ? {
        $schema: readTemplate(answers.template).$schema,
        ...(answers.look ? { look: answers.look } : {}),
        ...(answers.font ? { font: answers.font } : {}),
        template: answers.template,
      }
    : readTemplate(answers.template);
  if (answers.pageFormat) data.page_format = answers.pageFormat;
  if (answers.logo) {
    // A logo needs the header spelled out, so expand the template in place.
    if (short) {
      const tpl = readTemplate(answers.template);
      delete tpl.$schema;
      delete data.template;
      Object.assign(data, tpl);
    }
    data.header = { height: "18mm", padding: "0 15mm", ...data.header };
    data.header.left_image = path.resolve(answers.logo);
    data.header.left_image_height ??= "12mm";
    data.margin = { top: "25mm", ...data.margin };
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`);
  process.stderr.write(`Wrote ${answers.template} settings to:\n`);
  process.stdout.write(`${target}\n`);

  if (data.assets_directory && !answers.logo) {
    const assets = path.resolve(path.dirname(target), data.assets_directory);
    process.stderr.write(
      `Put the logo files referenced as "@/…" in ${assets}\n`,
    );
  }
  return 0;
}

// ── setup ────────────────────────────────────────────────────────────────────

async function runSetup(argv) {
  const flags = parseSubArgs(argv, { write: "boolean" });
  if (flags.help) {
    process.stdout.write(
      `Usage: ${BIN} setup [${EDITOR_IDS.join("|")}|all] [--write]\n\n` +
        "Prints the task and MCP snippets for your editors (detected ones by default).\n" +
        "--write creates config files that do not exist yet and runs editor CLIs;\n" +
        "existing files are never modified.\n",
    );
    return 0;
  }
  const [which] = flags._;
  const launch = launchSpec(CLI_PATH);

  let setups;
  if (which && which !== "all") {
    setups = [buildEditorSetup(which, launch)];
  } else {
    const every = EDITOR_IDS.map((id) => buildEditorSetup(id, launch));
    setups = which === "all" ? every : every.filter((s) => s.detected);
    if (setups.length === 0) {
      process.stderr.write("No editor config directory detected — showing all.\n");
      setups = every;
    }
  }

  const out = process.stdout;
  for (const setup of setups) {
    out.write(`\n━━ ${setup.name}${setup.detected ? "" : " (not detected)"} ━━\n`);
    for (const item of setup.items) {
      out.write(`\n▸ ${item.label}\n`);
      if (item.file) out.write(`  file: ${item.file}\n`);
      out.write(`${item.snippet}\n`);
      if (!flags.write) continue;

      if (item.write === "create") {
        fs.mkdirSync(path.dirname(item.file), { recursive: true });
        fs.writeFileSync(item.file, `${item.snippet}\n`, { flag: "wx" });
        out.write(`  ✓ created ${item.file}\n`);
      } else if (item.write === "command") {
        // Windows: code/claude are .cmd shims, which need the shell; pass one
        // pre-quoted command line so JSON arguments survive cmd.exe.
        const result =
          process.platform === "win32"
            ? spawnSync(item.snippet, { stdio: "inherit", shell: true })
            : spawnSync(item.run.cmd, item.run.args, { stdio: "inherit" });
        out.write(
          result.status === 0
            ? `  ✓ ran: ${item.snippet}\n`
            : `  ✗ could not run "${item.run.cmd}" — run the command above yourself\n`,
        );
      } else {
        out.write("  → existing file: paste the snippet above yourself\n");
      }
    }
  }

  out.write(
    `\nSettings file: ${userSettingsPath()}` +
      `${fs.existsSync(userSettingsPath()) ? "" : ` (missing — create it with: ${BIN} init)`}\n`,
  );
  const report = await doctorMarkdownPdf({});
  out.write(
    report.browser.available
      ? `Browser: ${report.browser.version} ✓\n`
      : `Browser: not found — ${report.browser.hint}\n`,
  );
  return report.browser.available ? 0 : 1;
}

// ── watch ────────────────────────────────────────────────────────────────────

async function runWatch(args, reload) {
  const watchers = new Map();
  let timer = null;
  let running = false;
  let again = false;

  const watchFile = (file) => {
    if (watchers.has(file)) return;
    // Watch the directory: editors often replace the file on save.
    const watcher = fs.watch(path.dirname(file), (_event, name) => {
      if (name && path.basename(file) !== String(name)) return;
      clearTimeout(timer);
      timer = setTimeout(exportOnce, 200);
    });
    watchers.set(file, watcher);
  };

  const exportOnce = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      reload();
      const result = await exportMarkdownPdf(args);
      process.stderr.write(`[${new Date().toLocaleTimeString()}] ✓ ${result.output_path}\n`);
      for (const file of result.settings_files ?? []) watchFile(file);
    } catch (error) {
      process.stderr.write(
        `[${new Date().toLocaleTimeString()}] ✗ ${error instanceof Error ? error.message : error}\n`,
      );
    } finally {
      running = false;
      if (again) {
        again = false;
        void exportOnce();
      }
    }
  };

  watchFile(path.resolve(args.input_path));
  await exportOnce();
  process.stderr.write("Watching for changes — Ctrl+C to stop.\n");
  return null;
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code !== null) process.exitCode = code;
  },
  (error) => {
    if (error instanceof UsageError) {
      process.stderr.write(`${BIN}: ${error.message}\nTry '${BIN} --help'.\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`${BIN}: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  },
);
