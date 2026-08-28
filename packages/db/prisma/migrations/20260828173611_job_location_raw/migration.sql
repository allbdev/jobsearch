-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "locationRaw" TEXT;

-- Re-create what Prisma just dropped. It diffs indexes against schema.prisma
-- and cannot see raw-SQL ones, so every migration drops these. `pnpm db:verify`
-- catches it if this is ever forgotten; see packages/db/README.md.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
