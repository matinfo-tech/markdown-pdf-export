import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { safeLogoName, startStudio } from "../studio-server.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Start Studio against a throwaway project folder (scope "project" keeps HOME out of it). */
async function withStudio(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-"));
  const studio = await startStudio({ scope: "project", cwd: dir, idleMs: 0 });
  const base = `http://127.0.0.1:${studio.port}`;
  const call = (route, init = {}) =>
    fetch(base + route, {
      ...init,
      headers: { "x-studio-token": studio.token, ...init.headers },
    });
  try {
    await fn({ studio, dir, base, call });
  } finally {
    await studio.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Raw request, so the Host header can be forged (fetch does not allow that). */
function rawGet(port, route, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: route, headers }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

test("safeLogoName keeps names harmless", () => {
  assert.equal(safeLogoName("../../etc/Company Logo (1).PNG"), "Company-Logo-1.png");
  assert.equal(safeLogoName("C:\\Users\\me\\logo.svg"), "logo.svg");
  assert.equal(safeLogoName("...svg"), "logo.svg");
  assert.equal(safeLogoName("evil.html"), null);
  assert.equal(safeLogoName("noext"), null);
  assert.equal(safeLogoName(null), null);
});

test("the private link carries the token in the fragment only", async () => {
  await withStudio(async ({ studio }) => {
    const url = new URL(studio.url);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.search, "");
    assert.equal(url.hash, `#${studio.token}`);
    assert.ok(studio.token.length >= 32);
  });
});

test("api needs the token; pages do not", async () => {
  await withStudio(async ({ base, call }) => {
    assert.equal((await fetch(`${base}/api/state`)).status, 401);
    assert.equal((await fetch(`${base}/api/state`, { headers: { "x-studio-token": "nope" } })).status, 401);
    assert.equal((await call("/api/state")).status, 200);
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
    assert.equal((await fetch(`${base}/app.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/model.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/style.css`)).status, 200);
  });
});

test("only the listed files are served", async () => {
  await withStudio(async ({ base }) => {
    for (const route of ["/sample.md", "/../package.json", "/%2e%2e/package.json", "/lib/looks.mjs"]) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
  });
});

test("a foreign Host or Origin is refused, even with the token", async () => {
  await withStudio(async ({ studio, call }) => {
    const headers = { "x-studio-token": studio.token };
    assert.equal(await rawGet(studio.port, "/api/state", { ...headers, host: "evil.example" }), 403);
    assert.equal(await rawGet(studio.port, "/", { host: `evil.example:${studio.port}` }), 403);
    assert.equal(await rawGet(studio.port, "/api/state", { ...headers, host: `localhost:${studio.port}` }), 200);
    assert.equal((await call("/api/state", { headers: { origin: "https://evil.example" } })).status, 403);
    assert.equal((await call("/api/state", { headers: { "sec-fetch-site": "cross-site" } })).status, 403);
  });
});

test("state describes the file being edited", async () => {
  await withStudio(async ({ dir, call }) => {
    const state = await (await call("/api/state")).json();
    assert.equal(state.scope, "project");
    assert.equal(state.settingsPath, path.join(dir, ".markdown-pdf.json"));
    assert.equal(state.exists, false);
    assert.deepEqual(state.raw, {});
    assert.ok(state.looks.report && state.fonts.serif && state.templates.simple);
    assert.ok(state.pageFormats.includes("A4"));
    assert.equal(state.looks.technical.highlight, "atom-one-light.css");
    assert.deepEqual(Object.keys(state.fontLabels), Object.keys(state.fonts));
    assert.ok(state.codeThemes.length >= 8);
    assert.ok(state.codeThemes.every((t) => t.file.endsWith(".css") && t.label));
    assert.equal(state.preview.sample, true);
  });
});

test("save writes the file, adds $schema and keeps a backup", async () => {
  await withStudio(async ({ dir, call }) => {
    const file = path.join(dir, ".markdown-pdf.json");
    const post = (settings) =>
      call("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      });

    const first = await (await post({ look: "report" })).json();
    assert.equal(first.path, file);
    assert.equal(first.backup, null);
    const written = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.match(written.$schema, /settings\.schema\.json$/);
    assert.equal(written.look, "report");

    const second = await (await post({ look: "compact", $schema: "x" })).json();
    assert.equal(second.backup, `${file}.bak`);
    assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, "utf8")).look, "report");
    const again = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(again.look, "compact");
    assert.match(again.$schema, /^https:/);

    const state = await (await call("/api/state")).json();
    assert.equal(state.exists, true);
    assert.equal(state.raw.look, "compact");

    assert.equal((await post("nope")).status, 400);
    assert.deepEqual(fs.readdirSync(dir).sort(), [".markdown-pdf.json", ".markdown-pdf.json.bak"]);
  });
});

test("a broken settings file is reported, not thrown", async () => {
  await withStudio(async ({ dir, call }) => {
    fs.writeFileSync(path.join(dir, ".markdown-pdf.json"), "{ nope");
    const state = await (await call("/api/state")).json();
    assert.equal(state.exists, true);
    assert.match(state.fileError, /not valid JSON/);
    assert.deepEqual(state.raw, {});
  });
});

test("logos land in assets/ next to the settings file and never overwrite", async () => {
  await withStudio(async ({ dir, call }) => {
    const upload = (name, bytes) =>
      call(`/api/logo?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes });

    const a = await (await upload("../../My Logo.png", PNG)).json();
    assert.equal(a.path, "assets/My-Logo.png");
    assert.ok(fs.readFileSync(path.join(dir, "assets", "My-Logo.png")).equals(PNG));

    const same = await (await upload("My Logo.png", PNG)).json();
    assert.equal(same.path, "assets/My-Logo.png", "identical file is reused");

    const other = await (await upload("My Logo.png", Buffer.concat([PNG, Buffer.from([0])]))).json();
    assert.equal(other.path, "assets/My-Logo-1.png", "different content gets a new name");
    assert.ok(fs.readFileSync(path.join(dir, "assets", "My-Logo.png")).equals(PNG));

    assert.equal((await upload("page.html", PNG)).status, 415);
    assert.equal((await upload("empty.png", Buffer.alloc(0))).status, 400);
    assert.equal((await upload("big.png", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.deepEqual(fs.readdirSync(path.join(dir, "assets")).sort(), [".studio-files.json", "My-Logo-1.png", "My-Logo.png"]);
  });
});

const JPG = Buffer.concat([PNG, Buffer.from("other picture")]);
const saveVia = (call, settings) =>
  call("/api/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings }),
  }).then((r) => r.json());
const uploadVia = (call, name, bytes) =>
  call(`/api/logo?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes }).then((r) => r.json());

test("replacing a logo removes the old file when the new layout is saved", async () => {
  await withStudio(async ({ dir, call }) => {
    const assets = path.join(dir, "assets");
    const list = () => fs.readdirSync(assets).filter((n) => !n.startsWith(".")).sort();

    const a = await uploadVia(call, "first.png", PNG);
    const first = await saveVia(call, { header: { left_image: a.path } });
    assert.deepEqual(first.removed, []);

    // Replace: the old file stays until Save, so closing without saving breaks nothing.
    const b = await uploadVia(call, "second.png", JPG);
    assert.deepEqual(list(), ["first.png", "second.png"]);
    const second = await saveVia(call, { header: { left_image: b.path } });
    assert.deepEqual(second.removed, ["first.png"]);
    assert.deepEqual(list(), ["second.png"]);

    // Tried two, kept neither of the new ones: both go, the saved one stays.
    await uploadVia(call, "try-1.png", Buffer.concat([PNG, Buffer.from("1")]));
    await uploadVia(call, "try-2.png", Buffer.concat([PNG, Buffer.from("2")]));
    const third = await saveVia(call, { footer: { center: { type: "image", src: b.path } } });
    assert.deepEqual(third.removed.sort(), ["try-1.png", "try-2.png"]);
    assert.deepEqual(list(), ["second.png"]);

    // Switching the spot back to text removes the last logo and the empty folder.
    const last = await saveVia(call, { header: { left_text: "{title}" } });
    assert.deepEqual(last.removed, ["second.png"]);
    assert.equal(fs.existsSync(assets), false);
  });
});

test("in a project, files Studio did not upload are never deleted", async () => {
  await withStudio(async ({ dir, call }) => {
    const assets = path.join(dir, "assets");
    fs.mkdirSync(assets);
    fs.writeFileSync(path.join(assets, "site-logo.png"), PNG); // the project's own file
    fs.writeFileSync(path.join(assets, "notes.txt"), "keep me");
    fs.writeFileSync(path.join(dir, ".markdown-pdf.json"), JSON.stringify({ header: { left_image: "assets/site-logo.png" } }));

    // Uploading the very same picture reuses the project's file without claiming it.
    assert.equal((await uploadVia(call, "site-logo.png", PNG)).path, "assets/site-logo.png");
    const b = await uploadVia(call, "new.png", JPG);
    const saved = await saveVia(call, { header: { left_image: b.path } });
    assert.deepEqual(saved.removed, []);
    assert.deepEqual(fs.readdirSync(assets).sort(), [".studio-files.json", "new.png", "notes.txt", "site-logo.png"]);
  });
});

test("a tampered manifest cannot delete outside assets/", async () => {
  await withStudio(async ({ dir, call }) => {
    const assets = path.join(dir, "assets");
    fs.mkdirSync(assets);
    fs.writeFileSync(path.join(dir, "precious.png"), PNG);
    fs.writeFileSync(path.join(assets, "notes.txt"), "keep me");
    fs.writeFileSync(path.join(assets, ".studio-files.json"), JSON.stringify(["../precious.png", "notes.txt", 7]));
    const saved = await saveVia(call, {});
    assert.deepEqual(saved.removed, []);
    assert.ok(fs.existsSync(path.join(dir, "precious.png")));
    assert.ok(fs.existsSync(path.join(assets, "notes.txt")));
  });
});

test("in the user settings folder, the logo the saved layout used is removed too", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "studio-home-"));
  const keep = process.env.XDG_CONFIG_HOME;
  const keepAppData = process.env.APPDATA;
  process.env.XDG_CONFIG_HOME = home;
  process.env.APPDATA = home;
  let studio;
  try {
    studio = await startStudio({ idleMs: 0 });
    const call = (route, init = {}) =>
      fetch(`http://127.0.0.1:${studio.port}${route}`, { ...init, headers: { "x-studio-token": studio.token, ...init.headers } });
    const assets = path.join(path.dirname(studio.settingsPath), "assets");
    fs.mkdirSync(assets, { recursive: true });
    // A logo from before Studio kept a list, plus a file used through "@/" by documents.
    fs.writeFileSync(path.join(assets, "old.png"), PNG);
    fs.writeFileSync(path.join(assets, "shared.png"), PNG);
    fs.writeFileSync(studio.settingsPath, JSON.stringify({ header: { left_image: "assets/old.png" } }));

    const b = await uploadVia(call, "new.png", JPG);
    const saved = await saveVia(call, { header: { left_image: b.path } });
    assert.deepEqual(saved.removed, ["old.png"]);
    assert.deepEqual(fs.readdirSync(assets).sort(), [".studio-files.json", "new.png", "shared.png"]);
  } finally {
    await studio?.close();
    if (keep === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = keep;
    if (keepAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = keepAppData;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("editors are listed; existing files are never written", async () => {
  await withStudio(async ({ call }) => {
    const editors = await (await call("/api/editors")).json();
    assert.ok(editors.length >= 4);
    for (const e of editors) for (const i of e.items) assert.ok(i.label && i.snippet && i.write);

    const apply = (body) =>
      call("/api/editors/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal((await apply({ id: "nope", index: 0 })).status, 404);
    const printOnly = editors.flatMap((e) => e.items.map((i, index) => ({ e, i, index }))).find((x) => x.i.write === "print");
    assert.equal((await apply({ id: printOnly.e.id, index: printOnly.index })).status, 409);
  });
});

test("idle timer calls back when the page goes away", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-idle-"));
  let studio;
  try {
    await new Promise((resolve, reject) => {
      startStudio({ scope: "project", cwd: dir, idleMs: 60, onIdle: resolve }).then((s) => {
        studio = s;
      }, reject);
    });
  } finally {
    await studio?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("preview returns a real PDF drawn from the draft", async (t) => {
  await withStudio(async ({ dir, call }) => {
    const preview = (settings) =>
      call("/api/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings }),
      });
    const res = await preview({
      look: "report",
      font: "serif",
      footer: { height: "12mm", center_text: "Page {page} of {pages}" },
      margin: { bottom: "20mm" },
    });
    if (res.status === 422 && /browser/i.test((await res.clone().json()).error)) {
      t.skip("no browser on this machine");
      return;
    }
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    const pdf = Buffer.from(await res.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(Number(res.headers.get("x-render-ms")) > 0);

    // A logo that is not there is an explained failure, not a crash.
    const bad = await preview({ header: { height: "18mm", left_image: "assets/missing.png" } });
    assert.equal(bad.status, 422);
    assert.match((await bad.json()).error, /missing\.png/);

    assert.deepEqual(fs.readdirSync(dir), [], "previewing writes nothing next to the settings file");
  });
});
