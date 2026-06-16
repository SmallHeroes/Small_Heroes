import type { SceneMemoryDriftPerFact, SceneMemoryDriftReport } from '../scene-memory/types';
import type { AppearanceDriftFinding, AppearanceDriftReport, AppearanceDriftSeverity } from './types';

function classifyDriftRow(row: SceneMemoryDriftPerFact): AppearanceDriftSeverity {
  const id = row.factId.toLowerCase();
  const note = (row.note ?? '').toLowerCase();

  if (row.status === 'consistent' || row.status === 'story_authorized_change') {
    return 'accept';
  }
  if (row.status === 'unknown') {
    return 'accept';
  }

  if (/cave|fort/i.test(id) && /standing|canopy|tent|built/.test(note + (row.observed ?? ''))) {
    return 'hard';
  }
  if (/bed/i.test(id) && row.status === 'drift' && /position|wall|flip/.test(note)) {
    return 'hard';
  }
  if (/window/i.test(id) && row.status === 'drift' && /position|wall/.test(note)) {
    return 'hard';
  }
  if (/shelf/i.test(id) && row.status === 'drift' && /not visible|vanished|missing/.test(note)) {
    return 'hard';
  }
  if (/walls|floor/i.test(id) && /daylight|bright|sunny/.test(note + (row.observed ?? ''))) {
    return 'hard';
  }

  if (/bed/i.test(id) && row.status === 'drift') return 'review';
  if (/shelf|book/i.test(id) && row.status === 'drift') return 'review';
  if (/pillow/i.test(id) && row.status === 'drift' && /palette|colour|color/.test(note)) {
    return 'review';
  }
  if (/lamp/i.test(id) && /bright|dim|light/.test(note)) return 'review';
  if (/walls|floor/i.test(id) && row.status === 'drift') return 'review';
  if (/blanket/i.test(id) && row.status === 'drift') return 'review';

  if (row.status === 'drift') return 'review';
  return 'accept';
}

function categoryForFact(factId: string): AppearanceDriftFinding['category'] {
  const id = factId.toLowerCase();
  if (/cave|fort/i.test(id)) return 'form';
  if (/wall|floor|lamp|light/i.test(id)) return 'lighting';
  if (/pillow|blanket|rug|curtain|color/i.test(id)) return 'palette';
  if (/bed|window|rug|shelf/i.test(id)) return 'position';
  return 'presence';
}

export function buildAppearanceDriftReport(args: {
  sceneMemoryDrift: SceneMemoryDriftReport;
  pageLuminanceDelta?: number | null;
}): AppearanceDriftReport {
  const findings: AppearanceDriftFinding[] = [];

  for (const row of args.sceneMemoryDrift.perFact) {
    const severity = classifyDriftRow(row);
    if (severity === 'accept') continue;
    findings.push({
      factId: row.factId,
      severity,
      category: categoryForFact(row.factId),
      note: row.note ?? `${row.status}: ${row.expected ?? ''} vs ${row.observed ?? ''}`,
    });
  }

  if (args.pageLuminanceDelta != null && Math.abs(args.pageLuminanceDelta) > 0.12) {
    findings.push({
      factId: 'lighting',
      severity: args.pageLuminanceDelta > 0.18 ? 'review' : 'accept',
      category: 'lighting',
      note: `page luminance delta vs book mean: ${(args.pageLuminanceDelta * 100).toFixed(1)}%`,
    });
  }

  const hardCount = findings.filter((f) => f.severity === 'hard').length;
  const reviewCount = findings.filter((f) => f.severity === 'review').length;

  return {
    page: args.sceneMemoryDrift.page,
    sceneId: args.sceneMemoryDrift.sceneId,
    findings,
    hardCount,
    reviewCount,
    acceptCount: args.sceneMemoryDrift.perFact.length - hardCount - reviewCount,
  };
}

export function appearanceReportHasHardFail(report: AppearanceDriftReport): boolean {
  return report.hardCount > 0;
}

export async function writeAppearanceDriftReportFile(
  dir: string,
  report: AppearanceDriftReport
): Promise<string> {
  const fs = await import('fs');
  const pathMod = await import('path');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = pathMod.join(
    dir,
    `page-${String(report.page).padStart(2, '0')}-appearance-drift.json`
  );
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}
