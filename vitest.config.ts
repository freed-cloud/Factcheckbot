import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Bestaat alleen bij Cloudflare; in de tests gebruiken we een simpele vervanger.
      "cloudflare:workers": new URL("./test/stubs/cloudflare-workers.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
