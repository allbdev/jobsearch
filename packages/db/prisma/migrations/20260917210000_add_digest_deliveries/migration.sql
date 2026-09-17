-- Written by hand rather than generated: `prisma migrate dev` cannot add a
-- required unique column to a table that already has rows without asking what
-- to put in them. Existing profiles get a value first, then the constraints.
ALTER TABLE "profiles" ADD COLUMN "unsubscribeToken" TEXT;
UPDATE "profiles" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;
ALTER TABLE "profiles" ALTER COLUMN "unsubscribeToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_unsubscribeToken_key" ON "profiles"("unsubscribeToken");

-- CreateTable
CREATE TABLE "digest_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobCount" INTEGER NOT NULL,

    CONSTRAINT "digest_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digest_deliveries_userId_sentAt_idx" ON "digest_deliveries"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes Prisma drops whenever it writes a migration.
--
-- This one was written by hand and drops nothing, but the next generated
-- migration will, and `pnpm db:verify` asserts these exist either way.
-- packages/db/README.md.
CREATE INDEX IF NOT EXISTS "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
