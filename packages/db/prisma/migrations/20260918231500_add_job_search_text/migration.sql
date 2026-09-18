-- A reader's search terms have to match whole words.
--
-- `contains` has no word boundary, so "rust" matched 1,407 of 3,010 live
-- postings -- almost every one of them saying "trusted" -- and "react" matched
-- a security role that is "both reactive and proactive". A filter that loose is
-- worse than no filter, because the reader believes it.
--
-- `searchText` is the posting flattened for that one job: lower-cased, every
-- run of non-alphanumerics collapsed to a single space, and wrapped in spaces
-- so the first and last words have a boundary too. A whole-word match is then
-- `searchText LIKE '% term %'` -- which Prisma can express as `contains`,
-- keeping the feed query one composable filter instead of raw SQL.
--
-- Not a tsvector match: `searchVector` uses the 'simple' config, and Prisma
-- cannot read a tsvector at all (it is Unsupported), so filtering on it would
-- mean raw SQL in the middle of the feed's `where`.
--
-- Not a GENERATED column: this repo already maintains `searchVector` from a
-- trigger, and Prisma reads a generated column as drift it wants to rewrite.
-- A plain column filled by the same trigger stays invisible to the diff.
ALTER TABLE "jobs" ADD COLUMN "searchText" TEXT;

-- The existing trigger already fires on exactly the three columns this reads.
CREATE OR REPLACE FUNCTION jobs_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW."skills", '{}'), ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'C');

  -- `[:alnum:]` rather than `a-z0-9`: postings arrive in several languages
  -- (D11), and "gestão" must not become "gest o".
  NEW."searchText" := ' ' || regexp_replace(
    lower(
      coalesce(NEW."title", '') || ' ' ||
      array_to_string(coalesce(NEW."skills", '{}'), ' ') || ' ' ||
      coalesce(NEW."description", '')
    ),
    '[^[:alnum:]]+', ' ', 'g'
  ) || ' ';

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Every row already in the index. The trigger fires on UPDATE OF the three
-- source columns, so it does not fire for this one -- the value is written
-- directly, by the same expression.
UPDATE "jobs" SET "searchText" = ' ' || regexp_replace(
  lower(
    coalesce("title", '') || ' ' ||
    array_to_string(coalesce("skills", '{}'), ' ') || ' ' ||
    coalesce("description", '')
  ),
  '[^[:alnum:]]+', ' ', 'g'
) || ' ';

-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create the raw-SQL indexes, in case Prisma dropped them above.
--
-- Prisma cannot see `vector` or `tsvector`, reads these two as drift, and drops
-- them on every migration. packages/db/README.md, and `pnpm db:verify` asserts
-- they are here.
CREATE INDEX IF NOT EXISTS "jobs_search_vector_idx" ON "jobs" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "jobs_embedding_idx" ON "jobs" USING hnsw ("embedding" vector_cosine_ops);
