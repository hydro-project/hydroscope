import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";
import hydroscopeArchitecture from "./eslint-rules/index.js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        HTMLElement: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      react,
      "react-hooks": reactHooks,
      prettier,
      "unused-imports": unusedImports,
      "hydroscope-architecture": hydroscopeArchitecture,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...prettierConfig.rules,

      // TS and code generation can result in unused symbols; disable these checks
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Use unused-imports plugin instead for auto-fixable unused vars
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off", // Allow any - this codebase uses it extensively for bridges/tests
      "@typescript-eslint/no-require-imports": "off", // Allow require in tests
      "@typescript-eslint/no-empty-object-type": "off", // Allow empty interfaces for extensibility
      "no-empty": "off",
      "no-case-declarations": "off",
      "no-dupe-keys": "error",
      // Allow function declarations in blocks for recursive validators
      "no-inner-declarations": "off",
      // TS handles name resolution
      "no-undef": "off",

      // React specific rules
      "react/react-in-jsx-scope": "off", // Not needed with React 17+
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/display-name": "warn",
      "react/no-unescaped-entities": "warn",

      // React Hooks rules - make them warnings not errors
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",

      // Prettier integration
      "prettier/prettier": "error",

      // Hydroscope architecture compliance rules
      "hydroscope-architecture/no-bridge-state": "error",
      "hydroscope-architecture/enforce-bridge-interfaces": "error",
    },
  },
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.min.js",
      "build/**",
      ".next/**",
      "out/**",
    ],
  },
];
