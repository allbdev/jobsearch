-- CreateEnum
CREATE TYPE "JobInteractionStatus" AS ENUM ('saved', 'applied', 'dismissed');

-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- CreateTable
CREATE TABLE "job_interactions" (
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobInteractionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_interactions_pkey" PRIMARY KEY ("userId","jobId")
);

-- CreateIndex
CREATE INDEX "job_interactions_userId_status_updatedAt_idx" ON "job_interactions"("userId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "job_interactions" ADD CONSTRAINT "job_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_interactions" ADD CONSTRAINT "job_interactions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes Prisma dropped above.
--
-- Prisma cannot see `vector` or `tsvector`, reads these two as drift, and drops
-- them on every migration -- this one only adds job_interactions.
-- packages/db/README.md, and `pnpm db:verify` asserts they are here.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
