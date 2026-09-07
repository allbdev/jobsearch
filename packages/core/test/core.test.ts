import { describe, expect, it } from 'vitest'
import { htmlToText } from '../src/html'
import { canonicalizeUrl, dedupUrl } from '../src/url'
import { jobContentHash, normalizeCompanyName, normalizeTitle } from '../src/identity'

describe('htmlToText', () => {
  it('decodes double-encoded HTML, which is what Greenhouse actually sends', () => {
    // Verbatim shape from the corpus: every posting contains &amp;nbsp;
    const raw = '&lt;p&gt;Remote&amp;nbsp;role at Acme&amp;amp;Co&lt;/p&gt;'
    expect(htmlToText(raw)).toBe('Remote role at Acme&Co')
  })

  it('is safe on single-encoded HTML', () => {
    expect(htmlToText('<p>Remote &amp; hybrid</p>')).toBe('Remote & hybrid')
  })

  it('keeps block structure so sentences do not run together', () => {
    expect(htmlToText('<p>First</p><p>Second</p>')).toBe('First\nSecond')
  })

  it('marks list items, which carry the eligibility bullets', () => {
    expect(htmlToText('<ul><li>Worldwide</li><li>Contractor</li></ul>')).toBe(
      '• Worldwide\n• Contractor',
    )
  })

  it('drops script and style content rather than reading it as prose', () => {
    expect(htmlToText('<p>Hi</p><script>var x = 1</script><style>.a{}</style>')).toBe('Hi')
  })

  it('decodes numeric entities in both decimal and hex', () => {
    expect(htmlToText('&#8212; and &#x2014;')).toBe('— and —')
  })

  it('returns empty for empty input', () => {
    expect(htmlToText('')).toBe('')
  })
})

describe('canonicalizeUrl', () => {
  it('strips tracking parameters that defeat dedup', () => {
    expect(canonicalizeUrl('https://job-boards.greenhouse.io/acme/jobs/1?gh_src=abc&utm_source=x')).toBe(
      'https://job-boards.greenhouse.io/acme/jobs/1',
    )
  })

  it('keeps parameters that identify the posting', () => {
    expect(canonicalizeUrl('https://example.com/jobs?id=42&utm_medium=email')).toBe(
      'https://example.com/jobs?id=42',
    )
  })

  it('orders parameters, so argument order does not change the hash', () => {
    expect(canonicalizeUrl('https://example.com/j?b=2&a=1')).toBe(
      canonicalizeUrl('https://example.com/j?a=1&b=2'),
    )
  })

  it('normalises host case, www and scheme, but never the path', () => {
    expect(canonicalizeUrl('http://WWW.Example.com/Jobs/Senior-Engineer/')).toBe(
      'https://example.com/Jobs/Senior-Engineer',
    )
  })

  it('returns an unparseable URL rather than throwing', () => {
    // A posting with a malformed URL is still a posting; link checking catches it.
    expect(canonicalizeUrl('  not a url  ')).toBe('not a url')
  })
})

describe('company and title normalisation', () => {
  it('treats legal suffix variants as one company', () => {
    const forms = ['Layered', 'Layered, Inc.', 'layered inc', 'LAYERED LLC']
    expect(new Set(forms.map(normalizeCompanyName)).size).toBe(1)
  })

  it('ignores accents', () => {
    expect(normalizeCompanyName('Nubânk')).toBe(normalizeCompanyName('Nubank'))
  })

  it('keeps seniority in titles, because it is a different job', () => {
    expect(normalizeTitle('Senior Frontend Engineer')).not.toBe(normalizeTitle('Frontend Engineer'))
  })
})

describe('jobContentHash', () => {
  const job = {
    companyName: 'Layered, Inc.',
    title: 'Senior Frontend Engineer',
    applyUrl: 'https://job-boards.greenhouse.io/layered/jobs/1',
  }

  it('collapses the same posting reached through different tracking links', () => {
    expect(
      jobContentHash({ ...job, applyUrl: `${job.applyUrl}?gh_src=rss&utm_source=wwr` }),
    ).toBe(jobContentHash(job))
  })

  it('collapses company name variants', () => {
    expect(jobContentHash({ ...job, companyName: 'Layered' })).toBe(jobContentHash(job))
  })

  it('keeps two different roles apart even at the same company', () => {
    expect(jobContentHash({ ...job, title: 'Backend Engineer' })).not.toBe(jobContentHash(job))
  })

  it('keeps two same-titled roles apart when the URLs differ', () => {
    // Big companies open "Software Engineer" several times for different teams;
    // collapsing those would hide a real opening.
    expect(
      jobContentHash({ ...job, applyUrl: 'https://job-boards.greenhouse.io/layered/jobs/2' }),
    ).not.toBe(jobContentHash(job))
  })
})

describe('apply links versus dedup keys', () => {
  // 253 jobs across three boards shared one useless apply link because
  // `gh_jid` — Greenhouse's job id — was treated as a tracking parameter.
  it('keeps the posting id in the link a user clicks', () => {
    expect(canonicalizeUrl('https://jobs.elastic.co/jobs?gh_jid=8066491')).toBe(
      'https://jobs.elastic.co/jobs?gh_jid=8066491',
    )
  })

  it('still strips what only says where the click came from', () => {
    expect(canonicalizeUrl('https://x.co/j/1?gh_src=abc&utm_source=li&fbclid=z')).toBe(
      'https://x.co/j/1',
    )
  })

  // …and the dedup key drops it, so one role listed once per country stays one
  // job. Both halves are needed; either alone breaks something.
  it('drops the posting id from the dedup key', () => {
    expect(dedupUrl('https://jobs.elastic.co/jobs?gh_jid=8066491')).toBe(
      'https://jobs.elastic.co/jobs',
    )
  })

  it('gives two country listings of one role the same content hash', () => {
    const job = { companyName: 'Elastic', title: 'Senior Software Engineer' }
    expect(jobContentHash({ ...job, applyUrl: 'https://jobs.elastic.co/jobs?gh_jid=1' })).toBe(
      jobContentHash({ ...job, applyUrl: 'https://jobs.elastic.co/jobs?gh_jid=2' }),
    )
  })

  it('leaves the content hash of a link without a posting id unchanged', () => {
    expect(
      jobContentHash({
        companyName: 'Acme',
        title: 'Engineer',
        applyUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      }),
    ).toBe(
      jobContentHash({
        companyName: 'Acme',
        title: 'Engineer',
        applyUrl: 'https://boards.greenhouse.io/acme/jobs/123',
      }),
    )
  })
})

describe('repeated query parameters', () => {
  it('collapses an identical repeat, which Greenhouse actually sends', () => {
    expect(canonicalizeUrl('https://jobs.elastic.co/jobs?gh_jid=781&gh_jid=781')).toBe(
      'https://jobs.elastic.co/jobs?gh_jid=781',
    )
  })

  it('keeps distinct values for one key — that is multi-valued, not duplicated', () => {
    expect(canonicalizeUrl('https://x.co/j?tag=a&tag=b')).toBe('https://x.co/j?tag=a&tag=b')
  })
})
