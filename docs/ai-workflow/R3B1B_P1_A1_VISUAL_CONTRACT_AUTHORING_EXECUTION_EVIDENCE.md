# R3-B1b P1-A1 Visual Contract Authoring — Execution Evidence

Date: 2026-09-04

Product owner: Guy

Technical owner: Codex

Branch: `codex/r3b1b-accepted-intent-wave-2`

Execution base: `efa9495bcdf598a07b3f2d74ebd2452c543ace47`

Status: **HOLD — BOUNDED LIVE AUTHORING FAILED CLOSED; NO CANDIDATE; NO RETRY
OR DOWNSTREAM AUTHORITY**

## 1. Authorized boundary

Guy authorized P1-A1 for `dragon_dini_adventure` revision
`64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`:

- Visual Contract authoring only;
- OpenAI Responses / `gpt-5.6-sol`, service tier `default`, reasoning
  `medium`;
- at most seven standard calls plus one terminal-reference cleanup call;
- no fallback and zero transport retries;
- projected maximum USD 7.656 and hard ceiling USD 10; and
- stop after candidate/evidence for independent QA and Guy review.

The approval explicitly excluded Blueprint, images, Boards/props, package,
locator, render, narration, canonical publication and deployment.

## 2. Pre-live identity and readiness

The run used ignored output root
`outputs/r3b1b-p1-a1-dragon-dini-visual-contract-20260904` and request ID
`r3b1b-p1-a1-dragon-dini-20260904`.

The canonical zero-cost preparation and verification passed before credential
access or provider use:

- accepted revision: `64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc`;
- canonical authoring source digest: `a5942c3646d08bc037395851311e9627bdfc1dd29f7874a45b000b87af416630`;
- source snapshot: `8de91442f084a45af642bdaa49bd73f31ba37cf03c00ccd0aafad2995e605f16`;
- source-authority request: `7082143718ff3648b9e1f9a390a756721c891a6886b2f071b4b7aafe46cc9909`;
- authoring request: `c38170d47385781f82fff3bbd3f09d5d4e8ec4c80eea18b4595ccbdc8e807856`;
- B0 materialization manifest: `3af1da97873e49a00e3d8390f2544e617b14cf8fcb7c595a1bd0cbfa04b09361`;
- canonical execution request: `18719f55930b1be273249ce500d78a5a3b94eca6aadc4e26e6a9ca06450a9389`;
- pre-live readiness evidence:
  `af5fdfac45758ae7cfb033ad038f17fc03613b168cdaaa447ff4e794c45cedd0`;
- supervisor verification readiness:
  `5e1e8912c178e8837d5d204252fa0ee8545f1f6f88df0e4904e7aaf97b8cdfbe`;
  and
- Git HEAD/upstream: exact `efa9495b...` parity, clean tracked and untracked
  state before live execution.

All request-policy and structured-output compatibility checks passed. Pre-live
evidence recorded zero credential reads, network/provider calls, database or
storage writes. The live supervisor then read the configured credential source
only after the authority check; no ambient credential was inherited.

## 3. Live outcome

The canonical supervisor invoked exactly one live child process. The child
returned exit 1 and the supervisor returned `child_failed` /
`child_nonzero_exit`; `outputAuthority` is null.

The content-addressed authoring receipt is
`outputs/r3b1b-p1-a1-dragon-dini-visual-contract-20260904/b0/authoring-receipts/e60f689fd4668867e6f4bed39b7a4e465a17c901f2066dc66af0636728ff367e.json`.
It proves:

- status `failed` and no Visual Contract candidate digest;
- two logical provider calls and two transport dispatches;
- zero transport retries and no fallback;
- one initial full-draft call at 40,000 maximum output tokens;
- one `page_contract_patch` repair call at 32,000 maximum output tokens;
- aggregate 16,082 input, 16,076 cache-write input, 26,353 output, 3,938
  reasoning and 42,435 total tokens;
- nominal estimated cost USD 0.607464;
- conservative accounted cost **USD 0.668218**, below both projected and hard
  ceilings; and
- no cleanup call and no further standard call.

The source credential value is not persisted in the evidence.

## 4. Terminal failure and bounded root cause

The terminal code is `draft_authority_reference_domain_invalid`, phase
`draft_authority_reference_domain`, error class
`authority_reference_domain_failure`, with repair eligibility `ineligible` and
reason `authority_reference_domain_not_repairable`.

The final page-10 repair output assigned
`beat:p10:child_pushes_cart` to two Action Semantic Coverage records. The
compiler therefore reported exactly three closed diagnostics:

1. `action_coverage_cardinality_invalid` for page 10 action index 0;
2. `coverage_beat_cardinality_invalid` for page 10 coverage index 0; and
3. `coverage_beat_cardinality_invalid` for page 10 coverage index 1.

The deterministic validator correctly rejected the draft. The current compact
repair applier admits the targeted field change but does not convert this
post-repair duplicate-coverage graph into another bounded repair target;
`coverage_beat_cardinality_invalid` is not admitted by the current
action-binding repair-plan mapper. That is a general recovery-path gap, not
authority to weaken validation or hand-edit a P1 candidate.

## 5. Replay proof

The captured structured responses are persisted at
`outputs/r3b1b-p1-a1-dragon-dini-visual-contract-20260904/b0/structured-draft-replay-evidence/c8e6fee790a0738f90d7c2b528c36e0779634050373c3a7ed7ba5aa0fcea457b.json`.

The repository's official zero-provider replay command returned exit 0 with:

- `providerCalls: 0`;
- `exactCapturedCallSequence: true`;
- expected and observed outcome `invalid_draft`;
- candidate, failure code, final issue count/digest and terminal failure
  identity all congruent; and
- `receiptOutcomeCongruent: true`.

Thus the receipt is reproducible from the captured structured outputs without
a paid call. It does not establish that a candidate exists.

## 6. Authority and next gate

Readiness evidence digest
`45d79882bead89481e6fc3dac380b8ad455f7a8381447b7a5045a0ad901afd15`
records the authoring failure, candidate absent, semantic reconciliation
absent, human source approval absent and Blueprint authoring not ready.

This execution created no Blueprint, image, Board/prop, package, locator,
render, narration, publication or deployment authority. It did not alter the
0.70 resemblance threshold or P1's 17/18 catalog containment.

The next safe work is a zero-cost Decision Gate for the general post-repair
coverage-cardinality recovery path, followed by implementation and independent
Claude Code QA if Guy approves it. Any new provider attempt requires a fresh,
explicit P1-A1 spend authorization. The unused call and dollar headroom from
this failed execution is not standing retry authority.

## 7. Validation

- official captured-response offline replay: exit 0, provider calls 0, exact
  call sequence true and receipt outcome congruent true;
- focused pre-live, Supervisor, launcher and replay suite: **5/5 files and
  114/114 tests passed** in 119.47 seconds;
- `npx tsc --noEmit`: exit 0; and
- `git diff --check`: exit 0 before commit.

`npm run check` was not run. No repository-wide green result is claimed. No
code, schema, test, package or runtime path changed; tracked scope is execution
documentation only, while the content-addressed live evidence remains in the
existing ignored output root for local independent review.

## 8. Independent QA targets

Claude Code should falsify:

1. exact accepted revision/source/snapshot identity;
2. pre-live readiness and clean Git topology;
3. exactly two calls, two dispatches, zero retries and no fallback;
4. conservative cost arithmetic and USD 10 fence;
5. the three page-10 diagnostics and absence of candidate/output authority;
6. exact zero-provider replay congruence;
7. the claimed general recovery-path gap without proposing weaker validation;
8. absence of every excluded downstream artifact or authority; and
9. documentation-only tracked scope and preserved ignored evidence.

This document is Codex execution evidence, not independent technical PASS and
not Guy product acceptance.
