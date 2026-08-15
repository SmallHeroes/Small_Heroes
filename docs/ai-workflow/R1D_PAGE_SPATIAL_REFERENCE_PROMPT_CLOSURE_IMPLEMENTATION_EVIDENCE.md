# R1D Page-Spatial Reference Prompt Closure — Implementation Evidence

## Topology and scope

- Worktree: `C:\Users\guyna\.codex\worktrees\spotlightlion1\Small_Heroes`
- Branch: `codex/r1d-page-spatial-reference-prompt-closure`
- Base: `93d9ac7c0975901b3dfea2445da34a0b1958bbd2`
- Code commit: `eb2fa7051b99fc15edfda3d134fd2c9ce986be39`
- Independent QA: pending

The change is general to every Story Source. It contains no Leo, child,
companion, page, authored-id or provider-output literal. Existing artifacts
are ignored historical evidence and were not mutated.

## Consumed v10 attempt

Output root:
`outputs/r1d-leo-adventure-three-page-proof-v10-source-regeneration`.

The run used canonical Git probe once, Fresh Readiness prepare/verify once
each, official OpenAI pricing preparation, one canonical import preflight, one
Supervisor verify and one Supervisor live invocation. The credential source
was read only inside the Supervisor child; ambient inheritance was false and
credential authority was cleared. Raw stdout/stderr were suppressed.

Canonical live result:

- receipt v21 digest:
  `a984456247512fd10629e238bf156c92b6cf79ce3d2a677e2d1709736fe36267`
- readiness v19 digest:
  `348668682e681da003e3ebd94ccdd0e4ac48ca88da144e25e82db476694c838d`
- logical provider calls / repairs / transport retries / fallback:
  `3 / 2 / 0 / false`
- attempt routes: initial → `page_spatial_reference_patch` → `full_draft`
- usage: input `35,470`; cache-write `34,497`; cached `0`; output `46,949`;
  reasoning `4,786`; total `82,419`
- nominal / conservative cost: `$1.628942 / $1.793175`
- projected maximum / hard ceiling: `$4.884 / $5.00`
- terminal classification: `draft_validation_budget_exhausted` /
  `draft_validation_repair_exhausted` / `budget_exhausted`
- candidate and reconciliation digests: absent

Attempt diagnostics prove the previous correction succeeded. Attempt one had
five unique out-of-zone page-spatial references. The compact repair resolved
all five and exposed 25 later issues: 12 Action Semantic capability gaps, 12
page final-structure failures and one cover projection failure. The source-only
full-draft repair resolved all 25 and completed within the ceiling, but
introduced nine new out-of-zone page action references on pages 4, 5, 6, 8,
10 and 12. With the third logical call complete, the unchanged budget failed
closed. No candidate, Reconciliation, Blueprint, Wizard, page selection,
image, render, storage/database, QA publication or production action occurred.

## Verified root cause

The validator already requires every `{kind:"spatial",id}` used by a page
action or safety constraint to resolve inside the page's own zone. The prompt
described zone topology and selection authority but did not state that
same-page membership invariant where action reference forms are authored.
Consequently a complete repair could satisfy its input diagnostics while
creating new cross-domain spatial identifiers that were caught only by the
unchanged post-authoring validator.

## Implementation

`buildTemplateCompileSystemPrompt` now states the exact existing invariant:

- spatial ids come only from `spatialNodes[]` of that page's exact `zoneId`;
- location ids, zone ids, Set Board area ids, prose labels, other-zone nodes
  and invented ids are never spatial selections;
- a schema-valid entity/none form is used when the reference is not page-zone
  spatial.

`buildTemplateRepairSystemPrompt` embeds the compile prompt, so the same rule
is present byte-for-byte in full-draft regeneration. The initial and repair
system authorities advance to `vc-template-prompt/v13` and
`vc-repair-prompt/v13`. User prompts remain `vc-template-user-prompt/v13` and
`vc-repair-user-prompt/v13`. Schema v14, the compiler, every validator and all
repair routing remain unchanged.

## Validation

Focused command:

```text
npx vitest run lib/__tests__/visual-contract-prompt-table-compaction.spec.ts lib/__tests__/visual-contract-repair-loop.spec.ts lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts
```

Result: **4 files / 138 tests PASS**. The direct regression proves the rule is
present in both initial and full-draft prompts and freezes every forbidden id
class and the non-spatial alternative. Lifecycle and materialization tests
bind both v13 system authorities.

The first focused command used a malformed PowerShell wildcard and found zero
files; the corrected literal paths above were then used. This was command
preparation, not a test assertion result.

- `npx --no-install tsc --noEmit`: PASS
- `git diff --check`: PASS
- one `npm run check`: both TypeScript contracts PASS; resource phase **19
  files PASS** with clean diagnostic protocol; ordinary phase **280 files**
  with only the exact six established missing ignored-output fixture failures
  and no seventh failure.

The prompt-ceiling corpus remains green for all 18 approved Story Sources.
Exact measured upper bounds include Fox `50,217` (`13,783` headroom) and the
worst case Lion fantasy `53,641` (`10,359` headroom).

## Unchanged behavior and rollback

Unchanged: model `gpt-5.6-sol`, Responses/default service tier, reasoning,
draft schema v14, 64K ceiling, initial-plus-two-repair budget, transport
retries zero, no fallback, timeout, `$4.884/$5.00` ceilings, candidate
semantics, Reconciliation, Blueprint, Wizard, render and release behavior.

Rollback is the focused code commit. Historical v12 authorities and the v10
attempt remain immutable but cannot authorize a new attempt.

## QA falsification targets

1. The rule is general and contains no story-specific literal.
2. Initial and full-draft prompts contain the same page-zone invariant.
3. The rule covers page actions and safety constraints and forbids every
   non-node identifier class named above.
4. Validator/schema acceptance and repair routing are unchanged.
5. Version bindings advance exactly the two changed system authorities.
6. All 18 source inputs retain safe ceiling headroom.
7. Tests/TypeScript/repository-check evidence is stated exactly.
8. Existing v10 artifacts are unchanged and grant no candidate/render
   authority.
