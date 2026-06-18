import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  GOLDEN_SHELF_POWER_CARD_SLUGS,
  goldenShelfStoryRelPath,
  extractYamlFrontmatterBlock,
  parsePowerCardFromFrontmatterYaml,
  resolvePowerCard,
} from '../power-cards';
import {
  resolveSlashedGenderForms,
  resolveStoryBankPlaceholders,
} from '../story-bank-personalization';

const UNRESOLVED_HEBREW_SLASH_RE =
  /[\u0590-\u05FF]+\/[\u0590-\u05FF]+(?=$|[^\u0590-\u05FF])/u;

function loadGoldenPowerCardLines(): string[] {
  const lines: string[] = [];
  for (const slug of GOLDEN_SHELF_POWER_CARD_SLUGS) {
    const filePath = path.join(process.cwd(), goldenShelfStoryRelPath(slug));
    const markdown = fs.readFileSync(filePath, 'utf8');
    const yamlBlock = extractYamlFrontmatterBlock(markdown);
    expect(yamlBlock, `${slug} frontmatter`).toBeTruthy();
    const raw = parsePowerCardFromFrontmatterYaml(yamlBlock!);
    const spec = resolvePowerCard({ powerCard: raw });
    lines.push(spec.title, spec.subtitle, ...spec.steps);
  }
  return lines;
}

describe('Hebrew gender slash resolver', () => {
  it('resolves /ה forms', () => {
    expect(resolveSlashedGenderForms('אני מרגיש/ה', 'girl')).toBe('אני מרגישה');
    expect(resolveSlashedGenderForms('אני מרגיש/ה', 'boy')).toBe('אני מרגיש');
    expect(resolveSlashedGenderForms('אני שם/ה יד', 'girl')).toBe('אני שמה יד');
    expect(resolveSlashedGenderForms('אני מקשיב/ה', 'girl')).toBe('אני מקשיבה');
    expect(resolveSlashedGenderForms('אני נח/ה', 'girl')).toBe('אני נחה');
    expect(resolveSlashedGenderForms('חזק/ה', 'girl')).toBe('חזקה');
    expect(resolveSlashedGenderForms('אני לא צריך/ה', 'girl')).toBe('אני לא צריכה');
  });

  it('resolves /ת forms', () => {
    expect(resolveSlashedGenderForms('אני נותן/ת', 'girl')).toBe('אני נותנת');
    expect(resolveSlashedGenderForms('אני נותן/ת', 'boy')).toBe('אני נותן');
    expect(resolveSlashedGenderForms('אני נושם/ת', 'girl')).toBe('אני נושמת');
    expect(resolveSlashedGenderForms('אני זוכר/ת', 'girl')).toBe('אני זוכרת');
    expect(resolveSlashedGenderForms('אני בודק/ת', 'girl')).toBe('אני בודקת');
    expect(resolveSlashedGenderForms('אני מרכך/ת', 'girl')).toBe('אני מרככת');
    expect(resolveSlashedGenderForms('אני מסתכל/ת', 'girl')).toBe('אני מסתכלת');
    expect(resolveSlashedGenderForms('ולא צועק/ת', 'boy')).toBe('ולא צועק');
  });

  it('resolves multiple slashes in one line', () => {
    expect(
      resolveSlashedGenderForms('אני נושם/ת ומחפש/ת רק את הצעד הבא', 'girl')
    ).toBe('אני נושמת ומחפשת רק את הצעד הבא');
  });

  it('clears every gender slash in golden-shelf powerCard copy (boy + girl)', () => {
    const lines = loadGoldenPowerCardLines();
    expect(lines.length).toBeGreaterThan(0);

    for (const raw of lines) {
      const boy = resolveStoryBankPlaceholders(raw, {
        childName: 'איתי',
        childGender: 'boy',
        companionName: 'בולי',
      });
      const girl = resolveStoryBankPlaceholders(raw, {
        childName: 'נועה',
        childGender: 'girl',
        companionName: 'לילי',
      });

      expect(UNRESOLVED_HEBREW_SLASH_RE.test(boy), `boy leftover slash in: ${raw}`).toBe(false);
      expect(UNRESOLVED_HEBREW_SLASH_RE.test(girl), `girl leftover slash in: ${raw}`).toBe(false);
    }
  });
});
