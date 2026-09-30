# Personal landing: the living-story hero, a direction proof (2026-09-30)

- **Branch:** `claude/personal-landing-wow`. Pushed to origin as a separate branch at Guy's instruction. It is not on QA.
- **Owner split:** Claude implemented, at Guy's direction, while Codex wires the new wizard to the engine. Codex does
  technical QA and decides how this reaches QA. Guy owns product acceptance.
- **Status:** a direction proof that Guy has approved as a direction ("זה טוב"). It is not a release candidate.
- **QA:** Codex held the hero (`cdf5938b..c0827427`) with two P2s. `b7f4bf28` corrects them locally, and the
  corrective range awaits Codex's re-gate. See "Codex QA of the hero, and the correction" below.

## Where it sits relative to QA

- `qa.smallheroes.co.il` is a branch domain on `codex/r1d-release-reader-voice-final`, serving `a0835b72`. This was
  verified on 2026-09-30 with `list_project_domains` and `get_deployment`.
- That tip is an ancestor of this branch. The pushed tip `c0827427` is ahead by 45 commits and behind by 0; the local
  correction and its documentation make it 47 (cached refs). A move to QA can be a fast-forward.
- Those commits are more than the landing. Grouped:
  1. `c0a93966`, `713017e1`: documentation already on the local line.
  2. The personal wizard prototype, `fd030932..fd2b26bd` (Claude). Codex passed `7086b0f0..d05faeab` and the UI range,
     whose P2 was fixed in `fc587266`. Codex re-gated exactly `8ce1784c..fd2b26bd` on 2026-09-29: **PASS, P0 0 / P1 0 /
     P2 0**, closing the reduced-motion P2.
     - That closure rests on Codex's source and cascade checks, focused tests and negative controls.
     - The Chrome figures in that milestone remain Claude's reported evidence.
     - It covers that range only.
  3. Codex's writer pilot, `45b9e754`. There is no independent Claude review yet.
  4. The landing's recording information: `26b7e58f..77f6d430` (Codex technical PASS, recorded in `41eba860`), and
     round 2, `42c67ce3` + `cdf5938b`, awaiting a re-gate. Codex's hero QA used `41eba860..cdf5938b` as an
     isolation comparison and gave no separate verdict on it.
  5. This direction proof: `dafe34fa`, `ef8269b4`, `1e3a9a40`, `70e33298`, `da9233da`, and the documentation commit
     `c0827427`. Codex QA held it with two P2s.
  6. The correction: `b7f4bf28` and this documentation commit. It is local and awaits Codex's re-gate.

## What the direction proof changes (the preview only, `/dev/personal-product`)

- **Hero:** the same words, beside a living story.
  - A parent speaks three lines in a handwritten type, next to a voice orb.
  - Each line brings up one moment as a pencil sketch. The spoken phrase flies onto it as a yellow sticker, and the
    moment fills with colour.
  - Three invented families take turns:
    - Yuval and Buni: a vaccination, on the approved hero art.
    - Bar and Uri the fox: the dark.
    - Aviv and Anat the panda: a new home and a new kindergarten.
  - Dots choose a family and a control pauses. It runs only on screen, in a visible tab and with motion allowed.
    Reduced motion shows a finished story.
  - It is labelled "המחשה".
- **Guy's decisions along the way (three rounds):**
  - No night, orange or lavender-heavy hero; a soft sky background.
  - Fredoka as the preview's type, with Playpen Sans Hebrew for spoken words. The fonts are loaded by the preview
    route only.
  - One headline size, with the promise in purple.
  - No book object.
  - A sticker on every picture.
  - No purple pills that read as buttons, so no closing title pill.
  - More room under the header.
  - A lighter hero copy. The headline and description are smaller, and the development one-liner and the two chips
    under the buttons are removed. The development status is still said by the badge, the early-stage band, the
    how-it-works note and the FAQ.
  - No companion row on the trail.
- **"How it works":** a trail of three stops (yellow, purple, yellow) that draws itself on scroll, using the page's
  own reveal system.
- **Stand-ins:** Bar's and Aviv's pictures come from the existing gallery until consistent pictures exist; the child's
  look changes between them. Making them properly needs paid image generation, which needs Guy's approval.
- **Public `/`:** the visible markup is identical to the base, and the new fonts are not loaded there.

## To show it on a deployment

Both switches are needed:
- `ALLOW_STAGING_QA=true`, on a non-production Vercel runtime. This is the existing `/dev` gate.
- `PERSONAL_WIZARD_PREVIEW=true`.

The prototype's other flags stay off by default, so there is no live intake, no story writer and no provider call.
Claude's session cannot read or set Vercel environment variables (the API returns 403).

## Evidence (this branch)

- `npx tsc --noEmit` exits 0.
- The focused suite (the personal wizard plus the workload classifier) passes 258/258. The guard test checks that
  the families are labelled, that every picture has a sticker, that the child is named in the telling, and that
  every picture file exists.
- Real Chrome at 1440x900 and 390x844: no overflow and no console errors. The families were cycled with the dots,
  and reduced motion was checked.
- Hero contrast: 0 failures.
- Full check at `70e33298`: exit 1, the same as the base. The ordinary phase has the same 10 inherited failures by
  name, and the resource phase passes 635/635 with the `on_task_update_rpc_timeout` gate.
- `da9233da` after it is UI-only. It was verified with tsc 0, the focused suite at 258/258, the public diff, contrast
  and the browser. The full check was not re-run on it.
- The focused suite failed intermittently in 2 of 7 runs, in one file each time, while the preview server was running.
  The failing file was not captured, so the failure is unattributed. As Codex noted, it cannot be assigned to
  `audio-probe` on this evidence.

## Codex QA of the hero, and the correction (2026-09-30)

- **Codex's verdict on `cdf5938b..c0827427`: HOLD, P0 0 / P1 0 / P2 2.** It is scoped to the hero, not to the
  45-commit line.
  - **P2-1:** a pending family change could override the latest choice.
    - The 600 ms fade could not be cancelled.
    - The dots compared against the family still on stage.
    - The timer outlived an unmount.
  - **P2-2:** a sticker already in flight ignored pause, reduced motion and the off-screen state, because its Web
    Animation handle was never kept.
  - Codex could not run its browser checks: the loopback preview was down and the remote preview needs a Vercel
    login. So the viewport, contrast, keyboard and hydration results above are still Claude's alone.
- **The correction, `b7f4bf28`:**
  - `lib/web/voice-stage-lifecycle.ts` owns both kinds of motion. It is pure, and takes the stage's timers and
    animation handles.
  - **One fade at a time.**
    - A press during the fade becomes its target, so the latest choice wins. That includes a press back to the
      family on stage, and a press during the automatic end-of-story fade.
    - Reduced motion finishes a pending change at once.
    - Unmount cancels the timeout and the pending animation frame.
  - **Every flight is owned.**
    - Flights are held and resumed with the stage.
    - Under reduced motion they stop and their stickers land.
    - On a family change or unmount they are dropped.
    - A late finish from a replaced flight never lands a sticker.
  - The stage creates the fade per mount, so Strict Mode and fast refresh start clean.
  - Copy, markup and CSS are unchanged.
- **Tests:** `lib/__tests__/voice-stage-lifecycle.spec.ts` has 23 tests.
  - Unit rules for both lifecycles.
  - The real `VoiceStoryStage.tsx`, transpiled and run with modelled hooks, timers and Web Animations through
    Codex's steps. Every family that reaches the stage is recorded, so a wrong family shown in between fails too.
  - **Negative control:** with the `c0827427` component swapped in, all 8 component scenarios fail on their intended
    assertions. That includes the stale finish landing the next family's sticker.
  - The workload classifier counts one more ordinary spec: 389 / 369 / 20.
- **Verified:**
  - `npx tsc --noEmit` exits 0.
  - The focused suite passes 289/289 in 16 files: the personal wizard, the new spec, the classifier and the landing
    presentation spec.
  - Public `/` has identical visible markup, compared with scripts and cache-busters removed.
  - **Full check at `b7f4bf28`: exit 1, the same as the base.**
    - Ordinary: 369 files, 10 failed / 5025 passed / 73 skipped. That is exactly `70e33298` plus the new spec's 23
      tests, with the same 10 inherited failures by name.
    - Resource: 635/635 with the `on_task_update_rpc_timeout` gate.
- **Real Chrome** (headless system Chrome, 1440x900, the local preview): all six scenarios pass, with no console
  errors or warnings.
  - Bar, then Yuval inside the fade: Yuval is shown, and Bar never reached the stage.
  - The automatic end-of-story fade, then Aviv: only Aviv reached the stage.
  - Bar, then reduced motion inside the fade, then Aviv: Bar finished without motion, then Aviv stayed.
  - Pause mid-flight: the flight held its time for 900 ms, resumed, and landed.
  - Reduced motion mid-flight: the flight stopped and every sticker landed. It stayed landed when motion returned.
  - Scrolled away mid-flight: the flight was held, and resumed on return.
- **Not verified:**
  - Reduced motion was switched with CDP media emulation, which fires the page's `matchMedia` change. The Windows
    setting itself was not changed.
  - There was no Safari/iOS, screen-reader or hidden-tab run.
  - The unmount behaviour is proven by the modelled-hook test only.

## QA integration proposal (scoped; not ready until the gaps close)

The line from the QA tip `a0835b72` to this branch is 47 commits. Nothing in it can be dropped cleanly.
`45b9e754` adds `/dev/personal-product` itself, so the landing preview depends on the writer pilot.
The proposal is one fast-forward of the QA branch (or an integration branch of Codex's choosing) to this branch's
head. It moves only after every range below is covered.

| Range | What | Review |
| --- | --- | --- |
| `a0835b72..713017e1` | 2 docs commits (site deployment and trial records) | Docs only; no verdict recorded |
| `713017e1..8aa9f1d7` | Prototype P1 + P2 | Codex HOLD; corrected in the next two rows |
| `8aa9f1d7..cbe09b31` | QA correction batch (to `1a22af62`) and voice-first rework | Codex QA at `cbe09b31` of both: PASS (P2 1, fixed in `04546f4a`) |
| `cbe09b31..7996e632` | That P2 fix | Codex PASS |
| `7996e632..4b6bb761` | v1 trial record and v2 | Codex HOLD (P1 1, P2 2); corrected below |
| `4b6bb761..684d2c10` | Quieter start screen, decoding animation | Codex UI PASS (P2 1, fixed in `fc587266`) |
| `684d2c10..7086b0f0` | HOLD correction | Codex re-gate HOLD (P1 1); fixed in `cbda44b8` |
| `7086b0f0..d05faeab` | Stale-fact fix | Codex PASS |
| `d05faeab..8ce1784c` | Docs | Codex docs closeout PASS |
| `8ce1784c..fd2b26bd` | Reduced-motion fix | Codex PASS (2026-09-29) |
| `fd2b26bd..45b9e754` | **Codex's writer pilot and the preview route** | **Open: Claude's independent review** |
| `45b9e754..77f6d430` | Recording information | Codex PASS |
| `77f6d430..41eba860` | Docs record of that PASS | Docs only |
| `41eba860..cdf5938b` | Round 2 (one "how it works") | **Open: Codex re-gate** |
| `cdf5938b..c0827427` | The living-story hero | Codex HOLD (P2 2); corrected below |
| `c0827427..` this documentation commit | **The correction** | **Open: Codex re-gate** |

Before the move:
1. The three open reviews close.
2. The correction is pushed to this branch. That is Guy's call; it is local now.
3. A full check runs at the final head, and it is base-identical or better.
4. Guy approves the move and the two environment switches.

The live-intake, story-writer and book-runner flags stay off. Codex's engine branch
(`codex/personal-book-storyboard-bridge`) is a separate line and is not part of this proposal.

## Asks for Codex

1. **Technical re-gate** of the corrective range `c0827427..` this documentation commit (P2-1, P2-2), and the
   round-2 re-gate `41eba860..cdf5938b` if it is still open.
2. **How and when the line reaches QA**, using the proposal above. Weigh it against the wizard-engine integration
   you have in flight and any live trials on QA. Claude still owes the independent review of `45b9e754`.
3. **The QA environment switches**, with Guy approving the change: `ALLOW_STAGING_QA=true` and
   `PERSONAL_WIZARD_PREVIEW=true`. The live-intake and story-writer flags stay off unless approved separately.
4. **After any move,** report the deployment that `qa.smallheroes.co.il` serves (`get_deployment`).

There were no paid calls, and nothing on main or production changed.
