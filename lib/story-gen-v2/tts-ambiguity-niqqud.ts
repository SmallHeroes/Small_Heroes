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

function applyRulesToText(text: string): { text: string; applied: string[] } {
  const applied: string[] = [];
  let out = text;

  for (const rule of RULES) {
    out = out.replace(rule.pattern, (match) => {
      if (hasNiqqud(match)) return match;
      applied.push(rule.id);
      return rule.vocalized;
    });
  }

  return { text: out, applied };
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
