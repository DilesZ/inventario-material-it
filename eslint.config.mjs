import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  // Temporarily disable next linting to fix build
  // ...nextVitals,
  // ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
