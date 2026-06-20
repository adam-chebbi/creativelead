FROM node:20-alpine AS base

# ── Dependencies ──────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Builder ───────────────────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Generate Prisma client before build
RUN npx prisma generate
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/dist           ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules   ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json   ./package.json
# Prisma schema & migrations need to be present at runtime for migrate deploy
COPY --from=builder --chown=nodejs:nodejs /app/prisma         ./prisma

USER nodejs

EXPOSE 3070

# Run migrations then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
