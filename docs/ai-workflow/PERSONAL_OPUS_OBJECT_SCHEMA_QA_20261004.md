# Claude planning schema correction and review brief

Guy approved continuing after subscription login. The second one-use text
attempt reached the provider but produced no synopsis. Codex corrected the
specific diagnostic adapter defect offline. This is ready for independent
Claude Code review, not a self-awarded PASS or proof of live compatibility.

## Frozen target and authority

Worktree: C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes.
Branch: codex/personal-book-storyboard-bridge. Base:
cdf2ded97278d5c1b61e95a93f5da10e02ad7041. The exact successor SHA is supplied
in the forwarding note; freeze it with git rev-parse HEAD and require parent
equal to this base. Stop if topology differs. Codex is the sole writer; Claude's
first pass is read-only. Earlier PASS 329c857e..e4a01126 is not expanded.
The three-doc cdf2ded9 closeout has no independent re-gate yet.

Protected trees remain at 768ccb2f and 63ccb484, clean. Site QA 5fe73b3f and
Claude site 87b0d196 (cached ahead 4) are unchanged and clean. Reviewer detached
tree remains e4a01126. This branch was cached ahead 2 before the correction;
the forwarding note records the new count, not a freshly fetched remote state.

## Actual second trial

Approval reference guy-text-calibration-20261004-02; source cdf2ded9; fictional
Neta/Uri, eight spreads; original USD 12 estimate ceiling. Exactly one Astra
response and one Opus CLI invocation, not two successful model inferences.
Probe reports completed gpt-6-astra/default, 582 input/72 output tokens,
conservative estimate USD 0.010875. CLI returns native 1, is_error true, API 400,
result API Error 400 tools.1.custom.input_schema.type Field required; subtype
success does not override its failure. Raw cost/tokens are zero, modelUsage
empty, accepted usage null. Host correctly seals cli_termination and launcher
reports provider_or_contract_failed. CLI internal API count is unverified.

No selected/rejected synopsis, author, editor, literary reading, book viewer,
storyboard, image or narration was produced. Both probe/book families consumed;
no reset or retry. Old auth failure remains historically intact. Two captured
probe estimates total USD 0.021750; no invoice claim. Login status alone did not
prove inference or model identity. Current failure is schema, not expired auth.

New family stem: personal-calibration-e6b2ddb969bde1a17f5df987703a3313.
The probe and book roots are under outputs/; matching journals are under
C:/GNart/Work/Small_Heroes/.git/codex-causal-text-trials/. Fourteen files,
including both manifests, probe result, instructions, reservations, claims,
dispatches, receipts and seals. Their SHA/size baseline is in
C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246/single-book-calibration-20261004-approved-02/execution-closeout.json.
The old stem 163e713955719dff0e021aec920c321e has its separate fourteen-row
baseline in the sibling single-book-calibration-20261004-approved folder.
Codex recomputed both, 28/28 unchanged. Local ignored records lack Git backup.

## Cause and implementation claims

causalPlanSchema builds a selected/both_rejected discriminated union.
zodTextFormat exports anyOf/definitions/$schema without root type. The actual
saved plan argument and wire digest reproduce byte-for-byte offline. Both
branches explicitly require objects; author/editor exports already have object
roots. Prior simple object native tests never exercised this union.

scripts/personal-causal-trial-adapters.ts adds one private Opus-only root
normalizer. Existing object exports return unchanged. A typeless, nonempty
anyOf whose EVERY alternative explicitly has type object gets only the root
type object. Everything else fails cli_schema before process invocation.
Branches, strict fields, definitions and references stay intact; no empty root
properties/additionalProperties are introduced. Original call.schema.parse
still validates returned output. Wire JSON, digest, bytes and reservation all
cover the adapted argument. On the actual failed plan, that adds 16 schema
bytes/20 nested wire bytes, a 176 microUSD reservation difference at unchanged
rates; this is not a measured invoice increment.

The other code file is the existing personal-causal-trial-native.spec.ts.
Its synthetic fixtures exercise actual planner schemas through prepareCausalWire
and createOpusCausalTransport. Fake CLI models ONLY the observed root-type
requirement, not the complete provider schema validator. No production domain
schema, instruction, story rule, model, cap, rate, CLI flags, fresh author/editor
separation, key access, journal, public route, UI or visual asset changes.
State docs, decision brief and full-check evidence are the only other paths.

## Codex verification and limitations

npx tsc --noEmit exits 0 before and after the full gate. Final six-file focused
run exits 0, 272/272, 16.98s: calibration 59, host 75, native 47, workload 7,
causal experiment 61, companion revision 23. Native adds 33, removes none.
Both actual dispositions at 8/12/16 and plan/replan survive native decoding;
invalid disposition/request/extras/missing fields/wrong branch still fail.
Scalar, array, mixed/scalar union, any, unknown and never roots fail closed.
Tests check preserved refs, exact branches, accounting and unchanged Astra.

Negative controls transform Vite source only in memory: old cdf2ded9 adapter
fails the 18 actual-plan regressions; unmodified control passes; six deliberate
variants are all caught (omit adaptation, force selected branch, permit mixed
union, omit decoding, rewrite ordinary objects, alter Astra). Production SHA
before/after equal. Three final unconstrained-root test additions followed the
mutation run; the final 272 set includes them. Helpers/reports are in
outputs/personal-opus-object-schema-fix-20261004/. Run-mutations.cjs uses exclusive
summary creation; do not overwrite prior reports during review.

Initial native run failed six new assertions because the test assumed enum
where the exporter uses const; corrected the assertion, not the exporter.
First sandboxed Vitest startup lacked shared-dependency access; escalated offline
run reached tests. An internal read-only second-pair-of-eyes found no issue;
that is NOT Claude independent QA.

Fresh npm run check exits wrapper 1. Both type checks completed, but ordinary
aborted with ERR_IPC_CHANNEL_CLOSED before normal run-end evidence. Supervisor
observes ordinary native 1, 45,208ms; resource native 3221226091, 116ms. Both
diagnostic protocols invalid, zero diagnostic records; aggregate test totals
are unavailable. Calibration 59 and host 75 were observed passing before the
abort. Do not label this as the same ten historical assertions or infer a cause.
No source/spec edit or overlapping test run occurred during the full check.
Tracked summary: PERSONAL_OPUS_OBJECT_SCHEMA_FULL_CHECK_20261004.json; raw
local full-check.log and full-check-summary.json are in the helper folder.
Stability remains RED; no baseline rerun or cause attribution is claimed.

## Independent falsification targets

1. Verify immutable parent/head and only the named adapter/spec plus docs changed.
2. Reconstruct the saved failing actual schema and distinguish provider evidence
   from the fake CLI model; attack the claim of redundant object semantics.
3. Try malformed/mixed/unconstrained unions and both plan dispositions. Ensure
   every ref and strict branch survives and ordinary object/Astra bytes do not move.
4. Attack returned output/request validation, wire hashing/pricing and unchanged
   exact model/cap/fresh-process guards. No forced choice or fallback is permitted.
5. Recompute all 28 paid-file baselines, check consumed seals and no extra calls.
6. Reproduce tests and negative controls read-only; independently classify the
   full-gate failure without converting missing diagnostics to a test PASS.

No providers, key values, writes, paid retries, seal reset, render, push or
deployment in the first review. Do not claim provider acceptance until a
separately authorized new one-use trial observes it. Live thinking capacity,
book quality, six-book comparison, carousel and release remain outside scope.

## Inspection and later push commands

The focused successor is already committed by Codex. No staging is needed.
Do not run the last command without Guy's explicit push decision and review;
it publishes every local commit on this work branch, not just this correction.

```powershell
Set-Location 'C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes'
git status --short --branch
git log --oneline origin/codex/personal-book-storyboard-bridge..HEAD
git diff --check cdf2ded9..HEAD
git show --stat --oneline HEAD
git push origin HEAD:refs/heads/codex/personal-book-storyboard-bridge
```
