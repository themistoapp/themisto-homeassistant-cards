import { defineConfig } from "vitest/config";

// Library build: one ES module with Lit and both fonts inlined, so HA needs a single resource URL.
export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "themisto-cards.js" },
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    minify: true,
    copyPublicDir: false,
  },
  test: { environment: "happy-dom", include: ["tests/**/*.test.ts"] },
});
