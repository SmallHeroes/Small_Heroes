# R1D Wizard no-photo canonical anchor — implementation evidence

Date: 2026-08-21

## Observed failure

One fake-paid QA order deliberately continued without a child image. Checkout,
story selection, text/DNA and companion authority completed. Cover generation
never started because `runDnaStage` had no no-photo child-anchor branch and the
unchanged cover gate rejected the missing approved canonical anchor.

## Correction

- `stage0-method-b.ts` now exposes a description-template reference and prompt
  authority plus a generator that uses `anchor_template`, the approved gender
  template and character-free Style 01 refs.
- The prompt is bound to locked child DNA, age/gender and story wardrobe and
  excludes the photo identity rule and likeness/resemblance claims.
- Candidate inspection uses a local face signal, an actual generated-anchor
  description, semantic QA and Style 01 visual QA. Missing inspection evidence
  is not treated as a pass.
- `runDnaStage` enters this lane only when no canonical child anchor and no
  child image exist on a Style 01 order. It persists a passed
  `generated_story_anchor` with no resemblance score or threshold.
- Candidate rows carry an explicit `identityMode` and `stylePass`. Recovery
  admits only fully-passed generic evidence and cannot relabel it as
  `uploaded_photo`.
- The existing photo lane, resemblance thresholds, Style 02 lane, cover/page
  gate, model, quality, retries and fallback policy are unchanged.

## Offline proof

Focused Vitest:

- 8 files
- 79 tests passed
- 0 failed

The proof includes exact reference mode/order, prompt privacy, route selection,
semantic/style conjunction, unavailable-evidence rejection, mocked generation
request and upload boundary, no likeness fields, generic recovery provenance,
failed generic recovery rejection, legacy photo recovery, Style 02 guards,
runtime artifact and render-qualification adjacency.

`npx --no-install tsc --noEmit` passes. `git diff --check` passes.

## Runtime and cost boundaries

No provider, image, Vision, database, storage, deployment, fake payment or
Production action was performed. The failed Order was not retried or mutated.
The later QA deployment remains branch-scoped and LOW quality with the existing
one-attempt Stage-0 override. Exactly one new fake-paid order is permitted only
after accepted UI restoration, local green and independent Claude Code PASS.
