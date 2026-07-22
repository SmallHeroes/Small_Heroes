#!/usr/bin/env tsx
/** Zero-cost, read-only all-slot audit. */
import { STYLE_IDS } from '@/lib/styles';
import { auditMvpRenderQualification } from '@/lib/visual-package/audit';

const audit = auditMvpRenderQualification({
  repoRoot: process.cwd(),
  styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
});

console.log(JSON.stringify(audit, null, 2));

if (process.argv.includes('--require-render-qualified')) {
  const failures = audit.records.filter((record) => record.productSellable && !record.renderQualified);
  if (failures.length > 0) process.exitCode = 1;
}
