import { REGION_VOCABULARY, type Region } from '@jobsearch/shared'

// The vocabulary itself lives in @jobsearch/shared, beside the pickers that
// offer it; re-exported so the classifier keeps one import for everything
// region-shaped.
export { REGION_VOCABULARY, type Region }

const words = (list: string) => list.trim().split(/\s+/)

// US states and territories, by name and by postal code. The postal codes are
// what "San Francisco, CA" and "Austin, TX" reduce to, and the names are what
// Lever's "Massachusetts - Boston" leads with.
const US_STATES = words(`
  alabama alaska arizona arkansas california colorado connecticut delaware florida georgia
  hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts
  michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon
  pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming
`)
const US_STATE_PHRASES = [
  'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota',
  'rhode island', 'south carolina', 'south dakota', 'west virginia', 'district of columbia',
  'puerto rico',
]
const US_STATE_CODES = words(`
  AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ
  NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC
`)

const EU_COUNTRIES = words(`
  austria belgium bulgaria croatia cyprus czechia denmark estonia finland france germany
  greece hungary ireland italy latvia lithuania luxembourg malta netherlands poland portugal
  romania slovakia slovenia spain sweden
`)
const EU_PHRASES = ['czech republic', 'the netherlands']

const APAC_COUNTRIES = words(`
  india japan australia singapore china korea philippines indonesia malaysia thailand vietnam
  taiwan philippines
`)
const APAC_PHRASES = ['new zealand', 'hong kong', 'south korea']

const LATAM_COUNTRIES = words(`
  argentina chile colombia peru uruguay paraguay bolivia ecuador venezuela mexico panama
  guatemala honduras nicaragua
`)
const LATAM_PHRASES = ['costa rica', 'dominican republic', 'el salvador', 'latin america', 'south america', 'central america']

const UK_TERMS = ['united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland', 'london', 'uk', 'gb']
const CA_TERMS = ['canada', 'ontario', 'quebec', 'british columbia', 'alberta', 'toronto', 'vancouver', 'montreal', 'ottawa']
const US_TERMS = ['united states', 'usa', 'u.s.', 'u.s.a.', 'us', 'america', 'united states of america']
const BR_TERMS = ['brazil', 'brasil', 'br']
// "remote" is deliberately NOT here. A location field that says only "Remote"
// is the ambiguous case this whole product exists to resolve -- reading it as
// "hires worldwide" is exactly the false badge #25 was about.
const WORLDWIDE_TERMS = ['worldwide', 'global', 'globally', 'anywhere']

// Blocs a source names directly. Deliberately shallow: "EMEA" is read as EU+UK
// because those are the codes we have, which understates it, and no code is
// invented for the Middle East or Africa rather than pretending otherwise.
const BLOC_TERMS: Record<string, readonly Region[]> = {
  europe: ['EU'],
  'eastern europe': ['EU'],
  'western europe': ['EU'],
  'north america': ['US', 'CA'],
  emea: ['EU', 'UK'],
}

function build(): Map<string, Region> {
  const map = new Map<string, Region>()
  const add = (terms: readonly string[], region: Region) => {
    for (const term of terms) if (!map.has(term)) map.set(term, region)
  }

  // Order matters where a term could belong to two lists: the first wins.
  // Brazil before LATAM so a Brazilian posting keeps its own code, and Ireland
  // is EU while Northern Ireland is UK -- hence the phrase list is checked as
  // written, longest phrases first at lookup time.
  add(BR_TERMS, 'BR')
  add(UK_TERMS, 'UK')
  add(CA_TERMS, 'CA')
  add(US_TERMS, 'US')
  add(US_STATES, 'US')
  add(US_STATE_PHRASES, 'US')
  add(US_STATE_CODES.map((code) => code.toLowerCase()), 'US')
  add(EU_COUNTRIES, 'EU')
  add(EU_PHRASES, 'EU')
  add(APAC_COUNTRIES, 'APAC')
  add(APAC_PHRASES, 'APAC')
  add(LATAM_COUNTRIES, 'LATAM')
  add(LATAM_PHRASES, 'LATAM')
  add(WORLDWIDE_TERMS, 'Worldwide')
  // Our own codes are recognised too, so a value that has already been
  // normalised survives a second pass -- with one exception. "CA" is this
  // vocabulary's code for Canada and simultaneously the most common US state
  // abbreviation there is. The input to this function is a *source's* words for
  // a place, and a source writes "Canada" when it means Canada; it writes "CA"
  // in "San Francisco, CA". So CA reads as California, and Canada is reached by
  // name. Getting this backwards would move Californian jobs to another
  // country, silently.
  for (const code of REGION_VOCABULARY) {
    if (code === 'CA') continue
    map.set(code.toLowerCase(), code)
  }
  return map
}

const GAZETTEER = build()

/**
 * Reduce a source's own words for a place to the codes a user can be matched
 * against.
 *
 * Sources write a place a dozen ways -- "Massachusetts - Boston",
 * "San Francisco, CA", "Remote, US; Canada", "United Kingdom - London". Every
 * separator is tried and every fragment looked up, because the meaningful token
 * is first in one convention and last in another.
 *
 * Returns an empty array when nothing is recognised. That is a real answer, not
 * a failure: the caller must not claim a scope it cannot express, and an empty
 * result is what tells it to say `needs_check` instead.
 */
export function toRegions(place: string | null | undefined): Region[] {
  if (!place) return []
  const found = new Set<Region>()

  const cleaned = place.toLowerCase().replace(/\(|\)/g, ' ')

  // Multi-word entries first: "new york" must not be read as "york", and
  // "northern ireland" must not be read as "ireland".
  for (const [term, region] of GAZETTEER) {
    if (!term.includes(' ')) continue
    if (new RegExp(`(^|[^a-z])${term.replace(/\./g, '\\.')}([^a-z]|$)`).test(cleaned)) {
      found.add(region)
    }
  }

  for (const [term, regions] of Object.entries(BLOC_TERMS)) {
    if (new RegExp(`(^|[^a-z])${term}([^a-z]|$)`).test(cleaned)) for (const r of regions) found.add(r)
  }

  for (const fragment of cleaned.split(/[,;/|]|\s-\s|\band\b|\bor\b/)) {
    const token = fragment.trim().replace(/^remote\s*/, '').trim()
    if (!token) continue
    const region = GAZETTEER.get(token)
    if (region) found.add(region)
  }

  // A country implies its bloc, so a reader filtering on LATAM still sees a
  // Brazil-only posting.
  if (found.has('BR')) found.add('LATAM')

  return REGION_VOCABULARY.filter((code) => found.has(code))
}

/**
 * Countries this vocabulary has no code for.
 *
 * `REGION_VOCABULARY` covers the Americas, the EU, the UK and APAC, and
 * deliberately invents nothing for Africa, the Middle East or the rest of
 * Europe. That left two very different situations looking identical to
 * `toRegions`, which returns an empty array for both:
 *
 *   "Massachusetts - Boston"  — a place we failed to parse. Unknown scope.
 *   "South Africa"            — a country we parsed perfectly. Known scope,
 *                               simply not one this vocabulary serves.
 *
 * The first is honestly `needs_check`. The second is not: the source stated
 * plainly where the employer hires, and calling that unknown put 19 postings
 * restricted to South Africa and Pakistan in front of a Brazilian reader as
 * jobs that might be open to them.
 *
 * Named rather than derived from a full ISO list, because the point is the
 * *judgement* that we have no code for these — the day LATAM gains a
 * neighbour or an AFRICA code exists, the name moves out of this list and into
 * the gazetteer above.
 */
const UNSERVED_COUNTRIES = words(`
  afghanistan albania algeria andorra angola armenia azerbaijan bahrain bangladesh belarus
  benin bhutan botswana brunei burundi cambodia cameroon chad congo egypt eritrea eswatini
  ethiopia gabon gambia georgia ghana guinea iceland iran iraq israel jordan kazakhstan kenya
  kuwait kyrgyzstan laos lebanon lesotho liberia libya liechtenstein macedonia madagascar
  malawi maldives mali mauritania mauritius moldova monaco mongolia montenegro morocco
  mozambique myanmar namibia nepal niger nigeria norway oman pakistan palestine qatar russia
  rwanda senegal serbia seychelles somalia sudan switzerland syria tajikistan tanzania togo
  tunisia turkey turkmenistan uganda ukraine uzbekistan yemen zambia zimbabwe
`)
const UNSERVED_PHRASES = [
  'south africa', 'saudi arabia', 'united arab emirates', 'sri lanka', 'ivory coast',
  'burkina faso', 'sierra leone', 'north macedonia', 'bosnia and herzegovina',
  'bosnia', 'san marino', 'cape verde', 'papua new guinea', 'south sudan',
  'democratic republic of the congo', 'middle east', 'africa',
]

/**
 * True when a place names a country we recognise and have no code for.
 *
 * Only consulted once `toRegions` has come back empty, so a name that is also
 * one of ours — "Georgia" is a US state before it is a country — has already
 * been claimed and never reaches here.
 */
export function namesUnservedCountry(place: string | null | undefined): boolean {
  if (!place) return false

  // Every fragment must be a country we know. "South Africa; Boston" is still
  // an unknown scope, because half of it is unparsed — and a half-understood
  // location is exactly the case that must stay `needs_check`.
  const fragments = place
    .toLowerCase()
    .replace(/\(|\)/g, ' ')
    .split(/[,;/|]|\s-\s|\band\b|\bor\b/)
    .map((fragment) => fragment.trim().replace(/^remote\s*/, '').trim())
    .filter(Boolean)

  return (
    fragments.length > 0 &&
    fragments.every(
      (fragment) => UNSERVED_COUNTRIES.includes(fragment) || UNSERVED_PHRASES.includes(fragment),
    )
  )
}
