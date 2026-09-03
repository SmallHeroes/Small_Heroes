# R3-B1a Story Source / Visual Direction Correction Candidates — Implementation Evidence

Date: 2026-09-03
Branch: `codex/r3b1a-story-correction-candidates`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Exact-candidate implementation base: `2708d6500298b86e6c49d9eb10a684497cc8d7c6`
Final R3-B1a independent-QA base:
`462aaf4c19c7e8809284a96579fb993400e5a593`
Implementation head: `85ef104cd7765a3e0376bb5ec84a72e75103d9c8`
Independent implementation QA: **PASS with no P0/P1** on
`462aaf4c19c7e8809284a96579fb993400e5a593..85ef104cd7765a3e0376bb5ec84a72e75103d9c8`
Documentation-closeout head: the focused local commit containing the post-review
corrections below; its exact immutable SHA is supplied after commit.
Decision Gate:
`docs/ai-workflow/R3B1A_STORY_SOURCE_VISUAL_DIRECTION_CORRECTION_CANDIDATES_DECISION_GATE.md`

## Outcome

The exact R3-B0b 17-record review corpus now has one deterministic,
content-addressed correction-candidate preparation boundary. It prepares all
17 records and 208 pages without trusting the ignored prior output artifact,
without accepting or publishing any source, and without reaching a provider.

This is a preparation milestone, not render readiness. The resulting batch has
eight records pending exact Guy product/visual review and nine records held
before review because 13 creative source or continuity decisions remain open.
No record has human narration-ear acceptance, so the batch reports 0/17 strict
render-ready. The repository-wide truthful Wizard result remains 1/18 because
the already-qualified Chameleon bedtime record is outside this correction
batch.

## Claude Code predecessor gate

Claude Code's first R3-B0b review passed the batch mechanism but raised one P2
against its static provider-capable import closure. The follow-up corrective
range
`8b0818fee5f4338839caa7e3117f97861ee4a867..018e15336fd36058b9469d31e5ce9117222f2cbf`
was independently re-gated read-only and received **PASS with no P0/P1/P2**.
Claude independently measured no forbidden provider module in the corrected
graph and ran the real preparation path under provider/network/write sentinels.
That PASS is the foundation for this milestone; it is not product acceptance of
the candidate content and is not reused as the R3-B1a verdict.

## Exact tracked authority

The tracked correction plan is:

`story-pipeline/04_approved_story_sources/review-requests/r3b1a-story-source-visual-direction-correction-plan.json`

- version: `small-heroes-story-source-visual-direction-correction-plan/v1`;
- self-digest: `c276878d619d9814720a1fa4697fbaa7c8ca2bef69d74323eeafef71ef3180f2`;
- bytes: 155,299;
- raw SHA-256:
  `4a9ee040e19316eaea81bdfe22704dce727b72fde5f305cdbb4e6a8436c21527`;
- exact records: 17;
- exact Story Source replacements: 388;
- exact typed Visual Direction replacements: 52;
- exact unresolved creative-source issues: 13.

The plan binds the exact R3-B0b review-batch version, digest, raw bytes and every
record digest. Every record also binds its accepted source manifest/story and
typed Visual Direction inputs by canonical repo path and raw SHA-256. The batch
membership comes from the recomputed complete Wizard/R3-B0b predicate; 17 is a
required result, not a handwritten runtime selection.

The Decision Gate bytes are independently bound by the plan and checked against
the live tracked file before any candidate materialization. A stale plan,
Decision Gate, R3-B0b batch, record, accepted source, Visual Direction, or
storyboard-corpus input fails closed.

## Candidate invariants

For every one of the 17 records, the orchestrator executes the existing
correction materializer in memory and then re-validates its untyped result. It
requires:

- canonical `gender: neutral` source authority;
- byte-identical female prose projection relative to the accepted female source;
- resolved boy and girl projections across every page;
- exact page count and ordered page bindings;
- a typed, canonical Visual Direction artifact;
- composition policy success;
- zero singular English gender pronouns in Visual Directions;
- exact manifest, migration, input and output digests and policy versions;
- `runtimeEligible:false` and `productionEligible:false` at batch and record
  boundaries.

The batch record and selected-record materialization result preserve the record
disposition; the pending correction manifest keeps its own closed legacy-
compatible shape and does not add that field. Existing lifecycle code can load
the manifest for bounded inspection and disposition recording, but the legacy
`prepareReview` and `promoteRevision` routes reject correction candidates
explicitly. No existing acceptance path can silently publish the new version.

## Exact result

The final ignored candidate artifact is:

`outputs/r3b1a-story-source-visual-direction-correction-candidates/96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b.json`

- batch version:
  `small-heroes-story-source-visual-direction-correction-candidate-batch/v1`;
- canonical digest:
  `96154a39091b71c9dffb64dcf60b8667c149b78d4b4c0d5a07787189d00a7e9b`;
- bytes: 353,307;
- raw SHA-256:
  `d8a57650364d62cfc52496b1385ba5dd95fe702f06edf51ff327ae5a43caba4c`;
- first explicit write: `created:true`;
- exact replay: `created:false`;
- membership: 17 records / 208 pages / 5 bedtime / 6 adventure / 6 fantasy;
- source/projection invariants: 17 neutral, 17 female-prose-byte-identical, 17
  boy resolved, 17 girl resolved; the full female-projection bytes differ from
  the historical accepted female source because they retain candidate metadata
  `gender: neutral` rather than the historical `gender: female`;
- Visual Direction invariants: 17 composition-valid, zero singular English
  gender pronouns;
- dispositions: 8 pending exact review / 9 HOLD;
- unresolved issues: 13 creative-source/continuity, including one protected
  companion appearance-state authority issue;
- narration: 7 critical items / 24 soft items / 0 human ear acceptances;
- strict render-ready inside the batch: 0/17.

The 13 held decisions are distributed as follows:

| Story | Open decision(s) |
| --- | --- |
| `bunny_ometz_bedtime` | Child verb agreement on pages 4 and 6 |
| `chameleon_koko_fantasy` | Demonstrative agreement and plural-gender review |
| `dragon_dini_bedtime` | Frog-gender agreement |
| `dragon_dini_fantasy` | Dini appearance-state authority and smoke-net carry state |
| `fox_uri_adventure` | Recurring fastener quantity |
| `fox_uri_fantasy` | Temporary prop exit state |
| `lion_shaket_bedtime` | Cardboard-moon position transition |
| `panda_anat_adventure` | Scarf ownership authority |
| `panda_anat_fantasy` | Creature gender and Panda scarf/shirt state |

These are intentionally exposed rather than guessed. `lion_shaket_adventure`
also retains its separately required Claude Cowork story-quality review before
Guy acceptance, even though it has no mechanical HOLD issue in this batch.

## Filesystem and effect boundary

Batch publication and selected-record materialization share one repository-wide
exclusive lock. Output roots must remain canonical descendants of `outputs/`;
the implementation checks parent and file identity, link counts, canonical
realpaths, immutable existing bytes, and directory identities before and after
publication. Writes use closed staging trees and fail-closed cleanup. Exact
replay does not rewrite bytes; collisions and concurrent ownership fail closed.

Every declared external-effect counter is zero:

- provider/network/database/storage calls: 0;
- accepted source or Visual Direction rewrites: 0;
- acceptance/publication/runtime activation: 0;
- image/audio/PDF renders: 0;
- order or payment mutation: 0;
- maximum spend: USD 0;
- resemblance-threshold change: false; it remains 0.70.

The only durable runtime output produced during validation is the ignored local
content-addressed JSON above. An obsolete intermediate ignored artifact was
removed only after validating its exact output-root containment and filename;
the final artifact remains available for independent inspection.

## Validation evidence

Focused exact slice:

```powershell
npx vitest run lib/visual-package/__tests__/story-source-visual-direction-correction-batch.spec.ts lib/visual-package/__tests__/story-source-visual-direction-review-batch.spec.ts lib/__tests__/story-source-revision-materializer.spec.ts lib/__tests__/story-source-revision-lifecycle.spec.ts lib/__tests__/story-source-visual-direction-enrichment-lifecycle.spec.ts lib/visual-package/__tests__/wizard-all-story-render-readiness.spec.ts lib/visual-package/__tests__/wizard-all-story-readiness-cli.spec.ts --maxWorkers=1 --no-file-parallelism
```

Result: **7 files / 67 tests PASS; exit 0**.

Per-file test inventory for this exact argv is 9 correction-batch + 14 review-
batch + 12 materializer + 6 lifecycle + 8 enrichment + 11 readiness + 7 CLI =
**67**. The same command was rerun after independent review and again returned
**7/7 files and 67/67 tests PASS; exit 0**.

Workload classifier after adding the new spec:

```powershell
npx vitest run lib/__tests__/vitest-workload-classifier.spec.ts --maxWorkers=1 --no-file-parallelism
```

Result: **1 file / 7 tests PASS; exit 0**. Canonical inventory is now
382 files: 362 ordinary and 20 resource-intensive.

Static checks:

```powershell
npx tsc --noEmit --pretty false
git diff --check
```

Result: **both exit 0**.

Repository-wide check:

```powershell
npm run check
```

TypeScript and `story:autonomous-typecheck` pass. The ordinary phase reports
**339 passed / 6 failed / 17 skipped files** and **4,790 passed / 10 failed /
73 skipped tests**. Every failure is an unchanged ENOENT dependency on one of
six absent ignored historical `outputs/` fixture sets. The resource phase
reports **20/20 files and 640/640 assertions PASS**, followed by three known
Vitest-worker `onTaskUpdate` RPC timeouts. The full command exits 1 and is not
called PASS. No missing fixture was copied, regenerated, or hidden.

## Independent QA result and P2 disposition

Claude Code independently reviewed the immutable implementation range
`462aaf4c19c7e8809284a96579fb993400e5a593..85ef104cd7765a3e0376bb5ec84a72e75103d9c8`
read-only and returned **PASS with no P0/P1**. It independently reproduced the
truthful 18-to-1 gender/narration readiness correction, exact 17/208 and 5/6/6
selection, 388/52 replacement counts, 51/51 raw-file bindings, zero overlaps,
17 neutral candidates, female-prose identity, resolved boy/girl projections,
8/9 dispositions, 13 issues, closed lifecycle boundary, immutable no-write
behavior, zero effects, provider-free real CLI, and unchanged 0.70 threshold.

Its three P2 notes are disposed as follows:

1. **Valid documentation wording:** one compressed bullet and the external
   handoff omitted the word `prose`. The bullet above now states
   `female-prose-byte-identical` and explicitly discloses why the full female-
   projection bytes differ from the historical accepted source. No code or
   artifact changed.
2. **Test-count/run discrepancy, disclosed rather than guessed:** Claude's first
   seven-file execution reported one unidentified failure and 67 passing tests;
   its immediate rerun reported 68/68, and the correction-batch file passed 9/9
   on three further isolated runs. Claude did not publish per-file counts or
   exact argv for the 68-test selection. The exact command printed in this
   document was rerun after review and passed 67/67; its seven per-file counts
   sum to 67 as recorded above. The evidence therefore preserves the exact
   reproducible 67 count and discloses both reviewer observations. No recurring
   failure or changed repository test inventory was found.
3. **Correctly surfaced product blocker, not a defect:** the single
   `dragon_dini_fantasy` companion appearance-state authority gap is already
   counted under `protectedAuthorityIssueCount: 1`, documented in the 13-item
   decision set, and keeps the record on HOLD. Nothing is waived or netted away.

This closeout changes documentation only. It does not change the implementation,
plan, candidate artifact, status, eligibility, effect counters, or any protected
authority. Claude Code must re-gate the documentation-only correction before
R3-B1a is called technically closed.

## Internal review corrections

Parallel internal adversarial review found and corrected, before handoff:

- publication-lock ownership and parent-directory identity race gaps;
- lifecycle ambiguity that could have allowed a new correction manifest into
  an old publication route;
- a second Dini fantasy page-16 gender projection;
- one Bunny fantasy direction edit that could duplicate punctuation;
- issue attribution for the Dragon bedtime frog;
- Dini's page-9 color transfer and page-10 smoke-net disposition;
- exact Lion basket anchors and page-15 state;
- Panda scarf authority wording and state ownership.

The final internal re-gate found no remaining actionable P0/P1/P2, but internal
review is not independent Claude Code PASS.

## Limitations and next gates

This milestone does not resolve or authorize:

1. Guy's 13 creative/continuity decisions and exact candidate acceptance;
2. Claude Cowork's required `lion_shaket_adventure` product-quality review;
3. a narration correction authority, TTS generation, or human ear acceptance;
4. accepted Story Source / Visual Direction publication;
5. Visual Contract, Blueprint, Board/prop, package or locator completion;
6. any paid LOW/HIGH page sample or full-book render;
7. product launch readiness.

Claude Code must independently review the final immutable range before Guy is
asked to accept or publish these candidates. After that PASS, Codex can produce
a compact decision packet for the 13 HOLD issues, continue the separate
narration lane, and advance only accepted records into bounded downstream
authoring and paid visual samples.

## Independent QA falsification targets

Claude Code should attempt to falsify:

- exact topology, changed-path scope and clean-tree claims;
- both unreviewed R3-B1a commits after the R3-B0b closeout, including the
  readiness/materializer/enrichment foundation at `2708d650`;
- predicate-derived 17/1 membership and 208-page count;
- the plan, Decision Gate, R3-B0b batch, record and raw-file bindings;
- replacement occurrence counts, overlap handling and record/source swaps;
- female-prose byte identity and boy/girl completeness;
- Visual Direction schema, composition, pronoun and continuity invariants;
- untyped materializer-result validation and policy-version binding;
- old lifecycle review/promotion rejection for correction manifests;
- dry-run zero-write behavior, immutable replay, lock ownership, hardlink,
  collision, canonical-path and directory-identity handling;
- zero external effects and unchanged 0.70 threshold;
- whether any disposition, status or documentation overstates acceptance or
  render readiness.
