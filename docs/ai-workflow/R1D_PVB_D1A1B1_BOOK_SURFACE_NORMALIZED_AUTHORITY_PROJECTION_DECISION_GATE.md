# R1D-PVB-D1A1B1 — Book-Surface Normalized Authority Projection Decision Gate

## Observed failure

The bounded Leo v15 attempt completed three provider calls and two repairs but
produced no candidate. The first repair resolved all twelve page reference
issues. The second validation pass contained seven page-local presentation
capability gaps together with one cover and twelve page final-structure
issues. Although that set is the intended `book_surface_patch` family, the
authority selector returned null and routed the final call to `full_draft`.
That call resolved all seven presentation gaps but left the thirteen
book-surface issues persistent, exhausting the repair budget.

The implementation and fake-provider tests revealed the mismatch: final
validation runs on the compiler-normalized template, while book-surface cover
and reference authority was derived from the raw provider draft. A raw cast or
topology value that the compiler correctly drops or canonicalizes can make
raw-draft authority ambiguous even though the exact normalized authority used
by the validator is available.

## Nine approved decisions

1. Keep `book_surface_patch` closed to the existing presentation plus
   cover/page final-structure family; do not admit a new issue family.
2. Carry the compiler-normalized template projection only inside the typed
   `PresentationStructuralValidationError` that produced the mixed failure;
   require it explicitly at every authority-selector call site.
3. Derive only cover input and closed reference authority from that normalized
   projection.
4. Continue deriving affected page numbers, repair targets, validation hints
   and original page bodies from the provider draft.
5. Apply the returned patch to the original provider draft, not to the
   normalized projection; masked non-target equality and input nonmutation
   remain mandatory.
6. Preserve the strict `BookSurfaceRepairPatch` schema, exact output keys,
   page-set completeness, reference guards and all tamper rejection.
7. Keep model, service tier, 64K/36K ceilings, three-call/two-repair budget,
   timeout, transport retries, fallback policy and `$4.884/$5.00` ceilings
   unchanged.
8. Add direct and end-to-end fake-provider regressions proving raw-authority
   ambiguity no longer forces `full_draft`, while direct raw selection still
   fails closed without compiler-normalized authority.
9. Treat the prior receipt/readiness as immutable exhausted evidence. A new
   attempt requires a new pushed HEAD, Fresh Readiness and Execution Request;
   schema and prompt versions do not change because their public contracts are
   byte-identical.

## Acceptance and rollback

- The policy-correct focused compiler/lifecycle/Supervisor set passes with no
  timeout or RPC/IPC failure.
- TypeScript and `git diff --check` pass.
- No story, child, companion, page or authored ID literal is introduced.
- No prompt text, provider schema, budget, downstream behavior or Production
  surface changes.
- Reverting the focused correction restores the former raw-draft authority
  selection. All historical artifacts remain immutable either way.

Independent Claude Code review must try to falsify the authority split,
non-target preservation, closed eligibility and unchanged lifecycle surface.
