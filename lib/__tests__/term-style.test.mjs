import test from "node:test";
import assert from "node:assert/strict";
import { makeStyle, plain } from "../term-style.mjs";
import { formatDoctor } from "../doctor-report.mjs";

test("colours only on a TTY", () => {
  assert.equal(makeStyle({ stream: { isTTY: true }, env: {} }).green("ok"), "\x1b[32mok\x1b[39m");
  assert.equal(makeStyle({ stream: {}, env: {} }).green("ok"), "ok");
});

test("NO_COLOR, TERM=dumb and FORCE_COLOR", () => {
  const tty = { isTTY: true };
  assert.equal(makeStyle({ stream: tty, env: { NO_COLOR: "1" } }).enabled, false);
  assert.equal(makeStyle({ stream: tty, env: { TERM: "dumb" } }).enabled, false);
  assert.equal(makeStyle({ stream: {}, env: { FORCE_COLOR: "1" } }).enabled, true);
  assert.equal(makeStyle({ stream: tty, env: { FORCE_COLOR: "0" } }).enabled, false);
  assert.equal(plain.red("x"), "x");
});

test("doctor: green tick, red cross when coloured", () => {
  const style = makeStyle({ stream: {}, env: { FORCE_COLOR: "1" } });
  const report = {
    browser: { available: false },
    settings_sources: [],
    settings: {},
  };
  const { text } = formatDoctor(report, { nodeVersion: "22.1.0", style });
  assert.ok(text.includes("\x1b[32m✓\x1b[39m"));
  assert.ok(text.includes("\x1b[31m✗\x1b[39m"));
});
