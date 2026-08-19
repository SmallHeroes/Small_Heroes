# R1D QA Wizard Presentation Dispositions — Implementation Evidence

**Date:** 2026-08-20
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Base:** `6c9127d9f02d7eb79d8e41d6430adb2f25963bee`
**Status:** local green; independent Claude Code re-gate required

## Outcome

The reconciliation layer can now represent two human-review outcomes without
rewriting the immutable Candidate or compiler-authored Action Semantic
Coverage:

1. an exact same-page evidence rebind; or
2. an explicit, visible supersession of an unsupported Presentation
   Requirement.

The implementation contains no Chameleon-, page-, beat-, phrase-, cast-, or
prop-specific mapping. Story-specific decisions remain absent until a reviewer
authors a proposal and Guy approves its exact content.

## Versioned authority

- new `presentation-requirement-disposition/v1`;
- Source Prompt Reconciliation v2 → v3;
- reconciliation review bundle and Markdown v2 → v3;
- QA Wizard bridge manifest v3 → v4;
- Candidate, authoring request/receipt/readiness, Fresh, Supervisor, prompt,
  model, policy and render versions unchanged.

Current reconciliation-v3 requires the disposition block. Current bridge-v4
requires reconciliation/review v3. Frozen reconciliation/review v2 readers
serve exact manifest v3/v2/v1 replay only; all legacy writers and mutation
commands reject those versions.

## Fail-closed contract

Every disposition is bound to exactly one existing requirement by
`{pageNumber, beatId, sourceEvidenceId}`.

For `rebound`:

- pointer and exact string value are both required;
- the pointer must differ from the compiler-authored pointer;
- the pointer must resolve on the same page;
- the only accepted domains are `mustShow/{index}` and
  `propState/{index}/state`;
- a preserved story-prose beat must cite that exact pointer/value;
- justification must be null.

For `superseded`:

- rebound pointer/value must both be null;
- justification must be non-empty;
- the review UI labels the decision `SUPERSEDE / WILL NOT BE DEPICTED`.

Every disposition review must exactly match the root reconciliation review.
Pending proposals remain blocked. Final disposition approval is accepted only
for reviewer `Guy` with a valid timestamp. Original preserved evidence and a
disposition cannot coexist for the same requirement.

## Review visibility

Review JSON contains source phrase, presentation class, original evidence,
replacement evidence or supersession justification, and exact review state.
Markdown renders those decisions in a dedicated section before the source
requirements. An empty block is rendered as `None`; no decision is hidden in a
generic issue count.

## Legacy replay

The current bridge reader distinguishes:

- manifest v4: current candidate validation plus reconciliation/review v3;
- manifest v3: historical candidate validation plus reconciliation/review v2;
- manifests v2/v1: reconciliation/review v2 without current candidate
  validation.

Legacy candidate validation remains cross-bound to story, source snapshot,
Candidate, template, Action Semantic Coverage, Source Evidence Catalog,
request/receipt/readiness, Fresh, execution request/result, child-output
authority, historical branch and historical HEAD. It is read-only and cannot
be re-attested, approved, advanced, or persisted as current authority.

## Validation evidence

Focused command:

```powershell
npx vitest run `
  lib/visual-package/__tests__/source-prompt-reconciliation.spec.ts `
  lib/visual-package/__tests__/qa-wizard-candidate-bridge.spec.ts `
  lib/visual-package/__tests__/source-authority-lifecycle.spec.ts `
  lib/visual-package/__tests__/visual-package-lifecycle.spec.ts `
  lib/visual-package/__tests__/production-lifecycle-foundation.spec.ts `
  lib/visual-package/__tests__/pre-render-blueprint-authoring.spec.ts `
  --maxWorkers=1 --no-file-parallelism
```

Result: **6 files / 184 tests PASS**.

Additional checks:

- `npx --no-install tsc --noEmit` — PASS;
- `git diff --check` — PASS;
- one literal `npm run check` — TypeScript PASS; autonomous Story typecheck
  PASS; resource-intensive **20 files / 610 tests PASS**; ordinary **3,344
  PASS / 65 skipped / 5 failed** only because four unchanged specs reference
  ignored historical `outputs/` fixtures absent from this worktree.

The five baseline assertions are in:

- `child-lexicon-ages-5-8.spec.ts` (1);
- `momentum-gate-koko.spec.ts` (1);
- `page-entity-qa.spec.ts` (1);
- `story-read-back-validation.spec.ts` (2).

No missing fixture was copied, recreated, or fabricated. The full gate was not
retried.

## Independent QA targets

Claude Code should attempt to falsify:

- exact-key/version validation and disposition identity uniqueness;
- cross-page, arbitrary-field, stale-value and uncited rebinds;
- original-evidence plus disposition contradiction;
- machine/non-Guy final approval;
- omission visibility in JSON and Markdown;
- legacy v3/v2/v1 replay or mutation widening;
- cross-Candidate/source/catalog/authoring attestation replay;
- any drift in Candidate, authoring, prompt, policy, model, budget or render
  authority.

## Explicit exclusions and next gate

No credential, provider, network, Fresh Readiness, live authoring, Candidate
write, image generation, render, publication, deployment or production action
occurred.

After independent PASS and push, the existing Candidate may be re-attested at
the new clean consumer HEAD and a fresh pending reconciliation may be
materialized. Guy must read the generated Markdown and explicitly accept or
reject each unsupported story moment before any approval or Wizard advance.
