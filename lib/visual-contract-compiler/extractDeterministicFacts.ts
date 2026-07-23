/**
 * Brief 1, Component 2 — DETERMINISTIC fact extractor (pure, NO LLM).
 *
 * This runs BEFORE any LLM pass. It derives ONLY the facts the story TEXT itself determines —
 * recurring-human identity + gender (Hebrew morphology), the evidence phrase each is bound to,
 * per-page presence, companion presence, laterality — and it FLAGS everything the text leaves
 * open (`deferrals`) instead of inventing it. The template compiler overlays these facts LAST so a
 * later LLM draft can never overwrite a fact (it must not fabricate gender / laterality / evidence).
 *
 * NEVER `\b` for Hebrew (V8 `\b` keys off ASCII `\w`). All Hebrew matching uses the exported
 * `standaloneTokenPattern` boundary against niqqud-STRIPPED text (the bank source is fully vowelized).
 */
import { standaloneTokenPattern, containsAsStandaloneToken, escapeRegexLiteral } from '@/lib/story-bank-personalization';
import { companionPresenceTokens } from '@/lib/companion-presence-aliases';

export type HumanGender = 'male' | 'female' | 'unspecified';
export type Confidence = 'high' | 'low';

export interface FactEvidence {
  page: number;
  phrase: string;
}

export interface HumanFact {
  /** Namespaced stable id, e.g. "human:doctor". */
  id: string;
  role: string;
  gender: HumanGender;
  genderConfidence: Confidence;
  /** The story phrase the gender/identity is bound to (never fabricated — a real page + phrase). */
  genderEvidence: FactEvidence | null;
  /** Bare (niqqud-stripped) alias forms actually found in the text. */
  aliasesFound: string[];
  /** Pages where the human is textually present (subject/object mention; genitive + construct excluded). */
  pagesPresent: number[];
  /** Reserved review field; source-authoritative extraction never adds direction-only presence. */
  lowConfidencePages: number[];
}

export interface LateralityFact {
  page: number;
  side: 'left' | 'right';
  bodyPart: string;
  evidence: FactEvidence;
}

export interface Deferral {
  /** The contract field the text cannot determine (e.g. "castStates.laterality"). */
  field: string;
  reason: string;
  pages?: number[];
}

export interface DeterministicFacts {
  storyKey: string;
  pageCount: number;
  /** Pages where the child is textually named ({{childName}}). The child is the protagonist — present everywhere by default. */
  childNamedPages: number[];
  companionPresentPages: number[];
  companionAbsentPages: number[];
  humans: HumanFact[];
  /** Laterality facts derived ONLY from explicit שמאל/ימין in the text; empty when the text is silent. */
  laterality: LateralityFact[];
  /** Explicit "the text does not determine this — a human must author it" markers. */
  deferrals: Deferral[];
  warnings: string[];
}

export interface DeterministicFactsInputPage {
  pageNumber: number;
  text: string;
}

export interface DeterministicFactsInput {
  storyKey: string;
  pageCount: number;
  pages: DeterministicFactsInputPage[];
  pageImageDirections?: Array<{ pageNumber: number; imageDirection: string }>;
  companion?: { id: string; name?: string } | null;
  childGender?: string;
}

// ── Hebrew helpers ──────────────────────────────────────────────────────────

/** Strip niqqud + cantillation (combining marks) so bare-letter needles match vowelized source. */
export function stripNiqqud(s: string): string {
  return s.normalize('NFC').replace(/\p{M}/gu, '');
}

/** Match positions of `needle` as a standalone token (uses the SAME boundary as the personalization gate). */
function standaloneMatchIndices(haystack: string, needle: string): number[] {
  const re = new RegExp(standaloneTokenPattern(needle), 'gu');
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) {
    out.push(m.index);
    if (m.index === re.lastIndex) re.lastIndex += 1; // guard against zero-width loops
  }
  return out;
}

// Clause-initial particles: an alias right after one of these is the clause SUBJECT (an actor), not a construct.
const CLAUSE_PARTICLES = new Set(['אז', 'ואז', 'אבל', 'אך', 'כי', 'אולם', 'אלא', 'וגם', 'וכך', 'ואם', 'ולכן']);
// Object / oblique markers: the human is a participant in the action (present), NOT a possessor.
const OBJECT_PREPS = new Set(['את', 'עם', 'על', 'אל', 'ליד', 'מול', 'אצל', 'לפני', 'אחרי', 'בשביל']);

type MentionKind = 'actor' | 'object' | 'genitive' | 'construct';

/** Classify a Hebrew mention by the token immediately preceding it (on niqqud-stripped text). */
function classifyHebrewMention(before: string): MentionKind {
  const trimmed = before.replace(/\s+$/u, '');
  if (trimmed === '') return 'actor'; // start of page/clause
  const lastChar = trimmed.slice(-1);
  // A clause boundary before the alias → the alias opens a clause → subject/actor.
  if (/[.,:;!?"'\n()[\]«»\-־]/u.test(lastChar)) return 'actor';
  const lastToken = trimmed.split(/\s+/u).pop() ?? '';
  if (lastToken === 'של') return 'genitive';
  if (CLAUSE_PARTICLES.has(lastToken)) return 'actor';
  if (OBJECT_PREPS.has(lastToken)) return 'object';
  // Another Hebrew content word precedes it → most likely a construct/possessive (סמיכות), e.g. "דלת הרופא".
  return 'construct';
}

/** A page-level Hebrew mention that establishes presence (actor or object; not genitive/construct). */
export function hasPresentHebrewMention(prose: string, aliases: string[]): boolean {
  const clean = stripNiqqud(prose);
  for (const alias of aliases) {
    for (const idx of standaloneMatchIndices(clean, alias)) {
      const kind = classifyHebrewMention(clean.slice(0, idx));
      if (kind === 'actor' || kind === 'object') return true;
    }
  }
  return false;
}

/** True if `alias` appears in an English image direction as a real mention — NOT (only) a possessive ("doctor's …").
 *  The `\b…\b(?!['’]s)` lookahead already excludes the possessive form PER OCCURRENCE, so a single non-possessive
 *  occurrence anywhere is a clean mention. (The old code additionally suppressed the whole match when ANY possessive
 *  appeared — so "Uri points … Uri's lantern" wrongly read as absent even though "Uri points" is a real mention.) */
export function hasCleanEnglishMention(direction: string, aliases: string[]): boolean {
  const low = direction.toLowerCase();
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    // word-boundary is fine here — English is ASCII, so \b works. escapeRegexLiteral (shared, correct) escapes any
    // metacharacter in the alias so an alias like "Dr. (Sam)" can't over-match or throw a SyntaxError from RegExp.
    const re = new RegExp(`\\b${escapeRegexLiteral(a)}\\b(?!['’]s)`, 'i');
    if (re.test(low)) return true;
  }
  return false;
}

// ── Recurring-human lexicon ──────────────────────────────────────────────────
// Fixed, low-ambiguity clinic/family roles. Gender is LEXICAL where the noun fixes it (אמא→female),
// or by FORM where a masc/fem pair exists (הרופא vs הרופאה). Ambiguous roles resolve to 'unspecified'
// + a warning rather than a guess.

interface HumanLexEntry {
  id: string;
  role: string;
  /** Bare Hebrew aliases that fix the human as MALE (or, for a lexical-male role, all of them). */
  heMale?: string[];
  /** Bare Hebrew aliases that fix the human as FEMALE. */
  heFemale?: string[];
  /** Gender-neutral Hebrew aliases (e.g. הורה = parent) — count for presence, not for gender. */
  heNeutral?: string[];
  /** English aliases fixing MALE. */
  enMale?: string[];
  /** English aliases fixing FEMALE. */
  enFemale?: string[];
  /** Gender-neutral English aliases (parent). */
  enNeutral?: string[];
}

const HUMAN_LEXICON: HumanLexEntry[] = [
  {
    id: 'human:doctor',
    role: 'doctor',
    heMale: ['הרופא', 'רופא'],
    heFemale: ['הרופאה', 'רופאה'],
    enMale: [],
    enFemale: [],
    enNeutral: ['doctor'],
  },
  {
    // The parent. Resolves to mother/father by whichever gendered alias the text establishes; the neutral
    // הורה/parent folds into the same human (coreference to the established parent).
    id: 'human:parent',
    role: 'parent',
    heFemale: ['אמא', 'אימא', 'אמהּ'],
    heMale: ['אבא'],
    heNeutral: ['הורה', 'ההורה'],
    enFemale: ['mom', 'mother'],
    enMale: ['dad', 'father'],
    enNeutral: ['parent'],
  },
];

function allAliases(e: HumanLexEntry): { he: string[]; en: string[] } {
  return {
    he: [...(e.heMale ?? []), ...(e.heFemale ?? []), ...(e.heNeutral ?? [])].map(stripNiqqud),
    en: [...(e.enMale ?? []), ...(e.enFemale ?? []), ...(e.enNeutral ?? [])],
  };
}

/** Resolve the human's gender from which gendered alias forms actually appear (never guessed). */
function resolveGender(
  e: HumanLexEntry,
  pages: DeterministicFactsInputPage[],
): { gender: HumanGender; confidence: Confidence; evidence: FactEvidence | null; role: string; id: string } {
  const maleHe = (e.heMale ?? []).map(stripNiqqud);
  const femHe = (e.heFemale ?? []).map(stripNiqqud);

  // Prefer an ACTOR/OBJECT mention for the cited phrase (e.g. "הרופא קרא") over a construct/genitive
  // ("דלת הרופא", "של אמא"); a single-gender noun form still fixes gender either way.
  let maleEvidence = bestHebrewEvidence(pages, maleHe);
  let femEvidence = bestHebrewEvidence(pages, femHe);

  // English prose is source authority too. Historical image directions are excluded from cast/gender.
  const enMale = (e.enMale ?? []).map((s) => s.toLowerCase());
  const enFem = (e.enFemale ?? []).map((s) => s.toLowerCase());
  if (!maleEvidence && enMale.length) {
    for (const page of pages) {
      if (hasCleanEnglishMention(page.text, enMale)) {
        maleEvidence = { page: page.pageNumber, phrase: page.text.trim() };
        break;
      }
    }
  }
  if (!femEvidence && enFem.length) {
    for (const page of pages) {
      if (hasCleanEnglishMention(page.text, enFem)) {
        femEvidence = { page: page.pageNumber, phrase: page.text.trim() };
        break;
      }
    }
  }

  // Choose the role/id by the gendered form found. For the parent, female→mother, male→father.
  if (maleEvidence && !femEvidence) {
    return { gender: 'male', confidence: 'high', evidence: maleEvidence, ...genderedRole(e, 'male') };
  }
  if (femEvidence && !maleEvidence) {
    return { gender: 'female', confidence: 'high', evidence: femEvidence, ...genderedRole(e, 'female') };
  }
  if (maleEvidence && femEvidence) {
    // Both forms appear — ambiguous. Prefer the earlier evidence but mark low-confidence.
    const male = maleEvidence.page <= femEvidence.page;
    return {
      gender: male ? 'male' : 'female',
      confidence: 'low',
      evidence: male ? maleEvidence : femEvidence,
      ...genderedRole(e, male ? 'male' : 'female'),
    };
  }
  return { gender: 'unspecified', confidence: 'low', evidence: null, role: e.role, id: e.id };
}

function genderedRole(e: HumanLexEntry, g: 'male' | 'female'): { role: string; id: string } {
  if (e.id === 'human:parent') {
    return g === 'female' ? { role: 'mother', id: 'human:mother' } : { role: 'father', id: 'human:father' };
  }
  return { role: e.role, id: e.id };
}

/** The sentence-ish window around a match index in already-cleaned text (evidence phrase — short, real). */
function sentenceAround(clean: string, at: number): string {
  const start = Math.max(0, clean.lastIndexOf('.', at) + 1, clean.lastIndexOf('\n', at) + 1);
  let end = clean.indexOf('.', at);
  if (end === -1) end = Math.min(clean.length, at + 80);
  return clean.slice(start, end + 1).trim();
}

/**
 * Best gender evidence for a set of bare aliases: the EARLIEST actor/object mention (e.g. "הרופא קרא")
 * if any, else the earliest mention of any kind (a construct/genitive still fixes the noun's gender).
 * Returns a real page + phrase (never fabricated), or null when no alias appears.
 */
function bestHebrewEvidence(
  pages: DeterministicFactsInputPage[],
  bareAliases: string[]
): FactEvidence | null {
  let weak: FactEvidence | null = null;
  for (const p of pages) {
    const clean = stripNiqqud(p.text);
    for (const a of bareAliases) {
      for (const idx of standaloneMatchIndices(clean, a)) {
        const kind = classifyHebrewMention(clean.slice(0, idx));
        const phrase = sentenceAround(clean, idx);
        if (kind === 'actor' || kind === 'object') return { page: p.pageNumber, phrase };
        if (!weak) weak = { page: p.pageNumber, phrase };
      }
    }
  }
  return weak;
}

// ── Laterality ────────────────────────────────────────────────────────────────
// The tool NEVER auto-binds laterality. A side word may describe another character (e.g. "the nurse's RIGHT
// hand") or camera framing, and attributing a side to the CHILD's injection/bandage arm is not reliable from
// text — so laterality is ALWAYS a human authoring choice (deferred + flagged), never fabricated. We only
// detect explicit HEBREW side words (never English framing text) to make the deferral note more useful.
const LEFT_TOKENS = ['שמאל', 'שמאלית', 'השמאלית', 'שמאלה'];
const RIGHT_TOKENS = ['ימין', 'ימנית', 'הימנית', 'ימינה'];

function detectHebrewSideTokenPages(pages: DeterministicFactsInputPage[]): number[] {
  const sideTokens = [...LEFT_TOKENS, ...RIGHT_TOKENS].map(stripNiqqud);
  const out: number[] = [];
  for (const p of pages) {
    const clean = stripNiqqud(p.text);
    if (sideTokens.some((t) => standaloneMatchIndices(clean, t).length > 0)) out.push(p.pageNumber);
  }
  return out;
}

// Pages that plausibly need a laterality binding (injection / bandage arc) — for the DEFERRAL note only.
const LATERALITY_RELEVANT_HE = ['דקירה', 'זריקה', 'מזרק', 'פלסטר', 'צביטה', 'חיסון'];

// ── Main ──────────────────────────────────────────────────────────────────────

export function extractDeterministicFacts(input: DeterministicFactsInput): DeterministicFacts {
  const pages = input.pages.slice().sort((a, b) => a.pageNumber - b.pageNumber);

  const warnings: string[] = [];
  const deferrals: Deferral[] = [];

  // Child: the protagonist. Report the pages where the placeholder is textually named.
  const childNamedPages = pages
    .filter((p) => /\{\{childName\}\}/.test(p.text))
    .map((p) => p.pageNumber);

  // Companion presence is derived from STORY PROSE only. Historical imageDirection (including legacy
  // companionPresence markers) is advisory presentation evidence and can never select or suppress cast.
  // Detect the companion by ANY prose alias / short name — not only the full roster display name.
  // The old code matched only input.companion.name, so a prose short-name ("אוּרי" / "Uri" / "fox") went undetected
  // → companion forced ABSENT while the LLM's mustShow (which read the same prose) still required it → a cross-field
  // contradiction. companionPresenceTokens is the same alias source used by the review flag + Fix 2.
  //
  // The companion is matched as a plain STANDALONE TOKEN (niqqud-stripped, case-insensitive) — INTENTIONALLY more
  // permissive than the recurring-human detector, which excludes genitive /
  // construct / possessive mentions. For a HUMAN ROLE, "the doctor's door" is scenery (the doctor is not on-scene);
  // but the companion is a NAMED character whose every mention — as a speaker ("הכריז אוּרי"), a genitive
  // ("הפנס של אוּרי"), or a possessive ("Uri's neck-lantern") — means it IS in the scene. Using the SAME
  // standalone-token primitive as Fix 2 keeps detection and the cross-field check consistent. NOTE (flag): this is
  // a deliberate companion-vs-human semantic split — see the brief follow-up.
  const companionNeedles = input.companion?.name
    ? [
        ...new Set(
          companionPresenceTokens(input.companion.name, input.companion.id?.replace(/^companion:/, '') ?? input.companion.id)
            .map((t) => stripNiqqud(t).toLowerCase())
            .filter((t) => t.length >= 2),
        ),
      ]
    : [];
  const companionPresentPages: number[] = [];
  const companionAbsentPages: number[] = [];
  for (const p of pages) {
    if (companionNeedles.length > 0) {
      const haystack = stripNiqqud(p.text).toLowerCase();
      if (companionNeedles.some((n) => containsAsStandaloneToken(haystack, n))) companionPresentPages.push(p.pageNumber);
    }
  }

  // Recurring humans.
  const humans: HumanFact[] = [];
  for (const entry of HUMAN_LEXICON) {
    const { he, en } = allAliases(entry);
    // Which pages mention this human at all (any alias, any language)?
    const pagesPresent: number[] = [];
    const lowConfidencePages: number[] = [];
    const aliasesFound = new Set<string>();

    for (const p of pages) {
      const clean = stripNiqqud(p.text);
      const hebrewPresent = hasPresentHebrewMention(p.text, he);
      const englishPresent = en.length > 0 && hasCleanEnglishMention(p.text, en);
      if (hebrewPresent || englishPresent) {
        pagesPresent.push(p.pageNumber);
        for (const a of he) if (standaloneMatchIndices(clean, a).length > 0) aliasesFound.add(a);
        for (const a of en) if (hasCleanEnglishMention(p.text, [a])) aliasesFound.add(a);
      }
    }

    if (pagesPresent.length === 0) continue; // human not in this story

    const g = resolveGender(entry, pages);
    if (g.gender === 'unspecified') {
      warnings.push(`human ${g.role}: gender not determinable from the text (no gendered noun form found)`);
    }
    humans.push({
      id: g.id,
      role: g.role,
      gender: g.gender,
      genderConfidence: g.confidence,
      genderEvidence: g.evidence,
      aliasesFound: [...aliasesFound],
      pagesPresent,
      lowConfidencePages,
    });

    // Continuity gap: pages inside the presence span where the human is not textually named. These are the
    // pages a human authoring "continuous presence" (e.g. a parent who stays through the exam) would add and
    // the extractor cannot — some may be genuine absences. Flag for review rather than guess either way.
    const first = pagesPresent[0];
    const last = pagesPresent[pagesPresent.length - 1];
    const present = new Set(pagesPresent);
    const gaps = pages
      .map((p) => p.pageNumber)
      .filter((n) => n > first && n < last && !present.has(n));
    if (gaps.length > 0) {
      deferrals.push({
        field: `humanCast[${g.id}].pagesPresent (continuity)`,
        reason: `${g.role} is textually named on [${pagesPresent.join(', ')}] but not on these in-span pages; confirm whether they remain in-scene (continuity) or are genuinely absent.`,
        pages: gaps,
      });
    }
  }

  // Laterality — ALWAYS deferred, NEVER auto-bound (a side word may refer to another character or camera
  // framing; attributing a side to the child's injection/bandage arm is a human authoring choice). We only
  // surface where side words appear (Hebrew only) vs the injection/bandage pages, to guide the human author.
  const laterality: LateralityFact[] = []; // the tool never derives a binding — see detectHebrewSideTokenPages
  const sideTokenPages = detectHebrewSideTokenPages(pages);
  const injectionPages = pages
    .filter((p) => LATERALITY_RELEVANT_HE.map(stripNiqqud).some((t) => standaloneMatchIndices(stripNiqqud(p.text), t).length > 0))
    .map((p) => p.pageNumber);
  const flagPages = sideTokenPages.length ? sideTokenPages : injectionPages;
  deferrals.push({
    field: 'castStates.laterality (injectionArm / bandageArm / freeHand)',
    reason: sideTokenPages.length
      ? `Side words (שמאל/ימין) appear on pages [${sideTokenPages.join(', ')}], but the tool does NOT auto-bind laterality — a side word may refer to another character or camera framing, and attributing a side to the child's injection/bandage arm is a human authoring choice. Author it during review.`
      : 'The source text never states which side (no שמאל/ימין). Any left/right binding is a human authoring choice — the extractor declines to invent it.',
    ...(flagPages.length ? { pages: flagPages } : {}),
  });

  return {
    storyKey: input.storyKey,
    pageCount: input.pageCount,
    childNamedPages,
    companionPresentPages,
    companionAbsentPages,
    humans,
    laterality,
    deferrals,
    warnings,
  };
}
