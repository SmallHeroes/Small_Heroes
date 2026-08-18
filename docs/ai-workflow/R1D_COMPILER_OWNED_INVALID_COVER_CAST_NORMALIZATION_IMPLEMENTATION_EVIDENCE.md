# R1D compiler-owned invalid cover cast normalization — implementation evidence

**Date:** 2026-08-18

**Branch:** `codex/r1d-book-surface-typed-hint-compaction-render-unblock`

**Worktree:** `C:\GNart\Work\sh-wt-r1d-output-budget`

**Base:** `d2249bd8ff4acbbfe16dcb64bc482d4862b45bda`

## Consumed evidence

The sole canonical v10 attempt at
`outputs/r1d-cover-v10-fresh-d2249bd8-20260818T130414687Z` is terminal and
will not be replayed. Supervisor v27 returned `child_failed` solely because the
canonical child exited 1; credential source access succeeded and was cleared,
stderr is empty and output authority is null.

Receipt v41
`044e4da5f84848ae4b642eec9ed52702ee121bd979e7899e7a0328c601cd0cdb`
records two completed calls, one repair, zero retry/fallback and route
`initial -> book_surface_patch`. The BookSurface response was rejected with
exact sanitized identity `book_surface_repair_cover_reference_invalid`.
Candidate and reconciliation are absent.

## Implemented contract

Compiler assembly now validates any present `coverContract.castIds` against the
same authoritative cast used for the final template. A list is preserved only
when it is nonempty, string-only, unique and every ID belongs to that authority.
Any missing, empty, malformed, duplicate or unknown list is replaced with the
ordered cast IDs of the first page after deterministic fact overlay. If the
first page has no cast IDs, the fixed authoritative child ID is used.

This removes provider authority over cover identity while preserving creative
cover semantics. Existing authored page-0 authority is applied first and must
remain valid. Location/zone topology, presentation, lifecycle, action binding,
stale authority, non-target drift and final validation guards are unchanged.

No schema, prompt, policy or artifact shape changed. BookSurface remains
v6/v10/v10; authoring remains v37/v41/v39; B0 v26/v35/v35; execution
materialization v25/v29; Supervisor v34/v34/v27; Fresh v34; Candidate v9.
Git HEAD and canonical content digests provide the cutover.

## Validation

- text-first compiler + BookSurface + repair loop + source-authority lifecycle:
  4 files, 192/192 PASS;
- direct cases cover unknown, duplicate and malformed present cover cast lists,
  plus preservation of a valid list;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

No credential, provider, network, Fresh, live authoring, image generation,
storage/database, deployment or render action occurred during implementation.
This is implementation evidence, not independent QA or product acceptance.
