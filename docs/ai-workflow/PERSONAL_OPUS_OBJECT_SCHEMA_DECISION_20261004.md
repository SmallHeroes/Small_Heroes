# Decision Gate for Claude planning schema compatibility

Guy renewed the login and approved continuing the text trial. The fresh one-use
attempt at cdf2ded9 reached Claude but stopped with API 400 before a synopsis.
Continue here as sole writer on codex/personal-book-storyboard-bridge. This
milestone is a free, general transport correction, not another paid attempt.

## 1 Proposed change

For Opus CLI only, require an object root in the exported JSON Schema. When
the root has no type and every anyOf alternative explicitly has type object,
add that redundant root type without changing branches or definitions. Reject
unsupported non-object roots before dispatch. Keep original Zod decoding.

## 2 Why now

The saved plan argument contains anyOf, definitions and $schema, but no root
type. Claude reports tools.1.custom.input_schema.type Field required. Actual
plan and replan exports reproduce those saved bytes offline. Author/editor
exports already have object roots. Earlier successful samples used object
roots, so they did not establish union compatibility.

## 3 Scope

Only diagnostic Opus wire serialization and regression tests. No public route,
writer instruction, domain schema, model, rate, output cap or lifecycle change.
The desired behaviour is a provider-compatible description of the same outputs,
not forced selection when both story ideas are weak.

## 4 Risk of hardcoding

The correction is structural, never keyed to a child, companion, stage or book.
Do not flatten alternatives, drop rejection or add empty root properties with
additionalProperties false. Those could silently change valid outputs.

## 5 Files likely affected

scripts/personal-causal-trial-adapters.ts; the existing native transport spec;
CURRENT.md, ROADMAP.md and focused decision, QA and full-check evidence docs.
No new canonical spec inventory or migration is required.

## 6 Expected behaviour

Actual plan/replan schemas for all three lengths retain both dispositions and
all references. Existing object roots and Astra payloads stay unchanged.
Unsupported roots fail closed. Wire size, digest and reservation cover the
adapted bytes. Provider acceptance remains unmeasured until a new live trial.

## 7 Validation plan

Exercise actual planning schemas, both output variants and invalid outputs
through native transport with a fake CLI that requires an object root. Prove
the old export lacks that type. Check unsupported roots, immutability, unchanged
object/Astra representations, references and wire accounting. Run type check,
the six-spec focused set, memory-only negative controls and npm run check.
Preserve both paid attempts and protected worktrees. Independent Claude QA is
required; Codex does not award himself a technical PASS.

## 8 Cost impact

Zero additional provider calls or renders during engineering. A slightly larger
wire is priced by the existing byte-based reservation, with no cap increase.
The consumed second attempt recorded USD 0.010875 for the Astra probe; Claude
reported zero cost/tokens. These are estimates/reports, not invoice proof.

## 9 Rollback plan

Revert the focused code commit if required. Never delete or reopen journal
claims, seals or historical paid evidence. No data migration or public cutover.

## 10 Review assignment

No new product choice: preserve the approved two-disposition contract. Narrow
assumption: permission to continue includes repairing this free adapter defect,
not silently starting a third paid family. Claude should attack schema meaning,
real call paths, unsupported unions, byte accounting and unchanged guards.
No product/creative question needs Cowork. Guy should read the actual book only
after a separately authorized successful trial, not a synthetic test fixture.

## 11 Do not do

No fallback, retry, unwrapping, key/config mutation, cap increase, prompt edit,
image, narration, companion activation, site change, push or deployment.
Do not claim that offline tests establish live API acceptance or story quality.

The stop-check is resolved: general diagnostic-only fix; possible compatibility
risk is constrained by unchanged branches and fail-closed roots; no production
flow or paid action. Testing precedes review and any new execution decision.
