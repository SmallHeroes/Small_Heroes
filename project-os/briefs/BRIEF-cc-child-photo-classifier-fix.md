# BRIEF (CC) — child-photo audit: the in-flight classifier is wrong, and there is a second exposure

## 1. ROUTING + TARGET BRANCH
- **Executor:** CC. **Target branch:** `feat/chunked-generation` (worktree `sh-wt-style01`). HEAD `fd5100d8`. ONE agent in this worktree.
- **FORWARD FIX ONLY** — no amend, no rebase, no force-push.
- **Gate:** no [CODEX-GATE] — this is audit/remediation logic, not delivery or money. Commit locally; **Guy pushes and runs the remediation.**

## 2. SCOPE (what + why now)
The audit ran read-only on staging and its **matcher is correct** — it reported 15 real child photos, matching Cowork's independent SQL count exactly. The **classifier**, however, is wrong in the direction that neutralises the whole remediation.

**Verified against both live databases:**

| status | STAGING orders / still hold photo URL | PROD orders / still hold photo URL |
|---|---|---|
| `ready` | 7 / **0** | 144 / **79** |
| `failed` | 19 / **18** | 37 / 23 |
| `generating` | 1 / 1 | 19 / 8 |
| `draft` | — | 30 / 5 |
| `pending_payment` | — | 12 / 1 |
| `paid` | 1 / 1 | 1 / 1 |
| `partial` / `needs_human_qa` | 5 / 0 | 1 / 1 |

**Finding 1 — the classifier's premise is wrong.** It treats "an order record still references this object" as *in-flight, keep*. On staging only **2** orders are genuinely mid-flight (1 `paid`, 1 `generating`), yet it marked 14 of 15 photos KEEP. On production **118 orders still hold a child-photo URL while only 14 objects exist** — so almost every reference is dangling, and the classifier would mark **all 14 KEEP and remediate nothing**. The remediation would run and accomplish nothing.
**Required:** classify by **order status**, not by the existence of a reference. An object is *needed* only if its owning order can still render: `draft`, `pending_payment`, `paid`, `generating` — and `needs_human_qa` (a re-render may need the source). `ready`, `partial`, `failed` and orphans are **residue**. An object with no resolvable owning order is residue.

**Finding 2 — a second, separate exposure: stale child-photo URLs persisted in the database.** 118 production orders (and 20 on staging) still store a URL pointing at a child's photograph, mostly for objects that no longer exist. Even where the object is gone the database retains a URL to a child's photo, and that stale field is exactly what defeats the classifier.
**Required:** remediation must also **clear the persisted reference** (`Order.childImageUrl`, plus the nested `characterAnchors._privacy.originalChildPhotoUrl` / `child.sourceImageUrl`) for every order classified as residue — object and reference are cleaned together, in that order (delete/migrate object, then clear the field, so a failure never leaves a field pointing at nothing it can recover).

**Finding 3 — the residue generator is the failure path.** On staging every `ready` order has a cleared field and no photo (deletion works on success), while **18 of 19 `failed` orders still hold one**. Nothing cleans up when an order fails. Unless that is closed, every future failed order leaves a child's photograph public indefinitely.
**Required:** the child-photo cleanup must run on **terminal failure** as well as on success, and must be observable (reuse the `child_photo_deletion_failed` metric added in `b63e643d`).

## 3. FILES / AREAS
`lib/child-photo-audit.ts` (classification) · `scripts/audit-child-photos.ts` (report + remediation, incl. clearing persisted references) · `lib/child-photo-deletion.ts` (failure-path cleanup) · the terminal-failure paths that should trigger cleanup.

## 4. ACCEPTANCE CRITERIA
- Classification is driven by order status; `failed`/`ready`/`partial`/orphan objects are residue; only genuinely renderable orders are kept.
- Running the report on staging classifies **at most 2** photos as keep (the `paid` + `generating` orders) — that is the ground-truth check.
- Remediation clears the persisted reference fields as well as the object, object first.
- A terminal order failure triggers child-photo cleanup, observably.
- The report separates real photos from character-anchors (unchanged) and never touches anchors.
- Read-only by default; every destructive path stays behind an explicit flag.
- `npm run check` green.

## 5. TESTS
- Classification per status: `failed`/`ready`/`partial`/orphan → residue; `draft`/`pending_payment`/`paid`/`generating`/`needs_human_qa` → keep.
- An object whose owning order cannot be resolved → residue.
- Remediation clears both the object and all three reference fields; an object-deletion failure aborts before the field is cleared.
- A simulated terminal failure triggers cleanup and emits the metric on failure.

## 6. WHAT NOT TO TOUCH
Character-anchors (AI illustrations) · the write/read flip (Unit 1b, separate) · delivery, money, hold decisions · the frozen legacy path · Unit 2's held RLS migration.

## 7. GIT HYGIENE
Explicit pathspecs; **NEVER `git add -A`**; no force-push; commit locally; **Guy pushes**. Run nothing destructive against any environment.

## 8. FINAL VERIFICATION
`npm run check` green. Report: the status-based classification table, the staging report output (expect ≤2 keep), the reference-clearing order, and the failure-path cleanup hook. Then STOP — Guy runs the remediation.
