# Branch consolidation plan (2026-07-12)

**Integration branch:** `feat/chunked-generation` (@ 867c080d — has engine, TTS, gender, Fork B, contract tool).
**Worktrees:** `Small_Heroes` → feat/otp-email-redesign · `sh-wt-style01` → feat/chunked-generation.
**43 branches unmerged into feat.** Goal: land live/money work on feat → archive+delete the dead → ONE folder on ONE branch.

## ⚠️ Category A — LIVE / MONEY, must MERGE to feat before deleting (verify no conflict)
| branch | ahead | what | note |
|---|---|---|---|
| **fix/remove-addon-charges** | 5 | pricing: "everything included, charge==shown price" | **MONEY — stranded off feat.** Codex confirm on-feat-or-not + safe merge |
| **feat/coupon-code** | 7 | coupon feature (Codex re-gate 3 passed) | **MONEY — stranded off feat.** Codex confirm |
| **fix/reader-mobile** | 4 | Power Card redesign (Guy-approved) | LIVE. merge (touched lib/power-cards + reader) |
| feat/otp-email-redesign | 0* | OTP email mockup (uncommitted _review) | at feat HEAD; wire the OTP redesign → commit onto feat |

## Category B — AMBIGUOUS, Codex judgment before decide
| branch | ahead | what |
|---|---|---|
| **fix/visual-contract-live-wiring** | **45** | vNext manual-review release gate + calibration | Superseded by Slice A/B, or has unmerged VALUE? The big call |

## Category C — REDUNDANT, content already on feat → delete after confirm
- **fix/narration-accuracy** (f314e5d8 → ported as feat's 57ea12b0)
- **feat/tts-phase0b** (throwaway 0b harness)
- **fix/otp-email-template** (old, superseded by the OTP redesign)

## Category D — CLEARLY DEAD experiments → archive-tag + delete (~30)
wizard-*: 9step-rebuild, copy-p0, copy-p1, step9-total-relocate, ui-fixes, mobile-cleanup, summary-desktop-redesign, ux-fixes ·
style01-*: dini-full-book-preview, lock-architecture, dini-10page, dobi-10page, dobi-cub-lock, dobi-v2/2.1/2.2, phase-A, phase-B-lock, phase-B1-staging, anchor-variants-gate, classifier-and-locks ·
power-cards-3a/4b/5 · reader-v2-mobile-desktop-polish, reader-v2-nav-typography, reader-mobile-18px, reader-typography ·
landing-motion, ui-motion-polish, voices-6pack · fix/dini-page4, fix/photo-warning-width, fix/wizard-ux-fixes · archive/wizard-polish-stash, rebuild-prod

## Safe execution order
1. **Codex classifies** Category A + B (does each have unmerged value; safe to merge the money branches onto feat).
2. **Merge Category A** (live/money) → feat, per Codex (no clobber, fetch+rebase). Wire OTP onto feat.
3. **Codex rules on B** (visual-contract-live-wiring) → merge the valuable part or archive.
4. **Archive-tag + delete** Category C + D (tag `archive/<name>` before delete = recoverable).
5. **Consolidate to ONE folder:** merge complete → check out feat in Small_Heroes → retire sh-wt-style01 worktree. One folder, one branch.

**All git ops are Guy's terminal (Cowork/CC can't git-auth). fetch+rebase before any commit; NEVER force-push; NEVER `git add -A`.**
