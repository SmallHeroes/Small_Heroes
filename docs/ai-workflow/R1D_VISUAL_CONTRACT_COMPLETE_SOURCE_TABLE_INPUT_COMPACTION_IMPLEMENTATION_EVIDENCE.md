# R1D Visual Contract complete-source-table input compaction — implementation evidence

## Trigger and root cause

The first canonical Leo readiness preparation stopped before credential or
provider reachability. Its B0 materializer rebuilt a valid 12-page Story Source
snapshot, then rejected the live request with `input_token_ceiling_exceeded`.
The conservative bound was 69,670 against the unchanged 64,000 ceiling.

Measured Leo prompt bytes before correction:

- system prompt: 7,915
- user prompt: 44,184
- strict schema: 13,473
- protocol allowance: 4,096
- total: 69,668/69,670 depending on request framing measurement
- source-evidence table inside the user prompt: 26,312
- duplicated full-story block: 9,645
- advisory image directions: 6,171

The catalog already carried every exact non-whitespace prose span in canonical
page/ordinal order, so the second page-marked full-story copy was redundant.

## Implementation

- Initial authoring now presents the complete Story Source once as compact JSON
  tuples: `pageNumber`, exact `sourceEvidenceId`, exact `excerpt`.
- Tuple order remains canonical catalog order. Every page reconstructs to the
  exact source after whitespace normalization.
- Compiler-owned ordinals and UTF offsets remain in the persisted catalog and
  are not altered. The full-draft repair serializer remains unchanged.
- Initial user-prompt authority advances to
  `vc-template-user-prompt/v13`; the initial system prompt and every repair
  prompt version remain unchanged.
- No story, draft schema, model, service tier, token/call/cost budget, timeout,
  retry, fallback, candidate or downstream behavior changed.

## Validation

Focused command:

```text
npx vitest run lib/__tests__/visual-contract-prompt-table-compaction.spec.ts lib/visual-package/__tests__/live-request-materialization.spec.ts lib/visual-package/__tests__/source-authority-lifecycle.spec.ts
```

Result: **3 files / 107 tests PASS**.

The proof covers:

- exact Source Evidence and Action Semantic table round trips;
- complete Story Source reconstruction from the initial tuples;
- absence of the second `FULL STORY TEXT` block;
- all 12 new 8/12-page QA stories under 64K, including Leo;
- all 18 historical approved Story Sources under 64K;
- old prompt authority rejection after canonical re-digest;
- a synthetic genuinely oversized source stopped before provider reachability;
- B0 materialization and source-authority lifecycle bindings.

`npx --no-install tsc --noEmit` and `git diff --check` both pass.

## Preserved failure and boundaries

The failed readiness output remains immutable under
`outputs/r1d-leo-adventure-three-page-proof-20260815-spotlightlion1` with
failure digest
`f370d2f389242165148da538f688d69071075dce35a6cb2ba434c697aaa49c13`.
It had `credentialAccess:none`, `providerCalls:0`, `canonicalPreflight:not_run`
and `liveAuthority:none`.

The correction itself accessed no credential and made no provider/image/audio,
payment, storage, Production deployment or publication action. A new pushed
HEAD, new output root and new request identity are required before another
canonical readiness attempt.
