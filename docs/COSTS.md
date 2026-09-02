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

Claude Opus 5, adaptive thinking, default effort. 703 postings crawled, 80
reaching the LLM (11.4%), 81 API calls.

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

## 3. Do we need Opus?

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

### Caveat: the control is underpowered

An agreement figure is meaningless without knowing how much the model disagrees
with *itself*. That control run reached 12 of 79 postings before the account
ran out of credit, at 92% self-agreement (a single `confirmed → rejected`
flip). It is directionally consistent with the numbers above — some
run-to-run variance is inherent — but 12 samples cannot carry weight. **Re-run
it before treating the 86% / 80% / 57% column as precise.**

---

## 4. Levers, largest first

1. **`output_config: { effort: 'low' }`** — targets the ~25-30% of the bill
   spent on thinking. Measured above: 1.5x cheaper, no observed quality cost.
   The recommended change.
2. **Model choice** — Sonnet 5 is $2/$10 per MTok against Opus 5's $5/$25;
   Haiku 4.5 is $1/$5. `CLASSIFIER_MODEL` overrides it. See §3 before pulling
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

## 5. Re-measuring

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

## 6. What these numbers do not cover

- **One corpus.** Five US-centric Greenhouse boards. A board with longer
  postings, or one where fewer scopes are stated, moves both the 11.4% LLM rate
  and the per-call cost.
- **Steady state, not backfill.** These are the numbers for classifying a
  posting once. Re-running after a prompt change is a second full pass.
- **No infrastructure.** Postgres, the worker host, and email delivery are all
  still local or unbuilt.
