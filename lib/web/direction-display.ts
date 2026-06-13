/**
 * Customer-facing direction labels + page/price metadata from wizard config.
 */
import {
  DIRECTION_PAGE_MAP,
  displayPagesForBeats,
} from '@/backend/config/wizard';
import type { StoryDirection } from '@/backend/config/mvp-story-matrix';

export const DIRECTION_ORDER: StoryDirection[] = ['bedtime', 'adventure', 'fantasy'];

export const DIRECTION_LABELS: Record<StoryDirection, string> = {
  bedtime: 'לילה טוב',
  adventure: 'הרפתקה',
  fantasy: 'פנטזיה',
};

/** Copy aligned with landing pricing cards — used on /start direction step. */
export const DIRECTION_EXPERIENCE_CARDS: Record<
  StoryDirection,
  {
    kicker: string;
    name: string;
    desc: string;
    features: readonly string[];
    featured: boolean;
    launchBadge?: string;
    cta: string;
  }
> = {
  bedtime: {
    kicker: 'סיפור לפני שינה',
    name: 'ספר לילה טוב אישי',
    desc: 'לילד שצריך רגיעה לפני שינה — סיפור שקט, מסר ברור, ואווירה מרגיעה.',
    features: ['16 עמודים עם איורים מקוריים', 'דמות מותאמת אישית', 'אווירה שקטה ומרגיעה'],
    featured: false,
    cta: 'מתאים לנו — ספר לילה טוב',
  },
  adventure: {
    kicker: 'הרפתקה',
    name: 'הרפתקה אישית',
    desc: 'לילד שצריך אומץ מול משהו חדש או מפחיד — הרפתקה עם התפתחות רגשית.',
    features: ['24 עמודים עם איורים מקוריים', 'דמות מותאמת + עלילה מלאה', 'הרפתקה עם התפתחות רגשית'],
    featured: true,
    launchBadge: 'בחירת ההשקה',
    cta: 'זה מה שמתאים לנו',
  },
  fantasy: {
    kicker: 'פנטזיה',
    name: 'ספר פנטזיה אישי',
    desc: 'לילד עם דמיון עשיר — עולם פנטזיה מלא, עומק ורגעים שנבנים לאט.',
    features: ['32 עמודים עם איורים מקוריים', 'עלילה מפותחת עם שכבות רגשיות', 'עולם פנטזיה שלם'],
    featured: false,
    cta: 'חוויה מלאה — מתאים לנו',
  },
};

export function directionDisplayMeta(direction: StoryDirection) {
  const map = DIRECTION_PAGE_MAP[direction];
  return {
    priceILS: map?.priceILS ?? 0,
    displayPages: displayPagesForBeats(map?.pages ?? 0),
  };
}
