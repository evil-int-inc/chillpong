import { fileURLToPath, URL } from "url";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      setupFiles: ["./src/test/setup.ts"],
      testIdAttribute: "data-ocid",
      environment: "jsdom",
    },
  }),
);
