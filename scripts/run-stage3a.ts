import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnvConfig } from '@next/env';
import {
  generateBrain,
  generateOutline,
  generateRawStory,
  type StoryInput,
} from '../backend/providers/pipeline';
import { STORY_LENGTHS, TOPICS } from '../backend/config/wizard';

function buildDebugInput(): StoryInput {
  const topic = TOPICS.find((t) => t.id === 'nightfear') ?? TOPICS[0];
  return {
    childName: 'יואב',
    childAge: 5,
    childGender: 'boy',
    childTraits: ['סקרן', 'אמיץ'],
    childSuperpower: 'אומץ',
    familyContext: {
      parent1: { name: 'אמא', description: 'מחבקת ומרגיעה בקול שקט' },
      parent2: { name: 'אבא', description: 'עוזר לו להרגיש בטוח בלילה' },
      homeText: 'דירה עם חדר ילדים נעים ומנורת לילה',
    },
    topic: topic.id,
    topicLabel: topic.label,
    challengeItems: ['שומע רעשים בלילה'],
    challengeFree: 'נבהל מרשרוש קטן',
    outcomeItems: ['להרגיש בטוח בלילה'],
    outcomeFree: 'להישאר רגוע במיטה',
    helperItems: ['אור קטן בלילה 🌙'],
    helperFree: 'נשימה עמוקה עם אמא',
    avoidItems: ['דמויות מפחידות'],
    avoidFree: 'בלי תיאורים מפחידים',
    storyLength: 'short',
    illustrationStyle: 'soft_hand_drawn_storybook',
  };
}

async function run(): Promise<void> {
  loadEnvConfig(process.cwd());
  const input = buildDebugInput();
  const pageCount = STORY_LENGTHS.find((l) => l.id === input.storyLength)?.pages ?? 8;

  const { brain } = await generateBrain(input);
  const { outline } = await generateOutline(brain, pageCount, input);
  const { rawStory } = await generateRawStory(brain, outline, input, pageCount);

  const outPath = join(process.cwd(), 'debug-story.txt');
  await writeFile(outPath, rawStory, 'utf8');
  console.log(`Wrote ${outPath}`);
}

run().catch((err) => {
  console.error('[run-stage3a] failed:', err);
  process.exit(1);
});