import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC rather than Vitest's default esbuild, for the same reason the service runs
// under SWC (README): Nest's dependency injection needs decorator metadata, and
// esbuild does not emit it. Without this, a test that boots the real app gets
// `undefined` for every injected service.
export default defineConfig({ plugins: [swc.vite()] })
