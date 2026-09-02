#!/usr/bin/env tsx
/** Zero-cost, read-only all-slot audit. */
import { STYLE_IDS } from '@/lib/styles';
import { auditMvpRenderQualification } from '@/lib/visual-package/audit';
import {
  evaluateRenderQualificationReleaseGate,
  renderQualificationReleaseGateScope,
  renderQualificationStrictMode,
} from '@/lib/visual-package/releaseGate';

const audit = auditMvpRenderQualification({
  repoRoot: process.cwd(),
  styleId: STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK,
});

console.log(JSON.stringify(audit, null, 2));

const strict = renderQualificationStrictMode(process.argv);
const gate = evaluateRenderQualificationReleaseGate(
  audit,
  strict,
  renderQualificationReleaseGateScope(process.argv),
);
if (!gate.pass) process.exitCode = 1;
