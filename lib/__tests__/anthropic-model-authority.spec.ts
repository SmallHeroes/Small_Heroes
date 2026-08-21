import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS,
  ANTHROPIC_MODEL_AUTHORITY_VERSION,
  ANTHROPIC_PATCH_MODEL_DEFAULT,
  ANTHROPIC_RETIRED_MODEL_IDS,
  ANTHROPIC_SUPPORT_MODEL_DEFAULT,
  ANTHROPIC_VISION_MODEL_DEFAULT,
} from '../../backend/providers/anthropic-model-authority';

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
      for (const match of source.matchAll(/claude-[a-z0-9-]+/gu)) {
        const locations = found.get(match[0]) ?? [];
        locations.push(path.relative(root, file).replace(/\\/gu, '/'));
        found.set(match[0], locations);
      }
    }

    expect([...found.keys()].sort()).toEqual(
      [...new Set(found.keys())]
        .filter((model) =>
          ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS.includes(
            model as (typeof ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS)[number]
          )
        )
        .sort()
    );
    for (const retired of ANTHROPIC_RETIRED_MODEL_IDS) {
      expect(found.has(retired), `${retired} found in ${found.get(retired)?.join(', ')}`).toBe(false);
    }
  });
});
