import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { describe, expect, it, beforeAll } from 'vitest';
import { validateStory, type ValidationInput } from '../index';
import {
  buildStoryMarkdown,
  defaultBedtimePages,
  defaultBollyPages,
  type SamplePage,
} from './helpers';

const SAMPLES_DIR = path.join(__dirname, 'samples');

function kimPages(count: number, childName = 'נועה'): SamplePage[] {
  const dirs = [
    'Wide magical garden, child left, chameleon on branch right.',
    'Medium shot, striped scarf visible, child center.',
    'Close shot, eyes rotate, child and companion foreground.',
    'Wide shot, color patch on tail, child below.',
    'Medium shot, companion on shoulder, child walking.',
    'Wide shot, new room colors, child right companion left.',
    'Medium shot, tongue grabs toy gently, humor beat.',
    'Close shot, both eyes forward, calm colors.',
    'Wide shot, path through trees, child leading.',
    'Medium shot, scarf stripes clear, companion on rock.',
    'Wide shot, fantasy sky, child and companion small in frame.',
    'Close shot, child touches color patch, peak moment.',
    'Medium shot, tail curls, child smiles.',
    'Wide shot, sunset hues, companion on branch.',
    'Close shot, phrase moment, child hugs scarf.',
    'Medium shot, garden gate, both walking.',
    'Wide shot, stars avoided, soft moon only.',
    'Close shot, eyes same direction.',
    'Medium shot, quiet ending path.',
    'Wide shot, home doorway, peaceful end.',
  ];
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const hook = [3, 8, 14].includes(n) ? ' הצבע מהמקום הקודם עוד פה.' : '';
    const kim = n >= 3 ? ' קִים משנה גוון.' : '';
    const momentLine = n === 13 ? ` ${childName} נוגע בכתם הצבע.` : '';
    return {
      pageNumber: n,
      text: `${childName} בדרך${kim}${hook}${momentLine} הזנב מתולתל.`,
      imageDirection: dirs[i] ?? dirs[dirs.length - 1],
    };
  });
}

function writeSample(name: string, content: string) {
  const file = path.join(SAMPLES_DIR, name);
  writeFileSync(file, content, 'utf8');
}

function baseInput(
  partial: Partial<ValidationInput> & { context: ValidationInput['context'] }
): ValidationInput {
  return {
    storyMarkdown: '',
    mode: 'production',
    ...partial,
    context: partial.context,
  };
}

beforeAll(() => {
  if (!existsSync(SAMPLES_DIR)) mkdirSync(SAMPLES_DIR, { recursive: true });

  writeSample(
    'good-bedtime.md',
    buildStoryMarkdown(
      { title: 'לילה של לילי', companionId: 'bat_lily', direction: 'bedtime', childGender: 'girl', pages: 10 },
      defaultBedtimePages(10)
    )
  );
  writeSample(
    'good-adventure.md',
    buildStoryMarkdown(
      { title: 'בולי במסע', companionId: 'bolly_armadillo', direction: 'adventure', childGender: 'boy', pages: 15 },
      defaultBollyPages(15)
    )
  );
  writeSample(
    'good-fantasy.md',
    buildStoryMarkdown(
      { title: 'קים בגן', companionId: 'chameleon_koko', direction: 'fantasy', childGender: 'girl', pages: 20 },
      kimPages(20)
    )
  );
  writeSample(
    'good-bedtime-bolly.md',
    buildStoryMarkdown(
      { title: 'בולי לילה', companionId: 'bolly_armadillo', direction: 'bedtime', childGender: 'boy', pages: 10 },
      defaultBollyPages(10)
    )
  );
  writeSample(
    'good-adventure-lily.md',
    buildStoryMarkdown(
      { title: 'לילי הרפתקה', companionId: 'bat_lily', direction: 'adventure', childGender: 'girl', pages: 15 },
      defaultBedtimePages(15, 'לִילִי', 'מיה')
    )
  );

  const brokenForeign = defaultBedtimePages(10);
  brokenForeign[1] = {
    ...brokenForeign[1],
    text: 'נועה ראתה m בחושך ולילי לוחשת.',
  };
  writeSample(
    'broken-foreign-chars.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, brokenForeign)
  );

  writeSample(
    'broken-page-count.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, defaultBedtimePages(8))
  );

  const brokenSeq = defaultBedtimePages(4);
  brokenSeq.push({
    pageNumber: 10,
    text: 'נועה סוגרת עיניים ולילי לידה.',
    imageDirection: 'Wide shot, peaceful end, child center, companion right.',
  });
  writeSample(
    'broken-page-sequence.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, brokenSeq)
  );

  writeSample(
    'broken-gender.md',
    buildStoryMarkdown(
      { companionId: 'bat_lily', direction: 'bedtime', childGender: 'boy', pages: 10 },
      defaultBedtimePages(10)
    )
  );

  const brokenName = defaultBollyPages(10);
  brokenName[2] = { ...brokenName[2], text: 'נועה חיבקה את בובו החמוד.' };
  writeSample(
    'broken-companion-name.md',
    buildStoryMarkdown({ companionId: 'bolly_armadillo', direction: 'bedtime', pages: 10 }, brokenName)
  );

  const brokenAnatomy = defaultBollyPages(10);
  brokenAnatomy[4] = { ...brokenAnatomy[4], text: 'נועה ראתה נוצות על בולי.' };
  writeSample(
    'broken-forbidden-anatomy.md',
    buildStoryMarkdown({ companionId: 'bolly_armadillo', direction: 'bedtime', pages: 10 }, brokenAnatomy)
  );

  const brokenKill = defaultBedtimePages(10);
  brokenKill[5] = { ...brokenKill[5], text: 'באותו רגע הוא הבין שהחדר שקט ולילי לידו.' };
  writeSample(
    'broken-kill-phrase.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, brokenKill)
  );

  const brokenError = defaultBedtimePages(10);
  brokenError[3] = { ...brokenError[3], text: '(טעות: להסיר משפט זה) נועה נשמה.' };
  writeSample(
    'broken-error-notes.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, brokenError)
  );

  const brokenUnicode = defaultBedtimePages(10);
  brokenUnicode[2] = { ...brokenUnicode[2], text: 'נועה שמעה \\u05e9\\u05e9' };
  writeSample(
    'broken-unicode.md',
    buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, brokenUnicode)
  );

  const brokenObjects = defaultBollyPages(10);
  brokenObjects[6] = { ...brokenObjects[6], text: 'נועה הצביעה על כוכבים מעל בולי.' };
  writeSample(
    'broken-forbidden-objects.md',
    buildStoryMarkdown({ companionId: 'bolly_armadillo', direction: 'bedtime', pages: 10 }, brokenObjects)
  );
});

function loadSample(name: string): string {
  return readFileSync(path.join(SAMPLES_DIR, name), 'utf8');
}

const GOOD_CASES: Array<{ file: string; input: ValidationInput }> = [
  {
    file: 'good-bedtime.md',
    input: baseInput({
      context: {
        companionId: 'bat_lily',
        direction: 'bedtime',
        pageCount: 10,
        childName: 'נועה',
        childGender: 'girl',
        childAge: 5,
        declared: {
          moment: { page: 6, physicalAction: 'נשם' },
          hook: { sound: 'ששש', appearsOnPages: [2, 3, 7] },
        },
      },
    }),
  },
  {
    file: 'good-adventure.md',
    input: baseInput({
      context: {
        companionId: 'bolly_armadillo',
        direction: 'adventure',
        pageCount: 15,
        childName: 'נועה',
        childGender: 'boy',
        childAge: 6,
        declared: {
          moment: { page: 9, physicalAction: 'נגע' },
          hook: { sound: 'טומפ', phrase: 'בפנים היה חם', appearsOnPages: [2, 4, 8] },
        },
      },
    }),
  },
  {
    file: 'good-fantasy.md',
    input: baseInput({
      context: {
        companionId: 'chameleon_koko',
        direction: 'fantasy',
        pageCount: 20,
        childName: 'נועה',
        childGender: 'girl',
        childAge: 7,
        declared: {
          moment: { page: 13, physicalAction: 'נגע' },
          hook: { phrase: 'הצבע מהמקום הקודם', appearsOnPages: [3, 8, 14] },
        },
      },
    }),
  },
  {
    file: 'good-bedtime-bolly.md',
    input: baseInput({
      context: {
        companionId: 'bolly_armadillo',
        direction: 'bedtime',
        pageCount: 10,
        childName: 'נועה',
        childGender: 'boy',
        childAge: 5,
        declared: {
          moment: { page: 6, physicalAction: 'נגע' },
          hook: { sound: 'טומפ', appearsOnPages: [2, 4, 8] },
        },
      },
    }),
  },
  {
    file: 'good-adventure-lily.md',
    input: baseInput({
      context: {
        companionId: 'bat_lily',
        direction: 'adventure',
        pageCount: 15,
        childName: 'מיה',
        childGender: 'girl',
        childAge: 6,
        declared: {
          moment: { page: 9, physicalAction: 'נשם לאט' },
          hook: { sound: 'ששש', appearsOnPages: [2, 3, 7] },
        },
      },
    }),
  },
];

const BROKEN_CASES: Array<{ file: string; input: ValidationInput; expectValidator?: string }> = [
  { file: 'broken-foreign-chars.md', input: GOOD_CASES[0].input, expectValidator: 'foreignChars' },
  { file: 'broken-page-count.md', input: GOOD_CASES[0].input, expectValidator: 'pageCount' },
  { file: 'broken-page-sequence.md', input: GOOD_CASES[0].input, expectValidator: 'pageSequence' },
  { file: 'broken-gender.md', input: { ...GOOD_CASES[0].input, context: { ...GOOD_CASES[0].input.context, childGender: 'girl' } }, expectValidator: 'genderConsistency' },
  { file: 'broken-companion-name.md', input: GOOD_CASES[3].input, expectValidator: 'companionName' },
  { file: 'broken-forbidden-anatomy.md', input: GOOD_CASES[3].input, expectValidator: 'forbiddenAnatomy' },
  { file: 'broken-kill-phrase.md', input: GOOD_CASES[0].input, expectValidator: 'killPhrases' },
  { file: 'broken-error-notes.md', input: GOOD_CASES[0].input, expectValidator: 'errorNotes' },
  { file: 'broken-unicode.md', input: GOOD_CASES[0].input, expectValidator: 'unicodeEscapes' },
  { file: 'broken-forbidden-objects.md', input: GOOD_CASES[3].input, expectValidator: 'forbiddenObjects' },
];

describe('validateStory', () => {
  it('validates 20-page story under 500ms', () => {
    const md = loadSample('good-fantasy.md');
    const start = performance.now();
    const report = validateStory({ ...GOOD_CASES[2].input, storyMarkdown: md });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(report.verdict).toBe('PASS');
  });

  describe('GOOD samples — no BLOCKING findings', () => {
    for (const { file, input } of GOOD_CASES) {
      it(file, () => {
        const report = validateStory({ ...input, storyMarkdown: loadSample(file) });
        const blocking = report.findings.filter((f) => f.severity === 'BLOCKING');
        expect(report.verdict, blocking.map((f) => `${f.validator}: ${f.message}`).join('\n')).toBe('PASS');
      });
    }
  });

  describe('BROKEN samples — must FAIL with expected validator', () => {
    for (const { file, input, expectValidator } of BROKEN_CASES) {
      it(file, () => {
        const report = validateStory({ ...input, storyMarkdown: loadSample(file) });
        expect(report.verdict).toBe('FAIL');
        if (expectValidator) {
          expect(report.findings.some((f) => f.validator === expectValidator && f.severity === 'BLOCKING')).toBe(
            true
          );
        }
      });
    }
  });

  describe('repair mode', () => {
    it('modeCompliance flags pages changed outside changeOnly', () => {
      const prev = loadSample('good-bedtime.md');
      const pages = defaultBedtimePages(10);
      pages[3] = { ...pages[3], text: 'טקסט שונה לגמרי בלי לילי.' };
      const next = buildStoryMarkdown({ companionId: 'bat_lily', direction: 'bedtime', pages: 10 }, pages);
      const report = validateStory({
        storyMarkdown: next,
        mode: 'repair',
        context: GOOD_CASES[0].input.context,
        previousVersion: {
          storyMarkdown: prev,
          preserveList: ['לילי'],
          changeOnly: [5],
        },
      });
      expect(report.verdict).toBe('FAIL');
      expect(report.findings.some((f) => f.validator === 'modeCompliance')).toBe(true);
    });
  });
});
