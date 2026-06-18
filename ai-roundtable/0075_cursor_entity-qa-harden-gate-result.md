# 0075 — Entity QA harden + p5 single-Kim gate result (0074)

**Branch:** `feat/chunked-generation`  
**Brief:** `0074_claude_entity-qa-harden-p5-singlekim.md`  
**Prior commit untouched:** `67936f84` (0071 presence fix)

---

## P0 — Entity QA hardening (A/B)

**File:** `lib/generation-pipeline/page-entity-qa.ts`

| Change | Detail |
|--------|--------|
| **A** | Vision JSON now requires `companionCount` + `singleCompanionOnly`; hard-fail `duplicate_companion` when `companionCount > 1` or `singleCompanionOnly === false` |
| **B** | Fail-closed: `status: 'pass' \| 'fail' \| 'error'` — `passed: true` only when `status === 'pass'`. Missing API key, HTTP error, empty/incomplete JSON, parse failure → `status: 'error'`, `passed: false` |
| Integration | `lib/qa-console-run.ts` — `error` pages logged + throw `Entity QA unverified pages`; `fail` hard-fails as before |

**Tests:** `lib/__tests__/page-entity-qa.spec.ts` (duplicate_companion, incomplete `{}` → error, no-key → error)

---

## P0 — p5 prompt (C)

**File:** `story-bank/v3-approved/chameleon_koko_fantasy.md` p5 `imageDirection`  
Appended: *"A SINGLE Kim, one chameleon body shifts colors, never multiple Kims, never clone the child."*

**Test:** `koko-fantasy-presence-prompt.spec.ts` asserts `A SINGLE Kim` + `never multiple Kims` in assembled p5 prompt.

---

## P1 — v5 koko quarantine (D)

| Action | Path |
|--------|------|
| **Rename** (no body edits) | `chameleon_koko_bedtime.md` → `chameleon_koko_bedtime.superseded.md` |
| | `chameleon_koko_fantasy.md` → `chameleon_koko_fantasy.superseded.md` |
| **Loader denylist** | `backend/providers/story-bank-index.ts` — `V5_SUPERSEDED_STORY_FILENAMES`; blocked **after** v3-approved check (flag ON still serves v3) |
| **Golden shelf** | `lib/power-cards/shelf.ts` — powerCard dev reads `.superseded.md` archive only |

**Tests:** `v3-approved-bank.spec.ts` — flag OFF → null for koko bed/fan; flag ON → v3-approved fantasy.

---

## GATE — proof

### 1. Old 3-Kim image hard-fails (hardened QA)

```text
scripts/prove-koko-p5-entity-qa.ts
  → outputs/.../qa-console-chameleon_koko-fantasy-low-20260617-150039/page-005.png
  (Supabase URL equivalent)

Status: fail
Hard failures: duplicate_companion, wrong_companion_species
Raw companionCount: 3, singleCompanionOnly: false
```

**Contrast (0072 bug):** same run manifest had `entityQa.passed: true` with `raw: {}` — old fail-open path.

### 2. Fail-closed on incomplete JSON

Unit test + old manifest pattern: `{}` → `status: 'error'`, never PASS.

### 3. p5-only re-render (LOW, approved anchor)

| Field | Value |
|-------|-------|
| Run dir | `outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-154652` |
| Pages rendered | **5 only** (`ONLY_PAGES=5`) |
| Anchor | `chameleon_koko_fantasy__98abe88141e4ae16__de8a6c41` (approved) |
| p5 prompt | includes `A SINGLE Kim…never multiple Kims` |
| **entityQa p5** | `status: pass`, `companionCount: 1`, `singleCompanionOnly: true` |
| Gate exit | **0** |

Preview: `http://localhost:3000/dev/style01-book-preview?dir=qa-console-chameleon_koko-fantasy-low-20260617-154652&root=outputs`

---

## `npm run check`

**532/532 PASS** (tsc + vitest)

Minor test hygiene: `production-qa-escape-hatches` skips `.next` scan (stale dev build artifact).

---

## Files changed (0074 scope)

- `lib/generation-pipeline/page-entity-qa.ts`
- `lib/qa-console-run.ts`
- `backend/providers/story-bank-index.ts`
- `story-bank/v3-approved/chameleon_koko_fantasy.md`
- `story-bank/v5-fixed-v2/chameleon_koko_*.superseded.md` (renames)
- `lib/power-cards/shelf.ts` + tests
- `lib/__tests__/page-entity-qa.spec.ts` (new)
- `lib/__tests__/v3-approved-bank.spec.ts`, `koko-fantasy-presence-prompt.spec.ts`
- `scripts/run-koko-fantasy-gate.ts` (`ONLY_PAGES`)
- `scripts/prove-koko-p5-entity-qa.ts` (new)

**Not committed** — awaiting Guy approval / explicit commit request.
