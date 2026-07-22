import type { RenderQualificationAudit } from './audit';

export interface RenderQualificationReleaseGate {
  strict: boolean;
  pass: boolean;
  failures: Array<{
    storyKey: string;
    reasonCodes: string[];
  }>;
}

export function renderQualificationStrictMode(argv: readonly string[]): boolean {
  return argv.includes('--require-render-qualified');
}

export function evaluateRenderQualificationReleaseGate(
  audit: RenderQualificationAudit,
  strict: boolean,
): RenderQualificationReleaseGate {
  const failures = audit.records
    .filter((record) => record.productSellable && !record.renderQualified)
    .map((record) => ({
      storyKey: record.storyKey,
      reasonCodes: [...new Set(record.reasons.map((reason) => reason.code))],
    }));
  return {
    strict,
    pass: !strict || failures.length === 0,
    failures,
  };
}
