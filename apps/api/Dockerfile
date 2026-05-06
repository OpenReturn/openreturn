FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/adapters/package.json packages/adapters/package.json
COPY packages/return-methods/package.json packages/return-methods/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @openreturn/api prisma:generate && pnpm --filter @openreturn/api... build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
EXPOSE 4000
CMD ["pnpm", "--filter", "@openreturn/api", "start"]
