/**
 * AWS deploy build config.
 *
 * Used INSTEAD of vite.config.ts when building the Docker image for AWS.
 * The Lovable preset (used by vite.config.ts) bundles Cloudflare Workers as
 * the SSR target, which won't run on a plain Node EC2 host. This config
 * targets Node 20 + Nitro's "node-server" preset so `node .output/server/index.mjs`
 * works inside the Dockerfile we already have.
 *
 * Switch in CI / Dockerfile with:
 *   bunx vite build --config vite.config.aws.ts
 *
 * DO NOT use this in the Lovable preview — it doesn't load the Lovable
 * componentTagger / error-logger plugins.
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      target: "node-server", // Nitro preset → emits .output/server/index.mjs
      customViteReactPlugin: true,
    }),
    viteReact(),
  ],
  server: { port: 3000 },
});
