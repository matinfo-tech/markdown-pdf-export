/**
 * @fileoverview Opening the PDF or Studio with the OS default app.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { openerEnv, osOpenCommand } from "../open-external.mjs";

describe("osOpenCommand", () => {
  it("uses open on macOS", () => {
    assert.deepEqual(osOpenCommand("/tmp/a b.pdf", "darwin"), ["open", ["/tmp/a b.pdf"]]);
  });

  it("uses explorer.exe on Windows, never cmd (no & or % interpretation)", () => {
    const target = "C:\\dir\\a&calc&%PATH%.pdf";
    assert.deepEqual(osOpenCommand(target, "win32"), ["explorer.exe", [target]]);
  });

  it("keeps cmd start for a plain URL on Windows (the #fragment survives)", () => {
    const url = "http://127.0.0.1:51234/#0a1b2c";
    assert.deepEqual(osOpenCommand(url, "win32"), ["cmd", ["/C", "start", "", url]]);
  });

  it("sends a URL with cmd metacharacters to explorer.exe on Windows", () => {
    const url = "http://x/?a=1&calc";
    assert.deepEqual(osOpenCommand(url, "win32"), ["explorer.exe", [url]]);
  });

  it("uses xdg-open elsewhere", () => {
    assert.deepEqual(osOpenCommand("http://127.0.0.1:1/#t", "linux"), ["xdg-open", ["http://127.0.0.1:1/#t"]]);
  });
});

describe("openerEnv", () => {
  it("drops ELECTRON_RUN_AS_NODE and keeps the rest", () => {
    const env = { ELECTRON_RUN_AS_NODE: "1", PATH: "/bin", DISPLAY: ":0" };
    assert.deepEqual(openerEnv(env), { PATH: "/bin", DISPLAY: ":0" });
    assert.equal(env.ELECTRON_RUN_AS_NODE, "1", "input left unchanged");
  });
});
