# R3-B1b P1 Exact-Source Package — Zero-Cost Prerequisite Audit

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-accepted-intent-wave-2`

Audit base: `4d7348f28c0d28e27fb331bd5d534755de4dd901`

Status: **AUDIT COMPLETE; STOP BEFORE PROVIDER USE, VISUAL CONTRACT
AUTHORING, BLUEPRINT AUTHORING, BOARD/PROP GENERATION, PACKAGE CREATION OR
PUBLICATION**

## 1. Outcome

P1 `dragon_dini_adventure` cannot be restored by copying or repointing an old
package. The accepted correction is a new exact source authority and currently
has no matching Visual Contract, Blueprint, Board/prop inventory, package-v5
revision or current locator.

The smallest safe route is staged:

1. author and review a Visual Contract for the exact accepted source;
2. after Guy accepts that contract, author and review the matching Blueprint;
3. derive the authoritative Board/prop inventory from those approved artifacts;
4. return the exact LOW image quantity and price authority for a separate gate;
5. only after the required visual assets and approvals exist, assemble, qualify,
   review and approve the immutable package; and
6. promote the package/current locator and prove 18/18 in a separately approved
   publication step.

No provider, image, Vision, audio, database, storage, order, deployment or
publication action occurred in this audit. No package artifact was created.

## 2. Exact accepted source authority

- Story: `dragon_dini_adventure`
- Accepted revision:
  `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`
- Accepted manifest digest:
  `8103e741ce9e7402264f5edac24204bce2b72e4df523fd88031d43ef5d44416d`
- Canonical authoring source:
  `story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/revisions/64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc/integrated.md`
- Canonical source digest:
  `a5942c3646d08bc037395851311e9627bdfc1dd29f7874a45b000b87af416630`
- Source pages: 12, exact page set 1-12
- Accepted world mode: `grounded`
- Source gender mode: `neutral`
- Source-authority snapshot: `story-source-authority-snapshot/v4`, digest
  `8de91442f084a45af642bdaa49bd73f31ba37cf03c00ccd0aafad2995e605f16`
- Source evidence: `source-evidence-catalog/v1`, 124 entries, digest
  `f15b78e7f521b1e692f07eefa8e6741cccc2bc159778b43de9aeb2373a46926b`

The revision-local `story.md` is not the canonical authoring path. A read-only
probe against it failed closed with
`accepted_story_source_revision_path_invalid`. Repeating the same preflight
against `integrated.md` passed. This matters because `integrated.md` is the
strict loader path that binds the accepted Story Source, Visual Directions and
accepted-revision authority together.

## 3. Current continuity and reusable authority

The accepted revision freezes these continuity rules:

- child wardrobe is owned by the future frozen Visual Contract;
- there are no authorized child wardrobe transition pages;
- companion accessories come from the canonical companion profile;
- companion appearance is frozen;
- there are no authorized companion-state transition pages.

Reusable current inputs:

- production style authority exists at
  `style-authorities/style01/soft_hand_drawn_storybook.style-authority.json`
  (`production-style-authority/v1`, file SHA-256
  `0072797006d23661e0cf9542c28e37e9ef21539ce40a2f790e368e510d1e77f9`);
- Dini has six passed Style01 views; minimum measured resemblance is
  `0.9802317213552091`, above the unchanged `0.70` threshold;
- no adjacent source-authored cover authority exists; the current package
  schema permits `authoredCoverAuthority: null`, subject to later candidate
  validation; and
- the accepted source is within the current 16-page authoring policy.

Not reusable as current production authority:

- the existing Wizard candidate is QA-only, `productionEligible:false`, and
  points to `story-bank/qa-autonomous-20260815-v1/dragon_dini_adventure.md`, not
  the accepted `integrated.md` source;
- there is no tracked P1 package-v5 revision or current locator;
- there is no exact-source P1 Visual Contract or Blueprint; and
- there are zero exact-source P1 Set Boards and zero exact-source P1 prop
  references in the tracked registries.

## 4. Zero-cost canonical preflight

The exact accepted source was passed through
`production-visual-lifecycle source-authoring-preflight --write false`. The
result was:

- command exit 0;
- mode `provider_unreachable_source_authoring_preflight`;
- local immutable write `false`;
- request `visual-contract-authoring-request/v55`;
- receipt status `preflight_passed` with zero attempts;
- no persistence result;
- 0 provider/network/image/audio/external writes; and
- blockers limited to the expected downstream work:
  `canonical_import_preflight_not_attested`,
  `action_semantic_coverage_not_evaluated`,
  `visual_contract_candidate_absent`,
  `semantic_reconciliation_absent` and
  `human_source_approval_absent`.

The correctly configured readiness audit also remains byte-stable at semantic
digest `39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`:
17/18 sellable, two accepted lineages, one render-qualified story, P1
`environmentProductSellable:false`, earliest blocker
`package_bound_visual_contract_template_unavailable`, and all effect counters
zero.

## 5. Authoritative source inventory, not yet a Board decision

The accepted Visual Directions contain six distinct setting families:

| Setting family | Pages |
| --- | --- |
| `bakery` | 1 |
| `stone_street` | 2-4 |
| `market` | 5-6 |
| `wooden_bridge` | 7-8 |
| `bumpy_picnic_slope` | 9-10 |
| `picnic_square` | 11-12 |

The same delivery cart recurs on ten pages and the same three-tier fruit cake
recurs on seven pages. These are useful planning signals, but they are not yet
authoritative Set Board or stable-prop declarations. The Visual Contract and
Blueprint own that classification. Therefore:

- current exact `requiredBoardCount`: **undetermined**;
- current exact `requiredPropReferenceCount`: **undetermined**;
- current reusable exact-source Board/prop count: **0/0**; and
- no image-call quantity may be inferred as six Boards or two props merely from
  the prose inventory.

## 6. Exact text-authoring budgets

### Phase P1-A1 — Visual Contract only

- Provider/endpoint: OpenAI Responses
- Model: `gpt-5.6-sol`
- Service tier / reasoning: `default` / `medium`
- Tools: disabled
- Store: false
- Fallback: none
- Transport retries: 0
- Standard calls: at most 7
- Terminal-reference cleanup: at most 1 additional call
- Total calls/repairs: at most 8 / 7
- Maximum input: 80,000 tokens per standard call
- Twelve-page output schedule:
  `40,000 / 32,000 / 36,000 / 24,000 / 24,000 / 24,000 / 24,000`
- Cleanup limit: 12,000 input / 1,000 output
- Deterministic projected maximum: **USD 7.656**
- Independent hard ceiling: **USD 10.00**

This phase must stop after candidate/readiness evidence for Claude Code review
and Guy's visual/product review. It does not authorize Blueprint work.

### Phase P1-A2 — Blueprint only, after accepted Visual Contract

- Provider/endpoint: OpenAI Responses
- Model: `gpt-5.6-sol`
- Service tier / reasoning: `default` / `medium`
- Tools: disabled
- Store: false
- Fallback: none
- Transport retries: 0
- Generation calls/repairs: at most 3 / 2
- Optional exact input-token count probes: at most 2
- Per generation call: 64,000 input / 48,000 output maximum
- Deterministic projected maximum including both count probes:
  **USD 4.928**
- Independent hard ceiling: **USD 5.00**

This phase must stop after Blueprint validation, review packet and Guy's
Blueprint decision. It does not authorize Boards, package promotion or render.

If both text stages are later approved and reached independently, their summed
projected maxima are **USD 12.584**. Their independently enforced hard ceilings
sum to **USD 15.00**. The phases are deliberately not one uninterrupted spend
authority: Guy reviews the Visual Contract before Blueprint authoring begins.

## 7. Why the image budget is not yet exact

The package schema requires the Board and prop identities selected by the
approved Blueprint. Those identities do not exist before P1-A1/P1-A2. In
addition, the repository's `gpt-image-2` estimator intentionally returns no
billing estimate unless explicit current input/output price authority is
configured. The general QA console's `$0.011` LOW estimate is not a contractual
maximum and is not used here as spend authority.

Consequently, an exact full-package USD ceiling cannot truthfully be declared
today. After P1-A2, Codex can return in one zero-cost pass with:

- exact required Board count;
- exact required prop-reference count;
- exact reusable-versus-new asset count;
- exact maximum image calls, including whether any bounded replacement is
  proposed;
- current price authority and a conservative USD ceiling; and
- a smallest-image proof plan using `gpt-image-2` LOW only.

No page render, cover render, HIGH image or full-book render is part of that
Board/prop gate.

## 8. Proposed execution and stop boundaries

1. **New Guy GO for P1-A1 only:** materialize the exact live request, run one
   bounded Visual Contract lifecycle under the USD 10 hard fence, persist its
   evidence and stop.
2. **Independent QA + Guy review:** Claude Code falsifies source identity,
   call/cost evidence, schema/coverage and failure behavior; Guy accepts or
   rejects the Visual Contract.
3. **New Guy GO for P1-A2 only:** run bounded Blueprint authoring under the USD
   5 hard fence and stop at its review packet.
4. **Independent QA + Guy review:** accept or reject the Blueprint.
5. **Zero-cost Board/prop census:** derive exact asset identities and return a
   separate LOW image-call/price gate.
6. **Board/prop gate:** mint only explicitly approved assets, review each and
   stop. No story-page rendering.
7. **Zero-cost package gate:** assemble/qualify package v5, obtain Claude PASS
   and Guy package approval, then separately authorize immutable promotion and
   prove 18/18.

P2 must not begin before P1 is package-qualified, current-locator promoted and
readiness proves 18/18.

## 9. Acceptance criteria for the next gate

P1-A1 may start only if Guy explicitly authorizes the Visual Contract provider
call boundary and USD 10 hard ceiling. Success means a candidate bound to the
exact accepted revision/source snapshot, complete twelve-page coverage,
validated action/source evidence, truthful receipt/cost evidence and no
downstream authority. Failure stops without fallback or transport retry and
does not advance to Blueprint.

## 10. Validation

- exact accepted-source `source-authoring-preflight --write false`: exit 0,
  `preflight_passed`, zero attempts and no persistence;
- correctly configured real readiness audit: exit 0, semantic digest
  `39819a34f01385e1aa6ea11307e788aaeaefa3e4cdf451e3753796c481faad4a`,
  17/18 sellable and zero effects;
- `source-authority-lifecycle.spec.ts` plus
  `wizard-all-story-render-readiness.spec.ts`: 2/2 files and 124/124 tests
  passed;
- `npx tsc --noEmit`: exit 0; and
- `git diff --check`: exit 0 before commit.

`npm run check` was not run for this documentation-only audit. No code, schema,
test, package or runtime file changed, so no repository-wide green result is
claimed.

## 11. Explicit exclusions

This audit and its proposed next gate do not authorize Blueprint authoring,
Board/prop images, package candidate/finalization/promotion, current-locator
change, page or cover render, narration, PDF, database/storage, order/payment,
deployment, release, HIGH quality, full book, fallback or any change to the
0.70 resemblance threshold.
