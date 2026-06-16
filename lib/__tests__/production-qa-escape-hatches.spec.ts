import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { loadStoryFromBank } from '../../backend/providers/story-bank-loader';

const ROOT = process.cwd();
const DINI_BEDTIME = path.join(ROOT, 'story-bank', 'v3-approved', 'dragon_dini_bedtime.md');

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      listSourceFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('production QA escape-hatches', () => {
  it('skipPromptAudit is confined to qa-console + experiments scripts (not chunk-runner / app api)', () => {
    const hits: string[] = [];
    for (const file of listSourceFiles(ROOT)) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      if (rel.startsWith('node_modules/')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes('skipPromptAudit')) continue;
      const allowed =
        rel === 'lib/qa-console-run.ts' ||
        rel.startsWith('scripts/experiments/') ||
        rel === 'lib/__tests__/production-qa-escape-hatches.spec.ts';
      if (!allowed) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

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
});
