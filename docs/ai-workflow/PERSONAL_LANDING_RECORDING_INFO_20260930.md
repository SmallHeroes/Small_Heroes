# Preview landing: the recording, explained (2026-09-30)

- **Branch:** `claude/personal-landing-recording-info`, from `45b9e754`.
- **Code commit:** `26b7e58f`. The documentation commit follows it.
- **QA range:** `45b9e754..` the documentation commit.
- **Status:** local only. There was no push, deployment, provider call or charge.

## Round 2 (Guy's review, 2026-09-30): one "how it works" right after the hero

- **Code commit:** `42c67ce3`. The re-gate range is `41eba860..` the documentation commit that follows it.
- **Guy's review:**
  - The hand-written story example is weaker, so it comes off for now.
  - The recording section and "how it works" said nearly the same thing, so they become one section, right
    after the hero.
- **The preview page now runs:** hero, then how it works, then value, then the companions; the rest is as
  before.
- **The merged section:** `app/landing/personal-how-it-works.tsx`, with content `PERSONAL_HOW_IT_WORKS` and id
  `how`.
  - Steps: talk for half a minute to a minute; check and complete the card, answering only what is missing;
    choose a friend for the journey, freely and not by topic.
  - The three notes are as before.
  - The preview note also says the full book is still in development. The old step 3 used to carry that.
  - It carries the storybook sky's exact wash, `rgba(244, 241, 255, 0.26)` over white. The field runs from the
    hero into the value section with no seam, as the landing's sky comments require.
- **Removed:**
  - The example section: its component (`app/landing/personal-story-moment.tsx`), its copy
    (`PERSONAL_STORY_MOMENT`) and its styles. It can be restored from `45b9e754`.
  - The preview's `how` copy override, which nothing rendered any more.
- **Navigation:** the header shows "איך זה עובד" and "החברים". The hero's second button reads "איך זה עובד" and
  points at the merged section.
- **Shared component:** the old how section renders only when `personalPreview` is false.
- **Unchanged:** public `/`. Its visible markup is identical to the base (47,178 characters), and it has no
  recording text.
- **Claims:** the table below still applies. The new friend step matches the wizard: the companion is chosen
  on its own screen (`companionCopy().sub`), and the direction is chosen separately and is optional
  (`companionCopy().intentSub`).
- **Evidence:**
  - `npx tsc --noEmit` exits 0; 257/257 in 14 focused specs. The copy test now also checks the topic-free friend
    step and the development-status note.
  - Real Chrome at 1440x900 and 390x844: no overflow and no console errors. Both seams were checked.
  - Accessibility: 0 contrast failures; headings go H1, H2, three H3s, H2; one tab stop with visible focus.
  - Keyboard order: the hero CTA, "איך זה עובד", the section CTA, then the companions.
- **Full check at `42c67ce3`:** exit 1, the same as round 1 and the base. There are 10 ordinary failures with identical names, 5001 passed, and the resource phase passes 635/635 with the `on_task_update_rpc_timeout` gate. The preview server ran throughout.

## Request

Guy saw the landing redesign (v2) and did not take that direction. Instead he asked for "קצת מידע על הענין
של ההקלטה לאתר הקיים, פשוט, מבלי לשנות דרמטית את העיצוב".

The redesign stays on `claude/personal-story-redesign` (`25359e37..5f8bbea4`) as a record. It is not
submitted for QA.

## What changed (the preview only)

- **The section:** `/dev/personal-product` gets one section after the story example, whose facts panel
  shows "what they told us". It is `app/landing/personal-recording-info.tsx`, and it contains:
  - a kicker;
  - a two-sentence heading;
  - a lede;
  - three steps in one panel: talk, check the card, answer only what is missing;
  - three short notes: the microphone, the alternatives, storage and narration;
  - the page's existing CTA, and a one-line preview note.
- **Styling:** the styles are only in `app/dev/personal-product/personal-product.css`. They reuse the page's own
  classes (`value-card-*`, the kicker pill, `section-h2`, `section-lede`, `btn-primary`). There is no motion.
- **Header:** a new "ההקלטה" link points to `#personal-recording`. It is in the preview navigation only.
- **FAQ:** a new question, "מה קורה להקלטה?", comes before the existing narration question.
- **Content:** it is in `content/personal-landing.ts` as `PERSONAL_RECORDING_INFO`, next to `PERSONAL_STORY_MOMENT`.

## What did not change

- **Public `/` and `/start`:**
  - Public `/` has the same visible markup before and after. With scripts and links stripped, it is 47,178
    characters both times.
  - The public copy has no recording text, and a test asserts this.
  - The UX spec forbids promoting new-product copy on public pages while they route into the old checkout.
- **Everything else:**
  - the page's design, tokens, and every other section and its order;
  - the wizard, engine, payments, budgets, story sources and QA thresholds.
- **Bundle note:** as with the existing `PersonalStoryMoment`, the shared client component imports the preview
  section. Its code therefore ships in the public bundle, but it never renders there.

## Every claim and its source in the product

| Landing claim | Source |
| --- | --- |
| "מדברים חצי דקה עד דקה" | `tellCopy().durationHint`, "חצי דקה עד דקה, בכל סדר שנוח לכם." |
| "אפשר להקליט עד דקה וחצי" | `LIMITS.recordingMaxMs = 90_000`. The recorder stops at the limit. |
| Name, age, place, what he loves, what is hard | `MUST_HAVE_CUES`, shown while recording |
| Fix or remove any detail; what you remove does not enter the book | `tellCopy().cardNote` |
| Only what is missing is asked; "אין משהו מיוחד" is a full answer | `tellCopy().missingNote`, `hardNone`, and the existing "how it works" step 1 |
| The microphone opens only on a click | The browser's `getUserMedia` is wired, not called, in `app/dev/personal-wizard/hooks.ts:43`. It is called only in `RecorderController.start()` (`lib/personal-wizard/recorder.ts:212`), which runs from the record button. |
| Write, or choose ready answers, instead | `tellCopy().writeLink`, `chipsLink` |
| Not stored by us; not the narration | `RECORDER.privacyLive`, `bookCopy().voiceNote` |
| The FAQ answer | `RECORDER.privacyLive` word for word, plus the preview's local-only case (`tellCopy().localNote`) |
| Live decoding for authorised testers only; a ready example for others | The operator gate on live intake (`fetchLiveIntakeStatus`), and `tellCopy().exampleCta` |

The duration, the alternatives, the narration line and the privacy line are asserted against these sources in
`lib/personal-wizard/__tests__/story-writer.spec.ts` ("explains the recording with the wizard facts and keeps
it off the public landing").

## Evidence

- **Types and tests:**
  - `npx tsc --noEmit` exits 0.
  - The focused suite passes 257/257 across 14 specs (`lib/personal-wizard` and the workload classifier).
  - The story-writer spec gained one test and passes 39/39.
- **Real Chrome** (puppeteer-core with the system browser, a fixture server, no key; nothing was sent):
  - Desktop 1440x900 and mobile 390x844 have no horizontal overflow and no console errors.
  - The header shows all four links without wrapping at 1024, 1180, 1280 and 1440 px.
  - The header link lands the section 12 px below the sticky header.
- **Section accessibility**, under reduced motion:
  - 15 text nodes, 0 contrast failures. The minimum is 4.86, on the existing primary button.
  - The heading and region are both named "מספרים עליו בקול. אנחנו מסדרים את הפרטים."
  - Headings go H2, then three H3s. The steps are an `<ol>`, the notes a `<ul>`, and the icons are aria-hidden.
  - There is one tab stop, the CTA, and its focus is visible.
- **FAQ:** there are ten questions. The new one opens with the expected answer.
- **Full check at `26b7e58f`:** exit 1, not green, the same shape as the base.
  - Ordinary phase, 368 files: 10 failures, the same inherited tests by name as the earlier runs
    (engine, story-source and set-identity specs; none touches the landing). 5001 passed.
  - Resource phase, 20 files: 635/635 passed, but the `on_task_update_rpc_timeout` gate
    (3 `onTaskUpdate` RPC timeouts) fails the phase, as recorded for the base.
  - Counts: canonical 388, ordinary 368, resource 20. The preview server was started during the last
    ~40 s of the resource phase, to show Guy the page.

## Codex QA (2026-09-30)

**Verdict:** technical PASS, with P0, P1 and P2 all 0. It covers `45b9e754..77f6d430` only.

- **What the PASS is not:** product acceptance, release readiness, a privacy-policy certification, or approval
  to push or deploy.
- **Preview isolation:** an independent in-memory harness rendered the base and head `LandingPage` with
  ReactDOMServer.
  - The public markup was identical, including with an explicit `personalPreview=false`.
  - The preview control contained the section, the link, the FAQ and the note.
  - The real browser showed no recording copy on `/` or `/start`.
  - The component code still ships in the shared bundle. Rendering isolation is not bundle exclusion.
- **Wizard claims and non-operator honesty:** verified against the code. In a real browser, the CTA reached the
  local-only start screen, the labelled example worked, and no microphone permission was requested.
- **Privacy copy:** consistent with the existing disclosure. Provider retention and legal compliance were not
  audited.
- **Codex's own checks:**
  - tsc 0;
  - 14 specs, 257/257;
  - `git diff --check` clean;
  - an untouched-path diff;
  - a focused browser and accessibility audit at 1024 to 1440 px and 390x844.
- **Full gate:** not re-run by Codex. It remains RED and open.

## Open

- **Guy:** product acceptance of the copy and the placement. Push is his call.
- **Claude:** the independent review of the writer at `45b9e754` is still open. This PASS does not cover it.
- **Public recording copy:** it reaches public pages only together with the personal flow. That is Guy's call,
  with Codex.
