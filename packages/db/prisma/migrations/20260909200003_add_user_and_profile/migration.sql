-- CreateEnum
CREATE TYPE "ProfileSeniority" AS ENUM ('junior', 'mid', 'senior', 'staff_plus');

-- CreateEnum
CREATE TYPE "DigestCadence" AS ENUM ('daily', 'weekly', 'off');

-- DropIndex
DROP INDEX "jobs_embedding_idx";

-- DropIndex
DROP INDEX "jobs_search_vector_idx";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "residenceCountry" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "targetRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jobFamilies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetRoles" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" "ProfileSeniority" NOT NULL DEFAULT 'mid',
    "contractModels" "ContractModel"[] DEFAULT ARRAY[]::"ContractModel"[],
    "minCompensation" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interfaceLanguage" TEXT NOT NULL DEFAULT 'en',
    "digestCadence" "DigestCadence" NOT NULL DEFAULT 'weekly',
    "digestSendOn" TEXT NOT NULL DEFAULT 'monday',
    "digestSendAt" TEXT NOT NULL DEFAULT '08:00',
    "digestLanguage" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_residenceCountry_idx" ON "profiles"("residenceCountry");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes Prisma dropped above.
--
-- It diffs indexes against schema.prisma, cannot see `vector` or `tsvector`,
-- and therefore reads these two as drift on every migration -- including this
-- one, which only adds two unrelated tables. Nothing fails when they go; the
-- database just gets slower in a way that surfaces months later.
--
-- packages/db/README.md, and `pnpm db:verify` asserts they are here.
CREATE INDEX "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
