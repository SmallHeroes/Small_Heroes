# Story Engine vNext — Approved Source and Next Commission Wave — Implementation Evidence

## Topology

- Milestone: `STORY-ENGINE-VNEXT-APPROVED-SOURCE-AND-NEXT-COMMISSION-WAVE`
- Worktree: `C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`
- Branch: `codex/story-engine-approved-source-next-commissions`
- Exact base: `9cc03186b3fb530e8f228f7896dc12981db2b9ff`
- External cost: `$0`

## Product intake

Guy accepted the final musically polished Dini cake story and authorized
preserving it and continuing with additional stories. The final story already
had:

- Editor v3 `pass`, zero issues and zero revision priorities;
- independent artifact-audit PASS with zero BLOCKER/MAJOR/MINOR;
- exact story digest
  `39ad403d98ff528c1313879ec4f4fe020a17271b452040c179938ecf2cc7dfce`;
- exact review digest
  `292613f4f183e66d9a513111c64d214f7338fc23224eaef023305fbc7d2c94bf`.

## Root cause and boundary

The accepted candidate was ignored staging evidence and therefore not durable
source authority. Directly copying it to `story-bank/v3-approved` would also be
invalid: the accepted prose deliberately has no per-page `imageDirection`, while
the approved-bank importer requires one on every page. The live bank therefore
remains unchanged until a later visual-source qualification.

The successful Dini pilot also remained a one-record exception. The historical
v2 commissions contain detailed story movement, discovery, climax and payoff
rails that had caused the external Writer to paraphrase a prewritten plot.

## Implemented contracts

### Product-accepted story source

- Approval record:
  `story-pipeline/04_approved_story_sources/approvals/dragon_dini_adventure_wobble_cake_convoy_brief_v1.product-acceptance.json`
  - 851 bytes
  - SHA-256 `8ed395879be2c589d4aac40835414d4ee5e4a08cff115a54b1ba7a136d490a84`
- Accepted source:
  `story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/story.md`
  - 6,677 bytes
  - SHA-256 `39ad403d98ff528c1313879ec4f4fe020a17271b452040c179938ecf2cc7dfce`
  - byte-identical to the audited staging candidate
- Preserved Editor result:
  `story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/editorial-review.json`
  - 1,672 bytes
  - SHA-256 `292613f4f183e66d9a513111c64d214f7338fc23224eaef023305fbc7d2c94bf`
  - byte-identical to the externally returned Editor PASS
- Manifest:
  `story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/manifest.json`
  - 1,620 bytes
  - SHA-256 `332c37ff00be6a3bbccc7afd858b063bcb430750d1242e856b9d51930e9f6c0a`

`promote-product-accepted-story` accepts only a canonical draft, a closed Editor
PASS, exact digest-bound Guy acceptance and an empty child directory under the
accepted-source root. It rejects non-Guy approval, findings, digest drift,
malformed story intake, path escape and output reuse.

### General Story Architect

- `STORY_ARCHITECT_CHARTER_V3.md` is companion-general and preserves the
  interactive three-options-then-stop workflow.
- `companion-creative-psychology.json` contains six inner-character records and
  explicitly rejects fixed companion shortcuts.
- `story-architect-commissions.json` contains exactly 18 compact premise nuclei,
  one for every known slot.
- The prompt includes direction, 8/12/16 text pages, 16/24/32 physical pages and
  required frontmatter, but does not dispatch the legacy screenplay projection.
- `materialize-architect` creates one commission.
- `materialize-architect-wave` excludes one already accepted brief and requires
  the remaining coverage to equal exactly 17.

## Materialized next wave

Ignored zero-cost staging root:
`outputs/story-engine-vnext-next-architect-wave-20260814-v1`

- files: 19 = 17 content-addressed prompts + `manifest.json` + `INDEX.md`;
- manifest: 8,151 bytes, SHA-256
  `834f2fd4d4fd85b4eb30f0c318668a7a56f48ff49565468ce16c43c6e4811ece`;
- index: 4,133 bytes, SHA-256
  `5c0a9787e863da15b820a970a112e851eeb451b3c2f8598945086706bb660cf5`;
- direction counts: six bedtime, five adventure, six fantasy;
- unique brief IDs/files: 17/17;
- excluded brief: only the product-accepted Dini adventure;
- forbidden prompt-key scan: zero hits for `storyMovement`, `childDiscovery`,
  `childClimaxAction`, `visiblePayoff`, `companionWrongHelp` and
  `imageDirection:`.

## Validation

- `node --check scripts/materialize-story-commission-briefs.cjs`: PASS
- `npx vitest run lib/__tests__/story-commission-materializer.spec.ts`:
  **1 file / 15 tests PASS**
- `npx --no-install tsc --noEmit`: PASS
- `git diff --check`: PASS
- direct promotion command: PASS
- direct 17-record materialization command: PASS
- diff from base under `story-bank/v3-approved`,
  `backend/config/mvp-story-matrix.ts` and
  `backend/providers/story-bank-index.ts`: empty

## Unchanged and out of scope

The currently served Dini adventure remains byte-intact at SHA-256
`67e459f3fe3aacb513a965df786c977f53e594cfa3cc2e9f8bf3c4c1c4f6247c`.
No provider/model/network call, credential access, image/audio/Vision render,
story-bank import, Visual Contract, Wizard/runtime change, payment,
storage/database, QA/Production deployment or push occurred.

## Next operational sequence

Dispatch one bedtime and one fantasy Architect prompt first. For each: Guy
selects A/B/C, Writer drafts, Editor returns closed PASS/revise/reject, optional
musical polish re-enters Editor, and Guy accepts the final text. Only after text
acceptance should the visual-source/image-direction and bank/Wizard milestone
begin.

This document records Codex implementation evidence. Independent Claude Code QA
is pending and no technical PASS is self-awarded.
