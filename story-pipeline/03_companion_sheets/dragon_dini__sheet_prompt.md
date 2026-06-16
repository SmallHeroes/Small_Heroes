# Dini — Style 01 character-sheet regen prompt (copper-orange)

**Why:** the published `public/companions/dragon_dini/style01-sheets/*` are STALE GREEN. Regenerate to the current copper-orange canon (`lib/dragon-dini-style01-blocks.ts`). **Do NOT condition on the old green reference jpg** (`/companions/NEW_SIBLING/dragon_dini.jpg` — also green); build from the text canon below.
**How:** gpt-image-2, Style 01 watercolor, LOW for the audition pass → eyeball → MEDIUM/HIGH publish. Character-only, plain background, one clear view per image. 6 views: front / three_quarter_front / side / three_quarter_back / happy / theme.

---

## MASTER DINI BLOCK (paste into every view prompt)

```
Dini — a young FEMALE dragon, toddler-chubby and scrappy-friendly, with the slapstick energy of a young creature still figuring out her own size. Size: like a large careful dog (mid-sized), NOT a big beast.
- Scales: SHIMMERING COPPER-ORANGE (warm copper with soft sunset highlights). NOT green, NOT blue, NOT teal, NOT red.
- Belly + inner-throat: soft cream.
- Wings: exactly 2, PEACH-CORAL (warm pink-orange) membranes, modest size, folded close to the body (NOT giant, NOT spread wide).
- Small rounded back-spikes in the same peach-coral.
- Eyes: large, warm HONEY-AMBER, friendly and protective — never fierce, never scary.
- Snout: short, rounded button snout (NOT elongated). Small rounded horns + soft ear-frills.
- Canonical accessory: a TERRACOTTA guardian's sash worn diagonally across the chest — matte cloth, soft fabric weave (not metal, not shiny).
- Personality read: warm, caring, a little over-eager.
Illustration style: soft warm watercolor + gentle colored-pencil children's storybook art; cozy, rounded, huggable; clean gentle linework; plain cream / off-white background.
HARD RULES: full body, centered, clear readable silhouette. NO text, NO labels, NO arrows. NO second dragon. NO egg. NO baby dragon. The terracotta sash is present and visible. Scales stay copper-orange in every view (never green).
```

## Per-view prompts (master block + the line below)

- **front.png** — `Front view, standing upright and symmetric, relaxed friendly posture, looking at the viewer.`
- **3-4.png** (three_quarter_front) — `Three-quarter front view, body angled ~30°, one wing slightly visible, warm friendly posture.`
- **side.png** — `Full side profile view, standing, tail relaxed, clear silhouette of snout, horn, wing and tail.`
- **back.png** (three_quarter_back) — `Three-quarter back view from behind, showing the folded peach-coral wings, back-spikes and tail; head turned slightly so one honey-amber eye is visible.`
- **happy.png** — `Front view, joyful happy expression — bright open smile, eyes warm and crinkled, a small eager bounce in the posture.`
- **theme.png** — `Front/3-4 view in Dini's signature pose: her tail curling into a gentle protective circle and one wing held open like "a hug with a gap" (a wing-wall with a clear opening). Warm, caring expression. Character only, no other objects.`

## Anti-merge / QA reminders (the gate that caught the green version)
- ⚠ Dini = COPPER-ORANGE + peach-coral wings. The baby dragon (NOT in these sheets) = moss-green + copper freckles. Never recolor Dini green.
- Terracotta sash visible in every clear view; horns + ear-frills + button snout consistent across all 6.
- After render: resemblance/consistency QA across the 6 views (same head landmarks, same proportions, same sash). Replace the stale green files only after eyeball PASS; update `manifest.json` + the `referenceJpg`.
- `bunny_ometz` cardImage uses `happy.png`; the rest use `front.png` — pick `front.png` for Dini's card (or align all later).
```
