# Personal wizard: the recording screen as one stage, and less text on every step (2026-10-01)

- **Branch:** `claude/personal-wizard-wow-20261001`, from `719dcb7f` (the book line Codex put on QA today). Local, not pushed.
- **Owner split:** Claude implemented at Guy's request ("the recording screen must be much more WOW, it is very
  technical; cut text that is not needed; the same for the other wizard screens; desktop and mobile"). Codex does
  technical QA and decides the merge. Guy owns product acceptance.
- **Status:** a design pass on the prototype route `/dev/personal-wizard`. No contract, draft, intake, recorder or
  request logic changed.

## What changed

### The recording screen (step 1, start and recording)

- One stage for both states. The title, an arc of the five things worth telling (name, age, where they live, what
  they love, what is hard) and the microphone orb stay in place when recording starts; only what sits under the orb
  changes (label, then a red dot and the clock, then "finish" and "cancel"). The cues replace the explanatory
  paragraph and are static prompts: nothing lights up, because nothing is heard live (spec: no invented live facts).
- The orb's two halos breathe slowly at rest. While listening they follow the measured input level from
  `useLevelMeter` (the same real RMS the old bar used), through a `--level` custom property. No stream, no movement.
- One entrance: the five cue stickers settle onto the arc in reading order. Reduced motion stops the entrance, the
  breathing and the scaling; the level still shows through the halos' opacity.
- Removed from this screen: the draft notice, the duration hint, the "prototype keeps the recording on the device"
  note and the "see an example" link (the tester panel has the same example). The tester panel is a quiet line until
  opened. The live-trial sign-in note is one sentence plus its link (moved from hard-coded JSX into `copy.ts`).
- Focus: pressing the microphone removes the button, so focus moves to "finish" when it would otherwise fall to the
  page.

### Text cut or shortened elsewhere (Codex's framing kept: "give room to", no promised outcome)

- **Details card:** labels are "שם", "גיל", "פנייה בסיפור", "מקום מגורים"; the age and address hints are gone;
  "what is hard" asks one question instead of a title plus a question; the "without a topic" note is gone; the
  notes after decoding are one line each.
- **Companion:** the sub line and the roster note are gone; the direction note is "לא חובה. בכל מקרה זו תהיה הרפתקה,
  לא שיעור."
- **Book:** title "תמונה, קול ואורך"; the length note is gone (each length card already says what differs).
- **Summary:** the box title is gone and its body is one line; the direction row is the topic alone.
- **Write view:** the same cue stickers above the box replace the "worth telling: a · b · c" line.
- The privacy disclosure for live intake is unchanged in substance.

### Shared look

A soft lavender sky behind every step, a slim step bar with the step name, larger titles, softer cards. Same tokens,
no new palette; yellow appears only as the orb's spark and the prototype badge.

## Files

`app/dev/personal-wizard/{RecorderPanel,StepTell,ChildBasics,MustHaves,StepCompanion,StepBook,StepSummary,PersonalWizard}.tsx`,
new `CueTags.tsx`, `personal-wizard.module.css`, `lib/personal-wizard/copy.ts`, and
`lib/personal-wizard/__tests__/reduced-motion.spec.ts` (the old recording pulse is gone; the idle halos, the
voice-driven halo scaling and the cue entrance are added as moving elements and stop under reduced motion, including
the misplaced-block control).

**Merge note:** Codex's working tree on `codex/personal-book-storyboard-bridge` had only docs and
`story-comparison.spec.ts` uncommitted at the time of this branch. `StoryPreview.tsx` is untouched here, so its long
hints are left for Codex. `copy.ts`, `PersonalWizard.tsx`, `StepTell.tsx` and the CSS were last changed by Codex in
`188a1c53`/`806ce4d7`; this branch is on top of them.

## Verification

- `npx tsc --noEmit`: clean. `vitest lib/personal-wizard`: 24 files, 658 tests pass.
- `npm run check`: 10 tests in 6 files fail (story read-back, visual-direction lifecycle, reserved-page placement,
  koko momentum, page-entity QA, child lexicon). The same 10 fail on the untouched `719dcb7f` in a clean worktree:
  local fixtures absent from fresh worktrees, not this change.
- Headless Chrome at 390x844, 360x740 and 1440x900, with Chrome's fake microphone for the recording state and the
  labelled example for the rest of the flow: no horizontal overflow at any size.

## Not verified

- A real microphone on iOS Safari and Android Chrome, and the halos with a real voice (only Chrome's test tone).
- The live-intake and sign-in-required variants: they need an operator session, so only the local mode was seen.
- No paid call, no provider, no deployment.
