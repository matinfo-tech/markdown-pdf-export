/**
 * @fileoverview Add one entry to a JSON-with-comments file (Zed settings,
 * keymap and tasks, VS Code tasks, MCP configs) without touching anything
 * else: comments, trailing commas, key order and the user's own formatting
 * stay exactly as they were. The new entry goes on its own lines after the
 * last one, in the file's own indentation.
 */
import jsonc from "jsonc-parser";

const PARSE_OPTIONS = { allowTrailingComma: true, disallowComments: false };

/** Indentation and line ending the file already uses (2 spaces by default). */
export function detectFormatting(text) {
  const indent = /^([ \t]+)\S/m.exec(text)?.[1] ?? "  ";
  return {
    insertSpaces: !indent.startsWith("\t"),
    tabSize: indent.startsWith("\t") ? 1 : indent.length,
    eol: text.includes("\r\n") ? "\r\n" : "\n",
  };
}

/**
 * @param {string} source current file content ("" for an empty file)
 * @param {{at: (string|number)[], value: unknown, append?: boolean}} change
 *   `append`: add `value` to the array at `at` (created when missing);
 *   otherwise set the object key path `at` to `value`.
 * @returns {string} the new content
 * @throws {Error} when the file is not valid JSON(C) or has another shape
 */
export function mergeJsonc(source, { at, value, append = false }) {
  // Keep a UTF-8 byte order mark (some Windows editors write one) but parse without it.
  const bom = source.startsWith("﻿") ? "﻿" : "";
  const out = mergeText(source.slice(bom.length), at, value, append);
  verify(out, at, value, append);
  return bom + out;
}

function mergeText(text, at, value, append) {
  const fo = detectFormatting(text);
  const unit = fo.insertSpaces ? " ".repeat(fo.tabSize) : "\t";

  // Only comments (or nothing): no document yet. Keep the comments, add one.
  if (jsonc.stripComments(text).trim() === "") {
    // Spread over lines as far as the entry itself (formatJson's own "top").
    const doc = append ? nest(at, [value]) : nest(at, value);
    const body = formatJson(doc, unit, at.length + 2).split("\n").join(fo.eol);
    const head = text.trimEnd();
    return `${head}${head ? fo.eol : ""}${body}${fo.eol}`;
  }

  const errors = [];
  const root = jsonc.parseTree(text, errors, PARSE_OPTIONS);
  if (errors.length || !root) {
    const { error, offset } = errors[0] ?? { error: 0, offset: 0 };
    const line = text.slice(0, offset).split("\n").length;
    throw new Error(`it is not valid JSON (${jsonc.printParseErrorCode(error)} on line ${line})`);
  }

  // The list (append) or object (set) that receives the entry, and the
  // deepest part of that path that exists already.
  const container = append ? at : at.slice(0, -1);
  let depth = 0;
  let node = root;
  for (; depth < container.length && node.type === "object"; depth++) {
    const next = jsonc.findNodeAtLocation(node, [container[depth]]);
    if (!next) break;
    node = next;
  }
  const missing = container.slice(depth);
  const wantType = missing.length || !append ? "object" : "array";
  if (node.type !== wantType) {
    const where = depth ? `"${container.slice(0, depth).join(".")}"` : "the file";
    throw new Error(`${where} is not ${wantType === "array" ? "a list" : "an object"}`);
  }

  // Setting a key that exists already: replace its value in place.
  if (!append && !missing.length && jsonc.findNodeAtLocation(node, [at.at(-1)])) {
    return formatInserted(text, jsonc.modify(text, at, value, {}), fo);
  }

  // What goes into `node`: a list item, or one key holding the rest of the path.
  const keys = append ? missing : [...missing, at.at(-1)];
  const leaf = append ? [value] : value;
  const entry = keys.length ? { key: keys[0], value: nest(keys.slice(1), leaf) } : { value };

  const head = entry.key === undefined ? "" : `${JSON.stringify(entry.key)}: `;
  const last = node.children?.at(-1);

  // Empty container ("[]", "{ // comment }"): the entry goes just before the
  // closing bracket; anything already inside (comments) stays above it.
  if (!last) {
    const close = node.offset + node.length - 1;
    const outer = lineIndent(text, node.offset);
    const inner = outer + unit;
    const before = text.slice(0, close).trimEnd();
    return `${before}${fo.eol}${inner}${head}${pretty(entry.value, unit, inner, fo.eol, missing.length + 1)}${fo.eol}${outer}${text.slice(close)}`;
  }

  const after = lineAfter(text, last.offset + last.length);
  if (after.sameLineClose) {
    // One-line container ({ "a": 1 }): the library inserts it neatly.
    const path = [...container.slice(0, depth), entry.key ?? -1];
    return formatInserted(text, jsonc.modify(text, path, entry.value, { isArrayInsertion: entry.key === undefined }), fo);
  }

  // Multi-line container: new lines after the last entry's line, so a comment
  // at the end of that line stays with its entry. A trailing comma is kept
  // as the file's style.
  const indent = lineIndent(text, last.offset);
  const added = `${fo.eol}${indent}${head}${pretty(entry.value, unit, indent, fo.eol, missing.length + 1)}${after.comma ? "," : ""}`;
  const end = last.offset + last.length;
  return after.comma
    ? text.slice(0, after.lineEnd) + added + text.slice(after.lineEnd)
    : `${text.slice(0, end)},${text.slice(end, after.lineEnd)}${added}${text.slice(after.lineEnd)}`;
}

/**
 * From the end of the last entry: is there a comma, where does its line end
 * (after any comment on it), and does the container close on that same line?
 */
function lineAfter(text, from) {
  let i = from;
  const skipSpaces = () => {
    while (text[i] === " " || text[i] === "\t") i++;
  };
  skipSpaces();
  const comma = text[i] === ",";
  if (comma) i++;
  skipSpaces();
  // One-line block comments stay on the line; a multi-line one starts the next part.
  while (text.startsWith("/*", i)) {
    const close = text.indexOf("*/", i + 2);
    if (close === -1 || text.slice(i, close).includes("\n")) break;
    i = close + 2;
    skipSpaces();
  }
  const sameLineClose = text[i] === "]" || text[i] === "}";
  if (text.startsWith("//", i)) {
    const nl = text.indexOf("\n", i);
    i = nl === -1 ? text.length : nl;
    if (text[i - 1] === "\r") i--;
  }
  return { comma, sameLineClose, lineEnd: i };
}

/** Leading whitespace of the line holding `offset`. */
function lineIndent(text, offset) {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start, offset))[0];
}

/** JSON in the file's indent unit, every line after the first prefixed. */
function pretty(value, unit, prefix, eol, spread = 1) {
  return formatJson(value, unit, spread).split("\n").join(eol + prefix);
}

/** Longest list or object written on one line, as Zed and VS Code files do. */
const INLINE_MAX = 60;

/**
 * JSON the way people write config files: the outer levels spread over
 * lines, short lists and objects inside them on one line
 * (`"cmd-k cmd-e": ["task::Spawn", { "task_name": "…" }]`).
 * @param {unknown} value
 * @param {string} [unit] one indentation level
 * @param {number} [spread] how many levels are always spread over lines
 */
export function formatJson(value, unit = "  ", spread = 2) {
  const write = (v, indent, level) => {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    const isList = Array.isArray(v);
    const parts = isList
      ? v.map((x) => write(x, indent + unit, level + 1))
      : Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${write(x, indent + unit, level + 1)}`);
    if (!parts.length) return isList ? "[]" : "{}";
    const [open, close] = isList ? ["[", "]"] : ["{", "}"];
    const inline = isList ? `[${parts.join(", ")}]` : `{ ${parts.join(", ")} }`;
    if (level >= spread && !inline.includes("\n") && inline.length <= INLINE_MAX) return inline;
    return `${open}\n${parts.map((p) => indent + unit + p).join(",\n")}\n${indent}${close}`;
  };
  return write(value, "", 0);
}

/** `{a: {b: value}}` for `at = ["a", "b"]`. */
function nest(at, value) {
  return at.reduceRight((inner, key) => ({ [key]: inner }), value);
}

/** Apply edits, then format only the text they inserted. */
function formatInserted(text, edits, fo) {
  let out = jsonc.applyEdits(text, edits);
  const ranges = [];
  let shift = 0;
  for (const edit of [...edits].sort((a, b) => a.offset - b.offset)) {
    ranges.push({ offset: edit.offset + shift, length: edit.content.length });
    shift += edit.content.length - edit.length;
  }
  for (const range of ranges.reverse()) out = jsonc.applyEdits(out, jsonc.format(out, range, fo));
  return out;
}

/** Never write a file that does not parse back to what was asked. */
function verify(out, at, value, append) {
  const errors = [];
  const data = jsonc.parse(out, errors, PARSE_OPTIONS);
  let node = data;
  for (const key of at) node = node?.[key];
  const found = append ? Array.isArray(node) && node.some((v) => same(v, value)) : same(node, value);
  if (errors.length || !found) throw new Error("the change could not be made safely");
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
