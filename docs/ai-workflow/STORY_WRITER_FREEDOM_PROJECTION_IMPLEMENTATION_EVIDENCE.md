# Story Writer Freedom Projection — Implementation Evidence

## Status and authority

- Date: 2026-08-13.
- Branch: `codex/story-bank-next-generation-briefs-qa-integration`.
- Worktree: `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`.
- Exact implementation base: `7dd84b49abd3d26247c3516d04328331097b5834`.
- Product decision: Guy rejected mechanical prose caused by an over-specified writer brief and explicitly required a freer “rails, not script” dispatch contract.
- Independent technical QA: PASS for the exact correction range, as recorded below.
- External cost: `$0`.

## Observed failure and root cause

The historical Dini adventure commission was 607 lines / 33,416 bytes. The v1 materializer concatenated the complete shared story contract, writer contract, companion bible and structured brief. That exposed sample dialogue, `lineTargets`, reread targets, `playRule`, internal review fields and repeated rule language to the writer.

Those fields were not intended as mandatory prose, but their presence exerted imitation pressure. The resulting draft invented or repeated mechanism-like dialogue such as “הגנה מלאה”, “כלל ראשון”, “צריך לבטל את הנדנוד” and “שלוש תנודות קטנות”. The problem was therefore the writer-facing projection, not one forbidden sentence and not Dini specifically.

## General correction

The full 18 creative briefs and six companion bibles remain editorial source authority. The writer-facing bundle is now a compact projection containing only:

1. commission metadata and exact 8/12/16 text-page accounting;
2. one short writer-freedom charter;
3. one selected behavior-led companion card;
4. one closed allowlisted story-rails projection; and
5. the exact output instruction.

The projection preserves premise, causality, set-piece movement, companion complication, child discovery and climax, payoff, continuity and declared creative openings. It deliberately omits sample dialogue, `lineTargets`, reread hooks, anti-copy evidence, internal locks/status fields, scripted attempt wording and the complete source documents. `playRule` is exposed only as `physicalLogic` and is explicitly world causality rather than mandatory dialogue.

The six companion cards describe role, lovable mistake, embodied comedy, child partnership and voice direction. They contain no sample lines, slogan fields, catchphrases or mandatory verbal tics. This makes the solution general across all prepared stories and future prose rather than specific to Dini or one draft.

## Versioning and generated dispatch set

- Commission version: `small-heroes-story-commission/v2`.
- Manifest version: `small-heroes-story-commission-manifest/v2`.
- Companion-card authority: `small-heroes-companion-authoring-cards/v1`.
- Historical v1/v2 staging outputs remain immutable and must not be dispatched as the corrected writer brief. The `...20260813-v2` directory suffix is a historical staging-run label, not the `small-heroes-story-commission/v2` schema identity.
- The intermediate v3 output was preserved as `outputs/_superseded-story-commissions-intermediate-v3-do-not-dispatch` and is explicitly not a dispatch artifact.
- Current writer-facing root: `outputs/story-bank-next-generation-chatgpt-commissions-20260813-v4-open-writer`.
- Current ZIP: `outputs/story-bank-next-generation-chatgpt-commissions-20260813-v4-open-writer.zip`.
- ZIP bytes: `84,209`.
- ZIP SHA-256: `d354dd73fd578714d82770366b8e029c71f9498f00da4655a685d27a60c291c6`.

The current root contains exactly 18 content-addressed Markdown commissions plus `INDEX.md` and `manifest.json`. The manifest records 216 text pages / 432 physical pages across the full catalog. Every record's raw file SHA-256 equals both its filename digest and manifest identity.

The corrected Dini adventure commission has 154 newline-terminated content lines / 9,888 bytes (or 155 split segments when counting the terminal empty segment after its trailing newline), a 70.4% byte reduction from the historical prompt. Its digest is `b88c5c64664f8d7d691c5835ae74f99daf650273e1d706073e548c823e0229ae`.

## Contamination inspection

A literal scan across all 18 current commissions found zero occurrences of:

- the three full Dini sample-voice sentences;
- `הגנה מלאה`;
- `כלל קצבי לשלוש תנודות קטנות`;
- `כלל התנודה מוצג`;
- `שלוש תנודות קטנות`;
- `lineTargets`, `childRepeatable`, `parentReread`, `Sample voice`;
- full-companion-bible or full-shared-contract section labels; and
- separately scripted dramatic-purpose, failed-approach or escalating-consequence field names.

The absence check is a dispatch-contract regression, not a promise that a language model can never independently invent a similar phrase. Story drafts still require human oral-Hebrew and editorial review.

## Validation

- `node --check scripts/materialize-story-commission-briefs.cjs`: PASS.
- Focused materializer regression: **1 file / 5 tests PASS**.
- Full focused story/projection set: **4 files / 25 tests PASS**.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS before documentation closeout.

The focused set verifies all 18 exact page contracts, selected-only isolation, the exact projection-key allowlist, six exact-key behavior-led companion cards, malformed-card rejection, absence of excluded fields and source values, meaningful size reduction, Dini contamination sentinels, overwrite refusal and v2 content addressing.

One literal `npm run check` ran once and was not retried:

- TypeScript passed.
- Canonical census remained **299 files = 280 ordinary + 19 resource-intensive**.
- Ordinary reported only the separate established baseline: six missing ignored-output fixtures plus the pre-existing stale `r1d-dini-bar-five-page-measurement-authority` source-string assertion.
- No story-freedom, materializer, creative-brief or projection assertion failed.
- Resource-intensive passed **19/19** with valid diagnostics and no timeout, RPC/IPC, reporter, launch, signal, teardown or protocol failure.
- The repository/release gate remains HOLD on the separate ordinary baseline; this milestone does not waive it.

## Unchanged surfaces and exclusions

The 18 full source briefs, six full companion bibles, approved story banks, runtime loader, Wizard matrix, checkout, Reader, prompt/model/provider authority, pricing, image pipeline, database/storage and Production behavior are unchanged. No story was generated or imported. No credential, network/provider/model call, image/audio/Vision render, database/storage action, QA deployment, Production action or push occurred.

## Rollback

Revert the focused correction commit and continue treating the historical v1 materializer/output as staging history. No approved bank, runtime artifact or Production surface requires migration.

## Independent QA result

Claude Code independently reviewed exact immutable range `7dd84b49abd3d26247c3516d04328331097b5834..dc5db49167a737e154ef83698e63d4017f49b5d1` read-only and returned **TECHNICAL PASS** with zero BLOCKER, zero MAJOR and zero MINOR. Codex records Claude Code's verdict and does not self-award independent technical PASS.

Claude confirmed all nine handoff targets. It inspected both implementation and shipped output, proved the exact closed 20-key projection across all 18 briefs, tested deep-copy isolation and malformed companion-card rejection, verified selected-only identity and page accounting, recomputed every content address and source-provenance digest, reproduced **4 files / 25 tests**, TypeScript and `git diff --check`, and confirmed the source authorities and runtime/product surfaces remained unchanged.

Six advisory notes remain non-blocking:

1. Per-story `worldAndSafetyLocks`, `mustAvoid` and legacy anti-copy exclusions are no longer writer prompt material. This is a deliberate boundary: the output is staging-only, and child-safety/originality review is required before bank import rather than reintroducing a dense specification into the prose prompt.
2. Scripted `comicEscalations` and `attempts` are excluded, so comic construction can vary more. That variance is desired but remains subject to editorial humor and reread-value review.
3. Claude did not rerun the literal `npm run check`; the recorded full-check result remains Codex execution evidence. The separate ordinary baseline is unwaived.
4. Historical staging-directory run labels and commission schema versions are independent vocabularies; this record now states that distinction explicitly.
5. A clean prompt cannot guarantee that a model will never independently invent mechanical phrasing. Oral-Hebrew editorial review remains mandatory.
6. Claude corrected two of its own audit probes (`physicalLogic` was an intentional rename, and a JSON quotation probe produced a false positive). Neither was an implementation defect.

No further technical re-gate is required unless a factual discrepancy is identified. Story selection, prose quality, product, visual and launch acceptance remain Guy's authority.
