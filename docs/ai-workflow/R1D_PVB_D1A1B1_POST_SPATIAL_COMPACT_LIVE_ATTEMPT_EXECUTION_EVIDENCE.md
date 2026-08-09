# R1D-PVB-D1A1B1 - Post-Spatial-Compact Live Attempt Execution Evidence

Date: 2026-08-09

Status: terminally exhausted; no candidate or render authority

## Immutable authority

- Repository head and same-name upstream: `40fd3968e2bb73297a9e10c14acfae31e1ce1a30`
- Fresh Readiness v10: `b694ff34ef631266c5800adbee21e9c70b2783c0b6b7893ee8faaf690740f5bb`
- Execution Request v10: `a7ef7beae9a14476ef7b615a1ae833b6bed25854607b4d691abedd347172d9d2`
- Authoring Request v13: `d6028fff31d6224acb0c3e62f3037dc41491da865705f5fff05162a2cfa4ac47`
- Source Snapshot: `b303658c2e38945423066cc005b93c82b643c4395d51e4ad82a504dc19c2acd3`
- Output root: `outputs/r1d-pvb-d1a1b1-post-spatial-compact-fresh-readiness-40fd3968-20260809T153849325Z`

The canonical Git probe, Fresh Readiness prepare, and Fresh Readiness verify passed at zero cost. Two attempted local Claude Code artifact audits timed out without a verdict and changed no repository or evidence bytes. Codex does not claim an independent artifact-audit PASS for that pre-live bundle.

## Armed execution

- Official OpenAI pricing matched the frozen request policy for `gpt-5.6-sol`, the Responses API, default service tier, and the recorded input, cached-input, cache-write, output, regional, projected `$4.884`, and hard `$5.00` limits.
- Canonical preflight: exactly one invocation, PASS.
- Execution Supervisor verify: exactly one invocation, PASS, readiness digest `a88b17021d8a23f52d8d8e9016efb55286007a1a0cc01a78953f97ad34c382`.
- Execution Supervisor live: exactly one invocation, exit `1` after about `305.9 s`; child status `child_failed`, reason `child_nonzero_exit`.
- Credential-source access occurred only inside the Supervisor child boundary. Source read succeeded, ambient inheritance was false, credential authority was cleared, and raw stdout/stderr were suppressed.
- Transport retries: `0`; fallback: `false`.

## Canonical outcome

- Receipt v16: `fbcfafb08c01d1a46704ea809a2518b17ff257709fe1a4c6d8aef84ba721d502`
- Readiness v14: `20a5c505b2af3382f475d0e6770f28376cd2fc99782d3f59051eb3da0f86b9b2`
- Receipt status: `failed`
- Terminal class/code: `draft_validation_budget_exhausted` / `draft_validation_repair_exhausted`
- Phase: `draft_validation`
- Repair eligibility/reason: `budget_exhausted` / `draft_validation_budget_consumed`
- Logical provider calls / repair calls / transport retries: `3 / 2 / 0`
- Candidate / reconciliation digests: `null / null`
- Blueprint authoring ready: `false`

All three provider responses completed. Attempt 1 used the initial whole-book request. Attempts 2 and 3 used `page_contract_patch`.

### Usage and cost

- Input tokens: `33,705`
- Cache-write input tokens: `32,526`
- Cached input tokens: `1,170`
- Output tokens: `34,701`
- Reasoning tokens: `3,249`
- Total tokens: `68,406`
- Nominal estimated cost: `$1.244948`
- Conservative accounted cost: `$1.376857`
- Projected maximum remained `$4.884`, below the hard `$5.00` ceiling.

### Sanitized diagnostic progression

Attempt 1 emitted six `draft_contract / out_of_scope_reference` issues at exact page/action positions on pages 1, 2, 4, and 5. The first compact repair resolved all six.

Attempt 2 then introduced twelve `draft_contract / final_structural_invariant_invalid` issues, exactly one for every page 1 through 12. Attempt 3 retained the same twelve issues as persistent. Diagnostics were not truncated. The bounded repair budget was therefore truthfully exhausted.

The evidence proves that compact routing and exact page selection worked, but the complete-page response/application boundary allowed the provider to rewrite unrelated fields inside affected pages. The compiler correctly reran whole-book validation and caught the resulting cross-page structural drift. Raw provider output was suppressed and is neither available nor required as authority for the next general fix.

## Artifact and authority boundaries

The output root contains the original eight Fresh Readiness artifacts plus the receipt and readiness above. No candidate file exists. No provider-failure evidence was appropriate because the provider completed all responses. No rejected-request artifact was produced.

No Semantic Reconciliation, human approval, Blueprint, Wizard qualification, page selection, image/Vision call, render, storage/database action, Board action, publication, promotion, activation, deployment, commit, or push followed the consumed attempt. The worktree remained clean at exact `0/0` parity.

This record persists no raw prompt, raw response, provider message, stack, credential, or secret. It grants no retry, new live attempt, candidate, Blueprint, Wizard, render, release, or deployment authority.
