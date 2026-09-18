# The API, as one image. Kept deliberately plain: install the workspace, generate
# the Prisma client, run the service the same way `pnpm start` does locally.
FROM node:22-slim

# Prisma's query engine needs OpenSSL; the slim image does not ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

# Manifests first, so a change to source code does not re-install the workspace.
# `tsconfig.base.json` too: every package's tsconfig extends it, and the SWC
# loader reads it at startup — without it the service dies on its first import.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sources/package.json ./packages/sources/
COPY apps/api/package.json ./apps/api/
# `--ignore-scripts`: packages/db's postinstall runs `prisma generate`, and the
# schema is not copied yet.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @jobsearch/api...

COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @jobsearch/db generate

ENV NODE_ENV=production
ENV API_PORT=8080
EXPOSE 8080
CMD ["pnpm", "--filter", "@jobsearch/api", "start"]
