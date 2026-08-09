# R1D-PVB-D1A1B1 Field-Scoped Page-Spatial Repair — Implementation Evidence

Date: 2026-08-09

Status: independent technical PASS; focused prompt-version QA fix independently closed; repository/release HOLD remains on six known ignored-output fixtures.

## Topology and scope

- Worktree: `C:\Users\guyna\.codex\worktrees\spatialfield1\Small_Heroes`
- Branch: `codex/r1d-pvb-d1a1b1-field-scoped-page-spatial-repair`
- Exact base: `40fd3968e2bb73297a9e10c14acfae31e1ce1a30`
- Decision/record commit: `7444790b`
- Production implementation commit: `2bb9b026`
- Validation-expectation migration commit: `44f4788f`
- Review range: `40fd3968e2bb73297a9e10c14acfae31e1ce1a30..HEAD`

The implementation is general across Story Sources. No Story Source, page, character, action, zone, node, or authored identifier is hardcoded in production behavior.

## Implemented behavior

The closed homogeneous diagnostic family `page_spatial_reference_outside_zone` now routes to `page_spatial_reference_patch` instead of complete-page replacement. Each repair target is exactly `{pageNumber, actionIndex, fieldRole}` and each provider patch contains only that identity plus one `spatialReferenceId`.

Admitted field roles are:

- `subject`
- `object`
- `spatialEffect.target`
- `spatialConstraint.target`

`safetyConstraints.target` is excluded. Mixed, malformed, unsupported, authority-missing, and non-spatial issue sets retain their existing fail-closed route.

The compiler derives the permitted spatial-reference set from the post-Set-Board authority for the exact page zone. It validates complete and unique patch coverage, rejects stale or duplicate targets and unpermitted IDs, constructs the typed EntityRef locally, mutates only the selected leaf in a clone, and canonically proves that all non-target content is unchanged. No arbitrary JSON pointer or replacement object is accepted.

The page-contract route remains unchanged for final-structure and represented-elsewhere families. The source-evidence compact route and full-draft route retain their prior priority and behavior.

## Prompt, schema, and sanitization

The new strict structured-output schema accepts only:

```text
patches[] = { pageNumber, actionIndex, fieldRole, spatialReferenceId }
```

The repair input contains exact typed targets and compiler-owned permitted IDs. It excludes the complete page, complete draft, unrelated Story Source prose, rejected authored value, raw validator prose, provider response/message, stack, credential, executable, shell text, and arbitrary patch language.

The OpenAI Responses adapter allowlists the new repair schema identity. Structured-output compatibility and pre-provider authority checks remain fail-closed.

The complete-page repair system and user prompt labels are v4. Claude Code's first-pass QA identified that removal of the page-spatial capability had changed both retained complete-page prompt texts while their labels remained v3. The QA fix changes only those two labels and adds a pre-provider rejection control for redigested v3 authority. It does not add a user-prompt digest or change the request shape; the explicit user-prompt version is already part of the digest-bound request authority.

## Authority migration

Current authorities are:

- Visual Contract authoring request v14
- Visual Contract receipt v17
- Visual Contract readiness v15
- B0 manifest/verifier v12
- Execution Request/readiness v11
- Pre-Live Readiness evidence v11
- Execution-request materialization result v6

Historical artifacts remain immutable and non-authoritative for a new attempt. Candidate v7, Blueprint v4, Wizard qualification semantics, renderer behavior, model, Responses API/default tier, reasoning, 64K input ceiling, call/repair budgets, timeout, zero transport retries, no fallback, conservative `$4.884` reservation, and hard `$5.00` ceiling are unchanged.

## Focused validation

All focused validation was local and zero-cost.

- Repair/compiler/lifecycle ordinary coverage: 4 files / 118 tests PASS.
- Canonical live adapter/boundary: 1 file / 134 tests PASS with one worker.
- Affected resource surfaces: 6 files / 277 tests PASS before the final boundary assertion; the updated boundary file then passed again at 1 file / 134 tests.
- Direct route-expectation migration: 2 files / 62 tests PASS.
- Direct patch guards cover every admitted role, multiple targets, invalid JSON and shape, extra/missing keys, incomplete/unexpected/duplicate patches, stale/wrong targets, unpermitted IDs, invalid current target shape, non-mutation, and canonical non-target containment.
- Deterministic `npx --no-install tsc --noEmit`: PASS.
- `git diff --check`: PASS.

The runtime integration covers all currently reachable role/predicate combinations. `subject: spatial` is not reachable through Action Semantic Catalog v3 and is therefore proven directly at the patch boundary rather than forced through a semantically invalid action fixture.

## Repository-gate history

The first literal `npm run check` passed TypeScript and the 19-file resource phase. Its ordinary phase reported nine assertions: the exact six established missing ignored-output fixtures plus three stale repair-route expectations caused by the intended cutover. No production defect was exposed. Only the two affected test files were migrated in commit `44f4788f`; production behavior was not changed.

One bounded replacement literal `npm run check` then produced:

- TypeScript: PASS.
- Canonical inventory: 287 files.
- Ordinary phase: 268 files, 4 workers, 31,432 ms, exactly six known fixture assertions, no seventh failure.
- Resource-intensive phase: 19 files, 2 workers, 97,259 ms, exit 0, valid diagnostic protocol, no timeout, RPC/IPC, reporter, launch, signal, teardown, or protocol class.

The six remaining release-HOLD assertions are:

1. `child-lexicon-ages-5-8.spec.ts` — missing ignored story output.
2. `momentum-gate-koko.spec.ts` — missing ignored page-beats output.
3. `page-entity-qa.spec.ts` — missing ignored PNG output.
4. `set-appearance-ref-budget.spec.ts` — missing ignored Set Board output.
5. `story-read-back-validation.spec.ts` — missing ignored `story-pages.json`.
6. `story-read-back-validation.spec.ts` — missing ignored `story.md`.

These failures predate and are independent of this implementation. They remain a repository/release HOLD and are not waived.

## Unchanged boundaries and cost

No credential access, pricing lookup, network/provider/model call, real B0 or Fresh Readiness, canonical preflight, live authoring, candidate, Semantic Reconciliation, Blueprint or Wizard execution, render/image/Vision, storage/database/Supabase, Board action, approval, publication, promotion, activation, deployment, or push occurred. External cost is `$0`.

The preceding live attempt remains consumed and cannot be retried. This implementation creates no live, candidate, downstream, or render authority.

## Rollback

Revert `44f4788f`, then `2bb9b026`; historical evidence and artifacts require no rewrite. The prior complete-page spatial repair route returns. The authority cutover prevents mixed-version use.

## Independent QA assignment

Claude Code must review the immutable range from exact base through the documentation closeout and attempt to falsify:

1. homogeneous closed eligibility and safety/mixed-family exclusion;
2. exact target identity and exact response keys;
3. compiler-owned permitted authority and stale/unpermitted rejection;
4. clone/non-mutation and canonical non-target containment;
5. prompt/schema sanitization and OpenAI adapter allowlisting;
6. repair priority and unchanged behavior of every other route;
7. fake-provider lifecycle and truthful attempt accounting;
8. authority/version cutovers and historical-artifact immutability;
9. unchanged candidate, Blueprint, Wizard, model, budget, retry/fallback, and render semantics;
10. repository-gate record fidelity, including the separate six-fixture HOLD.

Codex does not self-award independent technical PASS.

## Independent QA result and focused correction

Claude Code independently reviewed exact immutable range `40fd3968e2bb73297a9e10c14acfae31e1ce1a30..73783fab3e072a35f6eab89acf8bf199e0dadcaa` and returned **TECHNICAL PASS**:

- zero BLOCKER;
- zero MAJOR;
- one non-blocking MINOR on complete-page prompt version hygiene;
- five advisory notes.

Claude independently reproduced deterministic TypeScript, `git diff --check`, the canonical 19-file resource phase at 548 tests PASS, a 6-file ordinary superset at 180 tests PASS, and adversarial selection, parse, application, and containment probes. It did not rerun `npm run check`; the six-fixture repository/release HOLD remains Codex-recorded evidence rather than Claude-reproduced evidence.

The focused correction bumps:

- `page-contract-repair-prompt/v3` to `page-contract-repair-prompt/v4`;
- `page-contract-repair-user-prompt/v3` to `page-contract-repair-user-prompt/v4`.

It also proves that a canonically redigested request carrying the prior v3 system/user authority rejects before provider reachability. Focused correction validation passed:

- page-contract repair and repair-loop: 2 files / 54 tests;
- source-authority lifecycle: 1 file / 54 tests;
- total: 3 files / 108 tests;
- deterministic TypeScript: PASS;
- `git diff --check`: PASS.

No routing, schema, payload, repair eligibility, mutation behavior, provider behavior, budget, or downstream policy changed.

Claude Code independently reviewed exact correction range `73783fab3e072a35f6eab89acf8bf199e0dadcaa..689bff89985caa3247e40bc32bf62345c1be82e9` and returned **PASS — MINOR closure only**. It independently reproduced the 54 + 54 focused tests, TypeScript, `git diff --check`, the redigested v3 pre-provider rejection, and the separate call-time rejection of stale system version, user version, or system digest. It found zero new BLOCKER, MAJOR, or MINOR. This is Claude Code's closure, not a Codex self-awarded result.

Claude's correction re-gate advisories are retained without action:

- future user-prompt text changes must continue to bump the explicit version because that repair template has no independent digest;
- `npm run check` was not rerun for the focused correction;
- the original review advisories A1-A5 remain unchanged.

The milestone is technically closed. The six known missing ignored-output fixtures remain a separate repository/release HOLD. No Fresh Readiness, live, candidate, Blueprint, Wizard, render, release, deployment, or push authority follows from the QA verdict itself.

Advisory notes retained without scope expansion:

1. The containment proof masks all selected target leaves, while exact identity-key application prevents cross-application.
2. Claude's review begins at the stated base and does not review preceding milestones.
3. Permitted spatial descriptions are authored compiler-owned authority text already present on the prior route, not rejected provider-authored values.
4. Claude did not rerun the literal repository gate.
5. The evidence otherwise faithfully separates the first and replacement repository-check results and the six-fixture release HOLD.
