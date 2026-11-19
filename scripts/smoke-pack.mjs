#!/usr/bin/env node
/**
 * Packaging smoke test: builds the npm tarball, checks its contents, installs
 * it into a clean directory and exercises the installed CLI and MCP server.
 * Catches problems that only exist in the published artifact (missing files,
 * missing vendor/ bundle, broken bin entry) and version drift in server.json.
 *
 * Usage: node scripts/smoke-pack.mjs [--no-export]
 *   --no-export  skip the real PDF export (no browser needed)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_EXPORT = process.argv.includes("--no-export");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}
function ok(message) {
  console.log(`✓ ${message}`);
}
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32" && cmd.endsWith(".cmd"),
    ...options,
  });
  if (result.status !== 0) {
    fail(
      `${cmd} ${args.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}

function checkServerJson() {
  const server = JSON.parse(
    fs.readFileSync(path.join(ROOT, "server.json"), "utf8"),
  );
  const versions = [server.version, ...server.packages.map((p) => p.version)];
  if (versions.some((v) => v !== pkg.version)) {
    fail(
      `server.json versions (${versions.join(", ")}) differ from package.json (${pkg.version})`,
    );
  }
  ok(`server.json versions match package.json (${pkg.version})`);
}

function checkTarball(tarball) {
  const listing = run("tar", ["-tzf", tarball]).split(/\r?\n/).filter(Boolean);
  const files = new Set(listing.map((f) => f.replace(/^package\//, "")));
  const required = [
    "package.json",
    "cli.mjs",
    "export.mjs",
    "mcp.mjs",
    "tool-schemas.mjs",
    "default.css",
    "vendor/katex-inline.css",
    "lib/asset-resolver.mjs",
    "lib/config-merger.mjs",
    "lib/frontmatter-parser.mjs",
    "lib/html-generator.mjs",
    "lib/placeholder-resolver.mjs",
    "lib/schema-validator.mjs",
    "lib/settings-loader.mjs",
    "lib/editor-setup.mjs",
    "templates/minimal.json",
    "templates/corporate.json",
  ];
  const missing = required.filter((f) => !files.has(f));
  if (missing.length) fail(`tarball is missing: ${missing.join(", ")}`);
  const forbidden = [...files].filter((f) =>
    /^(test-fixtures|docs|\.claude|\.codegraph|\.github|lib\/__tests__)\//.test(f),
  );
  if (forbidden.length) fail(`tarball contains dev-only files: ${forbidden.join(", ")}`);
  ok(`tarball contents ok (${files.size} files)`);
}

function mcpInitialize(binPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, "mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP initialize timed out. stdout: ${out}`));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      out += chunk;
      const line = out.split("\n").find((l) => l.includes('"id":1'));
      if (line) {
        clearTimeout(timer);
        child.kill();
        try {
          resolve(JSON.parse(line));
        } catch (error) {
          reject(error);
        }
      }
    });
    child.on("error", reject);
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "smoke-pack", version: "0.0.0" },
        },
      }) + "\n",
    );
  });
}

async function main() {
  checkServerJson();

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "mdpdf-smoke-"));
  const packDir = path.join(work, "pack");
  const installDir = path.join(work, "install");
  fs.mkdirSync(packDir);
  fs.mkdirSync(installDir);

  try {
    // prepack (build) runs here, producing vendor/katex-inline.css.
    const packed = run(NPM, ["pack", "--json", "--pack-destination", packDir], {
      cwd: ROOT,
    });
    const jsonStart = packed.indexOf("[");
    const tarball = path.join(
      packDir,
      JSON.parse(packed.slice(jsonStart))[0].filename,
    );
    checkTarball(tarball);

    fs.writeFileSync(
      path.join(installDir, "package.json"),
      JSON.stringify({ name: "smoke-install", private: true }),
    );
    run(NPM, ["install", "--no-audit", "--no-fund", tarball], {
      cwd: installDir,
    });
    const binPath = path.join(
      installDir,
      "node_modules",
      pkg.name,
      "cli.mjs",
    );

    const version = run(process.execPath, [binPath, "--version"]).trim();
    if (!version.includes(pkg.version)) {
      fail(`--version printed "${version}", expected ${pkg.version}`);
    }
    ok(`installed CLI reports ${version}`);

    const init = await mcpInitialize(binPath);
    if (!init.result?.serverInfo) {
      fail(`MCP initialize returned no serverInfo: ${JSON.stringify(init)}`);
    }
    ok(`MCP initialize ok (${init.result.serverInfo.name})`);

    // `init` writes the user settings file into an isolated HOME.
    const home = path.join(work, "home");
    const initEnv = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      APPDATA: path.join(home, "AppData"),
      XDG_CONFIG_HOME: "",
      MARKDOWN_PDF_SETTINGS: "",
    };
    const written = run(process.execPath, [binPath, "init", "--template", "simple"], {
      env: initEnv,
    }).trim();
    if (!fs.existsSync(written) || !written.startsWith(home)) {
      fail(`init did not write the settings file under HOME (got "${written}")`);
    }
    const again = spawnSync(process.execPath, [binPath, "init"], { env: initEnv });
    if (again.status === 0) fail("init overwrote an existing settings file");
    ok(`init wrote ${path.relative(work, written)} and refused to overwrite`);

    if (SKIP_EXPORT) {
      ok("PDF export skipped (--no-export)");
    } else {
      const input = path.join(work, "smoke.md");
      const output = path.join(work, "smoke.pdf");
      fs.copyFileSync(path.join(ROOT, "test-fixtures", "sample.md"), input);
      run(process.execPath, [binPath, input, "-o", output]);
      const head = fs.readFileSync(output).subarray(0, 5).toString("latin1");
      if (head !== "%PDF-") fail(`output is not a PDF (starts with "${head}")`);
      ok(`installed CLI exported a PDF (${fs.statSync(output).size} bytes)`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error.message);
});
