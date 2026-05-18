import { parseStoryMarkdown } from '@/lib/story-validators';
import { getCompanionBible } from '@/lib/companion-bible';
import type { MvpCompanionId } from '../types';
import { KNOWN_BAD_PHRASES, detectCompanionRepeats, stripHebrewNiqqud } from './known-bad-hebrew';
import type { EditorialIssueRuntime } from './schemas';

function frontmatterText(fm: Record<string, unknown>): string {
  return Object.entries(fm)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join('\n');
}

function countSubstring(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) break;
    count++;
    pos = idx + Math.max(1, needle.length);
  }
  return count;
}

/**
 * Deterministic editorial pre-scan (no LLM).
 * Scans body, imageDirection, and frontmatter for known-bad phrases and companion repeats.
 */
export function runEditorialPrescan(
  storyMarkdown: string,
  companionId: MvpCompanionId
): EditorialIssueRuntime[] {
  const parsed = parseStoryMarkdown(storyMarkdown);
  const bible = getCompanionBible(companionId);
  const issues: EditorialIssueRuntime[] = [];
  const fmText = frontmatterText(parsed.frontmatter);

  for (const bad of KNOWN_BAD_PHRASES) {
    const targets: Array<{ page: number; field: EditorialIssueRuntime['field']; text: string }> = [
      ...parsed.pages.map((p) => ({ page: p.pageNumber, field: 'body' as const, text: p.text })),
      ...parsed.pages.map((p) => ({
        page: p.pageNumber,
        field: 'imageDirection' as const,
        text: p.imageDirection,
      })),
      { page: 1, field: 'frontmatter', text: fmText },
    ];

    for (const target of targets) {
      if (!target.text) continue;
      const found =
        target.text.includes(bad.phrase) ||
        stripHebrewNiqqud(target.text).includes(stripHebrewNiqqud(bad.phrase));
      if (!found) continue;
      issues.push({
        page: target.page,
        field: target.field,
        severity: bad.severity,
        reason: bad.reason,
        quote: bad.phrase,
        suggestion: bad.suggestion,
        explanation: bad.explanation,
        _source: 'scanner',
      });
    }
  }

  if (bible) {
    for (const page of parsed.pages) {
      if (detectCompanionRepeats(page.text, bible.nameClean)) {
        const clause = page.text.split(/[.!?,:;\n—-]/).find((c) => {
          const n = stripHebrewNiqqud(c);
          const name = stripHebrewNiqqud(bible.nameClean);
          return (n.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length >= 2;
        });
        issues.push({
          page: page.pageNumber,
          field: 'body',
          severity: 'BLOCKING',
          reason: 'companion_name_repeat',
          quote: (clause ?? page.text).trim().slice(0, 80),
          suggestion: `השתמשו בשם ${bible.nameClean} פעם אחת בלבד במשפט`,
          explanation: `שם הדמות ${bible.nameClean} חוזר פעמיים באותו פסוק/פסקה`,
          _source: 'scanner',
        });
      }

      const glued = stripHebrewNiqqud(page.text);
      const name = stripHebrewNiqqud(bible.nameClean);
      const gluedPattern = new RegExp(`${name}\\s*${name}`, 'i');
      if (gluedPattern.test(glued.replace(/\s+/g, ''))) {
        issues.push({
          page: page.pageNumber,
          field: 'body',
          severity: 'BLOCKING',
          reason: 'companion_name_repeat',
          quote: page.text.slice(0, 80),
          suggestion: `הפרידו בין שם הדמות לצליל/פעולה`,
          explanation: 'שם דמות צמוד לצליל ללא רווח',
          _source: 'scanner',
        });
      }
    }
  }

  return issues;
}

export { countSubstring };
