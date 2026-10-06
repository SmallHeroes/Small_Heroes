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
cards with recorded reasons. Citation tokens ignore Hebrew marks/punctuation,
not letters, token order or negation. A one-word source supports a one-word anchor.
Anchors may collide; a negative control demonstrates that provenance is not truth.

Canonical v1 packet builders and their digests are preserved. New serialized
packets omit instructions and include instructionsDigest, sourcePacketDigest,
source digests, disjoint IDs and citationVersion. Probe/comparison manifests are
v2. New compiled readings retain sourceEvidence, which is recompiled against the
exact source during editorial-context validation. There is no legacy fallback on
a modern model response. Empty identity/schema probes remain separate.

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
