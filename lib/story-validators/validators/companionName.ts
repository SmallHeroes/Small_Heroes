import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { finding, levenshtein, normalizeCompanionId, normalizeForMatch, stripNikud } from '../utils';

const TOKEN_RE = /[\u0590-\u05FF]{2,}/g;

/** Hebrew function + common words — never treat as misspelled companion names. */
const COMMON_HEBREW_WORDS = new Set(
  [
    // Function words
    'לידו', 'לידה', 'עמו', 'עמה', 'איתו', 'איתה', 'שלו', 'שלה', 'שלהם', 'בלי', 'עליו', 'עליה',
    'אז', 'גם', 'עוד', 'כבר', 'רק', 'כל', 'זה', 'זאת', 'מה', 'מי', 'איך', 'כי', 'אם', 'לא',
    'כן', 'פה', 'שם', 'עם', 'על', 'אל', 'את', 'של', 'הוא', 'היא', 'הם', 'הן', 'אני', 'אתה',
    // Common words that share letters with companion names (false-positive prevention)
    'לילה', 'הלילה', 'בלילה', 'מילה', 'הילה', 'ליבה', 'צליל', 'לפני', 'אלי',
    'בקול', 'בחול', 'בועה', 'בוקר', 'בוקע', 'בשולי', 'ברכי', 'עולה', 'בשתי',
    'אולי', 'אילו', 'אילה', 'שולי', 'שולים',
    'גולי', 'תולי', 'דולי', 'חולי',  // pre-emptive whitelist of Lev=1 false-positives for "בולי"
    'קריר', 'הקיר', 'במים', 'קמים', 'כיף', 'איך',
    'כתף', 'יורדת', 'נפתחות', 'הידיים',
  ].map(normalizeForMatch)
);

/** BLOCKING: only canonical companion name; flag near-miss hallucinations. */
export const companionNameValidator: StoryValidator = {
  id: 'companionName',
  run({ parsed, input }) {
    const findings = [];
    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (!bible) {
      findings.push(
        finding('companionName', 'WARNING', `אין bible לדמות ${input.context.companionId} — בדיקת שם מוגבלת`)
      );
      return findings;
    }

    const allowed = new Set(
      [bible.canonicalName, bible.nameClean, ...bible.canonicalName.split(/\s+/)]
        .map((s) => normalizeForMatch(s))
        .filter((s) => s.length >= 2)
    );

    const fullText = parsed.pages.map((p) => p.text).join('\n');
    const tokens = [...stripNikud(fullText).matchAll(TOKEN_RE)].map((m) => m[0]);

    for (const token of new Set(tokens)) {
      const norm = normalizeForMatch(token);
      if (allowed.has(norm)) continue;
      if (norm.length < 4) continue;
      if (COMMON_HEBREW_WORDS.has(norm)) continue;
      if ([...allowed].some((a) => a.includes(norm) || norm.includes(a))) continue;

      for (const name of [bible.nameClean, bible.canonicalName]) {
        const ref = normalizeForMatch(name);
        if (ref.includes(norm) || norm.includes(ref)) continue;
        if (Math.abs(norm.length - ref.length) > 2) continue;
        const dist = levenshtein(norm, ref);
        // v1.1: Tightened from ≤2 to ≤1 (was catching legitimate Hebrew words like בלילה/מילה/בקול).
        // Single-letter typos only. Multi-letter divergence is almost always a real word.
        if (dist > 0 && dist <= 1) {
          findings.push(
            finding(
              'companionName',
              'BLOCKING',
              `שם דמות חשוד "${token}" — קרוב ל-${bible.nameClean} אך לא זהה`,
              { excerpt: token, suggestion: `השתמשו ב-${bible.nameClean} בלבד.` }
            )
          );
        }
      }

      // Common hallucinations (specific known wrong names — NOT general Hebrew words)
      // Removed 'לילה' from bat_lily list: it's the Hebrew word for "night", legitimate in any
      // bedtime/night story. Companion "לִילִי" must be matched exactly via the canonical-name check.
      const hallucinations: Record<string, string[]> = {
        bolly_armadillo: ['בובו', 'בובה', 'בולה', 'בולא'],
        bat_lily: ['לילית'],
        chameleon_koko: ['קוקו', 'כימי'],
      };
      const list = hallucinations[bible.companionId] ?? [];
      // v1.1: Exact match instead of includes — was firing on "בובות" (dolls) because
      // it includes "בובו" (a known hallucination of Bolly). Plural/inflected forms
      // are legitimate Hebrew, not character-name corruption.
      if (list.some((h) => norm === normalizeForMatch(h))) {
        findings.push(
          finding('companionName', 'BLOCKING', `שם הזיהוי "${token}" אסור — השתמשו ב-${bible.nameClean}`, {
            excerpt: token,
          })
        );
      }
    }

    if (!fullText.includes(bible.nameClean) && !fullText.includes(bible.canonicalName.split(' ').pop()!)) {
      findings.push(
        finding('companionName', 'BLOCKING', `שם הדמות ${bible.nameClean} לא מופיע בסיפור`)
      );
    }

    return findings;
  },
};
