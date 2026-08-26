/*
  Warnings:

  - You are about to drop the column `rawPostingId` on the `jobs` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_rawPostingId_fkey";

-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_rawPostingId_key";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "rawPostingId";

-- AlterTable
ALTER TABLE "raw_postings" ADD COLUMN     "jobId" TEXT;

-- CreateIndex
CREATE INDEX "raw_postings_jobId_idx" ON "raw_postings"("jobId");

-- AddForeignKey
ALTER TABLE "raw_postings" ADD CONSTRAINT "raw_postings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Re-create the indexes Prisma just dropped ──────────────────────────────
--
-- Prisma diffs indexes against schema.prisma. The HNSW and GIN indexes are
-- raw SQL because Prisma has no vector or tsvector type, so it cannot see them
-- in the schema, reads them as drift, and drops them -- silently, in the
-- DropIndex block above.
--
-- Triggers and CHECK constraints survive because Prisma does not diff those.
-- Indexes it does. Every future migration will do this again, so `pnpm
-- db:verify` asserts they are present and CI runs it.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
