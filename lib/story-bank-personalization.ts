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
const UNRESOLVED_SLASH_GENDER_RE = /[\u0590-\u05FF]+\/ה(?=$|[^\u0590-\u05FF])/u;
const UNRESOLVED_PATCH_RE = /\{\{patch:/i;
const UNRESOLVED_AGE_BLOCK_RE = /\{\{#age\}\}/;

/** Female-only child markers (Hebrew) — fail when wizard gender is boy. */
const FEMALE_CHILD_MARKERS_BOY_FAIL: readonly RegExp[] = [
  /\bהיא\b/u,
  /\bעיניה\b/u,
  /\bכתפיה\b/u,
  /\bידיה\b/u,
  /\bרגליה\b/u,
  /\bבטנה\b/u,
  /\bשלה\b/u,
  /\bאליה\b/u,
  /\bשוכבת\b/u,
  /\bמחזיקה\b/u,
  /\bמסיטה\b/u,
  /\bמסתכלת\b/u,
  /\bמושכת\b/u,
  /\bמושיטה\b/u,
  /\bמחייכת\b/u,
  /\bישנה\b/u,
  /\bנפתחת\b/u,
];

/** Male-only child markers — fail when wizard gender is girl. */
const MALE_CHILD_MARKERS_GIRL_FAIL: readonly RegExp[] = [
  /\bהוא\b/u,
  /\bעיניו\b/u,
  /\bכתפיו\b/u,
  /\bשלו\b/u,
  /\bאליו\b/u,
  /\bשוכב\b/u,
  /\bמחזיק\b/u,
  /\bמסיט\b/u,
  /\bמסתכל\b/u,
  /\bמושך\b/u,
  /\bמושיט\b/u,
  /\bמחייך\b/u,
  /\bישן\b/u,
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

export class StoryPersonalizationGateError extends Error {
  readonly failures: string[];

  constructor(failures: string[]) {
    super(`Story personalization gate failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
    this.name = 'StoryPersonalizationGateError';
    this.failures = failures;
  }
}

export function normalizeWizardChildGender(
  raw: string | null | undefined
): 'boy' | 'girl' | 'other' {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'girl' || v === 'female' || v === 'bat' || v === 'f') return 'girl';
  if (v === 'boy' || v === 'male' || v === 'ben' || v === 'm') return 'boy';
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

/** Resolve Hebrew slashed gender forms like ילד/ה, מרגיש/ה. */
export function resolveSlashedGenderForms(
  text: string,
  gender: 'boy' | 'girl' | 'other'
): string {
  // NOTE: lookahead instead of \b — V8 regex \b doesn't work after Hebrew.
  if (gender === 'girl') {
    return text.replace(/([\u0590-\u05FF]+)\/ה(?=$|[^\u0590-\u05FF])/gu, (_, base: string) => {
      if (base === 'ילד') return 'ילדה';
      return `${base}ה`;
    });
  }
  return text.replace(/([\u0590-\u05FF]+)\/ה(?=$|[^\u0590-\u05FF])/gu, '$1');
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
    failures.push('unresolved Hebrew /ה gender slash form');
  }
  if (UNRESOLVED_PATCH_RE.test(fullText)) {
    failures.push('unresolved {{patch:…}} placeholder');
  }
  if (UNRESOLVED_AGE_BLOCK_RE.test(fullText)) {
    failures.push('unresolved {{#age}} block');
  }

  if (wizard.childGender === 'boy') {
    for (const re of FEMALE_CHILD_MARKERS_BOY_FAIL) {
      if (re.test(fullText)) {
        failures.push(`female-gendered child marker matches ${re.source} but wizard.childGender=boy`);
        break;
      }
    }
  } else if (wizard.childGender === 'girl') {
    for (const re of MALE_CHILD_MARKERS_GIRL_FAIL) {
      if (re.test(fullText)) {
        failures.push(`male-gendered child marker matches ${re.source} but wizard.childGender=girl`);
        break;
      }
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
