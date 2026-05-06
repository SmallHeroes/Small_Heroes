/**
 * Category contrast validation: NIGHT_FEAR vs ANGER_FRUSTRATION
 * Same pipeline as production: runStoryPipeline (identical to generateStory /api/generate text stage).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { runStoryPipeline, type StoryInput } from '../backend/providers/story';
import { TOPICS } from '../backend/config/wizard';
import { getCompanionByIdAndCategory } from '../lib/companions';
import { getCategoryBranching } from '../lib/categoryBranching';
import { buildDirectionDrafts, buildSharedStoryFoundation } from '../backend/providers/story-directions';

type DirInput = Parameters<typeof buildDirectionDrafts>[1];

function buildDirectionForCategory(
  category: 'NIGHT_FEAR' | 'ANGER_FRUSTRATION',
  childName: string,
  childAge: number,
  childGender: 'boy' | 'girl',
  childTraits: string[],
  topicId: string,
  topicLabel: string,
  categoryAnswers: Array<{ question: string; answer: string }>
) {
  const base: DirInput = {
    orderId: 'validate-qa',
    childName,
    childAge,
    childGender,
    childTraits,
    childImageUrl: null,
    illustrationStyle: 'pencil_watercolor',
    familyContext: null,
    topic: topicId,
    topicLabel,
    challengeItems: [],
    challengeFree: null,
    outcomeItems: [],
    helperItems: [],
    companion: getCompanionByIdAndCategory(
      category === 'NIGHT_FEAR' ? 'bat_lily' : 'kettle_kaki',
      category
    ),
    challengeCategory: category,
    categoryAnswers,
  };
  const foundation = buildSharedStoryFoundation(base);
  const drafts = buildDirectionDrafts(foundation, base);
  const c = drafts.find((d) => d.archetype === 'connection');
  if (!c) throw new Error('missing connection draft');
  return c;
}

function buildStoryInput(
  category: 'NIGHT_FEAR' | 'ANGER_FRUSTRATION',
  topicId: 'nightfear' | 'anger'
): StoryInput {
  const b = getCategoryBranching(category)!;
  const answersNight: Array<{ question: string; answer: string }> = [
    {
      question: b.followUpQuestions[0]!,
      answer: 'הכי קשה אחרי שמכבים אור, כשהמסדרון כבר חשוך.',
    },
    {
      question: b.followUpQuestions[1]!,
      answer: 'להירדם לבד — אמא עדיין בחוץ, צריך "עוד ליווי" קטן.',
    },
    {
      question: b.followUpQuestions[2]!,
      answer: 'חוזר: צל שזז, לא מפלצת — אבל בלילה זה מרגיש אמיתי.',
    },
  ];
  const answersAnger: Array<{ question: string; answer: string }> = [
    {
      question: b.followUpQuestions[0]!,
      answer: "כשמשחק בנייה נופל—ליד השולחן בסלון, כולם שומעים",
    },
    {
      question: b.followUpQuestions[1]!,
      answer: "זה בונה־בונה, ואז 'בום' — לא מהקופסה, מהתסכול.",
    },
    {
      question: b.followUpQuestions[2]!,
      answer: "אחרי: אומר 'אסור לי' על הכעס, מתבייש אם בכיתי",
    },
  ];
  const categoryAnswers = category === 'NIGHT_FEAR' ? answersNight : answersAnger;

  const topic = TOPICS.find((t) => t.id === topicId)!;
  const dir = buildDirectionForCategory(
    category,
    'הראל',
    6,
    'boy',
    ['רגיש', 'אמיץ', 'אוהב לספר'],
    topic.id,
    topic.label,
    categoryAnswers
  );

  const challengeItems = topicId === 'nightfear' ? [b.typicalParentIntent[1]!] : [b.typicalParentIntent[0]!];
  const avoidItems = topicId === 'nightfear' ? [b.treatmentStrategy.avoid[0]!] : [b.treatmentStrategy.avoid[0]!];

  return {
    childName: 'הראל',
    childAge: 6,
    childGender: 'boy',
    childTraits: ['רגיש', 'אמיץ', 'אוהב לספר'],
    childSuperpower: 'דמיון עשיר',
    // homeText only — if parent names are set, the pipeline requires them in prose with "meaningful action" (see pipeline.ts).
    familyContext: {
      homeText: 'דירה עם מסדרון ארוך, מנורת לילה, שולחנות משחק, ומיטה עם שמיכה מוכרת',
    },
    topic: topic.id,
    topicLabel: topic.label,
    challengeItems,
    challengeFree: topicId === 'nightfear' ? 'בלילה אומר בלי קול: "הצל הזה זז" — ביקש נורה קטנה אבל לא תמיד מרגיש בטוח' : 'כשהדברים לא "יושבים" הוא זורק בובה, ואז מצטער',
    outcomeItems: topicId === 'nightfear' ? [b.typicalParentIntent[3]!] : [b.typicalParentIntent[2]!],
    outcomeFree: topicId === 'nightfear' ? 'להרגיש שהלילה "נושם" לצדו' : "לצאת מהסער בלי בושה על הגוף",
    helperItems: topicId === 'nightfear' ? ['אור אדום עמום 💡', 'מים בכוס 🥛'] : ['ריצה לחצר בטוחה 🏃', 'דופק אצבעות'],
    helperFree: topicId === 'nightfear' ? 'הורה "שומע" אפילו מהחדר השני' : 'הורה בונה גבול בלי "תעצר עכשיו" כעלבון',
    avoidItems: avoidItems as string[],
    avoidFree: `להימנע מ: ${b.treatmentStrategy.avoid.slice(0, 2).join(' · ')}`,
    storyLength: 'short',
    illustrationStyle: 'pencil_watercolor',
    childImageUrl: null,
    companionForStory: getCompanionByIdAndCategory(
      topicId === 'nightfear' ? 'bat_lily' : 'kettle_kaki',
      category
    ),
    challengeCategory: category,
    categoryAnswers,
    directionArchetype: 'connection',
    directionTitle: dir.title,
    directionEmotionalLabel: dir.emotionalLabel,
    directionStoryPremise: dir.storyPremise,
    directionOpeningScenePrompt: dir.openingScenePrompt,
  };
}

function forbiddenHaystack(s: string): string[] {
  const hits: string[] = [];
  if (/אין\s+מה\s+לפחד|אין מה לפחד/i.test(s)) hits.push('אין מה לפחד');
  if (/פשוט\s+תת?ירגע|תירגע עכשיו|עצור הכל ותתירגע/i.test(s)) hits.push('תירגע-פשוט/פקודה');
  if (/ניסינו|בסוף (ה|ש)יום|מסר חשוב/i.test(s) && s.length < 20000) { /* no-op, weak */ }
  return hits;
}

async function run(): Promise<void> {
  loadEnvConfig(process.cwd());
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing AI provider key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'debug-story-validate', stamp);
  await mkdir(outDir, { recursive: true });

  const cases: { id: string; input: StoryInput }[] = [
    { id: 'NIGHT_FEAR', input: buildStoryInput('NIGHT_FEAR', 'nightfear') },
    { id: 'ANGER_FRUSTRATION', input: buildStoryInput('ANGER_FRUSTRATION', 'anger') },
  ];

  for (const c of cases) {
    console.log(`\n[validate] Generating ${c.id}...`);
    const result = await runStoryPipeline(c.input);
    const fullText = [result.title, '', result.coverText, '', ...result.pages.map((p) => p.text)]
      .join('\n\n')
      .trim();

    const pageFile = [result.title, '', ...result.pages.map((p) => `---\n[עמוד ${p.pageNumber}]\n\n${p.text}`)].join(
      '\n\n'
    );

    await writeFile(join(outDir, `${c.id}.txt`), pageFile, 'utf8');
    await writeFile(
      join(outDir, `${c.id}-meta.json`),
      JSON.stringify(
        {
          category: c.id,
          childName: c.input.childName,
          directionTitle: c.input.directionTitle,
          coverText: result.coverText,
          forbiddenHits: forbiddenHaystack(fullText),
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`[validate] Wrote ${c.id}.txt (pages: ${result.pages.length}) meta forbidden:`, forbiddenHaystack(fullText));
  }

  await writeFile(
    join(outDir, 'README.txt'),
    [
      'NIGHT_FEAR vs ANGER_FRUSTRATION — runStoryPipeline (prod-equivalent to /api generate text).',
      'Same connection direction archetype; category + treatment differ.',
    ].join('\n'),
    'utf8'
  );
  console.log(`\nDone. Output: ${outDir}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
