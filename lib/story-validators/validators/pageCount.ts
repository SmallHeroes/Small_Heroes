import type { StoryValidator } from '../types';
import { finding } from '../utils';

/** BLOCKING: page marker count must match context.pageCount. */
export const pageCountValidator: StoryValidator = {
  id: 'pageCount',
  run({ parsed, input }) {
    const expected = input.context.pageCount;
    const actual = parsed.pages.length;
    if (actual === expected) return [];
    return [
      finding(
        'pageCount',
        'BLOCKING',
        `מספר עמודים ${actual} — צפוי ${expected}`,
        { suggestion: `הוסף או הסר עמודים עד ${expected} מרקרים --- Page N ---.` }
      ),
    ];
  },
};
