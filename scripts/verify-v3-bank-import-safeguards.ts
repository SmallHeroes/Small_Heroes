/**
 * Print a deterministic PASS/FAIL audit for v3 bank import safeguards.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/verify-v3-bank-import-safeguards.ts
 */
import { verifyV3BankImportSafeguards } from '../lib/story-bank-v3-import-safeguards';

const report = verifyV3BankImportSafeguards(process.cwd());

for (const check of report.checks) {
  const tag = check.pass ? 'PASS' : check.id === 'sourceRunDir-no-direct-bank-bypass' ? 'WARN' : 'FAIL';
  console.log(`[verify-v3-bank] ${tag} ${check.id}: ${check.detail}`);
}

if (!report.pass) {
  console.error('[verify-v3-bank] FAIL — fix hard checks above before merge');
  process.exit(1);
}

console.log('[verify-v3-bank] PASS — approval-gated import path enforced');
process.exit(0);
