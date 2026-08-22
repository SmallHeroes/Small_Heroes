# Chameleon gender-correct Story Source revision — implementation evidence

**Date:** 2026-08-22

**Branch:** `codex/qa-wizard-presentation-dispositions`

**Decision Gate:** `BAR_QA_WIZARD_BOOK_RECOVERY_DECISION_GATE.md`

**Milestone:** zero-spend pending source/direction revision only

## Outcome

The historical Chameleon accepted source, storyboard input, QA Story Bank,
approved Visual Package and current locator remain unchanged. A new general
operator tool prepares a content-addressed pending revision beneath `outputs/`.
It has no approval, publication, package, locator, provider, database, storage,
deployment or render capability.

The tool validates all inputs before writing:

1. exact request and replacement shapes;
2. canonical repository-relative paths and SHA-256 bindings;
3. accepted manifest/story/brief/page-count authority;
4. exact replacement counts with overlap/cascade rejection;
5. canonical editorial-pass validation of the revised source;
6. byte-identical female projection against the historical source;
7. complete boy/girl gender projection using behavior tested against the
   production personalization resolver;
8. explicit page/field-only visual-direction changes and the existing
   visual-direction validator;
9. exact source projection after deterministic `injectDirections` assembly;
10. fresh, non-symlink output below `outputs/`.

`--write false` performs the complete derivation without creating the output
directory. `--write true` writes five digest-named files only after every check
passes. A partial/crashed output cannot be reused because the next invocation
requires a fresh directory.

## Real Chameleon input authority

- accepted manifest:
  `story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/manifest.json`
  - bytes `1642`
  - SHA-256 `32b3d0b7777839d874dc412c7c84a0cb8744512372791d51b2cd6b66d3cec4dd`
- accepted story:
  `story-pipeline/04_approved_story_sources/accepted/chameleon_koko_bedtime/story.md`
  - bytes `5976`
  - SHA-256 `49d2866ee4cdef5ea5155c87f7769f6c653ba224ff4b5ec490a039dfd632a76d`
- visual directions:
  `story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/chameleon_koko_bedtime.visual-directions.json`
  - bytes `5670`
  - SHA-256 `9656e61abb35cdcf9dbffa9e0ace5bc5996714f9f36d581d881173977c523070`

The request is local, unapproved operator input:

- `outputs/r1d-chameleon-gender-revision-request.json`
- bytes `3643`
- SHA-256 `325bee8f02a8995c6250a09ff2b12429e2cbd417270a52207eaca92b8f0f7704`

## Exact pending outputs

Pending root:
`outputs/r1d-chameleon-gender-revision-pending`

- manifest digest:
  `102153975198f49514b3304893904c77eb5e341d0ba6e7e906e917cf0ed6183e`
- corrected accepted Story Source:
  - bytes `6220`
  - SHA-256 `6da0babf1d7e97a0841d1c414e15bd682a525d8ab0366df49def7247079dd407`
- corrected visual directions:
  - bytes `5684`
  - SHA-256 `a3b9483889c56caf0698eac87e62f89978e589f377c3a0ca5299a3d5075e3d29`
- corrected integrated Story Source:
  - bytes `9641`
  - SHA-256 `ac1d0693f327b04ccbf7e2208460b70ca5c26159f9e4f3193bc0153b8ab2f310`
- deterministic direction-migration payload digest:
  `e36e00f7727402d396c53595f9a14fb16d98cd694b426277a4db12d0fb127ff3`
- female source projection:
  - byte-identical to historical female projection
  - SHA-256 `dc614739573e0637510ebda887f4ec98f43d5b20b5e35e9eb5b1f6b487929ab8`
- male source projection:
  - SHA-256 `c0fca7240a668445c0ad68acc4c58e3eb55f6bb89b079abc76b2a40597f79e7a`

Only two English visual-direction fragments changed, both child-neutral:

- page 6 `with her backpack` → `with the child's backpack`;
- page 8 `Kim curled beside her` → `Kim curled beside the child`.

Page 4's `Kim closes her eyes` remains unchanged because the pronoun refers to
Kim, not the child.

## Code and tests

- `scripts/materialize-story-source-revision.cjs`
- `lib/__tests__/story-source-revision-materializer.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `CURRENT.md`
- this evidence document

Focused validation:

```text
story-source-revision-materializer.spec.ts      6/6 PASS
story-commission-materializer.spec.ts          31/31 PASS
story-bank-personalization-gate.spec.ts         18/18 PASS
vitest-workload-classifier.spec.ts               7/7 PASS
total                                            62/62 PASS
```

Also required before commit:

- `npx --no-install tsc --noEmit` — PASS;
- `git diff --check` — PASS;
- literal `npm run check` compiled both TypeScript projects. The ordinary
  partition passed **3,448** assertions and retained exactly the five known
  failures caused by four absent historical `outputs/` fixtures. The resource
  partition passed **610/610** assertions and exited nonzero only because of
  the three established Vitest worker `onTaskUpdate` RPC timeouts. No new
  assertion failed.

## Explicit limitations and next gate

This milestone does not make the revision accepted or render-qualified. The
next authorized actions are independent read-only QA and exact product review.
Promotion requires Guy to approve the exact Story Source and editorial-review
digests. After promotion, the new source must traverse fresh Visual Contract,
reconciliation, Blueprint and Visual Package lifecycles with their own exact
approvals. Only a pushed, identifiable Preview deployment whose zero-spend
runtime-authority preflight passes may precede another paid Wizard order.

The earlier full Bar order remains held legacy evidence. It must not be retried,
rebound or presented as proof of the new engine.
