# @jobsearch/api

The service that owns business logic and database access (PLAN.md **D2**,
**D5**). `apps/web` is a BFF and reaches it over HTTP; it never imports
`@jobsearch/db`, and dependency-cruiser fails the build if it tries.

```bash
pnpm --filter @jobsearch/api dev     # http://localhost:3001
curl localhost:3001/health
```

## Why it runs under SWC and not tsx

Every other TypeScript entry point in this repo runs under `tsx`. This one
cannot.

Nest resolves constructor dependencies by reading their *types* at runtime, out
of the metadata TypeScript emits under `emitDecoratorMetadata`. esbuild — which
is what tsx uses — does not emit it, and there is no flag that makes it.

The failure is silent. Nothing complains at wiring time; the container hands the
constructor `undefined` and it surfaces much later as a null dereference on the
first request that touches the dependency:

```
TypeError: Cannot read properties of undefined (reading 'value')
```

So this app runs under `@swc-node/register`, which does emit it. That is Nest's
own documented alternative, and it costs nothing else: the loader compiles the
workspace packages' TypeScript from `node_modules` exactly as tsx did, so the
repo keeps shipping source rather than gaining a build step.

**If DI ever starts handing out `undefined`, check the runner first.**

## Layout

```
src/main.ts              bootstrap
src/app.module.ts        root module
src/prisma/              the db client, as an injectable
src/health/              liveness that actually queries the database
src/feeds/               a saved feed, run as a query over the live index
```
