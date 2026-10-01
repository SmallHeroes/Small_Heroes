# Personal landing: say what it is, prove it, give the friends a character

2026-10-02, Claude Code, branch `claude/personal-landing-clarity-20261002` from `claude/personal-landing-wow` (87b0d196). Unpushed. Scope: the personal preview landing only (`/dev/personal-product`, which QA serves as its homepage). The public `/` is unchanged (checked in the rendered HTML).

## Source

Guy forwarded an external site audit (`smallheroes-site-audit-20261001`, written from one downscaled desktop screenshot, addressed to Claude). Its first priority: within the existing design, make the parent understand the product and see proof of its value before anything else. This branch does that priority. It does not redesign, change fonts, or change any product truth.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Hero headline | "להיכנס להרפתקה. / למצוא דרך גם כשקשה." (also the resilience H2 further down) | "ספר שנכתב במיוחד / לילד שלכם." |
| Hero text | development disclaimer first | adventure, humour, chosen friend and coping first, then "still in development: today you can try the introduction and read an example" |
| Actions | "להתנסות בהיכרות" + "איך זה עובד" | "מספרים לנו על הילד" (the public page's own step name) + "קוראים דוגמה" to the new example; the same primary label in header, how-it-works, gallery and footer |
| Facts under the actions | none in the WOW hero | ages 3 to 8, by voice, writing or choice, you approve every detail |
| New section after the hero | none | "איך פרט קטן הופך להרפתקה": Yuval's words from the hero, three of her details and what each became, and a hand-written excerpt beside her approved picture with Buni |
| What makes it his | five cards | three ideas, the rest are now shown by the example, the friends and trust |
| Friends | name only | one line of character per friend |
| Resilience | abstract card text, H2 repeated the hero | "גם למה שקשה יש מקום בסיפור" with a concrete moment on each card |
| FAQ | ten questions | plus "what do you get today" and "for what age", first |
| Closing | "העולם שלו. / הדרך שלו להמשיך." | "ההרפתקה שלו / מתחילה במה שתספרו." |
| Metadata proposal | title led with the brand | "ספר ילדים אישי שנכתב במיוחד לילד שלכם \| גיבורים קטנים" (the preview route itself stays noindex) |

## Truth and sources

- Ages 3 to 8: `PROTOTYPE_AGE_MIN` / `PROTOTYPE_AGE_MAX` (`lib/personal-wizard/contract.ts`), pinned by the new spec.
- The example is hand-written and labelled "דוגמה ספרותית שכתבנו בעצמנו ... ואינה טקסט שהמנוע כתב". Its parent lines equal the hero's Yuval lines and its picture is her approved hero beat (both pinned). The child acts (holds Buni's paw) and the fear is not promised away.
- Friend lines paraphrase what the personal writer uses: `DEEP_PROFILES` for Dini, Anat, Uri and Kim; for Leo and Buni, which have no deep profile, the topic-free authoring cards (`story-pipeline/03_story_briefs/companion-authoring-cards.json`, status `staging_only`). No line ties a friend to a difficulty (pinned).
- Development status is stated in the hero, the new FAQ answer and the closing, as before.

## Deliberately not changed (for Guy)

- Section order. The audit suggests resilience before the friends, and lengths before trust and the team. The sky-to-dark-room background is tuned to the current order, so only the example was inserted.
- Creator biographies: the spec says keep them unchanged; the audit suggests shortening them on the home page.
- The open-book section still shows its spread as a picture; the audit asks for readable text beside it.
- No link to a full example story: none exists that is approved.
- No format line (printed / digital / narrated): not decided.
- Typography hierarchy, SEO technical checks, performance and accessibility measurements from the audit's later priorities.

## Verification

- `npx tsc --noEmit` clean. Three new cases at the end of `lib/personal-wizard/__tests__/story-writer.spec.ts`, where the personal landing's tests already live (a new spec file would change the exact count pinned by `vitest-workload-classifier.spec.ts`, which the QA branch also edits). The hero assertion there now checks the new headline, the coping words and the development disclosure.
- `npm run check`: the only failures are the ten known fixture-dependent ones in six files that also fail on an untouched commit (story read-back, visual-direction lifecycle, reserved-page placement, koko momentum, page-entity QA, child lexicon).
- Rendered locally with placeholder settings at 1440x900 and 390x844 after scrolling every reveal: headline on two lines on both, no horizontal scroll, the example stacks on phones.
