# The worker, as one image. Same shape as the API's: install the workspace,
# generate the Prisma client, then run one command per machine start.
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
COPY apps/worker/package.json ./apps/worker/
# `--ignore-scripts`: packages/db's postinstall runs `prisma generate`, and the
# schema is not copied yet.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @jobsearch/worker...

COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm --filter @jobsearch/db generate

ENV NODE_ENV=production

# No default command worth having: this image is run by the scheduler, one
# command per run (`worker cycle`, `worker digest`). `health` is what a machine
# started with no arguments should do -- it exits non-zero if a source is
# failing, which is a useful default rather than a silent no-op.
CMD ["pnpm", "--filter", "@jobsearch/worker", "worker", "health"]
