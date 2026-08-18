# R1D — Four-standard-call / $10 authoring policy Decision Gate

Status: approved by Guy on 2026-08-18.

## Product goal

Reach a valid new-story Visual Contract Candidate, connect it to the QA Wizard,
and render a LOW full book today without bypassing validation or Candidate
authority.

## Observed behavior

The canonical Dini attempt at pushed HEAD `a21073bd` completed all three
standard provider calls. BookSurface reduced 25 typed issues to one spatial
reference issue. The compact spatial repair resolved that issue, and full
validation then exposed two previously masked semantic/source-evidence issues.
No Candidate was written because the three-call standard budget was exhausted.
This was not a provider, transport, schema, output-cap, or BookSurface
application failure.

## Decision

1. Raise the hard authoring cost ceiling from USD 5 to USD 10.
2. Permit four standard calls / three standard repairs.
3. For a 12-page story use exact standard output caps
   `[40000, 32000, 36000, 36000]`.
4. Preserve the existing optional compact terminal-reference cleanup as the
   only possible fifth call.
5. Preserve provider, model, tier, reasoning, input ceiling, timeout, retry,
   fallback, tools, schemas, prompts, Candidate semantics, and all validation
   boundaries.
6. Run only one canonical live attempt per fresh request; a failed attempt is
   never retried in place.
7. Render only after a validated Candidate is bridged, approved, and advanced.
   The authorized render is QA/non-production `gpt-image-2` LOW, never HIGH.

## Cost bound

At 12 pages the four standard calls reserve 64K input each and output caps
`40K + 32K + 36K + 36K`. Including the existing 12K-input/1K-output terminal
reference cleanup and the 1.1 uplift, the conservative projected maximum is
exactly USD 6.6275, below the new USD 10 hard fence. Runtime still stops before any
call whose reserved exposure would exceed the bound.

## Generality and exclusions

This changes the bounded scheduler, not Dini-specific content. It does not
weaken diagnostics, repair eligibility, atomic application, full validation,
or promotion gates. It does not authorize production deployment, HIGH image
generation, payment behavior changes, or rendering without Candidate/Wizard
authority.

## Acceptance criteria

- Policy and persisted authority versions advance; immediate predecessors are
  immutable legacy evidence where the repository supports legacy status.
- Exact 4/3 standard budget, 5/4 absolute budget and ordered output schedule
  validate across request, receipt, readiness, materialization, Supervisor and
  Fresh Readiness.
- A regression proves a draft can converge on standard call four and no sixth
  call exists.
- Existing compact fifth-call cleanup remains closed to its exact reference
  residual/predecessor rules.
- Focused suites, TypeScript, diff-check and the literal repository gate pass
  before commit/push and Fresh Readiness.
