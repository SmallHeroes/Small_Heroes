import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { finding, normalizeCompanionId, normalizeForMatch, stripNikud } from '../utils';

const FEMALE_SUFFIX_RE = /(ה|ת|ית|ות|ני|נה|אה)\b/gu;
const MALE_SUFFIX_RE = /(ים|ו|תי|ני)\b/gu;

function scoreGenderMarkers(text: string): { female: number; male: number } {
  const t = stripNikud(text);
  return {
    female: (t.match(FEMALE_SUFFIX_RE) ?? []).length,
    male: (t.match(MALE_SUFFIX_RE) ?? []).length,
  };
}

/** BLOCKING: frontmatter + companion gender; WARNING: child verb heuristics. */
export const genderConsistencyValidator: StoryValidator = {
  id: 'genderConsistency',
  run({ parsed, input }) {
    const findings = [];
    const fmGender = String(parsed.frontmatter.childGender ?? parsed.frontmatter.gender ?? '').toLowerCase();
    const expectedChild = input.context.childGender;

    if (fmGender) {
      const map: Record<string, string> = { male: 'boy', female: 'girl', boy: 'boy', girl: 'girl' };
      const normalizedFm = map[fmGender] ?? fmGender;
      if (normalizedFm !== expectedChild && expectedChild !== 'other') {
        findings.push(
          finding(
            'genderConsistency',
            'BLOCKING',
            `מגדר ב-frontmatter (${fmGender}) לא תואם לקלט (${expectedChild})`
          )
        );
      }
    }

    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (bible) {
      const prose = parsed.pages.map((p) => p.text).join('\n');
      const name = bible.nameClean;
      const nameIdx = prose.indexOf(name);
      if (nameIdx !== -1) {
        const window = prose.slice(Math.max(0, nameIdx - 40), nameIdx + 80);
        const scores = scoreGenderMarkers(window);
        if (bible.gender === 'female' && scores.male > scores.female + 2) {
          findings.push(
            finding(
              'genderConsistency',
              'BLOCKING',
              `סימני מגד זכר ליד ${name} — הדמות מוגדרת נקבה`,
              { excerpt: window.slice(0, 60) }
            )
          );
        }
        if (bible.gender === 'male' && scores.female > scores.male + 2) {
          findings.push(
            finding(
              'genderConsistency',
              'BLOCKING',
              `סימני מגד נקבה ליד ${name} — הדמות מוגדרת זכר`,
              { excerpt: window.slice(0, 60) }
            )
          );
        }
      }
    }

    const allText = parsed.pages.map((p) => p.text).join('\n');
    if (!allText.includes('{') && !allText.includes('{{')) {
      const scores = scoreGenderMarkers(allText);
      if (expectedChild === 'girl' && scores.male > scores.female + 8) {
        findings.push(
          finding(
            'genderConsistency',
            'WARNING',
            'ייתכן בלבול מגדרי לילד/ה (היוריסטיקה — בדיקה ידנית)',
            { suggestion: 'בדקו פעלים/כינויי גוף מול childGender.' }
          )
        );
      }
      if (expectedChild === 'boy' && scores.female > scores.male + 8) {
        findings.push(
          finding(
            'genderConsistency',
            'WARNING',
            'ייתכן בלבול מגדרי לילד/ה (היוריסטיקה — בדיקה ידנית)'
          )
        );
      }
    }

    return findings;
  },
};
