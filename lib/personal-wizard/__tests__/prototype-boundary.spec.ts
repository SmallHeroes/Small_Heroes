/**
 * Static boundary checks for the personal Wizard prototype source: no browser persistence, no
 * order/checkout/release path, no provider SDK in the prototype, and the fixture never takes audio.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIRS = ['lib/personal-wizard', 'app/dev/personal-wizard', 'app/api/dev/personal-wizard'];

function sourceFiles(dir: string): string[] {
  const absolute = join(ROOT, dir);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(relative(ROOT, path));
    return /\.(ts|tsx|css)$/.test(entry.name) ? [relative(ROOT, path).replace(/\\/g, '/')] : [];
  });
}

const files = DIRS.flatMap(sourceFiles);
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('personal Wizard prototype boundaries', () => {
  it('has source files to check', () => {
    expect(files).toContain('lib/personal-wizard/contract.ts');
    expect(files).toContain('app/dev/personal-wizard/PersonalWizard.tsx');
  });

  it('never persists the draft or audio in browser storage', () => {
    for (const file of files) {
      expect(read(file), file).not.toMatch(/\b(sessionStorage|localStorage|indexedDB)\s*[.[(]/);
    }
  });

  it('does not reach the order, checkout or release/v1 paths', () => {
    for (const file of files) {
      expect(read(file), file).not.toMatch(/\/api\/orders|\/api\/checkout|\/api\/release|release\/v1/);
    }
  });

  it('confines the provider SDK and key access to the two live-intake modules', () => {
    const PROVIDER_SDK_ALLOWED = 'lib/personal-wizard/intake-openai.ts';
    const KEY_READ_ALLOWED = 'lib/personal-wizard/intake-config.ts';
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/elevenlabs/i);
      if (file !== PROVIDER_SDK_ALLOWED) expect(source, file).not.toMatch(/from 'openai'/);
      if (file !== KEY_READ_ALLOWED) expect(source, file).not.toMatch(/OPENAI_API_KEY/);
    }
    expect(read(PROVIDER_SDK_ALLOWED)).toMatch(/maxRetries: 0/);
    expect(read(PROVIDER_SDK_ALLOWED)).toMatch(/store: false/);
  });

  it('keeps provider and server-only intake modules out of client components', () => {
    const clientFiles = files.filter((file) => file.startsWith('app/dev/personal-wizard/') && file !== 'app/dev/personal-wizard/page.tsx');
    for (const file of clientFiles) {
      expect(read(file), file).not.toMatch(
        /^import (?!type)[^;]*from '@\/lib\/personal-wizard\/(intake-openai|intake-service|intake-gate|intake-config|intake-ledger|audio-probe)'/m,
      );
    }
  });

  it('the fixture intake has no audio input', () => {
    const fixture = read('lib/personal-wizard/intake-fixture.ts');
    const requestType = fixture.slice(fixture.indexOf('export type FixtureIntakeRequest'), fixture.indexOf('};', fixture.indexOf('export type FixtureIntakeRequest')));
    expect(requestType).not.toMatch(/Blob|audio|clip|File/i);
  });

  it('client components import server-only modules for types only', () => {
    const clientFiles = files.filter((file) => file.startsWith('app/dev/personal-wizard/') && file.endsWith('.tsx') && !file.endsWith('page.tsx'));
    for (const file of clientFiles) {
      const source = read(file);
      expect(source.startsWith("'use client';"), file).toBe(true);
      expect(source, file).not.toMatch(/^import (?!type)[^;]*from '@\/lib\/personal-wizard\/(options|request-acceptance)'/m);
    }
  });
});
