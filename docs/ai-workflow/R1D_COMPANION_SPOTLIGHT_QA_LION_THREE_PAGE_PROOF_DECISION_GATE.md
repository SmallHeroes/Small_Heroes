# R1D Companion Spotlight QA + Leo three-page proof — Decision Gate

## 1. Proposed change

Integrate only the final Companion Spotlight unit from Claude's divergent UI
branch onto the current autonomous-story/Wizard QA head. Deploy the combined
branch to QA, verify the customer Wizard path, then run one bounded three-page
LOW image proof for the Leo adventure slot with the magical-fairy narration
selection bound to the book request.

## 2. Why now?

Claude's popup is not present on the QA deployment that contains the new 18
story corpus. The source branch also predates the current story/Wizard cutover.
The first popup asset layout exceeded Vercel's function-bundle ceiling; its
final commit corrected that by moving six compressed transparent cutouts to a
marketing/CDN path. Guy wants the integrated QA experience proven before he
creates a complete book.

## 3. Scope

- General UI integration for all six companions.
- QA-only Wizard and three-page render measurement.
- No story-, child- or page-specific production patch.

## 4. Risk of hardcoding

The popup derives the companion cutout slug and Wizard category from the MVP
Matrix payload. Tests must cover all six configured companions and reject
missing assets. Leo is only the selected bounded proof slot; shared generation
logic is unchanged.

## 5. Files likely affected

- `app/category-challenge-card.tsx`
- `app/landing/landing-page.tsx`
- `app/components/CompanionSpotlight.tsx`
- `app/components/companion-spotlight.module.css`
- `public/Images/spotlight/*.png`
- focused UI/asset contract tests
- `CURRENT.md` and implementation evidence

## 6. Expected behavior after change

Clicking any public home companion card opens an accessible modal containing a
transparent approved companion cutout. Close, Escape and backdrop restore
focus. The CTA opens the proven Wizard with the same category selected. QA
continues to expose the 18 autonomous story slots; Production remains on its
existing deployment and story bank.

The Leo adventure proof binds the QA story candidate, magical-fairy voice,
LOW quality and exactly the first three illustration pages. It grants no
full-book or Production authority.

## 7. Validation plan

1. Focused static/component contracts for all six assets, CTA and modal guards.
2. TypeScript, `git diff --check`, focused Wizard/Matrix tests and one literal
   repository gate if the implementation surface requires it.
3. Vercel Preview build plus real-browser home popup and Wizard walkthrough.
4. Canonical readiness/preflight required by the existing render path.
5. Exactly three LOW page images; stop before any fourth page.

## 8. Cost impact

At most three `gpt-image-2` LOW image generations plus only the provider work
that the existing canonical three-page path proves necessary. No full book,
HIGH image, Vision, audio generation, real payment or Production spend. Record
actual usage/cost from receipts.

## 9. Rollback plan

Reassign `qa.smallheroes.co.il` to deployment
`dpl_3r5aFVGAxHfXCZLV7iSED97JLvrE`, the last proven autonomous-story QA build.
The UI integration is one focused commit and can be reverted without touching
the QA story bank. Generated proof artifacts remain immutable local evidence.

## 10. Review assignment

Guy has explicitly selected the popup integration and the Leo/fairy/three-page
proof. Claude Code must later falsify asset isolation, all-six generality,
accessibility/route behavior, current story-bank preservation, bounded cost and
Production isolation. Guy visually judges the popup and three rendered pages.

## 11. Do not do

Do not import Claude's rejected full-home redesign. Do not alter story prose,
prompt/model/budgets, resemblance floor, payment behavior, Production bank or
Production deployment. Do not generate a fourth page, a full book, HIGH
images, Vision results or narration audio in this proof.
