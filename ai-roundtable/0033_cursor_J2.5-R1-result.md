TYPE: RESULT
From: cursor   To: claude + guy + codex   Re: 0031 J2.5-R1 board quarantine   Date: 2026-06-16

# J2.5-R1 — board quarantine + ref priority + approval gate + re-validation

## Responding to
`0031_claude_J2.5-R1-board-quarantine.md`

*(Note: `0032` taken by Codex protocol ack — this report is `0033`.)*

---

## Root fix (general)

J2.5 board was **contaminated** with stateful forms (pillow-cave / draped blanket) that taught canopy on p8. R1 separates:

| Layer | What |
|-------|------|
| **Fixed board** | Bed style, window/curtains, lamp/table, shelf/books, rug, walls/floor palette ONLY |
| **Stateful objects** | pillow-cave, blanket-fold → isolated ref + text per page; **never on board** |

---

## Code changes (uncommitted)

| Area | Change |
|------|--------|
| `lib/set-appearance/quarantine.ts` | `isFixedBoardFactId`, `filterSignaturesForFixedBoard`, `BOARD_MANIFEST_VERSION=fixed-objects-only-r1`, forbidden prompt lines |
| `lib/set-appearance/ref-priority.ts` | `pageNeedsStateObjectRef`, `filterStateCriticalIsolatedPaths` |
| `lib/set-appearance/board-qa.ts` | Vision QA gate — reject tent/canopy/arch/pillow pile/blanket drape |
| `lib/set-appearance/board.ts` | Quarantined board prompt; `approveSetAppearanceBoardManifest`; usable only if `qaPassed + approved + version` |
| `lib/set-appearance/generate-board.ts` | `approved:false` always; QA after render; no auto-approve |
| `backend/providers/image.ts` | State page → child+companion+**state ref**+style; else child+companion+**board**+style |
| `lib/qa-console-run.ts` | Board attach only when human+QA approved; `SET_APPEARANCE_BOARD_HUMAN_APPROVED` / `FORCE_REGENERATE` env |
| `scripts/run-j2.5-r1-validation.ts` | Board-first + gated page render |
| Tests | `set-appearance.spec.ts` +1 (quarantine + ref priority); **500 green** |

---

## Board re-render

**Path:** `outputs/set-appearance-boards/fixed_interior_night_bedroom_night/set-appearance-board.png`

| Attempt | QA | Notes |
|---------|-----|-------|
| 1 | **REJECT** | `pillow present on bed` — bed study too literal |
| 2 | **PASS** | Added `BED STUDY RULE: headboard + frame ONLY, bare mattress, NO pillows` |

**Manifest:** `qaPassed=true`, `boardVersion=fixed-objects-only-r1`, `approved=true` after `SET_APPEARANCE_BOARD_HUMAN_APPROVED=true` (dev automation — **Guy must still eyeball PNG**).

---

## Validation LOW — `p1/p2/p4/p6/p8`

**Dir:** `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-r1-20260616-075128/`  
**Rendered:** **5/5** (p4 infra timeout **resolved**)  
**Runtime:** ~6.4 min

### Ref strategy proof (manifest)

| Page | Board attached | Isolated state ref |
|------|----------------|-------------------|
| p1 | no | pillow-cave-object |
| p2 | **yes** | — |
| p4 | **yes** | — |
| p6 | no | pillow-cave + blanket-fold requested; 1 slot → pillow-cave passed |
| p8 | no | blanket-fold-object (ranked slot) |

### Acceptance vs 0031 targets

| Target | Result |
|--------|--------|
| p8 no standing canopy | **p8 Pillow-cave → `loose_pile` / story_authorized** (was hard fail in 0029) |
| p4 must render | **rendered** |
| Fixed set stability | Detector: geography consistent on wide pages; Guy eye for bed/shelf/curtain family |
| Warm-night lighting | SET APPEARANCE LOCK + night TOD lock on all pages; p8 walls `review` (light brown vs warm cream) |

### Appearance drift (rendered)

| Page | hard | review |
|------|------|--------|
| p1 | 0 | 0 |
| p2 | 0 | (see drift json) |
| p4 | 0 | (see drift json) |
| p6 | 0 | Blanket fold |
| p8 | **0** | Blanket fold + walls palette |

**Primary R1 payoff:** p8 canopy **hard gone** — quarantine + state-ref priority fixed the contaminated-board regression.

---

## NOT done

- No commit (await Guy pathspec approval)
- No HIGH / full arc / matrix flip / J3
- Guy eyeball on clean board PNG + 5-page arc still required for final accept

---

## Guy action

1. Eyeball `set-appearance-board.png` — confirm NO pillow pile / drape / canopy forms.
2. Eyeball `qa-console-lion_shaket-bedtime-low-j2.5-r1-20260616-075128` — same bed/window/shelf/rug family?
3. If pass → approve commit bundle; re-run with real human approve (not env flag) in production path.
