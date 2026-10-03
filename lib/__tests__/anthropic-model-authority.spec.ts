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

// Guy approved this one-use native CLI diagnostic, not a production model
// migration. Keep exceptions local to exact token/file pairs, never runtime defaults.
const diagnosticReferences: Record<string, readonly string[]> = {
  'scripts/personal-opus-semantic-cohort.cjs': ['claude-opus-5-5'],
};
const diagnosticFile = 'scripts/personal-opus-semantic-cohort.cjs';
const reviewedCliLiteral = "'C:/Users/guyna/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe'";
function sourceForModelScan(relativeFile: string, source: string): string {
  // This exact quoted transport path is not a model ID. Remove at most one
  // occurrence in the reviewed diagnostic; a different path/token still fails.
  return relativeFile === diagnosticFile ? source.replace(reviewedCliLiteral, "''") : source;
}
function authorizedReference(model: string, relativeFile: string): boolean {
  if ((ANTHROPIC_RETIRED_MODEL_IDS as readonly string[]).includes(model)) return false;
  return (ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS as readonly string[]).includes(model)
    || Object.prototype.hasOwnProperty.call(diagnosticReferences, relativeFile) && diagnosticReferences[relativeFile].includes(model);
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
  it('limits the approved diagnostic model and CLI namespace to their exact source file', () => {
    const diagnostic = 'scripts/personal-opus-semantic-cohort.cjs';
    for (const token of ['claude-opus-5-5']) {
      expect(authorizedReference(token, diagnostic)).toBe(true);
      expect(ANTHROPIC_AUTHORIZED_HARDCODED_MODEL_IDS).not.toContain(token);
      for (const other of ['app/api/generate/route.ts', 'backend/providers/story.ts', 'lib/story.ts',
        'scripts/another-cohort.cjs', diagnostic + '.bak', 'toString']) {
        expect(authorizedReference(token, other)).toBe(false);
      }
    }
    for (const token of [...ANTHROPIC_RETIRED_MODEL_IDS, 'claude-unapproved', 'claude-code']) {
      expect(authorizedReference(token, diagnostic)).toBe(false);
    }
  });
  it('treats only the exact diagnostic executable literal as a non-model transport reference', () => {
    const source = fs.readFileSync(path.join(process.cwd(), diagnosticFile), 'utf8');
    expect(source).toContain(`const CLI = ${reviewedCliLiteral};`);
    expect(source).toContain("MODEL = 'claude-opus-5-5'");
    expect(sourceForModelScan(diagnosticFile, reviewedCliLiteral)).toBe("''");
    for (const other of ['app/api/generate/route.ts', 'scripts/other.cjs']) {
      expect(sourceForModelScan(other, reviewedCliLiteral)).toBe(reviewedCliLiteral);
    }
    for (const unreviewed of ["'claude-code'", reviewedCliLiteral.replace('/bin/', '/other/'),
      reviewedCliLiteral + ' ' + reviewedCliLiteral]) {
      expect(sourceForModelScan(diagnosticFile, unreviewed)).toMatch(/claude-code/u);
    }
  });
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
      const relativeFile = path.relative(root, file).replace(/\\/gu, '/');
      const source = sourceForModelScan(relativeFile, fs.readFileSync(file, 'utf8'));
      for (const match of source.matchAll(/claude-[a-z0-9-]+/gu)) {
        const locations = found.get(match[0]) ?? [];
        locations.push(relativeFile);
        found.set(match[0], locations);
      }
    }

    for (const [model, locations] of found) {
      for (const location of locations) {
        expect(authorizedReference(model, location), `${model} found in ${location}`).toBe(true);
      }
    }
    for (const retired of ANTHROPIC_RETIRED_MODEL_IDS) {
      expect(found.has(retired), `${retired} found in ${found.get(retired)?.join(', ')}`).toBe(false);
    }
  });
});
