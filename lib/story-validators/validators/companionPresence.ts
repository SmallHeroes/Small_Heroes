import { getCompanionBible } from '../data/companion-rules';
import type { StoryValidator } from '../types';
import { finding, normalizeCompanionId } from '../utils';

/** BLOCKING/WARNING: companion introduction and consecutive absence. */
export const companionPresenceValidator: StoryValidator = {
  id: 'companionPresence',
  run({ parsed, input }) {
    const bible = getCompanionBible(normalizeCompanionId(input.context.companionId));
    if (!bible) {
      return [finding('companionPresence', 'WARNING', 'אין bible — דילוג על נוכחות דמות')];
    }

    const findings = [];
    const name = bible.nameClean;
    const introBy = bible.introByPage?.[input.context.direction] ?? 3;
    const maxAbsent = bible.maxConsecutiveAbsent ?? 2;

    let consecutiveAbsent = 0;
    let firstSeen = Infinity;
    let pagesWithCompanion = 0;

    for (const page of parsed.pages.sort((a, b) => a.pageNumber - b.pageNumber)) {
      const present = page.text.includes(name) || page.text.includes(bible.canonicalName);
      if (present) {
        pagesWithCompanion++;
        consecutiveAbsent = 0;
        firstSeen = Math.min(firstSeen, page.pageNumber);
      } else {
        consecutiveAbsent++;
        if (consecutiveAbsent > maxAbsent) {
          findings.push(
            finding(
              'companionPresence',
              'BLOCKING',
              `הדמות ${name} חסרה ${consecutiveAbsent} עמודים רצופים (מקסימום ${maxAbsent})`,
              { page: page.pageNumber }
            )
          );
          consecutiveAbsent = 0;
        }
      }
    }

    if (firstSeen > introBy) {
      findings.push(
        finding(
          'companionPresence',
          'BLOCKING',
          `${name} מופיעה לראשונה בעמוד ${firstSeen} — חייבת להופיע עד עמוד ${introBy}`
        )
      );
    }

    const minRatio = bible.minimumPresence?.[input.context.direction];
    if (minRatio != null) {
      const ratio = pagesWithCompanion / parsed.pages.length;
      if (ratio < minRatio) {
        findings.push(
          finding(
            'companionPresence',
            'WARNING',
            `נוכחות ${name} ${Math.round(ratio * 100)}% — מינימום ${Math.round(minRatio * 100)}%`
          )
        );
      }
    }

    return findings;
  },
};
