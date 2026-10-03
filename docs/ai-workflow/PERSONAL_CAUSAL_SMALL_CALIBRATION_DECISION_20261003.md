# Decision Gate: smallest live text calibration, pending Guy approval

## 1. Proposed change

Implement and independently validate a bounded local calibration driver, then
run at most one synthetic Astra response and one fictional eight-spread book.
No implementation of that driver or paid dispatch is authorized by this
document. Continue in the existing engine task/branch; use a new immutable
source pin and new one-use claims, never reuse consumed historical families.
The existing key choice stands; never print, replace or copy a credential.

## 2. Why now

The offline host correction has independent PASS only through `57fe01cf`.
PL-1 actual split-call output/thinking budgets and PL-2 Astra's actual returned
model/tier remain unmeasured. Neither structural tests nor a provider price
page closes them. A six-book family before calibration risks six repetitions
of the same pre-live failure.

## 3. Scope and 4. Hardcoding risk

Local diagnostic, not public runtime or catalog promotion. First probe uses
synthetic ASCII input with the real strict causal critic schema, echoed packet
digest, short summary and findings array. Request exact `gpt-6-astra`, default
tier, medium reasoning, store false; no tools/history/retry/fallback. At most
8192 full outgoing bytes and 2048 output tokens, including reasoning. This
separate probe is not an override of the host's 12000-token book reviews.
It can still finish incomplete; record failure and stop, without increasing
the cap or changing effort/model/allowed aliases during the same approval.

Only if the probe completes, schema parses, usage is valid and reported
model/tier match the existing exact guard, admit one fictional 8-spread cohort
entry (case1 of the existing synthetic cohort), not a real child's recording.
The general driver must accept a validated selected case, not hardcode a story
solution. The one-case run cannot prove six-companion/three-length readiness,
diversity or consistent literary quality.

## 5. Likely files and dependencies

A new diagnostic driver/probe spec under scripts/tests, and its Decision Gate,
CURRENT/ROADMAP/handoff receipts. Reuse existing host/adapter/schema/journal
instead of a second author/editor pipeline. The driver must fingerprint the
actual CLI executable and validate supported safe/default-mode configuration
**before** reserving the book family (P3-5); the existing late check stays.
Require fresh clean exact source, fresh rates, new nonexistent roots/family,
approved matching amounts and exact isolated transports. No `.env` edit,
database write, public route, registry migration or old approval rewriting.

## 6. Desired execution and stop conditions

After driver checks and Claude independent re-gate, recheck official prices
within 24 hours. Validate all preconditions before a one-shot claim or key use.
Do not reserve the book family on probe failure. Preserve raw request/response,
response ID/status/model/tier/usage (including reasoning/cached details where
reported), actual bytes, configured caps and failure disposition. Returned
metadata is provider-reported, not independent model attestation. No alias
normalization based on guesswork and no model substitution.

For the book: reserve all seven possible slots upfront; Opus plans, and at most
one replan is allowed only for the existing valid `both_rejected` disposition.
Read the continuous synopsis/backward dependencies and persist digest-bound
write/HOLD decision before prose. Opus writes from scratch, a fresh Opus
process diagnoses/edits; Astra reads original and final independently without
the editor's verdict, then compares them. Normal path is six book dispatches,
maximum seven; with the probe, normal seven and maximum eight logical attempts.
CLI internal provider-call count remains unverified. A fail/HOLD/unknown
termination seals the run; no restart, unused-slot refund or second family.

Measure visible output separately from thinking when available, record unknown
splits explicitly, and report original vs edited story quality separately.
Preserve stories/diagnoses/criticism without rewriting them to match approval.
Diagnostic completion does not confer product approval or runtime eligibility.

## 7. Validation plan and stop-check

Before live work: offline tests pin fresh single-use claims, no book reservation
after probe failure, no key access before admission, executable preflight,
full-wire/cap/rate/approval binding, exact model/tier, failure preservation and
late replies. Run standalone tsc, focused tests and review the full gate state.
Claude Code first pass is read-only on an immutable new range. These driver
checks are future work, not completed claims in this test-only successor.
STOP_BEFORE_MAJOR_ACTIONS has been read: paid family, provider routing and
budget are gated, owner decision is pending; no public rollout or images.

## 8. Price evidence and proposed allowance

Checked official sources on 2026-10-03:
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing),
[OpenAI pricing](https://developers.openai.com/api/docs/pricing), and
[Astra model page](https://developers.openai.com/api/docs/models/gpt-6-astra).
Standard Opus 5.5: input $4/M, output $20/M, cache writes $5/M (5m) or
$8/M (1h). Standard Astra short input: input $10/M, output $50/M, cache write
$12.50/M. These are prices, not account access or actual response proof.

Proposed policy reserves conservatively at Opus input 8/output 20 and Astra
input 12.5/output 50 microUSD/token (cache-write maxima). Do not use synthetic
test rates. Require standard/global/no-fast behavior; if it cannot be verified
or a price differs, stop and reprice instead of silently using this estimate.
Premium routing and CLI hidden context are not proved away by this table.

The host requires an explicit maxWireBytes policy, not a 104000 default. This
proposal chooses its allowed 104000-byte envelope for each future book wire;
actual full expanded wires are rechecked at dispatch. For an 8-spread book:

| Reserved slot | Output cap | Reservation, microUSD |
| --- | ---: | ---: |
| Plan | 18000 | 1311200 |
| Possible replan | 18000 | 1311200 |
| Author | 8000 | 1091200 |
| Editor | 20000 | 1355200 |
| Original Astra reading | 12000 | 2090001 |
| Final Astra reading | 12000 | 2090001 |
| Astra comparison | 12000 | 2090001 |
| Seven-slot total | | **11338803** |

Formula is the current `wireReservation`:
`ceil((bytes * inputRate + outputCap * outputRate) * 1.1)`.
The one-microUSD ceil increments reproduce actual JavaScript evaluation.
The normal six-slot cap sum is $10.027603, **not measured spend**. Required
seven-slot reservation is $11.338803; proposed book allowance rounds to $11.34.
The separate probe envelope is $0.225281, rounded to $0.25 allowance. Combined
rounded allowances are **$11.59**. Ask Guy for **up to $12**, acknowledging the
CLI estimate limitations, with no extra call/replan/retry enabled by the margin.
The key/model policy is unchanged; ordinary runtime price registry is untouched.

This is a logical reservation ceiling and reported-usage estimate, **not a
guaranteed provider invoice cap**: CLI hidden prompts/internal turns, thinking
and unknown termination can limit accounting. Requested CLI max-budget and
configured output limits are defensive contracts whose live behavior must be
measured. Preserve unknown costs; do not claim refunds or zero billing on error.

## 9. Rollback and 10. Review assignment

Driver implementation is a separate focused local commit after approval, then
Claude Code re-gates before spend. Rollback by focused revert; consumed claims
and outputs remain immutable. Guy decides paid allowance and accepts story
quality. Claude verifies safeguards and assumptions, not self-produced PASS.
This proposal neither pushes the 48 unpublished commits nor approves them.

## 11. Do not do

No six-book run, real child/private audio, narration, image generation, paid
repair loop, public wizard/site cutover, QA deployment, catalog acceptance,
credential disclosure, silent model/effort/tier/cap changes, push or deletion.
After successful calibration, propose the separate broader literary trial;
do not infer it from this one-case allowance.
