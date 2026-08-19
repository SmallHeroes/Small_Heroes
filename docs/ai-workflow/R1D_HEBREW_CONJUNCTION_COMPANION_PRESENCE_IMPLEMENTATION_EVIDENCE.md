# R1D Hebrew Conjunction-Prefixed Companion Presence — Implementation Evidence

## Outcome

Companion identity matching now recognizes one attached Hebrew conjunction `ו`
before a Hebrew proper-name alias. The shared generic standalone-token matcher
is unchanged, and the widening does not apply to species aliases, recurring
humans, child names, denylist entries, or gender markers.

The boundary remains fail-closed:

- `קִים` and `וקִים` match Kim identity;
- `ודניאל` does not match `דני`;
- `מקים`, `הקים`, and `שקים` do not match Kim;
- suffix letters still prevent substring matches;
- niqqud is normalized before matching;
- empty/one-character identity tokens reject.

## Consistent consumers

1. `extractDeterministicFacts` uses the new boundary only for
   `companionNameTokens`; broader species presence retains the old boundary.
2. positive absent-companion `mustShow` contradictions use the same
   conjunction-aware identity boundary, while recurring-human semantics retain
   their existing actor/object classifier.
3. the review report applies the widening only to the companion's name-token
   subset; human and species aliases remain unchanged.

## Canonical Chameleon proof

The exact eight-page `chameleon_koko_bedtime` Story Source and canonical visual
directions now derive companion presence on page 7 from
`{{childName}} וקִים עלו אחריה`. The source-faithful calibration draft passes
the production compiler through the offline repair harness on its initial call:

- outcome: `candidate`;
- repair modes: `[null]`;
- surfaced and complete issue counts: `0`;
- action-coverage census: 8 presentation records;
- provider calls: `0`.

This is an offline structural Candidate only. It is not a persisted canonical
Candidate, Wizard authority, render authority, or evidence that a future model
response will be valid.

## Validation

- Final focused set: **7 files / 101 tests PASS**.
- `npx tsc --noEmit`: **PASS**.
- `git diff --check`: **PASS**.
- One literal `npm run check` ran once and was not retried. TypeScript and the
  autonomous-story typecheck passed. Resource-intensive passed **20 files / 609
  tests**. Ordinary reported **263 passed / 16 skipped / 5 failed files; 3,341
  passed / 65 skipped / 6 failed tests**. Five assertions are the established
  missing ignored-output baseline: one each in
  `child-lexicon-ages-5-8.spec.ts`, `momentum-gate-koko.spec.ts`, and
  `page-entity-qa.spec.ts`, plus two in `story-read-back-validation.spec.ts`.
  The sixth was the stale Vitest inventory introduced by the prior milestone's
  new Chameleon spec (`303/283` versus canonical `304/284`). Only those exact
  counts and an explicit ordinary-path assertion were corrected. The final
  classifier plus all affected suites pass **7 files / 101 tests**; TypeScript
  and diff-check pass. The literal full gate was not rerun.

No missing output fixture was copied or fabricated. No credential, provider,
network, Fresh, live authoring, image generation, Wizard mutation, render,
deployment, or production action occurred.

## Claim boundary

This milestone closes the observed conjunction-prefixed companion identity
defect and proves the exact Chameleon source-shaped fixture offline. It does not
resolve the five Action Semantic gaps, classify the five review-required beats,
prove a provider response, or authorize paid execution.

## Independent QA

Claude Code independently reviewed exact range `1dc1e189..9b87fb4a` read-only
and returned **PASS — 0 BLOCKER / 0 MAJOR / 0 MINOR**. It executed the real
matcher against bare, conjunction-prefixed, niqqud, in-sentence, longer-suffix,
other-prefix, chained-prefix, degenerate and regex-metacharacter cases; verified
the generic matcher and species/human scopes remained unchanged; traced all
three consumers to the shared identity boundary; reproduced Chameleon page 7,
offline `candidate`, zero issues and zero provider calls; and confirmed the
inventory correction exactly names the new ordinary spec.

The review noted only that the private index helper relies on already-normalized
callers. Every current caller supplies niqqud-stripped text, the public helper
normalizes both sides, and an unnormalized future caller would under-detect
fail-closed rather than assert false identity. This was advisory, not a finding.

The PASS authorizes no push, Fresh, provider, persisted Candidate, Wizard,
image, render, deployment, or production action.
