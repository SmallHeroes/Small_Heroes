# 0077 — p5 single-Kim depiction + entity-QA base64 vision (0076)

**Brief:** `0076_claude_p5-single-kim-and-qa-vision.md`

---

## A — p5 imageDirection (single instant, not color sequence)

**File:** `story-bank/v3-approved/chameleon_koko_fantasy.md` (p5 only; Hebrew prose unchanged)

Replaced color-sequence wording with single-instant depiction:

> ONE single chameleon, Kim — her one body shimmering mid-transformation, a blend of green and yellow washing across the SAME body (a single creature caught between colors, NOT separate chameleons, NOT a row of them), while her bright orange nose and mustard satchel stay unchanged. {{childName}} watches with nervous amusement, one child only. EXACTLY ONE chameleon and EXACTLY ONE child — never multiple Kims, never duplicate or clone the child. companionPresence: present. view: close 3-4.

**Test:** `koko-fantasy-presence-prompt.spec.ts` — asserts shimmering mid-transformation, EXACTLY ONE chameleon, no `changing into green, yellow, then`.

---

## B — Entity-QA vision via base64 data URL

| File | Change |
|------|--------|
| `lib/generation-pipeline/page-entity-qa.ts` | `resolveEntityQaVisionDataUrl()` — local PNG path → `data:image/png;base64,...`; used inside `evaluatePageEntityQa`. Vision `detail: low` for reliable verdicts on full-page PNGs. Fail-closed unchanged. |
| `lib/qa-console-run.ts` | Entity QA prefers `localPng` over remote `imageUrl` so rendered bytes are always sent. |

**Test:** `page-entity-qa.spec.ts` — local path resolves to base64 data URL.

---

## GATE — proof

### Old 3-Kim image (run 155755) — HARD FAIL ✅

```text
scripts/prove-koko-p5-entity-qa.ts
  outputs/.../qa-console-chameleon_koko-fantasy-low-20260617-155755/page-05.png

Status: fail
Hard failures: duplicate_companion, wrong_companion_species
companionCount: 3, singleCompanionOnly: false
```

**Contrast:** same run manifest (155755) had `entityQa.status: error` / `empty vision response` — vision never ran before base64 fix.

### New p5 re-render (LOW, approved anchor) ✅

| Field | Value |
|-------|-------|
| Run dir | `outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-162542` |
| Anchor | `chameleon_koko_fantasy__98abe88141e4ae16__de8a6c41` |
| Prompt | single-shimmer imageDirection in finalPrompt |
| **entityQa** | `status: pass`, `companionCount: 1`, `singleCompanionOnly: true` |
| Gate exit | **0** |

Preview: `http://localhost:3000/dev/style01-book-preview?dir=qa-console-chameleon_koko-fantasy-low-20260617-162542&root=outputs`

---

## `npm run check`

**533/533 PASS**

---

## Files changed (0076 scope)

- `story-bank/v3-approved/chameleon_koko_fantasy.md`
- `lib/generation-pipeline/page-entity-qa.ts`
- `lib/qa-console-run.ts`
- `lib/__tests__/page-entity-qa.spec.ts`
- `lib/__tests__/koko-fantasy-presence-prompt.spec.ts`

**Not committed** — awaiting explicit commit request.
