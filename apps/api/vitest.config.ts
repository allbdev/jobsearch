import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC rather than Vitest's default esbuild, for the same reason the service runs
// under SWC (README): Nest's dependency injection needs decorator metadata, and
// esbuild does not emit it. Without this, a test that boots the real app gets
// `undefined` for every injected service.
//
// One file at a time: every file here shares one real Postgres, and a count taken
// in one file moves when another inserts jobs mid-test. That made the feed-count
// assertion in feeds-ownership.test.ts fail about one run in three. The suite is
// a few seconds either way.
export default defineConfig({ plugins: [swc.vite()], test: { fileParallelism: false } })
