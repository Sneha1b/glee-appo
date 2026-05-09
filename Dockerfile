# syntax=docker/dockerfile:1.7
# ---------- Build stage ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Install deps with cache-friendly layering
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Copy source and build
COPY . .

# Build the TanStack Start app for a Node SSR target.
# NOTE: The current vite config uses @lovable.dev/vite-tanstack-config which
# targets Cloudflare. Before deploying to AWS you must swap to a Node SSR
# preset (see plan: "Repo prep" step 3). The build below assumes that swap
# has been made and the output lands in `.output/` (Nitro/Node convention).
RUN bunx vite build --config vite.config.aws.ts

# ---------- Runtime stage ----------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy only the built server output
COPY --from=build /app/.output ./.output

# Non-root user
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nodeuser \
 && chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
