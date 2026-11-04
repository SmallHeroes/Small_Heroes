STATUS: M12 DECISION GATE DONE
HEAD: 348c85dc213f85597eb484d05e68e9048edb5603
Summary 1/5: Guy's20:20 continuation explicitly requests final M11 plus one cumulative final package against348c85dc.
Summary 2/5: M07-M11 patches/pins remain immutable milestone evidence; M12 is the final recovery/review source of truth.
Summary 3/5: Split local owner commits M07→M11 with nonoverlapping explicit paths; overlapping files belong to the last milestone that changed their final bytes.
Summary 4/5: Per-commit directNode tsc/focused gates inspect the complete pinned worktree; intermediate commit trees are not independently buildable snapshots.
Summary 5/5: Run one shared full npm check report-only; actual recovery is exercised only in InspectOnly and on a copied synthetic-command sandbox, with no real index/commit/push/merge/deploy/provider/service action.
Guy decisions: none to prepare this recovery. Existing paid/cap/environment/product/legal/launch decisions remain separate as listed in M11 FIRST-PAID-TEST.md.

Observed: every previous milestone is cumulative because HEAD stayed348c85dc while source progressed. Running the old individual recoveries sequentially would encounter obsolete working pins and later-edited shared paths.
Expected: one final source pin set and cumulative patch, plus a deterministic five-commit allocation and operator script that checks all final bytes and stages only the named files for each group.
Solution: derive last-changed ownership by comparing milestone file pins; never assign an unchanged cumulative copy to a later owner. Preserve immutable old packages. Validate allocation coverage/disjointness, patch reverse applicability, PowerShell syntax, TypeScript/focused tests, and full-contract diagnostic record. Each commit rechecks every final pin, directNode gates, and staged paths; no extra user file is staged. A new/overlapping final-handoff document is assigned to M11.
Limit: later shared modules remain uncommitted while earlier groups are committed; the full verified worktree supplies their dependencies. The intermediate Git trees alone are not promised green. The final348c85dc..last-commit range is the independent QA boundary. This is the explicit consequence of the requested final-path allocation, not a hidden historical reconstruction.
Stop-check: package-only continuation is explicitly authorized. USD0, synthetic only, no environment secrets or external application operations, no change to LOW/59ILS/0.70/default-off flags. No extra product decision or approval is required to finish these files.
