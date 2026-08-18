# R1D compiler-owned invalid cover cast normalization — Decision Gate

**Status:** approved under Guy's 2026-08-18 standing instruction to complete the new-story Wizard path and render when valid authority exists.

## Evidence and root cause

The sole v10 run under
`outputs/r1d-cover-v10-fresh-d2249bd8-20260818T130414687Z` ended fail-closed
after two completed calls. Receipt v41
`044e4da5f84848ae4b642eec9ed52702ee121bd979e7899e7a0328c601cd0cdb`
records `initial -> book_surface_patch` and exact terminal identity
`book_surface_repair_cover_reference_invalid`. No Candidate exists and this
root will not be replayed.

Topology assembly already derives the cover location from its resolved zone and
applies any authored page-0 authority. Cover cast selection is also
fact-authoritative, but the compiler currently proposes first-page cast IDs only
when the draft list is missing or empty. A present list with duplicate,
malformed or unknown IDs survives into validation and asks BookSurface to repair
compiler-owned identity.

## Decision

1. Treat a present cover cast list as usable only when it is nonempty, unique,
   string-only and every ID belongs to the compiler's authoritative cast.
2. Preserve such a valid list byte-for-byte.
3. Otherwise replace it deterministically with the valid ordered cast IDs of the
   fact-authoritative first page; if that is empty, use the authoritative child
   ID.
4. Do not infer a person from prose, provider output or display names. Authored
   page-0 authority continues to win before this validation and must itself be
   valid.
5. Keep BookSurface v6/v10/v10 and the full current authority ladder unchanged.
   This is compiler-internal normalization of an already-declared
   fact-authoritative field; Git HEAD and artifact digests provide the cutover.
6. Calls, repair budgets, model/tier/reasoning, retry/fallback, hard `$5`,
   Candidate v9, Wizard and renderer remain unchanged.

## Required proof

- missing, duplicate, malformed and unknown cover cast lists normalize to the
  exact first-page fact cast;
- a valid current cover list remains unchanged;
- compiler notes expose the normalization without raw provider content;
- the existing BookSurface cover fallback remains fail-closed for forged direct
  authorities;
- focused compiler/BookSurface/lifecycle, TypeScript and diff-check pass before
  commit/push;
- a new Fresh package and one live invocation only.
