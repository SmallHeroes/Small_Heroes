import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import { runStoryPipeline, type StoryInput } from '../backend/providers/pipeline';
import { TOPICS } from '../backend/config/wizard';

type StoryCase = {
  id: string;
  label: string;
  input: StoryInput;
};

function topicById(id: string) {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0];
}

function buildCases(): StoryCase[] {
  const baseFamily = {
    parent1: { name: 'אמא', description: 'מדברת בשקט ומרגיעה בנשימות' },
    parent2: { name: 'אבא', description: 'מצחיק אותו ועוזר לו לחשוב מה לעשות' },
    homeText: 'דירה נעימה עם מסדרון ארוך ומנורת לילה קטנה',
  };

  const c1Topic = topicById('nightfear');
  const c2Topic = topicById('sirens');
  const c3Topic = topicById('social');
  const c4Topic = topicById('selfconfidence');
  const c5Topic = topicById('focus');

  return [
    {
      id: '01-night-sounds-details',
      label: 'Fear of night sounds + details',
      input: {
        childName: 'נועה',
        childAge: 5,
        childGender: 'girl',
        childTraits: ['סקרנית', 'עדינה', 'מצחיקה'],
        childSuperpower: 'שם לב לפרטים',
        familyContext: baseFamily,
        topic: c1Topic.id,
        topicLabel: c1Topic.label,
        challengeItems: ['מפחדת מקולות בלילה'],
        challengeFree: 'כשיש רעש קטן בחדר היא מתכווצת מתחת לשמיכה',
        outcomeItems: ['להרגיש בטוחה בלילה'],
        outcomeFree: 'להצליח להקשיב לרעש בלי להיבהל מיד',
        helperItems: ['נשימות עמוקות 🌬️', 'אור קטן בחדר 💡'],
        helperFree: 'שיר קצר שמרגיע לפני השינה',
        avoidItems: ['תמונות מפחידות'],
        avoidFree: 'בלי תיאורים קשים',
        storyLength: 'medium',
        illustrationStyle: 'soft',
      },
    },
    {
      id: '02-siren-persistence',
      label: 'Siren anxiety + persistence',
      input: {
        childName: 'אורי',
        childAge: 6,
        childGender: 'boy',
        childTraits: ['אמיץ', 'חושב', 'רגיש'],
        childSuperpower: 'לא מוותר',
        familyContext: baseFamily,
        topic: c2Topic.id,
        topicLabel: c2Topic.label,
        challengeItems: ['נבהל מאזעקות'],
        challengeFree: 'כשהאזעקה מתחילה הוא קופא ורוצה לברוח מהר',
        outcomeItems: ['להישאר רגוע ולעשות מה שצריך'],
        outcomeFree: 'להצליח לזוז למרחב מוגן גם כשהלב דופק מהר',
        helperItems: ['חיבוק חזק 🤗', 'משפט קצר ומרגיע 💬'],
        helperFree: 'צעדים קבועים עד החדר הבטוח',
        avoidItems: ['תיאורים מלחיצים'],
        avoidFree: 'בלי מלחמה מפורטת',
        storyLength: 'medium',
        illustrationStyle: 'soft',
      },
    },
    {
      id: '03-social-kindness',
      label: 'Social fear + kindness',
      input: {
        childName: 'תמר',
        childAge: 5,
        childGender: 'girl',
        childTraits: ['חכמה', 'ביישנית', 'חמה'],
        childSuperpower: 'לב טוב',
        familyContext: baseFamily,
        topic: c3Topic.id,
        topicLabel: c3Topic.label,
        challengeItems: ['מתביישת להצטרף למשחק'],
        challengeFree: 'בגן היא עומדת בצד ורוצה לגשת אבל נעצרת',
        outcomeItems: ['להצטרף בביטחון לחברים'],
        outcomeFree: 'להתחיל משחק קטן עם ילדים אחרים',
        helperItems: ['משפט פתיחה פשוט 🗣️', 'חיוך קטן 🙂'],
        helperFree: 'לבחור ילד אחד להתחיל ממנו',
        avoidItems: ['ביקורת חזקה'],
        avoidFree: 'בלי שיפוטיות',
        storyLength: 'medium',
        illustrationStyle: 'soft',
      },
    },
    {
      id: '04-selfconfidence-imagination',
      label: 'Self-doubt + rich imagination',
      input: {
        childName: 'ליאם',
        childAge: 6,
        childGender: 'boy',
        childTraits: ['יצירתי', 'רגיש', 'מנסה'],
        childSuperpower: 'דמיון עשיר',
        familyContext: baseFamily,
        topic: c4Topic.id,
        topicLabel: c4Topic.label,
        challengeItems: ['חושב שהוא לא מספיק טוב'],
        challengeFree: 'כשלא מצליח בפעם הראשונה הוא אומר אני לא יכול',
        outcomeItems: ['להאמין בעצמו ולנסות שוב'],
        outcomeFree: 'לזכור שיש דרך חדשה גם אחרי טעות',
        helperItems: ['מילים מעודדות 💛', 'פירוק משימה לשלבים 🧩'],
        helperFree: 'לחגוג ניסיון ולא רק תוצאה',
        avoidItems: ['השוואות לאחרים'],
        avoidFree: 'בלי ביקורת פוגעת',
        storyLength: 'medium',
        illustrationStyle: 'soft',
      },
    },
    {
      id: '05-focus-selfcalm',
      label: 'Losing focus + self-calm',
      input: {
        childName: 'יהלי',
        childAge: 5,
        childGender: 'other',
        childTraits: ['אנרגטי', 'סקרן', 'מתוק'],
        childSuperpower: 'יודע להירגע',
        familyContext: baseFamily,
        topic: c5Topic.id,
        topicLabel: c5Topic.label,
        challengeItems: ['קשה להתרכז במשימה'],
        challengeFree: 'מתחיל משהו ואז עובר לדבר אחר במהירות',
        outcomeItems: ['להישאר עם משימה עד הסוף'],
        outcomeFree: 'לעצור, לנשום, ולחזור למה שהתחיל',
        helperItems: ['תזכורת נשימה 🌬️', 'טיימר קצר ⏱️'],
        helperFree: 'אות יד קטן שמזכיר להתמקד',
        avoidItems: ['עומס גירויים'],
        avoidFree: 'בלי הצפה חזותית או רעש גדול',
        storyLength: 'medium',
        illustrationStyle: 'soft',
      },
    },
  ];
}

async function run(): Promise<void> {
  loadEnvConfig(process.cwd());

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('Missing AI provider key. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in env.');
  }

  const cases = buildCases();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(process.cwd(), 'debug-story-batch', stamp);
  await mkdir(outDir, { recursive: true });

  for (const storyCase of cases) {
    console.log(`Generating ${storyCase.id}...`);

    const result = await runStoryPipeline(storyCase.input);

    const baseName = storyCase.id;
    const pageText = result.pages
      .map((p) => `# Page ${p.pageNumber}\n${p.text}`)
      .join('\n\n');

    await writeFile(
      join(outDir, `${baseName}.json`),
      JSON.stringify(
        {
          id: storyCase.id,
          label: storyCase.label,
          input: storyCase.input,
          pageCount: result.pages.length,
          title: result.title,
          coverText: result.coverText,
          characterSheet: result.characterSheet,
          concept: result.concept,
          pages: result.pages,
          visualBible: result.visualBible,
          pageCompositionPlan: result.pageCompositionPlan,
          meta: result.meta,
        },
        null,
        2,
      ),
      'utf8',
    );

    await writeFile(join(outDir, `${baseName}.txt`), pageText, 'utf8');
  }

  await writeFile(
    join(outDir, 'README.txt'),
    [
      'Generated 5 stories using current pipeline (no prompt changes).',
      '',
      'Files:',
      '- *.json: full structured outputs',
      '- *.txt: page-by-page story text',
      '',
      'Cases:',
      ...cases.map((c, i) => `${i + 1}. ${c.id} — ${c.label}`),
    ].join('\n'),
    'utf8',
  );

  console.log(`Done. Outputs saved to: ${outDir}`);
}

run().catch((err) => {
  console.error('[generate-5-stories] failed:', err);
  process.exit(1);
});
