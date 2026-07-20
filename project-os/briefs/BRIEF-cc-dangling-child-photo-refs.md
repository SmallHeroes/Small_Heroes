# BRIEF (CC) — the dangling-reference pass is object-driven and never runs (Finding 2 is not remediated)

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). HEAD `f3cb2243`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, no force-push. No [CODEX-GATE].
- Commit locally; **Guy pushes and runs the remediation.**

## 2. SCOPE (what + why now)
**The object remediation is verified correct — do not change it.** Live staging run: 15 → **11** real photos (4/4 residue deleted), **48 character-anchors untouched**, 3 references cleared. Exactly as predicted.

**But the run reported `0 dangling references cleared`, and 2 are still there.** Verified after the run: 2 orders at `failed` + `job.retryable=false` still hold a `childImageUrl`, and 17 orders in total still hold one.

**Root cause: the remediation is driven by the storage listing.** It enumerates objects and clears the reference on each object's owning order. An order whose object was **already deleted** has no object to enumerate, so it is never visited — and those are precisely the dangling references Finding 2 is about. The dangling pass can never fire for the rows it was written for.

**Why this matters far more on production than on staging:** production holds **118 orders with a `childImageUrl`**, and Cowork verified independently that **none of them reference any of the 14 surviving objects**. So on production the object pass will clear **zero** references, leaving 118 stored URLs naming a child's photograph. Finding 2 would be entirely unremediated.

**Required fix — a second, order-driven pass**, independent of the storage listing:
1. Query orders that hold a child-photo reference: `Order.childImageUrl`, plus the nested `characterAnchors._privacy.originalChildPhotoUrl` and `child.sourceImageUrl`.
2. Classify the **owning order** with the existing retryable-aware rule — `draft`/`pending_payment`/`paid`/`generating`/`needs_human_qa` and `failed`+`retryable=true` are **KEEP**; `ready`/`partial`/`failed`+`retryable=false` are residue.
3. For residue orders, clear the reference fields **whether or not the object still exists**. Where the object does exist, the existing object-first ordering still applies (delete the object, then clear); where it does not, clear the field directly.
4. Report the two passes separately: objects remediated, and references cleared (with a dangling sub-count) — so a zero in one is visible rather than silent.

**Also (small, but it bit us):** `--delete-residue` supplied **without** `--i-understand-this-deletes-production-objects` silently falls back to REPORT and prints "nothing changed". A destructive tool that quietly ignores a destructive flag trains the wrong habit — **make it exit non-zero with an explicit message** instead. And the acknowledgement flag says `production-objects` while we routinely run it against staging; rename it so the words still mean something on the day it really is production (e.g. `--i-understand-this-deletes-objects`, with the environment host printed in the confirmation line as it already is).

## 3. FILES / AREAS
`scripts/audit-child-photos.ts` (the order-driven pass + flag handling) · `lib/child-photo-audit.ts` (reuse the existing retryable-aware classifier — do not fork the logic).

## 4. ACCEPTANCE CRITERIA
- A residue order's reference is cleared even when its storage object no longer exists.
- Re-running the report on staging after remediation shows **0** orders at `ready`/`partial`/`failed`+`retryable=false` still holding a child-photo reference (currently 2).
- KEEP orders retain their references — a `failed`+`retryable=true` or renderable order is never cleared.
- The two passes are reported separately with explicit counts.
- `--delete-residue` without the acknowledgement exits non-zero with a clear message; the acknowledgement flag no longer claims "production" when the target is not production.
- Read-only by default; character-anchors never touched; `npm run check` green.

## 5. TESTS
- An order whose object is already gone and whose status is residue → its reference is cleared.
- An order whose object is gone but which is `failed`+`retryable=true` → **not** cleared.
- A residue order whose object still exists → object deleted first, then reference cleared; a delete failure aborts before the field is touched.
- The nested `characterAnchors` fields are scrubbed, not just `childImageUrl`.
- Missing acknowledgement → non-zero exit, nothing changed.

## 6. WHAT NOT TO TOUCH
The object-remediation pass (verified correct) · the retryable-aware classifier · character-anchors · the write/read flip (Unit 1b) · Unit 2's held RLS migration · delivery, money, hold decisions, the frozen legacy path.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit locally; **Guy pushes**. Run nothing destructive against any environment.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the order-driven query, the two-pass report format, and the flag behaviour. Then STOP — Guy re-runs staging (expect the 2 remaining references cleared) before production.
