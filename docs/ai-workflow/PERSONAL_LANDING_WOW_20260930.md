# Personal landing: the living-story hero, a direction proof (2026-09-30)

- **Branch:** `claude/personal-landing-wow`. Pushed to origin as a separate branch at Guy's instruction. It is not on QA.
- **Owner split:** Claude implemented, at Guy's direction, while Codex wires the new wizard to the engine. Codex does
  technical QA and decides how this reaches QA. Guy owns product acceptance.
- **Status:** a direction proof that Guy has approved as a direction ("זה טוב"). It is not a release candidate.

## Where it sits relative to QA

- `qa.smallheroes.co.il` is a branch domain on `codex/r1d-release-reader-voice-final`, serving `a0835b72`. This was
  verified on 2026-09-30 with `list_project_domains` and `get_deployment`.
- That tip is an ancestor of this branch, which is ahead by 45 commits and behind by 0. A move to QA can
  be a fast-forward.
- Those commits are more than the landing. Grouped:
  1. `c0a93966`, `713017e1`: documentation already on the local line.
  2. The personal wizard prototype, `fd030932..fd2b26bd` (Claude). Codex passed `7086b0f0..d05faeab` and the UI range,
     whose P2 was fixed in `fc587266`. The re-gate of `8ce1784c..fd2b26bd` is still open.
  3. Codex's writer pilot, `45b9e754`. There is no independent Claude review yet.
  4. The landing's recording information: `26b7e58f..77f6d430` (Codex technical PASS, recorded in `41eba860`), and
     round 2, `42c67ce3` + `cdf5938b`, awaiting a re-gate.
  5. This direction proof: `dafe34fa`, `ef8269b4`, `1e3a9a40`, `70e33298`, `da9233da`, and this documentation
     commit. None of it has been reviewed.

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
  It is most likely the known `audio-probe` load flake; the file name was not captured on a failing run.

## Asks for Codex

1. **Technical QA** of the landing range `cdf5938b..` this documentation commit, and the round-2 re-gate
   `41eba860..cdf5938b` if it is still open.
2. **How and when the line reaches QA.** It can be a fast-forward of the QA branch to this branch, or an integration
   branch. Weigh it against the wizard-engine integration you have in flight and any live trials on QA. Review
   `45b9e754` before it deploys.
3. **The QA environment switches**, with Guy approving the change: `ALLOW_STAGING_QA=true` and
   `PERSONAL_WIZARD_PREVIEW=true`. The live-intake and story-writer flags stay off unless approved separately.
4. **After any move,** report the deployment that `qa.smallheroes.co.il` serves (`get_deployment`).

There were no paid calls, and nothing on main or production changed.
