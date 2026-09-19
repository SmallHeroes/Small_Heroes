# Repair lock restoration — QA handoff

Read-only review requested. No provider, credentials, images, publication or push.

## Authorship and independence

Claude Code raised the P1 this commit closes, and Claude Code wrote the fix, because
Codex stopped on usage limits at clean `f6bdf5f7`/ahead11 and Guy explicitly
reassigned the correction. **Claude is therefore not independent on this change.** It
needs Codex's adversarial review. Nothing here is a PASS, a product acceptance, a
semantic claim or a render authorization. The prior HOLD chain stands:093d37c0 and
5e990881 still have no independent PASS, and `validateBookSequence` remains an
unreviewed dependency.

## The finding being closed

`5e990881..f6bdf5f7` replaced the repair render instruction with a compact effective
state projection. Measured on the real saved Panda book, page12, that projection
dropped every STYLE_01 lock block the initial prompt carries:

| block | chars |
|---|---|
| `STYLE_01_SHARED` | 273 |
| `STYLE_01_RENDERING_CORRECTION` | 663 |
| `STYLE_01_CANONICAL_CHILD_ANCHOR_RULE` | 651 |
| `buildStyle01ChildAnatomicalLock()` | 957 |
| `buildStyle01AnatomyIntegrityLock()` | 644 |
| `STYLE_01_FRAMING_RULE` | 882 |
| **total** | **4070** |

`anatomy` and `identity` are QA categories, and repair is the call that follows a
diagnosed defect, so those locks were missing exactly where they matter most. The
capacity brief's preserved-field list ("scale/framing … remain") did not name them.

## Why the omission was forced, not careless

Page12 repair body without corrections is16052 chars; the8x1800 schema-maximum
correction guarantee adds14400, totalling30452 against a31000 local cap and32000
transport ceiling. Restoring all locks under that same guarantee needs34522 — over by
3522. Restoring only the anatomy locks needs32053 — still over. **No unconditional
restoration exists.** The fix therefore makes locks opportunistic instead of dropping
the guarantee.

## What changed

`lib/local-preview-capacity.ts`
- `buildLocalRepairPrompt` assembles the widest lock tier the real transport planner
  accepts: `full` (all six blocks) → `anatomy` (child anatomical + anatomy integrity)
  → `none`. It returns `{ prompt, lockTier }`; `localRepairPrompt` is a thin wrapper
  so the existing call shape is unchanged.
- Blocks come from the **same builders** `previewPagePrompt` uses, including the
  `close` shot variant of the framing rule. No paraphrase, no duplicated text.
- Tier fit is judged by `assertLocalImagePrompt` → `planGPTImageRequest`, not JS
  length, so multipart CRLF expansion and the request prefix are counted. This closes
  a gap where a page could sit under the31000 LF cap but above it after expansion.
- The `none` tier is assembled last and returned **even when oversized**, so the
  caller's assert raises the same `preview_image_input_limit` hold as before.
- `preflightLocalBookPrompts` asserts size **before** computing tiers, so locks can
  never mask an oversized page; an unreachable full tier reports `null`, never throws.
- Per page it now reports `lockTierAtMaxCorrections` and an exact binary-searched
  `fullLockCorrectionCharsPerCategory`.
- `LOCAL_PROMPT_LIMITS` replaces the inline24000/31000 literals.
  `LOCAL_CAPACITY_VERSION` → `local-preview-capacity/v2`, so old roots are rejected
  rather than silently reinterpreted.

`scripts/run-local-story-preview.ts` logs `{stage:'repair_locks', page, attempt,
lockTier}` per repair attempt. No other runtime behaviour changed.

## Evidence

Real saved Panda book,13 pages, at the absolute8x1800 worst case:

- full locks retained: pages0,1,2,3,9,10
- anatomy locks retained: pages4,5,6,7,8,11
- `none`: page12 only, at **30452 chars — byte-identical to before the fix**

`fullLockCorrectionCharsPerCategory` ranges1385 (page12) to1800 (never degrades).
Real judge corrections are far shorter than1385, so in practice every page keeps the
full set. Claude's own independent drop audit — the probe that originally found the
regression — now reports **0 chars dropped** on page12.

Focused **222/222** (planning45, sequence29, owner72, quality28, judge16, preview32),
`tsc` 0. Both witnesses exit0; preservation still56 snapshot files,3 reader hashes,2
page images.

## Attack targets

1. Prove the pre-existing guarantee is unpaid-for: every page's `8x1800` worst case
   must still pass `assertLocalImagePrompt`, and page12 must still be exactly30452.
2. Force each tier boundary. Confirm no tier ever truncates or reorders a correction,
   that a narrower tier smuggles no lock text back in, and that `none` still raises the
   typed hold rather than silently shrinking state.
3. Confirm the tier selector cannot be fooled by newline-heavy corrections: JS length
   under31000 but multipart over32000 must degrade, not throw mid-book.
4. Confirm size still gates before locks: an oversized late page must fail with
   `preview_image_input_limit`, not a lock error, and must block the FIRST board/image.
5. Confirm every CURRENT entity attribute value, page direction, prop/location design
   and the full sequence packet still survive at **every** tier — locks must not have
   been bought with state.
6. Confirm no judge model/effort/threshold/schema change, no resemblance0.70 change,
   no transport or production path change, and that `v2` rejects old roots rather than
   migrating them.

## Limits

Whether the restored locks actually improve repaired pixels is **unmeasured** and
cannot be settled offline. Labelled directive lines (`CAMERA:`, `CHILD ACTION:` …)
remain absent from the repair prompt by design; their values survive as fields inside
`CURRENT PAGE AUTHORITY`, which Claude verified across79 attribute values. This commit
does not generate plans for the18 stories, does not close any semantic HOLD, and does
not qualify anything for release. `npm run check` was run for this commit; a single
green run is not enduring stability or release acceptance.
