import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { personalStoryboardFixture } from './personal-storyboard-fixture';
import { PROTOTYPE_COMPANION_ROSTER, resolvePersonalWizardOptions } from '../options';
import { preparePersonalStory, writePersonalStory } from '../story-writer';
import { prepareStoryEdit } from '../story-editor';
import { canonicalJson } from '../request-acceptance';
import { IntakeLedger } from '../intake-ledger';

// Representative Hebrew capacity, NOT provider-written prose or a max-schema guarantee.
// Six long books, all fact groups populated; all old paid artifacts remain untouched.
const paragraph = 'אלמה הביטה בחבר שלה, ואז שוב בשביל שנפתח בין העצים. היא רצתה להגיע לפני שהאור ייעלם, אבל האבן הקטנה נשארה תקועה בדיוק במקום הלא נכון. "רגע, יש לי רעיון," אמרה. במקום לדחוף שוב, היא כרעה והקשיבה לצליל שמתחתיה. החבר הטה את הראש. הצליל הפסיק כשאלמה הסירה את היד, וחזר כשהניחה אותה. הפעם שניהם צחקו. הם בחרו לבדוק מה מסתתר בצד השני, יחד ובקצב שאפשר להם לראות.';
const hash = (data: unknown) => createHash('sha256').update(canonicalJson(data)).digest('hex');
describe('long Hebrew input headroom with complete characters', () => {
  it.each(PROTOTYPE_COMPANION_ROSTER)('measures actual planner, writer and editor for %s', async id => {
    const f = await personalStoryboardFixture('long', id);
    const request = structuredClone(f.request); request.child.age = 8; request.child.name = 'אלמה';
    request.noDifficulty = false; request.intent = { kind: 'topic', topicId: 'confidence' };
    // Keep the original interest ID used by the registered synthetic selection fixture.
    for (const [kind, count] of [['interest', 5], ['difficulty', 4], ['other', 8]] as const) {
      for (let i = 0; i < count; i++) request.facts.push({ id: `f_capacity${request.facts.length.toString().padStart(3, '0')}`,
        kind, source: 'fixture', value: `${request.facts.length} ${'פרט סינתטי מאושר שמסרו ההורים לצורך מדידת הקלט בלבד '.repeat(2)}`.slice(0, 80).trim() });
    }
    expect(request.facts).toHaveLength(18);
    const options = resolvePersonalWizardOptions(); const prepared = preparePersonalStory(request, options);
    const plan = structuredClone(f.draftResult.plan); plan.requestId = prepared.accepted.requestId; plan.resilience.mode = 'chosen_topic';
    for (const beat of plan.beats) Object.assign(beat, {
      location: 'קרחת יער בהירה לצד השביל שמוביל אל הגינה',
      transitionReason: 'הצליל שהילדה שמעה משתנה בצד השני, והיא רוצה לבדוק אם הרעיון שלה מתאים גם שם',
      childAction: 'אלמה בוחרת לעצור לרגע, להקשיב ולנסות דרך אחרת במקום לדחוף שוב את האבן',
      companionAction: 'החבר מטה את הראש, מציע נקודת מבט אחרת ומחזיק את מה שאלמה ביקשה ממנו',
      consequence: 'הניסיון חושף פרט חדש ולכן הם משנים את הדרך, אך עדיין צריכים להבין לאן היא מובילה',
      continuity: 'שניהם נשארים ליד אותו שביל, האבן אינה משתנה, והחפץ שהחבר מחזיק לא עובר ליד אחרת בלי פעולה',
    });
    const planDigest = hash(plan); const callBytes: Record<string, number> = {};
    const result = await writePersonalStory({ prepared, userId: 'capacity', jobId: `capacity_${id}`,
      settings: { model: 'gpt-6.1-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() }, ledger: new IntakeLedger(),
      signal: new AbortController().signal, provider: () => ({ generate: async call => {
        callBytes[call.stage] = Buffer.byteLength(call.instructions + call.input, 'utf8');
        return { output: call.stage === 'plan' ? { ...plan, adventureSelection: f.draftResult.planning!.selection }
          : { requestId: prepared.accepted.requestId, planDigest, title: 'אלמה והשביל המפתיע',
            pages: plan.beats.map(beat => ({ pageNumber: beat.pageNumber, text: paragraph })) }, usage: { inputTokens: 1, outputTokens: 1 } };
      } }) });
    const editor = prepareStoryEdit(prepared, result);
    callBytes.editor = Buffer.byteLength(editor.instructions + editor.input, 'utf8');
    for (const bytes of Object.values(callBytes)) expect(bytes).toBeLessThanOrEqual(52_000);
    expect(paragraph.split(/\s+/u).length).toBeGreaterThanOrEqual(45);
    expect(paragraph.split(/\s+/u).length).toBeLessThanOrEqual(85);
    console.log(JSON.stringify({ kind: 'synthetic_capacity_not_live_adequacy', companion: id, spreads: 16,
      proseWordsPerSpread: paragraph.split(/\s+/u).length, callBytes, editorHeadroomBytes: 52_000 - callBytes.editor }));
  });
});
