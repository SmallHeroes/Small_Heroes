# R1D Repair Output Diagnostic Identity and Compact-First Routing — Implementation Evidence

## Status and immutable scope

- Base: `7a37759c265ad8466c3eee23e008d6be0accff07`
- Branch: `codex/r1d-repair-output-diagnostic-identity-and-compact-first-routing`
- Worktree: `C:\Users\guyna\.codex\worktrees\repairdiag2\Small_Heroes`
- Implementation commit: `c6789026`
- Independent technical QA: pending
- External cost: `$0`

This milestone is a general compiler/lifecycle hardening. It does not contain a
story, child, companion, page or provider-output special case.

## Trigger evidence

The consumed attempt-2 authority on base `7a37759c` used Fresh Readiness v19
digest `1ab7efe95ad6e4acf59147cc940c155936b5cdb4beef1145f43c9b8bd91b1d08`
and Execution Request digest
`432202e10b7a1347d921ec6c205a59d544eaf01e9fb4cb08f0b87ed31374ecda`.
Its receipt v25 digest was
`d9605485756a7a0234d6f772eb3c24834978a83c0db4541e7f761314a1de8f52`
and readiness v23 digest was
`e6605b285d5d89423eb3f7cda707f9f9b0ba5e5136ed781838782b60ccb02db8`.

The attempt completed three logical provider calls and two repairs with zero
transport retry and no fallback. Aggregate usage was 50,484 input, 50,475
cache-write input, zero cached input, 62,607 output, 8,725 reasoning and
113,091 total tokens. Nominal/conservative accounting was
`$2.193724/$2.413110`.

The initial response had 23 current, exact page-action
`draft_contract/out_of_scope_reference` targets. The historical broadness
predicate chose `full_draft`; that repair resolved all 23 and exposed 20
current issues: seven closed-catalog presentation capability gaps, one cover
projection failure and twelve final structural failures. The final
`book_surface_patch` response was unusable. The old catch-all persisted
`repair_output_json_invalid`, which could not distinguish JSON decoding from
shape, identity, authority or local application rejection. Candidate and all
downstream authority remained absent.

## Implemented behavior

1. Removed the five-page/strict-majority escalation and its routing flag.
2. Preserved the exact target list as sole authority for every homogeneous,
   repairable page-spatial set, regardless of how many pages it spans.
3. Preserved all existing later repair selection, the closed terminal cleanup,
   provider/cost policy and fail-closed behavior.
4. Added the closed compiler reason catalog:
   - `json_invalid`
   - `shape_invalid`
   - `target_identity_invalid`
   - `reference_authority_invalid`
   - `non_target_drift`
   - `application_rejected`
5. Mapped the catalog to closed receipt/readiness diagnostics without carrying
   the underlying exception or provider-authored material.
6. Kept the shared terminal object shape exact. The Visual Contract extension,
   authority-reference diagnostics, array ordering, deduplication, caps,
   digest binding and tamper rejection remain intact.

## Authority migration

- Authoring policy: v6
- Authoring request / receipt / readiness: v23 / v26 / v24
- Live request materialization input / manifest / verification: v12 / v21 / v21
- Execution materialization input / result: v11 / v15
- Supervisor request / readiness / result: v20 / v20 / v12
- Canonical Fresh Readiness evidence: v20

The immediately prior request v22, receipt v25 and readiness v23 are explicitly
legacy immutable. Older artifacts were not opened for mutation, rewritten,
redigested or promoted.

## Validation

Toolchain preparation was isolated and offline:

- `npm ci --offline --ignore-scripts`: PASS
- local `npx --no-install prisma generate`: PASS

Focused validation used the repository's two-phase supervisor:

- ordinary: 4 files, 159 tests, four workers, PASS, diagnostic protocol valid;
- resource-intensive: 7 files, 321 tests, two workers, PASS, diagnostic
  protocol valid;
- total: 11 files, 480 tests, PASS;
- `npx --no-install tsc --noEmit`: PASS;
- `git diff --check`: PASS.

The one authorized literal `npm run check` was invoked exactly once:

- TypeScript and story-autonomous TypeScript: PASS;
- ordinary phase: 281 files, 3,176 tests passed, exact six established fixture
  failures, no seventh failure;
- resource-intensive phase: 19 files, 577 tests, PASS with clean diagnostic
  protocol;
- no timeout, RPC/IPC, reporter, launch, signal or teardown failure.

The literal command returns HOLD because the six historical filesystem/fixture
failures remain release-blocking. They are not a finding in this implementation
range and were neither waived nor corrected here.

## Unchanged boundaries

No prompt or schema-authority prose, model, endpoint, service tier, reasoning,
input/output ceiling, repair or call budget, terminal-cleanup budget, timeout,
retry, fallback, pricing ceiling, candidate semantics, Blueprint, Wizard,
Reader, image generation, payment, storage/database, QA deployment or
Production behavior changed.

No credential file was opened or checked. No pricing lookup, network/provider
call, Fresh Readiness, canonical preflight, live authoring, render, Vision,
storage/database, publication, promotion or deployment occurred.

## Rollback

Revert implementation commit `c6789026` before producing new authority. This
restores the prior broad escalation and coarse diagnostic. Historical evidence
remains immutable either way; no prior attempt becomes authoritative.

## QA status

Codex records local implementation evidence only and does not self-award
independent technical PASS. Claude Code must falsify exact range
`7a37759c265ad8466c3eee23e008d6be0accff07..c6789026` before push, Fresh
Readiness or another live attempt.
