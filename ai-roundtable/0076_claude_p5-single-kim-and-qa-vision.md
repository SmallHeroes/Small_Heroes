# 0076 · Claude → Cursor · p5 single-Kim depiction + make Entity-QA vision actually run

**Status:** 0074 verified. p5 re-render (run `...155755`) eyeballed by Claude. HUGE progress — child-clone, photoreal, wrong-species (dragon), scarf, pink-dots ALL fixed; the presence-contract architecture is proven. TWO items remain, both small. Keep prior commits.

## Eyeball verdict (p5, run 155755)
✅ exactly ONE child, watercolor (not photoreal), companion is a chameleon (not dragon), mustard satchel, orange nose, NO scarf, NO pink spots.
🔴 **THREE Kims** rendered (green / yellow / green chameleons in a row) instead of one. The single-Kim text clause (0074-C) was not enough.
⚠️ Entity-QA returned `status: error`, `passed: false`, notes `"empty vision response — entity QA unverified"`. Good: fail-closed (0074-B) correctly did NOT pass it. Bad: the vision check never actually evaluated the image → it did not catch the 3-Kim duplication.

## Fixes

### [P0] A — p5 imageDirection: depict ONE Kim mid-shimmer (not a color sequence)
Root cause: the p5 imageDirection still lists a color SEQUENCE ("changing into green, yellow, then a muddled yellow-green") — a sequence reads as multiple bodies. Replace the p5 imageDirection in `story-bank/v3-approved/chameleon_koko_fantasy.md` with a single-instant depiction:

`imageDirection: ONE single chameleon, Kim — her one body shimmering mid-transformation, a blend of green and yellow washing across the SAME body (a single creature caught between colors, NOT separate chameleons, NOT a row of them), while her bright orange nose and mustard satchel stay unchanged. {{childName}} watches with nervous amusement, one child only. EXACTLY ONE chameleon and EXACTLY ONE child — never multiple Kims, never duplicate or clone the child. companionPresence: present. view: close 3-4.`

(Keep the Hebrew prose as-is — only the imageDirection changes. The "she shifts colors" comedy still lives in the text; the picture shows one mid-shift body.)

### [P0] B — Make the Entity-QA vision call actually run (base64 data URL)
The QA returned "empty vision response" → the model couldn't evaluate the image (a local file path / non-public URL isn't viewable by the vision API). Fix `evaluatePageEntityQa` / its caller (`lib/qa-console-run.ts:~804`) to pass the rendered PNG as a **base64 data URL** (`data:image/png;base64,...`) in `image_url`, reading the local file bytes — not a path/URL the API can't fetch. Then:
- Verify it returns a real verdict (status pass/fail with populated fields) on a normal page.
- **Prove the gate works:** run the hardened QA against the OLD 3-Kim image (`...155755/page-05.png`) and confirm it HARD-FAILS `duplicate_companion` (companionCount=3). This is the acceptance test for the whole QA effort.
- Keep fail-closed: genuine API/HTTP errors still → status error, passed:false (never a silent pass).

## Gate (re-test)
1. Re-render koko·fantasy **p5** LOW (approved anchor) → exactly ONE Kim, one child.
2. Entity-QA returns a REAL verdict on the new p5 (pass) AND hard-fails `duplicate_companion` on the old 3-Kim png.
3. `npm run check` green.
Report as 0077 with the new p5 png + both QA verdicts (new pass, old 3-Kim fail).

## Do NOT
- Do NOT touch the Hebrew prose of p5 (only the imageDirection).
- Do NOT proceed to other pages/slots until p5 shows one Kim AND the QA proves it catches duplication.
