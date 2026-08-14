# Story Engine vNext — Approved Source and Next Commission Wave — Decision Gate

**Milestone:** `STORY-ENGINE-VNEXT-APPROVED-SOURCE-AND-NEXT-COMMISSION-WAVE`

**Branch/worktree:** `codex/story-engine-approved-source-next-commissions` at
`C:\Users\guyna\.codex\worktrees\storyqa1\Small_Heroes`, based exactly on
`9cc03186b3fb530e8f228f7896dc12981db2b9ff`.

## Product decision

Guy accepted the musically polished Dini adventure as a good story and asked
to preserve it and continue creating more stories. This is explicit product
acceptance of the story text. It is not approval to bypass illustration-source,
story-bank, Wizard or render qualification.

## Observed boundary

The accepted 12-page candidate and its Editor PASS are content-addressed ignored
artifacts. The candidate deliberately contains prose only. The live approved
bank requires an English `imageDirection` on every text page plus import
traceability. Copying the prose directly over `story-bank/v3-approved/
dragon_dini_adventure.md` would therefore create an invalid visual/runtime
authority and would destroy the rollback source.

The Story Architect route is also still a single Dini pilot. The older 18-slot
Writer projections are too prescriptive for the quality Guy accepted: they
contain a near-complete plot before the writer starts.

## Nine architectural decisions

1. Preserve the accepted Dini text as a new immutable, tracked
   `small-heroes-product-accepted-story-source/v1`, byte-identical to the
   independently audited staging candidate.
2. Bind promotion to the exact Editor PASS, exact candidate digest, exact brief
   identity and a tracked Guy product-acceptance record. A non-PASS Editor result,
   digest mismatch, malformed story or reused output directory fails closed.
3. Product-accepted text is durable source authority only. It grants no
   `v3-approved`, Wizard, Visual Contract, render, QA deployment or Production
   authority.
4. Preserve the existing Dini pilot and historical v2 18-slot commissions. Add
   a new general Story Architect authority rather than mutating old artifacts.
5. Give the Architect only companion inner psychology, a compact creative
   nucleus, direction and page contract. Do not dispatch screenplay beats,
   prescribed objects, locations, body-part choreography, slogans, exact
   discovery, exact climax or exact payoff.
6. Materialize one content-addressed Architect commission for each of all 18
   slots. The accepted Dini adventure is marked complete and excluded from the
   next dispatch set, leaving 17 new commissions.
7. Each commission returns three genuinely different story shapes and stops for
   Guy selection. After selection, the same conversation writes prose under the
   general Writer/Editor route; no rejected option may be blended back in.
8. Scale in coverage waves: first prove one bedtime and one fantasy commission,
   then process the remaining set. Every story independently requires Editor
   PASS, optional musical polish plus re-PASS, Guy product acceptance and
   immutable source promotion.
9. Bank/Wizard promotion is a later reversible cutover. It first adds
   page-grounded visual directions and Story Source evidence, validates both
   gender paths and the full visual pipeline, then replaces one slot while the
   previous approved story remains recoverable.

## Acceptance criteria

- The accepted story is committed as byte-identical tracked source with complete
  digest and acceptance bindings.
- The currently served `dragon_dini_adventure` file is unchanged.
- The general Architect authority contains exactly 18 unique known brief IDs,
  six known companions and the 8/12/16 text-page contract.
- The next-wave materialization contains exactly 17 content-addressed prompts,
  excluding only the accepted Dini adventure.
- No prompt contains detailed legacy story rails or a required companion
  maneuver.
- Focused tests, deterministic TypeScript and `git diff --check` pass.

## Rollback

Revert this milestone. Because the live story bank, Wizard and runtime are not
changed, rollback removes only the new durable accepted source and the new
commission authority. Existing approved stories and all earlier artifacts remain
unchanged.

## Explicit exclusions

No credential access, provider/model/network call, image/audio/Vision render,
story-bank replacement, Visual Contract, Wizard/runtime change, storage/database,
QA/Production deployment, payment action or push.
