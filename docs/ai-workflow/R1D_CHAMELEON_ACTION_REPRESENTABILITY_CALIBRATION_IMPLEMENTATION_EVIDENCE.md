# R1D Chameleon Action Representability Calibration — Implementation Evidence

## Outcome

The `$0` audit separates the current eight-page Chameleon action surface into
three evidence classes without claiming access to the missing historical
provider draft.

Reviewed set: 15 exact Story Source beats.

- 3 are currently representable as actions:
  `child_climbs_bench`, `child_listens`, `child_places_backpack`.
- 2 are currently representable as presentation:
  `baker_sings` (`ambient_event`) and `bedtime_sleep_state`
  (`static_state`).
- 5 have exact current Action Catalog/domain gaps:
  - `station_walks`: `walks` rejects a `prop` subject;
  - `child_turns_station`: `turns` forbids an object;
  - `station_runs`: `runs` is absent;
  - `station_waves`: `waves` rejects a `prop` subject;
  - `bus_opens_door`: `opens` rejects a `prop` subject.
- 5 remain explicit review decisions rather than inferred fixes:
  `kim_blinks`, `bench_folds`, `child_nods`, `cat_sits_on_bench`, and
  `station_settles`.

The audit output contains only page, stable review beat key, current Source
Evidence ID, intended representation, optional candidate predicate, status and
closed gap codes. It contains no source phrase, contract value, visual
direction prose, prompt, response or raw draft and carries `authorizes: []`.

## Independent blocker discovered

The exact source/visual-direction compiler experiment exposed a separate
deterministic fact defect before any Action Catalog decision:

- Story Source page 7 says `{{childName}} וקִים עלו אחריה`.
- Canonical visual directions mark both child and companion `partial` and say
  they watch from the bus.
- `extractDeterministicFacts` reports companion pages
  `[1,2,3,4,5,6,8]`, omitting page 7 because standalone-token matching does
  not recognize the Hebrew conjunction-prefixed proper name `וקִים`.
- A source-faithful page-7 draft therefore fails with the single persistent
  `cast_authority_mismatch`. Replaying the same draft through the offline
  production compiler selects `full_draft` and stagnates; no Candidate is
  minted and `providerCalls` remains `0`.

This is a general Hebrew identity-presence issue, not an Action Catalog issue.
It must be fixed in a separate companion-authority milestone before a paid
Chameleon attempt. The current audit does not authorize that correction.

## Claim boundary

This evidence proves current catalog/domain reachability for the 15 explicitly
reviewed intents and proves the page-7 deterministic companion mismatch. It
does not prove which intents correspond to the historical 12 capability-gap
records, does not approve the five unresolved classifications, and does not
authorize a catalog edit, Candidate, reconciliation, Wizard, render, or live
attempt.

## Validation

- Focused production/catalog/presence/harness set:
  `npx vitest run lib/__tests__/chameleon-action-representability.spec.ts lib/__tests__/action-semantic-catalog.spec.ts lib/__tests__/visual-contract-companion-presence.spec.ts lib/__tests__/offline-repair-harness.spec.ts --maxWorkers=1 --no-file-parallelism`
  — **4 files / 39 tests PASS**.
- `npx tsc --noEmit` — **PASS**.
- `git diff --check` — **PASS**.
- One literal `npm run check` ran once and was not retried. TypeScript passed.
  The resource-intensive phase passed **20 files / 609 tests** with valid
  diagnostics. The 284-file ordinary phase exited 1 only on five established
  assertions whose ignored historical `outputs/` fixtures are absent:
  one in `child-lexicon-ages-5-8.spec.ts`, one in
  `momentum-gate-koko.spec.ts`, one in `page-entity-qa.spec.ts`, and two in
  `story-read-back-validation.spec.ts`. None of those files is changed by this
  milestone; no missing output was copied or fabricated.
- The literal gate preceded the final fail-closed binding of reviewed IDs to
  the exact supplied Source Evidence Catalog. After that hardening, the same
  focused **4 files / 39 tests**, TypeScript, and diff-check passed again. The
  literal full gate was not rerun.

## Independent QA

Claude Code independently reviewed exact range `5963301a..1dc1e189` read-only
and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It verified all five
catalog claims against Action Catalog v3, the generic/no-inference contract,
catalog-backed evidence identity, privacy and non-authorization, and reproduced
the page-7 `וקִים` omission. Its advisory scan found the same conjunction miss
on only 2 of 144 QA-bank pages, both in Chameleon; it correctly classified the
defect as narrow but decisive rather than the systemic authoring cause.

This PASS authorized no paid or downstream boundary. Companion presence is
handled by the separate conjunction-prefix milestone and Decision Gate.
