/**
 * Deterministic patches for Writer's Room revalidation artifacts.
 * Neutral rewrites + explicit chip forms — no generic feminine guessing.
 */

import type { StoryOutline } from './story-generation-types';
import { stripHebrewDiacritics } from './chip-normalize';

export interface ArtifactPatchEntry {
  before: string;
  after: string;
  reason: 'neutral_rewrite' | 'explicit_chip' | 'trusted_slash';
}

export interface ArtifactPatchReport {
  scenarioId: string;
  patches: ArtifactPatchEntry[];
  patchCount: number;
}

function applyReplacements(
  markdown: string,
  replacements: ArtifactPatchEntry[]
): { markdown: string; applied: ArtifactPatchEntry[] } {
  let out = markdown;
  const applied: ArtifactPatchEntry[] = [];
  for (const entry of replacements) {
    if (!out.includes(entry.before)) continue;
    out = out.split(entry.before).join(entry.after);
    applied.push(entry);
  }
  return { markdown: out, applied };
}

const S5_PATCHES: ArtifactPatchEntry[] = [
  {
    before:
      'stakes: הילד/ה רוצה לראות את הזיקוקים אך הבּוּמים גדולים מדי; אם בורח/ת מפסיד/ה את היופי, אם נשאר/ת בלי גבול — מציף.',
    after:
      'stakes: {{childName}} רוצה לראות את הזיקוקים אך הבּוּמים גדולים מדי; אם יוצאים מהר מדי — היופי נשאר רחוק; אם נשארים בלי גבול — מציף.',
    reason: 'neutral_rewrite',
  },
  {
    before: 'agencyTransfer: עמוד 9 — {{childName}} מחליט/ה איפה לעמוד ומה נכנס לאוזניים.',
    after: 'agencyTransfer: עמוד 9 — {{childName}} {מחליט|מחליטה} איפה לעמוד ומה נכנס לאוזניים.',
    reason: 'explicit_chip',
  },
  {
    before: '    - בוחר/ת קול אחד, השאר מעבר לחלון',
    after: '    - "{בוחר|בוחרת} קול אחד, השאר מעבר לחלון"',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} צוחק/ת.',
    after: '{{childName}} {צוחק|צוחקת}.',
    reason: 'explicit_chip',
  },
  {
    before: 'גם {{childName}} עוצם/ת עיניים לשנייה',
    after: 'גם {{childName}} {עוצם|עוצמת} עיניים לשנייה',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} פותח/ת עין אחת קטנה.',
    after: '{{childName}} {פותח|פותחת} עין אחת קטנה.',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מצטרף/ת לתנועה.',
    after: '{{childName}} {מצטרף|מצטרפת} לתנועה.',
    reason: 'explicit_chip',
  },
  {
    before: 'בּוֹחֵר/ת קול אחד בלבד',
    after: '{בוחר|בוחרת} קול אחד בלבד',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מצביע/ה על פינה',
    after: '{{childName}} {מצביע|מצביעה} על פינה',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מחייך/ת —',
    after: '{{childName}} {מחייך|מחייכת} —',
    reason: 'explicit_chip',
  },
];

const S2_PATCHES: ArtifactPatchEntry[] = [
  {
    before: '    - מוֹרִיד/ה אֹזְנַיִם לַאֶמְצַע — חֲצִי אֹזֶן',
    after: '    - "{מוריד|מורידה} אוזניים לאמצע — חצי אוזן"',
    reason: 'explicit_chip',
  },
  {
    before: '    - בּוֹחֵר/ת קוֹל אֶחָד שֶׁנִּשְׁמָע קָרוֹב',
    after: '    - "{בוחר|בוחרת} קול אחד שנשמע קרוב"',
    reason: 'explicit_chip',
  },
  {
    before: 'heartLine: עמוד 6 — {{childName}} בּוֹחֵר/ת קוֹל קָטָן וְטוּבִּי מַנִּיף אֹזֶן לַאֶמְצַע.',
    after:
      'heartLine: עמוד 6 — {{childName}} {בוחר|בוחרת} קול קטן וְטוּבִּי מַנִּיף אֹזֶן לַאֶמְצַע.',
    reason: 'explicit_chip',
  },
  {
    before:
      'uncomfortableTruth: עמוד 4 — {{childName}} מְפַחֵד/ת שֶׁאִם יִסְגֹּר/תִסְגֹּר יִפְסְפֵּס/תִפְסְפֵּס אֶת אִמָּא.',
    after:
      'uncomfortableTruth: עמוד 4 — {{childName}} {מפחד|מפחדת} שאם האוזניים סגורות מדי — קול אמא נשאר רחוק.',
    reason: 'neutral_rewrite',
  },
  {
    before: 'agencyTransfer: עמוד 6 — {{childName}} מַדְגִּים/ה לְטוּבִּי אֵיךְ לִבְחוֹר קוֹל אֶחָד.',
    after: 'agencyTransfer: עמוד 6 — כאן {{childName}} מראה לטוּבִּי איך לבחור קול אחד.',
    reason: 'neutral_rewrite',
  },
  {
    before: '{{childName}} {מוֹשִׁיט|מוֹשִׁיטָה} אֶצְבַּע וְלוֹחֵשׁ/ת:',
    after: '{{childName}} {מוֹשִׁיט|מוֹשִׁיטָה} אֶצְבַּע. {לוחש|לוחשת}:',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מְצַחֵק/ת,',
    after: '{{childName}} {צוחק|צוחקת},',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מַרְכִּין/ה רֹאשׁ וּמַאֲזִין/ה.',
    after: '{{childName}} {מוריד|מורידה} ראש ו{מאזין|מאזינה}.',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} מוריד ראש ומאזין.',
    after: '{{childName}} {מוריד|מורידה} ראש ו{מאזין|מאזינה}.',
    reason: 'explicit_chip',
  },
  {
    before:
      '"בְּהוֹדָעָה רְשְׁמִית," הוּא מַצְהִיר, "{{childName}} בּוֹחֵר/ת קוֹל נִבְחָר!"',
    after:
      '"בְּהוֹדָעָה רְשְׁמִית," הוּא מַצְהִיר, "{{childName}} {בוחר|בוחרת} קול נבחר!"',
    reason: 'explicit_chip',
  },
];

/** Applied after adventure enrich — fixes LLM-introduced slash forms in prose only. */
const S5_POST_ENRICH_PATCHES: ArtifactPatchEntry[] = [
  {
    before: 'והתקרב/ה',
    after: 'ומתקרבים עוד צעד',
    reason: 'neutral_rewrite',
  },
  {
    before: '{{childName}} מסתכל/ת',
    after: '{{childName}} {מסתכל|מסתכלת}',
    reason: 'explicit_chip',
  },
  {
    before: 'נוגע/ת',
    after: '{נוגע|נוגעת}',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} {הריח|הריחה} את הפופקורן ונשען/ה קדימה.',
    after: '{{childName}} {הריח|הריחה} את הפופקורן ו{נשען|נשענת} קדימה.',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} {מרים|מרימה} ראש, מרגיש/ה את הרגליים',
    after: '{{childName}} {מרים|מרימה} ראש, {מרגיש|מרגישה} את הרגליים',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} {הריע|הריעה} לו בשקט. טוּבִּי הרים חדק',
    after: '{{childName}} {מחייך|מחייכת} לו בשקט.\nטוּבִּי הרים חדק',
    reason: 'neutral_rewrite',
  },
  {
    before: 'הידיים שלו/שלה אוחזות בקצה המעקה',
    after: 'כפות יד אוחזות בקצה המעקה',
    reason: 'neutral_rewrite',
  },
  {
    before: 'מניח{‑|ה} יד על הבטן וצוחק{‑|ת} בשקט, כאילו גם היא זכרה',
    after: '{מניח|מניחה} יד על הבטן ו{צוחק|צוחקת} בשקט, כאילו זכרו את הרגע',
    reason: 'explicit_chip',
  },
  {
    before: 'בחדק הרך —',
    after: 'באוזן הרכה —',
    reason: 'neutral_rewrite',
  },
  {
    before: 'נשיפה יוצאת לאט, כמעט שירה.',
    after: 'נְשִׁיפָה יוצאת לאט, רכה וארוכה.',
    reason: 'neutral_rewrite',
  },
  {
    before: '{{childName}} {מחייך ומניח יד על הבטן|מחייכת ומניחה יד על הבטן}',
    after: '{{childName}} {מחייך|מחייכת} ו{מניח|מניחה} יד על הבטן',
    reason: 'explicit_chip',
  },
  {
    before: '{{childName}} {מושך את השרוול|מושכת את השרוול}',
    after: '{{childName}} {מושך|מושכת} את השרוול',
    reason: 'explicit_chip',
  },
  {
    before: 'שומע/ת',
    after: '{שומע|שומעת}',
    reason: 'explicit_chip',
  },
  {
    before: 'ו{מושיט|מושיטה} יד לחדק',
    after: 'ו{נוגע|נוגעת} בחוט הקצר שלו',
    reason: 'neutral_rewrite',
  },
  {
    before: 'נשיפה יוצאת לאט, כמעט שירה',
    after: 'נְשִׁיפָה יוצאת לאט, רכה וארוכה',
    reason: 'neutral_rewrite',
  },
];

const PATCHES_BY_SCENARIO: Record<string, ArtifactPatchEntry[]> = {
  tubi_s5_ha_zikukim_adv: S5_PATCHES,
  tubi_s2_ha_bayit_bed: S2_PATCHES,
};

const POST_ENRICH_PATCHES_BY_SCENARIO: Record<string, ArtifactPatchEntry[]> = {
  tubi_s5_ha_zikukim_adv: S5_POST_ENRICH_PATCHES,
};

export function applyPostEnrichDeterministicRepairs(markdown: string): {
  markdown: string;
  repairs: ArtifactPatchEntry[];
} {
  let out = markdown;
  const repairs: ArtifactPatchEntry[] = [];

  const regexRepairs: Array<{ pattern: RegExp; after: string; label: string }> = [
    {
      pattern: /מניח\{\s*יד\|ה\}/g,
      after: '{מניח|מניחה}',
      label: 'מניח{יד|ה}',
    },
    {
      pattern: /מניח\{\s*ה\|\s*\}/g,
      after: '{מניח|מניחה}',
      label: 'מניח{ה|}',
    },
    {
      pattern: /צוחק\{[^}]+\}/g,
      after: '{צוחק|צוחקת}',
      label: 'צוחק{…}',
    },
    {
      pattern: /מחזיק\{\s*ים\|ה\}/g,
      after: '{מחזיק|מחזיקה}',
      label: 'מחזיק{ים|ה}',
    },
    {
      pattern: /נושמ\{\s*ים\|ה\}/g,
      after: '{נושם|נושמת}',
      label: 'נושם{ים|ה}',
    },
    {
      pattern: /מניח\{\s*\|\s*ה\}/g,
      after: '{מניח|מניחה}',
      label: 'מניח{|ה}',
    },
    {
      pattern: /מרגיש\{\s*\|\s*ה\}/g,
      after: '{מרגיש|מרגישה}',
      label: 'מרגיש{|ה}',
    },
    {
      pattern: /מושך\{\s*את\|ת את\}/g,
      after: '{מושך|מושכת}',
      label: 'מושך{ את|ת את}',
    },
    {
      pattern: /ונ\{שם\|שמה\}/g,
      after: 'ו{נושם|נושמת}',
      label: 'ונ{שם|שמה}',
    },
    {
      pattern: /בודק\{\s*אם עוד ניצוץ נדלק\|ת אם עוד ניצוץ נדלק\}/g,
      after: '{בודק|בודקת} אם עוד ניצוץ נדלק',
      label: 'בודק{…}',
    },
    {
      pattern: /מניח\{\s*את\|ה\}/g,
      after: '{מניח|מניחה}',
      label: 'מניח{ את|ה}',
    },
    {
      pattern: /נושם\{\s*עמוק\|ת עמוק\}/g,
      after: '{נושם|נושמת} עמוק',
      label: 'נושם{ עמוק|ת עמוק}',
    },
  ];

  for (const { pattern, after, label } of regexRepairs) {
    pattern.lastIndex = 0;
    if (!pattern.test(out)) continue;
    pattern.lastIndex = 0;
    const before = out.match(pattern)?.[0] ?? label;
    out = out.replace(pattern, after);
    repairs.push({ before, after, reason: 'explicit_chip' });
  }

  const lines = out.split('\n');
  const fixedLines = lines.map((line) => {
    const stripped = stripHebrewDiacritics(line);
    if (!line.includes('{{childName}}') || !stripped.includes('חדק')) {
      return line;
    }
    const childIdx = stripped.indexOf('{{childName}}');
    const trunkIdx = stripped.indexOf('חדק');
    if (childIdx < 0 || trunkIdx < 0 || Math.abs(childIdx - trunkIdx) > 48) {
      return line;
    }

    if (trunkIdx < childIdx) {
      const beforeChild = line.slice(0, line.indexOf('{{childName}}'));
      const afterChild = line.slice(line.indexOf('{{childName}}'));
      const trunkLocal = stripHebrewDiacritics(beforeChild).indexOf('חדק');
      const segment = beforeChild.slice(trunkLocal);
      const splitAt = Math.max(segment.lastIndexOf(' — '), segment.lastIndexOf(' ו'));
      if (splitAt > 0) {
        const absolute = trunkLocal + splitAt;
        const fixed =
          `${beforeChild.slice(0, absolute).trimEnd()}.\n${beforeChild.slice(absolute).trimStart()}${afterChild}`;
        repairs.push({
          before: line.trim().slice(0, 72),
          after: fixed.trim().slice(0, 72),
          reason: 'neutral_rewrite',
        });
        return fixed;
      }
      const fixed = `${beforeChild.trimEnd()}.\n${afterChild.trimStart()}`;
      repairs.push({
        before: line.trim().slice(0, 72),
        after: fixed.trim().slice(0, 72),
        reason: 'neutral_rewrite',
      });
      return fixed;
    }

    const split = line.replace(
      /(\{\{childName\}\}[^.\n!?]*[.!?])\s+([^\n]{0,24}חדק)/u,
      '$1\n$2'
    );
    if (split !== line) {
      repairs.push({
        before: line.trim().slice(0, 72),
        after: split.trim().slice(0, 72),
        reason: 'neutral_rewrite',
      });
    }
    return split;
  });
  out = fixedLines.join('\n');

  const slashFixes: Array<[string, string]> = [
    ['שלו/שלה', '{שלו|שלה}'],
    ['נופל/ת', '{נופל|נופלת}'],
    ['מזיז/ה', '{מזיז|מזיזה}'],
    ['ומיישר/ת', '{ומיישר|ומיישרת}'],
    ['שומע/ת', '{שומע|שומעת}'],
  ];
  for (const [before, after] of slashFixes) {
    if (!out.includes(before)) continue;
    out = out.split(before).join(after);
    repairs.push({ before, after, reason: 'explicit_chip' });
  }

  return { markdown: out, repairs };
}

export function applyWritersRoomArtifactPatches(
  scenarioId: string,
  markdown: string,
  phase: 'pre' | 'post' = 'pre'
): { markdown: string; report: ArtifactPatchReport } {
  const replacements =
    phase === 'post'
      ? (POST_ENRICH_PATCHES_BY_SCENARIO[scenarioId] ?? [])
      : (PATCHES_BY_SCENARIO[scenarioId] ?? []);
  const { markdown: out, applied } = applyReplacements(markdown, replacements);
  return {
    markdown: out,
    report: {
      scenarioId,
      patches: applied,
      patchCount: applied.length,
    },
  };
}

export function patchWritersRoomOutline(
  scenarioId: string,
  outline: StoryOutline
): StoryOutline {
  const o = structuredClone(outline);
  if (scenarioId === 'tubi_s5_ha_zikukim_adv') {
    o.metadata.stakes =
      '{{childName}} רוצה לראות את הזיקוקים אך הבּוּמים גדולים מדי; אם יוצאים מהר מדי — היופי נשאר רחוק; אם נשארים בלי גבול — מציף.';
    o.metadata.agencyTransfer =
      'עמוד 9 — {{childName}} {מחליט|מחליטה} איפה לעמוד ומה נכנס לאוזניים.';
    o.powerCard.steps = [
      'כפות על הרצפה',
      '{נושם|נושמת} נשיפה קטנה מהאף',
      'אוזניים באמצע — חצי וילון',
      '{בוחר|בוחרת} קול אחד, השאר מעבר לחלון',
    ];
  }
  if (scenarioId === 'tubi_s2_ha_bayit_bed') {
    o.metadata.uncomfortableTruth =
      'עמוד 4 — {{childName}} {מפחד|מפחדת} שאם האוזניים סגורות מדי — קול אמא נשאר רחוק.';
    o.metadata.agencyTransfer =
      'עמוד 6 — כאן {{childName}} מראה לטוּבִּי איך לבחור קול אחד.';
    o.metadata.heartLine =
      'עמוד 6 — {{childName}} {בוחר|בוחרת} קול קטן וְטוּבִּי מַנִּיף אֹזֶן לַאֶמְצַע.';
    o.powerCard.steps = [
      '{מניח|מניחה} כפות על הרצפה',
      '{נושם|נושמת} נשיפה קטנה מהאף',
      '{מוריד|מורידה} אוזניים לאמצע — חצי אוזן',
      '{בוחר|בוחרת} קול אחד שנשמע קרוב',
    ];
  }
  return o;
}
