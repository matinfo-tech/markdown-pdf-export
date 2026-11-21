/**
 * @fileoverview Setup helpers behind the MCP tools `install_browser_markdown_pdf`
 * and `open_studio_markdown_pdf`, so an assistant can finish the setup without
 * the user opening a terminal (or having Node installed: the editor's own
 * Node runs the server).
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { PROJECT_SETTINGS_FILENAME, userSettingsPath } from "./settings-loader.mjs";

/**
 * Wrap a long browser download so one tool call never blocks for minutes.
 * The download keeps running in the server after `run()` returns
 * "installing"; later calls join the same download.
 *
 * @param {() => Promise<void>} install
 * @param {{ waitMs?: number }} [opts]
 */
export function createBrowserInstaller(install, { waitMs = 50_000 } = {}) {
  /** @type {Promise<"installed"> | null} */
  let running = null;
  /** @type {string | null} */
  let lastError = null;

  return {
    /** @returns {"idle"|"installing"|"failed"} */
    status: () => (running ? "installing" : lastError ? "failed" : "idle"),
    lastError: () => lastError,

    /** @returns {Promise<"installed"|"installing">} rejects if the install fails in time */
    async run() {
      if (!running) {
        lastError = null;
        running = install().then(
          () => {
            running = null;
            return /** @type {const} */ ("installed");
          },
          (error) => {
            running = null;
            lastError = error instanceof Error ? error.message : String(error);
            throw error;
          },
        );
        // A failure after the caller stopped waiting must not crash the server.
        running.catch(() => {});
      }
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(/** @type {const} */ ("installing")), waitMs);
      });
      try {
        return await Promise.race([running, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

const STUDIO_URL = /^http:\/\/127\.0\.0\.1:\d+\/#[0-9a-f]+$/;

/**
 * Start `cli.mjs studio` in its own process and resolve with its private URL.
 *
 * Studio swaps the exporter's settings while it renders previews, so it must
 * not share a process with the MCP server. The child is detached: it outlives
 * a server restart and stops by itself a few minutes after its page is closed.
 *
 * @param {object} opts
 * @param {string} opts.cliPath            path to cli.mjs
 * @param {string} [opts.file]             Markdown file to preview
 * @param {string} [opts.projectFolder]    edit <folder>/.markdown-pdf.json instead of the user file
 * @param {boolean} [opts.openBrowser]     default true
 * @param {number} [opts.timeoutMs]        default 15 s
 * @returns {Promise<{ url: string, settingsPath: string, pid: number }>}
 */
export function launchStudio({
  cliPath,
  file,
  projectFolder,
  openBrowser = true,
  timeoutMs = 15_000,
}) {
  const args = [cliPath, "studio"];
  if (projectFolder) args.push("--project");
  if (file) args.push("--file", path.resolve(file));
  if (!openBrowser) args.push("--no-open");
  // Same rule as startStudio(); the child inherits this process's environment.
  const settingsPath = projectFolder
    ? path.join(path.resolve(projectFolder), PROJECT_SETTINGS_FILENAME)
    : userSettingsPath();

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectFolder ? path.resolve(projectFolder) : os.homedir(),
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(
      () =>
        finish(() => {
          child.kill();
          reject(new Error(`Studio did not start within ${timeoutMs / 1000} s.\n${stderr.trim()}`));
        }),
      timeoutMs,
    );

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const url = stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => STUDIO_URL.test(line));
      if (!url) return;
      finish(() => {
        // Keep draining the pipes so the child never blocks on a full buffer,
        // but let the server exit without waiting for Studio.
        child.stdout.unref?.();
        child.stderr.unref?.();
        child.unref();
        resolve({ url, settingsPath, pid: child.pid });
      });
    });
    child.on("error", (error) =>
      finish(() => reject(new Error(`Could not start Studio: ${error.message}`))),
    );
    child.on("exit", (code) =>
      finish(() =>
        reject(new Error(`Studio stopped before it was ready (exit ${code}).\n${stderr.trim()}`)),
      ),
    );
  });
}
