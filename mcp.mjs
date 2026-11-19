/**
 * Markdown PDF MCP server (stdio).
 *
 * Thin transport around export.mjs: framing, JSON-RPC dispatch, two tools.
 * Settings: user file (~/.config/markdown-pdf-export/settings.json) or the
 * MARKDOWN_PDF_SETTINGS env var, plus the nearest .markdown-pdf.json — see
 * lib/settings-loader.mjs.
 */
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  SERVER_NAME,
  SERVER_VERSION,
  debugLog,
  exportMarkdownPdf,
  doctorMarkdownPdf,
} from "./export.mjs";
import { TOOLS } from "./tool-schemas.mjs";

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
        return toolResult(await exportMarkdownPdf(args));

      case "doctor_markdown_pdf":
        return toolResult(await doctorMarkdownPdf(args));

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog(`callTool(${name}) error: ${message}`);
    return toolError(message);
  }
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
