# Claude Code handoff: adventure selection and literary evidence

## Frozen scope and authority

Review-only first pass. Branch `codex/personal-book-storyboard-bridge`, worktree
`C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`.
Base `6de84b4f1b20a15fd260fed68e6723d17e58edf9`; reviewed head is the focused
successor commit containing this document (exact SHA supplied with handoff).
Verify parent equals base, HEAD/range, clean tree and no upstream before review.
Do not review detached `sh-qa-book-10f54930` as if it were current HEAD.

Guy adopted four refinements: meaningful two-concept differences; retained ideas
and rationale for human scrutiny; deterministic structural measurements separate
from literary opinion; separate planning vs editing experiments. This is a
code-only milestone, no new paid allowance, public launch or creative acceptance.
Decision: `PERSONAL_ADVENTURE_SELECTION_DECISION_20261001.md`.

Previous PASS scopes are unchanged. The preceding `8695d196..6de84b4f` P3
correction still needs its own independent re-gate. Read dependencies as necessary;
do not expand this review to the entire bridge/writer, release or images.

## Implementation claims to falsify

1. CURRENT plan output requires two A/B candidates through actual SDK AND custom
   writer providers. Each maps approved facts and an interest to contribution.
   Literal clone/niqqud/bidi differences, duplicate IDs/dimensions/facts, unknown
   fact references, unreferenced selected facts and invalid spread witnesses reject
   before manuscript. needs_work also holds there, after one paid attempt, no retry.
   Semantic paraphrase can still mask the same plot; code does NOT prove quality,
   truthful causal usage, actual predicate entailment or good candidate selection.
2. Optional result-root receipt leaves archived plan/prose schemas compatible.
   Current writer requires it; archive reader accepts absence. Receipt binds the
   ORIGINAL plan and is cloned through editing, not authored by editor output.
   The editor may change the chosen plot. Original and final hashes remain separate.
   Storyboard sourceDigest includes the receipt. Reason alteration changes source
   identity; hashes are NOT external authentication of immutable selection history.
   draftDigest covers original plan/prose only. Deliberate stripping can still
   impersonate legacy diagnostic data; nothing becomes runtime-eligible.
3. Lexical words are NFC Unicode letters/numbers with niqqud inside tokens and
   internal geresh/gershayim/apostrophes; standalone punctuation is not a word.
   Counts use actual narrative-spread prose, not title/plan. Ages 3..5: soft 35..65;
   ages 6..8: soft 45..85. Below/above lists and statistics are code measurements.
   The editor gets draft metrics. Neither ready nor counts is a literary verdict.
4. Offline manifest has four explicit nullable source slots per case: old/new
   first drafts and each edit. Same reviewed request, model and spread count are
   required; commit/Medium provenance is DECLARED, not authenticated by Git/API.
   Edit original must equal the supplied draft; planning receipt is preserved.
   Missing arms stay in the denominator. No best-available draft becomes final.
5. Review packaging has opaque private-seed labels, independent phase ordering,
   symmetric complete texts and allowlisted prose. Four isolated folders contain
   first-draft pairs, editing pairs, premise pairs or edited final texts, never all
   phases in one reader. Final critique has no A/B instruction/editor assertion.
   Private evidence retains the original manifest, both proposals/reason, label
   key, metrics and missing slots. Do NOT distribute root or several phases to the
   same reviewer: repeated prose permits cross-phase matching. Directory separation
   is not an access-control guarantee; sequential/unblinded viewing ruins blinding.
6. CLI is OFFLINE only: no SDK factory, key, env-file, fetch, execute flag, retry or
   generation. Existing real outputs directory required; safe new leaf name only;
   refusals/structural validation occur before writes, existing roots cannot reopen.

## Files / unchanged behaviour

New: `story-planning-contract.ts`, `story-text-metrics.ts`, `story-comparison.ts`,
`story-evaluation-profiles.ts`, `scripts/personal-story-comparison-package.ts`,
three corresponding specs and one fixture helper. All modules are under
`lib/personal-wizard/` except the CLI and classifier inventory spec.
Changed: writer/SDK/result contract, editor/result contract, storyboard identity,
plan-cap policy and affected mocks/exact reservation assertions. Test inventory
now 401 = ordinary 381 + resource 20; no workload migration or timeout change.

No app/UI/site/voice/order/story-bank/renderer/narration/payment change. Existing
whole-book plan -> draft -> editor -> storyboard -> semantic review order unchanged.
No new provider stage, fallback, retry loop or acceptance authority. Existing auth,
operator gating, exclusions, fact sources, name/address and caller locks remain.

## Cost / timeout policy (not completion proof)

Only plan output gains 4,000 reasoning-inclusive tokens: caps 12k/14k/16k for
8/12/16 narrative spreads; manuscript stays 8k/10k/12k. Plan timeout correspondingly
gains 160 seconds under the existing cap-derived local deadline policy, not an SLA.
Existing price table unchanged; extra Sol reservation $0.044/job, Astra $0.22/job.
Sol full-book reservations $2.1626/$2.3936/$2.6796; Astra long $13.398 remains
rejected by unchanged $10 hard cap. Writer/full-book call ceilings remain 2/5.
Current three-profile CLI DRY reservation $2.970, not permission to execute and not
historical $2.838. Historical one-shot root remains claimed; cannot reset its budget.
Test-only two-job route fixture uses $1.10; a new test proves actual unchanged $1
allowance refuses second short job before key access. No production budget changed.

## Tests and negative controls

`npx tsc --noEmit`: native 0 after final code restoration.
Focused 14 specs: **412/412**, native 0, 10.72 seconds:
story-planning 28, text-metrics 19, comparison 21, writer 38, OpenAI 20,
editor 39, editor-OpenAI 14, editor-trial 15, routes 18, book-runner 88,
book-routes 32, deadline 13, storyboard 60, classifier 7.
Logs: `outputs/personal-adventure-selection-validation-20261001/final-focused.*.log`.

Actual adapters checked strict SDK schemas for all lengths, full five-stage
orchestrators, selected B, stale edited receipts, receipt-free edited bridge,
schema-inclusive input ceiling, current selection failure at ONE outer attempt,
measured usage retained and lock released before editor/visual calls.
CLI tested through exported actual main: phase files, escaping, provenance/metadata
sentinels, output reuse and traversal refusal, no network call. No browser UX claim.

Deliberate temporary breakages, restored before green/typecheck/full run:
- Old normalization plus disabled needs_work: four failures (niqqud/bidi/zero-width/
  held), native 1; 24 skipped. `negative-selection.*.log`.
- Manuscript metadata exposed plus missing-edit final guard disabled: two failures,
  native 1; 19 skipped. `negative-review.*.log`.
These are implementation regression controls, not independent Claude acceptance.

Final frozen-code `npm run check`: **native 1 / RED**, both TypeScript checks passed.
Ordinary 381 files: 6 failed / 358 passed / 17 skipped, tests 10 failed / 5426 passed /
73 skipped; 101.27 seconds. Resource 20 files: 20 passed, 635/635 tests passed BUT
three `onTaskUpdate` unhandled RPC errors; gate exit 1, 227.79 seconds. Logs:
`final-full-check.stdout.log` / `final-full-check.stderr.log` in validation root.
Ordinary failure names match previous records: child-lexicon-ages-5-8 (1),
momentum-gate-koko (1), page-entity-qa (1), story-read-back-validation (2),
story-source-visual-direction-acceptance-lifecycle (4), reserved-page-placement-
authority (1). No fresh base full run; matching names is not proof of causality.
Intermediate check had 11 ordinary failures (ten familiar failures plus classifier
inventory, now corrected); resource 635 passed but three RPC errors. No machine-load
causality, stability, release readiness or green full gate is claimed.

## Preserved evidence and actual quality gap

Recomputed six files under `outputs/personal-story-editor-trial-20261001/`:

| Artifact | Bytes | SHA256 prefix |
| --- | ---: | --- |
| accounting.json | 1436 | 2fff380b |
| index.html | 19652 | 709ffbc1 |
| profile-1-draft.json | 19077 | 22b8c8ac |
| profile-1-edited.json | 39946 | eb0970be |
| profile-2-draft.json | 25231 | e1c90864 |
| profile-2-edited.json | 51429 | 52510ffe |

Full hashes and word details in the local `historical-metrics-probe.ts` output.
Age-five draft 256 words, 6/8 below target; edit 565, 7/8 above. Age-four draft
340, 12/12 below; edit 601, all within. Raw drafts stopped mid-plot; editors restored
endings. This is legacy draft/edit evidence, NOT matched planner comparison; it
predates final mapping and cannot serve as frozen `6de84b4f` baseline.
Historical known usage estimate $0.280328 plus unknown seventh invocation remains
unchanged; do not reconstruct total or equate reservation with charge.

New matrix: 12 SYNTHETIC registered inputs, six companions twice, each length four,
ages 3..8, both addresses, six rich/six sparse, six topic/six no-topic, three held out.
Sparse still includes required broad fixture residence; no invented absent-location
support. Held-out is a tuning convention, not secret access. ZERO generated/evaluated.

Next experiment must freeze these requests/commits before paid generation, run the
same model/settings on both arms, retain failures and missing cases, judge complete
FIRST drafts blind BEFORE considering edits, and seal judgments before label reveal.
Then assess editing benefit separately; a different final-only critic reads actual
revised texts. Premise preference is judged before chosenId/reason reveal. Report
mixed/no improvement honestly. No repeated tuning on held-out texts. The package
does NOT run generation or issue a quality score/PASS. Fresh bounded execution
allowance and separately gated earlier dependencies remain open.

## Offline CLI and handoff commands

After matched artifacts exist (this command spends nothing):
```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
npx tsx --require ./scripts/shims/register-server-only.cjs scripts/personal-story-comparison-package.ts --manifest <matched-manifest.json> --output-name <new-safe-name>
```
Only distribute the exact reviewer phase folder; never private-evidence.json.
No real manifest/current model comparison was generated in this milestone.

Focused commit is already created by Codex at handoff: do not stage/commit again.
Copy-ready inspection (push ONLY after independent review and Guy's explicit decision;
it carries earlier branch commits too, not just this range):
```powershell
$repo = 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
git -C $repo -c safe.directory=$repo status --short --branch
git -C $repo -c safe.directory=$repo show --stat HEAD
git -C $repo -c safe.directory=$repo log --oneline 6de84b4f..HEAD
# Only after explicit push approval:
git -C $repo -c safe.directory=$repo push -u origin HEAD:refs/heads/codex/personal-book-storyboard-bridge
```

All outputs are ignored/local-only, no verified off-machine backup. No live call,
real secret-value read, images/audio, push/deployment or creative acceptance.
Codex subagents supplied provisional read-only advice, NOT independent QA/PASS.
Please attack the six claims above through real exported entry points and archived
boundaries, then return findings tied to this exact range. No edits/providers first pass.
