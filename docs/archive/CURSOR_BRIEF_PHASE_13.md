# Phase 13 — UX & Copy Refinements (Wizard + Landing)

## Context

Phase 12 fixed 6 critical bugs that were blocking conversion. Phase 13 raises the UX quality bar: clearer copy, better information architecture, no theatrical inputs. **No backend changes. No pipeline changes. No new features.**

CTO decision: wizard stays at 13 steps (per founder). The goal is making each step land emotionally and visually, and connecting parent inputs to the actual story output (Option B from prior discussion).

This brief covers **5 changes**, each independent. Implement in order; each can ship as its own commit.

---

## Change 1 — Add emojis to topic chips (Step 2)

**Symptom:** On Step 2 ("מה הכי קשה לו לאחרונה?"), the 12 topic chips have NO emojis, while every other chip-based step in the wizard DOES (traits, difficulties, goals, helpers, avoid). This step is the most important selection in the entire wizard — it deserves visual cues.

**Fix — `public/JS/content.js`:**

Find the `wizard.topics` array (around line 302):

```javascript
topics: [
  { id: 'night',         label: 'פחדים בלילה'            },
  { id: 'sirens',        label: 'קולות ואזעקות'         },
  { id: 'general_fears', label: 'פחדים אחרים'            },
  { id: 'anger',         label: 'כעס ותסכול'            },
  { id: 'sensitivity',   label: 'רגישות ועומס רגשי'     },
  { id: 'social',        label: 'חברויות ומפגשים'        },
  { id: 'confidence',    label: 'ביטחון וערך עצמי'      },
  { id: 'sibling',       label: 'אח או אחות חדשים'      },
  { id: 'transition',    label: 'מעברים גדולים'         },
  { id: 'focus',         label: 'קשב, סקרנות ולמידה'   },
  { id: 'medical',       label: 'טיפולים רפואיים'       },
  { id: 'other',         label: 'נושא אחר'              },
],
```

**Replace with:**

```javascript
topics: [
  { id: 'night',         label: '🌙 פחדים בלילה'            },
  { id: 'sirens',        label: '💥 קולות ואזעקות'         },
  { id: 'general_fears', label: '🌊 פחדים אחרים'            },
  { id: 'anger',         label: '⚡ כעס ותסכול'            },
  { id: 'sensitivity',   label: '🌿 רגישות ועומס רגשי'     },
  { id: 'social',        label: '🤝 חברויות ומפגשים'        },
  { id: 'confidence',    label: '🌟 ביטחון וערך עצמי'      },
  { id: 'sibling',       label: '👶 אח או אחות חדשים'      },
  { id: 'transition',    label: '🌱 מעברים גדולים'         },
  { id: 'focus',         label: '🦋 קשב, סקרנות ולמידה'   },
  { id: 'medical',       label: '🩹 טיפולים רפואיים'       },
  { id: 'other',         label: '✏️ נושא אחר'              },
],
```

**Verify** the chip rendering code already handles emojis as part of the label (it does in other steps — same template).

---

## Change 2 — Rephrase Step 6 (Superpower) and Step 8 (Goals)

**Step 6 (Superpower) — current copy:**

```javascript
s4power: {
  title:            'במה הילד שלכם חזק במיוחד?',
  sub:              'בחרו מהכוחות שמתאימים לו/ה — אפשר יותר מאחד.',
  ...
}
```

The title is OK but generic. The chip values say "כוחות" (powers) which feels clinical.

**Fix — `public/JS/content.js`:**

Update Step 6 (`s4power`):

```javascript
s4power: {
  title:            'מה גורם לו/ה לזרוח?',
  sub:              'הדברים האלה יהפכו לכוחות העל של הדמות בסיפור',
  extraLabel:       'יש עוד משהו מיוחד שבו/ה?',
  extraPlaceholder: 'כתבו במילים שלכם (לא חובה)',
},
```

**Step 8 (Goals) — current copy:**

```javascript
s5: {
  title: 'לאן הייתם רוצים שהסיפור יוביל אותו/ה?',
  sub:   'אפשר לחלום — הסיפור יאסוף את זה',
  sub2:  'אפשר לבחור יותר מאחד',
},
```

The phrase "לאן הייתם רוצים שהסיפור יוביל" is meta-literary — parent thinking like an author, not like a parent.

**Fix — `public/JS/content.js`:**

Update Step 8 (`s5`):

```javascript
s5: {
  title: 'איך הייתם רוצים שירגיש בסוף הסיפור?',
  sub:   'בחרו את התחושה שאתם רוצים שיישאר איתה',
  sub2:  'אפשר לבחור יותר מאחד',
},
```

**No JS or HTML changes needed** — these are content.js only.

---

## Change 3 — Split Step 11 (Package & Style) into two screens

**Symptom:** Step 11 currently asks the parent to decide direction + style + addons + voice + sleep mode — five distinct decisions on one screen. Cognitive overload right before checkout.

**Decision:** Split into two logical steps:

- **Step 11a — "מבנה הספר"**: Direction + Style
- **Step 11b — "שדרוגים"**: Addons + Voice + Sleep mode

This changes wizard from 13 steps to 14. The progress bar adjusts automatically (it reads from `state.totalSteps` or similar).

**Important constraint:** The `state` shape and the `buildWizardPayload()` output must remain unchanged. Only the rendering splits — the data model is the same.

**Implementation approach:**

Look at the existing Step 11 rendering in `public/JS/wizard.js` (search for `s8` step references — it's the wizard step ID `s8` corresponding to Step 11 in the user-visible numbering).

Wrap the existing render into two functions:
- `renderStep11a()` — direction + style only
- `renderStep11b()` — addons + voice + sleep

Update the step navigation:
- `state.currentStep` numbering shifts by 1 for steps after 11
- Step 12 (book name) becomes step 13
- Step 13 (summary) becomes step 14
- Update `WIZ.progressLabel` references to use total of 14

**Content additions — `public/JS/content.js`:**

In `WIZ.steps`, add a new step entry `s8a` and rename existing `s8` to `s8b` (or alternatively, split inline):

```javascript
s8a: {
  title:          'איך תרצו שהספר ייראה?',
  sub:            'הכיוון קובע את האווירה והאורך. הסגנון קובע את הוויזואל.',
  directionTitle: 'סוג הסיפור והיקף',
  styleLabel:     'סגנון האיורים',
},
s8b: {
  title:          'שדרוגים — להפוך את החוויה ליותר',
  sub:            'הכל אופציונלי. אפשר לדלג ולחזור בעתיד.',
  addonsExpanded: 'הפכו את הסיפור לחוויה מלאה',
  addonsCollapsed:'רוצים לשדרג?',
  addonsSub:      '*בתוספת תשלום קטנה',
  totalLabel:     'סה"כ לתשלום:',
  audio:  { badge: 'הכי פופולרי',  name: 'קריינות (+₪19)', desc: 'הקראה אישית נעימה' },
  pdf:    { badge: 'מושלם כמתנה',  name: 'קובץ מוכן להדפסה (+₪19)', desc: 'קובץ מעוצב להדפסה' },
  video:  { badge: 'חדש!',       name: 'וידאו + קריינות (+₪29)',  desc: 'סיפור מוקרן עם הקראה אוטומטית' },
  bundle: { badge: 'חסכו ₪9',     name: 'וידאו + הדפסה (+₪39)',    desc: 'וידאו עם קריינות + קובץ להדפסה' },
  voiceTitle:   'בחירת קול לקריינות',
  voicePreview: 'האזן לדוגמה',
  sleep: { name: 'מותאם לשינה 🌙', desc: 'טון רגוע יותר, הפסקות ארוכות יותר' },
},
```

**HTML — `public/HTML/wizard.html`:**

The existing Step 11 HTML block (the one with `id="s8..."` elements) needs to be split into two `<section>` blocks, each toggled by `state.currentStep`. The simpler approach: keep one section, but show/hide the right half (addons + voice) based on a sub-step flag.

**Cheapest possible implementation:** add a `state.packageSubStep` boolean. When user clicks "ממשיכים" on Step 11a, set `state.packageSubStep = true` and re-render the same step, this time showing only the addons block. Click "ממשיכים" again → advances to Step 12.

This avoids touching the global step counter and keeps the data model identical. Discuss with Claude before implementing if anything is unclear.

**Recommendation:** start with the cheapest implementation (sub-step boolean), confirm it works end-to-end, then consider promoting to a real separate step if needed.

---

## Change 4 — Remove redundancy between Step 3 (Category Followup) and Step 9 (Helpers)

**Symptom:** Step 3 ("נעזור לסיפור להרגיש יותר שלו") asks 3 sub-questions per topic, ONE of which is "מה בדרך כלל עוזר לו להירגע?" with options like חיבוק, אור קטן, דיבור רגוע. Then Step 9 ("מה עוזר לו/ה להרגיש שלם/ה?") asks the SAME thing in different framing.

**CTO decision:** Keep BOTH steps, but DIFFERENTIATE the framing so the parent doesn't feel asked twice.

- **Step 3 (follow-up)** = situation-specific ("when this fear hits, what helps?")
- **Step 9 (helpers)** = general-life ("what makes them feel whole in general?")

**Fix — `public/JS/content.js`:**

Update Step 9 (`s6`):

```javascript
s6: {
  title:            'מעבר לרגעים הקשים — מה גורם לו/ה להרגיש שלם/ה ביומיום?',
  sub:              'דברים, אנשים, או רגעים שתמיד מחזירים אותו/ה אל עצמו/ה',
  sub2:             'אפשר לבחור יותר מאחד',
  extraLabel:       'יש עוד משהו שעוזר?',
  extraPlaceholder: 'גם "שיר ספציפי שאמא שרה" או "להריח את הסבתא" — זו תשובה מושלמת',
},
```

And update Step 3 (`categoryFollowup`) to make its scope clear:

```javascript
categoryFollowup: {
  title: 'בואו נצא לגעת בקושי הזה ספציפית',
  sub:   'מה קורה בדיוק כשהקושי הזה מגיע — אפשר תשובות קצרות',
},
```

This way the parent reads Step 3 as "specifically about THIS challenge" and Step 9 as "about life in general". No duplication felt.

---

## Change 5 — Topic chip ordering (sort by likely demand)

**Symptom:** The 12 topic chips appear in an essentially random order. Parents see "night fears" first (good), but then "sirens", "other fears", "anger" — which is OK but not optimal.

**Fix — reorder for highest-demand first.**

Update `wizard.topics` order in `content.js`:

```javascript
topics: [
  { id: 'night',         label: '🌙 פחדים בלילה'            },
  { id: 'sibling',       label: '👶 אח או אחות חדשים'      },
  { id: 'anger',         label: '⚡ כעס ותסכול'            },
  { id: 'confidence',    label: '🌟 ביטחון וערך עצמי'      },
  { id: 'transition',    label: '🌱 מעברים גדולים'         },
  { id: 'social',        label: '🤝 חברויות ומפגשים'        },
  { id: 'sensitivity',   label: '🌿 רגישות ועומס רגשי'     },
  { id: 'general_fears', label: '🌊 פחדים אחרים'            },
  { id: 'sirens',        label: '💥 קולות ואזעקות'         },
  { id: 'focus',         label: '🦋 קשב, סקרנות ולמידה'   },
  { id: 'medical',       label: '🩹 טיפולים רפואיים'       },
  { id: 'other',         label: '✏️ נושא אחר'              },
],
```

Reasoning: night fears, new sibling, anger, and confidence are the four most common parent searches. Medical and "other" should be last.

---

## What NOT to Change

- Do **NOT** add or remove wizard steps beyond the Step 11 sub-split.
- Do **NOT** modify the `state` shape or `buildWizardPayload()` output.
- Do **NOT** change emotional answer collection logic — those rows feed the summary and the payload.
- Do **NOT** modify backend or pipeline files.
- Do **NOT** restyle existing components — only add chips/copy and the sub-step split.

---

## Testing Checklist

**Change 1 — Topic emojis:**
- [ ] Open wizard, reach Step 2. All 12 chips show an emoji prefix.
- [ ] Click a chip, advance, return back. State preserved correctly.

**Change 2 — Step 6 + 8 copy:**
- [ ] Step 6 title reads "מה גורם לו/ה לזרוח?".
- [ ] Step 8 title reads "איך הייתם רוצים שירגיש בסוף הסיפור?".

**Change 3 — Step 11 split:**
- [ ] Reach Step 11. First view shows direction + style only.
- [ ] Click "ממשיכים" → same step number, view changes to addons + voice.
- [ ] Click "ממשיכים" again → advances to book name (Step 12).
- [ ] Test "חזור" (back): from addons view goes back to direction/style view, not to Step 10.
- [ ] Test changing direction/style after seeing addons: the data flows correctly to summary.
- [ ] No regression: total price still correct on summary.

**Change 4 — Step 3 vs Step 9 copy:**
- [ ] Step 3 title now reads "בואו נצא לגעת בקושי הזה ספציפית".
- [ ] Step 9 title now reads "מעבר לרגעים הקשים — מה גורם לו/ה להרגיש שלם/ה ביומיום?".
- [ ] Parent can answer both without feeling redundant (qualitative check).

**Change 5 — Topic order:**
- [ ] Topics appear in the new order: night, sibling, anger, confidence, transition, social, sensitivity, general_fears, sirens, focus, medical, other.

**Regression check:**
- [ ] Full wizard end-to-end with realistic data → summary correct → checkout reachable.
- [ ] No console errors.

---

## Commit Plan

Five targeted commits:

```
feat(wizard): add emojis to topic chips for visual hierarchy
copy(wizard): rephrase superpower step ("what makes them shine") and goals step ("how should they feel at the end")
feat(wizard): split Step 11 into structure + upgrades sub-views
copy(wizard): differentiate follow-up vs helpers framing to remove perceived redundancy
chore(wizard): reorder topic chips by likely parent demand
```

---

## Files Touched (Summary)

| File | Changes |
|------|---------|
| `public/JS/content.js` | Topics emojis, Step 6 + 8 copy, Step 3 + 9 copy, topic order, Step 11 split content |
| `public/JS/wizard.js` | Step 11 sub-step logic |
| `public/HTML/wizard.html` | Possibly minor (depending on Step 11 split approach) |

**No backend files. No CSS unless minor adjustments for the sub-step view.**

---

## Out of Scope (Future Phases)

- Photo upload UX redesign — separate phase
- Landing page testimonials block — Phase 14 (Marketing)
- "About the founder" block — Phase 14
- Email capture / lead magnet — Phase 14
- Mobile-specific tuning beyond what existing breakpoints provide — Phase 15

This phase is **UX refinements only.** Keep the surface area small.
