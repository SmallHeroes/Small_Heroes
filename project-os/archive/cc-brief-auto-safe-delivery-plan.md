# Auto-Safe Delivery — consolidated findings + prioritized plan (for Codex review)

**Status:** PLANNING ONLY — nothing implemented, no code started. This is the handoff doc for architect review.
**Source:** read-only 8-agent audit of every generation branch (story / image-identity / image-correctness / audio / packaging / orchestration) + a cross-cutting critic.
**Author:** Claude Code (CC), consolidating the audit + Guy's two rulings below.

---

## Founder rulings (these reframe everything)

1. **Identity is GOOD ENOUGH — de-scope identity detection.** The anchor-generation model produces a strong likeness (eyeball-validated yesterday). Guy: "הוא דומה לו מאוד וזה מספיק טוב כדי להתקדם... אין צורך לחפור בזה עוד." **We stop building identity auto-gates and human-review-for-identity. No upstream customer-approval (no added friction).**
2. **Goal:** fully-automatic, safe, accurate delivery — **no human reviews a book before the customer gets the "ready" link.**
3. **Decide the order myself; do not start anything yet** — this doc goes to Codex first.

### Why ruling #1 unblocks the goal
The entire identity-calibration arc (discrimination floor, gpt-5.5 triage, #43 manual-review gate) existed to **catch a wrong/look-alike child**. If we accept the generator is good enough, **there is nothing to catch** — the "biggest obstacle to zero-human" the critic named **dissolves**. "No human before delivery" is then blocked only by **deterministic / quality gaps** (below), all of which ARE automatable via prevention + detection + auto-retry. **#43 becomes a dormant safety-net (flag OFF), not the delivery path.**

> **Net effect:** the hard R&D problem is off the table. What remains is disciplined engineering to (a) never ship a *broken* book, (b) make safety/quality gates *binding & automatic*, (c) auto-retry transient failures.

---

## The two unpleasant surprises (already shipping broken/unsafe books TODAY — independent of the "no-human" goal)

| # | Gap (file:line) | Effect |
|---|---|---|
| A | **Story-content safety never binds delivery.** Production `chunk-runner` loads from story-bank and **skips `orchestrate`/editorial entirely**; `finalStatus` (REVIEW_REQUIRED/REJECTED_EDITORIAL) is computed but **never checked** before `sendBookReadyEmail` (chunk-runner ~1574). Only the anchor gate blocks. *(VERIFY this claim first — load-bearing.)* | An unsafe / broken-Hebrew / off-prompt story ships automatically if the anchor passes. |
| B | **Image-completeness gate doesn't validate URL integrity.** Package asserts `withImages >= expectedPages` (chunk-runner:1488) but never checks `imageAsset.url` is non-empty/valid. A timeout mid-persist (chunk-runner:1305–1334) leaves a row with `url=null`, counted as "done". | Book ships with a **blank page**; reader renders nothing; no post-ship detection. |

Plus the two other criticals: **no NSFW/anatomy vision-gate on images at all**, and **release endpoint behind a single static `.env` password** (no audit/2FA/rate-limit).

---

## Prioritized plan (my recommended order — for Codex to challenge)

### P0 — Critical fail-safe gates (stop shipping broken/unsafe books). Small effort, low risk, do first.
1. **Pre-package completeness + URL integrity assertion.** Before `runPackageStage`: every page has `imageAsset.url` valid+non-empty (HEAD check), cover present, `pageCount>0`. Fail→retry, never mark ready. *(prevention; small)* → no blank pages.
2. **Transactional package stage.** Wrap `order.status` + `job.packaged` + `readUrl` in one Prisma `$transaction`; email send OUTSIDE (best-effort). *(prevention; small)* → no half-packaged state, no double "ready" email on resume.
3. **Bind story-safety to delivery.** Make the delivery gate check the editorial/technical `finalStatus`; REVIEW_REQUIRED/REJECTED → hold (or auto-reroll, see P1.5). *(prevention; small once editorial runs — depends on P1.4)* → unsafe story can't ship.
4. **NSFW / anatomy vision safety-gate on every rendered page.** Post-render vision check for disturbing/explicit content + gross anatomical defects (extra limbs, malformed faces/hands). On flag → reroll once, else hold. *(detection; medium)* → closes a currently **wide-open** critical gap in a children's product.

### P1 — Automatic-safe-delivery core (replace the human path with prevention + auto-retry). Medium effort.
5. **Editorial-QA ON for every book + bounded auto-reroll.** Flip `EDITORIAL_QA_ENABLED` on (gpt-5 author+reviewer parity, ~$0.05/book); on BLOCKING/major finding, auto-reroll the affected pages ≤2× (change-only), then hold as last resort. *(prevention/auto_retry)* → an automatic "human-equivalent reviewer" on every book, $0 human cost.
6. **Hebrew re-validation + name-lock after personalization (production).** Run `hebrew-read-aloud-editor` + `fixEnglishLeaks` after gender-chip/name substitution; strict child-name presence check vs wizard input. *(prevention; small)* → no personalization-induced broken Hebrew / wrong name.
7. **Turn `VISUAL_CONTRACT_ENFORCEMENT` ON + bounded reroll.** Enforce location / forbidden-entity / missing-prop / wardrobe-drift / cover-match; reroll ≤3 then hold (not hard-fail-order). Enrich negative prompts with named forbidden creatures; promote `style01-child-scale-validator` to a hard runtime gate. *(prevention; small–medium)* → the visual contract becomes the single source of truth, not an advisory.
8. **Audio completeness + integrity (production).** Add per-page `audioStatus`; gate delivery so an `audioEnabled` book never ships with a null `audioUrl`; validate each clip (duration/silence/bitrate via ffprobe); per-page auto-retry across worker invocations. *(prevention/auto_retry; small–medium)* → no silent missing/garbled audio.
9. **Niqqud pass + name pronunciation lexicon in production.** Move the niqqud pass into the production path before TTS; seed a lexicon from the wizard child-name. *(prevention; small)* → the child's name is pronounced correctly.
10. **Orphaned-asset integrity + per-page retry.** After each `ImageAsset` write, HEAD-validate the URL; on failure null it + re-render the page (don't count it as done). *(detection/auto_retry; medium)* → no page ships pointing at a broken/truncated file.
11. **`partial` status path for audio-only failures + retry-audio endpoint.** If text+images succeed but audio fails after retries → `partial` + "ready (audio coming)" + a re-trigger-audio path. *(both; medium)* → audio failure never blocks an otherwise-complete book.

### P2 — Reliability / ops hardening. Medium effort.
12. **Stuck-job watchdog + alerts** (warn at staleReclaim≥2, alert at ≥5) + admin force-complete-as-partial. → stuck orders noticed in minutes, not days.
13. **Version-aware idempotency** (hash effective flags/prompt-versions into the key) → config changes auto-re-render, no stale-cache books, no cost surprises.
14. **Anchor-hold durability across crash/resume** — recompute `childAnchorLowConfidence` from `Order.characterAnchors` on resume rather than trusting possibly-lost cache (only relevant if any anchor hold remains — see ruling below).
15. **Text↔audio checksum** (store `narrationTextHash`; mismatch → regenerate that page's audio) → guarantees audio always matches displayed text even if a future polish pass is added.

### P3 — Quality lifts (lower priority given identity is de-scoped). Larger effort, optional.
16. Per-page **numeric** resemblance (drift visibility — now a *quality* nicety, not a safety gate). 17. Cross-page companion consistency. 18. Text-in-image OCR detection + inpaint. 19. Sweeper chain-kick feedback (await/confirm worker actually ran).

---

## What ruling #1 means concretely (decision for Codex to confirm)

- **Drop identity auto-gating + human-review-for-identity.** `VISUAL_CONTRACT_IDENTITY_VISION` stays OFF (permanently, unless revisited). `LAUNCH_MANUAL_REVIEW` stays OFF. #43 manual-review gate is kept **only** as a dormant break-glass safety-net.
- **Anchor delivery hold — recommended change:** stop holding the **soft band** (0.15–0.22) for human QA (that's the friction Guy rejects). Keep only a thin automatic guard for a **genuinely broken** anchor (e.g., score < hard-floor *and* semantic-QA fails on gender/hair): auto-retry the anchor a bounded number of times, then accept-best — **no human in the loop**. Net: normal orders auto-deliver; only a truly garbage photo triggers a retry, never a human.
- **Open question for Codex:** do we remove the soft-band hold entirely, or keep hard-floor-only as an auto-retry (no human)? (CC leans: hard-floor-only auto-retry, no human.)

---

## Cross-cutting gaps the critic surfaced (recap — these have no single "owner")
Story-safety-not-binding (A) · image-URL-integrity (B) · **text↔image not cross-checked** (a page where image & text each pass their own gate but don't match each other) · text↔audio desync · package non-transactional · anchor-hold not crash-durable · held-orders invisible to customer · sweeper fire-and-forget · VCC enforcement OFF · production-skips-editorial · Hebrew-not-validated-in-prod · `partial`-unreachable.

> **New gate worth adding (not in any single branch):** a final **page-coherence cross-check** — one cheap vision+text pass per page asking "does the illustration depict what this page's text says?" Catches the between-branch failure no per-branch gate sees.

---

## Open questions for Codex
1. Confirm/deny the load-bearing claim that **production skips editorial entirely** and `finalStatus` never blocks delivery (gap A). If true, P0.3 + P1.5 are the highest-value items.
2. Soft-band anchor hold: remove entirely, or keep hard-floor-only auto-retry (no human)?
3. NSFW/anatomy gate: reroll-then-ship vs hold-on-flag for a children's product (CC leans hold-on-flag — never auto-ship flagged imagery).
4. Editorial-on-every-book cost/latency acceptable (~$0.05 + a few seconds/book)? Or only when technical validators raise warnings?
5. Sequencing: agree with P0→P1→P2, or pull any P1 item (esp. NSFW gate / VCC-enforcement-on) into P0?

---

## Suggested first wave (if approved): P0 (items 1–4) + P1.5/P1.6 (editorial-on + Hebrew/name-lock).
Rationale: items 1–4 stop the **broken/unsafe-book-ships-today** bleed at small effort; 5–6 turn on the story-safety automation that ruling #2 needs. Identity work: **none** (de-scoped).
