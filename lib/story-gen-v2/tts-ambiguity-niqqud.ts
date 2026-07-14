/**
 * Surgical partial-niqqud pass for TTS ambiguity (Generator-v2 spike only).
 * Rule-based — does not fully vocalize prose.
 */


/** Word already has niqqud in range U+0591–U+05C7 */
function hasNiqqud(word: string): boolean {
  return /[\u0591-\u05C7]/.test(word);
}

type ReplacementRule = {
  id: string;
  /** Match bare Hebrew word(s) without niqqud */
  pattern: RegExp;
  vocalized: string;
};

const RULES: ReplacementRule[] = [
  { id: 'chol', pattern: /(?<![\u0590-\u05FF])חול(?![\u0590-\u05FF])/g, vocalized: 'חוֹל' },
  { id: 'deli', pattern: /(?<![\u0590-\u05FF])דלי(?![\u0590-\u05FF])/g, vocalized: 'דְּלִי' },
  { id: 'dalayim', pattern: /(?<![\u0590-\u05FF])דליים(?![\u0590-\u05FF])/g, vocalized: 'דְּלָיִים' },
  { id: 'gesher', pattern: /(?<![\u0590-\u05FF])גשר(?![\u0590-\u05FF])/g, vocalized: 'גֶּשֶׁר' },
  { id: 'leaf_noun', pattern: /(?<![\u0590-\u05FF])עלה(?=\s+(יבש|חלק|קטן|זהב|על))/g, vocalized: 'עָלֶה' },
  { id: 'leaf_def', pattern: /(?<![\u0590-\u05FF])העלה(?![\u0590-\u05FF])/g, vocalized: 'הָעָלֶה' },
  { id: 'nach_rest', pattern: /(?<![\u0590-\u05FF])נח(?=\s+(על|שם|באמצע|עליו|עליה|עליהם))/g, vocalized: 'נָח' },
  { id: 'nafal_m', pattern: /(?<![\u0590-\u05FF])נפל(?![\u0590-\u05FF])/g, vocalized: 'נָפַל' },
  { id: 'nafela_f', pattern: /(?<![\u0590-\u05FF])נפלה(?![\u0590-\u05FF])/g, vocalized: 'נָפְלָה' },
  { id: 'shafach_m', pattern: /(?<![\u0590-\u05FF])שפך(?![\u0590-\u05FF])/g, vocalized: 'שָׁפַךְ' },
  { id: 'shafcha_f', pattern: /(?<![\u0590-\u05FF])שפכה(?![\u0590-\u05FF])/g, vocalized: 'שָׁפְכָה' },
  { id: 'amad_m', pattern: /(?<![\u0590-\u05FF])עמד(?![\u0590-\u05FF])/g, vocalized: 'עָמַד' },
  { id: 'amda_f', pattern: /(?<![\u0590-\u05FF])עמדה(?![\u0590-\u05FF])/g, vocalized: 'עָמְדָה' },
  { id: 'esh', pattern: /(?<![\u0590-\u05FF])אש(?![\u0590-\u05FF])/g, vocalized: 'אֵשׁ' },
  { id: 'ken', pattern: /(?<![\u0590-\u05FF])קן(?![\u0590-\u05FF])/g, vocalized: 'קֵן' },
  { id: 'kenaf', pattern: /(?<![\u0590-\u05FF])כנף(?![\u0590-\u05FF])/g, vocalized: 'כְּנָף' },
  { id: 'zanav', pattern: /(?<![\u0590-\u05FF])זנב(?![\u0590-\u05FF])/g, vocalized: 'זָנָב' },
  { id: 'beitza', pattern: /(?<![\u0590-\u05FF])ביצה(?![\u0590-\u05FF])/g, vocalized: 'בֵּיצָה' },
  { id: 'chom', pattern: /(?<![\u0590-\u05FF])חום(?![\u0590-\u05FF])/g, vocalized: 'חֹם' },
  { id: 'nashaf', pattern: /(?<![\u0590-\u05FF])נשף(?![\u0590-\u05FF])/g, vocalized: 'נָשַׁף' },
  { id: 'nafach', pattern: /(?<![\u0590-\u05FF])נפח(?![\u0590-\u05FF])/g, vocalized: 'נָפַח' },
];

// ── Contextual homograph rules (narration-niqqud COVERAGE fix) ─────────────────────────────────────────────
// Same style as leaf_noun / nach_rest: bare-word boundary + a NEIGHBOUR lookahead/lookbehind that fixes the SENSE
// (order matters — the specific senses run before the default, and the whole block runs AFTER the base RULES).
// NOTE: the exact VOCALIZATIONS below are PENDING GUY'S NATIVE-HEBREW SIGN-OFF (the brief reserves the niqqud to
// Guy); the reviewable engineering is which sense fires in which context. Bank-verified: each fires on real
// v3-approved occurrences, and a word in no matching context stays bare (the preflight flags it) — never guessed.
const CONTEXTUAL_RULES: ReplacementRule[] = [
  // ספר — COUNT verb (סָפַר: count context — quietly / backwards / up-to / numbers) vs BOOK noun (סֵפֶר: a physical-
  // object context). A ספר in NEITHER context stays bare rather than being guessed.
  { id: 'safar_count', pattern: /(?<![֐-׿])ספר(?=\s+(בלחש|אחורה|עד|מספרים|לאט))/g, vocalized: 'סָפַר' },
  { id: 'sefer_book', pattern: /(?<![֐-׿])ספר(?=\s+(עם|פתוח|סגור|ישן|חדש|קרא|סיפור|וגרב))/g, vocalized: 'סֵפֶר' },

  // שם — PUT (שָׂם: takes a direct object) → NAME (שֵׁם: after a "לו/לה … שם" possessive) → THERE (שָׁם: adjacent to a
  // location/existence verb, either order). Put + name run first so the there-default can't steal them. A bare שם
  // with none of these (e.g. the isolated answer "שם.") stays bare → soft-flagged (NOT in the critical subset).
  { id: 'sam_put', pattern: /(?<![֐-׿])שם(?=\s+(את|יד|ידו|ידה|לב|כף|כפה|אותו|אותה|אותם|אותן))/g, vocalized: 'שָׂם' },
  { id: 'shem_name', pattern: /(?<=(?:לו|לה|לי|לך)\s)שם(?![֐-׿])/g, vocalized: 'שֵׁם' },
  { id: 'sham_there_after', pattern: /(?<=(?:עמד|עמדה|ישב|ישבה|יושב|יושבת|עומד|עומדת|היה|הייתה|היו|יש|אין|נמצא|נמצאת|נשאר|נשארה|עבר|עברו|הופיע|הופיעה|חיכה|חיכתה|להיות)\s)שם(?![֐-׿])/g, vocalized: 'שָׁם' },
  { id: 'sham_there_before', pattern: /(?<![֐-׿])שם(?=\s+(עמד|עמדה|ישב|ישבה|היה|הייתה|היו|נמצא|נמצאת|חיכה|חיכתה|הניח|הניחה|יש|לבד))/g, vocalized: 'שָׁם' },

  // קצב — rhythm (בְּקֶצֶב / הַקֶּצֶב) vs butcher (קַצָּב). The bank is 100% rhythm; a BUTCHER context would need its own
  // rule (Guy). These prefixed forms in children's prose are overwhelmingly rhythm.
  { id: 'beketzev_rhythm', pattern: /(?<![֐-׿])בקצב(?![֐-׿])/g, vocalized: 'בְּקֶצֶב' },
  { id: 'haketzev_rhythm', pattern: /(?<![֐-׿])הקצב(?![֐-׿])/g, vocalized: 'הַקֶּצֶב' },
];

/** The full ordered rule list: the CONTEXTUAL-sense rules run FIRST, because their neighbour lookahead/lookbehind
 *  matches BARE words (e.g. "שם עמד" needs a still-bare "עמד") — a base rule that vocalized the neighbour first
 *  (amad_m: עמד→עָמַד) would make the context fail to match. The base single-word rules are order-independent. */
const ALL_RULES: ReplacementRule[] = [...CONTEXTUAL_RULES, ...RULES];

function applyRulesToText(text: string): { text: string; applied: string[] } {
  const applied: string[] = [];
  let out = text;

  for (const rule of ALL_RULES) {
    out = out.replace(rule.pattern, (match) => {
      if (hasNiqqud(match)) return match;
      applied.push(rule.id);
      return rule.vocalized;
    });
  }

  return { text: out, applied };
}

/**
 * Page-level TTS niqqud pass: vocalize ambiguous Hebrew homographs in a SINGLE narration/prose string (no markdown /
 * `--- Page N ---` splitting) — the seam the per-page TTS input uses. Words that already carry niqqud are left
 * untouched. Shares the SAME `RULES` as the markdown-level `applyTtsAmbiguityNiqqudPass`, so the two can't drift. This
 * vocalizes for the vocalizer ONLY: the DISPLAYED text is stripped of niqqud downstream (hebrew-text.stripNikud).
 */
export function applyTtsAmbiguityNiqqudToText(text: string): { text: string; applied: string[] } {
  return applyRulesToText(text);
}

export function applyTtsAmbiguityNiqqudPass(storyMarkdown: string): {
  markdown: string;
  applied: string[];
  rulesHit: number;
} {
  const parts = storyMarkdown.split(/(--- Page \d+ ---)/);
  const allApplied: string[] = [];
  const out: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (/^--- Page \d+ ---$/.test(part)) {
      out.push(part);
      continue;
    }
    if (i > 0 && /^--- Page \d+ ---$/.test(parts[i - 1])) {
      const imageIdx = part.search(/imageDirection\s*:/i);
      const proseBlock = imageIdx >= 0 ? part.slice(0, imageIdx) : part;
      const imageBlock = imageIdx >= 0 ? part.slice(imageIdx) : '';
      const { text: fixedProse, applied } = applyRulesToText(proseBlock);
      allApplied.push(...applied);
      out.push(fixedProse + imageBlock);
    } else {
      out.push(part);
    }
  }

  return {
    markdown: out.join(''),
    applied: [...new Set(allApplied)],
    rulesHit: allApplied.length,
  };
}

// ── Fail-closed niqqud preflight (coverage safety net) ─────────────────────────────────────────────────────────
// A maintained watch list of Hebrew lemmas that are genuinely AMBIGUOUS without niqqud (a homograph the TTS can
// mispronounce). AFTER the niqqud pass, any of these still appearing BARE (no niqqud on the lemma) is a COVERAGE
// GAP — surfaced so a future gap is visible instead of silently mispronounced, rather than guessed by the model.
export const KNOWN_AMBIGUOUS_LEMMAS: readonly string[] = ['ספר', 'שם', 'בקצב', 'הקצב'];

// The CURATED CRITICAL subset that HARD-BLOCKS: lemmas whose bank senses are RELIABLY context-gateable, so a bare
// residual is a real bug (not an inherently un-gateable case). The rest (e.g. שם, which is 3-way and includes the
// un-gateable isolated answer "שם.") are SOFT-flagged only — logged / surfaced in QA, never a silent hard stop.
export const CRITICAL_AMBIGUOUS_LEMMAS: readonly string[] = ['ספר', 'בקצב', 'הקצב'];

export interface TtsNiqqudCoverageFlag {
  /** The ambiguous lemma found bare. */
  lemma: string;
  /** Character offset of the bare occurrence in the (post-pass) TTS text. */
  index: number;
  /** A short surrounding snippet, for the QA log. */
  context: string;
  /** True if `lemma` is in the curated CRITICAL subset (a hard-block signal); false → soft flag only. */
  critical: boolean;
}

/**
 * Scan a POST-niqqud-pass TTS string for KNOWN_AMBIGUOUS_LEMMAS that remain BARE (no niqqud on the lemma). Pure — no
 * mutation. Run it on the output of `applyTtsAmbiguityNiqqudToText` / `buildPageNarrationTtsText`: a covered lemma is
 * now vocalized (niqqud interspersed → the bare-boundary pattern no longer matches), so a hit is a genuine gap.
 */
export function checkTtsNiqqudCoverage(ttsText: string): TtsNiqqudCoverageFlag[] {
  const flags: TtsNiqqudCoverageFlag[] = [];
  for (const lemma of KNOWN_AMBIGUOUS_LEMMAS) {
    const re = new RegExp(`(?<![\\u0590-\\u05FF])${lemma}(?![\\u0590-\\u05FF])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(ttsText)) !== null) {
      flags.push({
        lemma,
        index: m.index,
        context: ttsText.slice(Math.max(0, m.index - 18), m.index + lemma.length + 18).replace(/\s+/g, ' ').trim(),
        critical: CRITICAL_AMBIGUOUS_LEMMAS.includes(lemma),
      });
      if (m.index === re.lastIndex) re.lastIndex += 1; // zero-width guard
    }
  }
  return flags;
}

/** Convenience: only the CRITICAL coverage gaps (the hard-block signal). Empty ⇒ safe to narrate. */
export function criticalTtsNiqqudGaps(ttsText: string): TtsNiqqudCoverageFlag[] {
  return checkTtsNiqqudCoverage(ttsText).filter((f) => f.critical);
}
