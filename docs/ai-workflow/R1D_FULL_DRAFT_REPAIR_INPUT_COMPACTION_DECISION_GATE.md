# R1D — Full-Draft Repair Input Compaction — Decision Gate

## 1. Proposed change

Encode the existing full-draft repair input with the repository's canonical,
lossless dictionary codec before it is passed to the provider. The provider
still returns the same complete Visual Contract draft under the same strict
schema. No authority value is omitted, summarized, or rewritten.

## 2. Why now?

The exhausted Leo QA attempt reached the newly repaired mixed-validation route:
the initial authoring call and compact page repair both completed, and the
compiler correctly selected `full_draft` for the final bounded repair. Provider
admission then rejected that repair at the unchanged 64,000-token conservative
input ceiling. The receipt recorded `input_limit_violation /
input_token_ceiling_exceeded`, two completed logical provider calls, one repair,
zero transport retries and no fallback. No candidate or render authority was
produced.

## 3. Scope

This is a general system change for every Story Source. It changes only the
provider-facing serialization of the already-authorized full-draft repair
input and the prompt-authority versions that bind it.

## 4. Risk of hardcoding

No story, child, companion, page, error phrase, or provider output is selected
or special-cased. The payload is derived from the same compiler inputs and
validation errors as today. The codec operates only on arbitrary JSON-domain
values and is already used by the compact page-repair paths.

## 5. Files likely affected

- `lib/visual-contract-compiler/compileBookVisualContractTemplate.ts`
- existing compiler/lifecycle/materialization tests
- `CURRENT.md`
- implementation evidence under `docs/ai-workflow/`

## 6. Nine architectural decisions

1. Reuse `encodePageContractRepairInput` and its strict decoder rather than
   introduce a second compression format.
2. Compaction is lossless: the compiler must decode the emitted envelope and
   compare canonical JSON before provider reachability.
3. The decoded root has a closed exact-key shape: story identity, page count,
   exact validation errors, deterministic human facts, authored cover
   authority or `null`, relevant same-page Source Evidence entries, and the
   complete previous draft.
4. The repair output remains the same complete draft and the existing
   `TEMPLATE_DRAFT_JSON_SCHEMA`; candidate semantics and validation are
   unchanged.
5. Preserve the model, service tier, 64K ceiling, output/call/repair/cost
   budgets, timeout, transport retries and no-fallback policy exactly.
6. Cut over the full-draft repair system/user prompt authorities to new
   versions. Historical receipts and readiness artifacts remain immutable and
   cannot authorize a future attempt.
7. Tests must prove lossless round-trip, exact-key/tamper rejection, canonical
   key-order invariance, meaningful size reduction on a repeated large draft,
   current lifecycle bindings, and unchanged strict output validation.
8. Rollback is a focused revert of the compaction commit. A future live attempt
   would then require newly materialized readiness; no old artifact is edited.
9. Implementation and validation are zero-cost. Fresh Readiness and a new
   bounded live attempt occur only after independent technical QA.

## 7. Expected behavior and acceptance criteria

- A full-draft repair receives every value it received before, reconstructed
  exactly from the compact envelope.
- The representative large repair input remains below the unchanged 64K
  conservative admission ceiling with explicit headroom.
- Malformed, non-canonical, incomplete, extra-key, or otherwise non-lossless
  encoded input fails closed locally.
- The initial call and all compact repair lanes are unchanged.
- Focused tests, TypeScript, `git diff --check`, and the repository gate produce
  no new failure beyond the separate six known ignored-fixture HOLD.

## 8. Cost impact

Implementation and tests cost `$0`. No credential access, provider call, image,
audio, or render is authorized by this gate. The eventual authoring policy
still has one initial call, at most two repairs, and the existing hard `$5`
ceiling.

## 9. Rollback plan

Revert the focused code/tests commit, retain the evidence record, and
rematerialize Fresh Readiness before any later live attempt. Never rewrite
historical output roots.

## 10. Review assignment

Claude Code must falsify losslessness, closed-shape validation, actual admission
headroom, version/digest propagation, unchanged budgets and schemas, historical
artifact immutability, and the absence of story-specific logic.

## 11. Do not do

Do not change prompts beyond the compact-input protocol, output schemas, model,
service tier, 64K ceiling, budgets, timeout, retries, fallback, candidate
semantics, Story Source content, credentials, providers, rendering, storage,
Production, or deployment during implementation.
