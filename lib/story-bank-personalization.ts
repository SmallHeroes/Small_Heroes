/**
 * Story-bank personalization — gender chips, slashed forms, and pre-flight gate.
 */

export type WizardPersonalizationContext = {
  childName: string;
  childGender: 'boy' | 'girl' | 'other';
  companionName: string;
};

/** Hard-coded bank protagonist names that must never appear in a rendered book. */
export const BANK_PROTAGONIST_DENYLIST: readonly string[] = [
  'מיכל',
  'Michal',
  'נועה',
  'Noa',
  'נוֹעָה',
  'יוסי',
  'Yossi',
  'יעל',
  'Yael',
  'איתי',
  'Itai',
  'דני',
  'Dani',
  'מיה',
  'Mia',
  'עומר',
  'Omer',
  'שירה',
  'Shira',
  // 'אלה' removed — common Hebrew word for "these" causes false positives.
  // 'Ella' retained since English transliteration won't collide with Hebrew prose.
  'Ella',
  'תום',
  'Tom',
  // 'קים' / 'Kim' removed — chameleon_koko canonical companion name is 'קים'.
];

const UNRESOLVED_CHILD_NAME_RE = /\{\{childName\}\}/;
const UNRESOLVED_COMPANION_NAME_RE = /\{\{companionName\}\}/;
const UNRESOLVED_GENDER_CHIP_RE = /\{[^{}]+\|[^{}]+\}/;
// NOTE: cannot use \b after Hebrew letters — V8 regex \b doesn't recognize
// Hebrew word boundaries in Unicode mode. Lookahead matches end-of-string or
// any non-Hebrew character (whitespace, punctuation, ASCII).
const UNRESOLVED_SLASH_GENDER_RE =
  /[\u0590-\u05FF]+\/[\u0590-\u05FF]+(?=$|[^\u0590-\u05FF])/u;
const UNRESOLVED_PATCH_RE = /\{\{patch:/i;
const UNRESOLVED_AGE_BLOCK_RE = /\{\{#age\}\}/;

// Gendered Hebrew marker WORDS, matched via containsAsStandaloneToken (the working Hebrew boundary) — NEVER `\b`
// (V8 `\b` keys off ASCII `\w`, so `/\bהיא\b/u` matches NO Hebrew — it silently made this whole net dead). They are
// applied ONLY in a sentence that also contains the CHILD's name (see the gate), because a bare gendered word is just
// as likely another character (a mother = היא, a male baby dragon = הוא, a doctor) as a wrong-gender child.

/** Female child markers — a wrong-gender leak when the wizard gender is boy. */
const FEMALE_CHILD_MARKERS_BOY_FAIL: readonly string[] = [
  'היא', 'עיניה', 'כתפיה', 'ידיה', 'רגליה', 'בטנה', 'שלה', 'אליה',
  'שוכבת', 'מחזיקה', 'מסיטה', 'מסתכלת', 'מושכת', 'מושיטה', 'מחייכת', 'ישנה', 'נפתחת',
];

/** Male child markers — a wrong-gender leak when the wizard gender is girl. */
const MALE_CHILD_MARKERS_GIRL_FAIL: readonly string[] = [
  'הוא', 'עיניו', 'כתפיו', 'שלו', 'אליו',
  'שוכב', 'מחזיק', 'מסיט', 'מסתכל', 'מושך', 'מושיט', 'מחייך', 'ישן',
];


/** Escape regex metacharacters in literal strings. */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Test whether `name` appears in `text` as a standalone token — i.e. not
 * surrounded by other Hebrew letters, ASCII letters, or digits. Prevents the
 * substring false positive where the denied "דני" would otherwise flag a
 * legitimate customer name like "דניאל" or "תומר" → "תום".
 */
function containsAsStandaloneToken(text: string, name: string): boolean {
  const escaped = escapeRegexLiteral(name);
  // Word chars = Hebrew block + ASCII alphanumerics. Anything else (whitespace,
  // punctuation, line breaks, start/end of string) counts as a boundary.
  const re = new RegExp(
    `(?<![\\u0590-\\u05FFa-zA-Z0-9])${escaped}(?![\\u0590-\\u05FFa-zA-Z0-9])`,
    'u'
  );
  return re.test(text);
}

/**
 * Whether a wrong-gender marker is attributed to the CHILD — the child's name (a standalone token, and NOT the
 * possessor in a "של <name>" genitive) IMMEDIATELY followed by the marker (a standalone token). This attributes the
 * gendered form to the child AS THE SUBJECT, so another character elsewhere in the same sentence (a mother = היא, the
 * male fox = הוא, a female friend = אליה, a masculine noun like אור = הוא) does not false-trip this pre-spend gate.
 * The child's OWN gender-varying pronouns/verbs are handled by the chips/slashes (+ the unresolved-chip gate); this is
 * a narrow backstop for a HARDCODED wrong-gender child form. Returns the first marker that hits, or null.
 */
function childHasAdjacentWrongGenderMarker(
  text: string,
  name: string,
  markers: readonly string[]
): string | null {
  const n = escapeRegexLiteral(name);
  for (const marker of markers) {
    const m = escapeRegexLiteral(marker);
    const re = new RegExp(
      `(?<![\\u0590-\\u05FFa-zA-Z0-9])(?<!של )${n}\\s+${m}(?![\\u0590-\\u05FFa-zA-Z0-9])`,
      'u'
    );
    if (re.test(text)) return marker;
  }
  return null;
}

export class StoryPersonalizationGateError extends Error {
  readonly failures: string[];

  constructor(failures: string[]) {
    super(`Story personalization gate failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    this.name = 'StoryPersonalizationGateError';
    this.failures = failures;
  }
}

/**
 * Normalize a raw wizard gender value to boy | girl | other. Handles English + transliteration AND Hebrew script
 * (נקבה/בת/ילדה → girl; זכר/בן/ילד → boy) so every consumer normalizes IDENTICALLY (the loader used to have its own
 * inconsistent local Hebrew regex). `toLowerCase()` is a no-op on Hebrew, so exact-set membership is correct there.
 * Unknown / empty → 'other' (explicit: the personalization gate applies NEITHER gender-marker check for 'other').
 */
const GIRL_GENDER_TOKENS: ReadonlySet<string> = new Set([
  'girl', 'female', 'f', 'bat', 'she', 'her', 'בת', 'ילדה', 'נקבה',
]);
const BOY_GENDER_TOKENS: ReadonlySet<string> = new Set([
  'boy', 'male', 'm', 'ben', 'he', 'his', 'him', 'בן', 'ילד', 'זכר',
]);

export function normalizeWizardChildGender(
  raw: string | null | undefined
): 'boy' | 'girl' | 'other' {
  const v = (raw ?? '').trim().toLowerCase();
  if (GIRL_GENDER_TOKENS.has(v)) return 'girl';
  if (BOY_GENDER_TOKENS.has(v)) return 'boy';
  return 'other';
}

/** Resolve `{maleForm|femaleForm}` chips — male is always the first alternative. */
export function resolveGenderAlternationChips(
  text: string,
  gender: 'boy' | 'girl' | 'other'
): string {
  const useMale = gender !== 'girl';
  return text.replace(/\{([^{}|]+)\|([^{}|]+)\}/gu, (_, male, female) =>
    useMale ? male.trim() : female.trim()
  );
}

/** Hebrew letter boundary — V8 \\b does not work after Hebrew script. */
const HEBREW_SLASH_BOUNDARY = `(?=$|[^\\u0590-\\u05FF])`;
const HEBREW_SLASH_FORM_RE = new RegExp(
  `([\\u0590-\\u05FF]+)\\/([\\u0590-\\u05FF]+)${HEBREW_SLASH_BOUNDARY}`,
  'gu'
);

const FINAL_TO_NONFINAL_HEBREW: Readonly<Record<string, string>> = {
  'ם': 'מ',
  'ן': 'נ',
  'ץ': 'צ',
  'ף': 'פ',
  'ך': 'כ',
};

/**
 * Feminine overrides for base/suffix slashed forms where simple concatenation
 * is orthographically wrong. Key format: `${base}/${suffix}`.
 */
const FEMININE_SLASH_OVERRIDES: Readonly<Record<string, string>> = {
  'ילד/ה': 'ילדה',
  'שם/ה': 'שמה',
  'צריך/ה': 'צריכה',
};

/** Masculine overrides — e.g. pronoun את/ה inverts the usual append rule. */
const MALE_SLASH_OVERRIDES: Readonly<Record<string, string>> = {
  'את/ה': 'אתה',
};

function feminizeSlashedForm(base: string, suffix: string): string {
  const key = `${base}/${suffix}`;
  if (FEMININE_SLASH_OVERRIDES[key]) return FEMININE_SLASH_OVERRIDES[key];

  // Pronoun inversion: female keeps the shorter base (את), not base+suffix.
  if (key === 'את/ה') return 'את';

  // Multi-letter suffix after slash is usually a full feminine word (בן/בת → בת).
  if (suffix.length > 1) return suffix;

  // /ת — normalize final-form letters (ם→מ, ן→נ, …) then append ת.
  if (suffix === 'ת') {
    if (base.length === 0) return 'ת';
    const last = base.slice(-1);
    const normalized = FINAL_TO_NONFINAL_HEBREW[last] ?? last;
    return `${base.slice(0, -1)}${normalized}ת`;
  }

  return `${base}${suffix}`;
}

function masculinizeSlashedForm(base: string, suffix: string): string {
  const key = `${base}/${suffix}`;
  if (MALE_SLASH_OVERRIDES[key]) return MALE_SLASH_OVERRIDES[key];
  return base;
}

/** Resolve Hebrew slashed gender forms like ילד/ה, נותן/ת, מרגיש/ה. */
export function resolveSlashedGenderForms(
  text: string,
  gender: 'boy' | 'girl' | 'other'
): string {
  return text.replace(HEBREW_SLASH_FORM_RE, (_, base: string, suffix: string) =>
    gender === 'girl'
      ? feminizeSlashedForm(base, suffix)
      : masculinizeSlashedForm(base, suffix)
  );
}

export function resolveStoryBankPlaceholders(
  text: string,
  ctx: WizardPersonalizationContext
): string {
  let out = text
    .replace(/\{\{childName\}\}/g, ctx.childName)
    .replace(/\{\{companionName\}\}/g, ctx.companionName);
  out = resolveGenderAlternationChips(out, ctx.childGender);
  out = resolveSlashedGenderForms(out, ctx.childGender);
  return out;
}

export type PersonalizationGateInput = {
  pages: Array<{ pageNumber: number; text: string; imagePrompt?: string }>;
  wizard: WizardPersonalizationContext;
};

export function runStoryPersonalizationGate(input: PersonalizationGateInput): string[] {
  const failures: string[] = [];
  const { wizard } = input;
  const name = wizard.childName.trim();
  const companion = wizard.companionName.trim();
  const fullText = input.pages.map((p) => `${p.text}\n${p.imagePrompt ?? ''}`).join('\n');

  if (!name) {
    failures.push('wizard.childName is empty');
  } else if (!fullText.includes(name)) {
    failures.push(`wizard.childName "${name}" does not appear in rendered story text`);
  }

  for (const denied of BANK_PROTAGONIST_DENYLIST) {
    if (denied === name || denied === companion) continue;
    if (containsAsStandaloneToken(fullText, denied)) {
      failures.push(`leftover bank protagonist name "${denied}" in rendered story`);
    }
  }

  if (name && companion && name.localeCompare(companion, 'he') === 0) {
    failures.push('companion name equals child name in rendered story');
  }

  if (UNRESOLVED_CHILD_NAME_RE.test(fullText)) {
    failures.push('unresolved {{childName}} placeholder');
  }
  if (UNRESOLVED_COMPANION_NAME_RE.test(fullText)) {
    failures.push('unresolved {{companionName}} placeholder');
  }
  if (UNRESOLVED_GENDER_CHIP_RE.test(fullText)) {
    failures.push('unresolved {male|female} gender chip');
  }
  if (UNRESOLVED_SLASH_GENDER_RE.test(fullText)) {
    failures.push('unresolved Hebrew gender slash form');
  }
  if (UNRESOLVED_PATCH_RE.test(fullText)) {
    failures.push('unresolved {{patch:…}} placeholder');
  }
  if (UNRESOLVED_AGE_BLOCK_RE.test(fullText)) {
    failures.push('unresolved {{#age}} block');
  }

  // Wrong-gender CHILD detection (Hebrew). The old `\bmarker\b` regexes NEVER matched Hebrew (V8 `\b` keys off ASCII
  // `\w`), so this pre-spend net was silently dead — wrong-gender Hebrew sailed through. It now uses the working
  // Hebrew boundary AND is attributed to the CHILD: a gendered marker fails only when it DIRECTLY FOLLOWS the child's
  // NAME (the child as subject). A bare marker elsewhere is another character (a mother = היא, the male fox/light = הוא,
  // a female friend = אליה), which is why bare or even same-sentence matching false-blocks legitimate multi-character
  // books. The child's OWN gender-varying forms are handled by the chips/slashes (+ the unresolved-chip gate above);
  // this is a narrow backstop for a hardcoded wrong-gender child form. 'other' gender applies NEITHER check.
  if (name && (wizard.childGender === 'boy' || wizard.childGender === 'girl')) {
    const markers = wizard.childGender === 'boy' ? FEMALE_CHILD_MARKERS_BOY_FAIL : MALE_CHILD_MARKERS_GIRL_FAIL;
    const wrongLabel = wizard.childGender === 'boy' ? 'female' : 'male';
    const hit = childHasAdjacentWrongGenderMarker(fullText, name, markers);
    if (hit) {
      failures.push(
        `${wrongLabel}-gendered marker "${hit}" directly follows the child name "${name}" but wizard.childGender=${wizard.childGender}`
      );
    }
  }

  return failures;
}

export function assertStoryPersonalizationGate(input: PersonalizationGateInput): void {
  const failures = runStoryPersonalizationGate(input);
  if (failures.length > 0) {
    throw new StoryPersonalizationGateError(failures);
  }
}
