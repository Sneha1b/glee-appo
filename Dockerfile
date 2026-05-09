# syntax=docker/dockerfile:1.7
# ---------- Build stage ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Install deps with cache-friendly layering
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Copy source and build
COPY . .

RUN bunx vite build --config vite.config.aws.ts

# ---------- Runtime stage ----------
FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies using the lockfile
COPY --from=build /app/package.json /app/bun.lock* /app/bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Copy built output and migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/aws/db/migrations ./aws/db/migrations
COPY --from=build /app/aws/db/migrate.ts ./aws/db/migrate.ts

# Non-root user (bun image ships with a 'bun' user)
RUN chown -R bun:bun /app
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server/server.js"]
