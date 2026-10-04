# Trial 05 stopped: evidence closeout and read-only QA brief

## Requirement and exact authority

Guy requests one readable story from the engine: fresh Opus author, fresh Opus
editor, independent Astra QA, text only. Repeated failures must stop for diagnosis.
His latest addition asks to simplify unnecessary machinery without losing quality
or meaningful QA. This document records completed work and observed failure;
it authorises no new code, paid retry, release or public cutover.

Sole implementation task: Codex current thread. Engine worktree:
C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes,
branch codex/personal-book-storyboard-bridge. Trial source frozen at
275c18343cffeb2447beb7b1e37246a6af52f740, clean, cached ahead 7 before this
documentation-only successor. No remote verification, fetch or push was done.

Other relevant worktrees, read-only and clean at closeout:

| Purpose | Head | Cached topology |
| --- | --- | --- |
| Protected d53b | 768ccb2f | upstream aligned |
| Protected accepted intent | 63ccb484 | upstream aligned |
| Site QA | 5fe73b3f | no upstream |
| Claude site | 87b0d196 | ahead 4 |
| Detached envelope reviewer | a56e1813 | detached |

No writer was added to those branches. Their site/assets/runtime state is outside
this text-only closeout. Git warned of an unreadable global ignore file in the
read-only audit; no configuration was changed.

## Independent source reviews and engineering checks

Real logged-in Claude Code Opus 5.5 was invoked twice, safe-mode, tools disabled,
fresh process/no session persistence, effort high, USD 1 configured review budget
each. Native exits 0, reported sole model claude-opus-5-5, source remained frozen.

| Exact range | Claude verdict | Captured estimate USD |
| --- | --- | ---: |
| 0b3e7ec2..5b9628ec | technical PASS, P0/P1/P2 zero, two P3 notes | 0.816692 |
| 5b9628ec..275c1834 | technical PASS, P0/P1/P2/P3 zero | 0.773292 |

These are independent SOURCE-INSPECTION reviews of supplied frozen source/diff/
evidence packets, not independently executed tests, filesystem preservation,
provider attestation, literary/product acceptance or an expanded previous PASS.
Original review records were not edited. Review report hashes:

- First: 599fd25f45c0e999d477675321f91fe13aa7353f9fe0343056f8a04b35326685
- Re-gate: b8ac7494015de8e42259bb81c4cb79a6b9bc01cc30705fa245112d547ada01c3

Codex's existing measurements: first correction focused 308/308, successor
314/314, type check 0; baseline and instruction mutation controls recorded in
their handoffs. No new code/spec check is claimed for this docs-only closeout.
Parent full gate remains RED: ten previously named ordinary failures, 6,066
passed/73 skipped; resource 635 passed plus two onTaskUpdate RPC errors. No
successor full run, stable-release inference or cause reconstruction is claimed.

## Trial 05 admission, attempt and actual terminal result

Fresh approval reference guy-text-calibration-20261004-05-bounded-continuation;
fresh stem personal-calibration-517199c47311f9e302254d55391d73e7. Same wholly
fictional Neta age 4, Uri, short eight-spread profile; no photo/voice, rendered
images or real child biography. Same conservative prices and output caps.
Preflight verified reviewed frozen source, first-party login, existing OpenAI
key presence without revealing it, current pricing and fresh unused families.
USD 12 estimate allowance, not a guaranteed provider invoice ceiling.

The single launcher invocation returned native 1 with
status failed / code provider_or_contract_failed. Layer separation:

| Layer | Observed result |
| --- | --- |
| Astra identity/schema probe | completed, reported gpt-6-astra/default |
| Opus native CLI | exit 0, subtype success, is_error false |
| Opus returned structured planning | selected result, eight beats |
| Adapter admission | usage, 22,785 aggregate output vs configured 18,000 |
| Book seal | usage, only case1:plan claimed/settled |
| Launcher native exit | 1 |

Raw report includes 7,752 thinking tokens, three CLI turns, 4 input tokens plus
28,040 cache-read and 19,569 cache-creation tokens. Structured result and result
text each occupy 18,642 UTF8 bytes; stdout totals 39,803 bytes. This proves stored
duplication, NOT that duplicate bytes explain all token use or that three turns
equal three internal requests. The full request inventory was not captured.

Memory-only compileCausalPlan of the structured result returns selected; both
candidates contain an approved interest and current citation/binding guards
pass. This does not rehabilitate the sealed result or prove logical entailment,
appeal to children, final prose or downstream capacity. No accepted synopses.json,
author/editor/literary Astra calls, books.json or viewer exists. No sixth attempt,
automatic replacement, re-decoding accepted records or paid-output mutation.

## Root cause and financial distinctions

scripts/personal-causal-trial-adapters.ts sets CLAUDE_CODE_MAX_OUTPUT_TOKENS for
Opus, labels the wire configured_per_request_not_cli_aggregate, then compares
modelUsage.outputTokens against that same value before decoding. These scopes
are different. The existing over_tokens synthetic test encodes that assumption;
its green result does not validate the assumption against the actual CLI.

Anthropic documents the setting as a limit for most requests, and the result
as cumulative usage/cost across an agent query. It also explicitly calls cost
figures client-side estimates rather than billing authority.
[Environment setting](https://code.claude.com/docs/en/env-vars),
[usage and cost scope](https://code.claude.com/docs/en/agent-sdk/cost-tracking).
Observed source/runtime match this diagnosis; the docs do not retrospectively
attest each individual request's enforcement in our pinned binary.

| Distinct financial observation | USD |
| --- | ---: |
| Opus reported estimate | 0.617876 |
| Actual-wire visible-input reservation | 0.772280 |
| Reserved plan-slot / configured CLI budget | 1.311200 |
| All reserved book slots | 11.338803 |
| Trial 05 including probe | 0.628751 |
| Captured five book-trial estimates | 1.232789 |
| These two independent source-review estimates | 1.589984 |
| Combined captured subset | 2.822773 |

The received Opus estimate is under both wire and slot figures. Visible byte
reservations do not upper-bound hidden prompts/CLI turns. Reported estimates,
reserved allowances and actual provider invoices are NOT interchangeable.
Combined amount is not every project charge or every historical QA expense.

## Preservation and evidence locations

Common local evidence parent:
C:/Users/guyna/.codex/visualizations/2026/09/04/01a06c5c-a233-76c0-ac8e-618c02ce6246.
Trial05 runtime: single-book-calibration-20261004-approved-05 under that parent.
execution-closeout.json SHA:
d8cb28a70664e50333fc264c1b6d36b08602d4253924e41479b86328819e68d1.
It records 56 previously preserved and fourteen new paid evidence files.

Independent read-only engineering subagent recursively enumerated exactly
70 unique evidence files / twenty roots across five closeout baselines: zero
missing, extra, SHA or size mismatches. All four prior closeout fingerprints
match. Original Claude envelope report SHA remains
8884bd8e2de7a7efbd73219a8a0c27f062ea6f3d646dd434353dc44d5ae5e5a4.
This is a local point-in-time preservation audit, not Claude independent QA or
verified backup. Outputs and journals remain ignored/local.

Trial paid output roots: outputs/<stem>-probe and outputs/<stem>-book in the
engine worktree. Journal roots: C:/GNart/Work/Small_Heroes/.git/
codex-causal-text-trials/<stem>-probe and <stem>-book. Source-review records:
causal-contract-alignment-20261004 and its p3-regate child under the local parent.

## Next action and adversarial closeout review

Paid work remains stopped. The linked Decision Gate separates the narrow
accounting-scope fix from product-path simplification. Neither is implemented.
Do not solve this with a blind token-cap increase, thinking subtraction, turns
multiplier, sealed-plan reuse or a new orchestration framework.

Claude Code, first pass read-only against this documentation-only successor:

1. Confirm parent is 275c1834 and changed paths are exactly CURRENT.md,
   ROADMAP.md and the two new Markdown documents; no production/spec/asset edit.
2. Falsify each exact PASS range and SOURCE-INSPECTION limitation against the two
   immutable original reports. No wider PASS/test-execution claim is allowed.
3. Independently inspect receipt, dispatch, seal and native outcome; distinguish
   usage accounting from provider/schema/domain failure and plan from manuscript.
4. Recompute all seventy evidence hashes/sizes and enumerate extras. Do not edit
   receipts, recover a sealed family or invoke any provider.
5. Check cost sums and per-request/cumulative/reservation/invoice distinctions.
6. Check the simplification document's ordinary/research path mapping, proposed
   independent-QA retention and explicit not-implemented/not-proven boundaries.

Out of scope: new provider calls, keys, resets, images/storyboard/narration,
cohort trial, site QA integration, public rollout, deployment, push, product/
literary/visual acceptance and repository stability closure.

### PowerShell inspection and optional later push

No push is authorised by this closeout. If Guy later explicitly chooses to
publish the whole current branch after checking all its review records:

```powershell
Set-Location 'C:\Users\guyna\.codex\worktrees\personal-story-product\Small_Heroes'
git status --short --branch
git log --oneline origin/codex/personal-book-storyboard-bridge..HEAD
git diff --stat 275c1834..HEAD
git diff --check
git push origin HEAD:codex/personal-book-storyboard-bridge
```

The final push line is conditional, not a command to run now. It publishes all
ahead commits, not only the closeout; no unrelated branch merge is implied.
