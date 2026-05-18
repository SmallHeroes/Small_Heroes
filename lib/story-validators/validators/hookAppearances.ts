import type { StoryValidator } from '../types';
import { countOccurrences, finding, normalizeForMatch } from '../utils';

/** BLOCKING/WARNING: declared hook elements appear on declared pages. */
export const hookAppearancesValidator: StoryValidator = {
  id: 'hookAppearances',
  run({ parsed, input }) {
    const hook = input.context.declared.hook;
    const elements: Array<{ key: string; value?: string }> = [
      { key: 'sound', value: hook.sound },
      { key: 'phrase', value: hook.phrase },
      { key: 'microAction', value: hook.microAction },
      { key: 'object', value: hook.object },
    ].filter((e) => e.value && e.value.trim());

    if (elements.length === 0) {
      return [finding('hookAppearances', 'WARNING', 'לא הוגדר hook (sound/phrase/microAction/object)')];
    }

    const findings = [];
    let totalHits = 0;

    for (const page of parsed.pages) {
      for (const el of elements) {
        const count = countOccurrences(page.text, el.value!);
        if (count > 3) {
          findings.push(
            finding(
              'hookAppearances',
              'BLOCKING',
              `עייפות hook: "${el.value}" מופיע ${count} פעמים בעמוד ${page.pageNumber}`,
              { page: page.pageNumber }
            )
          );
        }
        if (hook.appearsOnPages.includes(page.pageNumber) && count === 0) {
          findings.push(
            finding(
              'hookAppearances',
              'BLOCKING',
              `hook ${el.key} "${el.value}" חסר בעמוד מוצהר ${page.pageNumber}`,
              { page: page.pageNumber }
            )
          );
        }
        totalHits += count;
      }
    }

    for (const pageNum of hook.appearsOnPages) {
      const page = parsed.pages.find((p) => p.pageNumber === pageNum);
      if (!page) {
        findings.push(finding('hookAppearances', 'BLOCKING', `עמוד hook מוצהר ${pageNum} לא קיים`));
        continue;
      }
      for (const el of elements) {
        if (countOccurrences(page.text, el.value!) === 0) {
          findings.push(
            finding(
              'hookAppearances',
              'BLOCKING',
              `hook ${el.key} חסר בעמוד ${pageNum}`,
              { page: pageNum }
            )
          );
        }
      }
    }

    if (totalHits < 2) {
      findings.push(
        finding('hookAppearances', 'WARNING', `סה"כ מופעי hook ${totalHits} — מינימום מומלץ 2`)
      );
    }

    return findings;
  },
};
