# Decision Gate: source-derived critic evidence and child-native Hebrew

## Authority and topology

Guy approves milestone 1 after adding everyday child-readable Hebrew and avoiding
excessive word/root repetition. Base: 7e94cf982a94c07464b6862cb9f0e1e1d2bdece3.
Branch: codex/personal-book-storyboard-bridge, personal-story-product/Small_Heroes.
Codex is the sole writer; delegated inspection is read-only at the base.
The engine tree is clean, 35 ahead of its cached upstream; no fetch/push.
Protected d53b=768ccb2f and accepted-intent-wave-2=63ccb484 remain unchanged.

## Observed failure and expected behaviour

The trial's critic added text to a quotation and the exact-source guard correctly
rejected it. Copying is unnecessary: the engine can supply bounded exact source
units and resolve version-bound references itself. IDs/anchors establish location,
not semantic support. All findings must remain visible; invalid evidence must not
be silently omitted or become approval. Reader instructions are currently present
both in instructions and in the JSON packet, reducing reservation headroom.

The diagnostic craft guidance does not explicitly prohibit rare/ornate vocabulary
or excessive inflections of one root. Add one shared, age-aware instruction for
planning, authoring, editing and reading. Preserve familiar purposeful refrains,
but not a rare word merely because it recurs. No blacklist, stemmer or automatic
claim of child readability.

## Scope, order and files

1. A pure source-unit/citation module: exact spans, bounded contiguous ranges,
   disjoint original/revised IDs, normalized token anchors as a secondary check.
2. Diagnostic reader wire/decoder, runner and original-reader probe. Instructions
   sent once; their digest remains in the source-bound wire packet. Legacy quote
   validation remains explicitly available for archived records, never as a wire
   fallback. Compiled evidence must survive source-bound editor-context readback.
3. Diagnostic-only language guidance, fixtures and adversarial tests.
4. Offline replay of retained readings and wire-budget measurement, tsc, focused
   tests, full check, explicit-path local commit and independent Claude handoff.

No public writer/editor/review behaviour changes. The editor's semantic audit
still copies quotes and keeps its strict validator; migrating it is separate.
Polish transfer, per-book failure isolation, retries/resume and voice-overlap
reporting are separate milestones. No model, caps, pricing or stage changes.

## Risks, alternatives and acceptance

Do not implement a fuzzy quote repair, a Hebrew NLP subsystem, duplicate full
prose as a citation catalogue, discard an invalid finding, or add a provider call.
Short anchors can collide and cannot prove entailment. Preserve exact quotation
bytes while normalizing only the token check; keep negation and token order.
Unknown/stale/cross-version references, reversed/cross-page/oversized ranges and
anchor mismatches fail closed. Final reading cannot cite the original; comparison
requires both sides. Retain raw responses and existing one-use accounting.

Tests cover Unicode, dialogue, punctuation, short/long units, deterministic
coverage, wrong valid IDs, repeated-anchor limitations, readback tampering and
the real runner/probe boundaries. Replay valid archived citations without changing
their files; the historical extra-word quotation must still reject. Measure
actual serialized wires before claiming budget headroom. Offline proof is not a
literary quality measurement or an independent PASS.

## Stop-check and rollback

General diagnostic system fix, not a story-specific patch. It touches prompt
assembly and QA evidence, not production, payments, images or reader UI. Guy's
explicit approval resolves scope; new paid experiments require separate approval.
Cost allowance: 0 provider calls, 0 renders, 0 USD. Existing key reuse was already
authorized; no provider key lookup or request is required for these checks.
Rollback: revert the focused milestone commit, not reset unrelated work. Historical
artifacts remain untouched and failed families are not reopened. Claude Code first
pass is read-only and must attack citation binding, omission, budget and language
instruction delivery. Guy evaluates actual prose only in a later approved trial.

## Validation and closeout

Implemented the diagnostic reader wire and compiled evidence, not the public
engine or editor audit. Source units contain at most 160 UTF16 code units; a
citation selects up to four whole units (at most 640 code units), never slices or
normalizes its quotation. This derived-span bound is explicitly different from
the preserved legacy model-written quotation limit of 220 characters. Existing
six-card/12,288-byte editorial and full-wire limits still apply and may omit whole
cards with recorded reasons. Citation tokens ignore Hebrew marks and invisible
formatting and join in-word apostrophe/geresh forms; other punctuation separates
words. They preserve letters, token order and negation. A one-word source supports
a one-word anchor.
Anchors may collide; a negative control demonstrates that provenance is not truth.

Canonical v1 packet builders and their digests are preserved. New serialized
packets omit instructions and include instructionsDigest, sourcePacketDigest,
source digests, disjoint IDs and citationVersion. Probe/comparison manifests are
v2. New compiled readings retain sourceEvidence, which is recompiled against the
exact source during editorial-context validation. There is no legacy fallback on
a modern model response. Empty identity/schema probes remain separate.

Digest domains for verification (the existing field names are not renamed):

| Value | Pair it with | Meaning |
| --- | --- | --- |
| compiled reading.packetDigest | manifest.sourcePacketDigest and wire packet.sourcePacketDigest | Digest of the unchanged legacy canonical packet |
| sourceEvidence.output.packetDigest | manifest.packetDigest and prepared review.packetDigest | Digest of the numbered wire body |
| wire packet.instructionsDigest | digest of separately delivered review instructions | Binds the instructions sent exactly once |

A new reader instruction changes the wire body's digest, not the legacy source
packet digest. Evidence produced under other instructions must not be re-sealed
or silently reused. The actual new paid corpus is empty at this correction.

Local validation before the code commit: tsc0; 613/613 across nine focused files
plus 7/7 workload-classifier tests. The first focused run exposed a test-fixture
clone error (a Zod object cannot be structuredClone'd), fixed without changing a
production guard. The added ordinary spec requires census414/394 instead of
413/393; resource20 is unchanged and its classifier now explicitly pins the new
spec. The initial full contract run was RED with 11 ordinary failures: the ten
previously recorded missing-artifact cases and that newly fixed census expectation.
6279 ordinary tests and635 resource tests passed; the resource supervisor still
reported on_task_update_rpc_timeout. A literal npm run check on the immutable code
commit will be recorded separately, not retrospectively claimed here.

Offline replay examines22 stored story readings, maps79 valid quotes to bounded
source ranges, and rejects the one historical extra-word quotation. Twelve
unusable receipts/identity probes are explicitly skipped; none of their findings
is promoted or repaired. New compiled source evidence retains every finding of
the21 accepted readings. 425 unique historical/preparation/paid/external evidence
files preserve hashes/sizes; the330 rows with original mtime preserve mtime too.
Six in-memory guard removals each admit the bad input its intact guard rejects;
no production file is changed by this mutation test. These are Codex's checks,
not independent Claude QA or observed live citation reliability.

Serialized wire measurements include schema and source-unit metadata. In the six
stored calibration calls, removing duplicate instructions offsets new metadata
and leaves each reservation under its existing1USD slot. Some older shorter-
instruction wires grow; there is no claim that every wire gets smaller or every
schema-maximum manuscript fits. 8/12/16-spread normal Hebrew examples fit the
existing 104,000-byte/stage limits; escaping/capacity rejection tests remain.

Child-register guidance is delivered to the actual diagnostic planner, replan,
author, editor and original/final/comparison readers. Public guidance is unchanged.
It requires familiar concrete wording and consistent simplification of a rare
recurring term, while protecting the function of a refrain rather than rare
wording. There is no automated vocabulary-quality certificate, blacklist or root
counter. A subsequent paid trial must assess the prose, not just this routing test.

Independent Claude Code review is pending. Current allowance remains0provider
calls/0renders/0USD; no push, deployment, new book, repaired artifact or family
resume. Evidence is local without verified remote backup. See the external
source-citations-20261006 replay/check/mutation records and the post-commit handoff.
Official schema constraints consulted: https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas.

### Corrective readback boundary

An internal read-only inspection of d7aa966c found that stripping sourceEvidence
could make the default context constructor infer the archival format. This was
not a native model-wire bypass, but was a real constructor/readback weakness.
The correction requires sourceEvidence in the default constructor, stamps new
projectionsv2, and offers causalArchivalDraftCritiqueContext explicitly for oldv1
records. Savedv1 contexts can still be validated for offline compilation. A new
host refuses archival projection/source-evidence absence before saving a critique
or claiming its editor. No paid dispatch can use that compatibility entry.

Two regressions show that stripped data is genuinely valid under the old quote
schema but fails the new constructor/readback, and that a valid archival context
cannot enter a new real offline host. The latter preserves the existing outer
provider_or_contract_failed/coordinator_failed sanitisation, rather than inventing
a different observed error code. An in-memory removal of the default guard admits
the stripped control again. Correction: tsc0 and622/622 across10focused files.
These are internal checks, not independent Claude QA. Immutable full-check results
will be recorded after the corrective commit; no provider or render allowance.

### Immutable validation closeout

Actual code range is7e94cf982a94c07464b6862cb9f0e1e1d2bdece3..
8935beb088037e24bee2743ad9437bc059c56ba0, with code commitsd7aa966c and8935beb0.
On clean8935beb0:622/622 focused in10files, nativeexit0. Literal npm run check
exits1: ordinary6282passed/10failed/73skipped; resource635/635tests pass but the
supervisor remains RED with on_task_update_rpc_timeout. All ten failure names
match the previous fixed-reader full-check record exactly. The first attempt at
the literal check failed in a Windows wrapper before tests started; its separate
record is retained, not represented as a repository result. The subsequent
successful launch's complete gate output is retained even though the gate is RED.

Both committed verification runs record unchanged source fingerprints and HEAD
across execution. Offline closeout audit confirms these, unchanged public/shared
modules, and clean protected/reviewer worktrees. Post-correction replay again
checks425files/22readings/79validquotes/one invalid quote. No story/evidence text,
key configuration, model, pricing, caps, provider, rendered image, site or paid
family state is changed. Final successor records only these three Markdown docs.
No independent PASS, literary gain, public integration or release readiness is
claimed. External CLAUDE_HANDOFF.md names exact code/document review ranges and
contains copy-ready inspection/push commands; push remains unauthorized here.

### Independent HOLD and corrective scope (2026-10-06)

Claude Code independently reviews code7e94cf98..8935beb0 and docs8935beb0..
06ac5d8f: HOLD, P0=0/P1=0/P2=1/P3=3. Its own tsc0/622tests,41attacks,
15of18caught mutations,22readings/79validquotes/oneinvalid/425preserved files
support the earlier claims without awarding literary or release acceptance.
The full gate was inspected from our log, not independently rerun. Report:
scratchpad/qa-cite/CLAUDE-QA-CITATIONS-8935beb0.md in the retained Claude session.

Observed defect: an in-word geresh/apostrophe splits a familiar word or child
name into two tokens. A compliant four-word anchor can therefore fail the whole
diagnostic run. Invisible formatting marks can cause the same mismatch.
Expected: these marks do not alter anchor word identity/count; letters, order,
negation, side/page/range and every exact source quotation remain authoritative.
Root cause is the normalization order before letter/number token extraction,
not the catalogue or model schema. The old replay corpus barely exercised it.

Corrective milestone stays in this task/worktree on the same branch, based on
clean06ac5d8f (38ahead of cached origin). Codex is sole writer; Claude's detached
8935beb0 reviewer and other protected/site trees stay read-only and untouched.
Order: pin the geresh/format defect with compile-path regressions; strip Hebrew
marks and invisible formatting, join only in-word apostrophe/geresh forms; pin
the three surviving guards individually; use reader-facing language criteria;
document the two packet digest domains without renaming public fields; verify,
commit explicit paths and supply the independent re-gate brief.

Acceptance: exact/dropped/alternate in-word marks accept 2-4word anchors; changed
letters, ordering, missing negation and five words reject. Exactly four same-page
units pass and five fail that bound; one word fails on a multiword range; archival
construction rejects an otherwise valid modern reading. Each new guard test must
fail if only its targeted clause is weakened. Reader guidance evaluates rather
than rewrites; writer guidance stays byte-identical. Existing archive replay and
wire/capacity checks must remain valid. Source-derived modern digests intentionally
change with the clarified instructions; there are no saved paid modern readings
to migrate. Historical legacy packets remain unchanged and explicitly readable.

Stop-check: general correction within Guy's approved milestone, not a new stage,
literary rule, tokenizer/NLP subsystem, provider, fallback or product decision.
No fuzzy letters, name special cases, automatic retries or failure isolation.
0provider calls/0renders/0USD; no push/deploy/key write. No paid run is implied.
Rollback is a focused revert after review, never a worktree reset. Full check is
still required, but any inherited RED gate remains a release blocker. Independent
Claude must falsify normalization strictness, guard-specific tests, provenance,
digest pairing, instruction roles, compatibility and evidence preservation.

### Corrective verification before commit

The source citation spec grows from 29 to 48 tests, without deleting a test.
Against the pre-fix tokenizer it reports 13 failures, all new positive mark cases;
with the correction it passes 48/48. The full focused set passes 641/641 across
10 files; tsc exits 0. Actual production clauses are temporarily weakened one at
a time: M07 changes the four-unit boundary, M13 removes the one-word restriction,
M03 removes the archival refusal. Each dedicated spec fails only its intended
case; source SHA fingerprints confirm full restoration afterward. These are
root's regression controls, not a fresh independent review or an 18-mutation run.

Reader wording now assesses language and forbids rewriting. The writer block
and all three legacy packet builders compare identically against `06ac5d8f`.
Actual runner tests check the appropriate block exactly once and absence of the
other block. Only the new wire instructions/digest change. Public writer/editor,
semantic audit, text review, runner/host/probe/adapters and package.json are
unchanged in this corrective diff. No new library or SDK migration is needed.

Replay again maps 79 quotes in 22 readings, rejects the one fabricated old quote,
skips 12 unusable receipts and preserves all 425 historical files. An additional
62 prior milestone and Claude scratch files retain SHA/size/mtime. The six known
calibration reservations are 952078,964879,965759,952958,946413,959214 microUSD,
each below its existing 1 USD slot. These bounds use recorded rates, not a fresh
price check or real charge. A first audit-helper run used an incorrect family
prefix and stopped before saving its report; the exact recorded family fixes
that helper selection, not production code or evidence.

No paid new source-contract reading exists to migrate. The original independent
HOLD is not overwritten: a corrective Claude re-gate is still required. The
literal full gate will be run at the immutable code commit and recorded with
native status and unchanged source fingerprints. $0, no provider, render, push
or deployment.
