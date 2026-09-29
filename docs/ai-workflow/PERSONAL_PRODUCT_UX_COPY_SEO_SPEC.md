# Personal adventures: UX, content and rollout specification

2026-09-29. Guy approved planning/building and use of the existing key. GPT consultation was read-only; recommendations were assessed against actual callers, not treated as authority. Preserve Claude's approved landing visual system. This document describes both this local pilot and future production requirements; those are not interchangeable.

## Product promise

**Resilience/coping is central, not secondary to a personalised gift.** “נכתב כדי לעזור להתמודד” describes an authoring purpose, not an established outcome. A deliberately chosen difficulty should affect events and concrete child choices. Without a chosen topic, uncertainty, flexibility and mutual help may arise from the fictional adventure; do not invent a real problem for the child. The ending can show a modest step while concern remains. Avoid a universal hobby -> failure -> advice -> success worksheet.

A new Hebrew adventure starts in the child's familiar life and moves into an imaginative experience. Personal facts influence decisions and events, rather than filling a biography. The child initiates meaningful actions; the chosen companion has stable personality and a desire/problem of its own. Humour, mutual care, a failed attempt and an earned ending matter more than a lesson. Movement between locations must have a cause. No compulsory kite/chase/giant/four-location template. Fear need not disappear forever. No therapeutic outcome is promised.

All six offered companions are selectable independently of topic. All lengths are adventure with fantasy: short/medium/long are 8/12/16 narrative spreads, displayed as 16/24/32 book pages. Price differences have not been decided. Do not label these lengths bedtime/adventure/fantasy, even though the old catalog uses those identifiers.

## Parent journey and progressive disclosure

1. **Voice first:** short inviting text above the main recording control. Tell us name, age, where the child lives, what they love and what is difficult now. Explicit “nothing particular” is a complete answer. Writing/chips are secondary alternatives, not a competing wall of inputs. Recording is optional; do not start or request microphone permission automatically.
2. **Finish and organise:** one explicit action ends recording and processes it. Processing takes the screen; real activity indication, no fabricated percentage. Playback is optional. Current prototype does not extract facts during recording; do not animate invented live facts or claim streaming extraction.
3. **What we understood:** one editable card, clear origins, missing fields only. Parents can correct recognition (e.g. name/place/hobby), remove even correctly heard facts, and choose an explicit absence of difficulty. Pronouns require evidence from speech or a parent choice, never gender guessed from name/voice. A place for the adventure is not automatically residence. Keep exclusions and corrections across transcript revisions.
4. **Companion:** six names/art choices. Topic is optional and does not constrain companions. A proposed topic is not silently approved after being rejected.
5. **Length/look/voice:** exact length must be selected before paid writing. Photo is optional and currently local-display only. Narration preference is not narration generation. No price yet, no genre selector.
6. **Reviewed summary:** separate facts about the child from creative choices and exclusions. Validation is free. A separate explicit writing button invokes the paid operator pilot; do not conflate request acceptance with book approval.
7. **Manuscript preview:** readable Hebrew text per spread, no JSON as the primary experience. Label it as first text, before images/narration, pending content acceptance. Editing details invalidates the current result; writing another version can change the plot. No “continue to production” button until that handoff exists.

## Error, race and recovery rules

- Double clicking cannot start two jobs. Local server also enforces one job in flight per user and unique user/job IDs.
- Disabled/unauthorised/budget-limited writing does not fall back to an invented sample or weaker model.
- Cancel requests provider abortion and suppresses late UI completion. It cannot promise that a previously dispatched call costs zero or that an upstream service stopped.
- Editing details or leaving the summary aborts/invalidate the current client job. No late result may become the story for a different reviewed request.
- After ambiguous connection failure, do not retry automatically or claim no charge. This pilot lacks durable recovery; the UI explains ambiguity. Production needs persisted job IDs/results and resumable status before public rollout.
- Failed plans do not trigger manuscript calls. Failed prose does not become a catalog source or authorised render candidate.

## Whole-story writer architecture

Strict reviewed request -> server-side options/length/companion resolution -> full causal plan -> plan validation -> manuscript bound to the plan digest -> pending preview.

The plan's resilience mode is derived only from a deliberately chosen topic; proposed child-choice/help moments are bound to distinct positions in the plan. Structural consistency is not semantic entailment or proof of psychological benefit. The adapter owns deterministic numbering from exact array order, never a paid metadata-repair call. A strict browser result envelope checks count/order/identity/approval boundaries and accounting before rendering text.

Only approved facts are sent; no transcript/audio/photo/unreviewed suggestions. Canonical companion speech/humour/body language are used without copying its old category-bound plot role. The plan records per-spread location, reason for movement, child/companion action, consequence, fact IDs and continuity. The same complete plan accompanies manuscript writing. This is authoring data, NOT visual-contract authority. Camera variety must remain possible when future visual planning freezes scene state.

Structural checks establish count/order/identity/known fact IDs, not causal truth, literary quality or accurate personal claims. A test explicitly demonstrates a syntactically valid invented family fact remains pending review. Exact phrase exclusion guards do not catch paraphrases. Future editorial evaluation must inspect the whole story for factual invention, age/voice, real agency, companion behaviour, exclusions, causal transitions and continuity. Do not self-award Editor PASS from JSON compliance.

## Site copy inside the existing design

Implemented local `/dev/personal-product` preserves the existing illustrations, gallery, motion, fonts and visual tokens. The preview-only hero replaces the redundant name/gender form with “להיכנס להרפתקה. למצוא דרך גם כשקשה.”, clear availability disclosure and a voice/writing/chips CTA. The existing public name moment is unchanged. Immediately after the hero, a profile card and hand-written synthetic excerpt show a personal detail and a concrete choice; both are labelled illustrative, not verified engine output. Six cards use companion names; clicks prefill companion only, never topic. Three length cards have no price and prefill length only. Sample/gallery are labelled illustrations; audio button is “להאזין לדוגמת קול”, not proof of newly generated narration. Keep the approved two endpoint Hero captions and creator biographies unchanged.

The public `/` and legacy `/start` still use the old supported product copy and routing. Do NOT partially promote the new copy while routing users into the old topic-bound checkout. A later QA/Guy rollout decision must update the public page, header CTA, deep links, the legacy client copy mirror and product/payment truth together. No deployment in this milestone.

## SEO roadmap, without invented demand estimates

| Future public path | User need / content |
| --- | --- |
| `/` | Personal Hebrew children's adventure; clear promise and honest available capabilities |
| `/how-it-works` | Voice/writing, correction, companion choice, manuscript and subsequent book stages |
| `/companions` | Six distinct personalities; individual pages only with meaningful approved content |
| `/examples` | Public read-aloud examples with explicitly synthetic child/family details |
| `/guides` | A small set of useful original reading/parenting articles, not therapeutic claims |
| `/about` and legal pages | Real creator information, current privacy/terms/accessibility |

Do not manufacture city x age x fear doorway pages, fabricated testimonials/reviews, medical expertise or keyword volume. The proposed title/description are in `content/personal-landing.ts` for rollout review. Build crawlable server-rendered content with semantic headings, visible FAQ answers and descriptive links. Structured data must reflect visible, true content; do not add Offer/prices/availability/ratings before those are verified. No guaranteed rankings or rich results.

Private wizard, manuscript, book, account and job routes stay outside the sitemap with noindex; private APIs use no-store. Child name/place/challenge/transcript must never enter a URL, social/OG metadata, sitemap or analytics event. Preview choice URLs carry only companion/length IDs. Authentication, not robots.txt, controls access. The public legacy name handoff remains unchanged; the personal preview does not load or save it. The personal draft/manuscript remains in component memory; refresh loses it.

Source consultation: Guy supplied `small-heroes-product-copy-ux-seo-he.md`, SHA-256 `e22744aed3c017151dbbeb19962b581e7a91f98c027cb987ccea22091158491e`, and his subsequent explicit resilience emphasis. This is advice assessed by Codex, not rollout/payment authority. Existing three lengths and required completeness with an explicit no-difficulty choice are retained; the alternative two-length/optional-residence proposals were not adopted.

Primary SEO references checked 2026-09-29: [Search Essentials](https://developers.google.com/search/docs/essentials), [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies). Provider implementation/prices: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [model comparison](https://developers.openai.com/api/docs/models/compare?model=gpt-6-sol).

## Production work deliberately still required

Durable authenticated jobs/storage, cross-instance spend/idempotency, cancellation/status recovery, editorial semantic evaluation, approved story-source/visual-plan bridge, continuity-qualified illustrations, narration/package, privacy/deletion policy and truthful pricing/checkout. Existing key access is not authority to deploy, alter the 18 accepted sources, change image QA thresholds or bypass any of these gates.
