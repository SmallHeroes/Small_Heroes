import {
  buildStoryMarkdown,
  defaultBedtimePages,
  defaultBollyPages,
} from '@/lib/story-validators/__tests__/helpers';
import { getDirectionDNA, MOMENT_WINDOWS } from '../data/direction-dna';
import type { GenerateInput, Plan } from '../types';

function kimPages(count: number, childName: string, momentPage: number) {
  const dirs = [
    'Wide magical garden, child left, chameleon on branch right.',
    'Medium shot, striped scarf visible, child center.',
    'Close shot, eyes rotate, child and companion foreground.',
  ];
  const hookPages = [3, 8, 14].filter((p) => p <= count);
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const hook = hookPages.includes(n) ? ' הצבע מהמקום הקודם עוד פה.' : '';
    const kim = n >= 3 ? ' קִים משנה גוון.' : '';
    const momentLine = n === momentPage ? ` ${childName} נוגע בכתם הצבע.` : '';
    return {
      pageNumber: n,
      text: `${childName} בדרך${kim}${hook}${momentLine} הזנב מתולתל.`,
      imageDirection: dirs[i % dirs.length] ?? dirs[dirs.length - 1],
    };
  });
}

export function buildMockPlan(input: GenerateInput): Plan {
  const dna = getDirectionDNA(input.direction);
  const pageCount = dna.pageCount;
  const [momentMin, momentMax] = MOMENT_WINDOWS[input.direction];
  const momentPage = Math.floor((momentMin + momentMax) / 2);
  const hookPages =
    input.companionId === 'bolly_armadillo'
      ? [2, 4, 8].filter((p) => p <= pageCount)
      : input.companionId === 'bat_lily'
        ? [2, 3, 7].filter((p) => p <= pageCount)
        : [3, 8, 14].filter((p) => p <= pageCount);

  const hook =
    input.companionId === 'bolly_armadillo'
      ? { sound: 'טומפ', phrase: 'בפנים היה חם', appearsOnPages: hookPages }
      : input.companionId === 'bat_lily'
        ? { sound: 'ששש', appearsOnPages: hookPages }
        : { phrase: 'הצבע מהמקום הקודם', appearsOnPages: hookPages };

  const beatMap = Array.from({ length: pageCount }, (_, i) => {
    const pageNumber = i + 1;
    return {
      pageNumber,
      location: pageNumber <= 3 ? 'חדר' : pageNumber < momentPage ? 'מסדרון' : 'מיטה',
      childAction: pageNumber === momentPage ? 'נוגע בעדינות' : 'מקשיב ונושם',
      companionAction:
        pageNumber <= 2
          ? 'ממתין בקרבה'
          : input.companionId === 'bolly_armadillo'
            ? 'פותח לוחית אחת'
            : input.companionId === 'bat_lily'
              ? 'עוטפת כנף'
              : 'משנה גוון בעדינות',
      emotionalRead: pageNumber < momentPage ? 'מתח עדין' : 'רוגע גובר',
      wordCountTarget: input.childAge <= 5 ? 32 : 42,
    };
  });

  return {
    beatMap,
    momentContract: {
      page: momentPage,
      type: 'touch',
      physicalAction: 'נוגע',
      companionSignature:
        input.companionId === 'bolly_armadillo'
          ? 'בטן ורודה'
          : input.companionId === 'bat_lily'
            ? 'כנף רכה'
            : 'כתם צבע',
      residue: 'שמיכה חמה',
    },
    hookContract: hook,
    preserveListSeeds: [
      hook.sound ? `hook sound ${hook.sound}` : `hook phrase ${hook.phrase}`,
      `moment page ${momentPage}`,
    ],
    visualPacingMap: {
      quietPages: [pageCount - 1, pageCount],
      activePages: [2, 3],
      heartPage: momentPage,
    },
  };
}

function momentPageFor(direction: GenerateInput['direction']): number {
  const [a, b] = MOMENT_WINDOWS[direction];
  return Math.floor((a + b) / 2);
}

function bollyPages(count: number, childName: string, momentPage: number) {
  const base = defaultBollyPages(count, childName);
  return base.map((p) =>
    p.pageNumber === momentPage
      ? { ...p, text: `${childName} נוגעת בבטן הוורודה של בּוֹלִי. טוּמְפּ. בפנים היה חם.` }
      : p
  );
}

function lilyPages(count: number, childName: string, momentPage: number) {
  const base = defaultBedtimePages(count, 'לִילִי', childName);
  return base.map((p) =>
    p.pageNumber === momentPage
      ? { ...p, text: `${childName} נשם לאט, כתף יורדת. לִילִי לוחשת ששש.` }
      : p
  );
}

export function buildMockStory(input: GenerateInput): string {
  const dna = getDirectionDNA(input.direction);
  const pageCount = dna.pageCount;
  const momentPage = momentPageFor(input.direction);
  const fm = {
    title: 'סיפור בדיקה',
    companionId: input.companionId,
    direction: input.direction,
    childGender: input.childGender,
    pages: pageCount,
  };

  if (input.companionId === 'bolly_armadillo') {
    return buildStoryMarkdown(fm, bollyPages(pageCount, input.childName, momentPage));
  }
  if (input.companionId === 'bat_lily') {
    return buildStoryMarkdown(fm, lilyPages(pageCount, input.childName, momentPage));
  }
  return buildStoryMarkdown(fm, kimPages(pageCount, input.childName, momentPage));
}

export { MVP_MATRIX } from '../data/mvp-matrix';
