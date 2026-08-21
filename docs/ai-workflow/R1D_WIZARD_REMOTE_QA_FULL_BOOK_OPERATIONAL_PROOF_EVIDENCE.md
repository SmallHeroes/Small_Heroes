# R1D Wizard remote QA full-book operational proof — runtime evidence

**Date:** 2026-08-22

## Outcome

The first new-story book Order created through the deployed Wizard reached the
new no-photo child-anchor lane and then stopped safely at its visual QA gate.
This run did not produce a complete book and must not be described as a
successful full-book proof.

Exactly one synthetic fake-paid Order was created. No retry, second Order,
Production deployment, real payment or customer data was used.

## Immutable runtime authority

- Git branch: `codex/qa-wizard-presentation-dispositions`
- Git SHA: `0b711aedd25d39b3813077470f2da1478b14d6b8`
- Preview deployment: `dpl_137gpenMQtXyw8wD4E8rediXwkx1`
- QA alias during the run: `qa.smallheroes.co.il`
- Production fence: deployment `dpl_2X7E6d1acZ5vKJVhLSuKFGP5Q4HN`, Git
  SHA `ed1da86cc114a767dc1086b71a30a4ef4595c097`; unchanged after the QA alias
  move and excluded from the operation.
- Approved new-story path: Chameleon / `TRANSITION` / bedtime / Style 01 /
  eight story beats / 16 physical pages.
- Approved package revision:
  `a9c253d989118262ed2b38a671fc7eccf6af44a084512af35285ad2f548a14fb`.

## Browser path

The browser loaded the restored Landing, `/start`, and the real seven-step
Wizard on the exact Preview. It used a synthetic six-year-old boy profile,
continued without a photo, selected realistic illustrated Style 01, mother
narration and the bedtime product, then completed fake checkout.

The single resulting Order is `cmt3hfqkf0002ky04rqrcc05v`. Its payment is the
staging-only fake-payment record created by the normal QA route. The access key
is deliberately not persisted in this evidence document.

## Persisted result

- Order: `failed`
- Generation job: `failed`, stage `failed`, retryable `true`
- Text: `done`
- Images: `pending`
- Audio: `pending`
- Package: `pending`
- Cover generated: no
- Story-page images generated: 0 of 8
- Audio pages generated: 0 of 8
- Candidate minted: no
- Reader/book assembled: no

The terminal error is:

`ANCHOR_QA_BLOCK: description-template child anchor did not pass semantic and style QA within the bounded attempt budget`

## Generated and evaluated work

The run generated exactly one `gpt-image-2` LOW child-anchor candidate using
reference labels:

1. `style01_child_template`
2. `style01_ref_1`
3. `style01_ref_2`

The uploaded candidate is
`orders/cmt3hfqkf0002ky04rqrcc05v/character-anchors/child-canonical-description-a1.png`.
Its persisted sanitized evidence is:

- identity mode: `description_template`
- face-detect confidence: `1`
- face-area ratio: `0.98296875`
- semantic pass: `false`
- Style 01 pass: `false`
- combined pass: `false`
- selected attempt: none
- child anchor approved: no

Observed provider activity before the stop was one LOW image generation, one
Anthropic Vision request that returned `404 model not found`, the existing
OpenAI Vision fallback, and the OpenAI Style 01 QA call. Local image/face
analysis added no provider image generation. No cover/page regeneration budget
was touched.

## Causal assessment

The implementation correction worked at its intended boundary: a no-photo
Wizard Order now creates a provenance-bound description-template anchor before
cover generation, and an unapproved anchor cannot flow downstream.

The immediate terminal condition was the deliberately branch-scoped
`CHILD_ANCHOR_MAX_ATTEMPTS=1` proof setting combined with a first LOW candidate
that failed both required checks. The approved operational Decision Gate
explicitly states that this override trades retry robustness for bounded
spend, and that an anchor hold under it is not evidence that the ordinary
uncapped product path is defective.

There is also a concrete provider-authority defect: the Anthropic Vision model
resolved to `claude-sonnet-4-20250514`, which returned 404. The OpenAI fallback
still produced usable description evidence, so that 404 is wasted latency/cost
but is not a sufficient explanation for the final failure; the independent
Style 01 check also returned false.

The persisted candidate shape carries only `semanticPass` and `stylePass`.
Because face detection passed, semantic failure must be within the remaining
gender/hair checks, but the exact sub-result is not persisted. Any more
specific explanation would be inference, not canonical evidence. The next
engineering milestone should make these closed, sanitized sub-results
observable before changing prompt, model or thresholds.

## Stop result and next gate

The run obeyed the Decision Gate: it stopped after the single Order and did not
dispatch another image or Order. The failed Order and its anchor remain as
auditable QA evidence.

Before any additional paid run:

1. Claude Code must independently audit this deployment, Order, logs, database
   evidence, provider-call boundary and Production fence.
2. Codex must verify a currently available Anthropic Vision model from primary
   provider authority and fix the stale default/configuration without printing
   credentials.
3. Persist closed semantic sub-results and sanitized style notes for each
   description-template candidate, with fail-closed exact-shape tests.
4. Re-evaluate the branch-only one-attempt policy versus the ordinary bounded
   multi-attempt path. Do not bypass semantic/style QA and do not manually mark
   this rejected candidate passed.
5. Prepare a new operational Decision Gate before a second Order. This evidence
   does not authorize retrying or resuming the failed Order.

## Boundaries

No Production alias/environment/code changed. No real payment, email delivery,
customer data, package publication, Story Source mutation, Board mutation,
manual anchor approval, readiness bypass, second Order or retry occurred.
