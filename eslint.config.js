import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        global: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-undef": "off",
    },
  },
  // Build and maintenance scripts run under Node.
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
      },
    },
  },
  // Property Inspector scripts run in the Stream Deck webview. `SDPIComponents`
  // is the vendored Elgato component library, loaded by a <script> tag.
  {
    files: ["com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/**/*.js"],
    languageOptions: {
      globals: {
        CSSStyleSheet: "readonly",
        Document: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLOptGroupElement: "readonly",
        HTMLOptionElement: "readonly",
        MutationObserver: "readonly",
        SDPIComponents: "readonly",
        WebSocket: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        confirm: "readonly",
        console: "readonly",
        customElements: "readonly",
        document: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
  },
  prettier,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "com.felixgeelhaar.govee-light-management.sdPlugin/bin/**",
      // Dev-link copy of the plugin, produced by scripts/patch-dev-build.mjs.
      "com.felixgeelhaar.govee-light-management.dev.sdPlugin/**",
      // Vendored Elgato SDPI component bundle — third-party, minified.
      "com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/sdpi-components.js",
      "playwright-report/**",
      "test-results/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
];
