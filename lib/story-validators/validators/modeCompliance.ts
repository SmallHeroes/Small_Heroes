import type { StoryValidator } from '../types';
import { finding, normalizeForMatch } from '../utils';

/** BLOCKING (repair): only changeOnly pages may differ from previousVersion. */
export const modeComplianceValidator: StoryValidator = {
  id: 'modeCompliance',
  modes: ['repair'],
  run({ parsed, input, previousParsed }) {
    if (!input.previousVersion || !previousParsed) {
      return [finding('modeCompliance', 'BLOCKING', 'repair mode דורש previousVersion')];
    }

    const findings = [];
    const changeSet = new Set(input.previousVersion.changeOnly);
    const prevByPage = new Map(previousParsed.pages.map((p) => [p.pageNumber, p]));

    for (const page of parsed.pages) {
      const prev = prevByPage.get(page.pageNumber);
      if (!prev) continue;
      const same =
        normalizeForMatch(page.text) === normalizeForMatch(prev.text) &&
        page.imageDirection.trim() === prev.imageDirection.trim();
      if (!same && !changeSet.has(page.pageNumber)) {
        findings.push(
          finding(
            'modeCompliance',
            'BLOCKING',
            `עמוד ${page.pageNumber} השתנה אך לא ב-changeOnly`,
            { page: page.pageNumber }
          )
        );
      }
    }

    for (const preserved of input.previousVersion.preserveList) {
      const full = parsed.pages.map((p) => p.text).join('\n');
      if (!full.includes(preserved.trim())) {
        findings.push(finding('modeCompliance', 'BLOCKING', `preserveList חסר: "${preserved.slice(0, 30)}"`));
      }
    }

    if (parsed.pages.length !== previousParsed.pages.length) {
      findings.push(finding('modeCompliance', 'BLOCKING', 'מספר עמודים השתנה ב-repair'));
    }

    return findings;
  },
};
