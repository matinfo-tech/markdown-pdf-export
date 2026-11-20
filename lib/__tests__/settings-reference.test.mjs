/**
 * @fileoverview docs/reference/settings.md is generated from the schema and
 * must be committed up to date.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { TARGET, buildSettingsReference } from "../../scripts/build-settings-reference.mjs";
import { buildSettingsSchema } from "../settings-schema.mjs";

test("settings reference page is up to date", () => {
  // Normalize CRLF: Windows checkouts may convert line endings.
  const current = fs.readFileSync(TARGET, "utf8").replaceAll("\r\n", "\n");
  assert.equal(current, buildSettingsReference(), "run: npm run build:reference");
});

test("every setting in the schema is documented", () => {
  const page = buildSettingsReference();
  for (const key of Object.keys(buildSettingsSchema().properties)) {
    if (key === "$schema") continue;
    assert.match(page, new RegExp(`\\| \`${key}\` \\|`), key);
  }
});
