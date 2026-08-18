# R1D — Four-standard-call / $10 authoring policy implementation evidence

Status: local implementation green; commit and push pending.

## Cause and correction

The consumed Dini run completed three valid provider calls. Its final compact
repair exposed two later validation-frontier issues after the standard budget
was exhausted. The approved correction generalizes the bounded scheduler to
four standard calls / three repairs, with the exact 12-page output schedule
`[40000, 32000, 36000, 36000]` and a hard USD 10 fence. The existing
reference-only cleanup remains the only possible fifth call.

The canonical request decoder now accepts and copies all four schedule entries.
Every persisted and execution authority advances together. Immediate authoring
request/receipt/readiness predecessors remain legacy immutable.

## Preserved behavior

- Provider `openai`, endpoint `responses`, model `gpt-5.6-sol`, default tier
  and medium reasoning are unchanged.
- The 64K input ceiling, timeout, zero transport retries, no-fallback rule,
  tools-disabled rule, prompts and structured-output schemas are unchanged.
- The optional fifth call is still limited to the exact reference-only residual
  after an eligible BookSurface/full-draft predecessor.
- Candidate v9, child-output authority v1, Wizard bridge v2, render policy and
  all atomic/full validation gates are unchanged.
- No story-, child-, companion- or page-specific production branch was added.

## Version cutover

- authoring policy v14; standard output-budget v3
- authoring request/receipt/readiness v38/v42/v40
- B0 input/manifest/verification v27/v36/v36
- execution materialization input/result v26/v30
- Supervisor request/readiness/result v35/v35/v28
- Fresh Readiness v35

## Validation

- Compiler repair loop + lifecycle: 131/131 PASS.
- Canonical boundary: 166/166 PASS.
- Combined compiler/lifecycle/materialization/Fresh/Supervisor/Wizard suite:
  11 files, 515/515 PASS.
- Adjacent typed-diagnostics/reference-domain/S2b correction suite: 3 files,
  80/80 PASS.
- `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.
- Literal `npm run check` ran exactly once. Resource-intensive passed 20 files,
  606/606 assertions. Ordinary passed 3,258, skipped 65 and reported 16 failed
  assertions: 11 policy-expectation assertions corrected and re-run green in
  the focused 80/80 suite, plus the separate established five missing
  ignored-output fixtures. No protocol, timeout, launch or infrastructure
  failure occurred.

No credential, provider, Fresh, live, image, render, storage/database,
deployment or production action occurred during implementation.
