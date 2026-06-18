import { defineConfig } from "vite";

const pagesBase = process.env.CORPS_PAGES_BASE || "./";

export default defineConfig({
  base: pagesBase,
  build: { outDir: "dist", emptyOutDir: true },
});
