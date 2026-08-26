-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('ats', 'aggregator', 'vertical', 'community');

-- CreateEnum
CREATE TYPE "EligibilityVerdict" AS ENUM ('confirmed', 'needs_check', 'rejected');

-- CreateEnum
CREATE TYPE "ContractModel" AS ENUM ('contractor_pj', 'eor', 'local_entity', 'employee_relocation', 'unknown');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastPolledAt" TIMESTAMP(3),
    "failureStreak" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "atsType" TEXT,
    "careersUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_postings" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "rawPostingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "jobFamily" TEXT,
    "taxonomyVersion" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" TEXT,
    "language" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "salaryPeriod" TEXT,
    "salaryLabel" TEXT,
    "searchVector" tsvector,
    "embedding" vector(1024),
    "embeddingModel" TEXT,
    "embeddingDimension" INTEGER,
    "embeddedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_eligibility" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "verdict" "EligibilityVerdict" NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "eligibleCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibleRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contractModel" "ContractModel" NOT NULL DEFAULT 'unknown',
    "timezoneRequirement" TEXT,
    "evidenceSnippet" TEXT,
    "evidenceUrl" TEXT,
    "classifierVersion" TEXT NOT NULL,
    "decidedByRules" BOOLEAN NOT NULL DEFAULT false,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unmatched_terms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "origin" TEXT NOT NULL,
    "resolvedTo" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unmatched_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_slug_key" ON "sources"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "companies_domain_key" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "raw_postings_contentHash_idx" ON "raw_postings"("contentHash");

-- CreateIndex
CREATE INDEX "raw_postings_fetchedAt_idx" ON "raw_postings"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "raw_postings_sourceId_externalId_key" ON "raw_postings"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_rawPostingId_key" ON "jobs"("rawPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_contentHash_key" ON "jobs"("contentHash");

-- CreateIndex
CREATE INDEX "jobs_postedAt_idx" ON "jobs"("postedAt");

-- CreateIndex
CREATE INDEX "jobs_jobFamily_idx" ON "jobs"("jobFamily");

-- CreateIndex
CREATE INDEX "jobs_expiresAt_idx" ON "jobs"("expiresAt");

-- CreateIndex
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "job_eligibility_jobId_key" ON "job_eligibility"("jobId");

-- CreateIndex
CREATE INDEX "job_eligibility_verdict_idx" ON "job_eligibility"("verdict");

-- CreateIndex
CREATE INDEX "job_eligibility_classifierVersion_idx" ON "job_eligibility"("classifierVersion");

-- CreateIndex
CREATE UNIQUE INDEX "unmatched_terms_term_key" ON "unmatched_terms"("term");

-- CreateIndex
CREATE INDEX "unmatched_terms_occurrences_idx" ON "unmatched_terms"("occurrences");

-- AddForeignKey
ALTER TABLE "raw_postings" ADD CONSTRAINT "raw_postings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_rawPostingId_fkey" FOREIGN KEY ("rawPostingId") REFERENCES "raw_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_eligibility" ADD CONSTRAINT "job_eligibility_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Additions Prisma cannot express in schema.prisma ───────────────────────
-- Kept in the migration rather than applied by hand so a fresh database and a
-- migrated one end up identical.

-- Evidence is the product's core claim, not a nicety (PLAN.md §4): a confirmed
-- verdict without the quoted line that proves it is a bug. The Zod schema
-- refuses it at the boundary; this refuses it at the source, including for
-- anything written by a worker that bypasses the API.
ALTER TABLE "job_eligibility"
  ADD CONSTRAINT "job_eligibility_confirmed_needs_evidence"
  CHECK ("verdict" <> 'confirmed' OR ("evidenceSnippet" IS NOT NULL AND length(btrim("evidenceSnippet")) > 0));

-- Full-text search over title, company-independent description and skills.
-- Weighted so a title hit outranks a description hit.
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW."skills", '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- 'simple' rather than 'english': postings arrive in several languages (D11),
-- and stemming them all as English is worse than not stemming. Per-language
-- configs can come later, keyed off jobs."language".
CREATE TRIGGER jobs_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "description", "skills"
  ON "jobs"
  FOR EACH ROW EXECUTE FUNCTION jobs_search_vector_update();

CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");

-- Vector index for M3 matching. HNSW over cosine distance, which is what
-- Cohere embeddings are normalised for (D13).
--
-- Deliberately created now, while the table is empty: building an HNSW index
-- over a populated table is slow and locks writes.
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);

-- Case-insensitive company lookup, for the dedup pass that has to recognise
-- "Layered", "layered" and "Layered Inc." as one company.
CREATE INDEX "companies_name_lower_idx" ON "companies" (lower("name"));
