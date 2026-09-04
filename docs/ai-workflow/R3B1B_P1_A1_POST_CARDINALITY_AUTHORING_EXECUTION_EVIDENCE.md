# R3-B1b P1-A1 Post-Cardinality Visual Contract Authoring — Execution Evidence

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-p1-a1-post-cardinality-authoring`

Execution base: `18f22e758810d5118d9b5bcad7f27b0d07b76b7b`

Status: **LIVE EXECUTION COMPLETED; ARTIFACT-INTEGRITY PASS; SEMANTIC HOLD;
NO BLUEPRINT OR DOWNSTREAM AUTHORITY**

## Authority and scope

Guy explicitly authorized the bounded P1-only live attempt and then explicitly
directed Codex to use the existing declared OpenAI credential source. The
credential value was never printed or persisted. This execution covered only
the Visual Contract candidate for accepted P1 `dragon_dini_adventure` revision
`64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`.

It did not authorize or perform another story, Blueprint, Board/prop image,
page or cover image, package assembly or promotion, locator change, render,
narration, publication, deployment, order, database/storage mutation or
payment work. The attempt authority is consumed by this terminal result.

## Frozen input and Fresh Readiness

The exact accepted input was:

- story key: `dragon_dini_adventure`;
- source path:
  `story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/revisions/64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc/integrated.md`;
- source SHA-256:
  `a5942c3646d08bc037395851311e9627bdfc1dd29f7874a45b000b87af416630`;
- source snapshot v4:
  `8de91442f084a45af642bdaa49bd73f31ba37cf03c00ccd0aafad2995e605f16`;
- 12 pages, `grounded` world mode and neutral child-gender authority; and
- authoring policy/routing `v22/v2` using OpenAI Responses
  `gpt-5.6-sol`, service tier `default`, reasoning `medium`, tools disabled,
  `store:false`, zero transport retries and no fallback.

Canonical Fresh Readiness v51 was prepared under ignored root
`outputs/r3b1b-p1a1-v22r2-02` and reached `ready_for_spend_gate` at digest
`0e65f35e5da8e7cb2a536b46a77b76fab561829bc41c29e7fa26db8bd5de1b73`.
It recorded `credentialAccess:none`, `providerCalls:0`,
`pricingAuthority:not_checked`, `canonicalPreflight:not_run` and
`liveAuthority:none`. The bound execution request v51 is
`a3e90b8737746384a12fab3a5dbadd63415e95f6784eddcf1b93d2299b5b83ca`;
Supervisor verify returned `ready` with digest
`774b50cf357e61273f03f1b66176fa69f09ca5007a3564a37dc66bec7ca36882`.

The first Fresh Readiness preparation invocation was rejected at the input
boundary because an absolute Story Source path was supplied where the canonical
repo-relative path is required. Its failure digest was
`9f56e78ed6deb82bf7eda651dd77509c013c45cd6888a1d3183b24ce6ced7183`.
It read no credential, made no provider call and created no attempt output
root. The corrected invocation used the canonical repo-relative path and the
same frozen request identity.

Before dependency bootstrap, the original ordinary `.vite`-only cache was
preserved intact at the exact external path recorded by the Decision Gate. Its
single 968-byte `results.json` has SHA-256
`11b3a0fc8284da7acb273038d057c5703845c9c35e4dc7fed7ec18881b8e9e49`.
The freshly installed dependency tree remains in place through independent QA;
restoration is a separate audited closeout.

## Single live execution result

Codex invoked the canonical Supervisor `live` entry exactly once. It returned:

- result version `canonical-live-execution-result/v44`;
- status `child_completed`;
- child exit `0`, with stdout and stderr suppressed by the boundary;
- `sourceAccessAttempted:true`, `sourceReadSucceeded:true` and
  `authorityCleared:true`; and
- child output authority v2 digest
  `118e5aa1e728d6665e54cd6727dad49604e0519d2ed6a339ce5fd7c67234696f`.

The exact Supervisor stdout was recovered from this Codex task's local session
record, validated against the bound request and all child artifacts, and
captured canonically under the attempt's required `execution` boundary. The
captured result digest is
`c200b90d18b7648ce2c4b65aa264f9ab98ea4bfd02fab9cec05b073717512972`;
its canonical file SHA-256 is
`d139ccc7c0323d8812d1dade8056c7985aefb29a14e78a21e2e866428cfaf97e`.
Capture used the repository's offline QA bridge and reported zero credential,
provider, image, network, database and production effects. Its temporary
source/request files were removed after the immutable result was created.

## Provider calls, usage and cost

Receipt v59
`b6c0b37e9c7b7007a9aee47bf39f691e263ca32657ee9491c6dc9ae0204940bf`
records:

- one logical provider call and one transport dispatch;
- the single attempt was `initial` with a 40,000-token output allowance;
- zero repairs, zero cleanup calls, zero retries and no fallback;
- 13,151 input tokens, of which 13,148 were reported as cache-write input;
- zero cached-input tokens;
- 15,528 output tokens, including 1,787 reasoning tokens;
- 28,679 total tokens;
- nominal estimated cost **USD 0.376312**; and
- conservative accounted cost **USD 0.413947**.

The conservative cost is below both the projected USD 7.656 reservation and
the hard USD 10 attempt fence. Neither unused call capacity nor unused dollars
authorize a retry or later stage.

## Candidate and deterministic verification

The provider run produced immutable candidate artifact v9
`efbdd2e13c03af194af425c5e050e0bfedad29d4e0c8cec1aa8b54530192ad88`.
The candidate artifact digest must not be confused with its inner template
digest
`8632bd95869b93bf115500f3a24890daaa967a39805079e2f0ae86afc2543b18`.
The template has:

- `vc-schema/v4`, correct story key and 12 unique page contracts, 1 through 12;
- two locations and eight zones following bakery → street → market → bridge →
  slope → picnic square → picnic grass;
- grounded physical-comedy world authority with no magic;
- child `child:hero` and companion `companion:dragon_dini` present on all pages;
- three recurring props: cake, delivery cart and page-12 tablecloth; and
- 77 Action Semantic Coverage records, 77 unique beat ids and zero gaps.

The authoring readiness v56 digest is
`9466af78e073d06b917bd77d2c3dada46444d73fa20b5ee850831d48886c61c1`.
It remains `blueprintAuthoringReady:false` and exposes three blockers:
`canonical_import_preflight_not_attested`, `semantic_reconciliation_absent`
and `human_source_approval_absent`.

The official captured-response replay evidence v2 is
`3134695bf93fc38d94531f6fe7f073e5724f4ef6327330243a141ce0fe26c879`.
The repository replay command exited `0` with `providerCalls:0`,
`exactCapturedCallSequence:true`, candidate outcome and full receipt/candidate/
terminal/congruence agreement.

After the captured Supervisor result was bound, the QA Wizard bridge created
candidate-validation attestation v1
`0bef17bd3a5b863ba2173a78dd5b50940bc9f202f2f13cfd2310a96fdaf1f858`.
It records `validateBookVisualContractTemplate` status `passed`, zero structural
errors and exact source/request/receipt/readiness/result/candidate bindings.
Its file SHA-256 is
`6cc3bf34eb191af2c04b38eedc6b97635a58ca96c3f5d17715f01793fc253248`.
This is structural validation for reconciliation only; it is not semantic or
product acceptance and authorizes no Blueprint or later work. Its consumer
HEAD is the exact live base `18f22e758810d5118d9b5bcad7f27b0d07b76b7b`.
The later documentation commit necessarily advances HEAD; the attestation
therefore remains immutable historical validation evidence but cannot be used
as current downstream bridge authority. Any future reconciliation must first
mint a fresh candidate-validation attestation at the then-clean pushed
consumer HEAD.

The live boundary added exactly four child artifacts to the eight frozen
pre-live artifacts: receipt, candidate, authoring readiness and replay
evidence. Their 12-file inventory was 395,081 bytes with inventory digest
`b2c8dd65a2218fa839a3233fb6bb8de181ccaa70ff8d6d553e2b7dcbec7e3267`.
The later offline result capture and candidate-validation attestation bring the
contained attempt to exactly 14 JSON files and 412,516 bytes. A secret-pattern
scan of those two later artifacts found no API key, bearer token, key
assignment, `.env` path or declared external credential path.

## Semantic review — HOLD

Artifact integrity and deterministic replay pass, but adversarial source
review found three P1 semantic defects. Candidate acceptance is therefore
**HOLD**:

1. **Cover contradiction.** The cover positively requires the three-tier cake
   and delivery cart while its compiler-derived `mustNotShow` also forbids each
   as a page-1 spoiler. The page-12 tablecloth is only forbidden and is not a
   contradiction. The repository already has the exact
   `cover_visible_recurring_prop` offline correction lifecycle, but Guy must
   first decide whether cake and cart remain visible on the cover.
2. **Supporting-human authority is absent.** The accepted source and Visual
   Directions require the baker on pages 1 and 12, the broom man on page 5,
   the band/children on page 9, and the band/birthday girl on page 11. The
   candidate has `humanCast:[]` and every page `castIds` contains only the
   child and Dini. The current deterministic human extractor recognizes only
   kindergarten guard, doctor and parent roles, and the compiler deliberately
   replaces drafted humans with that closed fact set. The validator therefore
   cannot see these omitted roles. Blueprint/runtime authority derives cast
   only from `humanCast` and frame/page `castIds`; leaving the prose alone would
   make the required humans uncontrolled or absent in render.
3. **Running is downgraded to walking.** Pages 6 and 10 explicitly say Dini
   runs, but their source beats and action requirements use `walks`. The
   current closed action catalog contains `walks` and no `runs` predicate, so
   this is a general catalog limitation rather than a story-key special case.

Three secondary P2 review items remain: decide whether the delivery cart is
visibly parked on page 12 instead of simultaneously required and described as
optional; replace the overly dramatic `recoils` mapping for Dini's gentle,
deliberate hand withdrawal; and preserve the source's male broom-holder,
female birthday child and active baker action when supporting cast is modeled.

Positive semantic evidence remains useful: all 12 pages have authored page
contracts; the grounded/no-magic world and main route are coherent; child/Dini
presence is stable; and most cake/cart/fruit/tablecloth continuity is faithful.
The paid candidate is preserved as evidence and must not be hand-edited or
presented as accepted.

## Validation and containment

Pre-live Codex validation passed both TypeScript projects and 15 focused test
files / 732 assertions. Post-live:

- `npx tsc --noEmit` exited `0`;
- `npx tsc -p tsconfig.story-autonomous.json` exited `0`;
- two identical runs of the five-file pre-live/Supervisor/replay/launcher
  battery each completed all five files and all 114 assertions successfully,
  but each Vitest process exited `1` after two known `onTaskUpdate` worker-RPC
  timeouts;
- the heaviest readiness file repeated in isolation with all 14 assertions
  successful and the same single post-assertion RPC timeout/exit `1`;
- the existing cover-source-fidelity and exact candidate-cover-correction
  suites exited `0` with 2/2 files and 17/17 assertions;
- the official zero-provider replay exited `0`; and
- the real Wizard audit remained digest
  `7c14d841a76c09ddf44bcad79cb465e2bd0c6cff60505620f111c705d1682926`,
  18 nominal records, 17 product-sellable, two accepted lineages and one
  render-qualified story, with every effect counter zero.

The Vitest runner noise is disclosed as non-green process evidence; no test
assertion failed. `npm run check` was not rerun, so the previously documented
repository-wide missing-ignored-fixture/corpus/RPC baseline remains unchanged
and no full-gate green result is inferred.

No production selector saw the ignored candidate. P1 remains unqualified and
17/18-contained. No Blueprint, Board, image, package, locator, render,
publication, deployment or payment artifact exists from this milestone.

## Root cause and next gate

The post-cardinality repair worked: the former duplicate coverage-cardinality
failure did not recur, and the draft passed current validators in one call.
The remaining defects expose two broader closed-domain gaps plus one explicit
product choice:

- generic accepted supporting-character authority is missing from the
  deterministic human fact layer;
- the action predicate vocabulary cannot represent running; and
- cover-visible page-1 props require Guy's exact semantic disposition.

The recommended next milestone is provider-free implementation planning for a
general supporting-cast authority and `runs` action semantics, plus an exact
Guy cover/page-12 disposition. It must be a new Decision Gate and must prove
the behavior across representative stories rather than special-case Dini.
Only after that correction independently passes should Codex request a fresh,
single P1-only re-authoring spend gate. P2 and all later stories remain stopped;
payment remains last by Guy's product order.

## Independent QA handoff status

This document records Codex and read-only audit-agent measurements. It does not
self-award the independent Claude Code PASS required by `AGENTS.md` and
`QUALITY_GATES.md`. Claude Code must review the exact documentation commit and
the local ignored artifacts above, falsify the technical claims, and separately
confirm or reject the P0=0 / P1=3 / P2=3 semantic classification.
