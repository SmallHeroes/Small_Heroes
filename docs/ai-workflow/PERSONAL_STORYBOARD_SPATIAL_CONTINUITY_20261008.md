# Storyboard spatial continuity verification

## 1 Proposed change

Strengthen provider-free regression coverage of the existing whole-book spatial/identity data and its actual
render and QA projections. Guy explicitly asked on 2026-10-08 to preserve placement and recognizable people,
places and objects across earlier/later frames and to continue. No new spatial engine, schema or prompt is needed.

## 2 Observed behavior and why now

The existing planner reads all pages. Location designs, entity invariants, wardrobe and companion identity/scale
are fixed book data. Sparse physical transitions expand into a full ledger, including invisible entities. The
reviewer receives the full plan/sequence. Render prompts and QA contexts use current continuity and sequence
projections. Existing tests cover return visits and hidden state, but do not directly pin all spatial data inside
the actual render prompt of the new current simple-source driver. This is a coverage gap, not an observed defect.

## 3 Scope and task topology

Continue in the current Codex task, sole writer on `codex/simple-story-voice-20261007`, worktree
`C:/Users/guyna/.codex/worktrees/simple-story-voice-followup/Small_Heroes`, from clean
`022748525f9ce3ac768ac20888a7f483d4a337e3`. Claude first review is read-only on the committed range.
Six protected trees retain clean baselines. No additional implementation task or reviewer/model session is started.

## 4 Generality and rejected alternatives

Use synthetic fixtures at all three lengths, not a repaired customer story. Position means world-local physical
relations and fixed set topology, not fixed image coordinates. Camera changes may legitimately swap screen sides.
Do not add duplicate coordinates/layout schemas, scene-count quotas, repeated prose rules, new stages or provider
migrations without a demonstrated failure. Do not force all past entities on screen to prove they still exist.

## 5 Files

Existing diagnostic and sequence specs, CURRENT, ROADMAP and this decision record only. No production code,
prompts, source/canon/visual authority, assets, classifier/inventory policy, SDK, route or financial change.

## 6 Expected behavior and acceptance

Three new short/medium/long cases trace fixed set geometry, object construction, wardrobe, companion declaration/
scale and physical custody through the current source -> whole-book driver -> reviewer -> actual render/QA packet.
Departure, offscreen absence and return retain canonical location/landmark IDs and current values. Different cameras
do not relocate anything. Offscreen objects/companions persist in the ledger without becoming required visible cast.
An existing supporting-character test also pins reappearance with the same design and physical relation.

Two new refusal cases have joined IDs/from/to: a wrong-page transition quote and an undeclared material change
must fail at their exact existing checks after one planner callback, before reviewer/packets. Matching prose alone
does not prove semantic entailment; the real reviewer still owns that judgment. No text is rewritten.

## 7 Validation

Literal local npx type-check, full existing diagnostic/sequence specs, clean-commit original fifteen-file focus,
and a small virtual mutation matrix that removes geometry/state from actual prompt/context projections. Record
exact HEAD/tree, complete termination and tracked content stability. Verify old 86/83 evidence and six protected
trees. Five cases are added to an existing spec: diagnostic 44 -> 49 and original focus 689 -> 694; inventory stays
421/401/20 because no spec file is added. Do not remove or skip old cases in normal gates.

Full check is not repeated for test/docs-only edits. The last complete full gate remains RED with ten inherited
ordinary failures, one Windows probe failure and three RPC errors. Static fixture proof is not image quality or
evidence that a real author always chooses enough spatial detail. Real long-book headroom remains unmeasured.

## 8 Cost and credential boundary

No API, Max, audio, book/storyboard model call, image or render. Injected fixtures only; no key is inspected or
reused and no allowance is renewed. Existing API-key/AI SDK guidance does not authorize a transport change.
Future API-backed construction/use still requires its credential decision and newly priced spending approval.

## 9 Rollback

Revert only this focused test/docs milestone. All independently reviewed runtime files remain byte-identical.

## 10 Review assignment

Claude should falsify the current-source path, all-three-length coverage, literal render-prompt/state linkage,
hidden versus removed/visible semantics, supporting-character return and exact refusal stage/codes. Confirm no
other production changes and no widened PASS. Guy later reviews a real storyboard and a qualified small LOW
sample. No new product/creative decision or Cowork consultation is needed for these deterministic assertions.

## 11 Stop check and exclusions

This is general coverage, no runtime/prompt/anchor/style/layout/financial/gate/fallback change, no spending and no
unresolved product choice. The smallest proof is local injection plus virtual mutations. No production path,
wizard integration, altered 0.70 threshold, paid transport, manual story edit, full render, push/merge/deployment.
Any newly exposed production failure stops this test-only milestone for an explicit scoped correction plan.

## Local verification

Local literal npx type-check exits 0 after the final assertion changes. Diagnostic 49/49 plus sequence 33/33 pass,
including real CLI bootstrap (82/82). Seven in-memory projection/guard
mutants are caught; control is six selected cases. Loss of render geometry or render physical relations fails the
three length cases; loss of effective attributes/visible relations or forcing offscreen state visible also fails
the supporting-character assertion (four cases). Removing the page-evidence or mutable-permission clause fails
its respective exact-code refusal case only. This pins failures at the intended tests, not exclusive semantic truth.

The local gate verifies unchanged tracked bytes, 86 historical + 83 age files and six protected clean baselines.
New ignored documentation is not covered by the local tracked inventory; it will be included in the committed one.
Clean committed `43a05a3e` passed type-check and the fifteen-file focused set 694/694. The committed inventory
includes the new doc (3381 files); bytes stay unchanged during the complete gate. Independent results follow below.

Spatial descriptions and invariant values are authored strings, while the ledger stores one principal physical
relation per entity. These tests preserve declared world relationships; they do not infer a full metric map,
prove completeness/semantic entailment or guarantee pixels. Approved visual references, a genuine whole-book
review and a later qualified LOW sample remain necessary before any visual/product claim.

## Independent verdict and closeout

Claude Code independently passed A, docs-only `1e75197b..02274852`, and B, continuity tests/docs
`02274852..43a05a3e`, with no findings. Its own type-check exits 0 and focused specs pass 694/694, including real
bootstrap. Its twelve-mutant matrix has eleven scored cases, all caught by intended tests with no timeouts or
loader errors. Prompt-only data loss fails even with QA data/hashes unchanged; widening only QA locations also
fails. Removing each refusal clause permits compilation and reaches review parsing, proving no earlier rejection
masks the targeted check. Control is 81/81 with the subprocess bootstrap deliberately excluded; normal suite is 82.

It verifies the committed inventory against 3381 blobs and that local precommit spec bytes equal the committed
ones. Six protected trees, its 314 trial files and earlier evidence stay unchanged. This records its two verdicts,
not independent PASS for other ancestry or any live/pixel/product/release claim.

Completeness limits remain explicit. These three length fixtures contain no attribute changes; accumulation of
source-backed changes is tested in existing local-preview-quality coverage. Camera assertions compare authored
fixture states; rejecting an unexplained model-authored move is the existing validator's responsibility. ROADMAP
now explicitly distinguishes the three positive length cases from the two refusal cases. No production fix is
requested. Full check remains RED and is not rerun for this three-doc-only closeout from clean `43a05a3e`.

Report: Claude scratchpad `qa-spatial-43a05a3e/CLAUDE-QA-SPATIAL-CONTINUITY-43a05a3e.md`.
Next remains a separately credential/spending-approved bounded live proof, real long-book headroom, raw receipts/
wires and deadline/abort, followed later by qualified references and a small LOW sample. No allowance is renewed.
