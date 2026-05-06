# Story directions — scenario 3 (companion + real JPG under `public/companions/NOISE_FEAR/footstep_giant.jpg` > 100 bytes)

The **summaries** match scenario 2 (same `buildPersonalizedCopy` path). The difference is the **preview pipeline**: `getCompanionReferencePublicUrl` returns a public URL, so `generateImage` gets `input_images` with both child and `companion:footstep_giant` on the first direction preview, and `characterAnchors['companion:footstep_giant']` in full book generation can be pre-seeded from that URL before the first Replicate page output (see `app/api/generate/route.ts` + `getCompanionReferencePublicUrl`).

Paste your three real `summary` fields from the API response below after you run the wizard + directions.

1. **connection** — (paste)
2. **adventure** — (paste)
3. **courage** — (paste)

---
*E2E not executed in this session. After your run, confirm in logs: `[api/story-directions] resolved companion` and companion anchor in `order.characterAnchors`.*
