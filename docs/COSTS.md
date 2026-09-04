# What this product costs to run

Every number here was measured against the real corpus — 703 postings from five
Greenhouse boards — not estimated from a model of the pipeline. Where a number
is an estimate or is underpowered, it says so.

Costs are computed from published per-token rates, not read from Anthropic's
billing. The Console's usage page is authoritative; this file exists to explain
*where* the money goes and *which lever moves it*.

---

## 1. What costs money today

Only one thing: the LLM eligibility pass (PLAN.md §4, stage 3).

| Stage | Cost |
|---|---|
| `fetch` — Greenhouse public boards | free |
| `normalize` — raw payload to `jobs` | free |
| `classify` — deterministic rules | free |
| `classify --llm` — the ambiguous middle | **the entire bill** |

Not yet built, and therefore not yet costing anything: Cohere embeddings
(D13), the email digest (D7), and any hosting — Postgres runs in local Docker.

**The two-stage design is the cost control.** The free rules settle 89% of the
corpus. If every posting went to the LLM the same work would cost $28.40 per
thousand instead of $3.27.

---

## 2. Measured unit economics

Claude Opus 5 at **default** effort -- the configuration §4 replaced. Kept
because every share and ratio below still holds; only the absolute per-call
figure moved, to **$0.0163** at `effort: low`. 703 postings crawled, 80 reaching
the LLM (11.4%), 81 API calls.

| | |
|---|---|
| Total run cost | **$2.297** |
| Per posting crawled | $0.0033 |
| **Per 1,000 crawled** | **$3.27** |
| Per LLM call | $0.0284 |

### Where the money goes

| | tokens | cost | share |
|---|---:|---:|---:|
| uncached input | 228,248 | $1.141 | 50% |
| output | 41,330 | $1.033 | 45% |
| cache writes | ~11,352 † | $0.071 | 3% |
| cache reads | 103,616 | $0.052 | 2% |

† Derived, not measured: the run that produced these figures did not yet record
`cache_creation_input_tokens`. Inferred from 8 cold starts (four concurrent
workers, two runs) at the 1,419-token prefix. Every run since records it
directly.

Two things follow from that split.

**Output is nearly half the bill, and most of it is thinking** — 53–63% of
output tokens across two samples. Reasoning alone is therefore roughly a
quarter to a third of everything spent.

**Caching is working but is capped by the shape of the job.** 71 of 75 requests
in the main run hit the cache. The cacheable prefix is 1,419 tokens (the
response schema plus the 712-token system prompt) out of a typical 3,750–4,900
token request. The posting body is different every time and cannot be cached,
so caching can never touch more than about a third of input.

---

## 3. How often it runs, and what that costs per month

**Classification happens once per posting, at crawl time.** A user searching,
filtering, opening a job or receiving the digest costs nothing -- all of that
reads rows already in Postgres. That is decision D1 working as intended: crawl
globally, classify once, query per user.

Credits are spent on exactly two events:

| Event | Cost |
|---|---|
| A new posting appears and the rules cannot settle it | one call |
| The **prompt, model or effort** changes and the pool is replayed | the whole `needs_check` pool |

Changing the *rules* is free -- that is the pass that costs nothing. Only the
paid pass's own configuration re-spends, which is what `LLM_CLASSIFIER_VERSION`
exists to track.

### Measured inputs

| | |
|---|---|
| Posting inflow | 436 of 1,797 postings were posted in the last 30 days -- 24% monthly turnover, ~44 new postings per board per month |
| Reaching the paid pass | 6.2% overall -- **Lever 1.8%, Greenhouse 13.1%** |
| Cost per call | $0.016 at `effort: low` |

Lever declares `workplaceType`, so its postings are settled by the free rules.
Greenhouse leaves remote status in prose. **Source mix moves this line more
than any code change.**

### Projection

| Boards | New postings/mo | Paid calls/mo | Cost/mo |
|---:|---:|---:|---:|
| 10 (today) | 436 | 27 | **$0.44** |
| 100 | 4,360 | 270 | **$4.40** |
| 500 | 21,800 | 1,352 | **$22** |
| 1,000 | 43,600 | 2,703 | **$44** |

At 1,000 boards the source mix alone spans $13/mo (all Lever-like) to $95/mo
(all Greenhouse-like).

**The number that matters for planning is not the monthly one.** A first crawl
of 1,000 boards is ~180,000 postings arriving at once: roughly **$180 as a
one-off backfill**, against $44/month steady state.

## 4. Do we need Opus?

Measured, not assumed: the same 79 postings, the same prompt, four
configurations. Two of the columns do not depend on treating Opus as correct —
*fabricated evidence* is the grounding check firing because the model quoted a
sentence that is not in the posting, and *hard failures* are unparseable or
errored responses.

| Configuration | Cost | vs baseline | Fabricated evidence | Hard failures | Defect rate |
|---|---:|---:|---:|---:|---:|
| `claude-opus-5` (baseline) | $2.297 | — | 0/80 | 0/80 | **0%** |
| `claude-opus-5`, `effort: low` | $1.536 | 1.5x cheaper | 1/79 | 0/79 | **1.3%** |
| `claude-sonnet-5` | $0.703 | 3.3x cheaper | 5/79 | 4/79 | **11.4%** |
| `claude-haiku-4-5` | $0.292 | 7.9x cheaper | 4/79 | 3/79 | **8.9%** |

Direction of disagreement matters as much as its rate. A verdict that moves
toward `confirmed` claims eligibility the baseline did not find — that is the
one the product cannot afford to get wrong.

| Configuration | Agreement | Disagreements toward `confirmed` |
|---|---:|---|
| `effort: low` | 86% | **0** — all 11 were conservative |
| `sonnet-5` | 80% | **5** — 4 `rejected`, 1 `needs_check` |
| `haiku-4.5` | 57% | **0** — all 33 were conservative |

**Conclusion: not default-effort Opus, but yes Opus.** `effort: low` is a third
cheaper with no failures and no verdicts moving toward `confirmed`. Sonnet's
3.3x saving comes with a defect on roughly one posting in nine, on exactly the
axis the classifier exists to protect. Haiku is safe by cowardice — it never
over-claims, but it disagrees with the baseline 43% of the time and would need
its own prompt before it meant anything.

Note that the grounding check *caught* every fabrication, so a cheaper model's
hallucinated evidence becomes `needs_check` rather than a false badge. The
unguarded risk with Sonnet is the four postings where the quote was real and
the reading was wrong.

### The control, and what it changed

An agreement figure means nothing without knowing how much the model disagrees
with *itself*. Re-running the identical configuration over the same 79 postings:

| | Cost | Agreement with baseline | Moved **toward** `confirmed` | Fabricated | Failed |
|---|---:|---:|---:|---:|---:|
| default effort, re-run | $2.197 | **90%** | 3 | 0 | 1 |
| `effort: low` | $1.554 | 87% | **0** | 0 | **0** |

**90% is the noise floor** — that is the model against itself. `effort: low`'s
87% sits inside it, and head to head on two fresh runs the two configurations
agree 91%, the same figure. The eleven conservative flips that made this look
like a quality difference were run-to-run variance.

Direction settled it. The default run moved three verdicts toward `confirmed`;
`low` moved none. **`effort: low` is now the default**, at
`CLASSIFIER_EFFORT`, and stamped `llm-2`.

A later run at `high` over a different 33 postings produced five hard failures
against `low`'s zero, which points the same way.

### Reading a downgrade correctly

`downgraded` in a run's output is not a hallucination count. A real run at
`effort: low` reported four, and all four were
`confirmed without a region in the shared vocabulary` — the model quoted real
text (`"Remote, Turkey"`, `"Remote, KSA; Remote, UAE"`) and the *vocabulary* has
no code for those places. The grounding check for evidence absent from the
posting fired zero times at either effort.

The two cases are distinguished by `downgradeReason`, which is why it is
recorded rather than just counted.

---

## 5. Levers, largest first

1. ~~**`output_config: { effort: 'low' }`**~~ — **done.** Thinking fell from 56%
   of output to 21-34%, and a real 33-posting run cost $0.0163 a call against
   $0.0284 at the default. Override with `CLASSIFIER_EFFORT` if a future
   measurement disagrees.
2. **Model choice** — Sonnet 5 is $2/$10 per MTok against Opus 5's $5/$25;
   Haiku 4.5 is $1/$5. `CLASSIFIER_MODEL` overrides it. See §4 before pulling
   this one.
3. **Batch API** — a flat 50% discount for work with no latency requirement,
   which describes this exactly. Costs a polling loop.
4. **Trim the posting** — input is 50% of the bill. The description cap is
   12,000 characters and real prompts ran 7.6k–11k. Eligibility statements
   cluster in the title, the location field, and the top of the description, so
   a tighter cap is likely free.

Caching is already in place and near its ceiling; there is nothing more to win
there without changing what is sent.

---

## 6. Re-measuring

```bash
pnpm --filter @jobsearch/worker worker classify --llm --limit=5
```

Every run prints its own token counts and a cost estimate:

```
llm classify complete considered=75 confirmed=43 needsCheck=3 rejected=29
  downgraded=0 failed=0 inputTokens=211640 cachedInputTokens=100749
  outputTokens=38654 usd=2.0749
```

That is a real line from the 75-posting run. Later runs also carry
`cacheWriteTokens` and `thinkingTokens`.

`--limit=N` exists so the first run against a changed prompt costs cents rather
than dollars. Re-classifying the whole `needs_check` backlog after a prompt
change costs one full pass — about $2.30 at present volume, or $1.55 at low
effort.

**The three input counters are disjoint.** Total input is `input_tokens` +
`cache_creation_input_tokens` + `cache_read_input_tokens`. An earlier version of
`estimateCostUsd` omitted the write term and under-reported every run by 3%,
because writes bill at 1.25x the base rate rather than free.

---

## 7. What these numbers do not cover

- **One corpus.** Five US-centric Greenhouse boards. A board with longer
  postings, or one where fewer scopes are stated, moves both the 11.4% LLM rate
  and the per-call cost.
- **Steady state, not backfill.** These are the numbers for classifying a
  posting once. Re-running after a prompt change is a second full pass.
- **No infrastructure.** Postgres, the worker host, and email delivery are all
  still local or unbuilt.
