/**
 * @fileoverview Open a file or URL with the operating system's default app
 * (the PDF after an export, Studio in the browser).
 *
 * The VS Code extension runs this tool with VS Code's own binary and
 * ELECTRON_RUN_AS_NODE=1. That variable must not reach the opened app: an
 * Electron app (a PDF viewer, a browser, `code`) started with it runs as plain
 * Node instead of opening. A missing opener (no `xdg-open` on a server) must
 * not crash the process either: the PDF is already written.
 *
 * On Windows a file path goes to explorer.exe directly, never through cmd.exe:
 * Node does not quote `&`, `|`, `^` or `%` for cmd, so a file named
 * `a&calc&.md` would have started another program.
 */
import { spawn } from "node:child_process";
import process from "node:process";

/**
 * Command and arguments that open `target` on `platform`.
 * @param {string} target file path or URL
 * @param {NodeJS.Platform} [platform]
 * @returns {[string, string[]]}
 */
export function osOpenCommand(target, platform = process.platform) {
  if (platform === "darwin") return ["open", [target]];
  if (platform === "win32") {
    // A plain http(s) URL (Studio's link) has nothing cmd could read as a
    // command, and `start` keeps its #fragment. Anything else (a file path)
    // goes to explorer.exe: cmd would run what follows a `&` in a file name.
    if (/^https?:\/\/[\w.:/#?=-]+$/.test(target)) return ["cmd", ["/C", "start", "", target]];
    return ["explorer.exe", [target]];
  }
  return ["xdg-open", [target]];
}

/**
 * `env` without the variables that only make sense for this process.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
export function openerEnv(env = process.env) {
  const out = { ...env };
  delete out.ELECTRON_RUN_AS_NODE;
  return out;
}

/**
 * Open `target` and return at once. Never throws.
 * @param {string} target file path or URL
 */
export function openWithOs(target) {
  const [command, args] = osOpenCommand(target);
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore", env: openerEnv() });
    child.on("error", () => {});
    child.unref();
  } catch {
    // nothing to open with; the caller has already reported the path
  }
}
