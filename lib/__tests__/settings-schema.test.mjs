/**
 * @fileoverview Settings JSON Schema: valid schema, generated file up to date,
 * shipped templates validate, and typos are caught.
 *
 * Run with: node --test lib/__tests__/settings-schema.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

import { SETTINGS_SCHEMA_URL, buildSettingsSchema } from "../settings-schema.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const schema = buildSettingsSchema();
const validate = new Ajv({ strict: true, allowUnionTypes: true, allErrors: true }).compile(
  schema,
);
const errorsOf = () => JSON.stringify(validate.errors, null, 2);

describe("settings schema", () => {
  it("generated files are up to date", () => {
    const expected = `${JSON.stringify(schema, null, 2)}\n`;
    for (const rel of ["schema/settings.schema.json", "docs/public/schema/settings.schema.json"]) {
      assert.equal(
        fs.readFileSync(path.join(ROOT, rel), "utf8").replaceAll("\r\n", "\n"),
        expected,
        `${rel} is stale — run: npm run build:schema`,
      );
    }
  });

  it("templates point at the published schema and validate", () => {
    const dir = path.join(ROOT, "templates");
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      assert.equal(data.$schema, SETTINGS_SCHEMA_URL, name);
      assert.ok(validate(data), `${name}: ${errorsOf()}`);
    }
  });

  it("accepts full zone syntax and null zones", () => {
    const ok = validate({
      page_format: "Letter",
      output_directory: "pdf",
      assets_directory: "assets",
      header: {
        left: [{ type: "image", src: "@/logo.svg", height: "10mm" }, { type: "spacer" }],
        center: { type: "title", fallback: "Untitled" },
        right: null,
      },
      footer: { center: { type: "page_number", format: "Page {page}" } },
    });
    assert.ok(ok, errorsOf());
  });

  it("rejects typos and wrong values", () => {
    assert.equal(validate({ page_fromat: "A4" }), false);
    assert.equal(validate({ page_format: "A9" }), false);
    assert.equal(validate({ header: { center_txt: "x" } }), false);
    assert.equal(validate({ footer: { center: { type: "text" } } }), false);
    assert.equal(validate({ input_path: "a.md" }), false);
  });
});
