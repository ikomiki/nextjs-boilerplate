import boundaries from "eslint-plugin-boundaries";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: true },
      "boundaries/elements": [
        { type: "app", pattern: "apps/*" },
        { type: "counter", pattern: "packages/counter" },
        { type: "ui", pattern: "packages/ui-components" },
        {
          type: "datastore",
          pattern: "packages/datastore-*",
          capture: ["name"],
        },
        { type: "database", pattern: "packages/database" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "app" } },
              allow: {
                to: {
                  element: {
                    types: ["counter", "ui", "datastore", "database"],
                  },
                },
              },
            },
            {
              from: { element: { type: "counter" } },
              allow: { to: { element: { type: "ui" } } },
            },
            {
              from: {
                element: { type: "datastore", captured: { name: "sqlite" } },
              },
              allow: { to: { element: { type: "database" } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["packages/ui-components/src/components/ui/**"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: [
            "TSTypeAliasDeclaration",
            "TSInterfaceDeclaration",
            "ExportNamedDeclaration > VariableDeclaration",
          ],
        },
      ],
    },
  },
];
