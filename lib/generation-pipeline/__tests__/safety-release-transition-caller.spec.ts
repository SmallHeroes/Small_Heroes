import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

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

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

describe('release marker transition — single caller enforced', () => {
  it('executeSafetyFalsePositiveReleaseTransition is referenced ONLY by its definition + the release mode', () => {
    const offenders: string[] = [];
    for (const dir of ['app', 'lib', 'backend']) {
      for (const file of walk(path.join(ROOT, dir))) {
        const relative = path.relative(ROOT, file).split(path.sep).join('/');
        if (ALLOWED.has(relative)) continue;
        if (readFileSync(file, 'utf8').includes(FN)) offenders.push(relative);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the sanctioned files DO reference it (the guard is not vacuous)', () => {
    for (const rel of ALLOWED) {
      expect(readFileSync(path.join(ROOT, rel), 'utf8'), `${rel} must reference ${FN}`).toContain(FN);
    }
  });
});
