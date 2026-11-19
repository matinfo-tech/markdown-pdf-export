#!/usr/bin/env node
/**
 * markdown-pdf-export — CLI front-end for the Markdown → PDF core.
 *
 *   markdown-pdf-export <file.md> [options]   export a file
 *   markdown-pdf-export doctor [file.md]      check browser + settings
 *   markdown-pdf-export install-browser       download Playwright's Chromium (~150 MB)
 *   markdown-pdf-export mcp                   run as an MCP server on stdio
 *
 * Export options are generated from the same JSON schema the MCP tool uses
 * (tool-schemas.mjs), so the CLI and MCP surfaces cannot drift apart.
 *
 * Exit codes: 0 success · 1 runtime error · 2 usage error.
 * On success the output PDF path is printed on stdout (everything else → stderr).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  SERVER_NAME,
  SERVER_VERSION,
  doctorMarkdownPdf,
  exportMarkdownPdf,
  installBrowser,
  setSettings,
} from "./export.mjs";
import { EXPORT_INPUT_SCHEMA } from "./tool-schemas.mjs";

const BIN = "markdown-pdf-export";

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
      return `  ${`${flag} ${kind}`.padEnd(34)}${first}`;
    });

  return `${BIN} ${SERVER_VERSION}

Usage:
  ${BIN} <file.md> [options]
  ${BIN} doctor [file.md]
  ${BIN} install-browser
  ${BIN} mcp

Options (for export):
  -o, --output <file.pdf>           Output PDF path (alias of --output-path).
${lines.join("\n")}
  --settings <json|file.json>       Default settings (same shape as the MCP "settings" block).
  --margin <10mm>                   --margin also accepts one value for all four sides.

Booleans: --flag, --flag=false or --no-flag.
Objects take JSON, e.g. --margin '{"top":"10mm"}'.

Environment:
  MARKDOWN_PDF_SETTINGS   Default settings as JSON (overridden by --settings).
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

  return { positional, options, settings };
}

function loadSettingsArg(value) {
  if (value === undefined) return null;
  const text = /^\s*\{/.test(value) ? value : fs.readFileSync(path.resolve(value), "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new UsageError(`--settings is not valid JSON: ${error.message}`);
  }
}

async function main(argv) {
  const [first, ...rest] = argv;

  if (first === undefined || first === "-h" || first === "--help" || first === "help") {
    process.stdout.write(usage());
    return first === undefined ? 2 : 0;
  }
  if (first === "-v" || first === "--version" || first === "version") {
    process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`);
    return 0;
  }

  if (first === "mcp") {
    // Importing the module starts the stdio server; it keeps the process alive.
    await import("./mcp.mjs");
    return null;
  }

  if (first === "install-browser") {
    process.stderr.write("Downloading Chromium (~150 MB)…\n");
    await installBrowser({ onOutput: (text) => process.stderr.write(text) });
    process.stderr.write("Chromium installed.\n");
    return 0;
  }

  const isDoctor = first === "doctor";
  const { positional, options, settings, help, version } = parseArgs(
    isDoctor ? rest : argv,
  );
  if (help) {
    process.stdout.write(usage());
    return 0;
  }
  if (version) {
    process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`);
    return 0;
  }

  const fromArg = loadSettingsArg(settings);
  if (fromArg) setSettings(fromArg);

  if (isDoctor) {
    const report = await doctorMarkdownPdf({ input_path: positional[0] });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.browser.available ? 0 : 1;
  }

  if (positional.length !== 1) {
    throw new UsageError(
      positional.length === 0
        ? "Missing input file."
        : `Expected one input file, got ${positional.length}: ${positional.join(" ")}`,
    );
  }

  const result = await exportMarkdownPdf({ ...options, input_path: positional[0] });
  process.stdout.write(`${result.output_path}\n`);
  return 0;
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
