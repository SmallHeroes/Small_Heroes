# R1D Blueprint program-scoped execution identity — implementation evidence

Status: **offline implementation locally green; awaiting independent Claude Code QA**

Date: 2026-08-31

Branch: `codex/r1d-order-package-authority-binding`

Base: `4081f0d93c2ec245ec0c164e18fc09642dea59c8`

## Root cause proved before implementation

The authorized live command stopped before credential or provider access because the global
ordinary ledger was keyed only by content `authoringAuthorityDigest`
`c0c2c8e39c86fc3a4b1630a90c0738fd71ce968dcfb632028991a92006149a43`.
That key already owned an immutable request-v4/claim-v1/receipt-v6 terminal produced by the old
prompt-v5 executable. The current prompt-v6 executable is materially different, but inherited
the same paid slot. No token-count call, generation call, receipt, claim, incident, cost, or
credential read occurred in the stopped command.

## Implemented authority cutover

- New exact-key `blueprint-authoring-execution-program/v1` binds the Blueprint/content versions,
  initial and repair prompt versions plus canonical prompt digests, provider and repair wire
  versions, draft schema version/name/digest, layout-policy version/digest, and structured-output
  compatibility-profile version/digest. It binds the runtime-consumed static token-request
  authority (roles, strict schema mode, disabled tools, `tool_choice:none`, and
  `truncation:disabled`) while the dynamic prompt/model/schema payload is bound by its own existing
  authorities. It also binds exact-count admission/evidence, admission ledger, generation evidence,
  the shared generation/count transport semantics, the frozen count-aware cost authority, and the
  effective provider/model/reasoning/repair-ordinal/timeout/retry/fallback/ceiling/budget/pricing
  policy digest.
- Both ordinary adapters consume the same frozen transport authority: exact HTTPS base and endpoint
  URLs, POST, `redirect:error`, one dispatch, null organization/project SDK identity, and closed
  forbidden identity-header sets. The ordinary CLI injects one lazy credential reader into both.
- The frozen cost authority is the runtime source for the 55/220 integer rates, strict 272,000
  breakpoint, 2x large-input multiplier, three generation calls, two repair/count routes, and the
  inclusive $5 ceiling. Repair ordinals are the frozen `[1, 2]` policy tuple and are separately
  bound by the same execution program. Descriptive labels that cannot change request or cost
  behaviour (`version`, `currency`, `source`, unit prose, the unused micro-USD conversion label,
  and descriptive policy-version labels) are absent from the semantic digests, so wording-only
  drift cannot mint another paid slot.
- Production request is v5 and embeds the exact current program. A self-redigested stale program
  fails before any ledger or paid factory.
- Current ordinary identity is
  `canonicalHash(v2 + authoringAuthorityDigest + executionProgramDigest)`. Request ID, timestamp,
  and output root are excluded, so one program cannot buy a second slot through an operator
  envelope change.
- Current ordinary claim is v2 and binds both the derived execution identity and program digest.
  Ledger paths use the derived identity. The stable content authority remains unchanged in the
  resulting Blueprint and downstream package authority.
- Request v4/claim v1 remain on the raw content key and are replay-only. Request v3/v4 validation
  uses frozen historical request validators. Receipt-v6/v7 replay still uses today's receipt-policy
  constants; freezing those receipt validators is an explicit prerequisite of the next material
  policy/program cutover. Fresh legacy ordinary and replacement dispatch are forbidden.
- Closed receipt pairing is enforced twice: request v5 accepts only receipt v7; lifecycle request
  v4 accepts its historically valid receipt v6 or v7. A canonically redigested v5+v6 substitution
  is rejected. A lifecycle-level v4+v7 fixture recursively reloads its canonical request,
  predecessor, receipt, and failed terminal while the separate fresh-v4 test keeps both paid
  factories unreachable.
- A valid slot owned by another request envelope is classified truthfully as
  `execution_identity_already_claimed` or `execution_identity_already_consumed`; invalid/torn
  durable authority still fails as `execution_state_uncertain`.

Current exact program evidence:

```text
program digest          634498356d69cf7bc63f2cec8d037ea4d27a9371fc9a08cd7f9607fcce0b4549
static request authority 6b4fe1100ac3aac88fe08fe5a7d394cd6ceb51759c4704f1a968320669014491
transport authority      f0a1718c6ab892bdb05375592ef6951fcb1a756ad15310a6dbda5f4212873b67
cost authority           0e67b4743b76ac856e14a42b1e71b2522701857ea748ed1265e71e5fc11bec19
effective policy         a5a2052d1364685e09542fc54d25f3102621ca2fdcdb7a2b3d0a056b69da724f
current identity         069c924d83146dd213823d789107a9409e965002b406fb1d9bf86cabda7860b6
legacy raw key           c0c2c8e39c86fc3a4b1630a90c0738fd71ce968dcfb632028991a92006149a43
```

The current identity does not exist in the global ledger; the legacy raw key remains present and
byte-unchanged.

## Offline proof

- Current cross-boundary focused battery: **13 files / 495 tests PASS**. It covers the program,
  request/lifecycle/replacement lanes, canonical launcher and executable boundary, count and
  generation adapters, exact cost/runner arithmetic, capture honesty, production foundation, and
  workload classification. The workload classifier recognizes the new program spec as ordinary
  and records the exact 352-file inventory (332 ordinary + 20 resource-intensive).
- Exact hostile boundaries pass: 272,000 uses the base rate; 272,001 uses 2x for the full request;
  a runner-side failure at 272,001 debits 2,992,011 micro-USD; exactly $5.000000 is admitted and
  $5.000001 is rejected. Self-redigested transport, cost, or static-request substitutions cannot
  reuse the current program identity, and duplicate generation/count dispatch is rejected.
- `npx --no-install tsc --noEmit`: exit 0.
- Production-scale child-process harness: eight pages, 86 first-draft diagnostics, 74,788-byte
  repair wire, one exact 50,000-token count, two generation calls, completed receipt v7. External
  boundary sentinels prove zero network, credential, or OpenAI-module access.
- Real on-disk immutable request-v4/receipt-v6 terminal reloads and exact-replays as
  `authoring_failed` with injected provider/count factories that throw if loaded; both remained
  unreachable.
- Full `npm run check`: both TypeScript phases passed. The 332-file ordinary partition completed
  with 4,231 PASS, 73 skipped, and exactly nine baseline missing-output-fixture assertions across
  five unchanged files. The 20-file resource-intensive partition completed with 614 PASS and 18
  test timeouts across four unchanged subprocess-heavy files, plus four pre-existing Vitest worker
  RPC errors (`Timeout calling onTaskUpdate`). The repository-wide command therefore exits 1 and
  remains an honestly reported infrastructure/fixture HOLD; no changed production or focused test
  file failed.
- The broad run preceded only the final deletion of descriptive, non-executable pricing and policy
  labels from the paid identity. On the resulting final bytes, `npx --no-install tsc --noEmit` and
  the complete 13-file / 495-test cross-boundary battery both passed; runtime arithmetic and
  dispatch code were unchanged after the broad run.
- `git diff --check`: clean. No provider, live, render, credential, deployment, database, or remote
  mutation occurred during this milestone.

## Version-discipline obligation

The first request-v5/program-v1 artifacts require exact-current program evidence. A future material
program or receipt-policy cutover must atomically introduce the new current request/program/receipt
versions, a frozen legacy request-v5/program-v1 validator, and frozen receipt-v6/v7 replay policy
for the existing request-v4/v5 pairings. It must not change the current program behind the same
replay contract.

## Next gate

Commit the focused local range and send that immutable range to Claude Code for adversarial,
read-only QA. Only after PASS: mint Fresh Readiness from the exact clean pushed head and run one
bounded live authoring attempt. Any live failure stops for diagnosis; there is no blind retry.
