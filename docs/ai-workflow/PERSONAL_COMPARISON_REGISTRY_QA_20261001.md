# Offline comparison registry correction and QA receipt

## Decision / intake

Received independent Claude PASS for EXACTLY `43978d85..9adf6555`, P0/P1/P2 = 0,
with non-blocking P3-A/B/C. The complete report was read this time, not only its
chat summary:
`C:/Users/guyna/AppData/Local/Temp/claude/C--GNart-Work-Small-Heroes/af9211ff-30ea-426d-9794-43cad9ee3788/scratchpad/qa-selectp3/CLAUDE-QA-SELECTP3-9adf6555.md`,
SHA256 `f391edfdd28077647e7975a8589216b6b91694898b9fa014ced14a91a4946070`.
Forwarded chat attachment SHA256
`b37d4753de22473d295133afa4d91941b6023d7b9fc5f2d52d0c9c37ccdd2cc4`.
Report: 430/430, 26 invisible-clone probes, 16/19 mutations; full gate RED, ten
ordinary failures and three resource RPC errors. These are RECEIVED measurements,
not Codex reruns. Earlier PASS scopes and unreviewed bridge are not expanded.

Same chat/sole Codex writer, branch `codex/personal-book-storyboard-bridge`, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
Base `9adf6555f7e1db65af4c6d482ffa2cb7c207c4bc`, clean, no upstream, 12 commits
not reachable from cached remote refs. Protected d53b `768ccb2f`, accepted-intent
`63ccb484`, site `86ca47e8` clean/ahead 2; reviewer detached clean at `9adf6555`.
Read-only advisers inspect this immutable base, not concurrent implementation.

### Observed / expected / root cause

P3-A: source labels cover core/fact/place fields but NOT free-text avoid. Caller
can mark fields fixture and supply personal avoid text; it enters all four review
phases. The committed twelve-profile registry is currently merely suggested data.
Expected: only exact committed synthetic requests, their case IDs and split may
enter the offline packager. Never silently redact/change an evaluated request.

P3-B: an invisible mark between Latin base and accent inhibits Unicode composition;
stripping it after NFKC leaves decomposed spelling that differs from composed text.
Expected: normalize the comparison key again after stripping, preserving accents
and stored wording. No shared normalization change.

### Recommended bounded implementation

1. Bind offline rows to `personalStoryEvaluationProfiles()` by case ID, split and
   canonical raw reviewed request BEFORE preparing/exporting the brief. Every field,
   including avoid/intent/revision, must match; object key order may differ.
2. Move comparison test data to one committed profile; add all-twelve no-artifact
   positive controls, arbitrary fixture/avoid/metadata negatives, actual CLI
   rejection-before-write proof and a removed-registry negative control.
3. Append NFC to the local comparison key; add composition and NFKC compatibility
   regression guards with before-fix controls. Do not strip all Unicode marks.
   Add a direct editor-preflight held-selection regression for the other P3-C gap;
   no editor implementation changes.
4. Focused tests + tsc, full stability contract, six paid artifact fingerprints,
   local focused commit, independent Claude re-gate. No self-PASS.

Rejected: removing avoid from review would hide essential evaluation conditions;
trusting a new caller-supplied fixture flag recreates the same flaw; mutating
arbitrary input into a registered profile misrepresents source evidence. Registry
binding is for this finite offline evaluation, NOT a restriction on customer books.

Compatibility: formerly accepted arbitrary fixture manifests now fail closed.
The caller-source-label guard is replaced, not layered as a redundant authority:
exact registry equality covers every former clause and all unlabelled fields.
Admission errors now use `story_comparison_unregistered_profile` (rather than
`synthetic_registry`); actual CLI outer error remains sanitized/unchanged.
Existing packages/paid artifacts are not overwritten or migrated. Future cohorts
require a separately reviewed registry update; no supplied cohort override exists.
No runtime writer/editor/UI/API caller imports the evaluation registry.

Stop-check: general diagnostic/privacy correction under approved evaluation scope,
no production flow/QA acceptance threshold/prompt/budget/model change, $0, no live
providers or secrets. No new product decision. Rollback: revert this focused commit
without altering historical outputs. No push/deploy or external distribution here.

## Open / excluded

- P3-1 valid planner HOLD still becomes generic book failure and loses plan-only
  diagnostic evidence. Separate next milestone before trials evaluating holds.
- P3-3 stability remains RED; no timing causal claim or timeout changes.
- P3-C NFKC and editor selection re-check regression gaps targeted, without
  changing editor behavior. Results and deliberate breakages recorded below.
- No creative acceptance, external provenance attestation, anonymization of model
  output, renderer, narrator, public cutover or release. Generated prose could
  independently hallucinate sensitive facts: registry binding only fixes input.

## Measured correction / independent handoff

Exact range begins at the full base above and ends at the sole successor containing
this document; head SHA is supplied in the handoff. First Claude pass read-only.
Changes: two production files, two specs, CURRENT, ROADMAP and this document.
No editor, packager, shared normalizer or existing registry bytes changed.

### Measured offline controls

- Focused 14 files **456/456**, native 0; `npx tsc --noEmit` native 0.
  Planning 46, metrics 19, comparison 47, writer 38, writer SDK 20, editor 39,
  editor SDK 14, editor trial 15, story routes 18, book runner 88, book routes 32,
  generation deadline 13, storyboard 60, workload classifier 7. Total 456.
- Reviewed-base controls: four accent/joiner cases and free-text avoid rejection
  fail on `9adf6555`. A separate corrected CLI control with all artifact slots
  null accepts/writes on the base and rejects without an output root after fix.
  The first CLI control kept stale artifacts and hit source_binding, so it did
  NOT isolate admission; it was corrected before the claimed CLI proof.
- Exact-admission mutation removed the registry block and prepared caller input:
  all twelve metadata/request negatives plus actual CLI fail (13 failures).
  Each negative request is otherwise structurally accepted, all artifacts null.
  This was the targeted filter `rejects an unregistered|registry-invalid`, NOT
  the entire spec. Subsequent Claude full-spec mutation also fails the six
  typed-source tests: 19 in that broader run. No claim of 13 total failures.
- NFKC removal: wide-alef test fails, presentation-shin control still passes
  because NFC normalizes it; do not claim both were mutation-sensitive.
- Editor-preflight removal: one new held-selection test fails. All mutations
  restored; story-editor.ts, personal-story-comparison-package.ts and shared
  story-contract.ts unchanged.
- All twelve committed profiles and a held-out subset accepted. Reversing object
  key order preserves admission/output. Private registry digest equals the actual
  registry and is absent from blind packets. Four visible accent differences pass.
- Real CLI rejection preserves parent listing and creates no output root. Existing
  binding/schema failures still tested. No provider, key value or network required.

Full `npm run check` **native 1**, both typechecks passed:

- Ordinary: 381 files, 6 failed / 358 passed / 17 skipped files; 10 failed /
  5470 passed / 73 skipped tests. All TEN sorted failure names equal the previous
  `personal-selection-p3-validation-20261001/full-check.log` names. No fresh base
  run and no inference of causal independence or timing stability.
- Resource: 20 files, **635/635 assertions**, THREE unhandled onTaskUpdate RPC
  timeouts, native phase 1/gate failed. These are NOT a passing full resource gate.
- Log 324874 bytes, SHA256
  `cadad1f4f201a599ef5084b2d391ced0072d971b15781dc480bb8bac9353b892`.

Recorded ordinary failures: child-lexicon-ages-5-8 (1), momentum-gate-koko (1),
page-entity-qa (1), story-read-back-validation (2),
story-source-visual-direction-acceptance-lifecycle (4),
reserved-page-placement-authority (1). This is observation, not stability closure.
The fresh ignored root is `outputs/personal-comparison-registry-validation-20261001/`;
it is local, not a backed-up artifact. Prior output roots are not reused.

### Historical preservation

Recomputed six original paid files, **6/6 SHA/size unchanged**:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| accounting.json | 1436 | `2fff380b0a8585e73dfc488ffe1f524560602f2f66f6ad37181729a47d8f8ca5` |
| index.html | 19652 | `709ffbc1a8d08ccdc2e1d6ceb42e44ec507f472c67d5c02fd39da57cae510621` |
| profile-1-draft.json | 19077 | `22b8c8ac14211db13092847dd14d38e0079b5a056f422d79151821d73de19e18` |
| profile-1-edited.json | 39946 | `eb0970becf8b71df4ceb6c583810097966a94d8f7ff2646b6799265c9ec6e50e` |
| profile-2-draft.json | 25231 | `e1c908648b32a20ceecb69e0b314474812a6f60df44663b46db590271bfe26ab` |
| profile-2-edited.json | 51429 | `52510ffec8f82e0410f75296f66d442d6e509a98716926c737ac7235b2320ea6` |

Root: `outputs/personal-story-editor-trial-20261001/`. The historical known
estimate $0.280328/unknown failed-call usage and claimed allowance are untouched.

### Ready-to-copy Claude brief

Guy's standing requirement is excellent personal, adventurous children's stories,
with trustworthy phase-separated evidence. This milestone only closes input
admission/Unicode/regression gaps identified in your `43978d85..9adf6555` review.
Review the ONE successor on branch `codex/personal-book-storyboard-bridge`, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`, base
`9adf6555f7e1db65af4c6d482ffa2cb7c207c4bc`; freeze the head supplied by Codex.
First pass read-only; no credential/provider/render, push, cleanup or UI activation.
Stop and reconcile if topology differs. No expansion of earlier PASS scopes.

Please falsify:

1. Can any arbitrary fixture-labelled request, avoid string, ID or split enter the
   public phases? Attack all-null artifacts so source binding cannot mask admission.
   Prove every registered profile, registered subsets and key reordering still pass.
2. Does context come from the trusted profile AFTER whole-request admission? Can
   any caller registry/flag bypass it? Is the registry digest private only?
3. Can CGJ/ZWJ/ZWNJ/VS inserted before accents still create false distinction?
   Do visible accents remain distinct, stored strings unchanged and compatibility
   normalization/editor preflight mutations get caught?
4. Run the real CLI: rejected input must leave no package/root. Validate unchanged
   existing source binding, schema, blind labels/order and separate phase behavior.
5. Confirm finite offline admission does not restrict live customer generation or
   change prompts, model/caps/allowance, routes, shared normalizer or editor code.
6. Confirm historical hashes and topology, check the exact full-gate observation
   above, and do not interpret input admission as anonymization of supplied prose,
   creative accuracy, authenticated artifact provenance or release acceptance.

Reproduce focused suite:

```powershell
npx vitest run lib/personal-wizard/__tests__/story-planning.spec.ts lib/personal-wizard/__tests__/story-text-metrics.spec.ts lib/personal-wizard/__tests__/story-comparison.spec.ts lib/personal-wizard/__tests__/story-writer.spec.ts lib/personal-wizard/__tests__/story-openai.spec.ts lib/personal-wizard/__tests__/story-editor.spec.ts lib/personal-wizard/__tests__/story-editor-openai.spec.ts lib/personal-wizard/__tests__/story-editor-trial.spec.ts lib/personal-wizard/__tests__/story-routes.spec.ts lib/personal-wizard/__tests__/book-runner.spec.ts lib/personal-wizard/__tests__/book-routes.spec.ts lib/personal-wizard/__tests__/generation-deadline.spec.ts lib/personal-wizard/__tests__/storyboard.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts --reporter=dot
npx tsc --noEmit
git diff --check 9adf6555..HEAD
```

### PowerShell handoff (after focused local commit)

Inspect the frozen successor before any separate push decision. Branch has no
upstream; a push would carry the earlier local history too, not only this range.
No stage/commit needed: Codex commits the seven explicit paths. No push authorized
in this milestone, and no self-awarded independent PASS.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log --oneline 9adf6555..HEAD
git diff --stat 9adf6555..HEAD
git diff --check 9adf6555..HEAD
# ONLY after separate push approval and earlier-range gate audit:
# git push -u origin codex/personal-book-storyboard-bridge
```
