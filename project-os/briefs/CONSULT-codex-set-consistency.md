# CODEX CONSULT — cross-page SET consistency (the drift we keep fighting)

## 1. ROUTING + TARGET
- **Reviewer:** Codex (design consult). **Mode:** read-only reasoning over the render pipeline on `feat/chunked-generation` (`lib/visual-contract-compiler/*`, the image-gen prompt assembly, the character-anchor/seed mechanism) + the live fox evidence; cite `files:lines`.
- **Gate type:** design (not a commit re-gate). Decide the PRIMITIVE before we build — this is the core product problem (visual consistency).

## 2. ORIGIN / CONTEXT
Live fox render (order cmrnuhsva, staging @ d63f036e, 12 pages) eyeballed by Guy:
- **Locks that WORK:** the child, the companion (Uri + neck-lantern), and the tin bucket are consistent across pages. So character/companion/prop locking succeeds.
- **What DRIFTS:** the whole environmental SET re-improvises every page — railing design, wall, balcony corner, background all change page-to-page. Contract-v2 locked spatial LABELS/RELATIONS (window-vs-door kind, bucket-below-ledge) and the character anchor, but **nothing locks the SET's full visual appearance**, and the per-page image prompt carries **no cross-page visual reference for the environment** (only the character anchor/seed). So page N's background is unrelated to N-1's.
- **Canonical set decided (Guy, confirmed):** the fox story has a **מרפסת (balcony) with a window + railing, NO door** (p1 "נשמע מתחת לחלון" = window; p4/p5 "מעקה"/"קצה המרפסת" = balcony; the glass exit-door in p2 was invented, not in the text). So the target is ONE consistent balcony set across all pages.

## 3. THE PROBLEM
Make the SET (balcony: railing, wall, corner, floor, background, the window) **visually identical across every page** — WITHOUT dragging the character's pose/composition or compounding errors — as a GENERAL system (not a per-story hand-built set).

## 4. DESIGN SPACE — rule on these
- **(a) Guy's idea: feed the PREVIOUS page image as a reference** to the next page's generation. Simple, uses real pixels. **Tension to resolve (Guy's own prior principle):** "never use a composed room/scene reference on every page by default if it can drag composition; prefer isolated objects / set boards / approved seeds." Does previous-image-ref drag pose/framing and compound errors down the chain? Is there a safe form (e.g. reference only a cropped background region, not the full composed page)?
- **(b) Dedicated SET-PLATE / set board:** render the empty balcony ONCE (canonical), then use it as a fixed background reference for every page — same set, character composited fresh each page. Locks the set, frees the pose.
- **(c) Isolated set-object refs:** railing / wall / window as separate locked reference crops.
- **(d) Approved-seed lock** for the set portion.
- **(e) Set Topology Lock:** extend Contract-v2's spatial nodes into a full, byte-identical structured SET description injected every page (deterministic prose, no image ref).

## 5. QUESTIONS FOR CODEX (rule on each)
1. Which primitive gives **set consistency without composition drag or error compounding** — (a) previous-image, (b) set-plate, (c) isolated refs, (d) seed, (e) set-topology, or a combination? Give the recommended default.
2. Specifically adjudicate **Guy's previous-image idea** vs. a **set-plate/board** — with the composed-scene-drag principle in mind.
3. How does it plug into the CURRENT pipeline — extend `buildVisualContractPromptBlock` / the contract's spatial nodes (text-only), add a reference-image channel to the image call, or both? Does it reuse the existing character-anchor reference mechanism?
4. Cost/complexity for the soft launch (per-book set-plate render cost? one extra generation per book?).
5. Generality: the primitive must work for ALL stories/sets, not just fox's balcony (Guy's hard principle: fix general systems, not per-story hand-built sets).

## 6. CONSTRAINTS (must hold)
General system, not a per-story hand-built set · must NOT drag character pose/composition · must not compound errors · reuses/extends Contract-v2 rather than replacing it.

## 7. COWORK'S RECOMMENDATION (confirm or override)
**Primitive (b): a SET PLATE.** Generate ONE canonical set image per book — an empty establishing view of the balcony (railing, wall, corner, window, floor, background), NO character — then pass it as a **set-reference on every page's generation, alongside the existing character anchor**, while Contract-v2 stays the text spec (relations/kinds). Rationale:
- **Mirrors the mechanism that already WORKS** — characters/companion are consistent because they ride a reference anchor; the set drifts because it has none. Give the set the same treatment.
- **Beats Guy's previous-image idea:** a set-only plate carries NO character pose/composition to drag, and it's a FIXED reference (no error-compounding down the chain).
- **Beats text-only (Set Topology):** the fox proof showed the contract text DID feed through, yet the set still drifted — text alone can't pin the visual look; a visual anchor can.
- Cost: one extra generation per book (cheap).

## 8. OUTPUT
Confirm the Set-Plate recommendation OR override with a better primitive, and name the specific pipeline integration: does the image call already pass a character-anchor reference, and can it take a SECOND reference (set plate) WITHOUT gpt-image-2 dragging composition from it? How the set-plate is generated + frozen + reused; how it coexists with Contract-v2; and a minimal validation (re-render fox, assert the balcony set is identical across pages). Rule explicitly on Guy's previous-image idea (accept / accept-in-a-safe-form / reject).
