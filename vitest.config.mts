import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL("src/test/vscodeStub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "src/**/*.test.ts", "src/api/git.d.ts"],
    },
  },
})
