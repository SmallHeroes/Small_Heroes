# R1D Accepted-v3 Visual Contract Authoring — Offline Implementation Evidence

**Date:** 2026-08-24
**Branch:** `codex/qa-wizard-presentation-dispositions`
**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`
**Base:** `1af831c7e72034773570e721d6a111e5c03a0ed1`
**Gate:** `R1D_ACCEPTED_V3_VISUAL_CONTRACT_AUTHORING_AND_WIZARD_CUTOVER_DECISION_GATE.md`

## Outcome

The exact product-accepted Bar/Kim revision can now enter the existing
canonical Visual Contract authoring path with its accepted continuity intent
intact. The proof is provider-free and costs `$0`. No current Visual Package,
locator, Wizard selection, Board, accepted-source byte, credential, provider,
image, Vision, audio or render surface changed.

Independent review of the implementation commit is still required. This
evidence does not authorize the later live text-authoring attempt by itself.

## Verified root cause

The published v3 revision already carried closed product intent:

- child wardrobe transition: page 8;
- Companion State transitions: pages 2, 3, 5 and 6;
- canonical companion accessory authority;
- frozen companion appearance authority.

The canonical source snapshot read `integrated.md`, including all eight pages
and image directions, but did not carry `manifest.continuityIntent`. The draft
schema exposed the existing nullable Companion State selection but had no
typed child wardrobe selection. Consequently, authoring had no enforceable
way to represent the explicit pajamas transition and no accepted page-set
census against which to reject drift.

## Implementation

### Accepted revision authority

`acceptedStorySourceAuthoringAuthority.ts` recognizes only the canonical
accepted-revision path
`accepted/{storyKey}/revisions/{digest}/integrated.md`. For v3 it proves:

- exact nine-file regular-file inventory;
- no symlink, junction, alias or hardlink input;
- canonical JSON bytes and content digests;
- every manifest descriptor's bytes and SHA-256;
- revision directory/identity digest equality;
- continuity equality across manifest, identity and enrichment artifacts;
- integrated-story and Visual Directions SHA bindings;
- exact candidate/review/technical-review/product-acceptance bindings;
- technical status `pass`, reviewer `Claude Code`, zero BLOCKER/MAJOR;
- exact Guy acceptance and runtime-ineligible status.

The resulting `accepted-story-source-authoring-authority/v1` is bound to the
same story key, revision digest and source path. Legacy v2 accepted revisions
and top-level accepted Story Sources remain unbound (`null`) for backward
compatibility. A malformed or unsupported revision-shaped path fails closed.

### Snapshot and canonical materialization

- source snapshot: `story-source-authority-snapshot/v4`;
- live materialization input: `canonical-live-request-materialization-input/v35`;
- authoring request: `visual-contract-authoring-request/v46`;
- materialization manifest: `canonical-live-request-materialization/v44`;
- zero-write verification: `canonical-live-request-verification/v44`.

The snapshot and manifest carry the full accepted authority. Verification
rebuilds the source snapshot from disk and compares the complete
`sourceRevision`, so a stale or replayed accepted authority cannot verify.
Legacy request v45 remains explicitly classified `legacy_immutable`.

### Typed continuity contract

`small-heroes-story-visual-continuity-intent/v1` is an exact-key, ordered,
unique, in-page-range authority. Draft schema v18 adds four nullable initial/
full-draft fields:

- `childWardrobeOverrideDescription`;
- `childWardrobeOverrideSourceEvidenceId`;
- `companionStateId`;
- `companionStateSourceEvidenceId`.

The compiler turns a non-null child pair into the existing typed
`childWardrobeOverride` with compiler-resolved same-page Story Source origin.
It requires the actual wardrobe and Companion State page sets to equal the
accepted sets exactly, rejects missing/extra/empty/no-op evidence with typed
diagnostic `continuity_authority_invalid`, and therefore uses the existing
`full_draft` repair lane. Page-only and structural-bundle repairs cannot erase
the four continuity selections.

For accepted sources, companion wardrobe is compiler-owned from the existing
generic canonical accessory profile. For Kim this freezes the tiny warm-
mustard shoulder satchel and the existing forbidden alternatives without a
story-specific production branch.

## Offline falsification

The offline repair harness starts with a draft missing an accepted wardrobe
transition and injects one corrected full draft. Observed route and census:

```text
call 1  initial     complete issues 1  baseline
call 2  full_draft  complete issues 0  delta -1 / improved
outcome candidate; providerCalls 0
```

The resulting contract contains the exact pajamas description with page-12
Story Source evidence in the generic fixture and retains the canonical bunny
accessory. Separate real-source proof confirms the Bar/Kim prompt receives
page 8, pages 2/3/5/6 and Kim's mustard satchel.

Negative proof covers stale bytes, unexpected inventory, malformed accepted
paths, cross-story source replay, legacy-v2 compatibility, top-level accepted
compatibility and hardlink rejection.

## Input-budget correction discovered offline

The first focused regression found that the new schema/prompt pushed
`chameleon_koko_adventure` to 64,049 units, 49 over the unchanged 64K ceiling.
No cap, model, budget, call count or policy was changed. The new unbound-source
prompt prose was removed/compacted and canonical accessory detail was limited
to accepted-continuity inputs, matching where compiler enforcement applies.

Final measurements:

- 12 QA sources at 8/12 pages: all at or below 64K;
- worst QA source: 62,975, headroom 1,025;
- 18 approved sources: minimum headroom 10,524;
- approved Fox exact bound: 50,052, headroom 13,948;
- draft schema bytes: 14,023;
- draft schema digest: `6ca1a5c42a2a11b16fdd5fe29a19ab89ddced73ddc0d430fbea0cb89c6b4ec9d`.

## Real provider-free artifact proof

Root:
`outputs/r1d-chameleon-accepted-v3-continuity-authority-20260823T215049643Z`

- canonical input digest: `f4aa5e789c67c119ff0522cce27a9963ca4ff46976d71fb5f96e32efd3e94950`;
- source request digest: `5f390601624028be19d08ef219643916f348935b645402da88268749e713b611`;
- source snapshot digest: `35fe04ab5601031735bd7bdd283bab7a8d897bc399427d592e39fe56aa1f6a6c`;
- live authoring request digest: `27ec404134c80efe48e66113cf097a3b5d85494aeb7e599e1d0a08b76b5b0f1b`;
- materialization manifest digest: `5d6468edb621877a6eeb5333c7a0a0e6e61d5fa3ac22baa2cf228f679d3042d2`.

The public verifier returned `status: verified`, `zeroWrite: true`, and exact
source digest `9acf0433...7195b1`. External-boundary evidence is zero for
credential reads/checks, provider reachability, pricing lookup, provider
calls and model calls.

## Preservation fence

The nine accepted files reproduce the previously reviewed SHAs. In particular:

- `manifest.json`: `e25df837...02cf40ef`;
- `integrated.md`: `9acf0433...7195b1`;
- `story.md`: `b18e824c...2afd09`;
- `visual-directions.json`: `51e3bb3e...ab9778`.

Current locator SHA remains `6d3d9431...02bb96b`. Board SHAs remain:

- `8e530b44...22892db`;
- `bbce002d...f4c74b3`;
- `a2bff526...3522fbf8`;
- `53e446c9...20bfe86`.

The four Board artifacts remain untracked and unstaged.

## Validation

- focused lifecycle/authoring matrix: **11 files / 334 tests PASS**;
- accepted authority + offline harness: **13/13 PASS**;
- source-authority compatibility matrix: **102/102 PASS**;
- prompt-budget matrix: **10/10 PASS**;
- `npx --no-install tsc --noEmit`: exit 0;
- `git diff --check`: exit 0.

The focused matrix includes materialization, verification, execution request,
Supervisor, canonical pre-live readiness, structured-output compatibility,
source authority, prompt budget, live-authoring policy and the offline repair
harness. No provider call occurred.

The repository-wide `npm run check` was also executed after the milestone's
two exact-catalog expectations were updated. TypeScript and the autonomous
story typecheck pass. The command remains exit 1 for pre-existing test-
infrastructure/fixture conditions, not a changed production assertion:

- five assertions in four unchanged specs read gitignored `outputs/` fixtures
  that are absent in this worktree (`child-lexicon-ages-5-8`,
  `momentum-gate-koko`, `page-entity-qa`, and two
  `story-read-back-validation` cases);
- the unchanged Story Source Blueprint-migration spec can exceed the ordinary
  5-second test timeout and passes **8/8** when isolated with a 30-second
  timeout;
- the resource-intensive phase has **20/20 files and 611/611 assertions
  passing**, but Vitest exits 1 after three known `onTaskUpdate` worker RPC
  timeouts.

Each missing-fixture spec was isolated and reproduced the expected `ENOENT` or
missing-image result. No fixture was fabricated and no timeout/policy was
weakened to make the aggregate command green.

## Boundaries and next gate

No provider/live authoring, Candidate mint, approval, reconciliation,
Blueprint, package, locator, Wizard, database, deployment, image, Vision,
audio or render operation was performed. Claude Code must adversarially review
the focused commit and the real `$0` bundle. A PASS permits consideration of
the one canonical live text-authoring attempt already described by the
Decision Gate; it does not authorize any later artifact or render step.
