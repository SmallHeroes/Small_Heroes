# Opus tool-envelope correction: execution closeout and independent QA

## Original requirement and immutable target

Guy wants one real fictional eight-spread text book: Opus 5.5 plans and writes
from scratch, fresh-process Opus edits, Astra independently reads original/final
and compares. Approval covers one trial up to USD 12, no image/public deployment.
The third trial failed before planning. This successor is free transport repair,
not another paid attempt or a claim of an excellent story.

Worktree C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Branch codex/personal-book-storyboard-bridge. Base
36d9e85d63e9437d44fb1ca16f6e26ff030681ec; freeze the single successor SHA from
Codex's forwarding note, require its parent equal base. Codex sole writer;
Claude first pass read-only. Stop and reconcile if topology differs.

Before work: engine clean, cached ahead 3 / behind 0, origin 329c857e. Protected
d53b 768ccb2f and accepted-intent 63ccb484 clean. Site QA 5fe73b3f and Claude
site 87b0d196 (cached ahead 4) clean/unchanged; reviewer detached 36d9e85d clean.
No branch deletion or merges. Parent technical PASS cdf2ded9..36d9e85d stays
exact: it explicitly left provider acceptance open. The older cdf2ded9 closeout
and branch-wide acceptance are not inferred from that verdict.

## The approved third trial, not a successful book

Reference guy-text-calibration-20261004-03; source 36d9e85d; identical synthetic
Neta age four / Uri / eight-spread request as -02. Binary pinned SHA 6d5be51f;
subscription login valid before run. Official pricing checked 2026-10-04, unchanged
conservative rates. Combined allowances USD 11.59, reserved probe USD 0.225281 /
book USD 11.338803, not actual charge or a hidden-CLI invoice guarantee.

One real-TTY launcher execution: one received OpenAI probe response and one
Opus CLI invocation. Probe reports completed gpt-6-astra/default, 582 input /
72 output, estimate USD 0.010875. Plan native 1, api_error_status 400,
is_error true despite subtype success. Captured result:

    API Error: 400 tools.1.custom.input_schema: input_schema does not support oneOf, allOf, or anyOf at the top level

Raw Claude cost USD 0, zero tokens, empty modelUsage; accepted plan usage null.
Host correctly seals cli_termination; launcher exit 1/provider_or_contract_failed.
Native internal provider request count remains unverified. No completed Opus
model inference, synopsis, author, editor, literary readings, book viewer,
storyboard, images or narration. No retries or seal/approval reuse. Three captured
trial estimates total USD 0.032625, not invoice. No USD 12 charge is asserted.

Stem personal-calibration-51be01fee7249347bef4097a731b8fea, probe/book roots under
outputs/ and matching two journals under
C:/GNart/Work/Small_Heroes/.git/codex-causal-text-trials/.
Fourteen files total: manifests, probe result, reservations, claims, wires,
plan instructions, receipts and seals. Fresh immutable SHA/size baseline:
C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/single-book-calibration-20261004-approved-03/execution-closeout.json.
Earlier -01/-02 sibling baselines still cover 28 files, all unchanged. These
ignored local records have no verified remote backup; this doc inventories them,
it does not put their contents in Git.

## Tool preflight, measured boundaries

Before the trial, pinned CLI with fake API key, refusing loopback endpoint and
loopback proxy produced two local requests exposing only StructuredOutput.
Report in the -03 runtime: tool-preflight.json. Binary inspection finds a
conditional EndConversation safety exception, not a file/shell tool; it can
terminate and alter local session markers. The fake-key observation does NOT
identify the historical OAuth tools. Do not call --tools empty a no-capability
or zero-local-write guarantee; safe-mode also has managed-policy limitations.

After the fix, inspect-cli-envelope.cjs uses the ACTUAL -03 request, domain plan
schema, exact frozen failed instructions/input/path and corrected production
prepareCausalWire. Same pinned CLI/flags with fake key and a refusing loopback
server, proxies refuse external CONNECT. Two local requests: StructuredOutput's
schema is byte-identical to the prepared CLI argument, root object with required
result, no root combinators, two nested alternatives. Native 1 is the intended
mock refusal; no timeout, reported USD 0, zero provider model calls. It proves
actual local serialization, NOT Anthropic acceptance or OAuth equivalence.

## Root cause and general fix

The former fix added type object but retained root anyOf. The latest provider
rejection disproves its sufficiency, not the limited prior technical PASS.
The existing fake native model checked only root type, so it could not catch
the newly observed restriction. It now models both captured root failures,
not every Anthropic validation rule.

Private opusOutputContract exports the original schema. Plain object roots
without root combinators pass unchanged. Only a typeless nonempty anyOf whose
every branch explicitly is an object gets strict Zod {result: call.schema}.
The SDK regenerates JSON Schema and refs from that wrapper; no JSON/ref string
relocation. The transport parses the complete strict envelope and returns its
domain result. No unwrapped-output fallback. Every domain constraint, request
binding and selected/both_rejected choice still comes from original Zod.
Typed/mixed/scalar/empty/ref-only or otherwise unsupported roots fail before
process invocation. New literal-exporter tests pin the three prior P3-1 backup
clauses as well as oneOf/allOf denial, pending independent confirmation.

Architecture: transport-only envelope, no domain migration. Existing raw
receipts stay original and are not re-decoded. Wire bytes/digest/reservation
include the new argument; no cap or price increase. On the identical -03 wire,
bytes 39,071 to 41,227 and reserved microUSD 739,825 to 758,798: a conservative
18,973 microUSD estimate increment, not an invoice observation. Plain object and Astra
exports remain unchanged. Prompts, models, CLI flags, fresh-process separation,
timeout/budget/journal/key guards, coordinator, public wizard/site and visual
assets unchanged. Production changes only adapters.ts; other code is native spec.

## Codex checks and known limits

Exact six-spec focused command below: 289/289, native 64 (formerly 47), host 75,
calibration 59, workload 7, causal experiment 61, companion revision 23. No test
removed. Existing assertions updated only for the intentional union envelope;
references and byte accounting still checked. Twelve both-disposition native
round trips cover plan/replan at 8/12/16; five invalid domain outputs and five
malformed envelopes rejected. Existing plain-object/Astra guards remain.

Memory-only Vite controls: unmodified control passes; previous 36d9e85d adapter
fails all eighteen wire/decode regressions. Eleven broken variants caught:
no envelope, forced selected branch, loose envelope, bypassed decoding, missing
unwrap, rewritten ordinary objects, mixed union admitted, removed typed/empty/
ref guards and altered Astra. No production edit during controls; before/after
source hashes equal. Helpers and JSON reports: outputs/personal-opus-envelope-fix-20261004/.
Do not rerun wx helpers over existing reports during review.

Initial added literal tests hit ESM spy restrictions; corrected the test-only
mock factory. Initial tsc rejected an intentional malformed mock cast; corrected
the test cast. Initial focused command selected four files because two names
were wrong; the final EXACT command selected six files and 289 tests. None of
these is a successful live call. Production code stayed unchanged during final
controls/full gate.

Fresh npm run check completed in 386.721 seconds, observed cmd wrapper exit 1.
Both supervisor-observed lanes exit 1 with valid diagnostic protocols:
ordinary 392 files, 110,303ms, ten failures / 6,047 passed / 73 skipped; resource
20 files, 268,365ms, 635/635 plus THREE onTaskUpdate RPC errors. Ordinary failed
names all match the earlier operator-fix log; no new failing assertion, and all
64 native cases pass in full load. No fresh baseline run or timeout cause proof.
No source/spec edit or overlapping test run during full check. Final separate
npx tsc --noEmit exits 0. Tracked summary:
PERSONAL_OPUS_ENVELOPE_FULL_CHECK_20261004.json; raw local log and supervisor
summary in the new helper root. Older IPC-abort and Claude results preserved.

Paid preservation: independent disk enumeration agrees with the three baseline
lists, exactly 42 files in twelve roots, SHA/size all equal, each probe/book has
only its original claim/seal. New preservation-verification.json records this
and fingerprints the three baselines. No extra family, stage, provider or spend.

Nested union support, PL-1 8k author thinking capacity, actual stories and
literary quality remain empirically unmeasured. No independent PASS awarded by
Codex. Fresh full-check does not by itself establish release stability.

## Adversarial targets

1. Freeze parent/head and explicit paths. Verify no public/story/domain/cap change.
2. Reconstruct -03 provider failure from raw receipt/argv. Distinguish the paid
   rejection from free fake-CLI and real-CLI-loopback observations.
3. Attack selected/rejected at all lengths/stages, strict envelope, domain result
   field ambiguity, definitions/refs and both malformed-root/exporter guards.
4. Attack unchanged plain object/Astra bytes, request validation, exact model,
   output cap, fresh editor, accounting, cancel/deadline and no retry paths.
5. Recompute all 42 paid-file hashes from three baselines; independently enumerate
   all twelve roots and seals. Verify no later stage or extra family dispatch.
6. Run focused/negative controls read-only on detached immutable range. Evaluate
   full-gate evidence without calling local serialization provider acceptance.

No provider, key, paid retry, record mutation, seal reset, render, push, deployment
or product acceptance during first QA. A new trial needs a new priced explicit
Guy approval/reference after exact re-gate. Do not widen old approval implicitly.

## Copy-ready verification and later push

Focused successor is committed by Codex; no staging needed. Last command is for
AFTER independent re-gate and Guy's explicit push decision; it publishes every
local work-branch commit, not just the successor. No command below was pushed.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log --oneline origin/codex/personal-book-storyboard-bridge..HEAD
git diff --check 36d9e85d..HEAD
git show --stat --oneline HEAD
npx tsc --noEmit
npx vitest run lib/__tests__/personal-single-book-calibration.spec.ts lib/__tests__/personal-causal-trial-host.spec.ts lib/__tests__/personal-causal-trial-native.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts lib/personal-wizard/__tests__/story-causal-experiment.spec.ts lib/personal-wizard/__tests__/companion-character-revision.spec.ts
# Only after Guy's explicit push decision and re-gate:
git push origin HEAD:refs/heads/codex/personal-book-storyboard-bridge
```
