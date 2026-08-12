# Story Bank Next Generation — Foundations Implementation Evidence

## Status and authority

- Product approval: Guy accepted the proposed next-generation story workflow on 2026-08-12.
- Branch: `codex/story-bank-next-generation-foundations`.
- Worktree: `C:\Users\guyna\.codex\worktrees\1602\Small_Heroes`.
- Exact base: immutable pushed `22857995df578d366809226a5d693cd783a10ed7`.
- Writer topology: this worktree/branch is the sole writer for this milestone. The prior represented-elsewhere branch was clean, pushed, and at upstream `0/0` before the new branch was created.
- Runtime authority: none. The milestone is staging-only and cannot select or import a customer story.
- Independent QA: pending. Codex does not self-award technical PASS.

## Implemented claims

1. The current story pipeline is fenced from stale authority. V3 remains the approved bank; old V3/V5 prose, old premise files, and the legacy full-prose prompt cannot seed or authorize next-generation work.
2. A general next-generation story contract makes entertainment the visible plot and resilience the underlayer. It hard-gates child want, physical play, two failures, companion wrong help, three comic escalations, child discovery/action, external payoff, locations/set pieces, oral Hebrew, and reread value.
3. Bedtime is defined as an eight-beat energy curve. It may travel and does not require a bed, bedroom, indoor setting, sleep problem, or sleeping ending.
4. All six MVP companion sheets use one complete causal template while preserving IDs, display names, genders, bodies, accessories, sizes, and visual locks.
5. The Koko bedtime tournament contains 12 complete premise candidates across at least six premise families and exactly three finalists. It stops before selection, spine, page beats, and prose.
6. Every finalist supplies exactly three set pieces, three comic escalations, two try/fails, and eight pre-prose events, plus child-owned climax, bedtime energy proof, continuity risks, and explicit old-story non-copy evidence.
7. No approved story or runtime story authority changed.

## Material file set

- `story-pipeline/00_NEXT_GENERATION_STORY_CONTRACT.md`
- `story-pipeline/00b_PREMISE_LAB.md`
- `story-pipeline/00_MASTER_STORY_PROMPT_TEMPLATE.md`
- `story-pipeline/README.md`
- `story-pipeline/01_companions/{fox_uri,panda_anat,bunny_ometz,chameleon_koko,dragon_dini,lion_shaket}.md`
- `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premises.md`
- `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premise-tournament.json`
- `lib/__tests__/story-pipeline-next-generation-foundations.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `CURRENT.md`
- this evidence and the associated Decision Gate.

## Validation evidence

### Focused foundation test

Command:

```powershell
npx --no-install vitest run lib/__tests__/story-pipeline-next-generation-foundations.spec.ts --reporter=verbose
```

Result: **PASS — 1 file / 5 tests**.

The test proves:

- typed staging artifact and exact 12 candidates / 3 finalists;
- unique IDs and at least six premise families;
- complete `StoryPremiseCandidate` strings and key objects;
- all finalists pass the existing deterministic `validatePremiseHardFails`;
- no bedroom/sleepover/home-token/therapy residue in finalist plot fields;
- exactly 3 set pieces, 3 comic escalations, 2 try/fails, and 8 events per finalist;
- all six bibles contain the standardized causal and visual-lock sections;
- the full-prose template is legacy/HOLD and no page prose exists.

### TypeScript

Command:

```powershell
npx --no-install tsc --noEmit
```

Result: **PASS** before the literal check; rerun before commit.

### Literal stability check

Command executed exactly once:

```powershell
npm run check
```

Observed result:

- TypeScript PASS.
- Canonical inventory: 288 specs; ordinary 269; resource-intensive 19.
- Resource-intensive: PASS, 19 files, 2 workers, `101701 ms`, valid diagnostic protocol, no infrastructure failure class.
- Ordinary: the exact six established missing ignored-output fixture assertions plus one workload-census assertion caused by adding the new ordinary spec.
- The implementation-caused census mismatch was `287/268` expected versus `288/269` actual. It was corrected without changing classification policy.

Focused correction command:

```powershell
npx --no-install vitest run lib/__tests__/story-pipeline-next-generation-foundations.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts --reporter=verbose
```

Result: **PASS — 2 files / 12 tests**. The literal full check was not rerun. The repository/release HOLD remains the six known ignored-output fixtures.

### Diff and authority checks

- `git diff --check`: PASS before final staging; rerun before commit.
- `git diff --name-only -- story-bank/v3-approved story-bank/v5-fixed-v2 lib/story-bank-loader.ts lib/story-bank-v3-import.ts lib/companions.ts lib/companion-deep-profiles.ts`: no diff.
- Package and lockfile were not edited. Initial SHA-256 identities were:
  - `package.json`: `7DF1D93BCD93E7CE577525627048584096A04C110FC3D0E9D21436242308993D`
  - `package-lock.json`: `BF7932428AC1BC2CB8885E83A21F231486F35EA36820381B7D1763A77BA03D59`

## Limitations and open decisions

- The three finalists are premise-stage artifacts, not finished stories.
- Guy has not selected A, B, or C.
- No real parent/child read-aloud evidence exists yet because no prose exists.
- The six bibles are staging creative authority and do not yet replace runtime product registry or deep-profile code.
- The existing experimental premise validator includes some story-specific legacy heuristics. Finalists pass it, but a later productionization milestone must generalize or remove those heuristics rather than expanding them.
- No migration/version name, bank loader cutover, visual contract, render, or order compatibility implementation is included.

## Explicit exclusions and cost

No credential access/check/load; no provider/model/network/pricing call; no full prose; no bank import; no order/database/storage write; no render/image/audio/Vision; no Blueprint/Wizard/reader/layout change; no publication/promotion/activation/deployment; no push.

External cost: **$0**.

## Adversarial falsification targets

Claude Code should review the exact immutable base-to-commit range and try to prove:

1. An approved story or runtime authority changed despite the no-runtime claim.
2. The general contract is actually Koko-specific or impossible for another companion.
3. A companion bible lacks desire, flaw, wrong help, escalating comic engine, child-only ability, or visual-lock compatibility.
4. A finalist copies an existing V3/V5 plot, bedroom sequence, home-token cure, or therapeutic payoff.
5. A finalist lacks true child agency, distinct failures, meaningful set pieces, a visible payoff, or a descending bedtime landing.
6. The three finalists are cosmetic variants rather than materially different story engines.
7. The deterministic test proves headings while missing a substantive contradiction.
8. The reported test, package, Git, or cost evidence is inaccurate.

Claude Code's first pass is review-only. Guy retains product/story selection and acceptance.
