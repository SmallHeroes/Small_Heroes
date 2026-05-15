# Phase 14 — Personalization Layer (Patches + Companion Letter)

## Context

We have v3 foundation stories (one per `companion × direction`) working in production. To deliver true personalization across thousands of wizard input combinations, we need to layer **runtime personalization** on top of the locked foundation text.

This phase builds two new layers:

- **Layer 2 — Patches:** small `{{patch:X}}` slots inside story pages, filled at runtime by a fast LLM (Haiku/mini) based on wizard inputs.
- **Layer 3 — Companion Letter:** a fully LLM-generated 4-6 line letter from the companion to the child, inserted near the end of the book. Uses the companion's deep personality (speechPattern, humor, comfort ritual).

The story bank itself stays as-is. Foundation stories already in `story-bank/v3/` continue to work. **No data loss, no regression risk.** Personalization is additive.

Split this brief into **two ships**: Layer 2 first (less risky, contained), Layer 3 second (uses Layer 2's infra + adds image generation).

---

## Architectural Decisions

### File format additions

**Frontmatter** — optional new fields:
```yaml
---
title: "..."
companionId: dragon_dini
direction: bedtime
category: NEW_SIBLING
gender: male
pages: 10

companionLetter:
  insertAfterPage: 9
  imageDirection: "close_shot: dragon dini wrapping wing around glowworm, peach scales glowing warm gold, warm den light, soft."
---
```

If `companionLetter` is missing/null → story renders without a letter page. Backward compatible.

**Inline patches** inside any page body:
```markdown
--- Page 6 ---
{{childName}} מַבִּיט בְּ{{patch:treatment_object | medical_treatment | "name the medical thing in the child's life — 1-3 Hebrew words with nikud, e.g. 'הַגֶּבֶס הַלָּבָן' or 'הַכִּסֵּא הַגָּדוֹל'"}} שֶׁמִּתְקָרֵב לְאַט.
```

**Patch syntax:** `{{patch:name | sourceField | description}}`
- `name` — local identifier (for logging / debugging)
- `sourceField` — wizard data key (see "source field mapping" below)
- `description` — instruction passed to the LLM. Should specify length, format, language constraints.

Patches that don't have a matching wizard input fall back to **empty string** or a default-text alternative defined inline:
```
{{patch:treatment_object | medical_treatment | "..." | "הַמַּחַט הַקְּטַנְטֹנֶת"}}
```
(4th pipe-separated arg = fallback if no wizard data available)

### Source field mapping

These are the values available from the order/wizard state. The Brief uses these names — verify exact paths in `wizardData` shape:

| Source field name | Wizard origin | Example value |
|-------------------|--------------|---------------|
| `child_name` | `order.childName` | "אביב" |
| `child_age` | `order.childAge` | 5 |
| `child_gender` | `order.childGender` | "girl" |
| `medical_treatment` | first chip selected in `categoryAnswers["medical_treatment"]` | "🦴 שבר, גבס או תפרים" |
| `medical_timing` | first chip in `categoryAnswers["medical_timing"]` | "📅 לפני הטיפול" |
| `medical_fear` | first chip in `categoryAnswers["medical_fear"]` | "😖 הכאב עצמו" |
| `night_trigger` | similar for NIGHT_FEAR | "צללים שמופיעים בחדר" |
| `*_trigger` / `*_expression` / `*_support` | mapped per category | (each category has 3 chip groups) |
| `difficulties` | `order.difficulties` (array of label strings) | ["מפחד/ת להירדם לבד"] |
| `helpers` | `order.helpers` | ["אור קטן בלילה"] |
| `goals` | `order.goals` | ["נרדם/ת בשקט"] |
| `avoid` | `order.avoid` | ["דמויות מפחידות"] |
| `superpower` | `order.childSuperpower` (label strings) | ["לב טוב", "דמיון עשיר"] |

For chip-emoji values like "🦴 שבר, גבס או תפרים" — the LLM-facing description should clarify: "strip emoji prefix from the chip value before reasoning".

---

## Phase A — Layer 2: Patches (ship first)

### New file: `backend/providers/personalization.ts`

```typescript
import { callLLM } from './pipeline'; // existing LLM helper

const PATCH_REGEX = /\{\{patch:([^|}]+)\|([^|}]+)\|([^|}]+?)(?:\|([^}]+?))?\}\}/g;

export interface PatchContext {
  childName: string;
  childAge: number;
  childGender: 'boy' | 'girl' | 'other';
  categoryAnswers: Record<string, { selectedQuickAnswers?: string[]; answer?: string }>;
  difficulties: string[];
  helpers: string[];
  goals: string[];
  avoid: string[];
  superpower: string[];
}

/** Strip emoji + leading whitespace from a chip label. "🦴 שבר, גבס" → "שבר, גבס". */
function stripChipEmoji(chip: string): string {
  return chip.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\s]+/u, '').trim();
}

/** Look up the wizard value for a given sourceField. Returns null if not available. */
function resolveSourceField(field: string, ctx: PatchContext): string | null {
  // Direct child fields
  if (field === 'child_name') return ctx.childName || null;
  if (field === 'child_age') return ctx.childAge?.toString() || null;
  if (field === 'child_gender') return ctx.childGender || null;

  // Array fields — return first item
  if (field === 'difficulties') return ctx.difficulties[0] ? stripChipEmoji(ctx.difficulties[0]) : null;
  if (field === 'helpers') return ctx.helpers[0] ? stripChipEmoji(ctx.helpers[0]) : null;
  if (field === 'goals') return ctx.goals[0] ? stripChipEmoji(ctx.goals[0]) : null;
  if (field === 'avoid') return ctx.avoid[0] ? stripChipEmoji(ctx.avoid[0]) : null;
  if (field === 'superpower') return ctx.superpower[0] ? stripChipEmoji(ctx.superpower[0]) : null;

  // Followup chip groups — match by question ID
  const answer = ctx.categoryAnswers?.[field];
  if (answer?.selectedQuickAnswers?.length) {
    return stripChipEmoji(answer.selectedQuickAnswers[0]);
  }
  if (answer?.answer) return answer.answer.trim() || null;

  return null;
}

/** Apply all patches in a story text. Single LLM call per patch. */
export async function applyPersonalizationPatches(
  storyText: string,
  ctx: PatchContext,
): Promise<string> {
  const matches = [...storyText.matchAll(PATCH_REGEX)];
  if (matches.length === 0) return storyText;

  // Build resolutions in parallel
  const resolutions = await Promise.all(
    matches.map(async (match) => {
      const [full, name, sourceField, description, fallback] = match;
      const value = resolveSourceField(sourceField.trim(), ctx);

      if (!value) {
        // No wizard data — use fallback if available, else empty
        return { full, replacement: fallback?.trim() ?? '' };
      }

      // Build small LLM prompt for this slot
      const prompt = `Fill a single Hebrew slot in a children's storybook page.
Slot description: ${description.trim()}
The parent's selection from the wizard: "${value}"
Constraints:
- Output ONLY the Hebrew phrase that fills the slot, with full nikud.
- 1-5 Hebrew words.
- No commentary, no quotes, no English, no emoji.
- The phrase must flow grammatically into the surrounding sentence.
- Use the parent's selection as the source of truth.`;

      try {
        const result = await callLLM({
          model: process.env.PATCH_MODEL || 'gpt-4o-mini', // fast + cheap
          temperature: 0.3,
          maxTokens: 60,
          system: 'You fill Hebrew slots in children\'s storybook pages. Output only the Hebrew phrase with full nikud. No commentary.',
          user: prompt,
        });
        return { full, replacement: (result || '').trim() || fallback?.trim() || value };
      } catch (err) {
        console.warn(`[patch:${name}] LLM call failed, using fallback`, err);
        return { full, replacement: fallback?.trim() || value };
      }
    }),
  );

  // Replace inline
  let result = storyText;
  for (const { full, replacement } of resolutions) {
    result = result.replace(full, replacement);
  }
  return result;
}
```

### Integration point — `backend/providers/story-bank-loader.ts`

After gender swap (line ~376), BEFORE character DNA generation (line ~437):

```typescript
// After: const swappedPages = await maybeRunGenderSwap(...);
const ctx = buildPatchContext(order, wizardMeta); // helper to assemble PatchContext
const pagesWithPatches = await Promise.all(
  swappedPages.map((page) => applyPersonalizationPatches(page, ctx)),
);
// Then continue with pagesWithPatches instead of swappedPages
```

Add `buildPatchContext()` as a small helper in the same file or in `personalization.ts`.

### Story bank update — add patch slots to one existing story (pilot)

Pilot the pattern on `story-bank/v3/octopus_seara_bedtime.md`. Edit page 5 or 10 to include a meaningful patch:

```markdown
--- Page 5 ---
סַעֲרָה מַגְבִּיר. "אֲנִי! מְסַדֵּר! הַכֹּל!"
זְרוֹעָה עַל הַכָּרִית, זְרוֹעָה בַּשֵּׂעָר, זְרוֹעָה בַּשְּׂמִיכָה.
{{childName}} דּוֹחֵף אוֹתוֹ קָטָן. "דַּי! {{patch:difficulty_word | difficulties | "name the specific difficulty the child experiences — 2-5 Hebrew words with nikud, soft tone, e.g. 'אֲנִי לֹא רוֹצֶה לְהֵרָדֵם' or 'הָרֹאשׁ שֶׁלִּי רוֹעֵד'" | "הַזְּרוֹעוֹת שֶׁלְּךָ מַפְרִיעוֹת לִי"}}"
```

This proves the pipeline end-to-end without breaking the story.

### Logging

Every patch call should log:
```
[personalization] patch=difficulty_word source=difficulties value="מפחד/ת להירדם לבד" → "אֲנִי לֹא יָכוֹל לְהֵרָדֵם" (45ms)
```

This is critical for debugging in production.

### What NOT to do in Phase A

- Do NOT add `companionLetter` support yet — that's Phase B.
- Do NOT modify any existing story bank file beyond the pilot story (octopus_seara_bedtime.md).
- Do NOT touch the character DNA generation logic.
- Do NOT touch image generation.
- Do NOT remove `{{childName}}` substitution — that stays as-is. Patches are ADDITIVE.

### Testing Phase A

- [ ] Generate a book using octopus_seara_bedtime with wizard input that includes a difficulty selection.
- [ ] Confirm in logs: the patch was resolved by LLM.
- [ ] Read page 5 in the rendered book — the patch text reads naturally in Hebrew with nikud.
- [ ] Generate the same book with EMPTY difficulties → confirm fallback text is used.
- [ ] Generate a book using a story WITHOUT patches (any other v3 story) → confirm no regression.
- [ ] Confirm patch LLM call adds <2s to total generation time.

### Phase A Commits

```
feat(personalization): add Layer 2 patch system for runtime personalization
feat(story-bank): pilot patch slot on octopus_seara_bedtime.md page 5
```

After commits — `git push origin main` — verify SHA matches.

---

## Phase B — Layer 3: Companion Letter (ship second)

### New file: `lib/companion-deep-profiles.ts`

A typed registry of deep companion personality data, extracted from the prompt files. Used by Layer 3 LLM calls. **Only the 5 existing v3 companions need full data initially.** Others get default/empty placeholders that work, just less unique.

```typescript
export interface DeepProfile {
  companionId: string;
  speechPattern: string;        // Hebrew description
  speechExamples: string[];     // 2-3 short Hebrew quotes in companion's voice
  humorType: string;
  comfortRitual: string;        // Hebrew description, child can imitate
  bodyLanguageRelaxed: string;
  bodyLanguageStressed: string;
  internalRules: string[];      // "always X" / "never Y" — Hebrew
  copingStrategy: string;       // English short label
  sensoryWorld: string[];       // English keywords
}

export const DEEP_PROFILES: Record<string, DeepProfile> = {
  octopus_seara: {
    companionId: 'octopus_seara',
    speechPattern: "קצוץ, נפיץ, 3-5 מילים בהתרגשות. צועק 'נו!' 'שחרר!'. כשרגוע — לוחש.",
    speechExamples: ['"שָׁלֵט! אֲנִי שׁוֹלֵט!"', '"נו! לְשַׁחְרֵר!"', '"שָׁשׁ… שֶׁקֶט."'],
    humorType: "קומדיית גוף — הזרועות עושות הפוך מהפקודות, הדיו יוצא ברגע הלא נכון.",
    comfortRitual: "מסלסל את כל הזרועות לספירלה הדוקה, אחת אחת, עד ששקט.",
    bodyLanguageRelaxed: "זרועות מתולתלות בסדר, כובע ישר, צבע כחול רך.",
    bodyLanguageStressed: "זרועות פרועות לכל הכיוונים, כובע עקום, אדום-סגול מתחלף.",
    internalRules: [
      "תמיד מנסה לפתור לבד לפני שמבקש עזרה (ונכשל)",
      "אף פעם לא מודה שהוא פחד — רק ש'הדיו יצא בטעות'",
      "כשרגוע — לוחש, לא צועק",
    ],
    copingStrategy: 'CONTROL — grips harder, commands louder, over-controls until control breaks',
    sensoryWorld: ['suction and grip', 'ink clouds blooming', 'tight spaces', 'tentacle-tips reading texture'],
  },
  bat_lily: { /* TODO: extract from bat_lily prompt files */ },
  chameleon_koko: { /* TODO */ },
  dolphin_shahkan: { /* TODO */ },
  fawn_tzvi: { /* TODO */ },
  // Other 31 companions: use a permissive default until their deep profiles are written
};

const DEFAULT_PROFILE: DeepProfile = {
  companionId: 'unknown',
  speechPattern: 'חם, פשוט, בגובה הילד.',
  speechExamples: [],
  humorType: 'עדין, ילדי.',
  comfortRitual: 'נשימה חמה ועדינה, חיבוק רך.',
  bodyLanguageRelaxed: 'נוכח ורגוע.',
  bodyLanguageStressed: 'מתאמץ אך עדין.',
  internalRules: [],
  copingStrategy: 'PRESENCE',
  sensoryWorld: ['warmth', 'softness'],
};

export function getDeepProfile(companionId: string | null | undefined): DeepProfile {
  if (!companionId) return DEFAULT_PROFILE;
  return DEEP_PROFILES[companionId] ?? { ...DEFAULT_PROFILE, companionId };
}
```

### Letter generation — extend `backend/providers/personalization.ts`

```typescript
export interface LetterContext extends PatchContext {
  companionId: string;
  companionName: string;        // e.g., "סערה" or "דיני"
  direction: 'bedtime' | 'adventure' | 'fantasy';
  category: string;
}

export async function generateCompanionLetter(
  ctx: LetterContext,
): Promise<{ text: string }> {
  const profile = getDeepProfile(ctx.companionId);

  const childRef = ctx.childGender === 'girl' ? 'הִיא' : 'הוּא';
  const childFor = ctx.childGender === 'girl' ? 'לָהּ' : 'לוֹ';

  const difficultiesLine = ctx.difficulties.map(stripChipEmoji).slice(0, 2).join(', ');
  const helpersLine = ctx.helpers.map(stripChipEmoji).slice(0, 2).join(', ');
  const goalsLine = ctx.goals.map(stripChipEmoji).slice(0, 1).join(', ');
  const superpowerLine = ctx.superpower.map(stripChipEmoji).slice(0, 1).join(', ');

  const prompt = `Write a short personal letter, in Hebrew with full nikud, from the companion ${ctx.companionName} to the child ${ctx.childName} (age ${ctx.childAge}).

The letter appears on a single page near the end of an illustrated children's storybook. It must feel like the companion speaking aloud, NOT a generic note.

CONSTRAINTS:
- 4 to 6 sentences. Maximum 50 Hebrew words.
- Full nikud on every word.
- Must use the companion's distinct speech pattern: ${profile.speechPattern}
- Speech style examples to match: ${profile.speechExamples.join(' / ')}
- Must NOT explicitly say words like "אח", "אחות", "אהבה", or moralize. No therapy talk.
- Must NOT say "אתה אמיץ" or "אתה גדול". No bravery framing.
- Begin with the child's name vocatively. Address them directly.

WHAT THE CHILD IS GOING THROUGH (use as raw material, not literally):
- Difficulties: ${difficultiesLine || 'general challenges'}
- What helps them feel whole: ${helpersLine || '—'}
- The strength they have: ${superpowerLine || '—'}
- Where this story wants to lead: ${goalsLine || '—'}

THE LETTER MUST INCLUDE:
1. A tiny specific physical/sensory image (something the companion does or feels — using the companion's sensory world: ${profile.sensoryWorld.join(', ')}).
2. One reference to something the child is going through, in NON-LITERAL terms.
3. One promise of presence — that the companion will be there in some specific way.
4. End on a gentle, concrete, slightly open note. NOT a closure.

OUTPUT FORMAT:
Output ONLY the Hebrew text of the letter, line-broken naturally. No quotes around it. No commentary. No translations.`;

  const result = await callLLM({
    model: process.env.LETTER_MODEL || 'gpt-5.3-chat-latest', // higher quality for emotional moment
    temperature: 0.7,
    maxTokens: 250,
    system: 'You write personal Hebrew letters from a companion character to a child, with full nikud, in the companion\'s distinct voice. You output only the letter text — nothing else.',
    user: prompt,
  });

  return { text: (result || '').trim() };
}
```

### Integration — extend story-bank-loader.ts page assembly

After patches are applied, before returning pages:

```typescript
const letterMeta = storyFrontmatter.companionLetter;
if (letterMeta && letterMeta.insertAfterPage) {
  const letter = await generateCompanionLetter({ ...ctx, /* companion + direction */ });
  const letterPage = {
    pageNumber: letterMeta.insertAfterPage + 0.5, // sortable
    text: letter.text,
    imageDirection: letterMeta.imageDirection,
    isLetter: true, // for downstream handling (template, image gen)
  };
  pages.splice(letterMeta.insertAfterPage, 0, letterPage);
  // Renumber pages
  pages.forEach((p, i) => p.pageNumber = i + 1);
}
```

### Page count impact

Adding a letter page increases the book from N pages to N+1.

**Decision: the letter is a BONUS page included in the existing price.** No price change. The bedtime book becomes 11 pages (10 story + 1 letter), adventure becomes 16, fantasy 21. Marketing-wise: "and a personal letter from your companion."

**Database impact:** the `pages` field in `BookPage` table doesn't enforce a count — it stores whatever pages are inserted. The `GeneratedBook.totalPages` (if exists) should be updated to reflect actual count.

Verify with the Prisma schema before shipping.

### Image generation for the letter page

The letter page needs an image like any other page. Use:
- `imageDirection` from the frontmatter
- Companion DNA + child DNA from existing pipeline
- Standard prompt assembly

The letter page should feel **intimate** — close-up, calm composition, warm light. No action shot.

### Pilot story update

Add `companionLetter` block to `story-bank/v3/octopus_seara_bedtime.md`:

```yaml
---
title: "..."
companionId: octopus_seara
...

companionLetter:
  insertAfterPage: 14
  imageDirection: "close_shot: octopus seara cupping a small tentacle as if writing or whispering, blue calm coloring, hat straight, soft warm bedroom light, intimate composition"
---
```

### What NOT to do in Phase B

- Do NOT remove or modify existing story pages — only ADD the letter page.
- Do NOT change pricing logic or `storyDirection` → page-count mapping.
- Do NOT touch wizard UI.
- Do NOT generate letters for stories without `companionLetter` in frontmatter — strict opt-in.
- Do NOT cache letters across orders — each generation is unique to the child.

### Testing Phase B

- [ ] Generate a book using octopus_seara_bedtime → 11 pages instead of 10 → page 10 is the letter.
- [ ] Letter text is 4-6 lines, full nikud, in סערה's voice ("נו!" / "פּוּף" / lowered to whisper).
- [ ] Letter references the child's specific difficulty/helper without naming them functionally.
- [ ] Letter image generated successfully.
- [ ] Generate a book using a story WITHOUT `companionLetter` frontmatter → no letter page added.
- [ ] Letter LLM call adds <8s to total generation time.
- [ ] Reader displays the letter page like any other page (no layout break).
- [ ] PDF includes the letter page.
- [ ] Audio (if enabled) narrates the letter with the chosen voice.

### Phase B Commits

```
feat(personalization): add Layer 3 companion letter system
feat(companions): add deep personality registry for 5 v3 companions
feat(story-bank): add companionLetter frontmatter to octopus_seara_bedtime.md
```

After commits — `git push origin main` — verify SHA matches.

---

## Files Touched (Summary)

| File | Phase | Change |
|------|-------|--------|
| `backend/providers/personalization.ts` | A, B | NEW — patch + letter functions |
| `backend/providers/story-bank-loader.ts` | A, B | Insert patch + letter calls into pipeline |
| `lib/companion-deep-profiles.ts` | B | NEW — typed deep profile registry |
| `story-bank/v3/octopus_seara_bedtime.md` | A, B | Pilot patch slot + companionLetter frontmatter |
| `backend/schema.prisma` | B (only if needed) | Possibly relax page-count constraints |

**No frontend changes. No wizard changes. No CSS. No HTML.**

---

## Sequence

1. Ship Phase A (Patches). Confirm in production. ~3-5 days realistic with AI parallelism.
2. Ship Phase B (Letter). ~5-7 days.
3. After both ship — retrofit the other 4 v3 stories with patches + letter frontmatter (Claude does this during content authoring, no Cursor work needed).

---

## Out of Scope (Future)

- Multi-patch quality optimization (caching, batching across patches in one LLM call)
- Letter per direction tuning (different prompts for bedtime vs. fantasy)
- Letter A/B testing infrastructure
- Patch-level analytics (which patches fire most often)

This phase is **plumbing + pilot.** Quality tuning comes after we see it in production.
