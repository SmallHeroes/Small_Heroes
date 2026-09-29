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
