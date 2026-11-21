/**
 * Markdown PDF MCP server (stdio).
 *
 * Thin transport around export.mjs: framing, JSON-RPC dispatch, four tools
 * (export, doctor, and two setup helpers from lib/mcp-setup.mjs).
 * Settings: user file (~/.config/markdown-pdf-export/settings.json) or the
 * MARKDOWN_PDF_SETTINGS env var, plus the nearest .markdown-pdf.json — see
 * lib/settings-loader.mjs.
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  SERVER_NAME,
  SERVER_VERSION,
  debugLog,
  exportMarkdownPdf,
  doctorMarkdownPdf,
  installBrowser,
  launchBrowser,
  reloadSettings,
} from "./export.mjs";
import { createBrowserInstaller, launchStudio } from "./lib/mcp-setup.mjs";
import { TOOLS } from "./tool-schemas.mjs";

const CLI_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.mjs");
const NO_BROWSER = "No usable Chrome/Chromium browser found";
const MCP_BROWSER_HINT =
  "No Chrome or Edge found. Ask the user, then call install_browser_markdown_pdf " +
  "to download Chromium (about 200 MB).";
const browserInstaller = createBrowserInstaller(() => installBrowser());

debugLog(`server starting — pid=${process.pid} node=${process.execPath}`);
debugLog(`argv=${JSON.stringify(process.argv)}`);
debugLog(`cwd=${process.cwd()}`);
debugLog(`__filename=${fileURLToPath(import.meta.url)}`);

// ── MCP stdio framing ─────────────────────────────────────────────────────────
//
// The MCP specification (2024-11-05) defines the stdio transport as
// newline-delimited JSON (NDJSON): one JSON object per line, separated
// by '\n'.  Some older clients/tooling still use LSP-style
// "Content-Length" framing.  We auto-detect the framing on the very
// first non-whitespace byte of stdin and stick with that mode for the
// rest of the session.
// ───────────────────────────────────────────────────────────────────────────────

let buffer = Buffer.alloc(0);
/** @type {"ndjson"|"lsp"|null} */
let framingMode = null;

process.stdin.on("data", (chunk) => {
  debugLog(`stdin data: ${chunk.length} bytes`);
  buffer = Buffer.concat([buffer, chunk]);
  processIncomingMessages();
});

process.stdin.on("end", () => {
  debugLog("stdin ended — exiting");
  process.exit(0);
});

function processIncomingMessages() {
  // Auto-detect framing on first meaningful byte.
  if (!framingMode) {
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      // Skip whitespace / newlines
      if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d)
        continue;
      // '{' → newline-delimited JSON; anything else → LSP Content-Length
      framingMode = byte === 0x7b ? "ndjson" : "lsp";
      break;
    }
    if (!framingMode) return;
    debugLog(`framing mode detected: ${framingMode}`);
  }

  if (framingMode === "ndjson") {
    processNdjsonMessages();
  } else {
    processLspMessages();
  }
}

// ── NDJSON framing (MCP spec) ─────────────────────────────────────────────────
function processNdjsonMessages() {
  while (true) {
    const newlineIndex = buffer.indexOf(0x0a); // '\n'
    if (newlineIndex === -1) return;

    const line = buffer.subarray(0, newlineIndex).toString("utf8").trim();
    buffer = buffer.subarray(newlineIndex + 1);

    if (line.length === 0) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      debugLog(
        `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    handleMessage(message).catch((error) => {
      const messageText =
        error instanceof Error ? error.message : String(error);
      debugLog(`handleMessage error: ${messageText}`);
      console.error(messageText);
    });
  }
}

// ── LSP Content-Length framing (legacy / tooling compat) ──────────────────────
function processLspMessages() {
  while (true) {
    let headerEnd = buffer.indexOf("\r\n\r\n");
    let separatorLength = 4;

    // Also accept \n\n (some tools omit \r)
    if (headerEnd === -1) {
      headerEnd = buffer.indexOf("\n\n");
      separatorLength = 2;
    }

    if (headerEnd === -1) return;

    const headerText = buffer.subarray(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);

    if (!match) {
      debugLog("Missing Content-Length header — discarding buffer");
      buffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number.parseInt(match[1], 10);
    const messageStart = headerEnd + separatorLength;
    const messageEnd = messageStart + contentLength;

    if (buffer.length < messageEnd) return;

    const rawMessage = buffer
      .subarray(messageStart, messageEnd)
      .toString("utf8");
    buffer = buffer.subarray(messageEnd);

    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      debugLog(
        `JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    handleMessage(message).catch((error) => {
      const messageText =
        error instanceof Error ? error.message : String(error);
      debugLog(`handleMessage error: ${messageText}`);
      console.error(messageText);
    });
  }
}

// ── Write outgoing messages ───────────────────────────────────────────────────
function writeMessage(message) {
  const json = JSON.stringify(message);
  if (framingMode === "lsp") {
    // LSP-style Content-Length framing
    process.stdout.write(
      `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`,
    );
  } else {
    // MCP spec: newline-delimited JSON
    process.stdout.write(json + "\n");
  }
}

function respond(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function respondError(id, code, message) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
}

// ── MCP dispatch ──────────────────────────────────────────────────────────────
async function handleMessage(message) {
  if (!message.method) {
    debugLog(`received message without method: ${JSON.stringify(message)}`);
    return;
  }

  debugLog(
    `handling method=${message.method} id=${message.id ?? "(notification)"}`,
  );

  switch (message.method) {
    case "initialize":
      respond(message.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      return;

    case "notifications/initialized":
      return;

    case "ping":
      respond(message.id, {});
      return;

    case "tools/list":
      respond(message.id, { tools: TOOLS });
      return;

    case "tools/call": {
      const result = await callTool(
        message.params?.name,
        message.params?.arguments ?? {},
      );
      respond(message.id, result);
      return;
    }

    default:
      if (message.id !== undefined) {
        respondError(message.id, -32601, `Method not found: ${message.method}`);
      }
  }
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────
async function callTool(name, args) {
  try {
    switch (name) {
      case "export_markdown_pdf":
        // Pick up edits made in Studio (or by hand) since the server started.
        reloadSettings();
        return toolResult(await exportMarkdownPdf(args));

      case "doctor_markdown_pdf":
        reloadSettings();
        return toolResult(await doctor(args));

      case "install_browser_markdown_pdf":
        return toolResult(await installBrowserTool(args));

      case "open_studio_markdown_pdf":
        return toolResult(await openStudioTool(args));

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (message.includes(NO_BROWSER)) message += `\n\n${MCP_BROWSER_HINT}`;
    debugLog(`callTool(${name}) error: ${message}`);
    return toolError(message);
  }
}

async function doctor(args) {
  const report = await doctorMarkdownPdf(args);
  if (report.browser && !report.browser.available) {
    report.browser.hint =
      browserInstaller.status() === "installing"
        ? "Chromium is downloading. Check again in a minute."
        : MCP_BROWSER_HINT;
    if (browserInstaller.status() === "failed") {
      report.browser.last_install_error = browserInstaller.lastError();
    }
  }
  return report;
}

async function installBrowserTool(args) {
  if (!args.force && browserInstaller.status() !== "installing") {
    try {
      const browser = await launchBrowser();
      const version = browser.version();
      await browser.close();
      return {
        status: "already_available",
        browser: version,
        message: "A browser already works; nothing was downloaded. Pass force: true to download Chromium anyway.",
      };
    } catch {
      // none found → download below
    }
  }
  const status = await browserInstaller.run();
  return status === "installed"
    ? { status, message: "Chromium is installed. PDFs can be exported now." }
    : {
        status,
        message: "The download is still running (about 200 MB). Call doctor_markdown_pdf in a minute to check.",
      };
}

async function openStudioTool(args) {
  const studio = await launchStudio({
    cliPath: CLI_PATH,
    file: args.file,
    projectFolder: args.project_folder,
    openBrowser: args.open_browser !== false,
  });
  const result = {
    url: studio.url,
    settings_file: studio.settingsPath,
    message:
      (args.open_browser === false
        ? "Studio is running. Give the user this private link."
        : "Studio is open in the browser. If no page appeared, give the user this private link.") +
      " Choices saved in Studio apply to the next export. Studio stops by itself a few minutes after its page is closed.",
  };
  const env = (process.env.MARKDOWN_PDF_SETTINGS ?? "").trim();
  if (env && env !== "{}" && !args.project_folder) {
    result.warning =
      "This server reads its settings from MARKDOWN_PDF_SETTINGS, not from the file Studio edits, " +
      "so Studio changes will not apply to exports until that variable is removed.";
  }
  return result;
}

function toolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function toolError(message) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: message },
    isError: true,
  };
}
