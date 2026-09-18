-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- AlterTable
ALTER TABLE "feeds" ADD COLUMN     "searchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes Prisma dropped above.
--
-- Prisma cannot see `vector` or `tsvector`, reads these two as drift, and drops
-- them on every migration -- this one only adds a column.
-- packages/db/README.md, and `pnpm db:verify` asserts they are here.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
