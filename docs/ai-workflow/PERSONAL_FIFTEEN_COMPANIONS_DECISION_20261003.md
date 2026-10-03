# Fifteen personal companions: identity, sheets, engine and carousel

Status: planning / owner decision required before asset production or runtime edits.
Date: 2026-10-03. Technical owner: Codex. Independent QA: Claude Code.

## 1. Proposed change

Expand the personal product from six to fifteen companions in the existing soft
illustration style. Each new companion needs a literary character profile,
canonical visual identity, six-view character sheets, and separate presentation
assets. The carousel is a presentation of those identities, not their authority.

Guy requested all nine supplied concepts, an animated carousel, and character
sheets with the characterisation connected to the engine. This records product
intent, not approval of final pixels, a large paid batch, push or deployment.

Source: `C:/Users/guyna/Downloads/smallheroes-nine-new-companions-he-20261003.md`.
SHA-256: `449f546861e3478d81e07bce8a458069937f8f2dcc58834f13169f6197bb7f82`.
The supplied file contains textual concepts; no concept-board image was supplied.

| Proposed ID | Name | Gender | Visual locks requiring explicit review |
| --- | --- | --- | --- |
| elephant_momo | מומו הפילון | male | Four feet, short trunk, no tusks, one coral neck scarf |
| turtle_tuk | טוק הצבון | male | Four legs, fixed shell pattern, one mustard ribbon |
| hedgehog_tuti | תותי הקיפודה | female | Rounded plum spines, cream face and belly |
| owl_shush | שוש הינשופה | female | Two short wings, two small tufts, fixed face pattern |
| penguin_pipa | פיפה הפינגווינית | female | Two wings, two feet, one dusty-pink neck ribbon |
| octopus_nula | נולה התמנונה | female | Eight arms, no human torso, fixed suction pattern |
| firefly_zohar | זוהר הגחלילית | female | Six limbs, two antennae, fixed wings, steady light |
| otter_yuli | יולי הלוטרה | female | Smooth long tail; optional wristband must become one fixed decision |
| cloud_puf | פוף העננון | male | Three main lobes, two side paws, low hover, stable silhouette |

These are new identities. Do not alias them onto similarly named legacy animals
or `butterfly_zohar`. Names, Hebrew pronunciation and gender must remain bound
to the same ID in selection, writing, editing, QA and illustration.

## 2. Why now?

A broader cast creates curiosity and choice. Cards alone would misrepresent
readiness: the current personal roster has six IDs, the new writer requires
structured character profiles, and the personal landing still derives its cards
from the legacy six-category matrix. There are no nine new idle-video assets.

Observed roots, both clean at investigation:

- Engine: `C:/Users/guyna/.codex/worktrees/personal-story-product/Small_Heroes`,
  `codex/personal-book-storyboard-bridge`, `8e9bf300`.
- Site QA: `C:/Users/guyna/.codex/worktrees/personal-site-qa/Small_Heroes`,
  `codex/personal-site-qa-integration-20260930`, `5fe73b3f`.

The site QA writer still uses legacy deep profiles / tagline fallback. The engine
writer requires `personal-companion-character/v3` and a character digest. Adding
only site cards or only legacy profiles would not connect the new engine.

## 3. Scope and implementation order

General companion expansion; no story-specific patch or new fixed plots.

1. Author pending structured profiles and visual specifications for all nine.
   Preserve independent wants, contradictions, voice, humour, useful abilities,
   limits and child agency. Any companion may accompany any supported topic,
   including no specific difficulty. No mandatory catchphrase or moral lesson.
2. Produce a one-character visual pilot, proposed Momo: front and 3/4 view only,
   matching the existing approved six. Guy reviews the identity and consistency.
3. After pilot acceptance and a separate batch budget, produce the remaining
   identities and their six-view packs, using each accepted front as reference.
   Review Nula, Zohar and Puf explicitly for non-human anatomy and silhouette.
4. Connect canonical IDs/profiles/assets to personal selection, request admission,
   writing and storyboard. Separately port the necessary reviewed engine seam
   into site QA; do not merge the whole engine branch incidentally.
5. Build the personal carousel and all-friends view from personal companion data,
   not challenge-category slots. Preserve selection by companion ID. Validate,
   commit locally, and hand off immutable ranges to Claude Code.

Each character pack includes:

- A machine-readable literary profile, including pronunciation and gender.
- A visual specification: palette, proportions, anatomy, markings, accessory
  location, scale anchors and abilities/limits. Animation may not change these.
- Six compatible sheet views: front, 3/4 front, side, back, happy and an expressive
  personality pose. Keep legacy filenames where required; the last pose does not
  permanently bind a personal companion to one emotional topic.
- A versioned manifest with file hashes, source/reference lineage and measured
  review status. Never mark a generated candidate as passed without that review.
- A separate card/cutout and animation asset, not used as an identity substitute.

Visibility, writing readiness and visual/render qualification are different
states. A missing profile or required asset must fail closed, not silently choose
an old companion or generic personality. Show concepts as concepts if needed;
do not offer an incomplete character as a working book choice.

## 4. Risk of hardcoding and UX recommendation

Reuse the existing six-view format and structured personal character contract.
Do not add nine bespoke prompt paths or infer anatomy from a human two-arm rule.
Preserve the original six definitions and the legacy public category matrix.

Proposed motion interpretation, still for Guy's acceptance:

- Landing: slow continuous card travel and gentle, unsynchronised idle gestures.
- Wizard: keep the row stable while choosing, with gentle character idle motion
  and manual navigation. This preserves the lively feel without moving a target
  under the parent's pointer. If automatic row travel is desired here too, stop
  it on interaction before selection; this needs an explicit UX decision.
- Provide an all-15 view, keyboard-accessible selection and a pause control.
  Pause on hover and keyboard focus; after keyboard focus, resume only explicitly.
  Respect reduced motion with stills; no sound autoplay or flashing light.

Reference: [W3C carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).
Load motion for visible cards, pause offscreen/background, and avoid fetching all
fifteen clips at startup. Duplicate looping cards must not create duplicate
keyboard controls or announcements. Animation must preserve character identity.

## 5. Likely files and integration seams

- `lib/companions.ts`: canonical IDs, names and visual identity / asset metadata.
- `lib/personal-wizard/companion-character.ts`: current literary authority.
- `lib/personal-wizard/options.ts`, request acceptance and roster-dependent tests.
- `app/dev/personal-product/page.tsx`, personal landing card data/component,
  `content/personal-landing.ts`, and `StepCompanion.tsx`.
- `lib/web/companion-idle-video.ts`: explicit assets and visible-only loading.
- Sheet manifests/assets and bounded sheet-generation validation; compatibility
  review of accessory/presence/view recognisers only where actual callers need it.
- `next.config.js`: inspect packaged asset growth, not a blanket routing change.

Current personal landing uses category keys and legacy category-art overrides;
both must be decoupled for personal cards. Preserve `?companion=ID`, not the old
spotlight's `/wizard?category=...` navigation. A roster change alters the options
fingerprint; old paid evidence stays frozen and must not be relabelled current.

## 6. Expected behavior

The selected companion has the same name, personality, appearance, abilities and
body structure throughout the personal book. The child remains the protagonist;
the friend has wants and contributes, rather than solving the child's difficulty.
The fifteen choices remain independent of topic. A carousel is not evidence that
all fifteen are qualified for image production or that the full book is ready.

## 7. Validation plan

Smallest visual test: one accepted front plus one reference-bound alternate view,
before a nine-character batch. No book render in this milestone.

Technical tests must cover all fifteen IDs, topic and no-topic selection, fixed
name/gender, missing asset/profile rejection, retained selection, fingerprint
drift, and the actual request-to-writer-to-editor-to-storyboard identity boundary.
Do not replace frozen six-case experimental cohorts with fifteen or expand their
spending caps. Check sheets against the existing qualification boundary: six
required views, matching manifest and per-page resemblance at least 0.70.

Browser checks: mobile and desktop, RTL, all-15 view, keyboard radio semantics,
pause/focus/reduced-motion, no offscreen playback, and no legacy category artwork
or topic redirection. Run tsc and focused tests per code milestone; report the
full stability gate separately, without calling inherited RED release-ready.

## 8. Cost impact

Investigation and this plan: no provider calls, images or charges.
Nine complete six-view packs mean 54 sheet images, before retries, presentation
cutouts or nine possible motion clips. The existing generator permits retries;
a bulk run must instead have an explicit call limit and shared spending ceiling.

Pilot proposed: at most two LOW-tier image generations, no automatic retries,
no video generation, no HIGH production images. No dollar estimate or paid
approval is claimed here. Choose and price the generation path before dispatch.
The earlier unapproved $12 text-calibration proposal is separate and unused.

## 9. Rollback

Keep new assets and profiles versioned/pending until acceptance. Activate the
personal roster/carousel in a separate focused commit. Revert that activation to
the original six without deleting accepted assets or rewriting saved requests.
Preserve all historical outputs and review evidence. No legacy ID reassignment.

## 10. Review assignment and decisions

Guy: accept the pilot direction and bounded generation allowance; review Momo's
front/alternate view, then approve identities and the separately priced batch.
Confirm landing automatic / wizard stable motion and Yuli's accessory choice
before their respective runtime/identity commits. No deployment implied.

Codex: implement in milestone-scoped work, one writer per checkout. Claude Code:
attempt to falsify identity binding, missing-readiness rejection, category
independence, fingerprint handling, compatibility, animation controls and visual
manifest claims. Technical QA does not replace Guy's creative acceptance.

Claude Cowork consultation is optional for visual differentiation and the
comparison experience; the supplied GPT concepts remain product input, not
independent engineering evidence.

## 11. Do not do / stop-check

This touches companion identity, sheets, prompts and production-facing selection,
so the major-action stop applies. Required next decision is bounded pilot asset
production; runtime and bulk generation have not started.

Do not: run a 54-image batch, retry unboundedly, auto-publish generated identities,
lower the 0.70 resemblance gate, treat a file-existence check as visual approval,
render a full book, change the Opus author/fresh Opus editor/Astra QA order,
rewrite historical evidence, push/deploy, replace the existing six, or migrate
the entire unreviewed engine branch as part of carousel work.
