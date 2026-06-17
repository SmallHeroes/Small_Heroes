TYPE: RESULT
From: cursor
To: roundtable
Re: 0071 — companion presence-contract + canon fixes + koko gate
Date: 2026-06-17

# 0072 — Companion presence-contract fix + koko·fantasy gate

## Summary
0071 implemented (general architecture, not koko per-slot). Gate re-run **PASS** — 5/5 pages rendered LOW with `usedApprovedStage0Anchor: true`.

## Code changes (ordered A→J)

| Fix | What |
|-----|------|
| **A** | `lib/image-entity-presence.ts` — explicit `companionPresence:` / `childPresence:` parsed first from imageDirection/haystack |
| **B** | `lib/companion-presence-aliases.ts` — registry + aliases (koko/panda/bunny + existing); niqqud-strip in token matching |
| **C** | `assertCompanionPresenceConsistency` — fail-closed on explicit `present` + resolved `absent` |
| **D** | `forbiddenEntities` companion block only when companion not named/explicit-present |
| **E** | `lib/qa-console-anchor.ts` — Stage0 required for all QA console renders; `sanitizeIncidentalFaceMarkPhrasing` strips cheek-mark fluff |
| **F** | `lib/generation-pipeline/page-entity-qa.ts` + wired in `lib/qa-console-run.ts` |
| **G** | Unit tests: `קים` allowed, `קוקו`/`כימי` blocked (`validators.spec.ts`); live bank scan in `koko-fantasy-presence-prompt.spec.ts` |
| **H** | Quarantine headers on superseded `v5-fixed-v2/chameleon_koko_{bedtime,fantasy}.md` |
| **I** | `v3-approved/chameleon_koko_fantasy.md` p5 prose + imageDirection — no pink dots on Kim |
| **J** | `lib/__tests__/koko-fantasy-presence-prompt.spec.ts` — p2/p5 prompt contract tests |

## `npm run check`
- **tsc:** green
- **vitest:** 521/526 pass; 5 failures are **pre-existing matrix/env** tests (`mvp-story-matrix`, `wizard-mvp-matrix-api`, `mvp-order-enforcement`, `production-qa-escape-hatches` scanning `.next` build artifacts) — **not introduced by 0071**
- **0071 tests:** all green (`image-entity-presence`, `koko-fantasy-presence-prompt`, `qa-console-anchor`, companionName denylist)

## Gate re-run (exact spec)

| Item | Value |
|------|--------|
| Story | `chameleon_koko_fantasy@v3-approved` |
| Child | נועם, boy, 5 (noam preset) |
| Pages | 1–5 |
| Quality | LOW |
| Anchor | `chameleon_koko_fantasy__98abe88141e4ae16__de8a6c41` (approved) |
| Output | `outputs/style01-auditions/qa-console-chameleon_koko-fantasy-low-20260617-150039` |
| `usedApprovedStage0Anchor` | **true** |
| Rendered | **5/5** |
| `failedPages` | `[]` |
| Runtime | ~357s |

## Page-02 prompt — contradiction **gone**

```
companionPresence: present
Companion MUST appear and match COMPANION LOCK.
COMPANION LOCK: הזיקית קִים — A small round chameleon ...
```

No `NO companion creature` / no `FORBIDDEN: companion creature` on p2.

Full prompt: `.../qa-console-chameleon_koko-fantasy-low-20260617-150039/prompts/page-02-prompt.txt`

## Eyeballed gate criteria (Guy review)
- [ ] Kim present p2–5, chameleon + satchel + orange nose — **review PNGs locally**
- [ ] No clone children (esp. p5) — entityQa `passed: true` all pages; **eyeballed**
- [ ] Child storybook not photoreal — anchor ref used; **eyeballed**
- [x] Prompt contract fixed (p2/p5)
- [x] Name canon קים in live bank slots

## Script added
`scripts/run-koko-fantasy-gate.ts` — repro gate with `APPROVE_ANCHOR_CACHE_KEY` support.
