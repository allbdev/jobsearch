import { PrismaClient } from '@prisma/client'

export * from '@prisma/client'

/**
 * A single client per process.
 *
 * Next's dev server re-evaluates modules on every hot reload, and a new
 * PrismaClient each time exhausts Postgres connections within a few edits. The
 * global cache is the standard guard. It matters here even though `apps/web`
 * is forbidden from importing this package (PLAN.md D5) — `apps/worker` will
 * hot-reload the same way.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
