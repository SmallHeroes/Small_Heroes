# Personal Wizard prototype: implementation evidence (P1 + P2)

Status: P1 and P2 implemented by Claude Code on a dedicated branch, in two
commits. Codex's QA of `713017e1..8aa9f1d7` was HOLD (P0 0, P1 2, P2 3). The
correction batch in section 8 fixes the five findings and two variants found in
self-review, in focused commits on the same branch. Codex re-gates next. There is
no self-PASS, no product acceptance and no claim that a book can be made from
this flow. Guy owns UX and product acceptance. The P2 live provider path is
implemented, but it is unverified against the real provider (section 5b).
Sections 1 to 7 describe the reviewed range; where section 8 changed a
behaviour, section 8 wins.

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
    same-command run at the base gave the identical result: 20/20 files and
    635/635 tests passed, and the same `on_task_update_rpc_timeout` gate failure.
  - **Base comparison, ordinary phase:** 6 failed / 332 passed / 17 skipped
    files, and 10 failed / 4,751 passed / 73 skipped tests. The difference from
    this branch is exactly the four new spec files, all passing, and the
    classifier count, now fixed.

Not verified: Safari or iOS, a physical phone, a real soft keyboard, real
microphones beyond Chrome's fake device, screen-reader output, long real speech,
and Firefox. Screenshots and a fake device are not proof of those.

## 5b. P2: live intake (separate commit on top of P1 `fd030932`)

**Surfaces.** All are new files:

- `lib/personal-wizard/intake-config.ts`: switches, the dated price table, conservative
  reservations.
- `intake-ledger.ts`: per-process idempotency, spend and job ceilings.
- `audio-probe.ts`: container sniffing and a measured duration.
- `intake-extraction.ts`: instructions, the strict JSON schema, and the sanitizer.
- `intake-service.ts`: the HTTP-free core with an injected provider.
- `intake-openai.ts`: the only provider SDK import.
- `intake-gate.ts`: authority.
- `intake-live-client.ts`: the browser client.
- Routes `app/api/dev/personal-wizard/intake/{status,audio,text}/route.ts`.
- UI wiring in the existing prototype files.

**Authority.** Every one of these must hold, and each is refused before the body
is read:

- the real production 404 (middleware) and `isDevEnvironment()`;
- `PERSONAL_WIZARD_PREVIEW=true` and `PERSONAL_WIZARD_LIVE_INTAKE=true`;
- priced model ids in `PERSONAL_WIZARD_TRANSCRIBE_MODEL` and
  `PERSONAL_WIZARD_EXTRACT_MODEL`;
- `PERSONAL_WIZARD_INTAKE_BUDGET_USD` (at most 5) and
  `PERSONAL_WIZARD_INTAKE_MAX_JOBS` (at most 20), both per process;
- `OPENAI_API_KEY`, read only after every other switch is valid (tested with a
  recording env proxy);
- same origin and a per-IP rate limit;
- a signed-in `sh_session` user whose email is on
  `PERSONAL_WIZARD_INTAKE_OPERATORS`.

No query parameter, header or client flag grants anything. The status route only
tells the UI whether to offer live processing.

**Checks before any spend.**

- Job and draft ids must match the contract patterns.
- The declared type must be webm or mp4; the provider does not take ogg, so ogg
  clips stay local.
- Size must be 512 B to 3 MiB, enforced while streaming the body.
- The container is sniffed from the bytes and must equal the declared type.
- Duration is **measured** with ffprobe from the audio packets, because Chrome's
  MediaRecorder WebM has no trustworthy header duration. It must be 1 s to
  91.5 s; a client-declared duration is not used at all. (Superseded in
  section 8, P1-1: packet timestamps alone could be shifted; the audio is now
  decoded and counted, the timeline validated, and exactly one audio stream
  required.)
- The conservative upper bound is then reserved in the ledger:
  - transcription per started second;
  - extraction with worst-case input bytes (a token is at least one byte) and
    3,000 output tokens, reasoning included;
  - times 1.1.
- The ledger refuses a repeated (user, job) pair (409, never re-run or re-billed),
  a second in-flight job for the same user (409), the job ceiling (429) and the
  budget (402). Reservations are never refunded.

**Provider and model.** Checked 2026-09-29 on the provider's pricing, model and
speech-to-text pages.

- **Transcription:** `gpt-transcribe`, the documented recommendation for recorded
  speech in its original language, at $0.0045 per audio minute.
- **Extraction:** chosen by env from `gpt-6-luna` ($0.10 in / $0.50 out per 1M)
  or `gpt-6-sol` ($2 / $10). Both support strict structured outputs and
  `reasoning.effort`.
- **Recommendation for the first trial:** `gpt-6-sol`. Rule-following matters more
  than cost at two samples.
- **Worst-case reservation per 90 s sample:** $0.0824 with sol, $0.0112 with
  luna, computed from the real functions (transcription $0.0074 plus
  extraction). The actual cost should be lower.
- **Call settings:** `maxRetries: 0`, a 60 s timeout, `store: false`,
  `reasoning.effort: 'low'`.
- **Prompt handling:** the transcript is passed only as delimited user data, and
  angle brackets are neutralised. The instructions forbid inference: no
  diagnosis, no residence from "loves the sea", family only if mentioned, and
  direction only on an explicit request.
- **Language hint:** gpt-transcribe's `languages` hint is deliberately not sent
  until a live call proves its multipart form. A fixed Hebrew `prompt` gives the
  context instead.

**Data handling, stated to match what was checked.**

- **Our side:** the audio exists in memory and in one private temporary file,
  created only for the duration check (ffprobe + a bounded ffmpeg decode since
  section 8) and removed in `finally`. Nothing
  is persisted. Logs carry only the outcome code, the reservation and ledger
  counts: no transcript, fact, email or audio.
- **Provider side**, per its data-controls page on 2026-09-29:
  - `/v1/audio/transcriptions`: not used for training, no abuse-monitoring
    retention, no application state.
  - `/v1/responses`: not used for training, up to 30 days of abuse-monitoring
    retention; `store: false` avoids application state.
- **UI:** the copy says exactly this and promises no deletion at the provider.

**UI (live mode only; local mode is P1 behaviour):**

- The pre-record note adds the provider-retention line.
- "Done, organise the details" uploads once.
- Processing can be cancelled, which aborts the request; a late answer cannot
  land.
- Once sent, a clip cannot be resent by accident.
- A transcript correction is re-sent only through the explicit "re-organise from
  the corrected text" action.
- Refusals map to specific messages, and existing details are always kept.
- "Continue without" aborts the running job.

**P2 verification.**

- **Focused tests:** 5 new spec files with 37 tests, plus an updated boundary
  spec.
  - `intake-extraction` (9): switches, key-read order, prices, delimiting,
    rules, schema, sanitizer.
  - `intake-service` (12):
    - happy path; declared type versus bytes; size bounds;
    - measured duration refusals made before any reservation;
    - idempotency per user; one job in flight; budget and job ceilings;
    - no retry; timeout;
    - an unclear transcript skips paid extraction; malformed or incomplete
      answers are refused;
    - out-of-set topic; the text path.
  - `audio-probe` (3): real ffmpeg-made webm/opus, mp4/aac and ogg clips measured
    by the real ffprobe; a fake container gives null; the temporary file is
    removed.
  - `intake-routes` (7): the real routes and gate with the session, provider and
    probe replaced. Covers flags/config 404, 401/403/503, cross-origin, oversize
    (declared and actual), a duplicate job, text path and status truthfulness.
  - `intake-live-client` (5): the upload shape, answer validation (wrong job,
    fixture-labelled or malformed answers rejected), error mapping, and aborted
    versus network.
  - Total: 93 prototype tests across 9 files; tsc 0.
- **Real browser:** 29/29 checks (scratch `pw2-browser.cjs`, port 3418,
  placeholder env, fake microphone).
  - Real server with live off: status reports `live_flag_off`, audio is 404, the
    UI stays local.
  - Real server with live on and no session: status reports `not_signed_in`,
    audio is 401 before any job, and no intake log line appears.
  - Live UI against simulated server answers:
    - one upload for a double "done", with the recorder type and a fresh job id;
    - the microphone is released;
    - merged details carry the "from the recording" badge;
    - no accidental resend;
    - editing the transcript sends nothing until the explicit action, which
      sends one request;
    - a cancelled job adds nothing even when the server answers later;
    - a budget refusal keeps every detail;
    - a send during another job is refused as busy, is not marked sent, and
      stays sendable;
    - "continue without" drops the job for good;
    - no console errors.
  - The P1 harness re-run on the final P2 code still passes 88/88 in local mode.
- **`npm run check` on the P2 tree:**
  - Ordinary phase: 6 failed / 341 passed / 17 skipped files, and 10 failed /
    4,844 passed / 73 skipped tests. The 10 failures are exactly the
    pre-existing base set.
  - Against the base: +9 files and +93 tests, all passing; the classifier counts
    were updated to 384/364.
  - Resource phase: 20/20 files and 635/635 tests, with the same
    `on_task_update_rpc_timeout` runner gate as the base. Exit 1, as at the base.

- **Real browser recordings:** WebM files produced by Chrome's actual
  MediaRecorder with a fake device, `audio/webm;codecs=opus` and a 1 s timeslice
  as the prototype uses, measured by the server probe as:
  - 3 s recorded, 3,000 ms measured;
  - 1.4 s recorded, 1,380 ms measured.

  This is the header-less case the probe exists for (scratch
  `pw2-mediarecorder-probe.cjs`).
- **Found and fixed in self-review before commit:** a clip sent while another job
  was still processing, such as the labelled example, was refused silently yet
  marked "sent". It is now refused with the "busy" message and stays sendable. A
  browser check covers it.

**Live connection: UNVERIFIED.**

- No provider key was read and no provider call was made. Cost so far: $0.
- A real audio → transcript → extraction → edited facts → request chain has not
  been observed.
- The ledger is per process. That is exact for one local server; on a
  multi-instance deployment each instance keeps its own ceilings. Durable
  idempotency and spend control are required before any public use.

**Running the trial.** It needs Guy's explicit approval of key use and of the
spend cap. The brief recommends at most $1 across two short samples, from a
synthetic voice or a consenting adult, with no real child data. On a server whose
env holds the real `OPENAI_API_KEY` and database credentials, set:

```
PERSONAL_WIZARD_PREVIEW=true
PERSONAL_WIZARD_LIVE_INTAKE=true
PERSONAL_WIZARD_INTAKE_OPERATORS=<operator email>
PERSONAL_WIZARD_TRANSCRIBE_MODEL=gpt-transcribe
PERSONAL_WIZARD_EXTRACT_MODEL=gpt-6-sol
PERSONAL_WIZARD_INTAKE_BUDGET_USD=1
PERSONAL_WIZARD_INTAKE_MAX_JOBS=2
```

Sign in at `/login` with the operator email, open `/dev/personal-wizard`, and
record. The server log prints one JSON line per job with its reservation and
ledger totals, and no content.

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
7. **P2 authority.** Try to reach a provider call, or a read of
   `OPENAI_API_KEY`, without every switch, a session and the operator allowlist.
   Also try reaching the body parser before the gate.
8. **P2 billing.** Try to bill twice or beyond the ceiling: a repeated or
   concurrent job id, parallel jobs for one user, SDK retries, a reservation
   smaller than the real worst case, refunds.
9. **P2 audio.** Try to pass unmeasured or disguised audio: a forged magic
   number, a lying `Content-Type`, ogg, a client-claimed duration, a streamed
   body over 3 MiB.
10. **P2 extraction.** Try to make its output break the rules: instructions
    inside the transcript, a `</transcript>` break-out, malformed or incomplete
    JSON, out-of-set topics, invalid names or ages, oversized values.
11. **P2 late answers.** Try to make an aborted, cancelled or superseded live job
    change the draft or the summary.
12. **P2 data.** Try to leave data behind: the temporary file on every error path,
    content in logs, or anything written to browser storage.

## 8. Correction batch after Codex QA (HOLD on `713017e1..8aa9f1d7`)

Codex's independent QA of `713017e1..8aa9f1d7` was **HOLD**: P0 0, P1 2, P2 3,
plus one key-order observation. Before changing anything, every reproduction
was validated against the exact frozen head `8aa9f1d7`, and each one reproduced.
I agree with all five findings and the observation; there is no disagreement.
Scope stayed as requested: no redesign, no new approval screen, no change to the
old Wizard, engine, reader or payments, no push or deployment, and no live
provider call. The unconnected-writer boundary is unchanged: nothing is sent to
a writer.

### 8.1 Reproductions at `8aa9f1d7`

| Finding | Reproduced at `8aa9f1d7` |
| --- | --- |
| P1-1 | Codex's offset file: ffprobe span 65 543 ms against 120 s of decoded audio; accepted, one transcription dispatch to the stub |
| P1-2 | "גר באודם" corrected to "גר בחיפה": both residences in the request and in server acceptance |
| P2-1 | Final chunk and `stop` suppressed, watchdog fired: `takeSendRequest()` handed out the partial clip, `reason: user_done` |
| P2-2 | Example name, age and topic accepted: `containsFixtureData` false in the browser and on the server |
| P2-3 | JSON `null` to the text route: an exception, after the provider was constructed once |
| Observation | `OPENAI_API_KEY` read before the operator session was checked |

### 8.2 Fixes: one focused commit per finding, then two self-review variants

| Commit | Finding | Change |
| --- | --- | --- |
| `07c8f30a` | P1-1 | Duration is no longer trusted from packet timestamps. The audio is decoded (ffmpeg, mono 8 kHz, a hard output ceiling that stops the decoder early) and its samples counted. The packet timeline must be well formed: start within 0.5 s of zero (encoder pre-roll only), never step back, no hole over 1 s. The two measurements must agree within max(0.5 s, 5%), and the larger is used. Refusals are `duration_unreadable`, `timeline_invalid`, `timeline_mismatch` and `too_long`, all before any reservation or provider. On Windows the temporary file is removed only after the decoder process has exited. |
| `4143f9fa` | P1-2 | "Re-organise from the corrected text" now carries `supersedesJobId`. See the rules below this table. A new recording still adds; it is not a correction. |
| `2b9bce58` | P2-1 | Only the recorder's own `stop` event after its final data produces a **verified** clip. A watchdog or a throwing `stop()` produces an unverified clip, `reason: incomplete`, with the automatic send withdrawn. `finish()`/`takeSendRequest()` hand out verified clips only. Late events after the timeout are detached. The UI discloses the incomplete clip, which stays local. |
| `215e885c` | P2-2 | Request contract v2. `child.nameSource` and `child.ageSource` (typed, transcript or fixture) and `intent.suggestedBy` are set when a suggested value is accepted. `requestContainsFixtureData` and server acceptance cover them. Typing the name or age again is the deliberate transition back to parent input. The summary shows origin badges on the child line and on the direction. |
| `372a314b` | P2-3 and the observation | The text body must be exactly `{jobId, draftId, text}` strings: `null`, arrays, scalars and extra fields get 400 before any service or provider. The provider is created by a factory only after the ledger admits the job. Settings resolution never reads the key; the gate reads it only after the operator session is confirmed. A signed-in operator with no key gets 503 `live_unavailable`. |
| `b01da3b1` | P1-2 variant (self-review) | Details a correction kept stayed owned by the job it corrected, so the next correction could not reach them. The effects: correcting twice, or once after an unclear correction, left two residences again; an open keep-or-remove question vanished; a kept place survived. Ownership now follows the transcript on screen, as a chain. |
| `1c8287b5` | P1-1 variant (self-review) | The probe and the decoder read only the first audio stream. A 3 s + 120 s two-track WebM or MP4, or audio plus video, measured as 3 s and was accepted. The file must now hold exactly one stream, of type audio, or it is refused as `unexpected_streams` (422) before any provider. |

The correction rules from `4143f9fa` apply to details owned by the corrected
transcript:

- still present in the correction: kept, with the same id;
- parent-owned (typed, chips, edited, adopted) or removed by the parent: left
  exactly as they are;
- only proposed and now absent: retired and counted in the notice ("הצעה אחת שלא
  הופיעה בתמלול המתוקן הוסרה מהרשימה.");
- already approved and now absent: an inline keep-or-remove question ("בתמלול
  המתוקן כבר לא מופיע ״…״. להשאיר אותו בסיפור?").

Questions and suggestions raised by the corrected transcript are dropped. This
uses no new screen.

### 8.3 Evidence at the code head `1c8287b5`

- **tsc:** exit 0.
- **Prototype suites:** 128 tests in 9 files, all passing, plus 7/7 in the
  workload classifier (counts pinned in P2).

  | Spec | Tests |
  | --- | --- |
  | draft | 43 |
  | recorder | 21 |
  | intake-service | 14 |
  | audio-probe | 11 |
  | request-acceptance | 9 |
  | intake-extraction | 9 |
  | intake-routes | 9 |
  | prototype-boundary | 7 |
  | intake-live-client | 5 |

  Every finding has its reviewer case as a test with the corrected expected
  behaviour, plus controls: a normal 120 s tone stays `too_long`; a second
  recording stays additive; a normal finish is verified and follows "done" once;
  typed values stay typed; a valid body still reaches the service; a
  single-stream clip is accepted. The five chained-correction tests from
  `b01da3b1` were run against the previous `draft.ts`: four fail there, and the
  controls test passes on both, as intended.
- **Real media**, from the bundled ffmpeg and ffprobe with no mocks:

  | Input | Result |
  | --- | --- |
  | WebM 3 s | ok, 3021 ms |
  | MP4 2 s | ok, 2023 ms |
  | 89 s | ok |
  | 120 s | `too_long` (the decoder stops early) |
  | Offset, shift and hole files | `timeline_invalid` |
  | Stretched ×1.3 and ×1.08 | `timeline_mismatch` |
  | Truncated or corrupt | `duration_unreadable` |
  | Two audio tracks (WebM, MP4), or audio + video | `unexpected_streams` |
  | Chrome MediaRecorder 3.0 s and 1.4 s, fake microphone | ok, 3000 ms and 1380 ms |

- **Codex's own probes**, copied byte-identical (SHA-256 prefixes `0983dd3d`,
  `83514b1e`) and run with the worktree as the working directory. Codex's folder
  was not written to.
  - `boundaries.cjs`, unchanged: 401 with events `["sessionCheck"]` only (the key
    is not read), and the `null` body no longer throws, with `providerCreated: 0`.
  - `probe.cjs`, unchanged:
    - Section 1 still passes. It models the correction as a plain second job,
      which is a new recording and additive by design (8.4).
    - Section 2's assertion that encoded the bug, `assert(partial)`, now fails
      with `actual: null`, so the script stops there.
    - It also imports the removed `probeAudioDurationMs`.
  - A replay of the same inputs with the corrected expectations, using a
    correction job and the current API, passes. It shows:
    - one residence, "גר בחיפה", in the request and in server acceptance, with a
      plain second recording still additive as the control;
    - a clip that is `incomplete`, `verified: false`, never handed out;
    - `nameSource`/`ageSource` `fixture` and `suggestedBy: fixture`, flagged by
      both client and server;
    - Codex's two 120 s tones refused as `too_long` / `timeline_invalid`, with
      zero dispatches and the provider never constructed;
    - the `null` body answered 400 `bad_request` with zero providers created.
- **Browser**, headless Chrome with a fake microphone and placeholder env:
  - P1: 97/97, up from 88. The main flow's payload is v2 with `typed` sources
    (the parent kept 5 over the example's 6). It adds the reviewer's P2-2 case in
    the real UI:
    1. load the mixed example;
    2. accept its age 6;
    3. remove every example detail and the example place;
    4. adopt its suggested direction from the card.

    The summary then shows the example warning and badges on the child line and
    the direction. The payload is v2, with no facts, `ageSource: fixture` and
    `suggestedBy: fixture`. The server answers `containsFixtureData: true`.
  - P2: 38/38 against the real server (fail-closed paths) and simulated answers.
    The corrected transcript keeps the bike, retires "הים", adds the new detail
    and announces the retired proposal. The request carries exactly the typed
    text and only `jobId`, `draftId` and `text`. A new approved-then-corrected
    flow then runs:
    1. approve, go back and correct;
    2. one keep-or-remove question for "הים" only; "keep" keeps it;
    3. a second correction asks again; "remove" removes it;
    4. the summary holds exactly the kept details.

    No console errors.
  - Harness honesty note: the earlier P2 run (29/29) typed the correction after a
    triple-click that did not select the textarea, so the text was appended and
    that check used `includes`. The simulated answer does not depend on the
    text, so no conclusion changed. The harness now replaces the text and asserts
    it exactly.
- **Full check:** `npm run check` at `1c8287b5` is RED exactly as at the base
  `713017e1`.
  - **Ordinary phase:** 364 files, 10 failed, 4879 passed, 73 skipped (4962).
    - The same 10 failures: child-lexicon 1, momentum-gate-koko 1,
      page-entity-qa 1, story-read-back 2, visual-direction lifecycle 4,
      reserved-page-placement 1.
    - Each reads `outputs/` artifacts that are absent from this worktree
      (ENOENT).
    - At the base: 355 files, 10 failed, 4751 passed (4834). The difference is
      exactly the 9 prototype specs and their 128 tests.
  - **Resource phase:** 20 files, 635/635 passed, with the same
    `on_task_update_rpc_timeout` gate as at the base.
  - The correction batch added no spec file and changed no timeout or pinned
    count.

### 8.4 Design points Codex may want to challenge

1. **A plain second recording stays additive.** Codex's `probe.cjs` section 1
   runs two ordinary jobs, "גר באודם" then "גר בחיפה", and both still land.
   That is a second recording, not a correction. If every job superseded the
   previous one, a parent who records "he paints" and then "he also swims" would
   lose the first recording. The fix therefore sits on the only correction
   action, the explicit re-organise of the shown transcript, which is what the
   finding described. A contradiction between two separate recordings stays
   visible in the editable list before approval.
2. **An incomplete clip can still be sent, by hand.** The automatic path is
   withdrawn. The disclosed state reads "ההקלטה לא הסתיימה כרגיל, ולכן לא נשלחה.
   … אפשר להאזין לו, לשלוח אותו בכל זאת או להקליט מחדש." This follows the
   required correction's "allow an explicit user decision where safe". The server
   still sniffs, measures (8.2) and reserves before any provider. If Codex judges
   this unsafe, removing the manual send for unverified clips is a one-line
   change.
3. **"Keep" is not permanent immunity.** A detail the parent kept after one
   correction is asked about again if a later correction still lacks it. It is
   never removed silently. The alternative, treating "keep" as parent ownership,
   would be a product choice.
4. **Choosing a topic while its example suggestion is pending adopts the
   suggestion's origin.** This is conservative, so the warning cannot be dodged
   through the list. "לא עכשיו" and then choosing the topic, or typing the
   name/age again, is the deliberate transition to parent input. An example
   *fact* edited by hand keeps its example origin (the edit modifies example
   content), so it stays flagged.
5. **Exactly one audio stream is strict.** Chrome MediaRecorder WebM passes.
   Safari/iOS MP4 is unverified on this machine. If Safari adds a non-audio
   track, live intake fails closed with the existing rejected-audio message,
   and typing still works.

### 8.5 Re-gate targets

1. Chains: correct, correct again; unclear correction then correct; a correction
   during another job; a late or stale correction; then check that no superseded
   detail or question survives, and no approved detail is dropped silently.
2. Anything that makes an unverified clip leave automatically, or makes a late
   recorder event change a finished clip.
3. Any surviving example-derived value (name, age, place, topic, fact) that
   reaches the request with `containsFixtureData: false`.
4. Any file shape where the measured audio is less than what a provider could
   decode: streams, timestamps, containers, edit lists.
5. Any intake body or header shape that reaches `createProvider` or the key
   before validation and the session.

### 8.6 Still not done or unverified

- **Live provider path: UNVERIFIED.** No key read, no provider call, $0. A live
  trial needs Guy's explicit approval (brief cap: $1 for two short synthetic
  samples).
- No Safari/iOS or physical-device QA.
- No push, deployment, order, payment or render.
- No self-PASS: Codex re-gates, and Guy owns product acceptance.

## 9. Voice-first rework: the recording is the main path, the details are its result

Source: the follow-up brief "לקלוד: ההקלטה היא המסלול הראשי, הפרטים הם התוצאה שלה"
(2026-09-29), written after Guy reviewed the prototype and pasted to Claude by Guy
under the same split: Claude implements, Codex reviews. The brief's own observation
was that the recording existed, but a large manual form sat right below it. With
live processing off, the screen could not show any result.

This is a **separate range on top of the frozen QA-correction head `1a22af62`**. It
does not touch the QA-fix commits. Range: `1a22af62..` this documentation commit (code
head `996cb68b`).

### 9.1 What changed

| Commit | Change |
| --- | --- |
| `a3dd9c92` | Model (draft v3; request contract unchanged at v2); see below. |
| `c85ebccc` | UI (details below the table). |
| `996cb68b` | Self-review fix: "עריכה" on a heard age moves focus to the chosen age instead of dropping it to the page. |

**Model, `a3dd9c92`:**

- **Name and age.** A recording, or the labelled example, may fill an EMPTY name
  or age with a suggestion owned by its job (`child.nameJobId` / `ageJobId`).
  - A filled value is never overwritten, only questioned.
  - A correction replaces or retires its own unapproved suggestion; the chain
    continues; an unclear correction hands it on.
  - "Continue" approves the suggestion.
- **Address.** The grammatical address is never extracted.
- **Direction.** A single direction the parent asked for is approved with the
  shown list. Two or more are left to the parent. The parent's own choice wins,
  and the companion is never chosen.
- **Name normalization.** `commitChildName` normalizes without changing
  provenance.
- **Test example.** A third labelled test-panel example, the brief's
  illustration.

**UI:**

- **Four steps instead of five.** The old hero form and the old meet step became
  one step, "ספרו לנו קצת על הילד שלכם", with the brief's lead text.
- **The recording card comes first.** Its CTA and notes are truthful:
  - live: "ספרו לנו בקול", and it says up front that "done" sends the recording
    and shows what was understood;
  - live off: a prominent "בדיקת מיקרופון בלבד, כרגע לא מפענחים פרטים." and the
    button "בדיקת מיקרופון";
  - a short suggested length, not a minimum.
- **The details card is directly under it.** It appears only when there is
  something real: a result, a value, the manual path, or a continue attempt. It
  never shows fields pretending to be results.
  - Title: "זה מה שהבנו על …" when anything came from a recording; otherwise
    "הפרטים על …". Example data never reads as "what we understood".
  - Heard name and age appear as values with "עריכה" and a source badge.
  - Missing required values appear as fields, so only those are asked.
  - The address is always an explicit choice.
  - Conflicts and correction questions are inline.
  - Every detail is editable and removable. A removed detail stays out of the
    book.
  - The requested direction appears as its own group.
- **"מעדיפים לכתוב או לבחור?"** is one visible toggle under the card. It opens the
  same chips and fields: other, adventure place (separate from residence), extra
  detail. They feed the same card, and switching loses nothing.
- **One continue: "אלה הפרטים, ממשיכים".**
  - If recording or processing is still running, it asks first.
  - Missing basics are shown in the card, with focus on the first one.
  - Otherwise it approves the one shared version and moves on.
- **Accessible status.** The result is announced in a `role=status` line and
  focus is not moved. The processing state is text, not only colour.
- **Conflict wording.** "כתבתם" is used only when the parent typed the current
  value; otherwise the question says "ברשימה מופיע".

### 9.2 Decisions to confirm (Guy) or challenge (Codex)

1. **A requested direction is approved with the card.** This deliberately changes
   the P1 rule "offered, not selected":
   - the brief lists the direction among the extracted, editable values, and one
     continue advances that version;
   - it can be removed in the card and changed on step 2;
   - two or more are never chosen for the parent.
2. **Four steps instead of five.** The basics moved into the voice-first step, so
   the parent reaches the microphone without filling a form first.
3. **Typed basics stay fields; heard basics show as values with "edit".** Nothing
   collapses under the cursor.
4. **With live off, the CTA is "בדיקת מיקרופון".** It is not presented as the full
   experience.
5. **The manual toggle sits under the card** (disclosure order). In manual mode
   the card shows the basics first, and the fields follow the toggle.

### 9.3 Evidence at `996cb68b`

The full check ran at `c85ebccc`. `996cb68b` changes one UI component that no spec
reads except the static boundary checks, which pass at `996cb68b`.

- **tsc:** 0.
- **Prototype suites:** 136 tests in 9 files (draft 51, recorder 21, intake-service 14, audio-probe 11, request-acceptance 9, intake-extraction 9, intake-routes 9, prototype-boundary 7, intake-live-client 5), plus the classifier 7/7.
- **New model tests (8)**, including the brief's example through server
  acceptance. On the same inputs, the previous `draft.ts` drops a heard name and
  age and never adopts the direction.
- **Changed old assertions (on purpose, by this brief):**
  - the companion step moved from step 3 to step 2 (`reports missing required
    choices by step`);
  - the P1 browser checks "direction offered, not selected" became "direction
    shown in the card is approved with it";
  - the P1 "step 2 copy" check now reads the manual copy.
- **Browser**, headless Chrome, fake microphone, placeholder env, no provider:
  - **Voice-first harness: 59/59.** It includes the age-focus check, which fails
    without `996cb68b` (58/59).
    - Live off:
      - the honest banner and CTA; no form, fields or card up front;
      - the mic test sends nothing and shows no card;
      - the manual path shows the same fields, and switching loses nothing;
      - example data is labelled and never reads as understood;
      - continuing with nothing asks exactly name, age and address, with focus
        on the name;
      - 390 px has no overflow.
    - Live, with simulated server answers:
      - processing is an accessible status, with no card;
      - the brief's sentence becomes name, age, residence, interest, habit and
        the "רעשים ואזעקות" direction, with no place, family or fear invented;
      - focus is not stolen;
      - a detail edited in place survives a transcript correction that retires
        "אודם" for "חיפה";
      - a second recording's different name is a question, never an overwrite;
      - a refused recording deletes nothing;
      - only the missing address is asked.
      - The request then carries exactly the corrected version: child
        `transcript/transcript` with an explicit address; facts `habit:לוחש
        לכדור לפני כל בעיטה`, `interest:כדורגל` and `residence:חיפה`, all
        `transcript`; `storyPlace` null; intent `sirens`, `suggestedBy:
        transcript`; three uploads for three recordings.
    - A recording without name or age asks name, age and address.
  - **Adapted P1 harness:** 99/99 (was 97). The old checks run on the new step: errors, focus, chips, edits, example conflicts, cancel, continue-while-processing, companion, book, summary, payload v2, storage, external calls, beforeunload, permission denied, cancel during permission, hidden page, keyboard, example provenance through server acceptance, responsive 390/720/1440.
  - **Adapted P2 harness:** 38/38. The live and simulated checks run on the new step, including the approved-then-corrected-twice flow.
- **Before/after screenshots**, synthetic data only:
  `C:\Users\guyna\AppData\Local\Temp\claude\C--GNart-Work-Small-Heroes\af9211ff-30ea-426d-9794-43cad9ee3788\scratchpad\voice-before\`
  and `...\voice-after\`.
- **Full check:** `npm run check` at `c85ebccc` is RED exactly as at the base.
  - **Ordinary phase:** 364 files, 10 failed, 4887 passed, 73 skipped (4970).
    These are the same 10 failures as section 8.3: missing `outputs/` artifacts.
    That is +8 tests against `1c8287b5` and +136 against the base, all prototype.
  - **Resource phase:** 20 files, 635/635, with the same
    `on_task_update_rpc_timeout` gate.
  - No timeout or pinned count changed.

### 9.4 The acceptance proof the brief asks for

The brief's acceptance chain is: real audio → real transcription → extracted
details visible at once → a detail corrected → a validated request carrying only
the corrected version.

What is proven here:

- the whole chain in the real UI, with a real MediaRecorder recording from a fake
  microphone;
- the real request and validation server;
- **simulated** intake answers for the transcription and extraction step.

That step is **not proven**:

- no key was read, no provider was called, and the cost is $0;
- a fixture or a working microphone button is not a substitute, and this document
  does not claim one.

The live trial needs Guy's explicit approval of key use and spend. The brief's cap
is $1 for two short samples from a synthetic voice or a consenting adult, with the
operator allowlist; the env block is in section 5b. No push, deployment or book.

## 10. Codex QA of `cbe09b31`: technical PASS with one P2, and its correction

Codex reviewed both pending ranges, `8aa9f1d7..1a22af62` and `1a22af62..cbe09b31`:

- 143/143 tests and tsc 0;
- a real labelled-fixture browser flow;
- the earlier vulnerabilities, exercised independently.

The verdict was **technical PASS, P0 0 / P1 0 / P2 1**. All five earlier findings
are closed. This is not real-audio, product or release acceptance.

**P2: a removed direction was not durable.** Its root cause and consequence:

- `dismissIntentSuggestion` only filtered the current suggestions.
- A re-extraction after correcting the same transcript re-added the removed topic.
- Since `c85ebccc`, "continue" then adopted it, so the request carried `sirens`
  although the parent had removed it.

I reproduced it exactly with Codex's `intent-regression.cjs`, including its base
control (at `1a22af62` the topic also came back, but the request stayed `null`), and
I agree.

**Fix (same removal concept as places and facts; draft v4).**

- **Remember removals.** `topicTombstones` records a topic the parent removed. That
  covers:
  - declining a suggestion (removing it in the card, "לא עכשיו" on step 2, or
    "keep the current one");
  - moving away from a direction that came from a recording or the example
    (removing it in the card, clearing it or choosing something else on step 2,
    or replacing it through the card question).
- **Never re-suggest.** A later extraction never suggests a tombstoned topic, so
  "continue" cannot adopt it.
- **A deliberate pick undoes it.** The parent picking the topic from the list lifts
  the tombstone and makes it the parent's own choice. Choosing a *pending*
  suggestion keeps its origin and records no removal: step 2's "לבחור" now goes
  through the same adoption path as the list.
- **No overwrite.** A manual choice is never overwritten; a different proposal stays
  a proposal.

**UX note, handled in the same narrow change.** When a direction is already chosen
and a correction brings a different one, the card no longer lists both alike:

- The current direction is the only row.
- The new one is an explicit question: "כבר נבחר כיוון: ״…״. בהקלטה עלה ״…״.
  להחליף?", with "להחליף ל״…״" and "להשאיר את ״…״", and the note "אם לא
  תבחרו, נשאיר את ״…״."
- Two or more proposals with no current choice say that the choice is made on
  the next step.
- Going straight back to the summary leaves the ignored proposal out of the
  summary, where only the chosen direction appears.

The four steps and the recording's prominence are unchanged. Extraction prompts,
gates, timeouts, prices and auth are untouched. No key, live call, render, push or
deployment.

**Evidence.**

- **Tests:** 5 new request-boundary tests, one per case in the brief:
  1. removed → unrelated correction → continue → absent, and the server agrees; a
     no-removal control is included;
  2. an approved direction removed, or replaced by the parent's own choice, or
     replaced through the question, does not come back;
  3. a deliberate pick restores it as the parent's own choice (also for an example
     topic), while choosing a pending suggestion keeps its origin and records
     nothing;
  4. a manual choice is never overwritten, and declining is remembered;
  5. correction chains, including an unclear link, plus example-only provenance
     still flagged end to end.

  All five fail on the previous `draft.ts` and pass now. The draft spec has 56
  tests.
- **Codex's `intent-regression.cjs`, unchanged:** its assertion that encoded the
  bug (`head.requestIntent.topicId === 'sirens'`) now fails with `null`.
- **Replay with corrected expectations** (scratch `pw6-intent-replay.cjs`): the base
  control is unchanged; the head gives `revived: []` and request/server intent
  `null`. The second case still keeps `sirens` after a `night` proposal; "keep"
  then a correction re-asks nothing; "replace" adopts `night` with its origin.
- **Browser:** a new direction scenario in the voice-first harness (17 checks) covers
  removal surviving a correction through to a `null` request, the keep/replace
  question, return-to-summary with the proposal ignored, keep, and replace with
  origin. Screenshot: `voice-after/after-8-direction-question-1440.png`.
  - Voice-first harness, all scenarios: 74/74.
  - Adapted P1 harness: 99/99.
  - Adapted P2 harness: 38/38.
- **Fix commit:** `04546f4a`. tsc 0; 141 prototype tests plus classifier 7/7.
- **Full check at `04546f4a`:** RED exactly as at the base.
  - **Ordinary phase:** 364 files, 10 failed, 4892 passed, 73 skipped (4975). These
    are the same 10 failures. That is +5 against `c85ebccc` (the new tests) and
    +141 against the base, all prototype.
  - **Resource phase:** 635/635, with the same `on_task_update_rpc_timeout` gate.
  - No timeout or pinned count changed.
  - The voice-first harness was re-run at the committed `04546f4a`: 74/74.
- **Re-gate range:** `cbe09b31..` this documentation commit.

## 11. First real-audio trial (authorized 2026-09-29): partial, one live sample

Guy authorized a two-sample live trial of the frozen code at `7996e632`. The ceiling
was USD 1.00 and two jobs. Result: the live chain works end to end, and one sample
completed. It exposed an extraction defect: details said last are silently lost at
the 12-detail ceiling. Sample 2 was not run; Guy chose to rework the flow first
(section 12). This is not product acceptance.

**Setup, verifiable from the evidence folder:**

- **Code and server:**
  - Code `7996e632`, clean worktree. No source, prompt, copy or threshold changed during
    the run.
  - `next dev` bound to `127.0.0.1:3431` only. The loopback bind was verified; an
    earlier all-interfaces start was stopped before sign-in.
- **Flags:**
  - `PERSONAL_WIZARD_PREVIEW=true` and `PERSONAL_WIZARD_LIVE_INTAKE=true`.
  - Models: `gpt-transcribe` and `gpt-6-sol`.
  - `PERSONAL_WIZARD_INTAKE_BUDGET_USD=1` and `PERSONAL_WIZARD_INTAKE_MAX_JOBS=2`.
  - `DISABLE_IMAGE_GENERATION=true`.
  - One allowlisted operator, redacted here.
- **Secrets:** passed to the child process by name only, and never printed. No shared
  or deployment env file was modified.
- **Database, used for sign-in only:**
  - The main `.env.local` points at production with stale credentials.
  - The run therefore used the staging project `qvksgpzzosotubcbizay` through its
    session pooler (5432), with the credentials the operator refreshed.
  - The intake itself writes nothing to any database.
- **Identity:**
  - The operator signed in through the real `/login` send-code/verify-code flow,
    against staging.
  - **Limitation:** with no `RESEND_API_KEY`, the code came from the route's dev
    fallback, not from an email.
  - The operator allowlist gate was live.

**Attempts, in order:**

| # | What happened | Paid job | Result |
| --- | --- | --- | --- |
| 0 | Server bound to all interfaces; stopped before sign-in | none | no spend |
| 1 | Production DB unreachable, then stale credentials; 4 failed send-code calls | none | no rows written, no spend |
| 2 | Staging, signed in, `live:true`. Chrome's fake-audio file ended (`%noloop`), so the recorder treated it as an interruption and did not send. This is correct app behavior. | none | no spend |
| 3 | Automated synthetic sample 1 (TTS voice, fictional profile): uploaded, then the browser was closed at Guy's request while processing | job 1 | `client_aborted`, reservation `$0.0763939`, no result |
| 4 | **Guy's own microphone** (consenting adult). A passive observer script watched and never clicked. | job 2 `j_e4101d142d40399021c00550` | `ok`, reservation `$0.0797764` |

**Dispatches and cost:**

- **Job 1:**
  - The ledger reserved the job after measurement, then the client aborted about
    4.5 s into the request.
  - The app does not log per-call dispatch, so whether transcription or extraction
    reached OpenAI is **unknown** (0 to 2 calls, never more; `maxRetries: 0`).
  - Next logged `200 in 4523ms` for this request. That is a dev-logger artifact of the
    closed connection; the route's own event line says `client_aborted` (499).
- **Job 2:** exactly **2 calls**: one transcription (`gpt-transcribe`) and one
  extraction (`gpt-6-sol`), with no retries. Latency was 11.35 s server-side and 11.39 s
  in the browser.
  - The reservation implies a measured duration of about 58 s (derived, not measured
    directly).
- **Reservations:** `$0.1561703` of `$1.00`. The ledger ended at 2/2 jobs, so it
  refuses any further intake.
- **Usage-based estimate: not available.** The provider adapter does not keep token
  or usage figures (see F4), so there is no measured number. The reservation is the
  upper bound. The billed amount is visible only in the OpenAI usage dashboard;
  nothing is claimed here.

**What the live sample caught.** Child names are redacted: `[child]`, `[sister]`,
`[brother]`.

- **Name and age:** both extracted, marked "from the recording".
- **Details:** 12 in total.
  - 7 interests, for example football, trampoline, running and jumping,
    birthdays, cakes and sweets, and playing with each sibling.
  - 2 family entries (the two siblings).
  - 3 traits, filed as `other`.
- **Nothing invented:** no residence, no adventure place, no direction, and no
  address guess. The operator chose "boy".
- **Request:** companion `fox_uri`, direction "just for fun". The photo stayed local:
  the request carries `local_preview_not_sent`, and the server saw no upload.
  - The server answered `accepted_preview` with `containsFixtureData: false` and
    `writer: not_connected`.

**Findings.** None was fixed during the measurement. F1 and F2 are addressed by the
section-12 rework.

- **F1 (P1): silent loss at the detail ceiling.**
  - The parent's last sentence named four fears (loud noises, monsters, unfamiliar
    things, a little of the dark), and none of them reached the card.
  - The model returned exactly 12 facts, the schema `maxItems` and the sanitizer
    ceiling, so the fears were most likely truncated. The raw model output is not
    retained, so the cause cannot be proven from logs.
  - Two of the 12 slots held the same siblings twice.
  - Nothing tells the parent that anything was left out; the card says "we added 14
    details".
  - Manual recovery is blocked too: with 12 facts, adding another answers
    "up to 12 details" until one is removed.
  - Deterministic reproduction: any extraction with more than 12 facts loses the rest,
    with no `omitted` signal in `IntakeExtraction`.
- **F2 (P2): cross-kind duplicates pass the exact-text de-duplication.** Example: "loves
  playing with his sister [sister]" next to "family: sister [sister]".
- **F3 (P3, copy): "loves" is said twice.** The summary group title "[child] loves" is
  followed by values that begin with "loves".
- **F4 (P2, observability): no usage is recorded.** Provider usage (tokens or audio
  seconds) is not kept, so a trial cannot separate a usage-based estimate from the
  reservation.
- **F5 (note): the dev request log can show `200` for a client-aborted intake.** The
  route's JSON event line is the authority.

**Not exercised live:**
- "Edit one detail": the operator did not edit one.
- "Remove the suggested direction": none was suggested, because the parent asked for
  none. The tombstone rule stays covered by the unit tests.
- Sample 2, the sparse profile: it needs a third job, which was not authorized. Guy
  chose to run it on the reworked flow instead.

**After the run:**
- The trial server was stopped: port 3431 is closed and both processes are gone.
- Live intake is off; no env files were touched.
- The evidence stays local in the session scratchpad and is **not committed**, because
  it holds the operator's transcript and a photo thumbnail:
  - the redacted server log;
  - the observer's `evidence.json`;
  - screenshots.
- The protected d53b and accepted-intent worktrees were untouched.

## 12. Voice-first v2: Guy's review after the trial (2026-09-29)

**Commits:**
- `b2acfbd6`: the v2 flow and contract.
- `e7b25322`: the provider-call record (F4).
- This documentation commit.

Re-gate range: `c655bc4c..` this documentation commit.

### 12.1 Decision gate (brief)

- **Proposed change:** Guy's review, in chat after the trial.
  - Five must-haves: name, age, where the child lives, what they love, what is hard.
    Everything else is a bonus, and whatever the recording lacks is asked afterwards.
  - The grammatical address comes from the recording, not a question.
  - Start screen: text above and one big button below. The only alternatives are
    "prefer chips" (chips shown per question) and "prefer writing".
  - While recording: the must-haves as cues. While processing: only an animation,
    nothing else on the screen.
  - All six companions, by name only.
  - No story type: every book is adventure with fantasy, and tiers differ only in
    length and plot depth.
- **Guy's two decisions (chat):**
  - "Collect during recording": cues now; live capture later, as a separate decision.
  - "What is hard": it becomes the story's direction by default, and the parent can
    remove it.
- **Why now:** live trial F1 lost everything hard for the child, and it was the
  product owner's review.
- **Scope:** a general change to the dev-only prototype. No production wiring, no
  story-specific data, no hard-coded child or companion. The topic mapping uses the
  configured topic list; companions come from the configured roster, and a companion
  without card art on disk is dropped.
- **Cost:** none. Tests use fakes, and the browser checks ran on a fixture-mode server
  with no provider key and live intake off. A v2 live trial needs a new authorization.
- **Rollback:** revert the two commits. No flag, env or data change.
- **Do not:**
  - no paid calls;
  - no change to production prices, packages or the story bank;
  - no push.

### 12.2 What changed

- **Extraction v2**
  - `loves`, `hard` and `bonus` are separate arrays with their own `maxItems` (6/4/8),
    listed before the bonus details.
  - New fields: `mentionedAddress` (boy/girl only from the parent's grammar; never from
    the name or the voice; null when absent or mixed), `residence` (a place name) and
    `hardTopicId` (the best-matching allowed topic for what is hard).
  - The sanitizer takes the must-haves first, so a bonus detail that repeats one is the
    one dropped. Group ceilings are enforced again in the contract (`too_many_*`).
  - A `hardTopicId` survives only with a surviving difficulty.
  - The "loves" verb is removed from values (F3), and the instruction says "every
    detail appears once" (F2).
- **Draft v5**
  - Address and residence are single-valued basics with the name/age rules: filled
    when empty, questioned otherwise, and replaced or retired by a correction of their
    own job. The chain hand-off also covers an unclear correction.
  - Residence is no longer a fact kind. `difficulty` is new.
  - Ceilings are per group everywhere: typed, chip, merge and request.
  - `noDifficulty` is the parent's "nothing special". A heard or added difficulty
    replaces it, and it cannot be set while a difficulty is listed.
- **What is hard becomes the direction**
  - A heard `hardTopicId` is proposed as `reason: 'hard'`, unless the parent asked for
    a topic (`reason: 'asked'` wins). A "what is hard" chip proposes its topic as a
    `source: 'chip'` suggestion.
  - A single pending suggestion is adopted by "continue", as before. A chip adoption
    is the parent's own (no `suggestedBy`).
  - Removal is durable (tombstone). Removing the last difficulty withdraws a pending
    hard suggestion without a tombstone.
- **Request v3 (server-enforced):**
  - `child.residence`, `addressSource` and `residenceSource`;
  - at least one love;
  - either difficulties or `noDifficulty`, never both;
  - `bookOptions.lengthId` instead of `packageId`;
  - fixture provenance now also follows the address and residence.
- **Screens:**
  - **Start:** only the text, the button and the two alternatives. The privacy line
    stays in live mode: the parent must know the audio goes to a provider. The test
    tools sit in a closed `<details>`.
  - **Recording:** timer, level, the five cues, finish and cancel.
  - **Processing:** the animation, one line and cancel. Progress, notices and the
    bottom bar are hidden.
  - **Card:** name, age, address and residence rows (value with its provenance badge,
    or the question), then "what they love", "what is hard", "the story will help
    with", the bonus details, and "add another detail".
  - **Chips mode:** the same card with every question open.
  - **Write mode:** the same text extraction job as a transcript correction, with its
    own processing title and privacy line. The text survives a failed or cancelled job.
- **Other steps:**
  - Six companions, names only.
  - Length tiers 16/24/32 pages, from the catalogue's beat counts, described by plot
    depth and shown without prices.
  - The summary shows residence, the two must-have lists, the companion by name, and
    "the story will help with".
- **Removed:** the "still recording / still processing" prompts. "Continue" now exists
  only with the card, and the recording and processing screens carry their own finish
  and cancel. A defensive guard stays in `continueFromTell`.
- **Provider record (`e7b25322`, F4)**
  - Each call is recorded: kind, model, `sent`, outcome, ms, usage numbers and
    estimate.
  - Numbers only; they are returned and logged next to the reservation.
  - The estimate is not a bill.
  - `sent` is false when the job was already aborted as the call started.

### 12.3 Decisions to confirm (Guy) or challenge (Codex)

1. **The address from the parent's grammar** reverses the v1 rule "never heard". It is
   never taken from the name or the voice, and it is asked when not heard.
2. **`hardTopicId` is a model best-match:** a deliberate, visible exception to "never
   infer". It is only a suggestion, and removable.
3. **Residence is required,** because Guy said the five must appear. It is stored as
   the parent's words, is not an address, and is never used as the adventure's place.
4. **The ceilings (6/4/8)** are engineering defaults, not product numbers.
5. **Length tiers** reuse the bedtime/adventure/fantasy beat counts. Mapping them to
   production prices and the story bank is a separate gate: payments, the story bank,
   and `resolveStoryProductTruth`.
6. **Semantic duplicates (F2)** are handled by instruction only; the code catches exact
   duplicates.

### 12.4 Falsification targets for Codex

1. **Crowding out:** can a bonus-heavy answer still push out a love or a difficulty
   anywhere? That covers the schema, sanitizer, merge, manual add, chips and the
   request schema.
2. **Address from the name:** can the address come from the name, or from anything
   other than `mentionedAddress`? Mixed or absent forms must leave it unset.
3. **Correction chains for address and residence:** do they follow the name/age
   behavior? Replace or retire an unapproved value, question an approved or typed one,
   hand off through an unclear correction.
4. **The hard-derived direction:**
   - removal durability;
   - withdrawal when the last difficulty goes;
   - a chip never overriding a chosen or pending direction;
   - adoption provenance.
5. **`noDifficulty`:** difficulties and `noDifficulty` are mutually exclusive, both in
   the draft and on the server.
6. **Focused screens:** is there any path to approve the list behind an unfinished
   recording or job?
7. **Writing:** one job under the same ledger, gate and log rules, and the text is
   kept on failure.
8. **Call record:** no content in the logged calls; the `sent` semantics; estimates
   never presented as billed.

### 12.5 Evidence

- **Type check and tests:** tsc 0.
  - Prototype tests 153/153 at `e7b25322`; 150/150 at `b2acfbd6`.
  - Draft spec 63, extraction 11, service 17.
- **Full check (on the intermediate tree, before the split):** RED exactly like the
  base.
  - **Ordinary phase:** 364 files, the same 10 unrelated failures, 4901 passed, 73
    skipped. The failures are page-entity-qa, story-read-back-validation, the
    visual-direction lifecycle and reserved-page placement.
  - **Resource phase:** 635/635, with the same `on_task_update_rpc_timeout` gate.
- **Full check at the head `e7b25322`:** RED exactly like the base.
  - **Ordinary phase:** 364 files, 10 failed, 4904 passed, 73 skipped (4987). The
    failing set is byte-identical to the intermediate run, and none of it is in the
    prototype.
  - That is +3 against the intermediate run (the F4 tests) and +12 prototype tests
    against the `04546f4a` base (141 to 153).
  - **Resource phase:** 635/635, with the same `on_task_update_rpc_timeout` gate.
  - No timeout or pinned count changed.
- **Browser, fixture mode:** a loopback dev server with no provider key, live intake
  off and placeholder env values. Viewed at 375×812 and 1440×900.
  - The start, processing, card, chips, write, companion, length and summary screens
    all render.
  - Continue with missing must-haves shows each field's error and focuses the name.
  - The sparse example asks exactly name, age, residence and what is hard.
  - A "what is hard" chip proposes and adopts its topic.
  - The request was accepted as `reviewed-personal-book-request/v3`, with provenance
    per value (address `fixture`; name, age and residence `typed`; difficulty `chip`;
    intent `night` without `suggestedBy`; length `long`).
  - A fake microphone showed the recording screen with the five cues. A stubbed live
    status showed the live start screen (privacy line) and the write screen (send
    enabled); the stub answered only the status route and blocked anything else.
  - Screenshots stay in the session scratchpad (`v2/shots/`): start at 390 and 1440,
    the live start, recording, processing, the full card of the complete example, and
    the live write screen. No real child data is in them.

### 12.6 Not done or unverified

- **A real-audio run of v2:** it needs Guy's new authorization. The suggested scope
  stays at two samples (complete and sparse), within $1.
  - The call record now lets that run separate the reservation, the usage-based
    estimate and any bill.
- **Live capture while the parent speaks:** deferred by Guy. It needs a streaming
  provider path and its own cost gate.
- **Production:** replacing story types with length tiers in prices, packages and the
  story bank is a separate decision gate, with Codex as technical owner.
- **Browsers:** Safari/iOS is still unverified.

### 12.7 Guy's second look (same day): `4b6bb761`, `31fbcd37`

- **`4b6bb761`:** the cancel link is centered on the recording and processing screens.
- **`31fbcd37`, start screen:**
  - The title, lead and microphone are centered together, with no empty band on tall
    screens.
  - The microphone is the main action. The two alternatives ("answer from ready
    answers", "write free text") are quiet pill buttons instead of underlined links.
- **`31fbcd37`, preview mode:** one small line says the recording is not decoded
  here, and a link runs the labelled example of decoding. The fixture still takes no
  audio; the boundary test is unchanged.
- **`31fbcd37`, processing:** a "decoding" animation of sound bars flowing into lines
  of text, with one step line.
  - The steps advance every 2.2 s and stop at the last one. They describe the work and
    are not progress; screen readers get one status line.
  - The example's delay is 6 s (was 1.5 s), close to the 11 s of the real trial job.
- **Environment note:** the desktop app's built-in browser pane blocks microphone
  capture, so recording can only be tried in a regular browser. The prototype URL is
  loopback, a secure context.
- **Evidence:** tsc 0 and 153/153 prototype tests. Browser checks at 1440 and 390:
  start, decoding with its steps, then the card.

## 13. Codex QA of v2 (`7996e632..4b6bb761`): HOLD, and its correction

**Verdict:** HOLD, P0 0 / P1 1 / P2 2, with an owner-feedback addendum.

**Commits:**
- `8b74711f`: P1-1 and the owner's rules.
- `fd03371b`: P2-1.
- This documentation commit: P2-2, CURRENT.md.

These two replace the local, never-pushed `1a881aa4` and `d397a5d6`. Those had used two of the
owner's reported wordings in tests and in one code comment, against the addendum's
synthetic-only rule. They were rewritten before any handoff, and now differ only in those test
values and that comment. The old objects remain only in this machine's reflog.

The work was reconciled onto `684d2c10`: `31fbcd37` and `684d2c10` were already committed
before the correction started. No provider call, credential read, push, deployment,
generation or price change was made during the correction.

### 13.1 Reproduced first

- **Codex's `probe.cjs`,** a byte-identical copy (sha256 `d8dad8e6…61c`), run from the
  worktree at `684d2c10`, exits 0. Its assertions of the defect hold:
  1. After a removal, "nothing special" and a correction repeating the removed difficulty,
     the request has `intent = sirens`, with no difficulty and `noDifficulty` true. This holds
     for both transcript and fixture provenance.
  2. After removing one of two difficulties, the request has `intent = sirens` with
     difficulty `["חושך"]`.
  3. After editing the difficulty to "חושך", the request has `intent = sirens`.
  - Both negative controls pass.
- **Real browser at `684d2c10`, fixture server, no key:**
  - **Path A:** complete example → edit the difficulty to "חושך" → continue → accepted
    preview. The direction row still read "רעשים ואזעקות" after the edit, and the accepted
    payload had difficulty `["חושך"]` with `intent.topicId: "sirens"`.
  - **Path B:** empty "ready answers" card → "להקליט במקום". The view stayed on the card
    ("בואו נכיר"), with no record button and the bottom bar still visible.

### 13.2 What changed

- **P1-1 (`8b74711f`)**
  - **Evidence on every hard-derived proposal:** it carries the difficulty facts it stands on,
    each with its wording (comparison key) at that moment.
  - **Proposed only on complete support:** the proposal is made only when every difficulty the
    model matched is listed as heard. None may be removed, reworded (a replaced wording is
    never evidence) or left out.
  - **Before approval:** removing or rewording any of that evidence withdraws the proposal
    (no tombstone), with no replacement guessed.
  - **After approval:** it raises a `stale_direction` question with keep or remove. "Continue"
    keeps it open (`direction_unconfirmed`) and no request builds past it.
  - **Adoption on "continue"** re-checks the evidence.
  - **On the request:** a derived direction carries `basis: 'difficulty'`, and the schema
    refuses one with no difficulty (`direction_without_difficulty`).
  - **Untouched:** requested (`asked`) and parent-chosen directions.
- **Owner addendum (`8b74711f`)**
  - Editing a detail makes it the parent's own (`source: 'typed'`).
  - An incoming detail that reads like a removed one (`similarDetails`, a local token heuristic)
    becomes a `similar_removed` question. Unanswered, it stays out; adding it is the parent's
    explicit choice.
  - A near-repeat of a listed detail is not added twice.
  - The heard card now says: "בדקו במיוחד את השם והמקום. אפשר לתקן או להסיר כל פרט, ומה שתסירו
    לא ייכנס לספר."
- **P2-1 (`fd03371b`):** the step-1 view logic moved to `lib/personal-wizard/tell-view.ts`.
  An explicit switch to recording or writing clears the kept-open card while it is empty;
  with details present, the card stays.

### 13.3 After the fix

Everything below was run at `fd03371b`, and first at the old `d397a5d6` with identical
results.

- **Codex's probe, unchanged:** it now exits 1 at its first defect assertion (`request.intent`
  is `null`). This is what Codex's brief expects: "after a fix, those assertions SHOULD fail".
- **A copy of the probe that reports outcomes** instead of asserting the defect (scratch
  `probe-outcomes.cjs`):
  - All four cases give `intent: null`.
  - Case 2 keeps difficulty `["חושך"]`; case 3 keeps `["חושך"]`.
  - Both of Codex's negative controls pass.
- **Tests:** tsc 0; 171/171 prototype tests (+18).
  - **P1-1:** the four cases, corrections and repeated corrections, a response landing after a
    removal, the after-approval question, the server refusal, and chips.
  - **Controls:** a dismissed direction stays out, a requested topic needs no difficulty, and a
    deliberate pick restores.
  - **Owner addendum:**
    - corrected name, residence and interest survive a new recording and a correction;
    - exclusion before approval, and after approval with a pending job;
    - a detail similar to a removed one is asked about;
    - deliberate restoration, and no near-repeat;
    - no transcript in the request;
    - `similarDetails` cases.
  - **P2-1:** empty and populated switches.
  - Every request is checked through `buildReviewedRequest` AND `acceptPersonalBookRequest`.
- **Real browser, same paths (scratch `browser-regate.cjs`):**
  - **A:** the direction row disappears on the edit; the accepted payload has difficulty
    `["חושך"]`, `intent: null`, and no "רעשים ואזעקות" in the summary.
  - **B, empty:** back on the start screen, with the title, the record button, no form and no
    bottom bar.
  - **B, populated:** the card and the typed name stay.
  - **C (owner scenario 6):** complete example → name, residence and one interest corrected, an
    unrelated correct detail removed → summary → accepted payload.
    - The payload has the corrected name and residence (`typed`) and the corrected interest
      (`typed`).
    - The removed detail is absent from both the payload and the summary, and there is no
      transcript.
  - **D:** direction approved → back → its difficulty removed. The question appears; "continue"
    stays on step 1 with focus on the first missing must-have ("what is hard").
    "Remove the direction" plus "nothing special" then continues with no direction.

### 13.4 The owner's live observations, kept separate

- **What Guy observed** in his v2 recording: a misrecognized name, residence and interest,
  corrected by hand, and one correct detail removed. Afterwards the flow was fine.
- **What the offline tests prove:** the correction and exclusion contract at the request
  boundary, with synthetic stand-ins, not his values.
- **What the browser proves:** path C and path D above.
- **Diagnosis:** the audio and transcript of that recording were not retained, and the server
  logs no content by design. So it is **unknown** whether transcription or extraction
  introduced the errors.
  - No model change, retry or new recording was made.
  - A recognition experiment would need its own bounded authorization.
- **No accuracy claim** is made from one sample.

### 13.5 Full check at the correction head

`npm run check` at `fd03371b` gives **exit 1, the same as the base.** This is not green.

- **Ordinary phase:** 364 files. Tests: 10 failed, 4922 passed, 73 skipped (5005).
  - The 10 failures are the same inherited tests, by exact name, as at the branch base
    `713017e1` (a separate baseline worktree) and at v2 `e7b25322`:
    - child lexicon ages 5–8;
    - momentum gate koko;
    - page entity QA;
    - story read-back validation (2);
    - visual direction acceptance lifecycle (4);
    - reserved page placement authority (1).
  - None is a prototype test.
  - 4922 passed is 18 more than v2's 4904: the new tests.
- **Resource-intensive phase:** 20 files, 635/635 tests passed. Its gate still fails with
  `on_task_update_rpc_timeout` and `signal_or_exit_failure`, as at the base.
- **First run at `d397a5d6`:** the identical result.

### 13.6 Re-gate

- **Range:** `684d2c10..` this documentation commit.
- **Full range since Codex's review:** `4b6bb761..` this commit, which includes `31fbcd37` and
  `684d2c10` (UI, not reviewed).
- **Retained frozen reproduction:** Codex's probe under
  `C:/Users/guyna/.codex/visualizations/2026/09/29/personal-wizard-qa-4b6bb761/`, unchanged.

## 14. Codex re-gate of the correction (`684d2c10..7086b0f0`): HOLD, and its successor

**Verdict:** HOLD, P0 0 / P1 1 / P2 0.
- P2-1 and P2-2 are closed.
- The four original P1-1 reproductions are closed.

**The finding.** P1-1 was not fully closed.
- **The bug:** `resolveConflict` answered "remove" on a `stale_fact` question with
  `next(removeFact(draft, …), { conflicts })`. There, `conflicts` came from the draft *before*
  `removeFact` ran.
- **Effect:** `removeFact` raised the `stale_direction` question and cleared the evidence, and
  the older list overwrote that question.
- **Result:** the approved derived direction reached the server with no `basis`, no question and
  no decision, for both sources, with or without another difficulty left.

**Commits:** `cbda44b8` and this documentation commit. The frozen range `684d2c10..7086b0f0` is
not rewritten.

### 14.1 Reproduced first

- **Codex's new probe** (`personal-wizard-qa-7086b0f0/probe.cjs`, sha256 `8e0a62e0…532a`), as a
  byte-identical copy at `7086b0f0`:
  - exit 0;
  - 10/10 closure and control groups pass;
  - all four stale-fact bypasses reproduce (`intent: sirens`, no question, server accepted).
- **The new regression tests, before the fix:** the three that cover the defect fail, and the
  two controls pass.

### 14.2 What changed

- **The fix:** "remove" on a `stale_fact` question now builds on `removeFact`'s result and closes
  only the answered question.
- **Audit of `resolveConflict`:**
  - `similar_removed` "accept" had the same shape. It is harmless today, since `afterFactAdded`
    changes only `noDifficulty`, and it is now composed like `addTypedFact`.
  - `stale_direction` and `stale_place` already built on their helper's result. The `keep`,
    basics and story-place branches use no helper.
- **UI audit:**
  - Every resolve button calls `resolveConflict` on the latest draft
    (`update((current) => …)`).
  - `receiveIntake` reads and writes in the same tick.
- **Not a marker-only fix:** the missing parent decision is restored. A `basis` marker alone would
  still pass the server while another difficulty remains.

### 14.3 After the fix

- **Codex's probe, unchanged:**
  - Run with the fix in the worktree before committing. HEAD was still `7086b0f0`, so its head
    pin passes.
  - It exits 1 at line 136, its assertion that the question is absent.
  - At `cbda44b8` it stops at its head pin (line 16), by design.
- **Outcome copy** (scratch `regate2/probe-outcomes.cjs`) at `cbda44b8`: the same scenarios, with
  the head reported instead of pinned and the four cases reported instead of asserted.
  - The original 10 groups pass.
  - In all four cases the question is present, and "continue" is blocked
    (`direction_unconfirmed`).
  - **Keep:** the server accepts `sirens` as the parent's choice, with no `basis`.
  - **Remove:** `intent: null`, and it stays null after a correction or a new recording repeats
    the difficulty.
  - 0 provider calls.
- **Tests:** tsc 0; 176/176 prototype tests (+5). The new block covers:
  - the question, and "continue" blocked;
  - keep and remove, with later processing;
  - an unrelated open question staying open;
  - requested and chosen directions not being questioned;
  - the `similar_removed` branch keeping other open questions.

  Each of the first four runs both sources × both remaining-difficulty states, through
  `buildReviewedRequest` AND `acceptPersonalBookRequest`.
- **Browser: not run for this path.**
  - A stale-detail question needs a transcript correction, and only the live text extraction
    produces one: a provider call, not authorized.
  - Example mode starts new recordings only.
  - The card's continue guard for `direction_unconfirmed` is the same one browser path D
    exercised (§13.3).

### 14.4 Full check

`npm run check` at `cbda44b8` gives **exit 1, the same as the base.** This is not green.

- **Ordinary phase:** 364 files. Tests: 10 failed, 4927 passed, 73 skipped (5010).
  - The 10 failures are the same inherited tests, by exact name, as at the branch base
    `713017e1` (see §13.5).
  - 4927 passed is 5 more than at `fd03371b`: the new tests.
- **Resource-intensive phase:** 20 files, 635/635 tests passed. Its gate still fails with
  `on_task_update_rpc_timeout` and `signal_or_exit_failure`, as at the base.

### 14.5 Re-gate

- **Range:** `7086b0f0..` this documentation commit.
- **Frozen probes:** Codex's probes (`…-4b6bb761/` and `…-7086b0f0/`) were read and copied, never
  rewritten.

### 14.6 Codex re-gate of `7086b0f0..d05faeab`: technical PASS

**Verdict:** P0 0 / P1 0 / P2 0 for that exact range. It closes the residual
stale-fact/direction P1.

- **Not covered:** this is not an all-branch, release, live-voice, product or
  repository-stability PASS.
- **Never reviewed as a range:** `4b6bb761..684d2c10` (`31fbcd37` UI, `684d2c10` docs). No
  approval applies to it retroactively.

**What Codex verified independently** (its own probe; the old module loaded from Git, not checked
out):

- **The four combinations,** each at the base and at the head:
  - the base reproduces the bypass;
  - the head keeps the question and refuses to build (`direction_unconfirmed`);
  - keep = the parent's choice, with no `basis`;
  - remove = null, and it stays null after a correction and after a new recording.
- **Further checks:**
  - an unrelated name question is byte-identical throughout;
  - re-answering the closed question is a no-op;
  - the input draft is not mutated;
  - an asked topic stays valid;
  - two consecutive removals keep exactly one question;
  - a similar-detail restoration keeps the decision open.

**Codex's own focused runs:** tsc 0, and the focused suite finished at 183/183 (176 prototype + 7
classifier) on a rerun. The first run, started alongside tsc, was 179 passed / 4 failed, in
`audio-probe.spec.ts`:
- 3 tests timed out at 5000 ms;
- the temp-file count assertion read 0 instead of 1.

The same spec passed alone (11/11), and the same full command passed on the rerun. Codex did not
establish the cause.

**My reading, from the code only (not reproduced):**
- **The timeouts:** the real-media tests spawn ffmpeg to make and decode tones of up to 120 s,
  under vitest's default 5 s per-test timeout. Under CPU contention they can run past it.
- **The file count:** the assertion compares a global count of `pw-intake-*` files in the OS
  temp folder. A timed-out sibling's measurement keeps running in the background, so its temp
  file can exist when the check starts and be gone when it ends. That fits "0 instead of 1": the
  count went down, not up. It points to a knock-on of the timeouts, not a leak.
- **Status:** a candidate follow-up, not part of this milestone. Stability stays open.

## 15. Codex UI review of `4b6bb761..684d2c10`: technical PASS with one P2, and its fix

**Verdicts:**
- **Documentation closeout `d05faeab..8ce1784c`:** PASS.
- **UI range `4b6bb761..684d2c10`** (`31fbcd37` start screen and decoding animation, `684d2c10`
  docs): technical PASS, P0 0 / P1 0 / P2 1.
  - This is the previously missing review; it does not extend the stale-fact PASS.
  - Codex's browser and tests ran at `8ce1784c`.

**P2-1.** The `prefers-reduced-motion: reduce` block (then at lines 1150–1169) set
`animation: none` on the decoding elements, but later rules of equal specificity (lines 1561,
1607, 1643, 1674, 1714) set their animations again and won by source order. Codex showed this
from the source and the loaded CSSOM, not with the preference switched on.

**Commit:** `fc587266` and this documentation commit.

### 15.1 Reproduced first, with the preference switched on

- **Setup:** real headless Chrome (scratch `regate3/browser-motion.cjs`) on the fixture server (no
  key, live intake off), with Chrome's fake media device (a synthetic tone; nothing sent).
- **Measured values:** each element's computed `animation-name` and its running
  `getAnimations()`, with `prefers-reduced-motion` emulated as `reduce`
  (`matchMedia(...).matches === true`) and as `no-preference`.
- **At `8ce1784c`, with reduce:**
  - all 16 decoding elements still ran: 6 wave bars `pw-wave`, 3 flow dots `pw-flow`, 3 lines
    `pw-write`, 3 sparks `pw-twinkle`, the step `pw-step-in`, one running animation each;
  - the recording pulse ran `pw-breathe`;
  - the microphone scaled on hover (`matrix(1.03, …)`).
- **Two variants beyond the review:** the same order had also defeated `.recordPulse[data-live]`
  (line 1438) and `.recordButton:hover .recordCircle` (line 1289). The recording dot and the
  companion and continue hovers came before the block and were already correct.

### 15.2 What changed

- **The move:** the reduced-motion block moves, byte for byte, to the end of the stylesheet, with
  a note that it must stay last. Every rule it overrides now comes before it.
- **Unchanged:** no animation, timing, extraction, provider, copy or layout.

### 15.3 After the fix

- **Real browser, same script, at `fc587266`:**
  - **With reduce:** all 16 decoding elements are `none` with 0 running animations, the pulse is
    `none`/0, and the microphone hover is `transform: none`.
  - **With `no-preference`:** everything runs as before, and the microphone scales.
  - **Both modes:** processing, cancel back to the start, and processing to the result card are
    unchanged.
  - **The screen with reduce:** the static art, the title, the step line and "ביטול" stay.
- **Regression test** `lib/personal-wizard/__tests__/reduced-motion.spec.ts`: it resolves the
  stylesheet's cascade (source order, specificity, `!important`, media; other media queries
  counted as matching) for every moving element, by the exact selectors that match it. Its five
  tests:
  1. the specificity rule, checked on the selectors that matter;
  2. with reduced motion, all 21 moving targets resolve to `none`: the 16 decoding elements, the
     pulse, the dot and 3 hover transforms;
  3. without it, each keeps its keyframes or transform;
  4. any animation or hover transform it does not cover fails it;
  5. a control puts the block back in its old place and finds exactly the reviewed elements plus
     the pulse and microphone moving.
- **Failing before:** run against the `8ce1784c` stylesheet, the reduced-motion test fails
  (`.decodeWave` bar 1 resolves to `pw-wave`, not `none`).
- **Checks:** tsc 0; focused suite 11 files, 188/188 (181 prototype + 7 classifier), run after
  tsc, not alongside it. The workload classifier counts the new ordinary spec (385/365).

### 15.4 Full check

`npm run check` at `fc587266` gives **exit 1, the same as the base.** This is not green.

- **Partition:** 385 canonical files, 365 ordinary, 20 resource-intensive.
- **Ordinary phase:** Tests: 10 failed, 4932 passed, 73 skipped (5015).
  - The 10 failures are the same inherited tests, by exact name, as at the branch base
    `713017e1`.
  - 4932 passed is 5 more than at `cbda44b8`: the new spec.
  - `audio-probe.spec.ts` passed in this run (11/11), and the flake stays open.
- **Resource-intensive phase:** 635/635 tests passed. Its gate still fails with
  `on_task_update_rpc_timeout` and `signal_or_exit_failure`, as at the base.

### 15.5 Re-gate

- **Range:** `8ce1784c..` this documentation commit.
- **Not claimed:** an operating-system reduced-motion run, iOS/Safari, or assistive technology.
  The browser run emulates the media feature in Chrome.
