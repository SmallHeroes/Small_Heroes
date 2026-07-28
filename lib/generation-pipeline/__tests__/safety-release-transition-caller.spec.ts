import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  createRepositorySourceInventory,
  STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS,
} from '../../__tests__/helpers/repository-source-inventory';

/**
 * (release-as-readiness-mode, 2a-2 — same discipline as the writer guard) The marker transition
 * `executeSafetyFalsePositiveReleaseTransition` is the ONE sanctioned rank-3→lower safety-marker move — an authorised
 * bypass of the precedence guard that makes a safety hold sticky. It must be structurally impossible to invoke outside
 * the release action: the ONLY files allowed to NAME it are its definition (order-authority.ts) and its SINGLE caller,
 * the release mode (safety-release.ts). Any other reference is a build failure — that is what stops it becoming a
 * general `downgradeMarker`.
 */
const ROOT = process.cwd();
const FN = 'executeSafetyFalsePositiveReleaseTransition';
const ALLOWED = new Set([
  'lib/generation-pipeline/order-authority.ts', // definition + export
  'lib/generation-pipeline/safety-release.ts',  // the single caller (applyReleaseInTx)
]);
const repositorySources = createRepositorySourceInventory({
  root: ROOT,
  roots: ['app', 'lib', 'backend'],
  extensions: ['.ts'],
  excludedEntryNames: ['node_modules', '__tests__'],
  excludeDotEntries: true,
});

describe('release marker transition — single caller enforced', () => {
  it('executeSafetyFalsePositiveReleaseTransition is referenced ONLY by its definition + the release mode', () => {
    const offenders: string[] = [];
    const sources = repositorySources();
    for (const allowed of ALLOWED) {
      expect(
        sources.some(({ relative }) => relative === allowed),
        `${allowed} must be present in the repository inventory`,
      ).toBe(true);
    }
    for (const { relative, text } of sources) {
      if (ALLOWED.has(relative)) continue;
      if (text.includes(FN)) offenders.push(relative);
    }
    expect(offenders).toEqual([]);
  }, STRUCTURAL_REPOSITORY_SCAN_TIMEOUT_MS);

  it('the sanctioned files DO reference it (the guard is not vacuous)', () => {
    for (const rel of ALLOWED) {
      expect(readFileSync(path.join(ROOT, rel), 'utf8'), `${rel} must reference ${FN}`).toContain(FN);
    }
  });
});
