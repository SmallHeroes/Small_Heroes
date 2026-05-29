import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GOLDEN_SHELF_POWER_CARD_SLUGS,
  GOLDEN_SHELF_STORY_DIR,
  goldenShelfStoryFilename,
  parseAndValidateStoryPowerCard,
  parsePowerCardFromFrontmatterYaml,
  resolvePowerCard,
  validatePowerCardRaw,
} from '../index';

const VALID_POWER_CARD_YAML = `powerCard:
  title: "כרטיס הכוח של {{childName}}"
  subtitle: "כשאני מרגיש/ה שהחום עולה"
  coreTool: "safe anger release"
  steps:
    - "אני עוצר/ת רגע"
    - "אני מוצא/ת מקום בטוח"
    - "אני נותן/ת לחום לצאת בלי לפגוע"
    - "ואז אני חוזר/ת לדבר"
  companionReminder: "יש דברים שלא צריך לשבור."
  visualMotifs:
    - "roaring pond ripple"
    - "smooth stone"
    - "fallen log"
    - "bear cub paw print"`;

describe('powerCard parse + validate', () => {
  it('parses a valid inline powerCard block', () => {
    const raw = parsePowerCardFromFrontmatterYaml(VALID_POWER_CARD_YAML);
    const { spec, issues } = validatePowerCardRaw(raw);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(spec?.steps).toHaveLength(4);
    expect(spec?.title).toContain('{{childName}}');
  });

  it('resolvePowerCard returns spec from inline powerCard', () => {
    const raw = parsePowerCardFromFrontmatterYaml(VALID_POWER_CARD_YAML);
    const spec = resolvePowerCard({ powerCard: raw });
    expect(spec.coreTool).toBe('safe anger release');
  });

  it('resolvePowerCard throws when powerCardId is set (MVP)', () => {
    expect(() => resolvePowerCard({ powerCardId: 'calm-breath' })).toThrow(
      'Not implemented in MVP',
    );
  });

  it('resolvePowerCard throws when block is missing', () => {
    expect(() => resolvePowerCard({})).toThrow('Story has neither powerCard nor powerCardId');
  });

  it('rejects wrong step count with editor-friendly message', () => {
    const raw = parsePowerCardFromFrontmatterYaml(`powerCard:
  title: "כרטיס של {{childName}}"
  subtitle: "כשקשה"
  coreTool: "test"
  steps:
    - "אחד"
    - "שניים"
    - "שלוש"
  companionReminder: "שורה קצרה."
  visualMotifs:
    - "a"
    - "b"
    - "c"`);
    const { spec, issues } = validatePowerCardRaw(raw);
    expect(spec).toBeNull();
    expect(issues.some((i) => i.message.includes('exactly 4'))).toBe(true);
  });

  it('rejects parentheses in steps', () => {
    const raw = {
      title: 'כרטיס של {{childName}}',
      subtitle: 'כשקשה',
      coreTool: 'test',
      steps: ['אחד (לא)', 'שניים', 'שלוש', 'ארבע'],
      companionReminder: 'שורה קצרה.',
      visualMotifs: ['a', 'b', 'c'],
    };
    const { spec, issues } = validatePowerCardRaw(raw);
    expect(spec).toBeNull();
    expect(issues.some((i) => i.path.includes('steps[0]') && i.message.includes('parentheses'))).toBe(
      true,
    );
  });

  it('loads bear_cub_gahal_adventure golden shelf story', () => {
    const filePath = path.join(
      process.cwd(),
      GOLDEN_SHELF_STORY_DIR,
      goldenShelfStoryFilename('bear_cub_gahal_adventure'),
    );
    const markdown = fs.readFileSync(filePath, 'utf8');
    const result = parseAndValidateStoryPowerCard(markdown, 'bear_cub_gahal_adventure');
    expect(result.spec).not.toBeNull();
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.spec?.steps[3]).toContain('חוזר');
  });

  it('validates all 19 golden shelf powerCard blocks', () => {
    const failures: string[] = [];
    for (const slug of GOLDEN_SHELF_POWER_CARD_SLUGS) {
      const filePath = path.join(
        process.cwd(),
        GOLDEN_SHELF_STORY_DIR,
        goldenShelfStoryFilename(slug),
      );
      const markdown = fs.readFileSync(filePath, 'utf8');
      const result = parseAndValidateStoryPowerCard(markdown, slug);
      const errors = result.issues.filter((i) => i.severity === 'error');
      if (!result.spec || errors.length > 0) {
        failures.push(
          `${slug}: ${errors.map((e) => e.message).join('; ') || 'missing spec'}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
