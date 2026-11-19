import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "vendor/",
      "docs/",
      "node_modules/",
      "test-fixtures/",
      ".claude/",
      ".codegraph/",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    // Studio page: runs in the browser (model.mjs is also imported by tests).
    files: ["studio/*.mjs"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // test-fixtures is ignored above; unit tests live in lib/__tests__.
    files: ["lib/__tests__/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
];
