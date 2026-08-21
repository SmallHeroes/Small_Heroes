# R1D Blueprint Text-Safe Layout Contract — Implementation Evidence

**Date:** 2026-08-21
**Branch/worktree:** `codex/qa-wizard-presentation-dispositions` / `C:\GNart\Work\sh-wt-r1d-output-budget`
**Approved base:** `bb37be96925b2c4a63a4a9d1e59dea3e91af9a84`
**Decision Gate:** `docs/ai-workflow/R1D_BLUEPRINT_TEXT_SAFE_LAYOUT_CONTRACT_DECISION_GATE.md`
**External cost:** `$0`
**Status:** implementation green locally; independent Claude Code QA pending

## Outcome

The system now has one portrait text-safe policy from Blueprint authoring
through validation, Visual Package assembly, and the runtime provider seam.
Authoring owns the geometry; the provider cannot author it. Package and runtime
validate the same supported population and never remap it.

The compiler stamps:

- cover: `{x:0,y:0,width:1000,height:250}`;
- body page: `{x:0,y:750,width:1000,height:250}`.

The shared supported package/runtime range remains 250–350 units. This preserves
the byte-identical `portrait-layout-compatibility/v1` policy while removing the
runtime-only exact-250 restriction. Authoring still chooses the canonical
250-unit default.

## Root cause closed

Before this change:

1. the provider-authored schema included unrestricted bounded
   `textSafeRegion`;
2. the initial prompt requested only generic text-safe layout and the repair
   prompt repeated no exact band rule;
3. Blueprint validation checked geometry bounds and collisions, but not the
   package policy;
4. Visual Package required cover-top/body-bottom bands;
5. runtime independently hard-coded exact 250-unit bands;
6. package tests rewrote Blueprint frame regions before assembly, hiding the
   mismatch.

The existing approved Chameleon Blueprint therefore passed Blueprint review
but could not produce a Visual Package. It remains immutable and is not
rewritten or reused.

## Authority cutover

- `pre-render-book-visual-blueprint/v4` → `v5`;
- `pre-render-blueprint-authoring-authority/v3` → `v4`;
- `pre-render-blueprint-draft-schema/v5` → `v6`;
- initial authoring prompt `v4` → `v5`;
- repair prompt `v4` → `v5`;
- authoring provenance `v3` → `v4`.

Visual Package stays `visual-package/v5`; its layout policy object and version
stay unchanged. Approval/review lifecycle shapes also stay unchanged because
their exact Blueprint and authority digests already reject stale replay.

## Production changes

- Added `preRenderBlueprintLayoutPolicy.ts` as the neutral shared policy,
  canonical-region constructor, supported-region predicate, and text-zone
  resolver.
- Removed `textSafeRegion` from provider structured output.
- Made the deterministic authoring overlay stamp the region by frame kind.
- Added exact keep-clear language to both initial and repair prompts.
- Added Blueprint-level `text_safe_policy_invalid` validation before package
  assembly while retaining collision validation.
- Reused the shared predicate inside Visual Package layout validation and the
  runtime canvas boundary.
- Removed fixture-only region rewriting from production package and Visual
  Package tests.

## Proof

Focused command:

```powershell
npx --no-install vitest run lib/visual-package/__tests__/pre-render-blueprint-authoring.spec.ts lib/visual-package/__tests__/pre-render-book-visual-blueprint.spec.ts lib/visual-package/__tests__/openai-responses-structured-output-schema-compatibility.spec.ts lib/visual-package/__tests__/pre-render-blueprint-lifecycle.spec.ts lib/visual-package/__tests__/production-package-lifecycle.spec.ts lib/visual-package/__tests__/visual-package-v4.spec.ts lib/visual-package/__tests__/visual-package-lifecycle.spec.ts lib/generation-pipeline/__tests__/runtime-world-authority.spec.ts lib/generation-pipeline/__tests__/wizard-runtime-qualification.spec.ts --pool=forks --maxWorkers=1
```

Result: **9 files / 247 tests passed**.

Additional proof:

- QA Wizard candidate bridge: **8/8 passed**;
- `npx --no-install tsc --noEmit`: passed;
- `git diff --check`: passed;
- literal `npm run check`:
  - TypeScript passed;
  - autonomous Story typecheck passed;
  - ordinary phase: **3,373 passed / 5 failed / 65 skipped**;
  - resource-intensive phase: **610/610 passed**;
  - the five failures are the established absent ignored-output fixtures in
    `momentum-gate-koko.spec.ts`, `page-entity-qa.spec.ts`,
    `story-read-back-validation.spec.ts`, and
    `child-lexicon-ages-5-8.spec.ts`; none of those files changed.

The tests prove canonical authoring overlay, schema exclusion, initial and
repair prompt authority, old v4 rejection, malformed/legacy/page-top policy
rejection, collision rejection, shared 250–350 acceptance, no runtime remap,
package lifecycle, and Wizard bridge continuity.

## Explicit exclusions and next gate

No provider, network model, Vision, image, audio, upload, storage, database,
deployment, release, new Blueprint artifact, planning approval, Visual Package
approval, Wizard promotion, page render, or full-book render occurred.

After independent Claude Code PASS, regenerate the Chameleon Blueprint
offline into new content-addressed paths, verify zero issues and zero-write
package assembly, and show the exact review packet/contact sheet to Guy. Only
Guy may approve that exact new Blueprint digest. Package approval and render
qualification remain later separate gates.
