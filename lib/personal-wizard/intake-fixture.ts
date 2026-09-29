/**
 * Labelled fixture intake for UX QA of the extraction/merge path WITHOUT any provider.
 *
 * The fixture never receives audio: its request type has no audio field, and it is triggered by a
 * separate test action, not by the recorder. Every fact it produces carries `source: 'fixture'`,
 * which the UI shows as "example" and the server reports as fixture data. The examples are
 * synthetic, written by hand; they are not a decoding of anything the parent said.
 *
 * Like a real provider call, a fixture response cannot be recalled once "sent": it resolves after
 * its delay even if the job was cancelled, so the draft's stale-result guard is what keeps a late
 * answer out of the profile.
 */
import {
  PERSONAL_INTAKE_EXTRACTION_VERSION,
  intakeResultSchema,
  type GrammaticalAddress,
  type IntakeResult,
} from './contract';
import { g } from './copy';

/**
 * simple = details only; mixed = conflicts, place and a direction; voice = the voice-first brief's
 * illustration (name, age, residence, a habit and an explicitly requested direction; no adventure
 * place, family or fear invented).
 */
export type FixtureExampleId = 'simple' | 'mixed' | 'voice';

export type FixtureIntakeRequest = {
  jobId: string;
  exampleId: FixtureExampleId;
  address: GrammaticalAddress;
};

export function buildFixtureResult(request: FixtureIntakeRequest): IntakeResult {
  const a = request.address;
  if (request.exampleId === 'voice') {
    return intakeResultSchema.parse({
      jobId: request.jobId,
      source: 'fixture',
      transcript: `בר ${g(a, 'בן', 'בת')} חמש, ${g(a, 'גר', 'גרה')} באודם, ${g(a, 'אוהב', 'אוהבת')} כדורגל, ולפני בעיטה ${g(a, 'הוא לוחש', 'היא לוחשת')} לכדור. הייתי רוצה הרפתקה על רעשים חזקים.`,
      extraction: {
        version: PERSONAL_INTAKE_EXTRACTION_VERSION,
        understood: true,
        facts: [
          { kind: 'residence', value: 'אודם' },
          { kind: 'interest', value: 'כדורגל' },
          { kind: 'habit', value: `${g(a, 'לוחש', 'לוחשת')} לכדור לפני בעיטה` },
        ],
        storyPlace: null,
        mentionedName: 'בר',
        mentionedAge: 5,
        explicitTopicId: 'sirens',
      },
    });
  }
  if (request.exampleId === 'simple') {
    return intakeResultSchema.parse({
      jobId: request.jobId,
      source: 'fixture',
      transcript: `${g(a, 'הוא', 'היא')} ממש ${g(a, 'אוהב', 'אוהבת')} לבנות מגדלים מקוביות ולצייר בגיר על המדרכה. ${g(a, 'הוא מתלהב', 'היא מתלהבת')} מהים, ובכל ערב ${g(a, 'סופר', 'סופרת')} את המדרגות בקול.`,
      extraction: {
        version: PERSONAL_INTAKE_EXTRACTION_VERSION,
        understood: true,
        facts: [
          { kind: 'interest', value: 'בניית מגדלים מקוביות' },
          { kind: 'interest', value: 'ציור בגיר על המדרכה' },
          { kind: 'favorite_place', value: 'הים' },
          { kind: 'habit', value: 'ספירת המדרגות בקול בכל ערב' },
        ],
        storyPlace: null,
        mentionedName: null,
        mentionedAge: null,
        explicitTopicId: null,
      },
    });
  }
  return intakeResultSchema.parse({
    jobId: request.jobId,
    source: 'fixture',
    transcript: `${g(a, 'הוא בן', 'היא בת')} שש. אנחנו גרים בקיבוץ, ויש ${g(a, 'לו', 'לה')} אחות קטנה בשם נועה. ${g(a, 'הוא לא אוהב', 'היא לא אוהבת')} מסיבות רועשות. בספטמבר ${g(a, 'הוא מתחיל', 'היא מתחילה')} גן חדש, ואולי כדאי שהסיפור ייתן לזה מקום. ההרפתקה יכולה להתחיל ליד הים.`,
    extraction: {
      version: PERSONAL_INTAKE_EXTRACTION_VERSION,
      understood: true,
      facts: [
        { kind: 'residence', value: 'קיבוץ' },
        { kind: 'family', value: 'אחות קטנה בשם נועה' },
        { kind: 'other', value: `${g(a, 'לא אוהב', 'לא אוהבת')} מסיבות רועשות` },
        { kind: 'recent_event', value: `${g(a, 'מתחיל', 'מתחילה')} גן חדש בספטמבר` },
      ],
      storyPlace: 'ליד הים',
      mentionedName: null,
      mentionedAge: 6,
      explicitTopicId: 'transitions',
    },
  });
}

export function runFixtureIntake(
  request: FixtureIntakeRequest,
  timing: { delayMs: number; setTimeout: (callback: () => void, ms: number) => unknown },
): Promise<IntakeResult> {
  return new Promise((resolve) => {
    timing.setTimeout(() => resolve(buildFixtureResult(request)), timing.delayMs);
  });
}
