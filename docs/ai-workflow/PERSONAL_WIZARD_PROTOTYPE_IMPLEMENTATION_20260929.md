# Personal Wizard prototype: implementation evidence (P1)

Status: P1 implemented by Claude Code on a dedicated branch. Codex reviews next.
There is no self-PASS, no product acceptance and no claim that a book can be made
from this flow. Guy owns UX and product acceptance.

Execution source: `docs/ai-workflow/PERSONAL_WIZARD_CLAUDE_BUILD_BRIEF_20260928.md`
on `codex/r3b1b-semantic-recovery-m1` (commit `ef865968`). Guy explicitly assigned
implementation of this milestone to Claude and QA to Codex, recorded in that
commit's CURRENT.md entry. The assignment covers this milestone only.

## 1. Workspace and writers

| Item | Value |
| --- | --- |
| Worktree | `C:/GNart/Work/sh-personal-wizard-prototype` (new, isolated) |
| Branch | `codex/personal-wizard-prototype` (name suggested by the brief; created here, no upstream) |
| Base | `713017e1890cc87c7eefab408481ac1ea592811d`, the site integration branch head: release `a0835b72` + two docs commits |
| Dependencies | `node_modules` junction to `sh-order-package-authority/node_modules` (same lock hash `785e90a7`, the existing worktree convention) |
| Sole writer | Claude Code, this task |

Before writing I verified that the site integration worktree was still at
`713017e1` with a clean tree, that no `*personal*` branch existed, and that the
engine worktree held the brief commit `ef865968` (clean, 20 ahead of its local
upstream). None of these were written to: the design tree (`Small_Heroes` at
`90364542`, dirty), the engine tree, release `sh-release-reader-final` at
`a0835b72`, protected `d53b` at `768ccb2f` and `accepted-intent-wave-2` at
`63ccb484`. The only artifact taken from the design branch is
`public/CSS/tokens.css`, byte-identical (git blob `8cc175f6`). Its `wizard.js`
was not copied.

## 2. What exists now

Route: `/dev/personal-wizard`. It is 404 unless all three hold:

1. Middleware: `/dev` is 404 on real production, unchanged.
2. `isDevEnvironment()`: local development, or an opted-in non-production Vercel runtime.
3. The explicit server flag `PERSONAL_WIZARD_PREVIEW=true`.

Rollback: unset the flag. Nothing else reads it.

Five stages, as the brief specifies:

1. **Hero.** Name, age 3 to 8 and form of address (boy/girl). Address is never inferred.
2. **Getting to know the child.** Real microphone recording, chips, "something else",
   a visible optional adventure place, "one more small detail", and the inline
   list "the details we'll use". Each item there can be edited or removed. There
   is no separate confirmation screen: "continue with these details" approves
   the list as shown.
3. **Companion and direction.** The companion is required and never preselected.
   An optional direction section opens on the same screen, including "adventure
   just for fun", plus an optional "what to leave out" list.
4. **Look and sound.** Optional photo (local preview only), the existing narrator
   voices and samples, and the existing book types with page counts. No price.
5. **Summary.** Rendered from the exact request object, with an edit link per
   section that returns straight to the summary. A final action validates the
   request on the server.

The connection is stated truthfully: "the details are ready; book creation is
not connected in this prototype." No spinner, no fake book.

Files (all new, apart from `tokens.css` copied as above):

- `lib/personal-wizard/contract.ts`: one versioned contract for every entry
  path: `PersonalBookDraft`, `ReviewedPersonalBookRequest` (strict schema),
  `IntakeExtraction`/`IntakeResult`, text hygiene and limits.
- `lib/personal-wizard/draft.ts`: pure draft operations, the intake merge rules,
  the request builder and a summary derived from the request.
- `lib/personal-wizard/recorder.ts`: `RecordingController` state machine with
  injected browser APIs.
- `lib/personal-wizard/intake-fixture.ts`: the labelled fixture. Its request type
  has no audio field.
- `lib/personal-wizard/options.ts` (server-only): the configured prototype roster
  plus topics, voices and packages resolved from the canonical config, with an
  options fingerprint.
- `lib/personal-wizard/request-acceptance.ts` (server-only): strict
  re-validation and a content-bound request identity.
- `lib/personal-wizard/flags.ts`, `lib/personal-wizard/copy.ts`: the flag and the
  Hebrew copy.
- `app/dev/personal-wizard/*`: server page gate, client wizard, hooks, the five
  step components and a CSS module on the design tokens.
- `app/api/dev/personal-wizard/request/route.ts`: request-preview validation. It
  has no persistence, no provider, no order and no content logging.
- `lib/personal-wizard/__tests__/*.spec.ts`: four new spec files.
- `lib/__tests__/vitest-workload-classifier.spec.ts`: pinned inventory counts
  updated for the four new specs. See section 5.

Existing surfaces unchanged: `public/JS/wizard.js`, `public/HTML/wizard.html`,
`/api/release/v1/*`, `/api/orders`, `backend/config/mvp-story-matrix.ts`,
`app/api/orders/handler.ts`, the Prisma schema, chunk-runner, the story bank,
payment, reader, anchors and QA thresholds. The existing site does not load
`tokens.css`; only the prototype page imports it.

## 3. Decisions taken inside the brief (reversible, for review)

- **Contract.**
  - Facts carry a stable id, kind, value, provenance (`typed`/`chip`/`transcript`/`fixture`),
    status (`proposed`/`included`/`removed`) and the revision of their last edit.
  - `favorite_place`, `residence` and the adventure `storyPlace` are three
    separate things. A residence exists only when stated explicitly and kept.
  - Family exists only when volunteered.
  - The intent is `null` when none is chosen. `just_for_fun` is an explicit
    "no emotional topic". There is no `OTHER` category and no topic-derived
    companion.
- **Merge rules** (`applyIntakeResult`):
  - Proposals are added as `proposed`; they never overwrite anything.
  - Removed or edited values and removed or replaced places are tombstoned, so a
    later proposal of them is omitted.
  - A different name, age or place becomes a question ("you wrote 5 and we heard
    6"). Unanswered questions keep the parent's value when the list is approved.
  - A result applies only to the job that is still `processing`. A result after
    cancel, after a newer job or after "continue without" is ignored.
  - An explicit direction becomes an unselected suggestion in step 3.
  - Companion and intent are never chosen for the parent.
- **Request.**
  - Only `included` facts leave the browser.
  - A `proposed` fact or an open question blocks the build (`facts_unreviewed`).
  - The strict schema rejects any extra field, such as approval flags, budgets or
    runtime switches.
  - The server re-checks option ids against the current option set.
  - The server derives `requestId = sha256(identityVersion, optionsFingerprint,
    canonicalJson(request))`. The browser never supplies an identity.
- **Roster.**
  - The four companions that have a deep profile plus style01 card art: Dini,
    Anat, Uri and Kim.
  - The list is a config (`PROTOTYPE_COMPANION_ROSTER`), not hardcoded Dini.
  - A missing asset removes the companion (fail closed).
  - The personality lines are **prototype copy for Guy's review**. They are
    derived from each canonical essence and deliberately contain no "helps with
    X" framing.
  - Being on the roster is not render qualification.
- **Book types.** The existing package ids and names, with display pages from
  `DIRECTION_PAGE_MAP` (16/24/32), labelled as prototype proposals. No price.
- **Voices.** `backend/config/voices.ts`. A missing sample shows "sample coming
  later", never a fake.
- **Book type and narrator are optional in P1.** The summary says "not chosen
  yet". Whether to require them is a product question for Guy.
- **Photo.** Local object-URL preview only: never uploaded, and no URL in the
  request (`photo: 'local_preview_not_sent'`). The existing upload route writes a
  public URL tied to the order flow, so it was deliberately not reused.
- **Storage.** The draft and audio live in memory only. There is no
  session/local storage or IndexedDB. The page shows "saved only in this
  window" and warns on unload.
- **Recording defaults.**
  - Limits: 90 s maximum, a warning at 75 s, 3 MiB. The recorder stops at 90% of
    the byte ceiling so the final flushed chunk still fits.
  - A time or size stop keeps the clip and never sends it.
  - The container is the first of webm/opus, webm, mp4, ogg that the browser
    reports as supported; the recorder's actual `mimeType` is what gets recorded.
  - The level meter is a measured RMS of the live stream, not decoration.
- **Mobile keyboard.** The bottom bar hides while the soft keyboard is open,
  measured through `visualViewport` together with a focused text field. It does
  not move into the page flow, so nothing jumps under the finger. Scroll padding
  keeps focused fields clear of the bar.

## 4. Fixture honesty

The test panel, "prototype test tool", loads one of two handwritten synthetic
examples through the same job/merge path as live intake. It is a separate
action, never the recorder.

- **No audio in.** The fixture request type has no audio field, and a static test
  enforces that.
- **Labelling.** Every fixture fact shows an "example" badge. Fixture conflicts
  say they came from the example. The transcript is titled "example transcript
  (prewritten, not from the recording)". The summary and server response flag
  `containsFixtureData`.
- **Late answers.** Fixture answers arrive after 1.5 s and ignore cancellation,
  like a provider call that cannot be recalled. The stale-result guard is what
  keeps a late answer out of the profile, and that path is tested.
- **The recording itself.** In P1 it stays on the device. The pre-record note
  says so, and the stopped state says: "saved on this device only; live
  processing is not connected, so nothing was sent."

## 5. Verification

- **`npx tsc --noEmit`**: exit 0.
- **Focused suites:** 4 files, 56 tests, all passing.
  - `lib/personal-wizard/__tests__/recorder.spec.ts` (18). Covers:
    - permission failures and permission granted after a cancel;
    - a page hidden while permission is pending;
    - the final chunk (Blob built only after the stop event);
    - double "done";
    - clock-based time, warning and ceiling;
    - the byte ceiling and unsupported containers;
    - an empty or sub-second clip;
    - an interruption, and the browser stopping the recorder by itself;
    - cancel and the watchdog;
    - dispose and track stopping on every exit.
  - `draft.spec.ts` (23): text hygiene and names, the manual-only path, chips,
    duplicates and limits, the merge rules above, the fixture examples, the
    summary/request round-trip, and strict-schema rejections.
  - `request-acceptance.spec.ts` (9):
    - option resolution, including fail-closed on missing art;
    - a deterministic identity bound to content and options;
    - rejection of authority fields and unknown options;
    - the API route: flag off gives 404; cross-origin 403, oversize 413, bad JSON
      400 and authority fields 422.
  - `prototype-boundary.spec.ts` (6): no browser storage calls, no
    order/checkout/release paths, no provider SDK or key, the fixture has no audio
    input, and client files import server modules for types only.
- **Real browser:** 88/88 checks pass. The harness is scratch, outside the repo:
  `pw1-browser.cjs`.
  - Setup:
    - `next dev` for this worktree on port 3417, with placeholder env values only;
    - headless Chrome with a fake microphone device (`--use-fake-device-for-media-stream`);
    - every non-local request aborted.
  - Flag off: the page and the API are 404.
  - Flag on:
    - Validation: errors inline, with focus on the first invalid field.
    - Recording: the timer runs from the clock; the level meter is measured;
      stop ends every track; local listen works; one playback slot at a time.
    - Details list: chips toggle; a renamed chip stays one detail; typed, chip
      and place details land in one list.
    - Fixture: conflicts become questions; example badges show; residence and
      family appear only as stated; a removed detail is gone.
    - Timing: a late answer after cancel is ignored; the processing prompt offers
      wait or continue without.
    - Step 3: the companion is required; the direction opens without scrolling;
      a suggestion is not preselected; a direction survives a companion change.
    - Step 4: the photo is a blob-URL preview only; no price is shown.
    - Summary and payload:
      - The summary shows exactly what was sent.
      - There is exactly one POST, and it goes to the preview API.
      - The payload carries no removed or unapproved details, no blob URL and no
        authority fields.
      - Editing from the summary returns straight to it; a change after
        acceptance shows as stale.
    - Leaving: storage is empty, there are no external requests, no audio left
      the browser, there are no console errors, and `beforeunload` guards the draft.
  - Edge cases:
    - Permission denied: a full manual fallback that keeps typed details.
    - Cancel while permission is pending: no later recording, and the tracks end.
    - Page hidden: recording stops and the partial clip is kept, unsent.
    - Continue while recording: an explicit choice is offered.
    - Keyboard: radio groups are reachable and show a visible focus ring.
    - Girl address inflects the copy.
  - At 390, 720 (1440 at 200% zoom) and 1440: no horizontal scroll on any step,
    and a focused field never sits under the bar.
  - Screenshots are in the scratch directory `pw1-shots/`.
- **`npm run check`:** ordinary phase 7 failed / 335 passed / 17 skipped files,
  11 failed / 4,806 passed / 73 skipped tests.
  - 10 of the 11 are **pre-existing**. I reproduced them at the unchanged base
    `713017e1` in a temporary detached worktree, where the same 10 tests fail:
    - `child-lexicon-ages-5-8` (1);
    - `momentum-gate-koko` (1);
    - `page-entity-qa` (1);
    - `story-read-back-validation` (2);
    - `story-source-visual-direction-acceptance-lifecycle` (4);
    - `reserved-page-placement-authority` (1): ENOENT on an ignored `outputs/`
      evidence file.

    CURRENT.md already records the full check as RED.
  - The 11th was caused by this change: `vitest-workload-classifier` pins the
    spec inventory at 375/355 and the four new specs made it 379/359. I updated
    the pinned counts and added a membership assertion for the new specs, the
    same maintenance Codex did for `hero-child-handoff.spec.ts`. No timeout was
    raised and no test was skipped. After the update, the classifier and the four
    new specs pass (5 files, 63 tests).
  - **Resource phase:** 20/20 files and 635/635 tests passed, yet the runner
    marked the phase failed with class `on_task_update_rpc_timeout`. That is the
    runner-stability class already tracked separately, not a test failure. A
    same-command run at the base was started for comparison; its result is
    recorded with the P2 update.
  - **Base comparison, ordinary phase:** 6 failed / 332 passed / 17 skipped
    files, and 10 failed / 4,751 passed / 73 skipped tests. The difference from
    this branch is exactly the four new spec files, all passing, and the
    classifier count, now fixed.

Not verified: Safari or iOS, a physical phone, a real soft keyboard, real
microphones beyond Chrome's fake device, screen-reader output, long real speech,
and Firefox. Screenshots and a fake device are not proof of those.

## 6. Not done in P1

- Live transcription or extraction is P2: a separate commit, behind a separate
  flag, with its own evidence.
- There is no writer, storyboard, render, narration, order, payment or
  persistence. The writer adapter is the next milestone.
- There is no Safari/iOS or physical-device QA.
- Copy acceptance (personality lines, step texts) belongs to Guy.

## 7. Falsification targets for Codex

1. **Only reviewed details can leave the browser.** Try to make an unreviewed,
   removed, abandoned or late detail reach `ReviewedPersonalBookRequest` or the
   summary: chips, edits, tombstones, place replacement, conflicts, or
   cancel/continue during processing.
2. **Browser-side authority.** Try to smuggle authority through the request:
   extra fields, `OTHER`, an unknown companion, topic, voice or package, or
   un-normalized text.
3. **Microphone.** Try to leave a track open or start a surprise recording:
   permission granted after cancel, a hidden page, navigation away, double stop,
   the watchdog.
4. **Fixture.** Try to make fixture data look like parent input, or to feed the
   fixture any audio.
5. **Reachability.** Try to reach the route or the API with the flag off, on
   production, or cross-origin.
6. **Scope.** Confirm that existing Wizard, release/v1 and order code are
   untouched: `git diff --stat 713017e1..HEAD` touches only the new paths,
   `tokens.css`, the classifier counts and docs.
