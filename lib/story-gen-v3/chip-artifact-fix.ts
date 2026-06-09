/**
 * v3 Sprint B — deterministic chip/format repairs (not Hebrew polish).
 */

const BROKEN_CHIP_FIXES: Array<[RegExp, string]> = [
  [/\{הרימו\|הרימה\}/g, '{הרים|הרימה}'],
  [/\{הרים\|הריםה\}/g, '{הרים|הרימה}'],
  [/\{הרים\|הרימהה\}/g, '{הרים|הרימה}'],
  [/\{הרימ\|הרימה\}/g, '{הרים|הרימה}'],
  [/\{הרימ\|הרימָה\}/g, '{הרים|הרימה}'],
  [/סגר\{ה\}/g, '{סגר|סגרה}'],
  [/נפתח\{ה\}/g, '{נפתח|נפתחה}'],
  [/ה\{וא\|יא\}/g, '{הוא|היא}'],
  [/מסגר\{ה\}/g, '{מסגר|מסגרה}'],
  [/מרים\/ה/g, '{הרים|הרימה}'],
  [/מחליט\/ה/g, '{מחליט|מחליטה}'],
  [/נזכר\/ת/g, '{נזכר|נזכרה}'],
  [/הבטיח\/ה/g, '{הבטיח|הבטיחה}'],
  [/מכוון\/ת/g, '{מכוון|מכוונת}'],
  [/מחזיק\/ה/g, '{מחזיק|מחזיקה}'],
  [/מגיש\/ה/g, '{מגיש|מגישה}'],
  [/חולק\/ת/g, '{חולק|חולקת}'],
  [/מצחקק\/ת/g, '{מצחקק|מצחקקת}'],
  [/האח\/האחות/g, '{האח|האחות}'],
  [/לאח\/אחות/g, '{לאח|לאחות}'],
  [/\{ונשם\|נשמה\}/g, 'ו{נשם|נשמה}'],
  [/\{וצחק\|צחקה\}/g, 'ו{צחק|צחקה}'],
];

const DINI_CHIP_RE = /דיני[^.\n]{0,40}\{[^{}]+\|[^{}]+\}/g;

/** LLM emits `ניסה/{ניסתה}` instead of `{ניסה|ניסתה}`. */
const PARTIAL_BRACE_CHIP = /([\u0590-\u05FF]+)\/\{([\u0590-\u05FF]+)\}/g;

const KNOWN_MALFORMED_VERB: Record<string, { male: string; female: string }> = {
  'התכופף/התכופפה': { male: 'מתכופף', female: 'מתכופפת' },
  'התכופף/{התכופפה}': { male: 'מתכופף', female: 'מתכופפת' },
};

export function applyV3ChipArtifactFixes(markdown: string): { markdown: string; fixes: string[] } {
  const fixes: string[] = [];
  let md = markdown;

  for (const [re, replacement] of BROKEN_CHIP_FIXES) {
    if (md.match(re)) {
      md = md.replace(re, replacement);
      fixes.push(`chip: ${re.source}`);
    }
  }

  md = md.replace(PARTIAL_BRACE_CHIP, (match, male, female) => {
    const key = `${male}/{${female}}`;
    const known = KNOWN_MALFORMED_VERB[key] ?? KNOWN_MALFORMED_VERB[`${male}/${female}`];
    if (known) {
      fixes.push(`partial-brace: ${match}`);
      return `{${known.male}|${known.female}}`;
    }
    fixes.push(`partial-brace: ${match}`);
    return `{${male}|${female}}`;
  });

  if (DINI_CHIP_RE.test(md)) {
    md = md.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (match, a, b, offset, full) => {
      const before = full.slice(Math.max(0, offset - 8), offset);
      if (/דיני\s*$/.test(before)) {
        fixes.push('removed chip on Dini');
        return b.includes('ה') && !a.includes('ה') ? b : a;
      }
      return match;
    });
  }

  md = md.replace(/\r?\n### Page (\d+)/g, '\n--- Page $1 ---');
  md = md.replace(/\*\*imageDirection:\*\*/gi, 'imageDirection:');

  return { markdown: md, fixes };
}
