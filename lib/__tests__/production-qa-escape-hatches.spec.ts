import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  loadStoryFromBank,
  loadStoryFromBankContent,
} from '../../backend/providers/story-bank-loader';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from './helpers/repository-source-inventory';

const ROOT = process.cwd();
const DINI_BEDTIME = path.join(ROOT, 'story-bank', 'v3-approved', 'dragon_dini_bedtime.md');
const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['.'],
  extensions: ['.ts', '.tsx', '.js', '.mjs'],
  excludedDirectoryNames: ['node_modules', '.git', '.next'],
  followDirectorySymlinks: false,
});

describe('production QA escape-hatches', () => {
  it('skipPromptAudit is confined to qa-console + experiments scripts (not chunk-runner / app api)', () => {
    const hits: string[] = [];
    const sources = repositorySources();
    expect(
      sources.some(({ relative }) => relative === 'lib/__tests__/production-qa-escape-hatches.spec.ts'),
      'the production source inventory must include this non-vacuity guard',
    ).toBe(true);
    for (const { relative, text } of sources) {
      if (!text.includes('skipPromptAudit')) continue;
      const allowed =
        relative === 'lib/qa-console-run.ts' ||
        relative.startsWith('scripts/experiments/') ||
        relative === 'lib/__tests__/production-qa-escape-hatches.spec.ts';
      if (!allowed) hits.push(relative);
    }
    expect(hits).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('chunk-runner production path passes skipLlmPersonalization to loadStoryFromBank (bank chips, not LLM)', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'lib', 'generation-pipeline', 'chunk-runner.ts'),
      'utf8'
    );
    const loadCalls = [...src.matchAll(/loadStoryFromBank\([\s\S]*?\{ skipLlmPersonalization: true \}/g)];
    expect(loadCalls.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(
      /v3-approved bank stories personalize via \{\{childName\}\} \+ gender chips/
    );
  });

  it('v3 bank path resolves gender chips with skipLlmPersonalization (no LLM rewrite)', async () => {
    if (!fs.existsSync(DINI_BEDTIME)) return;

    const girlStory = await loadStoryFromBank(DINI_BEDTIME, 'נועה', 'דיני', 'girl', {
      skipLlmPersonalization: true,
    });
    const boyStory = await loadStoryFromBank(DINI_BEDTIME, 'יואב', 'דיני', 'boy', {
      skipLlmPersonalization: true,
    });

    const girlP6 = girlStory.pages.find((p) => p.pageNumber === 6)?.text ?? '';
    const boyP6 = boyStory.pages.find((p) => p.pageNumber === 6)?.text ?? '';

    expect(girlP6).toMatch(/נועה/);
    expect(girlP6).toMatch(/הסתכלה|תפסה|פתחה/);
    expect(girlP6).not.toMatch(/\{[^}]+\}/);

    expect(boyP6).toMatch(/יואב/);
    expect(boyP6).toMatch(/הסתכל|תפס[^ה]|פתח[^ה]/);
    expect(boyP6).not.toMatch(/\{[^}]+\}/);
  });

  it('recognizes neutral source metadata while resolving customer prose only from Wizard gender', async () => {
    const source = [
      'title: "הסיפור של {{childName}}"',
      'gender: neutral',
      '',
      '--- Page 1 ---',
      '{{childName}} {נכנס|נכנסה} לחדר {שלו|שלה}.',
      'imageDirection: the child enters the room',
    ].join('\n');
    const [boy, girl] = await Promise.all([
      loadStoryFromBankContent(source, 'בר', 'קִים', 'boy', {
        skipLlmPersonalization: true,
      }),
      loadStoryFromBankContent(source, 'נועה', 'קִים', 'girl', {
        skipLlmPersonalization: true,
      }),
    ]);

    expect(boy.pages[0]?.text).toBe('בר נכנס לחדר שלו.');
    expect(girl.pages[0]?.text).toBe('נועה נכנסה לחדר שלה.');
    expect(`${boy.pages[0]?.text}\n${girl.pages[0]?.text}`).not.toMatch(
      /\{[^}]+\}/,
    );
  });
});
