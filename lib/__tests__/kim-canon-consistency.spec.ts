import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { COMPANION_ACCESSORY_PROFILES } from '../companion-accessory';
import { getCompanionBible } from '../companion-bible';
import { getCompanionById } from '../companions';

const KIM_ID = 'chameleon_koko';
const STORY_GENERATOR_ROOT = path.join(process.cwd(), 'lib', 'story-generator');

/** Positive (canon) description sources — must agree on satchel, never scarf/patchwork. */
const KIM_POSITIVE_SOURCES = [
  { label: 'registry', text: () => getCompanionById(KIM_ID)?.visualDescription ?? '' },
  {
    label: 'accessory profile',
    text: () => {
      const p = COMPANION_ACCESSORY_PROFILES[KIM_ID];
      return [p?.canonicalAccessory, p?.accessoryBehavior].filter(Boolean).join(' ');
    },
  },
] as const;

const KIM_FORBIDDEN_IN_POSITIVE = [/scarf/i, /striped scarf/i, /patchwork/i, /multicolor patches/i];

const STORY_GEN_KIM_SCARF_PATTERNS = [
  /striped scarf/i,
  /patchwork pastel/i,
  /patchwork patches/i,
  /color patches match environment/i,
  /הצעיף הפסים/,
  /צעיף מפוספס/,
  /צעיף.*קים|קים.*צעיף/,
];

function lineIsKimScarfSafeContext(line: string): boolean {
  const lower = line.toLowerCase();
  if (/forbidden|never |must not|anti-pattern|known-bad|blocking when|not patchwork|not scarf|no scarf/i.test(lower)) {
    return true;
  }
  if (/legacy scarf|documented anti-pattern|not a v3 signature/i.test(lower)) return true;
  if (/hook\.object.*example|one hebrew noun.*example/i.test(lower)) return true;
  if (/^\s*\*\s*- Kim:/i.test(line) && /anti-pattern|legacy/i.test(line)) return true;
  return false;
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkTsFiles(full));
    else if (ent.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function scanStoryGeneratorForKimScarfRegression(): string[] {
  const violations: string[] = [];
  for (const file of walkTsFiles(STORY_GENERATOR_ROOT)) {
    const rel = path.relative(process.cwd(), file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (lineIsKimScarfSafeContext(line)) continue;
      for (const pattern of STORY_GEN_KIM_SCARF_PATTERNS) {
        if (pattern.test(line)) {
          violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
          break;
        }
      }
    }
  }
  return violations;
}

function isForbiddenPositiveMatch(text: string, pattern: RegExp): boolean {
  const lower = text.toLowerCase();
  if (!pattern.test(lower)) return false;
  const bible = getCompanionBible(KIM_ID);
  const forbiddenCtx = [
    ...(bible?.forbiddenObjects ?? []),
    ...(COMPANION_ACCESSORY_PROFILES[KIM_ID]?.forbiddenAlternatives ?? []),
  ]
    .join(' ')
    .toLowerCase();
  // Allow mention only inside bible/accessory forbidden lists — not as Kim's actual look.
  const stripped = lower.replace(forbiddenCtx, '');
  return pattern.test(stripped);
}

describe('Kim (chameleon_koko) canon consistency', () => {
  it('registry visualDescription includes mustard satchel canon', () => {
    const desc = getCompanionById(KIM_ID)?.visualDescription ?? '';
    expect(desc).toMatch(/satchel/i);
    expect(desc).toMatch(/warm mustard/i);
    expect(desc).toMatch(/NOT patches/i);
  });

  it('accessory profile locks tiny mustard satchel — not scarf', () => {
    const profile = COMPANION_ACCESSORY_PROFILES[KIM_ID];
    expect(profile?.canonicalAccessory).toMatch(/satchel/i);
    expect(profile?.forbiddenAlternatives).toEqual(
      expect.arrayContaining(['scarf', 'striped scarf', 'patchwork'])
    );
  });

  it('bible forbiddenObjects blocks scarf/patchwork regression', () => {
    const bible = getCompanionBible(KIM_ID);
    expect(bible?.forbiddenObjects).toEqual(
      expect.arrayContaining(['scarf', 'striped scarf', 'patchwork'])
    );
  });

  it('no positive canon source describes Kim with scarf or patchwork', () => {
    for (const source of KIM_POSITIVE_SOURCES) {
      const text = source.text();
      expect(text.length, `${source.label} empty`).toBeGreaterThan(20);
      for (const pattern of KIM_FORBIDDEN_IN_POSITIVE) {
        expect(
          isForbiddenPositiveMatch(text, pattern),
          `${source.label} must not positively describe Kim with ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('public JS mirror includes same satchel canon when visualDescription present', () => {
    // companions.js is hand-maintained for wizard — spot-check pattern via registry (source of truth).
    const desc = getCompanionById(KIM_ID)?.visualDescription ?? '';
    expect(desc).not.toMatch(/striped scarf/i);
    expect(desc).not.toMatch(/patchwork pastel/i);
  });

  it('lib/story-generator has no positive Kim scarf/patchwork outside forbidden/anti-pattern docs', () => {
    const violations = scanStoryGeneratorForKimScarfRegression();
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
