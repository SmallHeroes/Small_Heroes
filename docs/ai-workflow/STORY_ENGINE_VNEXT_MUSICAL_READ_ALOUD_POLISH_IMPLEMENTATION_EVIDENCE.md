# Story Engine vNext Musical Read-Aloud Polish — Implementation Evidence

**Milestone:** `STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH`
**Base:** `9ebc648f6cbbfaf32e8b16a1148e8237f60eaa4f`
**Branch:** `codex/story-bank-next-generation-briefs-qa-integration`
**Worktree:** `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`
**Status:** independent Claude Code technical PASS; external Editor PASS; Guy product acceptance pending

## Product intent

Guy and the external story writer agreed that the passed Dini cake story can
gain read-aloud energy from rhythm, sound-play and occasional rhyme, but that a
full rhyming scheme would make Hebrew forced and make sound compete with the
story. This milestone turns that judgment into a reusable staging contract.

The implementation is not a rewrite of the Dini story. It creates a separate
polish commission bound to the exact accepted draft and its exact Editor PASS.
The existing candidate remains byte-immutable and authoritative as the safe
fallback.

## Implemented contract

1. `STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md` permits sentence/punctuation
   polish, varied cadence, selective end/internal rhyme, sound-play,
   onomatopoeia and short rhythmic repetition only when they naturally improve
   comedy, motion, tension or page-turn energy.
2. The charter prohibits a full-story rhyme requirement, rhyme quota, filler,
   inverted syntax, unnatural vocabulary, slogans, forced diminutives,
   sing-song repetition and any fact change made to obtain a rhyme.
3. Story identity, metadata, page count/order, event and causal order, child
   agency, companion actions, locations, objects, climax, payoff and ending are
   locked. Personalization chips must contain two complete Hebrew forms, and a
   rhyme cannot depend on one branch only.
4. `STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md` treats musicality as optional. The
   absence of rhyme is never a defect; forced or clarity-breaking rhyme is.
5. `materialize-musical-polish-pilot` admits only a canonical story bound to a
   valid `pass` review with zero issues and zero revision priorities. It rejects
   other verdicts before creating an output root, rejects malformed drafts and
   reused output roots, and writes one content-addressed prompt plus manifest.
6. The Writer receives the exact passed story as JSON data plus only the polish
   charter and compact identity. It does not receive the Architect charter,
   full Editor contract, rejected story options, image directions or downstream
   authority.
7. A returned polish remains staging-only. It requires canonical intake, a new
   Editor v3 review and Guy product acceptance before it may supersede the
   accepted candidate.

## Changed files

- `scripts/materialize-story-commission-briefs.cjs`
- `lib/__tests__/story-commission-materializer.spec.ts`
- `story-pipeline/03_story_briefs/STORY_MUSICAL_READ_ALOUD_POLISH_CHARTER.md`
- `story-pipeline/03_story_briefs/STORY_DRAFT_EDITORIAL_QA_CONTRACT_V3.md`
- `docs/ai-workflow/STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH_DECISION_GATE.md`
- `docs/ai-workflow/STORY_ENGINE_VNEXT_MUSICAL_READ_ALOUD_POLISH_IMPLEMENTATION_EVIDENCE.md`
- `CURRENT.md`

No approved story bank, companion bible/card, Story Source, Visual Contract,
Wizard, Reader, checkout, payment, generation, storage or deployment file
changed. `package.json` and `package-lock.json` retain base blob identities
`d9edfda18f09eccff51d227b54c936d221cd2080` and
`dfa99c4778cf411ba7be5908ed27d9f8cb3ec62f`.

## Materialized zero-cost pilot

Output root:

`outputs/story-engine-vnext-dini-cake-musical-polish-20260814-v1`

Prompt:

`dragon_dini_adventure_wobble_cake_convoy_brief_v1.musical-polish.01932bcf5087d27c004cd63d53c56196afdb3b5b9e5a28724239d5be2cfd3b16.md`

- bytes: `9498`
- raw SHA-256: `01932bcf5087d27c004cd63d53c56196afdb3b5b9e5a28724239d5be2cfd3b16`
- version: `small-heroes-musical-read-aloud-polish/v1`
- status: `staging_pilot_only`
- accepted draft SHA-256:
  `1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465`
- accepted Editor review SHA-256:
  `bed8053efb2bfa61faf15060a29fea4de7051242c0bfa7db585d07307c48e80b`
- polish charter SHA-256:
  `28335f940143fb096beb5cafc447a71df2b03a73b8754ad69de633ea5566ef28`

Manifest:

- version: `small-heroes-musical-read-aloud-polish-manifest/v1`
- bytes: `1418`
- raw SHA-256:
  `2f7969c09b6a9a43468aceb56a467ab77378c770610d820764150b1ea6b9ef2c`

The output is ignored staging evidence and grants no story-bank, runtime,
Wizard, render, QA deployment or Production authority.

## Validation

- `node --check scripts/materialize-story-commission-briefs.cjs`: **PASS**.
- `npx vitest run lib/__tests__/story-commission-materializer.spec.ts`:
  **PASS — 1 file / 12 tests**.
- `npx --no-install tsc --noEmit`: **PASS**.
- working `git diff --check`: **PASS**.

The direct regression covers:

- accepted `pass` plus zero-issue/zero-priority admission;
- exact passed-story embedding;
- content-addressed filename and two-file inventory;
- output-root reuse rejection;
- `revise` rejection before output-root creation;
- malformed personalization rejection;
- explicit no-poem/no-quota and story-lock instructions; and
- exclusion of Architect, full Editor and image-direction authority.

## Literal repository gate — HOLD outside the changed path

The one authorized literal `npm run check` was invoked once and was not
retried. TypeScript passed. The resource-intensive phase passed all **19 files**
in `94,776ms`, exit `0`, with valid diagnostics and no timeout, RPC/IPC,
reporter, launch, signal, teardown or diagnostic-protocol failure. The ordinary
phase ran **280 files**, exited `1` after `37,943ms`, and Vitest reported **72
failed tests across 31 files**. The new 12-test Story Commission Materializer
suite passed inside that ordinary run.

Failed ordinary file inventory preserved from Vitest's run result:

1. `lib/__tests__/anchor-hold-release-isolation.spec.ts`
2. `lib/__tests__/atomic-barrier-wiring.spec.ts`
3. `lib/__tests__/child-lexicon-ages-5-8.spec.ts`
4. `lib/__tests__/chunked-worker-reliability.spec.ts`
5. `lib/__tests__/exception-case.spec.ts`
6. `lib/__tests__/exception-processor.spec.ts`
7. `lib/__tests__/fake-payment-gating.spec.ts`
8. `lib/__tests__/materialize-freeze-wiring.spec.ts`
9. `lib/__tests__/momentum-gate-koko.spec.ts`
10. `lib/__tests__/package-delivery.spec.ts`
11. `lib/__tests__/page-entity-qa.spec.ts`
12. `lib/__tests__/payment-generation-trigger-isolation.spec.ts`
13. `lib/__tests__/payment-provider-none.spec.ts`
14. `lib/__tests__/qa-soft-deliver.spec.ts`
15. `lib/__tests__/quality-evidence-producer.spec.ts`
16. `lib/__tests__/quality-recovery.spec.ts`
17. `lib/__tests__/r1d-dini-bar-five-page-measurement-authority.spec.ts`
18. `lib/__tests__/readiness-manifest.spec.ts`
19. `lib/__tests__/regen-quarantine-refusal.spec.ts`
20. `lib/__tests__/set-appearance-ref-budget.spec.ts`
21. `lib/__tests__/story-read-back-validation.spec.ts`
22. `lib/__tests__/world-qa-gate.spec.ts`
23. `lib/cutover/__tests__/bridge-roundtrip.pg.spec.ts`
24. `lib/cutover/__tests__/quarantine-park.spec.ts`
25. `lib/cutover/__tests__/schema-equality.pg.spec.ts`
26. `lib/generation-chunked/__tests__/delivery-fence.pg.spec.ts`
27. `lib/generation-chunked/__tests__/env-separation-guard.spec.ts`
28. `lib/generation-chunked/__tests__/start-recovery-redrive.spec.ts`
29. `lib/generation-pipeline/__tests__/order-authority-terminal-hold.spec.ts`
30. `lib/generation-pipeline/__tests__/runtime-world-authority.spec.ts`
31. `lib/generation-pipeline/__tests__/safety-release.spec.ts`

This inventory contains the established six absent ignored-output fixture
failures and stale Dini measurement assertion, plus a wider set of unrelated
fixture/environment repository failures. No changed or new Story Engine test
failed. The result remains a repository/release HOLD and is not represented as
a green full check.

## Musical-polish intake and editorial closure

Guy supplied the external Writer's complete 12-page musical polish. The response
preserved the accepted story but repeated the known long frontmatter-closing
delimiter. Intake changed only that delimiter to canonical `---`; no prose or
event was changed during canonicalization.

First canonical musical draft:

- path: `outputs/story-engine-vnext-dini-cake-musical-polish-result-20260814-v1/draft.md`
- bytes: `6549`
- SHA-256: `c06620624b5aa93411993dbcb011685c4763c06b4812789a0d525bed25198811`
- page headers: exactly `1..12`
- canonical intake: PASS

Editor v3 round 1 returned `revise` with `personalization_syntax_invalid` and
`hebrew_readaloud_issue`. It accepted the story mechanism, orange-market comic
peak, child-owned discovery/climax and selective musicality. Codex applied only
the diagnosed group-gender corrections and changed `מוכנה לתפוס משהו אם יצטרך`
to `מוכנה לתפוס אם משהו ייפול`. The diagnostic listed six group forms; a full
same-class scan also found `הם התקדמו` on page 6, which was corrected under the
review's explicit requirement to fix all child/Dini group references.

- round-1 review SHA-256:
  `49451b66ddd76b45055c7731de60212182a0814c96ec819f388ea30b80d44298`
- correction-1 draft SHA-256:
  `3a8ebb99d742080e415755e9e209a6c83259952247ca13e027aa5c12e44a9b1b`
- correction-1 evidence SHA-256:
  `1496d427eaf9d7b989f5916d93b5a4b502719cde667ff9b5139c34342404dac8`

Editor v3 round 2 returned `revise` for one remaining same-class page-11 form,
`שמאחוריהם`. Correction 2 changed only that token to the complete chip
`{שמאחוריהם|שמאחוריהן}`. A full plural-form scan confirmed that the only
unchipped `ביניהם` refers to the masculine-plural oranges, not the child/Dini
group.

- round-2 review SHA-256:
  `20dacce60709341965c0ab1aaa91728682bfed5b7e653e7434404ccd72bbf118`
- final corrected draft: `6677` bytes
- final corrected draft SHA-256:
  `39ad403d98ff528c1313879ec4f4fe020a17271b452040c179938ecf2cc7dfce`

Editor v3 round 3 returned closed verdict **`pass`** with four strengths, zero
issues and zero revision priorities. It confirms natural selective musicality,
correct personalization in both gender routes, differentiated escalation,
child-owned discovery/climax and Dini's behavior-led adaptation.

- round-3 review path:
  `outputs/story-engine-vnext-dini-cake-musical-polish-editor-result-round3-20260814-v1/review.json`
- bytes: `1672`
- SHA-256:
  `292613f4f183e66d9a513111c64d214f7338fc23224eaef023305fbc7d2c94bf`

The pass-only terminal froze a new staging candidate:

- root: `outputs/story-engine-vnext-dini-cake-musical-editorial-pass-candidate-20260814-v1`
- story file:
  `dragon_dini_adventure_wobble_cake_convoy_brief_v1.editorial-pass.39ad403d98ff528c1313879ec4f4fe020a17271b452040c179938ecf2cc7dfce.md`
- story bytes / SHA-256: `6677` /
  `39ad403d98ff528c1313879ec4f4fe020a17271b452040c179938ecf2cc7dfce`
- manifest bytes / SHA-256: `1118` /
  `f1b67a27e476e8fac8339c6d568b608b5c5c45e859c9bea21ec6dda0d34c1f39`
- candidate bytes equal the corrected draft exactly: true

The prior candidate remains byte-intact at 6,462 bytes and digest
`1e40185446b4a9cba0a321d939774d6452fade5a628f2322df616fe4b083a465`.
The new candidate is external-editorially passed staging evidence only. It does
not replace a bank/runtime story without Guy's product acceptance and an
independent artifact-fidelity audit.

## Independent artifact-fidelity PASS

Claude Code independently audited the complete seven-root chain at exact HEAD
`95ffa41943237532cb51b6b96f9b69aad56595a7` and returned **PASS** with zero
BLOCKER, zero MAJOR and zero MINOR. This is Claude Code's verdict, recorded by
Codex; it is not Codex product acceptance.

Claude independently established:

- the final candidate is byte-canonical with exactly 12 sequential nonempty
  pages and one trailing newline;
- all 23 personalization chips contain two complete Hebrew forms;
- correction 1 contains exactly seven group-gender conversions and the one
  diagnosed page-10 clause clarification, with no other change;
- correction 2 changes only `שמאחוריהם` to
  `{שמאחוריהם|שמאחוריהן}`;
- Editor rounds validate as `revise`, `revise`, `pass`, with zero final issues
  and priorities;
- the final candidate and correction-2 draft are byte-identical at 6,677 bytes
  and digest `39ad403d…`;
- the manifest binds the exact round-3 review digest `292613f4…` and PASS;
- the prior `1e401854…` candidate remains byte-intact; and
- no bank, Wizard, Reader, Visual Contract, render, provider, runtime or
  deployment authority exists.

Advisory notes retained without findings:

1. The hand-authored bounded-correction declarations are audit-enforced rather
   than replay-enforced; a future general `verify-bounded-correction` command
   would strengthen this without changing story behavior.
2. `storyEventsChanged:false` is self-declared; Claude substantively verified
   it for both corrections.
3. The page-10 clarification is the only non-chip prose change in the chain and
   is exactly within `hebrew_readaloud_issue@10`.
4. Future plural-form lint must not misclassify the oranges' correct masculine
   `ביניהם`.
5. The unrelated missing generated Prisma client and repository HOLD remain
   unremediated.
6. Claude's probes were read-only and left every artifact byte-intact.

These advisories do not reopen the PASS. Replay verification is deferred as
future general hardening so the accepted story flow does not expand into
another architecture milestone.

## Boundaries and rollback

- credential access: none
- provider/model/network calls: `0`
- image/audio/Vision renders: `0`
- story-bank/import/approval: none
- Visual Contract/Blueprint/Wizard/Reader/downstream authority: none
- storage/database/payment/deployment/push: none
- external cost: `$0`

Rollback is one focused code/documentation revert plus deletion of the ignored
new output root. The previously accepted draft and Editor PASS remain intact,
so rollback does not lose the accepted story.

## Independent-QA result

Claude Code independently reviewed exact immutable range
`9ebc648f6cbbfaf32e8b16a1148e8237f60eaa4f..21ef9652b084dce5a3ea28eb979b36faec1981f5`
read-only and returned **TECHNICAL PASS** with zero BLOCKER, zero MAJOR and zero
MINOR. This is Claude Code's verdict, recorded by Codex; it is not a Codex
self-awarded PASS.

Claude independently confirmed all nine handoff claims, exercised 14 malformed
or unauthorized probes, reproduced **1 file / 12 tests**, script syntax,
TypeScript and `git diff --check`, and rebuilt the shipped polish prompt
byte-identically at 9,498 bytes with digest
`01932bcf5087d27c004cd63d53c56196afdb3b5b9e5a28724239d5be2cfd3b16`.
It verified the exact draft, review and charter bindings and confirmed that no
product/runtime surface changed.

Claude also isolated the wider 72-failure ordinary result to an execution
environment difference: `node_modules/@prisma/client` is installed while
`node_modules/.prisma/client` is absent, and sampled failing suites report
`Cannot find module '.prisma/client/default'`. No changed Story Engine spec
references that client. This diagnosis makes the repository HOLD actionable,
but no Prisma generation or repository-check rerun was performed in this
documentation closeout.

Advisory notes retained without implementation findings:

1. Generate the local Prisma client before the next literal repository check.
2. Editor v3 intentionally changes the digest of any future re-materialized
   Editor prompt; historical prompts remain content-bound and immutable.
3. A returned polish deliberately cannot replace the accepted candidate without
   canonical intake, a fresh Editor v3 PASS and Guy product acceptance.
4. Shared draft intake remains pilot-scoped to `gender: female` and
   `endingType: resolution`.
5. Claude's initial multiline charter regex was its own probe error and was
   corrected before the verdict.
6. Claude's temporary probes remained outside the repository and left the
   worktree clean.

The PASS grants no story-quality/product acceptance, bank import, Visual
Contract, Wizard, Reader, render, deployment or release authority.
