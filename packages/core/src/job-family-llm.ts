import { z } from 'zod/v4'
import { JOB_FAMILIES, TAXONOMY_VERSION } from '@jobsearch/shared'

/**
 * The paid half of job family assignment (PLAN.md D12).
 *
 * The alias matcher settles whatever a title names outright -- 62% of the real
 * corpus once the taxonomy grew in #36. What is left is not a missing family;
 * it is a title that does not say enough. "Software Engineer", "Manager" and
 * "Director" are real roles whose discipline only the description reveals, and
 * that is the one thing a model can read and a keyword cannot.
 *
 * Same shape as the eligibility pass: the prompt lives here as data with tests
 * around it, and `apps/worker` owns the API call.
 */

const active = JOB_FAMILIES.filter((family) => family.status === 'active')
const ACTIVE_IDS = new Set(active.map((family) => family.id))

/**
 * The taxonomy, rendered for the prompt.
 *
 * Ids and aliases only -- no display labels. Labels live in the message
 * catalogs and are translated (D10), so feeding them here would make the
 * classifier's behaviour depend on which locale happened to be current.
 */
export const FAMILY_CATALOGUE = active
  .map((family) => `${family.id} (${family.group}): ${family.aliases.join(', ')}`)
  .join('\n')

export const FAMILY_SYSTEM_PROMPT = `You assign a job posting to one occupation family.

A keyword matcher has already handled every posting whose title names its family
outright. What reaches you is the remainder: titles like "Software Engineer",
"Manager", "Director" or "Customer Engineer" that state a role without stating a
discipline. The description is what you are here to read.

Choose from exactly these families:

${FAMILY_CATALOGUE}

RULES

Answer with one id from the list above, copied exactly, or null.

null is a real answer and the right one whenever the posting describes work that
none of these families covers. A wrong family is worse than none: it puts the
posting in a feed the reader chose deliberately, and it is invisible to them —
they simply see a job that does not belong.

Judge the work, not the vocabulary. A "Solutions Architect" who spends the role
configuring a product for customers is consulting, not engineering. An
"Engineering Manager" who still designs systems is engineering-management,
because the family describes the job, not the seniority.

When a posting genuinely spans two families, pick the one whose day-to-day work
dominates the description. Do not pick the more prestigious one.`

export const familyVerdictSchema = z.object({
  familyId: z
    .string()
    .nullable()
    .describe('An id copied exactly from the list, or null when none of them fits.'),
  reason: z.string().describe('One sentence, from the description, on why this family.'),
})

export type FamilyVerdict = z.infer<typeof familyVerdictSchema>

export interface CheckedFamily {
  familyId: string | null
  reason: string
  /** Set when the model named a family that does not exist. */
  rejectedId: string | null
}

/** Descriptions are long and the discipline is usually stated early. */
const MAX_DESCRIPTION_CHARS = 6000

export function buildFamilyPrompt(input: { title: string; description: string }): string {
  const description =
    input.description.length > MAX_DESCRIPTION_CHARS
      ? `${input.description.slice(0, MAX_DESCRIPTION_CHARS)}\n[truncated]`
      : input.description
  return [`Title: ${input.title}`, '', 'Posting:', description].join('\n')
}

/**
 * Accept only an id the taxonomy actually has.
 *
 * A model asked to copy from a list will occasionally return something close
 * but wrong -- `engineering-devops` for `engineering-platform`, or a plausible
 * id that was never in the list at all. Ids are permanent and written into
 * stored data, so an invented one is not a label, it is corruption. Rejecting
 * it costs a posting its family; accepting it costs the taxonomy its meaning.
 */
export function checkFamily(verdict: FamilyVerdict): CheckedFamily {
  if (verdict.familyId === null) {
    return { familyId: null, reason: verdict.reason, rejectedId: null }
  }
  if (!ACTIVE_IDS.has(verdict.familyId)) {
    return { familyId: null, reason: verdict.reason, rejectedId: verdict.familyId }
  }
  return { familyId: verdict.familyId, reason: verdict.reason, rejectedId: null }
}

export { TAXONOMY_VERSION }
