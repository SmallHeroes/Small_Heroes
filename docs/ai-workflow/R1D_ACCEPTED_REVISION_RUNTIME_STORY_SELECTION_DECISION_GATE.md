# R1D accepted-revision runtime Story Source selection — Decision Gate

**Owner decision already supplied:** Guy approved the exact gender-flexible
Chameleon Story Source revision and instructed Codex to continue autonomously
until a fresh Wizard book can be produced through the new engine.

## 1. Proposed change

Teach the frozen Order/runtime path to rehydrate either the historical
`story-bank/<bank>/<storyKey>.md` form or the product-accepted revision form
`story-pipeline/04_approved_story_sources/accepted/<storyKey>/revisions/<revisionDigest>/integrated.md`.
The parsed authority carries an explicit story key and exact repo-relative
source reference through text finalization, Visual Package freeze, resume and
render qualification.

## 2. Why now?

Fresh Wizard selection already freezes the exact Story Source named by the
current Visual Package. The accepted revision uses a nested path, but the Order
rehydrator accepts only the old three-segment Story Bank form. It therefore
falls back to the historical QA story and later fails closed with
`frozen_product_truth_mismatch`. If the nested basename leaks through, contract
freeze derives the false key `integrated`.

## 3. Scope

General runtime authority correction for every future product-accepted Story
Source revision. It is not a Chameleon-, child-, companion- or page-specific
branch.

## 4. Risk of hardcoding

The implementation recognizes one versioned directory grammar and closed
story-key/revision-digest syntax. It does not embed the current Chameleon key,
revision digest, source phrase or page count.

## 5. Files likely affected

- `lib/generation-pipeline/story-path.ts`
- `lib/generation-pipeline/types.ts`
- `lib/generation-pipeline/text-finalization.ts`
- `lib/generation-pipeline/ensure-frozen-visual-contract.ts`
- `next.config.js`
- focused runtime, freeze, qualification and tracing tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

A fresh Order rehydrates only its exact frozen source path, proves its bytes,
page count and direction against the Order before personalization, persists the
explicit story key, and loads the matching current/frozen Visual Package.
Malformed, stale, cross-story or escaping paths fail before provider access;
an accepted revision never reconstructs from the historical Story Bank.

## 7. Validation plan

1. Test both accepted path grammars and reject traversal, wrong basename,
   digest, story key and arbitrary nested paths.
2. Prove frozen truth equality is checked before `loadStoryFromBank`.
3. Prove contract freeze uses the explicit accepted-revision story key on fresh
   and resume paths.
4. Prove the accepted source is included in every relevant Vercel function
   trace.
5. Run focused suites, TypeScript and `git diff --check`, then independent
   Claude Code QA.

## 8. Cost impact

Zero. No image, audio, LLM, provider, database, storage or deployment operation
is part of this milestone.

## 9. Rollback plan

Revert the focused runtime commit. Existing Orders, Story Bank files, accepted
revisions, packages, locators and Boards remain immutable.

## 10. Review assignment

Claude Code must try to falsify cross-story/revision replay, raw-SHA mismatch,
fallback reachability, cache/resume identity, path traversal/link escape,
package key selection and serverless asset inclusion.

## 11. Do not do

- Do not widen the parser to arbitrary repository Markdown.
- Do not mutate historical Story Bank files or accepted revisions.
- Do not bump `story-product/v1` or add a database migration.
- Do not author, approve, publish or promote a Visual Package here.
- Do not call a provider, deploy or render.
