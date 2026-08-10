# R1D-PVB-D1A1B1 Structural-Bundle Repair Input Compaction — Decision Gate

Date: 2026-08-10

Exact base: `b3b38710b65b538ccad24d1f97bffe8ae0ba64e0`

## Observed behavior and root cause

The consumed live attempt completed an initial provider response and one `page_spatial_reference_patch`. That repair resolved all four original out-of-scope references. Complete validation then exposed the closed structural-bundle family: one recurring-props collection identity plus twelve page final-structure identities. The planned third call was correctly selected as `structural_bundle_patch` but was rejected locally as `input_token_ceiling_exceeded` before provider reachability.

The structural-bundle output schema, exact-set application and full revalidation are already correct. The provider-facing input still serializes recurring props, complete affected pages, validation messages and reference authority as repeated-key JSON. The page-contract repair path already has a deterministic, lossless canonical JSON-domain codec that removes repeated object keys and repeated strings while proving an exact local roundtrip.

## Nine architectural decisions

1. Keep the existing closed structural-bundle eligibility, output schema v1, exact prop/page sets, clone/application boundary and complete revalidation unchanged.
2. Reuse the repository-owned lossless canonical repair-input codec for the structural-bundle provider input; do not omit, summarize or infer any authority value.
3. The decoded root remains exactly `recurringProps`, `affectedPages`, `validationMessages` and `referenceAuthority`; extra/missing keys or malformed encoding fail closed locally.
4. Prompt construction must decode its own encoded payload and prove canonical equality before returning bytes. Encoding or roundtrip failure stops before provider reachability.
5. Advance only structural-bundle system/user prompt authority from v1 to v2. The structured-output schema and response parser remain v1.
6. Preserve deterministic ordering, exact IDs/page numbers, validation-message sanitation, reference-domain projection, non-target containment and raw-material exclusions.
7. Prove the twelve-page current-policy route fits the unchanged 64,000 input ceiling with at least 4,096 conservative units of headroom.
8. B0, Execution Request, verifier, Supervisor and Fresh Readiness bind the new prompt versions/digests on rematerialization. Historical artifacts remain immutable and non-authorizing.
9. Model, Responses/default tier, reasoning, 64K/36K token ceilings, one initial plus at most two repairs, timeout, zero transport retries, no fallback, candidate semantics, Blueprint/Wizard/render behavior and `$4.884/$5.00` ceilings remain unchanged.

## Acceptance and rollback

Direct codec/prompt tests must prove deterministic key-order-invariant bytes, lossless decode, strict tamper rejection and no secret/provider/source leakage. Compiler and lifecycle tests must prove the three-call fake-provider route for one spatial repair followed by a twelve-page structural bundle, then a valid candidate. Canonical authority tests, TypeScript, `git diff --check` and the repository gate must remain green apart from the six established ignored-fixture release HOLDs.

Rollback is a focused revert of this milestone. It restores structural prompt v1 and the pre-provider 64K rejection without mutating historical evidence. Production remains blocked; the smallest downstream proof remains one local Wizard-connected `gpt-image-2` LOW portrait page.
