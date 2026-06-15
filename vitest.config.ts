import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "feedback-api/src/**/*.test.ts"],
  },
});
