# Wiring Taxonomy v2 — branching categories + tone + follow-up questions

**Branch:** cut `feat/branching-categories` from `feat/companion-in-story`.

## Preflight — read before writing any code

1. `lib/companions.ts` — already expanded to 46 companions across 11 categories. Consume it, do not re-seed.
2. `public/JS/companions.js` — client mirror of the above. Do not diverge.
3. `lib/categoryBranching.ts` — **single source of truth** for domains, follow-up questions, story directions, tone. Do not rewrite. Import from it.
4. `lib/orderMeta.ts` — `_wizard` namespace already handles `challengeCategory` + `companionCharacterId`.
5. `app/api/story-directions/route.ts:225–279` and `app/api/generate/route.ts:312–315` — existing plumbing where `wizardMeta.challengeCategory` is read. Ride on it, don't replace.
6. `backend/providers/pipeline.ts:519–530` — current `companionBlock`. Your tone/direction injection goes next to this block.

## Scope — do NOT touch

Reader-v2, Layout A, palette map, RTL typography, `lib/character-lock.ts`, `lib/payme.ts`, Stripe webhook, companion anchoring + `input_images` wiring, placeholder files under `public/companions/**`. If you find yourself editing these, stop and flag.

## Goal (one sentence)

Two users who pick different categories must receive different follow-up questions, different story directions, and a story whose tone and illustration mood were actually shaped by their category.

---

## Work items

### 1. Topics — add 3 new, rename 5 labels

**`public/JS/content.js`** ~line 323, replace `topics: [...]`:

```js
topics: [
  { id: 'night',         label: 'פחדים בלילה'       },
  { id: 'sirens',        label: 'קולות ואזעקות'      },
  { id: 'general_fears', label: 'פחדים אחרים'        }, // NEW
  { id: 'anger',         label: 'כעס ותסכול'         }, // NEW
  { id: 'sensitivity',   label: 'רגישות ועומס רגשי'  }, // NEW
  { id: 'social',        label: 'חברויות ומפגשים'    },
  { id: 'confidence',    label: 'ביטחון וערך עצמי'   },
  { id: 'sibling',       label: 'אח או אחות חדשים'   },
  { id: 'transition',    label: 'מעברים גדולים'      },
  { id: 'focus',         label: 'קשב, סקרנות ולמידה' },
  { id: 'other',         label: 'נושא אחר'           },
],
```

### 1b. Topic → category map

**`public/JS/wizard.js`** ~line 268:

```js
const TOPIC_TO_CHALLENGE_CATEGORY = {
  sirens:        'NOISE_FEAR',
  night:         'NIGHT_FEAR',
  general_fears: 'GENERAL_FEARS',         // NEW
  anger:         'ANGER_FRUSTRATION',     // NEW
  sensitivity:   'SENSITIVITY_OVERWHELM', // NEW
  transition:    'TRANSITION',
  sibling:       'NEW_SIBLING',
  confidence:    'SELF_CONFIDENCE',
  social:        'SOCIAL',
  focus:         'FOCUS_LEARNING',
  other:         'OTHER',
};
```

### 1c. Group topics by emotional domain in the wizard UI

**`public/HTML/wizard.html`** (topics grid step): render 5 Hebrew section headers (from `DOMAIN_LABELS_HE` in `lib/categoryBranching.ts`), topic cards under each. `other` sits as its own de-emphasized row below the 5 groups.

Mapping:
- **פחדים וחרדות** → `night`, `sirens`, `general_fears`
- **ויסות רגשי** → `anger`, `sensitivity`
- **שייכות וקשרים** → `social`, `confidence`
- **שינויי חיים** → `sibling`, `transition`
- **קשב ולמידה** → `focus`
- *(ungrouped)* → `other`

Generate the grouping in `wizard.js` from a CATEGORY→DOMAIN table (copy from `emotionalDomain` field in `lib/categoryBranching.ts`, mark `// DO NOT EDIT — mirror of lib/categoryBranching.ts`).

### 2. New API endpoint — `app/api/categories/branch/route.ts`

(See full implementation in repository.)

**Server-only:** `psychologicalMeaning` and `storyDirections[i].promptHint` never go to the browser. Filter them out.

### 3. Follow-up questions — new wizard sub-step

Insert a step **after** category selection, **before** child traits.

- On topic pick: `fetch('/api/categories/branch?category=' + state.challengeCategory)`, cache on `state.categoryBranching`.
- Render 3–5 `followUpQuestions` as short Hebrew fields. All optional — never block advancement.
- Collect into `state.categoryAnswers: Array<{ question, answer }>`.
- For `OTHER`: first question is free-text description (larger textarea).

Step header: `ספר/י לנו עוד קצת — כדי שהסיפור יתאים באמת`
Subtext: `אין תשובות נכונות — כל מה שתכתוב עוזר לנו לבנות את הסיפור סביב הילד/ה שלך.`

### 4. Persist `categoryAnswers` on the order

**`lib/orderMeta.ts`** — extend type + `getWizardMeta` defensive defaults.

**`app/api/orders/route.ts`** — accept `categoryAnswers` on POST, persist under `_wizard.categoryAnswers`.

**`public/JS/wizard.js`** — include `categoryAnswers: state.categoryAnswers || []` in submit payload.

### 5. Inject tone + direction hint into the LLM prompt

**`backend/providers/pipeline.ts`:** extend `StoryInput`, `categoryBlock` before `companionBlock`, thread fields in `app/api/story-directions` and `app/api/generate`.

### 6. Illustration pipeline — mood pass-through

Append `\n\nMood: ${branching.storyTone.illustrationMood}.` to per-page image prompt when category is present.

### 7. Review screen

Show `branching.hebrewLabel` + domain label; `X שאלות השלמה נענו` with expand toggle (not verbatim answers).

---

## Test checklist

(See user message for the 5 test cases and commit hygiene.)
