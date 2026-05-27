/**
 * Pre-flight sanity checks before Short-Book Bedtime re-run (no image generation).
 *
 * Usage: npx tsx scripts/preflight-short-book-bedtime.ts
 */
import { classifyStyle02SceneClass } from '../lib/style02-gptimage';
import {
  assertStoryPersonalizationGate,
  runStoryPersonalizationGate,
  StoryPersonalizationGateError,
} from '../lib/story-bank-personalization';
import { sanitizeSceneTextForSingleMoment } from '../lib/image-scene-text';

const BROKEN_MICHAL = `מיכל שוכבת במיטה. עיניה גולשות. היא מחזיקה את המבט.`;

/** All 10 pages from the failed short-book run (Hebrew + imageDirection). */
const PREVIOUS_RUN_PAGES = [
  {
    bookPageText:
      'מיכל שוכבת במיטה, האור העמום מהמסדרון משאיר פס רך על הקיר. על המדף מחכה מדחום קטן.',
    imagePrompt:
      'evening bedroom, soft night light, small thermometer resting on a shelf by the bed',
  },
  {
    bookPageText: 'מיכל מושכת את השמיכה סביב רגליה.',
    imagePrompt: 'close-up bed and pillow, Bolly mid small roll, blanket detail',
  },
  {
    bookPageText: 'עיניה גולשות אל המדחום שעל המדף.',
    imagePrompt: 'child in bed, eyes drifting toward the small thermometer on the shelf, then away',
  },
  {
    bookPageText: 'המחשבה על מחר גורמת לכתפיים שלה לעלות מעט.',
    imagePrompt: "close-up child's shoulders rising slightly, hand half-closing, in bed",
  },
  {
    bookPageText: 'בּוֹלִי מתקרב אליה ונעצר.',
    imagePrompt: 'close-up Bolly curled into a small ball on the blanket beside the child',
  },
  {
    bookPageText: 'היא מסתכלת ביד שלה. היד נסגרת לאגרוף קטן ואז נפתחת לאט לאט.',
    imagePrompt: 'close-up small hand closing to a fist then opening slowly, on the blanket',
  },
  {
    bookPageText: 'היא מושיטה אצבע קטנה ונוגעת בבּוֹלִי בעדינות.',
    imagePrompt: "close-up child's finger gently touching Bolly, one small plate open, warm glow inside",
  },
  {
    bookPageText: 'המדחום עדיין על המדף, באותו מקום.',
    imagePrompt: 'child looking calmly at the thermometer still resting on the shelf, body relaxed',
  },
  {
    bookPageText: 'מיכל מחייכת חיוך שקט.',
    imagePrompt: "close-up Bolly nudging the pillow, child's small quiet smile, body soft in bed",
  },
  {
    bookPageText: 'היא ישנה בשקט, נשימה רגועה.',
    imagePrompt:
      'close-up bedside warm light, child asleep, thermometer still small on the shelf, Bolly snug by the hand',
  },
];

const PAGE_6_SCENE = 'close-up small hand closing to a fist then opening slowly, on the blanket';

function checkGateOnBrokenStory(): void {
  const failures = runStoryPersonalizationGate({
    wizard: { childName: 'Baboo', childGender: 'boy', companionName: 'בּוֹלִי' },
    pages: [{ pageNumber: 1, text: BROKEN_MICHAL }],
  });
  if (failures.length === 0) {
    throw new Error('Expected personalization gate to FAIL on broken Michal story');
  }
  try {
    assertStoryPersonalizationGate({
      wizard: { childName: 'Baboo', childGender: 'boy', companionName: 'בּוֹלִי' },
      pages: [{ pageNumber: 1, text: BROKEN_MICHAL }],
    });
    throw new Error('assertStoryPersonalizationGate should have thrown');
  } catch (e) {
    if (!(e instanceof StoryPersonalizationGateError)) throw e;
  }
  console.log('✓ Personalization gate FAILS on known-bad Michal input');
}

function checkSceneClassifier(): void {
  const classes = PREVIOUS_RUN_PAGES.map((p) =>
    classifyStyle02SceneClass({ bookPageText: p.bookPageText, imagePrompt: p.imagePrompt })
  );
  const nightCount = classes.filter((c) => c === 'night-bedroom').length;
  if (nightCount !== PREVIOUS_RUN_PAGES.length) {
    throw new Error(
      `Expected all ${PREVIOUS_RUN_PAGES.length} sample pages as night-bedroom, got: ${classes.join(', ')}`
    );
  }
  if (nightCount !== 10) {
    throw new Error(
      `Expected all 10 previous-run pages as night-bedroom, got ${nightCount}/10: ${classes.join(', ')}`
    );
  }
  console.log(`✓ Scene classifier: ${nightCount}/10 previous-run pages → night-bedroom`);
}

function checkTemporalRewrite(): void {
  const sanitized = sanitizeSceneTextForSingleMoment(PAGE_6_SCENE);
  if (/\bthen\b/i.test(sanitized)) {
    throw new Error(`Temporal connector survived rewrite: ${sanitized}`);
  }
  console.log(`✓ Page-6 temporal rewrite: "${PAGE_6_SCENE.slice(0, 50)}…" → "${sanitized.slice(0, 60)}…"`);
}

function main(): void {
  console.log('=== Short-Book Bedtime pre-flight ===\n');
  checkGateOnBrokenStory();
  checkSceneClassifier();
  checkTemporalRewrite();
  console.log('\nAll pre-flight checks passed. Safe to greenlight re-run.');
}

main();
