# Portable historical regression inputs

These 14 text/JSON files are byte-for-byte snapshots, not newly approved story
or rendering artifacts. `provenance.json` records original local source locations,
sizes and SHA-256 values. Source locations are documentation only: tests never
read them and have no fallback to another worktree or ignored dated output.

- `lexicon`: the original revised Slot 1 story (6917 bytes).
- `momentum`: the original three Koko stop-2 inputs (20487 bytes).
- `read-back`: the original complete Dini pages and Markdown (15440 bytes).
- `enrichment`: the original seven visual-direction candidate/request inputs
  (31039 bytes). Lifecycle tests copy these into a unique temporary repository
  under the original logical `outputs/r1d-chameleon-first-kindergarten-visual-directions-v1`
  location. This preserves all request paths and hash-bound authority fields.
- `placement`: the original d963 contract projection (81574 bytes), retaining
  the existing Board definition, prompt and reservation golden assertions.

The source checkouts observed during import were `Small_Heroes` at `90364542`,
`sh-wt-r1d-output-budget` at `be2d7e44`, and `sh-order-package-authority` at
`a3f6491a`. Their original outputs were read only. The 155457 imported bytes are
checked by the existing child-lexicon spec; scoped Git attributes disable text
conversion, preserving LF and the original absence of final newlines in four
JSON files even when `core.autocrlf=true`.

The two original `lexicon/story.md` and `read-back/story.md` snapshots also retain
their trailing spaces (mostly Markdown hard breaks, plus two single spaces in
read-back metadata). Only these two paths disable Git's `blank-at-eol` warning;
all other whitespace checks remain. Their full-byte SHA-256 assertions, including
whitespace, are stricter than a formatting rewrite and must not be updated to
make a changed snapshot pass.

The page-entity transport test generates a tiny deterministic 16x16 PNG using
the already-installed Sharp encoder in its own temporary directory. It checks
the original data-URL prefix/length requirements plus decoded-byte equality
and valid PNG metadata. No provider call or historical rendered image is needed.

Nothing here grants product acceptance, publication, Blueprint, runtime package,
provider, spend or render authority. Synthetic approval records remain confined
to test-owned temporary roots, exactly as in the existing lifecycle tests.
