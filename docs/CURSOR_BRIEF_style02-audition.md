# Cursor Brief — STYLE 02 — STYLE-REFERENCE AUDITION

Style-only. No book pipeline. Separate from Style 01 (Style 01 is parked at v4-reference / v4b — close-enough).

---

## Context

Now auditioning **Style 02** — a second, distinct illustration style. Style 02 = rich, atmospheric, cinematic fantasy: densely detailed, dramatic glowing light (candles, lanterns, lamps against deep shadow), magical and immersive, more rendered and dimensional than Style 01's soft watercolor — a premium, polished finish. **NOT** soft pencil. **NOT** flat watercolor. **NOT** a simple cute nursery style.

## Reference images

Guy's Style 02 references are in **`style-references/02/`** (13 PNGs, gpt-image output). They span from rich painterly illustration to near-photoreal 3D-render fantasy — all sharing a dark, moody, glowing, dense, magical DNA.

Use a **coherent subset** (API cap ~4 input images): pick varied scenes but a consistent render level — lean toward the rich, detailed, atmospheric *illustration* end, not the most extreme photoreal-3D outliers. Document which references were used and which excluded, and why.

## Method (same as the v4-reference Style 01 audition)

- `gpt-image-1`, `images.edit` with the style references.
- Style references = **VISUAL STYLE ONLY**: rendering, density, lighting, atmosphere, texture. Do NOT copy their content, composition, or creatures. The references contain a tortoise, a dragon, an owl, a butterfly, a fairy village — **none of those may appear in the audition outputs.**
- Use multiple varied references to keep the composition lock weak.
- Style-only: no book pipeline, no child-identity machinery, no anchors beyond the style references. No Flux, no LoRA.

## Run — 4 scenes (same as Style 01, for direct comparison)

- bedroom-night
- classroom
- clinic
- forest

**Lighting note:** Style 02 is atmospheric and can be moody — but DAYTIME scenes (classroom, clinic) must still be clearly, brightly lit, not pitch-dark. Night scenes (bedroom-night) can be deep and glowing.

**No text:** no letters, signs, posters with words, book titles, or labels — the references contain Hebrew/English text; do not copy it.

## Output

- the 4 Style 02 audition images
- exactly which references were used (and which excluded + why)
- the exact prompt / brief text
- API mode confirmation (`images.edit`, reference count)
- bleed report — content/composition bleed from the references

## CTO judges against Guy's Style 02 reference images

Does it match the rich, atmospheric, densely detailed, glowing, premium fantasy look — clearly distinct from Style 01 — without bleeding the references' creatures or composition, and without garbled text.

This is a Style 02 style audition only. Do NOT proceed to anything else until CTO approves.
