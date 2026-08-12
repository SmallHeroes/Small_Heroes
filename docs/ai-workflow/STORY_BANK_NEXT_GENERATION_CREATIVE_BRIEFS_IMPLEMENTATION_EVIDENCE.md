# Story Bank Next Generation — Creative Briefs Implementation Evidence

## Status and authority

- Product direction: Guy instructed on 2026-08-12 to let ChatGPT write stories from a supplied structure and to author a brief for every story.
- Branch: `codex/story-bank-next-generation-creative-briefs`.
- Worktree: `C:\Users\guyna\.codex\worktrees\1602\Small_Heroes`.
- Exact base: reviewed local foundation commit `5368bce73978e159fe1d64ab2662e8e734cfa29b`.
- Writer topology: this branch/worktree is the sole writer for this milestone.
- Runtime authority: none. All briefs and future model drafts are staging-only.
- Independent QA: Claude Code issued PASS on the initial exact range with two minor findings, PASS on the correction and combined ranges with both original findings closed and two new guard-design minors, then final PASS on the remediation and combined ranges with both new minors closed and no findings. Codex records Claude's verdict and does not self-award technical PASS.

## Implemented claims

1. One shared, slot-neutral ChatGPT writer contract replaces the legacy prose template for next-generation staging drafts.
2. Exactly 18 complete structured briefs cover the current MVP matrix: six companion/category pairs × bedtime/adventure/fantasy.
3. The briefs spend human judgment on story identity and causal constraints without prewriting page prose or a page-by-page spine.
4. ChatGPT remains responsible for exact page realization, dialogue, oral rhythm, and local blocking inside the accepted brief.
5. Every brief locks a strange opening, concrete child want, physical problem, playable rule, meaningful set pieces, companion-caused wrong help, three comic escalations, two causal attempts, child discovery, child-owned external climax, visible payoff, direction energy, bounded continuity, reread hooks, safety, and anti-copy exclusions.
6. Every brief has a unique ID, working title, mechanic key, opening hook, climax action, and payoff. No approved old story is a positive prompt input.
7. The selected Koko/bedtime B premise is retained as a compact brief. The rejected hand-authored spine was removed and never committed.
8. Existing approved banks and every production/runtime surface remain unchanged.
9. Every brief uses `{{childName}}` and distinct pipe chips where child grammar differs; naturally invariant Hebrew remains unchipped. Deterministic validation rejects malformed placeholder syntax and undeclared structure. Hebrew morphology, male/female variant order, and semantic coverage remain human language-QA responsibilities.

## Material file set

- `story-pipeline/03_story_briefs/README.md`
- `story-pipeline/03_story_briefs/STORY_WRITER_CONTRACT.md`
- `story-pipeline/03_story_briefs/STORY_BRIEF_REVIEW_HE.md`
- `story-pipeline/03_story_briefs/story-brief-catalog.json`
- `story-pipeline/03_story_briefs/briefs/{fox_uri,panda_anat,bunny_ometz,dragon_dini,chameleon_koko,lion_shaket}.json`
- `story-pipeline/00_NEXT_GENERATION_STORY_CONTRACT.md`
- `story-pipeline/00b_PREMISE_LAB.md`
- `story-pipeline/00_MASTER_STORY_PROMPT_TEMPLATE.md`
- `story-pipeline/02_prompts/drafts/chameleon_koko__bedtime.premises.md`
- `story-pipeline/README.md`
- `lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts`
- `lib/__tests__/story-pipeline-next-generation-foundations.spec.ts`
- `lib/__tests__/vitest-workload-classifier.spec.ts`
- `CURRENT.md`
- this evidence and the associated Decision Gate.

## Validation evidence

### Focused creative, compatibility, and census selection

Command:

```powershell
npx vitest run lib/__tests__/story-pipeline-next-generation-creative-briefs.spec.ts lib/__tests__/story-pipeline-next-generation-foundations.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
```

Result after guard-design remediation: **PASS — 3 files / 20 tests**.

The new test proves:

- exact 18-slot equality with `MVP_STORY_MATRIX`;
- six companion sets and bedtime/adventure/fantasy completeness per set;
- exact 8/12/16 page contracts;
- complete brief fields, meaningful set-piece minima, causal-movement bounds, exactly three comic escalations and two attempts;
- bounded recurring objects and transient cast;
- explicit child ownership of discovery and climax;
- companion-specific causal markers and indispensability;
- no known old plot fingerprint or direct therapy/moral language in positive creative fields;
- all 18 IDs, titles, mechanic keys, hooks, climaxes, and payoffs are unique;
- all 18 titles appear in the Hebrew Guy-review artifact;
- no full page prose, image direction, or rejected spine artifact exists;
- the ChatGPT contract requires current format, word bands, personalization where grammar differs, fail-closed conflict behavior, and untrusted staging status.

A deliberately broken control proves the guard rejects wrong page count, too few set pieces, more than six causal movements, only two comic escalations, generic companion help, companion-owned discovery/climax, slash gender, parenthetical suffix gender, a generic child alias, raw `childName`, generated-prose markers, and undeclared structured keys. A separate control proves naturally invariant child grammar does not require a redundant pipe chip.

## Independent QA and correction milestone

Claude Code reviewed exact immutable range `5368bce73978e159fe1d64ab2662e8e734cfa29b..2304510db8966efbeeaebaf0b284cdbd502c57f4` read-only and reported topology PASS plus **PASS — 0 blocker / 0 major / 2 minor**.

- **MINOR-1 accepted:** the writer contract required `{boy-form|girl-form}`, but the 18 brief inputs still contained slash-gender forms and bare masculine child actions. Because the brief and contract enter the same future model context, those target-like strings could contaminate output.
- **MINOR-2 accepted:** `CURRENT.md` abbreviated the current `package.json` digest with the wrong penultimate group even though this evidence held the correct full digest.

The separate correction milestone:

- normalizes all 18 brief records to `{{childName}}` and distinct pipe variants wherever Hebrew morphology differs;
- uses explicit wording for supporting characters rather than slash placeholders;
- converts the Hebrew Guy-review table to gender-neutral infinitive phrasing;
- makes the writer contract fail closed when a supplied brief contains slash gender or a generic singular child alias;
- adds deterministic rejection of Hebrew slash forms, generic child aliases, identical pipe variants, and missing discovery/climax chips;
- bounds every compact brief to five or six high-level causal movements; and
- replaces the vacuous empty `03_spines` directory assertion with direct forbidden structured-spine-key inspection of every catalog set.

Post-correction focused validation passed **3 files / 18 tests** and `npx --no-install tsc --noEmit` passed. The completed literal `npm run check` rerun reported canonical **289 = 270 ordinary + 19 resource-intensive** files. Resource-intensive passed in `98668 ms`; ordinary produced exactly the six established missing ignored-output fixture assertions, `signal:null`, `launchErrorCode:null`, valid diagnostics, and no seventh assertion or infrastructure/protocol failure.

Operational note: an earlier check invocation was accidentally given a five-second outer command timeout. The outer wrapper exited `124` while its already-started resource Vitest child continued; Codex waited for that child to exit and verified that no repo-scoped Node process remained. That partial invocation is not claimed as a repository check. The complete clean invocation above is the validation claim.

## Independent re-gate and guard-design remediation

Claude Code reviewed exact correction range `2304510db8966efbeeaebaf0b284cdbd502c57f4..ce66689c4ed50069454faba5c886c28f80356367` and combined range `5368bce73978e159fe1d64ab2662e8e734cfa29b..ce66689c4ed50069454faba5c886c28f80356367` read-only. It reported topology PASS plus **PASS — 0 blocker / 0 major / 2 new minor**, and closed both original findings.

- **New MINOR-1 accepted:** mandatory chip presence in `childDiscovery` and `childClimax` rejected naturally invariant Hebrew. It had forced three neutral discovery verbs into unnecessary gendered variants.
- **New MINOR-2 accepted:** chip presence and nonidentity are useful syntax checks but cannot prove Hebrew morphology, male/female order, or complete semantic coverage. The prior automated-coverage claim was too broad.

The separate guard-design remediation:

- restores the three naturally invariant discovery phrasings identified by QA;
- removes the unconditional chip requirement from discovery and climax while preserving child ownership and all other shape checks;
- explicitly permits unchipped naturally invariant Hebrew in the writer contract and rejects redundant chips as a target requirement;
- rejects parenthetical suffix forms such as `מציע(ה)`, raw `childName` outside `{{childName}}`, and generated-prose markers such as `--- Page N ---` or `imageDirection:`;
- applies closed exact-key allowlists recursively to every object-bearing brief layer: top-level brief, set pieces, comic escalations, attempts, and line targets; and
- narrows both documentation and test claims to what deterministic code can prove. Hebrew morphology, variant ordering, and semantic coverage are explicitly assigned to human language QA.

Post-remediation focused validation passed **3 files / 20 tests** and `npx --no-install tsc --noEmit` passed. The completed literal `npm run check` rerun reported canonical **289 = 270 ordinary + 19 resource-intensive** files. Resource-intensive passed in `96148 ms`; ordinary completed in `32944 ms` with exactly the six established missing ignored-output fixture assertions, `signal:null`, `launchErrorCode:null`, valid diagnostics, and no seventh assertion or infrastructure/protocol failure.

Current corpus facts: 18 briefs; chips occur in 15/18 discoveries and 18/18 climaxes; 221 total chip occurrences; 94 distinct pipe pairs. Absence of a chip is valid where Hebrew grammar is invariant. Claude manually verified all 95 distinct pairs in the correction range and all 21 then-chip-free `{{childName}}` fields; the three restored neutral discovery phrases are exactly the naturally invariant cases it called out. This evidence does not convert that manual review into an automated grammar proof.

## Final independent re-gate

Claude Code independently reviewed exact remediation range `ce66689c4ed50069454faba5c886c28f80356367..42e23414e1680141c43b4367a5dd1bf6aadd7cd4` and combined range `5368bce73978e159fe1d64ab2662e8e734cfa29b..42e23414e1680141c43b4367a5dd1bf6aadd7cd4` read-only. Verdict: topology **PASS** and technical **PASS — 0 blocker / 0 major / 0 minor**. Both prior guard-design minors are independently closed.

Claude independently established:

- the exact branch, required HEAD, ancestry, three-commit/zero-merge combined topology, one-commit remediation topology, clean state, no upstream, unpushed state, seven-file remediation set, and clean diffs;
- all three restored discovery sentences are wholly invariant with respect to the child, not merely invariant at the first verb;
- chip-free neutral discovery and climax both pass while child-ownership checks remain active;
- slash, parenthetical suffix, generic child alias, raw `childName`, identical chip, page/prose markers, `imageDirection:` inside a value, unknown keys at all five object-bearing layers, and seven causal movements are rejected;
- the 32 top-level allowlist entries exactly equal both the interface and actual corpus fields, and all four nested allowlists are exact;
- all 18 real briefs pass; six causal movements remain accepted; foundations, workload classification, and writer-contract behavior remain intact;
- focused validation reproduces exactly **3 files / 20 tests** with split **8 + 5 + 7**, TypeScript passes, both package hashes match, and corpus counts reproduce exactly as **18**, **15/18**, **18/18**, **221**, and **94**; and
- excluded banks, loader, matrix, runtime, dependency, render, and cost-bearing surfaces remain unchanged.

Claude did not rerun the literal `npm run check`; its timings and six established fixture assertions remain Codex execution evidence. It independently confirmed the canonical **289 = 270 + 19** census through the passing classifier spec.

Two no-occurrence advisories remain, neither raised as a finding: raw `childName` matching is case-sensitive, and identical-chip comparison does not trim whitespace. They do not affect the reviewed corpus and are not changed in this documentation-only closeout. Swapped variant order remains an explicit human language-QA limitation. Any future guard hardening requires a new reviewed code milestone.

### TypeScript

Command:

```powershell
npx --no-install tsc --noEmit
```

Result: **PASS** after guard-design remediation and before the literal repository check; rerun before commit.

### Literal repository check

Command executed exactly once for this guard-design remediation:

```powershell
npm run check
```

Observed result:

- TypeScript PASS.
- Canonical inventory: **289** files — **270 ordinary**, **19 resource-intensive**.
- Resource-intensive phase: **PASS**, 19 files, two workers, `96148 ms`, exit `0`, `signal:null`, `launchErrorCode:null`, valid diagnostic protocol.
- Ordinary phase elapsed time: `32944 ms`.
- Ordinary phase: exactly the six established missing ignored-output fixture assertions:
  - `child-lexicon-ages-5-8` — missing Sprint 11 `story.md`;
  - `momentum-gate-koko` — missing STOP2 `page-beats.json`;
  - `page-entity-qa` — missing local audition PNG;
  - `set-appearance-ref-budget` — missing ignored appearance-board output;
  - two `story-read-back-validation` assertions — missing ignored story-run files.
- No seventh assertion and no timeout, RPC/IPC, reporter, launch, signal, teardown, or protocol failure occurred. The ordinary exit class reflects assertion exit `1`; its signal and launch error are null and protocol is valid.
- Repository/release status remains HOLD on those six pre-existing fixture dependencies, not on this implementation.

### Diff and authority checks

- `git diff --check`: PASS before final staging; rerun before commit.
- Base-to-working-tree diff under `story-bank/v3-approved`, `story-bank/v5-fixed-v2`, `backend/providers/story-bank-loader.ts`, and `backend/config/mvp-story-matrix.ts`: empty.
- Package and lockfile are unchanged. SHA-256:
  - `package.json`: `7DF1D93BCD93E7CE577525627048584096A04C110FC3D0E9D21436242308993D`
  - `package-lock.json`: `BF7932428AC1BC2CB8885E83A21F231486F35EA36820381B7D1763A77BA03D59`
- Catalog count: 18; unique mechanic keys: 18; unique working titles: 18.

## Limitations and next decisions

- These are creative briefs, not finished stories. No child/parent read-aloud evidence exists yet.
- All 18 records remain `draft_for_guy_review`. Guy may accept, reject, or revise any premise independently.
- The writer contract has not been exercised against a real model in this milestone; no execution or quality claim is made about generated prose.
- A later drafting execution should start with one Guy-accepted brief, not all 18, so its oral Hebrew, humor, page turns, format, and cost can be measured before batch authoring.
- Generated output remains untrusted and must pass deterministic validation, read-aloud editing, Guy content acceptance, and a separately approved bank migration.
- Deterministic guards do not infer Hebrew morphology and cannot prove that pipe variants are in male/female order or that every gender-sensitive phrase is chipped. Those are human language-QA checks; Claude manually verified the current corpus, but future brief edits require the same review.
- No versioned-bank name, import, visual contract, or rendering migration is included.

## Explicit exclusions and cost

No credential access/check/load; no provider/model/network/pricing call; no story generation; no approved-bank write; no order/database/storage action; no image/audio/render/Vision; no Blueprint/Wizard/reader change; no publication/promotion/activation/deployment; no push.

External cost: **$0**.

## Adversarial falsification targets

Claude Code should review the exact immutable base-to-commit range and try to prove:

1. The catalog does not exactly match all 18 matrix slots.
2. One or more briefs are incomplete, duplicate another mechanic, or secretly encode a manual page spine.
3. A companion can be swapped without breaking causality, jokes, discovery, or climax handoff.
4. An old V3/V5 plot is used positively rather than only disclosed as an exclusion.
5. A child does not own the decisive external action.
6. A bedtime brief is still a bedroom/sleep template or fails to descend in its final quarter.
7. The writer contract permits therapy language, companion-owned resolution, malformed personalization, wrong page count, hidden bank authority, or unconstrained image directions.
8. The tests merely count fields and fail to reject a representative broken brief.
9. Approved banks, runtime, dependencies, package identity, or cost-bearing paths changed despite the stated exclusions.
10. The reported Git, test, full-check, or cost evidence is inaccurate.
11. A brief or review artifact still teaches slash gender, parenthetical suffix gender, raw `childName`, bare masculine child grammar, or an identical pipe variant despite the remediation claim.
12. A brief hides generated prose or undeclared structure in an unguarded object-bearing layer.
13. The tests or documentation again imply that chip presence proves Hebrew morphology, correct male/female ordering, or complete semantic coverage.
14. One of the three restored unchipped discovery phrases is not genuinely invariant Hebrew.

Claude Code's final re-gate was read-only and is complete. Guy retains all story/product acceptance.
