# Decision Gate — Blueprint per-attempt diagnostic evidence honesty

Status: **approved for focused offline implementation under Guy's standing instruction to diagnose the failed bounded attempt, consult Claude Code, and continue with the smallest general correction; no further live or render is authorized by this gate**

Owner: Guy (Product Owner)

Technical owner: Codex

Date: 2026-08-31

Branch: `codex/r1d-order-package-authority-binding`

Worktree: `C:\GNart\Work\sh-order-package-authority`

## 1. Proposed change

Make failed Blueprint authoring evidence truthful and attributable per generation attempt.

- Preserve a complete sanitized structural diagnostic census for each validation-bearing attempt,
  keyed by the compiler-owned attempt ordinal.
- Commit each per-attempt census in the terminal receipt and persist the corresponding identities
  in the sanitized failure capture.
- Preserve the existing complete run-wide census for aggregate audit and legacy consumers.
- Record the true emitted diagnostic magnitude when the existing bounded summary reaches its
  `128` display/persistence ceiling, together with an explicit saturation/truncation signal.
- Cut the current receipt/capture evidence schemas honestly while retaining immutable receipt-v7
  and capture-v3 replay under frozen legacy validation.
- Add deterministic hostile regressions and a production-boundary offline harness covering
  decreasing-but-nonzero exhaustion and both repair ordinals.

No raw provider output, story prose, diagnostic messages, expected/actual values, credentials, or
PII-bearing material will be persisted.

## 2. Why now?

The one authorized no-retry live attempt reached the provider and completed three canonical calls
with zero retry or fallback, but terminated `draft_validation_repair_exhausted`. The compiler
improved the real validation population from **223 → 89 → 5**. Durable receipt v7 reports the first
population as `128` because the summary silently saturates, and capture v3 flat-maps all attempts
before grouping. Consequently the exact five final structural identities cannot be recovered.

This blocks evidence-based diagnosis. Changing prompt, validator, model, budget, or scheduler now
would be guesswork and would recreate the symptom-patching loop Guy explicitly asked to stop.

## 3. Scope

This is a **general system observability and evidence-integrity change**. It applies to every
Blueprint authoring failure, independent of story, child, companion, page, language, or style.

It is not a Chameleon/Lantern patch and does not change authoring quality or convergence policy.

## 4. Risk of hardcoding

No story content or known final diagnostic is encoded. Tests must deliberately use synthetic,
disjoint structural identities and colliding broad diagnostic families so the implementation
cannot pass by recognizing the current run's pages or codes.

## 5. Files likely affected

- `lib/visual-package/blueprintAuthoringSanitizedFailureCapture.ts`
- `lib/visual-package/authoringTerminalDiagnostics.ts`
- `lib/visual-package/productionAuthoringRunner.ts`
- `lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts`
- current program/request/receipt evidence validators and exact version-pairing helpers as required
- focused capture, runner, lifecycle, replay, and production-scale harness specs
- `CURRENT.md` and a focused implementation-evidence document

The final file list will follow the actual caller/version census; no unrelated prompt, story,
Wizard, package, render, payment, or site file may enter the milestone.

## 6. Expected behavior after change

For a failed run with validation populations `223 → 89 → 5`, an operator can prove from durable,
sanitized evidence:

1. there were exactly three ordered validation-bearing attempts;
2. each attempt's true emitted count and whether the legacy bounded summary saturated;
3. the complete sanitized identity multiset for each attempt;
4. the final five identities, without inference from story prose or aggregate repetition counts;
5. equality between receipt commitments, capture content, terminal linkage, reload, recovery, and
   replay.

Reordering, omitting, duplicating, swapping, or redigesting attempt partitions must fail closed.
Historical v7/v3 evidence remains byte-unchanged and replayable.

## 7. Validation plan

Minimum proof, all offline:

- a pure hostile census fixture with ordered `223 → 89 → 5` populations and deliberately disjoint
  identities that share broad category summaries;
- mint → persist → reload → recovery → replay proof that the final five code/path/digest identities
  are exactly attributable to attempt 3;
- tamper tests for attempt reorder, duplicate/missing ordinal, cross-attempt swap, count/saturation
  mismatch, census digest mismatch, receipt/capture mismatch, and legacy v7/v3 replay;
- leak-freedom tests over the `>=128` path proving no message, raw value, source phrase, child name,
  credential, or provider output enters the artifacts;
- extend the production-scale offline harness to exercise initial → repair 1 → repair 2, clearly
  labelled as transport/evidence proof rather than model-convergence proof;
- focused suites, `npx --no-install tsc --noEmit`, `git diff --check`, and the repository gate
  reported honestly.

No book or image render is part of validation.

## 8. Cost impact

External cost is **$0**. Provider/network/image/audio calls are forbidden. Existing model,
three-call/two-repair budget, exact-count policy, retry/fallback policy, and inclusive $5 ceiling
remain unchanged.

The consumed program-v1 live identity remains terminal. This implementation does not authorize a
replacement or another paid attempt, even if an honest evidence-version cutover changes a future
program digest.

## 9. Rollback plan

Before any future execution, rollback is a focused code revert. Existing v7/v3 artifacts remain
valid through frozen legacy validators. No existing output or ledger artifact will be rewritten,
renamed, migrated, or deleted.

## 10. Review assignment

No unresolved product/creative decision exists. Guy's desired outcome and stop rule are already
explicit: diagnose before spending again and continue only through a proven general correction.

Claude Code must try to falsify:

- exact per-attempt attribution and cardinality;
- honest saturation semantics above 128;
- receipt/capture/manifest/replay equality;
- legacy v7/v3 byte preservation;
- leak freedom and bounded artifact size;
- absence of dispatch, budget, model, prompt, validator, retry, Candidate, Wizard, or render drift;
- any way an observability-only cutover could silently grant paid retry authority.

Claude Cowork review is not required because no product, UX, story, or creative choice changes.
Guy has nothing visual to eyeball in this milestone.

## 11. Do not do

- Do not run provider, live authoring, replacement authoring, image, audio, or render.
- Do not increase calls, repairs, model, token ceilings, cost ceiling, retries, or fallback.
- Do not change prompt prose, schema/validator rules, story source, reconciliation, Blueprint
  creative policy, Wizard, package, or product behaviour.
- Do not infer or hardcode the five missing identities from the aggregate census or story prose.
- Do not persist raw model output, raw diagnostic messages, expected/actual values, PII, or secrets.
- Do not rewrite or redigest historical receipt-v7/capture-v3/terminal artifacts.

## Stop-check

1. General system fix: **yes**.
2. Cross-story/child/style risk: limited to evidence serialization/replay; controlled by exact
   versioning, legacy fixtures, and hostile tamper tests.
3. Production behaviour: failure evidence only; generation and validation decisions unchanged.
4. Spend: **$0**.
5. Smallest proof: deterministic synthetic per-attempt census + lifecycle replay, then the bounded
   production-scale offline harness.
6. Owner decision: already explicit for this zero-cost diagnosis/correction; no new product choice.
7. Claude falsification targets: listed above.
8. Claude Cowork: not needed.
9. Guy eyeball: none; artifacts are machine evidence only.
