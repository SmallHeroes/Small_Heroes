# SmallHeroes — Project

**Owner:** Guy
**Technical owner:** Codex
**Status:** Pre-launch
**Canonical from:** 2026-07-22

## Product purpose

SmallHeroes creates personalized Hebrew resilience storybooks for children ages 3–8. A parent supplies the child's context, traits, optional photo, challenge, and companion choice. The child becomes the active protagonist of a pre-authored and quality-controlled story, illustrated and delivered through a book-style web reader after human QA.

## Product promise

A sellable SmallHeroes book is:

- a coherent Hebrew story in which the named child is the active hero and makes a meaningful choice;
- emotionally credible and child-readable rather than moralizing or generic;
- visually consistent across the full book: child, companion, clothing, family, location, key objects, and style remain recognizable;
- personalized honestly, with explicit limitations when no usable child photo is supplied;
- readable as a full-bleed book with legible text-on-image;
- released only after the applicable technical, content, visual, payment, and human-QA gates pass.

Guy decides whether a book is sellable. Passing technical tests does not establish product acceptance.

## High-level architecture

```text
Wizard
  → order and product-truth resolution
  → pre-written story-bank selection and personalization
  → chunked generation pipeline
  → resolved visual contract and character/set anchors
  → cover and per-page image generation
  → automated QA and delivery authority
  → human review for held or launch-gated books
  → reader, optional narration/package, and fulfillment
```

Primary runtime landmarks:

- Order entry: `POST /api/orders` and `resolveStoryProductTruth`
- Orchestration: `lib/generation-pipeline/chunk-runner.ts`
- Story source: `backend/providers/story-bank-loader.ts`
- Visual continuity: `lib/visual-contract-compiler/` and the resolved/frozen contract path
- Image generation: `backend/providers/image.ts` and `lib/generate-image.ts`
- Persistence: PostgreSQL/Supabase through Prisma (`backend/schema.prisma`)
- Reader: Next.js reader routes and components
- Stability and release: `npm run check` and `npm run release-check`

`lib/story-generator/*`, `lib/story-gen-v2/*`, `lib/story-gen-v3/*` writers-room code, and `app/api/debug/*` are development or experimental paths, not the customer golden path unless Guy explicitly approves a product change and Codex integrates it safely.

## Core terms

- **Story bank:** pre-written, reviewed story sources used by the production loader.
- **Sellable slot:** an approved combination in the product matrix that is enabled and has passed the required story/product gates.
- **BookVisualContract:** structured continuity authority for recurring people, setting, palette, geometry, and other render-critical facts.
- **Resolved/frozen contract:** the per-order contract that is validated, serialized, hashed, persisted, rendered, and projected into QA.
- **Anchor:** structured identity reference for the child, companion, family member, or set.
- **Human-QA hold:** a delivery state that prevents fulfillment until an authorized operator action resolves or parks the case.
- **Golden path:** the only approved customer order-to-book flow.
- **Product PASS:** Guy accepts the customer-visible result.
- **Technical PASS:** Claude Code independently verifies a Codex implementation after reviewing its evidence.

## Non-negotiables

- Guy owns product direction, priority, visual/story judgment, sellability, and launch decisions.
- Codex owns engineering investigation, architecture, implementation, tests, commits, and technical state.
- Claude Code independently QA's Codex work; Codex does not self-certify.
- Fix general systems, never disguise a story-specific patch as architecture.
- Structured state is authoritative where continuity or delivery safety is critical; prose is not a substitute for a contract.
- A held or unsafe book must not ship automatically.
- Money, order lifecycle, release authority, and migrations require proportionate concurrency/runtime evidence.
- No full book render without explicit approval. Use the smallest proof first unless Guy approves an end-to-end render because only a full run can answer the question.
- Per-page resemblance threshold is **0.70** and changes require Guy's approval.
- Use LOW-cost image auditions by default; HIGH is production-only and approval-gated.
- Preserve backward compatibility when safe; otherwise specify migration and rollback explicitly.

## System boundaries

In scope for the current product: Hebrew personalized digital books, the approved matrix and story bank, illustration generation, human QA, web reader, optional narration where approved, PayMe for the Israeli MVP, and the operational tooling required to fulfill safely.

Not part of the current customer promise without a new Guy decision: physical/printed fulfillment, international/Stripe rollout, additional languages, Style02, fully automated visual acceptance, or experimental story-generation paths.

## Source hierarchy

1. `CURRENT.md` — live technical task and evidence
2. `ROADMAP.md` — milestone state and sequence
3. This file — durable product/architecture contract
4. `QUALITY_GATES.md` — required gates and Definition of Done
5. `SMALL_HEROES_PROJECT_BIBLE.md` — deeper background, including explicitly historical sections

Dated handoffs and `project-os/` retain historical value but do not override a newer canonical root document.
