FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile=false

RUN pnpm --filter @citacs/shared run build
RUN pnpm --filter @citacs/api run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "apps/api/dist/apps/api/src/main.js"]
