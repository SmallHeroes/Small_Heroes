import type { StoryValidator } from '../types';
import { finding, normalizeForMatch } from '../utils';

/** BLOCKING (repair): structural preservation vs previousVersion. */
export const repairRegressionValidator: StoryValidator = {
  id: 'repairRegression',
  modes: ['repair'],
  run({ parsed, input, previousParsed }) {
    if (!input.previousVersion || !previousParsed) {
      return [finding('repairRegression', 'BLOCKING', 'repair mode דורש previousVersion')];
    }

    const findings = [];
    const prev = previousParsed;

    if (parsed.pages.length !== prev.pages.length) {
      findings.push(
        finding(
          'repairRegression',
          'BLOCKING',
          `מספר עמודים השתנה: ${prev.pages.length} → ${parsed.pages.length}`
        )
      );
    }

    const prevNums = prev.pages.map((p) => p.pageNumber).sort((a, b) => a - b);
    const newNums = parsed.pages.map((p) => p.pageNumber).sort((a, b) => a - b);
    if (prevNums.join(',') !== newNums.join(',')) {
      findings.push(finding('repairRegression', 'BLOCKING', 'מספור עמודים השתנה ב-repair'));
    }

    for (const preserved of input.previousVersion.preserveList) {
      const needle = preserved.trim();
      if (!needle) continue;
      const full = parsed.pages.map((p) => p.text).join('\n');
      if (!full.includes(needle) && !normalizeForMatch(full).includes(normalizeForMatch(needle))) {
        findings.push(
          finding('repairRegression', 'BLOCKING', `מחרוזת preserveList נעלמה: "${needle.slice(0, 40)}…"`)
        );
      }
    }

    return findings;
  },
};
