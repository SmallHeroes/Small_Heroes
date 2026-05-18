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

    // v1.1: Softened — on each declared page, at least ONE element must appear (not all).
    // Overuse (>3 of same element on one page) still BLOCKING — fatigue prevention stays.

    // Overuse check (per element per page)
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
        totalHits += count;
      }
    }

    // Per-declared-page check: at least ONE element of the hook must appear
    for (const pageNum of hook.appearsOnPages) {
      const page = parsed.pages.find((p) => p.pageNumber === pageNum);
      if (!page) {
        findings.push(finding('hookAppearances', 'BLOCKING', `עמוד hook מוצהר ${pageNum} לא קיים`));
        continue;
      }
      const elementHitsHere = elements
        .map((el) => ({ key: el.key, hits: countOccurrences(page.text, el.value!) }))
        .filter((h) => h.hits > 0);

      if (elementHitsHere.length === 0) {
        const elementNames = elements.map((e) => `${e.key}="${e.value}"`).join(' / ');
        findings.push(
          finding(
            'hookAppearances',
            'BLOCKING',
            `עמוד מוצהר ${pageNum} ללא אף אלמנט hook (${elementNames})`,
            { page: pageNum, suggestion: 'הוסיפו לפחות אלמנט hook אחד (sound / phrase / microAction / object).' }
          )
        );
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
