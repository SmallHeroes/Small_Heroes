# Story Engine vNext Musical Read-Aloud Polish — Implementation Evidence

**Milestone:** `STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH`
**Base:** `9ebc648f6cbbfaf32e8b16a1148e8237f60eaa4f`
**Branch:** `codex/story-bank-next-generation-briefs-qa-integration`
**Worktree:** `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`
**Status:** locally implemented; independent Claude Code QA pending

## Product intent

Guy and the external story writer agreed that the passed Dini cake story can
gain read-aloud energy from rhythm, sound-play and occasional rhyme, but that a
full rhyming scheme would make Hebrew forced and make sound compete with the
story. This milestone turns that judgment into a reusable staging contract.

The implementation is not a rewrite of the Dini story. It creates a separate
polish commission bound to the exact accepted draft and its exact Editor PASS.
The existing candidate remains byte-immutable and authoritative as the safe
fallback.

## Implemented contract

1. `STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md` permits sentence/punctuation
   polish, varied cadence, selective end/internal rhyme, sound-play,
   onomatopoeia and short rhythmic repetition only when they naturally improve
   comedy, motion, tension or page-turn energy.
2. The charter prohibits a full-story rhyme requirement, rhyme quota, filler,
   inverted syntax, unnatural vocabulary, slogans, forced diminutives,
   sing-song repetition and any fact change made to obtain a rhyme.
3. Story identity, metadata, page count/order, event and causal order, child
   agency, companion actions, locations, objects, climax, payoff and ending are
   locked. Personalization chips must contain two complete Hebrew forms, and a
   rhyme cannot depend on one branch only.
4. `STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md` treats musicality as optional. The
   absence of rhyme is never a defect; forced or clarity-breaking rhyme is.
5. `materialize-musical-polish-pilot` admits only a canonical story bound to a
   valid `pass` review with zero issues and zero revision priorities. It rejects
   other verdicts before creating an output root, rejects malformed drafts and
   reused output roots, and writes one content-addressed prompt plus manifest.
6. The Writer receives the exact passed story as JSON data plus only the polish
   charter and compact identity. It does not receive the Architect charter,
   full Editor contract, rejected story options, image directions or downstream
   authority.
7. A returned polish remains staging-only. It requires canonical intake, a new
   Editor v3 review and Guy product acceptance before it may supersede the
   accepted candidate.

## Changed files

- `scripts/materialize-story-commission-briefs.cjs`
- `lib/__tests__/story-commission-materializer.spec.ts`
- `story-pipeline/03_story_briefs/STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md`
- `story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md`
- `docs/ai-workflow/STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH_DECISION_GATE.md`
- `docs/ai-workflow/STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH_IMPLEMENTATION_EVIDENCE.md`
- `CURRENT.md`

No approved story bank, companion bible/card, Story Source, Visual Contract,
Wizard, Reader, checkout, payment, generation, storage or deployment file
changed. `package.json` and `package-lock.json` retain base blob identities
`d9edfda18f09eccff51d227b54c936d221cd2080` and
`dfa99c4778cf411ba7be5908ed27d9f8cb3ec62f`.

## Materialized zero-cost pilot

Output root:

`outputs/story-engine-vnext-dini-cake-musical-polish-20260814-v1`

Prompt:

`dragon_dini_adventure_wobble_cake_convoy_brief_v1.musical-polish.01932bcf5087d27c004cd63d53c56196afdb3b5b9e5a28724239d5be2cfd3b16.md`

- bytes: `9498`
- raw SHA-256: `01932bcf5087d27c004cd63d53c56196afdb3b5b9e5a28724239d5be2cfd3b16`
- version: `small-heroes-musical-read-aloud-polish/v1`
- status: `staging_pilot_only`
- accepted draft SHA-256:
  `1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465`
- accepted Editor review SHA-256:
  `bed8053efb2bfa61faf15060a29fea4de7051242c0bfa7db585d07307c48e80b`
- polish charter SHA-256:
  `28335f940143fb096beb5cafc447a71df2b03a73b8754ad69de633ea5566ef28`

Manifest:

- version: `small-heroes-musical-read-aloud-polish-manifest/v1`
- bytes: `1418`
- raw SHA-256:
  `2f7969c09b6a9a43468aceb56a467ab77378c770610d820764150b1ea6b9ef2c`

The output is ignored staging evidence and grants no story-bank, runtime,
Wizard, render, QA deployment or Production authority.

## Validation

- `node --check scripts/materialize-story-commission-briefs.cjs`: **PASS**.
- `npx vitest run lib/__tests__/story-commission-materializer.spec.ts`:
  **PASS — 1 file / 12 tests**.
- `npx --no-install tsc --noEmit`: **PASS**.
- working `git diff --check`: **PASS**.

The direct regression covers:

- accepted `pass` plus zero-issue/zero-priority admission;
- exact passed-story embedding;
- content-addressed filename and two-file inventory;
- output-root reuse rejection;
- `revise` rejection before output-root creation;
- malformed personalization rejection;
- explicit no-poem/no-quota and story-lock instructions; and
- exclusion of Architect, full Editor and image-direction authority.

## Literal repository gate — HOLD outside the changed path

The one authorized literal `npm run check` was invoked once and was not
retried. TypeScript passed. The resource-intensive phase passed all **19 files**
in `94,776ms`, exit `0`, with valid diagnostics and no timeout, RPC/IPC,
reporter, launch, signal, teardown or diagnostic-protocol failure. The ordinary
phase ran **280 files**, exited `1` after `37,943ms`, and Vitest reported **72
failed tests across 31 files**. The new 12-test Story Commission Materializer
suite passed inside that ordinary run.

Failed ordinary file inventory preserved from Vitest's run result:

1. `lib/__tests__/anchor-hold-release-isolation.spec.ts`
2. `lib/__tests__/atomic-barrier-wiring.spec.ts`
3. `lib/__tests__/child-lexicon-ages-5-8.spec.ts`
4. `lib/__tests__/chunked-worker-reliability.spec.ts`
5. `lib/__tests__/exception-case.spec.ts`
6. `lib/__tests__/exception-processor.spec.ts`
7. `lib/__tests__/fake-payment-gating.spec.ts`
8. `lib/__tests__/materialize-freeze-wiring.spec.ts`
9. `lib/__tests__/momentum-gate-koko.spec.ts`
10. `lib/__tests__/package-delivery.spec.ts`
11. `lib/__tests__/page-entity-qa.spec.ts`
12. `lib/__tests__/payment-generation-trigger-isolation.spec.ts`
13. `lib/__tests__/payment-provider-none.spec.ts`
14. `lib/__tests__/qa-soft-deliver.spec.ts`
15. `lib/__tests__/quality-evidence-producer.spec.ts`
16. `lib/__tests__/quality-recovery.spec.ts`
17. `lib/__tests__/r1d-dini-bar-five-page-measurement-authority.spec.ts`
18. `lib/__tests__/readiness-manifest.spec.ts`
19. `lib/__tests__/regen-quarantine-refusal.spec.ts`
20. `lib/__tests__/set-appearance-ref-budget.spec.ts`
21. `lib/__tests__/story-read-back-validation.spec.ts`
22. `lib/__tests__/world-qa-gate.spec.ts`
23. `lib/cutover/__tests__/bridge-roundtrip.pg.spec.ts`
24. `lib/cutover/__tests__/quarantine-park.spec.ts`
25. `lib/cutover/__tests__/schema-equality.pg.spec.ts`
26. `lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts`
27. `lib/generation-chunked/__tests__/env-separation-guard.spec.ts`
28. `lib/generation-chunked/__tests__/start-recovery-redrive.spec.ts`
29. `lib/generation-pipeline/__tests__/order-authority-terminal-hold.spec.ts`
30. `lib/generation-pipeline/__tests__/runtime-world-authority.spec.ts`
31. `lib/generation-pipeline/__tests__/safety-release.spec.ts`

This inventory contains the established six absent ignored-output fixture
failures and stale Dini measurement assertion, plus a wider set of unrelated
fixture/environment repository failures. No changed or new Story Engine test
failed. The result remains a repository/release HOLD and is not represented as
a green full check.

## Boundaries and rollback

- credential access: none
- provider/model/network calls: `0`
- image/audio/Vision renders: `0`
- story-bank/import/approval: none
- Visual Contract/Blueprint/Wizard/Reader/downstream authority: none
- storage/database/payment/deployment/push: none
- external cost: `$0`

Rollback is one focused code/documentation revert plus deletion of the ignored
new output root. The previously accepted draft and Editor PASS remain intact,
so rollback does not lose the accepted story.

## Independent-QA status

Codex has not self-awarded technical PASS. Claude Code should review the exact
base-to-head range read-only, reproduce the focused validation, validate the
fail-closed routing and confirm that the full-check HOLD is faithfully separated
from the changed Story Engine path.
