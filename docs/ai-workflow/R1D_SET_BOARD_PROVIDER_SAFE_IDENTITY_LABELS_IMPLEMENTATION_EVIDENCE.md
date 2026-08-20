# Implementation Evidence — Set Board Provider-Safe Identity Labels

## Outcome

The approved Chameleon Blueprint now passes the Set Board positive-authority
projection boundary for both required Sets. Internal identity labels that
contain cast vocabulary are replaced only in provider-facing text with full
canonical SHA-256 labels. Raw Set and location identities remain unchanged in
definition, registry, storage and runtime authority.

No provider, image, Vision, upload, approval or render call was made in this
milestone.

## Root cause

The required Set `set_child_home_night` and its location label `Child's home`
are metadata, but both contain the generic cast token `child`. The prior guard
treated every positive string as visual descriptive authority, so Visual
Package assembly stopped before Board minting. The second required Set,
`set_town_night`, already completed the same provider-free dry projection.

The image prompt was not the only boundary: the Vision QA instruction also
emitted the raw Set id. Projecting at only one call site would therefore have
leaked the same metadata downstream.

## Implemented contract

- `setBoardSafeIdentityLabel` and `setBoardSafeLocationName` are pure and
  deterministic.
- Clean labels remain byte-identical.
- Unsafe Set labels become `set_<full canonical SHA-256>`.
- Unsafe location labels become `location_<full canonical SHA-256>` over the
  exact location id and name.
- Generated `set_<digest>` and `location_<digest>` namespaces are reserved; a
  raw label already in either form is re-projected so it cannot collapse a
  distinct identity without a cryptographic hash collision.
- The same projected Set label is used by the image prompt and Vision QA.
- Vision QA independently invokes the full positive-authority guard.
- Raw Set/location identity remains the sole registry/runtime authority.
- Descriptive physical authority remains unmodified and fully guarded.
- The positive-authority policy advances from v1 to v2. Current writers and
  guards accept only v2; the v1 projection behavior is retained only as an
  explicit legacy replay surface.
- Board and registry versions remain v4. No current approved v4 registry
  artifact is rewritten or migrated.

## Provider-free runtime proof

Exact output root:

`outputs/r1d-chameleon-qa-wizard-dispositions-418fbfe4-20260820T090012541Z`

The approved Blueprint authority is unchanged:

- Blueprint digest: `e473e9e965b5439b8aabee22cff45bc103348eb7294e962b070ab1628152dabd`
- Blueprint review digest: `204fc91e112dd0f04beb93cf3314995fb838e5de025eb499c2fee70a8cdf99d6`
- Guy approval digest: `f48affee3fdbf9db826c19ccbb99a65047a604b21ba3ad3cce18e9d56449a3ba`

The Chameleon home Board dry projection now succeeds with no provider access:

- Set identity: `set_child_home_night`
- Set definition hash:
  `c890d4fd2d97c26d93677930cb937ba48ac20c41c2447149ad2beec0bbd20d70`
- Prompt hash:
  `d62ac59dba6d24e3875ea9dd2c9d9da75812a866bd26c8f06a90e00fcb5ff1ce`
- Provider Set label:
  `set_444c5477f45c827c4dd759bdd9e8f3d5bb2c4b199ee66bd8408da161d8f1f368`
- Provider location label starts with `location_` and carries the full canonical
  digest.
- Raw `set_child_home_night` and `Child's home` are absent from the positive
  provider prompt.
- The negative prompt still intentionally contains the generic prohibition
  `child`; negative safety authority is unchanged.

The town Board dry projection also succeeds. Re-running exact Visual Package
assembly after the correction advances past positive-authority projection and
now reports only the two expected missing current Registry artifacts:

- `set_child_home_night`
- `set_town_night`

This proves the label leak is closed and that the next action is exactly the
two separately gated LOW Board mints, not another Visual Contract, Blueprint,
or Wizard architecture correction.

## Validation

- Focused prompt/guard/safe-identity/classifier suite: **4 files / 37 tests
  passed**.
- All Set Identity Board suites: **13 files / 311 tests passed**.
- Adjacent Visual Package lifecycle suites: **3 files / 50 tests passed**.
- Adjacent frozen Fox Set identity fixture: **1 file / 6 tests passed**.
- Workload classifier: **1 file / 7 tests passed**.
- `npx --no-install tsc --noEmit`: passed.
- `git diff --check`: passed.
- Literal `npm run check`: TypeScript and autonomous Story typecheck passed;
  resource-intensive passed **20 files / 610 tests**; ordinary passed **3,351**
  and skipped 65, failing only the five established missing ignored-`outputs/`
  fixture assertions in four unchanged specs.

## Unchanged behavior and exclusions

- No Visual Contract, Candidate, reconciliation, Blueprint, style, image
  prompt direction, model, quality, budget, storage, registry approval or
  renderer policy changed.
- No story-specific substitution or token stripping was added.
- No existing artifact was rewritten.
- No Board is approved by this milestone.

## Next gate

Independent Claude Code must falsify raw-label absence at both provider
boundaries, clean byte identity, policy-version binding, descriptive-prose
fail-closed behavior, deterministic identity and historical artifact handling.
Only after PASS and push may the two required LOW Boards be minted and run
through Vision QA. Guy must eyeball and approve them before Visual Package
assembly advances.
