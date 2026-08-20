# Decision Gate — Set Board Provider-Safe Identity Labels

## 1. Proposed change

Add one pure, versioned projection for metadata-only Set Board labels. Raw
`setIdentityId` and `locations[].name` remain unchanged in Visual Contract,
registry, storage and runtime authority. When either label contains vocabulary
that is forbidden in positive board authority, only provider-facing text uses
an opaque deterministic label. The same projected set label is used by the
image-generation prompt and the Vision QA instruction.

Descriptive physical authority remains untouched and fully guarded:
`timeOfDay`, `lighting`, `environmentClass`, geometry, fixed-object name,
material and scale continue to fail closed on cast, action, undeclared-prop or
spoiler vocabulary.

## 2. Why now?

The exact approved Chameleon Blueprint reaches Visual Package assembly but
Set Board projection stops before any provider call because the internal ID
`set_child_home_night` contains the generic cast token `child`. The related
metadata label `Child's home` has the same problem. Both are identity labels,
not instructions to depict a child. The other required board,
`set_town_night`, already completes a zero-cost dry run.

This blocks the first new-story Wizard package despite a valid Visual Contract,
approved reconciliation and approved Blueprint.

## 3. Scope

General Set Board infrastructure change. It is not Chameleon-, child-,
companion-, page- or style-specific.

## 4. Risk of hardcoding

No story literals or token substitutions are allowed. Unsafe set labels use a
content-addressed opaque label derived from the full raw identity. Unsafe
location names use a content-addressed opaque label derived from the exact
location id and name. Clean labels remain byte-identical. The raw identities
remain the only registry/runtime authority.

## 5. Files likely affected

- `lib/set-identity-board/boardSafeIdentity.ts`
- `lib/set-identity-board/positiveAuthoritySpoilerGuard.ts`
- `lib/set-identity-board/boardPrompt.ts`
- `lib/set-identity-board/boardQa.ts`
- `lib/set-identity-board/types.ts`
- `lib/set-identity-board/index.ts`
- focused Set Board tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

- Clean existing v4 prompt bytes and `promptHash` remain exact.
- `set_child_home_night` and `Child's home` never reach image or Vision text.
- Their opaque projected labels are deterministic and non-semantic.
- Raw identity continues to key definition hash, registry, storage and runtime.
- The Vision prompt independently reruns the full positive-authority guard.
- Unsafe descriptive prose still fails before provider/QA dispatch.
- The positive-authority policy advances from v1 to v2. v1 is retained as an
  explicit legacy constant; current writers and guards accept only v2.
- Board and registry versions remain v4. There are no approved v4 registry
  entries in the repository; the sole historical entry is board/registry v1
  and already cannot confer current authority.

## 7. Validation plan

Provider-free tests must prove:

1. frozen clean fixture prompt and hash remain byte-identical;
2. unsafe raw set/location labels are absent from positive and Vision prompts;
3. projected labels are deterministic, content-addressed and distinct;
   generated namespaces are reserved so a raw clean label cannot collide with
   another identity's projection;
4. Board QA invokes the guard before producing any instruction;
5. lighting, geometry, fixed-object and excluded-prop leaks still reject;
6. v1 is legacy-only and current definitions carry v2;
7. exact Chameleon home-board dry projection succeeds without provider access;
8. focused Set Board suites, `npx tsc --noEmit`, literal `npm run check` and
   `git diff --check` pass proportionately.

No image is needed to prove this milestone.

## 8. Cost impact

Implementation and validation cost $0: no provider, image, Vision, upload or
render call. After independent QA PASS, the next separately gated action is at
most two LOW Set Board images plus their Vision checks.

## 9. Rollback plan

Revert the focused commit. No persisted current Board or registry artifact is
rewritten and no production data is migrated.

## 10. Review assignment

Guy's standing decision is to open the complete new-story Wizard path while
preserving character-free Set Boards and avoiding speculative spend. Claude
Code must falsify byte identity, raw-label absence at both provider boundaries,
policy-version binding, descriptive-prose fail-closed behavior, deterministic
identity and any reinterpretation of historical Board authority.

No Claude Cowork product/creative review is required: this change removes
internal metadata from provider prompts and does not alter visual direction.

## 11. Do not do

- Do not rename or mutate the approved Visual Contract or Blueprint.
- Do not suppress or relax checks on descriptive physical authority.
- Do not use story-specific replacement words.
- Do not make raw labels recoverable from the provider-safe label.
- Do not change model, quality, renderer, budget, storage or approval policy.
- Do not render, upload, run Vision, approve a Board or promote a package in
  this milestone.

## Stop-check

1. General system fix: yes.
2. Cross-story/style risk: limited to label projection; frozen clean-byte
   regressions and full descriptive guard coverage are required.
3. Production behavior: provider-facing metadata only; authority remains raw.
4. Spend: none.
5. Smallest proof: pure prompt/QA tests plus Chameleon dry projection.
6. Guy decision: existing instruction to finish the new-story Wizard path,
   with no story-specific patch and no speculative render.
7. Claude falsification: listed above.
8. Product/creative review: not needed.
9. Guy eyeball after this milestone: the two LOW Board images, before approval.
