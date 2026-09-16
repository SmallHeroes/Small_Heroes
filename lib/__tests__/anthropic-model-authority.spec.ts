import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { comparisonModels } from '../visual-qa-comparison';

import {
  ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS,
  ANTHROPIC_MODEL_AUTHORITY_VERSION,
  ANTHROPIC_PATCH_MODEL_DEFAULT,
  ANTHROPIC_RETIRED_MODEL_IDS,
  ANTHROPIC_SUPPORT_MODEL_DEFAULT,
  ANTHROPIC_VISION_MODEL_DEFAULT,
} from '../../backend/providers/anthropic-model-authority';

// Existing Replicate configuration is a separate namespace, not a first-party
// Claude API model. Pin the exact registry location; never exempt a whole provider.
const replicateRegistry = 'lib/visual-qa-comparison.ts';
const replicateModel = 'anthropic/claude-4.5-sonnet';

function modelTokens(source: string): string[] {
  return [...source.matchAll(/[a-zA-Z0-9_./-]*claude-[a-zA-Z0-9_./-]+/gu)].map((match) => match[0]);
}

function permitted(model: string, location: string): boolean {
  return ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS.includes(
    model as (typeof ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS)[number],
  ) || (model === replicateModel && location === replicateRegistry);
}

function productionSourceFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.next', 'outputs', 'docs', '__tests__'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(?:ts|tsx|js|cjs|mjs)$/u.test(entry.name)) files.push(absolute);
    }
  };
  for (const directory of ['app', 'backend', 'lib', 'scripts']) {
    visit(path.join(root, directory));
  }
  return files;
}

describe('Anthropic hardcoded model authority', () => {
  it('binds the retired defaults to Anthropic documented active replacements', () => {
    expect(ANTHROPIC_MODEL_AUTHORITY_VERSION).toBe(
      'small-heroes-anthropic-model-authority/2026-08-22'
    );
    expect(ANTHROPIC_SUPPORT_MODEL_DEFAULT).toBe('claude-sonnet-4-6');
    expect(ANTHROPIC_VISION_MODEL_DEFAULT).toBe('claude-sonnet-4-6');
    expect(ANTHROPIC_PATCH_MODEL_DEFAULT).toBe('claude-haiku-4-5-20251001');
  });

  it('contains no unknown or retired hardcoded Claude model in production call sites', () => {
    const root = process.cwd();
    const authorityFile = path.normalize(
      path.join(root, 'backend/providers/anthropic-model-authority.ts')
    );
    const found = new Map<string, string[]>();
    for (const file of productionSourceFiles(root)) {
      if (path.normalize(file) === authorityFile) continue;
      const source = fs.readFileSync(file, 'utf8');
      for (const model of modelTokens(source)) {
        const locations = found.get(model) ?? [];
        locations.push(path.relative(root, file).replace(/\\/gu, '/'));
        found.set(model, locations);
      }
    }

    expect(found.size).toBeGreaterThan(0);
    expect([...found.entries()].flatMap(([model, locations]) =>
      locations.filter((location) => !permitted(model, location)).map((location) => ({ model, location })),
    )).toEqual([]);
    for (const retired of ANTHROPIC_RETIRED_MODEL_IDS) {
      expect(found.has(retired), `${retired} found in ${found.get(retired)?.join(', ')}`).toBe(false);
    }
  });

  it('pins the existing Replicate registry entry without changing model authority', () => {
    expect(comparisonModels.sonnet).toEqual({
      name: replicateModel,
      version: '459655107e29a683cb6deb73a9640cf9aeae39ea7c87803a2ae81c311f6ef44f',
    });
    expect(permitted(replicateModel, replicateRegistry)).toBe(true);
    expect(permitted(replicateModel, 'scripts/another-provider.ts')).toBe(false);
  });

  it('preserves complete qualified and dotted tokens instead of authorizing substrings', () => {
    const tokens = [
      replicateModel, 'claude-sonnet-4-6', 'claude-4.5-sonnet',
      'anthropic/claude-unknown', 'other/claude-sonnet-4-6',
      'prefix/anthropic/claude-4.5-sonnet', 'preclaude-sonnet-4-6',
      'claude-sonnet-4-6/unknown', 'claude-4', ...ANTHROPIC_RETIRED_MODEL_IDS,
    ];
    expect(modelTokens(tokens.map((token) => JSON.stringify(token)).join(', '))).toEqual(tokens);
    expect(tokens.map((token) => permitted(token, replicateRegistry))).toEqual(
      tokens.map((_, index) => index < 2),
    );
  });
});
