# Hearst Connect — Production Dockerfile
# Multi-stage build for minimal image size.

# ── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Local tarball deps (file:./hearst-*.tgz in package.json) must be present
# during install — copy them alongside the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml hearst-cockpit-shell-0.2.1.tgz hearst-hub-sdk-0.2.0.tgz ./
# Pin pnpm@10 — pnpm@11 ships the minimumReleaseAge supply-chain policy on by
# default, which rejects file:./*.tgz workspace tarballs (lookup → 404 on
# npm registry). The lockfile was generated with 10.x anyway.
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN pnpm db:generate

# Build the application
ENV STANDALONE_BUILD=1
RUN pnpm build

# ── Stage 3: Runner ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4105

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only what's needed for production
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 4105

ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
