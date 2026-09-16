-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- CreateTable
CREATE TABLE "feeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobFamilies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibleFrom" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contractModels" "ContractModel"[] DEFAULT ARRAY[]::"ContractModel"[],
    "minCompensation" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "freshnessDays" INTEGER,
    "hideRejected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feeds_userId_idx" ON "feeds"("userId");

-- AddForeignKey
ALTER TABLE "feeds" ADD CONSTRAINT "feeds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes Prisma dropped above.
--
-- Prisma cannot see `vector` or `tsvector`, reads these two as drift, and drops
-- them on every migration -- this one only adds an unrelated table.
-- packages/db/README.md, and `pnpm db:verify` asserts they are here.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
