/**
 * The one vocabulary both halves of the classifier answer in.
 *
 * Matching a user is an intersection of a posting's `eligibleRegions` with
 * where they live, so the two sides have to speak the same language. The LLM
 * pass was constrained to these codes from the start; the rules pass was not,
 * and stored whatever it had captured -- "Massachusetts - Boston", "India",
 * and, from splitting "New York, NY" on the comma, "NY". Two dialects in one
 * column, and nothing intersects across them.
 *
 * The codes are deliberately coarse. This answers "could someone living here
 * take this job", not "where exactly is this job", and a Brazilian reader does
 * not need Boston distinguished from Philadelphia.
 *
 * Lives in @jobsearch/shared rather than core because the web app offers these
 * codes as picker options, and a picker speaking different strings -- "Brazil
 * listed", "EU-eligible" -- saves feeds that match nothing. Labels are
 * translations keyed by code, in `apps/web/messages/*.json` under `regions`.
 */
export const REGION_VOCABULARY = [
  'Worldwide',
  'Americas',
  'LATAM',
  'BR',
  'US',
  'CA',
  'EU',
  'UK',
  'APAC',
] as const

export type Region = (typeof REGION_VOCABULARY)[number]
