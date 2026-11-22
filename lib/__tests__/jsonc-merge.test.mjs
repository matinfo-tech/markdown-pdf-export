import test from "node:test";
import assert from "node:assert/strict";
import jsonc from "jsonc-parser";

import { detectFormatting, formatJson, mergeJsonc } from "../jsonc-merge.mjs";

const TASK = { label: "Markdown: Export to PDF", command: "npx", args: ["-y", "markdown-pdf-export", "$ZED_FILE"] };
const SERVER = { command: "npx", args: ["-y", "markdown-pdf-export", "mcp"] };
const parse = (text) => jsonc.parse(text, [], { allowTrailingComma: true });

test("append: keeps comments, trailing commas and the user's own lines as written", () => {
  const before = '[\n  // my build\n  { "label": "build", "command": "make" },\n]\n';
  const after = mergeJsonc(before, { at: [], value: TASK, append: true });
  assert.ok(after.startsWith('[\n  // my build\n  { "label": "build", "command": "make" },\n'));
  assert.deepEqual(parse(after), [{ label: "build", command: "make" }, TASK]);
});

test("append: an empty list becomes a tidy list", () => {
  const after = mergeJsonc("[]\n", { at: [], value: { label: "X" }, append: true });
  assert.equal(after, '[\n  {\n    "label": "X"\n  }\n]\n');
});

test("append: creates a missing list under a key (VS Code tasks.json)", () => {
  const after = mergeJsonc('{\n  "version": "2.0.0"\n}\n', { at: ["tasks"], value: { label: "X" }, append: true });
  assert.deepEqual(parse(after), { version: "2.0.0", tasks: [{ label: "X" }] });
});

test("set: adds a key next to the others and keeps them as written", () => {
  const before = '// Zed settings\n{\n  "theme": "One Dark", // mine\n  "context_servers": {\n    "other": { "command": "x" },\n  },\n}\n';
  const after = mergeJsonc(before, { at: ["context_servers", "markdown-pdf"], value: SERVER });
  assert.ok(after.includes('"theme": "One Dark", // mine'));
  assert.ok(after.includes('"other": { "command": "x" },'));
  assert.deepEqual(parse(after).context_servers["markdown-pdf"], SERVER);
});

test("set: creates the missing parent object", () => {
  const after = mergeJsonc('{\n  "theme": "One Dark"\n}\n', { at: ["context_servers", "markdown-pdf"], value: SERVER });
  assert.deepEqual(parse(after), { theme: "One Dark", context_servers: { "markdown-pdf": SERVER } });
  assert.ok(after.includes('\n  "context_servers": {\n    "markdown-pdf": {\n'));
});

test("uses the file's indentation and line endings", () => {
  const tabs = mergeJsonc('{\n\t"a": 1\n}\n', { at: ["b"], value: { c: 1 } });
  assert.ok(tabs.includes('\n\t"b": {\n\t\t"c": 1\n\t}'));
  const crlf = mergeJsonc('{\r\n    "a": 1\r\n}\r\n', { at: ["b"], value: { c: 1 } });
  assert.ok(crlf.includes('\r\n    "b": {\r\n        "c": 1\r\n    }'));
  assert.deepEqual(detectFormatting(""), { insertSpaces: true, tabSize: 2, eol: "\n" });
});

test("a file with only comments keeps them and gets a document", () => {
  const after = mergeJsonc("// Zed keymap\n", { at: [], value: { context: "Editor" }, append: true });
  assert.equal(after, '// Zed keymap\n[\n  {\n    "context": "Editor"\n  }\n]\n');
  assert.equal(mergeJsonc("", { at: ["a"], value: 1 }), '{\n  "a": 1\n}\n');
});

test("a comment at the end of the last line stays with its entry", () => {
  const trailing = '{\n  "theme": "One Dark", // mine\n}\n';
  assert.equal(
    mergeJsonc(trailing, { at: ["a"], value: 1 }),
    '{\n  "theme": "One Dark", // mine\n  "a": 1,\n}\n',
  );
  const noComma = '[\n  { "label": "build" } // mine\n]\n';
  assert.equal(
    mergeJsonc(noComma, { at: [], value: { label: "X" }, append: true }),
    '[\n  { "label": "build" }, // mine\n  {\n    "label": "X"\n  }\n]\n',
  );
});

test("one-line containers stay valid", () => {
  assert.deepEqual(parse(mergeJsonc('{ "a": 1 }', { at: ["b"], value: 2 })), { a: 1, b: 2 });
  assert.deepEqual(parse(mergeJsonc("[1, 2]", { at: [], value: 3, append: true })), [1, 2, 3]);
});

test("replaces the value of a key that exists already", () => {
  const after = mergeJsonc('{\n  // keep\n  "markdown-pdf": { "command": "old" }\n}', { at: ["markdown-pdf"], value: { command: "new" } });
  assert.ok(after.includes("// keep"));
  assert.deepEqual(parse(after), { "markdown-pdf": { command: "new" } });
});

test("keeps a UTF-8 byte order mark and CRLF line endings", () => {
  const after = mergeJsonc('\uFEFF{\r\n  "a": 1 // one\r\n}\r\n', { at: ["b"], value: 2 });
  assert.equal(after, '\uFEFF{\r\n  "a": 1, // one\r\n  "b": 2\r\n}\r\n');
});

test("an empty container keeps the comments inside it", () => {
  assert.equal(
    mergeJsonc("[\n  // none yet\n]\n", { at: [], value: { label: "X" }, append: true }),
    '[\n  // none yet\n  {\n    "label": "X"\n  }\n]\n',
  );
  assert.equal(
    mergeJsonc('{\n  "version": "2.0.0",\n  "tasks": []\n}\n', { at: ["tasks"], value: { label: "X" }, append: true }),
    '{\n  "version": "2.0.0",\n  "tasks": [\n    {\n      "label": "X"\n    }\n  ]\n}\n',
  );
});

test("formatJson: outer levels on lines, short inner values on one line", () => {
  const binding = [{ context: "Editor", bindings: { "cmd-k cmd-e": ["task::Spawn", { task_name: "Export" }] } }];
  assert.equal(
    formatJson(binding),
    '[\n  {\n    "context": "Editor",\n    "bindings": {\n      "cmd-k cmd-e": ["task::Spawn", { "task_name": "Export" }]\n    }\n  }\n]',
  );
  assert.equal(formatJson({}), "{}");
  assert.equal(formatJson([]), "[]");
  assert.equal(formatJson({ a: [] }), '{\n  "a": []\n}');
  const long = { args: ["a".repeat(40), "b".repeat(40)] };
  assert.equal(formatJson(long, "\t"), `{\n\t"args": [\n\t\t"${"a".repeat(40)}",\n\t\t"${"b".repeat(40)}"\n\t]\n}`);
  assert.deepEqual(JSON.parse(formatJson(binding)), binding);
});

test("refuses invalid JSON and says where", () => {
  assert.throws(() => mergeJsonc('{\n  "a": 1\n  "b": 2\n}', { at: ["c"], value: 1 }), /not valid JSON .*line 3/);
});

test("refuses a file of another shape instead of overwriting it", () => {
  assert.throws(() => mergeJsonc('{ "a": 1 }', { at: [], value: 1, append: true }), /the file is not a list/);
  assert.throws(() => mergeJsonc("[1]", { at: ["a"], value: 1 }), /the file is not an object/);
  assert.throws(() => mergeJsonc('{ "tasks": {} }', { at: ["tasks"], value: 1, append: true }), /"tasks" is not a list/);
  assert.throws(() => mergeJsonc('{ "context_servers": 5 }', { at: ["context_servers", "x"], value: 1 }), /"context_servers" is not an object/);
});
