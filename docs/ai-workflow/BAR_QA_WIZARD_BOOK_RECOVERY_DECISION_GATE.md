# Decision Gate — Bar QA Wizard book recovery

## 1. Proposed change

Recover the existing Bar QA Wizard order without creating a second order or
regenerating its eight accepted interior images. The work is split into three
independently gated milestones:

1. preserve the exact page-visual-QA input even when durable candidate
   persistence fails, and add an idempotent stored-byte recovery path;
2. correct the story's incomplete child-gender authoring and prepare fresh,
   digest-bound visual authority with one concrete gender-neutral wardrobe;
3. after exact product approval of the new authority, regenerate at most one
   LOW cover, run Vision once on the final nine image assets, and let the normal
   readiness/release path decide delivery.

## 2. Why now?

The first new-story Wizard book reached text, anchor, cover, eight pages,
mother narration, PDF and package generation, but correctly stopped at
`needs_human_qa`. The run exposed three real launch blockers:

- the source contains hard-coded feminine protagonist grammar that the narrow
  runtime backstop did not attribute to a boy;
- the approved wardrobe is vague and the cover visibly disagrees with the
  interior pages;
- the then-missing `PageUploadCandidate` table caused candidate persistence to
  fail before the exact QA context was attached, so the stored bytes cannot be
  released without a real re-QA.

The database migration is already applied and verified in QA. These remaining
issues must be corrected without weakening safety or buying another full book.

## 3. Scope

- General system change: preserve/reconstruct exact QA context and re-QA
  content-addressed stored bytes.
- Source/content correction: complete child-gender chips in the affected new
  story.
- Reviewed authority migration: concrete single-book wardrobe and refreshed
  source/package bindings.
- One existing QA order only for the recovery execution.

No production deployment or policy relaxation is in scope.

## 4. Risk of hardcoding

Production code may not name Bar, the order id, Chameleon, a page number, or a
story sentence. Order-specific values belong only in a one-shot operator input
artifact. Source prose and wardrobe data are allowed to be story-specific
because they are reviewed content authority, not runtime branching.

## 5. Files likely affected

- `backend/providers/image.ts`
- focused Style01 QA tests
- `lib/generation-pipeline/quality-recovery.ts` or a narrow recovery helper
- a new operator recovery CLI and tests
- `story-bank/qa-autonomous-20260815-v1/chameleon_koko_bedtime.md`
- visual-authority lifecycle artifacts produced by existing canonical tooling
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- A candidate-persistence failure still holds before Vision/regeneration, but
  its exact QA input survives for deterministic recovery.
- The recovered order uses masculine Hebrew for Bar in text and mother audio.
- One concrete gender-neutral wardrobe is authoritative across cover and pages.
- Vision evaluates the final stored bytes, evidence is SHA-bound, and only the
  ordinary readiness gate can move the order to ready.
- Future Wizard orders no longer lose recoverability on the same persistence
  failure.

## 7. Validation plan

1. Unit test the candidate-persistence failure path: no Vision, no regeneration,
   hold retained, exact `qaInput` returned.
2. Unit/integration test recovery idempotency, stale-SHA rejection and no manual
   safety flip.
3. Resolve the corrected story for boy and girl and review the exact outputs.
4. Run focused tests, `npx --no-install tsc --noEmit`, `git diff --check`, and
   relevant broader suites.
5. Claude Code read-only review on an immutable commit range.
6. Deploy QA only, perform at most one LOW cover render, then one Vision pass on
   the final cover plus eight retained pages.
7. Browser-verify Wizard status, reader, text, images and mother narration.

## 8. Cost impact

Expected remaining maximum: one LOW cover image, nine Vision evaluations, and
audio regeneration only for pages whose narration changed. No interior image
render and no second order.

## 9. Rollback plan

Code changes are isolated commits. The current order stays held until the final
readiness CAS succeeds. Old package/source/cover/audio artifacts remain
content-addressed and recoverable; no destructive overwrite is permitted.

## 10. Review assignment

Guy has approved the recovery work, one full-book proof and one LOW cover if
needed. Exact digest approval remains required for any newly authored
Blueprint/package content. Claude Code must falsify QA-context equivalence,
SHA/CAS/idempotency, source-gender completeness, wardrobe authority, and the
absence of release bypasses.

## 11. Do not do

- Do not create a second order.
- Do not regenerate the eight interior images.
- Do not manually set `safetyVerified` or fabricate a lenient QA context.
- Do not release before final text, audio and cover bytes are stable and all
  nine artifacts have real non-unknown evidence.
- Do not self-approve a new content digest as Guy.
- Do not deploy to production.
