# R3-B1b M2b — current-consumer validation boundary

2026-09-09. IMPLEMENTED LOCALLY; FINAL FULL CHECK NON-GREEN; independent QA pending.
Not completed M2b, exact semantic acceptance, or render readiness.

## Received QA and topology

Guy supplied Claude Code's read-only historical-input PASS P0=0/P1=0/P2=0
for exactly `fdd568af..f59fe086`, branch `codex/r3b1b-semantic-recovery-m1`.
The report matches local HEAD `f59fe0869222206825b2b86cd2f2d1ee059669da`:
1 commit, 0 merges, 15 files, +1142/-12, four production paths, clean cached
ahead 11 / behind 0. Same Codex task remains sole writer in
`C:/GNart/Work/sh-r3b1b-semantic-m1`. Protected d53b `768ccb2f` and
accepted-intent `63ccb484` were clean and cached 0/0, with no write role.
No remote refresh, push, separate app task, parallel reviewer or cleanup.

Claude ran both typechecks, 61 focused tests, the exact real historical replay,
our 18 assertions and its own 21 assertions. It verified the three raw fixtures
and original inventory, and the failed full-check log by hash/content. It did
not rerun the full gate, test Linux/fresh clone or grant full M2b/semantic/
product/render approval. Its two non-null-assertion notes were not findings.
The previous full log still hashes to
`a906d9f0b734ae436b0246d4ea3cfc59bb96654e841abb467c5e2ea05c683b03`.
Prior timeout cause remains unresolved; this report explicitly does not exclude
changed dependency code as a possible contributor. No inherited classification.

## Lead finding, design, risks and acceptance

The approved M2a overlay changes coverage as well as template. Existing bridge
v5 deliberately admits only unchanged-coverage cover corrections; its current
candidate attester still rebuilds through the current factory and cannot accept
the frozen v3 paid receipt. The newly passed historical reader proves old inputs
only, with null current-consumer authority. A packet hash alone is not a proof
that current source/code/Git accepts the correction.

Expected: independently revalidate the exact historical input and effective
overlay against the executing repository's current accepted source, without
using old HEAD `18f22e75` as current authority, trusting rehashed review JSON,
or manufacturing a new paid candidate. The current worktree is not at origin
parity, so a real current-consumer validation must reject it.

Implemented a read-only boundary and CLI before the remaining versioned bridge
and approval consumer cutover. It intentionally has no persistence or write
option: later bridging must invoke fresh validation, not trust serialized proof.
This subdivision does not complete M2b or drop manifest/approval requirements.

Rejected: weakening bridge-v5 equality, changing the current paid factory,
feeding a frozen receipt into it, skipping full historical validation, minting
approval from Guy's generic render permission, or exporting a pure builder that
accepts caller-provided current repository authority.

Risks: shared preview refactor must preserve its exact digest; async replay can
span source/Git/input movement; a clean unrelated repository must not vouch for
executing code. Finite before/after checks are not an OS lock or proof against
arbitrary ABA changes after return. The API is an offline source-worktree tool;
bundled/deployed execution is intentionally not admitted by its code-root pin.

Acceptance for this boundary: exact original packet unchanged, independent
old/current identity, current source equality, strict clean same-name origin
parity, no caller-supplied proof/approval/output fields, rejection of rehashed
packet changes and observed input movement, no write/env/provider invocation,
and regressions for old preview/current/cover-only paths. No semantic approval.

## Implementation and unchanged consumers

- `semanticCorrectionPreview.ts`: extract one shared pure packet constructor;
  existing preview uses it. Same v1 fields/order and exact packet digest.
- `qaWizardCandidateBridge.ts`: one new strict read-only current Git wrapper,
  reusing existing private fixed-argv observation and freshness checks. Requires
  a non-main local branch and same-name origin upstream. All old callers and
  version constants, factories, loaders and cover-only equality remain unchanged.
- `semanticCorrectionConsumerValidation.ts`: exact three-key argument surface;
  derives executing root from module location and compares real paths; reads
  current Git, validates full historical chain, reads bounded canonical packet,
  reloads source-bound cast review/current accepted revision, and reconstructs
  the entire packet. Repeats history/source/packet/Git observations across replay.
  Returns version v1 proof with original/effective coverage/template/catalog,
  packet/plan/correction/history digests and separate repositories. Semantic
  approval and bridge manifest are null, zeroWrite true, providerCalls zero.
- `scripts/validate-semantic-correction-consumer.ts`: real read-only CLI; only
  one bounded ordinary single-link request file, no write option. Strict/repeated
  flags reject; sanitized output has no raw path/source/exception on failure.

Remaining version-pin inventory: reconciliation authoring, Blueprint authoring
and package lifecycle still require the old bridge v5 and are not cut over.
They therefore cannot consume this new proof as approval. The new versioned
changed-coverage manifest and its complete consumers remain subsequent work.
No supporting-cast schema, source, catalog, style, rendering policy, existing
test timeout, worker count, skip policy or dependency change. The new CLI test
has its own 20-second budget and 15-second subprocess limits; old tests are
unchanged. New spec is ordinary by the
existing classifier: 389/367/22 becomes 390/368/22; workers remain 4/2.

## Validation and exact limitations

Local evidence: `outputs/qa-m2b-consumer-20260909/`.

Initial TypeScript run found test-only use of unsupported `String.replaceAll`
and three missing arguments to typed mock calls. Tests used regex replacement
and correct call arguments; subsequent root typecheck passed. Production rules
were not relaxed. Initial focused 91 tests passed before these typing fixes.
Final focused 93/93 in four specs passed (32 new consumer tests, 27 semantic,
27 historical, 7 inventory). The new spec covers exact packet reconstruction,
tampering, argument smuggling, source/consumer/history/packet substitution,
scoped positive-control write/env sentinels, strict mocked Git observations and
actual CLI rejection. Historical and Git boundaries in unit integration are
mocked; this is not whole-graph live-Git proof.

The actual `request.json` binds the untouched protected P1 chain and the existing
review packet. Actual CLI returns rejected/zeroWrite/providerCalls=0, exit 1.
The diagnostic calls the real API first and confirms the named current Git
stale-or-dirty rejection, before substituting only current Git process output.
Under those **synthetic current Git observations**, it traverses the real full
historical graph twice, reloads the real current accepted source and unchanged
review packet, and succeeds. No proof file or approval is persisted. The probe
reports syntheticCurrentGit true and authorityGranted false. This positive test
does NOT establish actual clean-parity admission or authorize downstream work.

`probe.ts`: 24 synthetic fixed-argv current Git reads; scoped writeFileSync and
.env-read sentinels have positive controls and observe zero implementation
attempts; external network-denial preload is active; providerCalls=0. Other
filesystem APIs are not claimed covered by these sentinels. Historical readers
remain the independently passed real implementation, not stubs in this probe.

Identities reproduced:

- packet `b7fdd4e5fbf8f8685de7e25baa9bcefe78df95829ad30a66ab6d23981f15c1c2`;
- historical proof `3fa83ab299f7807907e5ebc6769e58b1562f2af8581bbbb09b545eac4ee9b437`;
- effective template `a7fe2c58a09d90a3a8f08013534fd26233c8a366594e7bdec15cae4fc3c94dc9`;
- effective coverage `f65f57de560f2bc550ae529bc362eb9042fdfb823712819c23de0768d463d9bf`;
- current catalog v4 `767e563e91edc6ec20ea9e6a27e4b606b60aa97dbca09b0868ca5f3da710c9be`.

The packet raw SHA-256 before this change is
`d2020e7381679502380fa44c0e1c357da4204155f73885adabb479759eb3c4ba`.
Original P1 expected inventory remains 14 / 412516 /
`cd621f7712912a92d14fa87432c609c5e92a006363e7eed7be5231a856e8fdd0`.
At 00:14 +03:00 both original inventory and packet raw SHA were recomputed and
match the values above. Focused log SHA-256:
`e52fcc8cb184b7481e93f9046944075f3c8cd874986d96a1b15189ac1b1f3a9f`;
probe log `ccbbb17b9aa329f594ae4f63e879bf6d37fca047289c9bd6742a0d4a29ec407b`;
actual rejected CLI log `0fb0af6f2c04e43772fd78c88a97da7af16fa3f47a6096939e8fab3e3f72f1da`.
Final `npm run check`: exit 1, both TypeScript projects passed. Ordinary 5022
passed / 73 existing skips, 351 passed / 17 skipped files (368), 176031ms.
Resource-intensive 658 passed / 13 failed, 17 passed / five failed files (22),
453896ms. Total **5680 passed / 73 existing skips / 13 failed**. Diagnostic
protocol OK, classes test_timeout and signal_or_exit_failure, full gate failed.
Log SHA-256 `12b7a5f2ed45766715a03182b40b9eb31a18e9345d02b9f2c3582bf8651ff856`.
No original file was touched. No full-run retry loop or limit changes follow.

All 13 reported test failures are timeouts in unchanged specs (12 at 5000ms,
one at 15000ms), not assertion mismatch verdicts:

- canonical-materialization-input: real writer entry under external boundaries;
- canonical-pre-live-readiness: authority composition; redigested prior readiness;
  tampered per-attempt schedule; one-attempt/resume (four);
- live-execution-request-materialization: canonical derivation; real public-entry
  sentinels; branch/ref movement; unexpected-verifier cleanup (four);
- live-execution-supervisor: explicit ref/divergence; signal; spawn error (three);
- qa-wizard-candidate-bridge: exact Fresh Readiness/completed Supervisor provenance
  (`:1574`, 15000ms; the remaining 14 bridge tests passed).

The last item is in a changed module's regression surface; a contribution from
this change is not categorically excluded. No native/timing root cause or
inherited classification is established and separate passes cannot turn this
full run green. Original failed logs are preserved. The complete new 32-test
consumer spec also passed within this final full run.

Bounded bridge comparison, unchanged 15000ms limit throughout:

1. Current isolated test: timeout at 15282ms, exit 1; 14 other tests excluded.
2. Untouched `f59fe086` archive: passed at 10997ms, exit 0; 14 excluded.
3. Current isolated repeat, no code change: passed at 10753ms, exit 0; 14 excluded.

This demonstrates intermittent timing on the current code, not an inherited
failure at the base (the base passed), not a fixed cause and not a full-green
gate. The other twelve current full-run failures were not isolated/reclassified.
The two changed existing production files and the bridge spec in the baseline
copy are byte-identical to `git show f59fe086:<path>`. The baseline is a local
`git archive` extraction under `outputs/qa-m2b-consumer-20260909/base-f59fe086`,
not another Git worktree, branch or fresh dependency install. It shares the
existing node_modules via a junction; its own config resolves `@` against the
baseline directory. The archive/extraction are retained as diagnostic evidence.
Only that selected spec was run there; no baseline full-gate claim follows.

Raw SHA-256: failed isolated log
`b44fb12b7e0fca71eab5bae922c43f1b951525fb91dd9659731dfa9069526c0f`;
base pass log `0807283c9a70adaf7c447c73fec329dae36b3f5adc1f67a8e26d926fcf5c532b`;
current repeat pass log `12ef9983d0a25a293de039b1dd2ebff3678f6f88083609a1411c12ca3f392537`.

Local `claude auth status` at 00:14 +03:00 reports loggedIn false/authMethod
none. No review was dispatched or model work started. The external authenticated
route Guy used to supply this review remains the available QA handoff route.
The current Git checks use local origin tracking refs, not `ls-remote` or fetch;
no live remote propagation claim is inferred from cached ahead/behind state.

## Stop-check and remaining authority

General system fix, not story/person/page-specific production code. It can
affect shared preview/bridge imports, hence regressions/full check. No production
authority is widened and cost is USD 0. Smallest proof: exact packet + current
source + real historical graph with explicit diagnostic-only Git substitution,
actual Git rejection and hostile inputs. Existing owner recovery approval
suffices for implementation. Guy's exact-artifact semantic decision still must
precede later approval; Cowork advice is optional, not dispatched.

Claude should falsify packet-construction equivalence, root mismatch, stale
current source, Git movement/dirty/parity smuggling, skipped history, rehashed
approval/template/coverage/catalog and unsafe write/credential reachability.
The supplied PASS ends at f59fe086; no independent PASS is self-awarded for this
new code. No fresh-clone/Linux proof or real current-consumer attestation.

Next: independent QA of this boundary; finish changed-coverage manifest and
exact approval/reconciliation/downstream binding. A real current validation
requires clean propagated implementation state, not a synthetic probe. Push
requires explicit propagation authorization; generic render permission does not
grant it. Exact semantic acceptance, Blueprint/Boards/package qualification and
bounded LOW sample follow their existing gates. Full-book generation and payment
remain excluded. Rollback is a focused revert or ceasing to call the new API;
original paid artifacts, accepted source and old routes remain intact.
