/**
 * Pure helpers for the Human-QA review console — no Prisma, no IO.
 */

/** Extract page numbers from a deliveryHoldReason / rawReason marker. */
export function parsePageNumbersFromReason(reason: string | null | undefined): number[] {
  if (!reason) return [];
  const found = new Set<number>();
  const re = /page:(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(reason)) !== null) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

export function artifactKeyToPageNumber(artifactKey: string): number | null {
  if (artifactKey === 'cover') return null;
  const m = /^page:(\d+)$/i.exec(artifactKey.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function kindLabelHe(
  kind: 'safety' | 'contract_world' | 'anchor' | 'payment_integrity' | 'legacy_unknown',
): string {
  switch (kind) {
    case 'safety':
      return 'בטיחות';
    case 'contract_world':
      return 'עולם / חוזה';
    case 'anchor':
      return 'דמיון לדמות';
    case 'payment_integrity':
      return 'שלמות תשלום';
    case 'legacy_unknown':
      return 'לא מסווג';
  }
}

/** Relative Hebrew time for held-at display. */
export function relativeTimeHe(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const diffSec = Math.round((nowMs - t) / 1000);
  if (diffSec < 60) return 'לפני רגעים';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שע׳`;
  const diffDay = Math.round(diffHr / 24);
  return `לפני ${diffDay} ימים`;
}

/**
 * Pull safe, display-only notes from QualityEvidence.evidence JSON.
 * Never surfaces customer access keys or emails.
 */
export function notesFromEvidenceJson(evidence: unknown): {
  notes: string[];
  anchorConfidence: number | null;
  safetyHazards: string[];
} {
  const notes: string[] = [];
  const safetyHazards: string[] = [];
  let anchorConfidence: number | null = null;
  if (!evidence || typeof evidence !== 'object') return { notes, anchorConfidence, safetyHazards };

  const e = evidence as Record<string, unknown>;
  if (typeof e.presentationApplied === 'boolean') {
    notes.push(e.presentationApplied ? 'עיבוד תצוגה הוחל' : 'ללא עיבוד תצוגה');
  }
  if (typeof e.regenAttempts === 'number') {
    notes.push(`ניסיונות רינדור מחדש: ${e.regenAttempts}`);
  }

  const obs = e.contractObservability;
  if (obs && typeof obs === 'object') {
    const o = obs as Record<string, unknown>;
    if (typeof o.summary === 'string' && o.summary.trim()) notes.push(o.summary.trim());
    if (typeof o.diffSummary === 'string' && o.diffSummary.trim()) notes.push(`הפרש חוזה: ${o.diffSummary.trim()}`);
    if (Array.isArray(o.mismatches)) {
      for (const item of o.mismatches.slice(0, 6)) {
        if (typeof item === 'string' && item.trim()) notes.push(item.trim());
        else if (item && typeof item === 'object' && typeof (item as { path?: unknown }).path === 'string') {
          notes.push(String((item as { path: string }).path));
        }
      }
    }
  }

  const qa = e.qaContext;
  if (qa && typeof qa === 'object') {
    const q = qa as Record<string, unknown>;
    if (typeof q.expectsCompanion === 'boolean') {
      notes.push(q.expectsCompanion ? 'צפוי מלווה בסצנה' : 'ללא מלווה צפוי');
    }
  }

  const scoreCandidates = [e.anchorConfidence, e.resemblanceScore, (e as { score?: unknown }).score];
  for (const c of scoreCandidates) {
    if (typeof c === 'number' && Number.isFinite(c)) {
      anchorConfidence = c;
      break;
    }
  }

  const hazards = e.safetyHazards;
  if (Array.isArray(hazards)) {
    for (const h of hazards) {
      if (typeof h === 'string' && h.trim()) safetyHazards.push(h.trim());
    }
  }

  return { notes, anchorConfidence, safetyHazards };
}

/** Forbidden customer access-key field names — never appear in console DTOs. */
export const FORBIDDEN_ACCESS_KEY_FIELDS = [
  'paymentId',
  'paymeTransactionId',
  'stripeSessionId',
  'stripePaymentId',
] as const;

export function assertNoAccessKeys(payload: unknown, path = 'root'): string[] {
  const hits: string[] = [];
  if (payload == null) return hits;
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => hits.push(...assertNoAccessKeys(item, `${path}[${i}]`)));
    return hits;
  }
  if (typeof payload !== 'object') return hits;
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if ((FORBIDDEN_ACCESS_KEY_FIELDS as readonly string[]).includes(k)) {
      hits.push(`${path}.${k}`);
    }
    hits.push(...assertNoAccessKeys(v, `${path}.${k}`));
  }
  return hits;
}
