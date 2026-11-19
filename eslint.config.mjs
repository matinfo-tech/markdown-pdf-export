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
    // test-fixtures is ignored above; unit tests live in lib/__tests__.
    files: ["lib/__tests__/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
];
