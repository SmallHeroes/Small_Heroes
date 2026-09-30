# Personal manuscript -> whole-book storyboard: independent QA handoff

## Requirement and exact boundary

Guy wants the reviewed recording details, edits/deletions, chosen companion and
length to feed an engaging personal adventure, followed by a storyboard which
understands the entire story before rendering individual pages. Identity, places,
landmarks, custody and spatial state must persist without freezing camera angles.

This milestone connects the existing personal manuscript to the existing typed
diagnostic planner. It is an **offline bridge**, not a completed customer render
flow. Guy approved implementation and requested Claude Code review. No independent
PASS is claimed by Codex. The frozen commit range is supplied in the accompanying
post-commit report; do not review a moving HEAD.

- Branch: `codex/personal-book-storyboard-bridge`, no upstream, unpushed.
- Worktree: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
- Base: `45b9e754256751d2e115916cfcf0d267825f7da1` (writer pilot).
- Pinned donor: `ef865968f45535d0714d5afae319597d2fab7566` on
  `codex/r3b1b-semantic-recovery-m1`. No branch merge or donor edit.
- Claude's site: `cdf5938b531d06e91d76edb6ae7ac9ad1c276663`; untouched.
- Protected dependencies: d53b `768ccb2f`, accepted-intent wave2 `63ccb484`.
- One implementation task writes this worktree. First QA pass must be read-only.

## Observed gap, solution and rejected shortcuts

The personal writer already plans the entire narrative but carries continuity as
free text. The typed whole-book engine exists on a separate branch. No consumer
binds its input to the exact final personal manuscript. We connect those surfaces
without parsing generated prose as a Markdown template, rewriting accepted text,
minting catalog approval or cutting over the deployed pipeline.

Do not replace state with a longer per-page prompt, treat an unrelated matching
quote as semantic proof, promote a previous pixel error into a reference, or call
a structurally valid storyboard a good book. Literal source binding and explicit
semantic holds precede packet extraction. Nothing here claims model accuracy.

## Files and donor provenance

Four modules are byte-identical to the pinned donor Git blobs:

| Module | Donor blob |
| --- | --- |
| `lib/local-book-sequence.ts` | `af480e82d27f8aed7b3c6831dc4b9478893a0294` |
| `lib/local-book-planning.ts` | `8e0f6147eed78b896d1e35232d17f1caf9936c2e` |
| `lib/local-preview-quality.ts` | `708855b7a0d7a1f2c433a32bae6ca9cd351d934e` |
| `lib/local-visual-priority.ts` | `8f7625b11d6601cbdeb2cc8d45b1b8c169d39fb0` |

`lib/local-story-preview.ts` starts from donor blob
`0acb5734156943ae660f2734386e731c7cd5778b` and adds `previewTextPages`:
strict literal title/pages, sequential coverage, own source digest and in-process
provenance. The old Markdown constructor is unchanged. This is a **local copy**,
not a shared-module extraction; future divergence is a known maintenance risk.

New implementation:

- `lib/personal-wizard/storyboard.ts`: request/result binding, whole-book input,
  compilation, bound semantic-review disposition and current-source frame packets.
- `scripts/prepare-personal-storyboard.ts`: actual offline CLI, fresh direct child
  under `outputs/`, sanitized errors and native 0/1/2 exit behavior.
- `lib/personal-wizard/__tests__/storyboard.spec.ts`: 60 tests, including real
  writer with mocked provider and actual subprocess CLI boundary.
- Donor `local-book-sequence.spec.ts` (33) and `local-preview-quality.spec.ts` (28).
- `lib/style01-gptimage.ts`: optional `allowDistinctSupportingChildren` flag.
  Omitted/false retains the old string exactly; true allows distinct source-required
  children, never duplicate protagonists. No existing production caller is changed.
- `lib/__tests__/vitest-workload-classifier.spec.ts`: inventory 388 -> 391 and
  ordinary 368 -> 371, with explicit membership for all three new specs. Resource
  manifest, workers and timeouts are unchanged.
- CURRENT/ROADMAP and the Decision Gate record the scope, tests and remaining work.

## What the bridge actually does

1. Revalidate the current reviewed request and strict writer result. Match request,
   length, fixture status, canonical plan digest, approved fact IDs and resilience.
   Reject noncanonical writer-result normalization rather than trimming changed prose.
2. Feed **all final manuscript pages and the ending**, approved facts, companion
   personality, exclusions and optional difficulty to whole-book planning. Canonical
   companion visual description comes from server data, not the old topic mapping.
3. Compile cover plus every narrative spread. Track entities, invariants, scenes,
   physical relations, custody, inherited/offscreen state and source-bound changes.
   Camera/expression/framing remain separate from physical state.
4. Preserve `pending_semantic_review`. A strict report must cover seven whole-book
   categories and four checks on every frame, including cover. Missing, stale,
   uncertain or contradictory review cannot yield frame packets. Uncertainty takes
   disposition precedence, but the full report retains contradictions.
5. Revalidate CURRENT request/result/options again before frame extraction. Renderer
   and judge share the exact structured context and digest. Prompt assembly consumes
   existing framing plus current sequence state; no previous image is attached or
   claimed reviewed. `runtimeEligible:false` remains even for supported reports.

The injectable author callback receives the entire input once. There is no default
SDK/credential/provider, no retry/fallback, no model selection or price claim. The
review function evaluates a supplied report; it does **not** perform a model review.

## Validation and reproduction

Final focused command (single worker, not concurrent with tsc/audio):

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
npx tsc --noEmit
node node_modules/vitest/vitest.mjs run lib/personal-wizard `
  lib/__tests__/local-book-sequence.spec.ts `
  lib/__tests__/local-preview-quality.spec.ts `
  lib/__tests__/vitest-workload-classifier.spec.ts `
  lib/__tests__/style01-prompt-assembly-child-presence.spec.ts `
  lib/__tests__/style01-child-expression-style-fidelity.spec.ts --maxWorkers 1
exit $LASTEXITCODE
```

Observed tsc exit 0; **19 files / 389 tests passed**, native focused exit 0.
The 60 bridge tests include 8/12/16 spreads vs 16/24/32 display pages, all six
companions, literal braces/newlines, removed/edited facts, source/result changes,
mutated/forged object provenance, unresolved semantics and actual CLI behavior.

The real CLI tests capture `spawnSync.status`, not a wrapper's inferred code:
supported synthetic report => native 0; pending/contradiction/uncertainty => native
2 and no frame packets; invalid source/state/review/path => native 1 before output.
They also check no overwrite, outside/nested path rejection and junction containment.

Manual offline command with existing validated input files:

```powershell
node node_modules/tsx/dist/cli.mjs --require ./scripts/shims/register-server-only.cjs `
  scripts/prepare-personal-storyboard.ts request.json writer-result.json `
  whole-draft.json review.json outputs/new-offline-storyboard
exit $LASTEXITCODE
```

Use `-` instead of review.json for a pending diagnostic. Preload belongs to the
tsx-launched child; preloading only its Node parent failed the genuine CLI test.
The command prepares data only; it does not author a live story or render images.

The first full run exposed one new inventory expectation failure. It was corrected,
not labelled inherited. It also observed ten artifact/content failures matching
the recorded base signatures, and resource 635/635 with three unhandled RPC timeouts.
Final full-check native exit 1: ordinary 371 files, 10 failed / 5121 passed /
73 skipped (5204), native 1; resource 20 files, 635/635 passed but three unhandled
`onTaskUpdate` RPC errors, native 1. Both phase gates and the full gate remain RED.
The inventory failure is absent in this final run; all 60 bridge tests pass there.
No untouched-base reproduction proves causal independence of those failures.

`PERSONAL_STORYBOARD_BRIDGE_VERIFICATION_20260930.json` is the tracked summary:
exact native commands/exits, failure names, phase records, code hashes, log hashes
and raw local verification SHA `9ea75aca71917fdaa81893cf51b34f3b916752f3aca76beadc054442feb2d807`.
The measured final implementation bytes were unchanged throughout these checks.

Local evidence is in `outputs/personal-storyboard-bridge-20260930/`: recorder,
tsc/focused/full-check stdout and stderr logs, plus `verification.json` with native
exit/signal, command, log hashes and before/after code hashes. These files are ignored
and untracked, held only on this machine; no off-machine backup is verified and a
push will not preserve them. Test-created synthetic temporary roots are removed by
the test harness; no prior user artifact is targeted.

## Adversarial targets (please run, not just read)

1. Supply forged writer bytes with a self-consistent hash; change request/options,
   manuscript, companion or removed fact after compilation. Try cloned/mutated
   source/book objects and invoke extraction without the mandatory current source.
2. Invent an inside -> outside transition with a real but unrelated source quote.
   Demonstrate the structural limit and ensure pending/contradictory review holds.
   A matching quotation is not logical entailment. Deliberately fabricated supported
   reports can satisfy this offline contract; no authenticity/accuracy claim exists.
3. Hide a prop/companion for one frame, return to the same hut on a later visit,
   change custody or construction without evidence; vary camera without changing state.
4. Omit/duplicate a frame or review category; bind a prior review to a new plan;
   combine a contradiction with uncertainty and verify the issue survives in payload.
5. Attack the REAL CLI: stale result, malformed JSON, raw sentinel errors,
   traversal/nesting, existing output and junction/symlink parent. Check native exits,
   no stack/prose leakage, no frame packets for held cases and no invalid writes.
6. Compare the four donor blobs; diff the adapted preview module. Verify the shared
   anatomical lock's omitted/false strings match base across ages/companions. Verify
   public route/UI/writer/catalog/provider implementations did not change.

## Open work and non-claims

No live final-code manuscript, live storyboard author, automatic semantic judge,
anchor/image generation, anatomy detector, pixel continuity acceptance, narration,
reader/package, public wizard cutover, durable family budget, release or deployment.
The base writer's independent QA remains open; this range cannot award it a PASS.
Semantic checks need an actual qualified reviewer and empirical calibration; a
self-consistent or synthetic report cannot establish humor, age suitability, child
agency, literary quality, accurate biography or image accuracy.

After Claude's technical review and any correction: prove the bounded live text
chain, review the real final prose and complete storyboard semantically, then run
the smallest authorized consecutive illustration sample through real render/QA
adapters. Do not start by spending on an unqualified full book. This milestone cost
is $0, with no new key read/provider call, push or deployment.
