FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY assets ./assets
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json vite.config.ts ./

RUN pnpm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["--http", "--host", "0.0.0.0", "--port", "3000"]
