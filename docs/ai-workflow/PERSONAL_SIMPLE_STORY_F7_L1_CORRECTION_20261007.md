# Simple story engine — F7/L1 correction after Codex QA (2026-10-07)

Status: bounded correction committed locally, awaiting Codex independent re-QA. **No PASS is self-awarded.** Successor full gate
pending (Codex runs it once on frozen source). Not pushed.

- Worktree `C:/Users/guyna/.codex/worktrees/simple-story-literary-followup/Small_Heroes`, branch
  `codex/claude-simple-story-literary-20261007`. Starting HEAD `0e8dfd5f` (clean, as specified).
- Code commit `39601440` (F7 + L1 + tests). This handoff, `CURRENT.md` and `ROADMAP.md` are in the docs commit on top.
- Input: Codex report `CODEX-QA-SIMPLE-LITERARY-0e8dfd5f-20261007.md`. **That file was not reachable from this session** (not in
  the worktree; a wider search was not possible here). I worked from the F7/L1 specification Guy relayed in the brief. If the
  report says something the brief did not, this correction does not cover it.
- Scope: F7 and L1 only. Nothing else changed.

## F7 — all-fixture trial admission

Confirmed. `runSimpleStoryTrial` admitted a cohort when `accepted.containsFixtureData` was true. That value comes from
`requestContainsFixtureData` in `draft.ts`, which is true when ANY surviving value is fixture. So a request with typed or
transcript values was admitted if one value was fixture. A parent-chosen topic (no `suggestedBy`) did not count against it.

Fix, in `scripts/personal-simple-story.ts` only (the shared `draft.ts` helper is unchanged):

- New `requestIsAllFixture(accepted.canonical)`. It requires `fixture` provenance for:
  - name, age and address;
  - residence, when non-empty;
  - every fact;
  - the story place, when present;
  - a topic intent, through `suggestedBy: 'fixture'`.
  `just_for_fun` or no intent has no provenance to check.
- The runner checks every case before it creates the output directory, reserves budget or uses the transport. Error code
  `trial_fixture_only` (was `trial_fictional_only`). One mixed case rejects the whole cohort, including a later case.
- In the CLI, a live run with a mixed cohort throws before the executable hash check and before the transport is created. The
  process exit code is 3 (setup).
- Dry preview: the per-case label is `allFixture`, from the same predicate. It was `fictional: containsFixtureData`.
- Fixture provenance is a policy boundary. It is not independent proof that a child is fictional.

Tests (`simple-story-engine.spec.ts`, runner boundary):

- Positive control: an all-fixture two-case cohort, where the second case has a fixture story place and a fixture topic.
  Status `complete`, 4 dispatches.
- Negative cases, 8 variants via `it.each`. Each variant is all-fixture except one value, placed in the **later** case:
  - name, age, address or residence;
  - an extra typed fact;
  - a typed story place;
  - a parent-chosen topic;
  - a transcript-suggested topic.

  Each test checks that the shared ANY flag would still admit the case, that the run rejects with `trial_fixture_only`, that the
  transport has zero calls and that no output directory exists.
- CLI: the dry preview labels `[case-a true, case-b false]`. A live run rejects, `createTransport` is never called and no output
  directory exists.
- The runner fixture helper now sets `suggestedBy: 'fixture'` on the topic. The shared `request()` used by the engine tests is
  unchanged, so engine shapes and request IDs do not move.
- Mutation check: I replaced the topic clause with `true` by hand. Three tests failed (parentTopic, transcriptTopic, CLI). Then I
  reverted it and the tree was clean. A scripted loop over every clause was blocked by session permissions. The other clauses are
  covered by construction: each variant differs from the passing control in exactly one clause. They were not mutated one by one.

## L1 — no-theme reactions

Confirmed. With no theme, the author was told "do not invent a fear, a shyness or a hesitation" and the editor "do not add a fear
or hesitation". Together these work as a blanket ban on any momentary reaction.

New text:

- **Author:** with no theme, no lesson. Do not give the child a fear, shyness or difficulty of their own, from life or carried
  through the book. No scene has to be about getting over a feeling. A short, natural reaction that the adventure itself causes
  may happen, but it is never required.
- **Editor:** remove a fear or difficulty given to the child as their own or carried through the book, and any scene of getting
  over a feeling. A short reaction the adventure causes may stay, and none needs to be added.

Unchanged:

- schema shape, including `resilienceMoments` minItems 1 and the field descriptions;
- safety, freedom and companion canon text;
- the biography rule, the checker, the version and the runner logic outside F7.

There is no quota, word blacklist or new stage. The two old phrase assertions were replaced by one compact contract test. It
checks the distinction in both prompts and that the old blanket-ban phrasing is absent.

## Results (this session, no provider calls)

- `npx --no-install tsc --noEmit --incremental false`: exit 0, at the code commit's source.
- `npx --no-install vitest run lib/personal-wizard/__tests__/simple-story-engine.spec.ts lib/__tests__/vitest-workload-classifier.spec.ts`:
  62/62 passed. That is simple-story-engine 55 (was 44 at `15fa48e6`) and workload classifier 7.
- No full `npm run check` was run here, by instruction.
- **Prior full gate: RED.** This is the Codex host run at `15fa48e6`:
  - exit 1;
  - ordinary lane 6,531 passed / 10 failed / 73 skipped, with the ten failure names matching the baseline;
  - resource lane 635/635, but three `onTaskUpdate` RPC timeouts.

  It is not fresh evidence for this commit. **Successor full gate: pending.**

## Limitations

- The Codex report itself was not read, as noted above.
- L1 is tested as a wording contract only. No books were generated, so nothing shows that the prompts now produce better or
  different behaviour.
- `allFixture` relies on provenance labels in the request. Someone writing a cases file can still label real data `fixture`.
  The predicate does not check content.
- Engineering CLI usage for this session is about $1.3 of the $2.04 remaining allowance. That is a Max list-equivalent estimate,
  not an invoice.

## Falsification targets for Codex

1. Can any non-fixture supplied value still pass `requestIsAllFixture`? Consider other request fields that carry provenance.
2. Is a dispatch, reservation or file write reachable before the check?
3. Do the negative tests still pass if one of their clauses is removed?
4. Does the no-theme text still force or forbid a reaction, or imply a coping beat?
5. Is any change present outside the two source files, the spec and these docs?
