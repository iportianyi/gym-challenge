import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Keep caches out of the bind-mounted working tree and the read-only node_modules (see design.md, Docker).
  cacheDir: "/tmp/vite-cache",
  test: {
    environment: "jsdom",
  },
});
