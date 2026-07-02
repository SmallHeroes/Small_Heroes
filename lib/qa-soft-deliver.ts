import type { AnchorLowConfidence } from '@/lib/anchor-resemblance-gate';
import { isProductionLikeRuntime } from '@/lib/runtime-env';

export interface QaWarningPageFlag {
  artifactKey: string;
  pageNumber: number | null;
  reason: string;
}

export interface QaWarningAnchor {
  score: number;
  band: string;
  reason: string;
}

/** Compact QA report attached to soft-deliver book-ready emails (non-prod only). */
export interface QaWarnings {
  wouldHaveStatus: 'needs_human_qa';
  wouldHaveReason: string;
  pageFlags: QaWarningPageFlag[];
  anchor?: QaWarningAnchor;
}

function parseTruthyEnv(name: string): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/** Honored only when QA_SOFT_DELIVER is on AND runtime is not production-like (fail-closed). */
export function canUseQaSoftDeliver(): boolean {
  return parseTruthyEnv('QA_SOFT_DELIVER') && !isProductionLikeRuntime();
}

export function pageNumberFromArtifactKey(artifactKey: string): number | null {
  const m = /^page:(\d+)$/.exec(artifactKey);
  return m ? Number(m[1]) : null;
}

export function buildQaWarningsFromReadinessBlock(args: {
  reason: string | null;
  evidence: Record<string, unknown>;
}): QaWarnings {
  const wouldHaveReason = args.reason ?? 'blocked';
  const pageFlags: QaWarningPageFlag[] = [];
  const quality = args.evidence.quality as { perArtifact?: Record<string, { state?: string; reason?: string; verdict?: string }> } | undefined;
  const perArtifact = quality?.perArtifact ?? {};
  for (const [artifactKey, detail] of Object.entries(perArtifact)) {
    const state = detail?.state ?? 'unknown';
    if (state === 'passed') continue;
    const rowReason = detail?.reason ?? detail?.verdict ?? state;
    pageFlags.push({
      artifactKey,
      pageNumber: pageNumberFromArtifactKey(artifactKey),
      reason: `${state}${rowReason ? `:${rowReason}` : ''}`,
    });
  }
  if (pageFlags.length === 0 && wouldHaveReason.startsWith('quality_')) {
    const suffix = wouldHaveReason.split(':').slice(1).join(':');
    for (const key of suffix.split(',').map((s) => s.trim()).filter(Boolean)) {
      pageFlags.push({
        artifactKey: key,
        pageNumber: pageNumberFromArtifactKey(key),
        reason: wouldHaveReason,
      });
    }
  }
  return {
    wouldHaveStatus: 'needs_human_qa',
    wouldHaveReason,
    pageFlags,
  };
}

export function buildQaWarningsFromAnchorHold(
  lowConfidence: AnchorLowConfidence | null | undefined,
  fallbackReason: string | null = null,
): QaWarnings {
  if (lowConfidence) {
    const band = lowConfidence.reason ?? 'unknown';
    const score = lowConfidence.score ?? 0;
    return {
      wouldHaveStatus: 'needs_human_qa',
      wouldHaveReason: `anchor_low_confidence:${band}`,
      pageFlags: [],
      anchor: {
        score,
        band,
        reason: `anchor_low_confidence:${band}`,
      },
    };
  }
  return {
    wouldHaveStatus: 'needs_human_qa',
    wouldHaveReason: fallbackReason ?? 'anchor_hold',
    pageFlags: [],
  };
}

export function mergeQaWarnings(primary: QaWarnings, extra?: QaWarnings | null): QaWarnings {
  if (!extra) return primary;
  return {
    wouldHaveStatus: 'needs_human_qa',
    wouldHaveReason: [primary.wouldHaveReason, extra.wouldHaveReason].filter(Boolean).join(' | '),
    pageFlags: [...primary.pageFlags, ...extra.pageFlags],
    anchor: extra.anchor ?? primary.anchor,
  };
}
