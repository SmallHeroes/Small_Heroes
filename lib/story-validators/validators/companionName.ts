import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { finding, levenshtein, normalizeCompanionId, normalizeForMatch, stripNikud } from '../utils';

const TOKEN_RE = /[\u0590-\u05FF]{2,}/g;

/** Hebrew function words — never treat as misspelled companion names. */
const COMMON_HEBREW_WORDS = new Set(
  [
    'לידו', 'לידה', 'עמו', 'עמה', 'איתו', 'איתה', 'שלו', 'שלה', 'שלהם', 'בלי', 'עליו', 'עליה',
    'אז', 'גם', 'עוד', 'כבר', 'רק', 'כל', 'זה', 'זאת', 'מה', 'מי', 'איך', 'כי', 'אם', 'לא',
    'כן', 'פה', 'שם', 'עם', 'על', 'אל', 'את', 'של', 'הוא', 'היא', 'הם', 'הן', 'אני', 'אתה',
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
        if (dist > 0 && dist <= 2) {
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

      // Common hallucinations
      const hallucinations: Record<string, string[]> = {
        bolly_armadillo: ['בובו', 'בובה', 'בולה', 'בולא'],
        bat_lily: ['לילה', 'לילית'],
        chameleon_koko: ['קוקו', 'כימי'],
      };
      const list = hallucinations[bible.companionId] ?? [];
      if (list.some((h) => norm.includes(normalizeForMatch(h)))) {
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
