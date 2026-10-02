# Personal storyboard authoring rules technical review

## Requirement and frozen scope

Guy authorized the general full-story-first personal engine and continued the
recommended authoring-contract correction before a later model comparison.
Codex is the sole writer in personal-story-product/Small_Heroes on
codex/personal-book-storyboard-bridge, local with no upstream. Claude Code is
read-only independent QA. Protected d53b768ccb2f, accepted-intent63ccb484 and
siteQA5fe73b3f remain unchanged; no push, deployment, images or narration.

Initial range ae2e73d7c3c3d112d69e7499624c1d3b35a87eff..
dfc47ee3a042b4159e73c88d1f92e23eed113e05 is one commit,9 paths,+279/-13.
Claude independently gave bounded technical PASS with one nonblocking Low and
two nits. Its own evidence was Git/code/call-site reading and paid-file hash
recomputation; tests, tsc and full were reported only. Exact CLI model
claude-opus-5-5/high, safe mode; usage estimate$0.5835504, not invoice.
Result file OS TEMP claude-storyboard-authoring-qa-dfc47ee3-result-20261002.json.

The successor is a separate narrow Low correction based on dfc47ee3. Freeze
its exact committed HEAD before re-gate; reconcile if HEAD or branch differs.
No extension of earlier verdicts, visual/semantic/literary/product acceptance
or release/stability qualification.

## Root cause and unchanged behavior

The actual four-call diagnostic created plan, manuscript, edited manuscript and
storyboard, then failed book_storyboard_invalid. Native exit2; family sealed
book_trial_failed. Model requested gpt-6.1-sol/medium. Known usage estimate
$0.295578, not invoice. No review, packets or other five books. Caps were not
reached; this was not an observed output-token-cap failure.

The original storyboard authoring input omitted existing cross-field framing
rules, reserved role literals and entity baseline/mutable joins. Offline frozen
replay fails continuity_wide_too_tight. An explicitly in-memory numeric
counterfactual then fails unsupported_continuity_change; it was never saved or
accepted. Raw aliases and undeclared mutable relation attributes are additional
contract violations. The diagnosis does not prove sole causality or compliance
with the added instructions.

The initial fix shares existing framing values and role IDs with validators and
passes a structuredClone of authoringRules into the actual storyboard call.
All scalar/cross-field/quota bounds and error behavior stay unchanged. Physical
relationships remain an explicit graph, independent of appearance attributes
and camera choices. No clamping, aliases, retries, repaired paid output or new
runtime authority. Existing child resemblance0.70 and image QA are untouched.

## Validated review findings and separate correction

Low: exported objects referenced by validators could be mutated at runtime.
TypeScript as const was not sufficient. The successor Object.freeze calls
cover every nested rule object, including quota entries, reserved roles and
binding clauses. A recursive probe attempts set, delete and new-key insertion
on every object; canonical JSON and literal thresholds stay unchanged. Returned
authoring input remains a clone, and its mutation still fails source authority.

Instruction nit: physical relations now explicitly belong in initialStates and
transitions, not mutableAttributes. This changes wording, not validator powers.

Evidence nit: the failed-cover regression is synthetic, not the whole paid draft.
Codex separately replayed the ACTUAL paid draft against frozen dfc47ee3:
continuity_wide_too_tight, SHA b0942c7bf39be1abe230c1a0de3c50fbc8700fb0b2c710a67449f8ecdb5b44a8
before/after identical, zero providers/keys/writes/clamps. This is runtime
evidence outside the test suite, not a claim that a paid fixture was added.
Probe OS TEMP personal-paid-draft-current-rejection-dfc47ee3.ts.

## Reproducible checks and full gate

Run from the named engine worktree:

```powershell
npx.cmd tsc --noEmit
npx.cmd vitest run lib/__tests__/local-preview-quality.spec.ts lib/__tests__/local-book-sequence.spec.ts lib/personal-wizard/__tests__/storyboard.spec.ts lib/personal-wizard/__tests__/book-runner.spec.ts lib/personal-wizard/__tests__/book-companion-trial.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts
git diff --check
```

Final focused314/314:54quality+33sequence+71storyboard+127runner+22guard+7classifier.
Standalone tsc exit0; diffcheck clean. Existing boundary tests pin literal
thresholds and cover/body quota equivalence; real mocked SDK payload assertions
verify exposure, not an unused helper. Invalid role/attribute/graph tests retain
their specific errors. The new mutation probe covers the Low correction.

Full npm run check ran on frozen dfc47ee3 before the Low successor. Native1:
ordinary385 files,10failed/5701passed/73skipped; resource20 files,635passed plus
3 onTaskUpdate RPC errors, phase exit1. Both gates failed. No baseline causal
closure, no final full rerun for the small freeze successor. Log OS TEMP
personal-storyboard-authoring-full-dfc47ee3-20261002.log.

## Preservation and falsification targets

Ignored local outputs/personal-six-companion-books-20261002 contains18 files,
17 listed by files.json. Independent first-pass review recomputed17/17 exact
sizes/SHA. Manifest SHA b55979e561d7843964ee4ccdede4afe854750defad232779b1b5edf1d5f39892.
No verified backup. The common-Git family claim and receipts remain permanently
consumed/sealed; no reset/resume or fresh allowance through another family.

Attack nested mutation via direct exports and aliases, not just the cloned input.
Check exact numerical/role equivalence and absence of new authority, real model
input exposure, mutable clone/source binding, preserved paid data/claim and
wording that might imply semantic or literary acceptance. First pass read-only:
no keys/env, network/providers, output changes, checkout/instrumentation or push.
Report your own checks separately from Codex's reported evidence.

## Next product experiment

Later matched Opus5.5 versusGPT6.1 comparison is a hypothesis test, not an
automatic provider switch. Production Anthropic credentials and explicit
provider accounting have not been connected; Claude Code OAuth is not product
API auth. No comparison model calls were made here. A successor trial requires
separate cumulative bounds and must retain prior4calls/$0.295578 and the old
reservation. First drafts and edit gains must be evaluated separately.
