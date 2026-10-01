import { describe, expect, it } from 'vitest';

import {
  LIMITS,
  PERSONAL_INTAKE_EXTRACTION_VERSION,
  comparableText,
  isValidChildName,
  normalizeText,
  reviewedPersonalBookRequestSchema,
  similarDetails,
  type IntakeExtraction,
  type IntakeResult,
  type PersonalBookDraft,
} from '../contract';
import {
  abandonIntakeJob,
  activeFacts,
  addAvoid,
  addTypedFact,
  applyIntakeResult,
  buildReviewedRequest,
  chipIsSelected,
  commitChildName,
  commitChildResidence,
  commitStoryPlace,
  confirmFactsReview,
  createDraft,
  dismissIntentSuggestion,
  editFactValue,
  failIntakeJob,
  removeFact,
  requestContainsFixtureData,
  requestIssues,
  resolveConflict,
  setChildAddress,
  setChildAge,
  setChildName,
  setChildResidence,
  setCompanion,
  setIntent,
  setNoDifficulty,
  startIntakeJob,
  summarizeRequest,
  toggleChip,
  toggleHardChip,
  type IdFactory,
} from '../draft';
import { showDraftNotice, switchTellMode, tellViewOf } from '../tell-view';
import { buildFixtureResult } from '../intake-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { acceptPersonalBookRequest } from '../request-acceptance';

function sequentialIds(): IdFactory {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}_${String(counter).padStart(8, '0')}`;
  };
}

describe('memory-only recording UI disclosure', () => {
  it.each([
    [1, 'start', false, false],
    [1, 'write', false, true],
    [1, 'card', false, true],
    [1, 'start', true, true],
    [1, 'recording', false, false],
    [1, 'recording', true, false],
    [1, 'processing', true, false],
    [2, 'start', false, true],
    [3, 'start', false, true],
    [4, 'start', false, true],
  ] as const)('step %s, view %s, clip %s has notice %s', (step, view, clip, expected) => {
    expect(showDraftNotice(step, view, clip)).toBe(expected);
  });
});

const ALLOWED_TOPICS = new Set(['transitions', 'night', 'social']);

/**
 * The child's single-valued basics, all typed, and "nothing special is hard" answered. What the
 * child loves is a list, so tests add it themselves, or through `ready` right before a request.
 */
function basics(makeId = sequentialIds()): { draft: PersonalBookDraft; makeId: IdFactory } {
  let draft = createDraft('d_00000000test');
  draft = setChildName(draft, 'בר');
  draft = setChildAge(draft, 5);
  draft = setChildAddress(draft, 'boy');
  draft = setChildResidence(draft, 'אודם');
  draft = setNoDifficulty(draft, true);
  return { draft, makeId };
}

/** The same basics without a residence, for tests where a recording is heard to fill it. */
function basicsWithoutResidence(makeId = sequentialIds()): { draft: PersonalBookDraft; makeId: IdFactory } {
  const { draft } = basics(makeId);
  return { draft: setChildResidence(draft, ''), makeId };
}

/** Adds the must-have "what the child loves" (typed, a fixed id) only when none is listed yet. */
function ready(draft: PersonalBookDraft): PersonalBookDraft {
  if (activeFacts(draft).some((fact) => fact.kind === 'interest')) return draft;
  return addTypedFact(draft, 'interest', 'ספרים', () => 'f_baseline01').draft;
}

function extraction(partial: Partial<IntakeExtraction>): IntakeExtraction {
  return {
    version: PERSONAL_INTAKE_EXTRACTION_VERSION,
    understood: true,
    facts: [],
    storyPlace: null,
    mentionedName: null,
    mentionedAge: null,
    mentionedAddress: null,
    residence: null,
    explicitTopicId: null,
    hardTopicId: null,
    ...partial,
  };
}

function transcriptResult(jobId: string, partial: Partial<IntakeExtraction>): IntakeResult {
  return { jobId, source: 'transcript', transcript: 'דוגמה', extraction: extraction(partial) };
}

const merge = (draft: PersonalBookDraft, result: IntakeResult, makeId: IdFactory) =>
  applyIntakeResult(draft, result, { allowedTopicIds: ALLOWED_TOPICS, makeId });

describe('text hygiene and names', () => {
  it('normalizes whitespace and strips bidi/control characters', () => {
    expect(normalizeText('  בר‮  הגיבור\u0007 ')).toBe('בר הגיבור');
    expect(comparableText('מוּזִיקָה!')).toBe(comparableText('מוזיקה'));
  });

  it('accepts letters, geresh and hyphen, rejects digits, markup and over-long names', () => {
    expect(isValidChildName('בר')).toBe(true);
    expect(isValidChildName('ג׳וני')).toBe(true);
    expect(isValidChildName('אור-לי')).toBe(true);
    expect(isValidChildName('בר2')).toBe(false);
    expect(isValidChildName('<b>')).toBe(false);
    expect(isValidChildName('א'.repeat(LIMITS.nameMax + 1))).toBe(false);
    expect(isValidChildName(' בר')).toBe(false);
  });
});

describe('manual, chip and mixed entry reach one request', () => {
  it('a manual-only path (no microphone at all) produces a complete request', () => {
    const { draft: start, makeId } = basics();
    let draft = addTypedFact(start, 'interest', 'בניית מגדלים', makeId).draft;
    draft = toggleChip(draft, { id: 'music', label: 'מוזיקה', kind: 'interest' }, makeId).draft;
    draft = addTypedFact(draft, 'habit', 'שר בקול באוטו', makeId).draft;
    draft = commitStoryPlace(draft, 'באודם');
    draft = confirmFactsReview(draft);
    draft = setCompanion(draft, 'dragon_dini');
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.facts.map((fact) => [fact.kind, fact.value, fact.source])).toEqual([
      ['interest', 'בניית מגדלים', 'typed'],
      ['interest', 'מוזיקה', 'chip'],
      ['habit', 'שר בקול באוטו', 'typed'],
    ]);
    expect(built.request.storyPlace).toEqual({ value: 'באודם', source: 'typed' });
    expect(built.request.intent).toBeNull();
    expect(reviewedPersonalBookRequestSchema.parse(built.request)).toEqual(built.request);
  });

  it('continuing needs what the child loves; nothing is invented to fill a must-have', () => {
    const { draft: start } = basics();
    const draft = setCompanion(confirmFactsReview(start), 'panda_anat');
    const refused = buildReviewedRequest(draft);
    expect(!refused.ok && refused.issues.map((issue) => issue.code)).toEqual(['loves_missing']);
    const built = buildReviewedRequest(ready(draft));
    expect(built.ok && built.request.facts.map((fact) => [fact.kind, fact.value, fact.source])).toEqual([
      ['interest', 'ספרים', 'typed'],
    ]);
    expect(built.ok && built.request.storyPlace).toBeNull();
    expect(built.ok && [built.request.noDifficulty, built.request.intent]).toEqual([true, null]);
  });

  it('pressing a chip twice removes it; renaming its value keeps a single fact', () => {
    const { draft: start, makeId } = basics();
    const chip = { id: 'ball', label: 'כדור', kind: 'interest' as const };
    let draft = toggleChip(start, chip, makeId).draft;
    expect(chipIsSelected(draft, 'ball')).toBe(true);
    const factId = activeFacts(draft)[0].id;
    draft = editFactValue(draft, factId, 'כדורגל עם אבא בשבת').draft;
    expect(activeFacts(draft)).toHaveLength(1);
    expect(chipIsSelected(draft, 'ball')).toBe(true);
    draft = toggleChip(draft, chip, makeId).draft;
    expect(activeFacts(draft)).toHaveLength(0);
    expect(chipIsSelected(draft, 'ball')).toBe(false);
  });

  it('typing a value that a chip already added does not duplicate it', () => {
    const { draft: start, makeId } = basics();
    const draft = toggleChip(start, { id: 'music', label: 'מוזיקה', kind: 'interest' }, makeId).draft;
    const typed = addTypedFact(draft, 'interest', ' מוזיקה ', makeId);
    expect(typed.outcome).toBe('duplicate');
    expect(activeFacts(typed.draft)).toHaveLength(1);
  });

  it('enforces a ceiling per group, so a full group never blocks another (live trial F1)', () => {
    const { draft: start, makeId } = basics();
    let draft = start;
    for (let index = 0; index < LIMITS.lovesMax; index += 1) {
      draft = addTypedFact(draft, 'interest', `תחביב ${'א'.repeat(index + 1)}`, makeId).draft;
    }
    for (let index = 0; index < LIMITS.bonusMax; index += 1) {
      draft = addTypedFact(draft, index % 2 ? 'habit' : 'family', `פרט ${'ב'.repeat(index + 1)}`, makeId).draft;
    }
    expect(addTypedFact(draft, 'interest', 'עוד אחד', makeId).outcome).toBe('limit');
    expect(addTypedFact(draft, 'other', 'עוד פרט', makeId).outcome).toBe('limit');
    // Both other groups are full, and what is hard still gets in, up to its own ceiling.
    for (let index = 0; index < LIMITS.hardMax; index += 1) {
      const added = addTypedFact(draft, 'difficulty', `קשה ${'ג'.repeat(index + 1)}`, makeId);
      expect(added.outcome).toBe('added');
      draft = added.draft;
    }
    expect(addTypedFact(draft, 'difficulty', 'עוד קושי', makeId).outcome).toBe('limit');
    expect(addTypedFact(start, 'interest', 'א'.repeat(LIMITS.factValueMax + 1), makeId).outcome).toBe('too_long');
    expect(addAvoid(start, 'ב'.repeat(LIMITS.avoidItemMax + 1)).outcome).toBe('too_long');
  });
});

describe('intake merge never overwrites, resurrects or lands late', () => {
  it('adds extracted details as proposed until the parent continues with the list', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    const merged = merge(draft, transcriptResult('j_00000001', { facts: [{ kind: 'interest', value: 'ציור' }] }), makeId);
    expect(merged.applied).toBe(true);
    draft = merged.draft;
    expect(activeFacts(draft)[0].status).toBe('proposed');
    const beforeReview = buildReviewedRequest(setCompanion(draft, 'fox_uri'));
    expect(beforeReview.ok).toBe(false);
    expect(!beforeReview.ok && beforeReview.issues.map((issue) => issue.code)).toContain('facts_unreviewed');
    draft = setCompanion(confirmFactsReview(draft), 'fox_uri');
    const built = buildReviewedRequest(draft);
    expect(built.ok && built.request.facts.map((fact) => [fact.value, fact.source])).toEqual([['ציור', 'transcript']]);
  });

  it('ignores a late result after cancel, and a result for a superseded job', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    draft = abandonIntakeJob(draft);
    const late = merge(draft, transcriptResult('j_00000001', { facts: [{ kind: 'interest', value: 'ציור' }] }), makeId);
    expect(late).toMatchObject({ applied: false, reason: 'job_not_processing' });

    draft = startIntakeJob(draft, 'j_00000002', 'transcript');
    const stale = merge(draft, transcriptResult('j_00000001', { facts: [{ kind: 'interest', value: 'ציור' }] }), makeId);
    expect(stale).toMatchObject({ applied: false, reason: 'job_mismatch' });
    expect(activeFacts(stale.draft)).toHaveLength(0);
  });

  it('"continue with these details" abandons an unfinished job so its answer cannot land', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    draft = confirmFactsReview(draft);
    const late = merge(draft, transcriptResult('j_00000001', { facts: [{ kind: 'interest', value: 'ציור' }] }), makeId);
    expect(late.applied).toBe(false);
  });

  it('a detail removed or corrected during processing is not brought back', () => {
    const { draft: start, makeId } = basics();
    let draft = addTypedFact(start, 'interest', 'ציור', makeId).draft;
    draft = addTypedFact(draft, 'interest', 'שחייה', makeId).draft;
    draft = startIntakeJob(draft, 'j_00000001', 'transcript');
    const [painting, swimming] = activeFacts(draft);
    draft = removeFact(draft, painting.id);
    draft = editFactValue(draft, swimming.id, 'שחייה בים').draft;
    const merged = merge(
      draft,
      transcriptResult('j_00000001', {
        facts: [
          { kind: 'interest', value: 'ציור' },
          { kind: 'interest', value: 'שחייה' },
          { kind: 'interest', value: 'רכיבה על אופניים' },
        ],
      }),
      makeId,
    );
    expect(merged.applied).toBe(true);
    if (!merged.applied) return;
    expect(activeFacts(merged.draft).map((fact) => fact.value)).toEqual(['שחייה בים', 'רכיבה על אופניים']);
    expect(merged.omitted).toBe(2);
  });

  it('turns a mismatching age or name into a question instead of overwriting', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    const merged = merge(draft, transcriptResult('j_00000001', { mentionedAge: 6, mentionedName: 'ברי' }), makeId);
    draft = merged.draft;
    expect(draft.child).toMatchObject({ name: 'בר', age: 5 });
    expect(draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null])).toEqual([
      ['name', 'ברי'],
      ['age', 6],
    ]);
    const ageConflict = draft.conflicts.find((conflict) => conflict.field === 'age');
    const accepted = resolveConflict(draft, ageConflict?.id ?? '', 'accept');
    expect(accepted.child.age).toBe(6);
    // Unanswered questions keep the parent's value when the list is approved.
    const approved = confirmFactsReview(draft);
    expect(approved.child).toMatchObject({ name: 'בר', age: 5 });
    expect(approved.conflicts).toEqual([]);
  });

  it('ignores an out-of-range or equal age; a heard address never overrides the parent\'s choice', () => {
    const { draft: start, makeId } = basics();
    const draft = startIntakeJob(start, 'j_00000001', 'transcript');
    const merged = merge(draft, transcriptResult('j_00000001', { mentionedAge: 11, mentionedAddress: 'boy' }), makeId);
    expect(merged.draft.conflicts).toEqual([]);
    expect(merged.draft.child).toMatchObject({ address: 'boy', addressSource: 'typed' });
    const other = merge(startIntakeJob(start, 'j_00000002', 'transcript'), transcriptResult('j_00000002', { mentionedAddress: 'girl' }), makeId);
    expect(other.draft.child.address).toBe('boy');
    expect(other.draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null])).toEqual([
      ['address', 'girl'],
    ]);
  });

  it('keeps the adventure place separate, never resurrects a removed place, and asks on mismatch', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    draft = merge(draft, transcriptResult('j_00000001', { storyPlace: 'ליד הים' }), makeId).draft;
    expect(draft.storyPlace).toMatchObject({ value: 'ליד הים', status: 'proposed', source: 'transcript' });
    draft = commitStoryPlace(draft, '');
    expect(draft.storyPlace).toBeNull();
    draft = startIntakeJob(draft, 'j_00000002', 'transcript');
    draft = merge(draft, transcriptResult('j_00000002', { storyPlace: 'ליד הים' }), makeId).draft;
    expect(draft.storyPlace).toBeNull();

    draft = commitStoryPlace(draft, 'בגינה ליד הבית');
    draft = startIntakeJob(draft, 'j_00000003', 'transcript');
    draft = merge(draft, transcriptResult('j_00000003', { storyPlace: 'באודם' }), makeId).draft;
    expect(draft.storyPlace?.value).toBe('בגינה ליד הבית');
    expect(draft.conflicts.map((conflict) => conflict.field)).toEqual(['storyPlace']);
  });

  it('a replaced place is tombstoned too', () => {
    const { draft: start, makeId } = basics();
    let draft = commitStoryPlace(start, 'באודם');
    draft = commitStoryPlace(draft, 'בקיבוץ');
    draft = startIntakeJob(draft, 'j_00000001', 'transcript');
    draft = merge(draft, transcriptResult('j_00000001', { storyPlace: 'באודם' }), makeId).draft;
    expect(draft.storyPlace?.value).toBe('בקיבוץ');
    expect(draft.conflicts).toEqual([]);
  });

  it('offers an explicit direction as an unselected suggestion; never picks intent or companion', () => {
    const { draft: start, makeId } = basics();
    let draft = setCompanion(start, 'chameleon_koko');
    draft = startIntakeJob(draft, 'j_00000001', 'transcript');
    draft = merge(
      draft,
      transcriptResult('j_00000001', { explicitTopicId: 'transitions', facts: [{ kind: 'other', value: 'לא אוהב מסיבות' }] }),
      makeId,
    ).draft;
    expect(draft.intent).toBeNull();
    expect(draft.companionId).toBe('chameleon_koko');
    expect(draft.intentSuggestions).toEqual([{ topicId: 'transitions', jobId: 'j_00000001', source: 'transcript', reason: 'asked' }]);
    expect(dismissIntentSuggestion(draft, 'transitions').intentSuggestions).toEqual([]);

    const unknown = startIntakeJob(draft, 'j_00000002', 'transcript');
    const merged = merge(unknown, transcriptResult('j_00000002', { explicitTopicId: 'medical' }), makeId);
    expect(merged.draft.intentSuggestions).toHaveLength(1);
  });

  it('changing the companion and the direction are independent', () => {
    const { draft: start } = basics();
    let draft = setIntent(setCompanion(start, 'dragon_dini'), { kind: 'topic', topicId: 'night' });
    draft = setCompanion(draft, 'fox_uri');
    expect(draft.intent).toEqual({ kind: 'topic', topicId: 'night' });
    draft = setIntent(draft, { kind: 'just_for_fun' });
    expect(draft.companionId).toBe('fox_uri');
  });

  it('an unclear recording adds nothing and says so', () => {
    const { draft: start, makeId } = basics();
    const draft = startIntakeJob(start, 'j_00000001', 'transcript');
    const merged = merge(
      draft,
      transcriptResult('j_00000001', { understood: false, facts: [{ kind: 'interest', value: 'ניחוש' }] }),
      makeId,
    );
    expect(merged.applied && merged.understood).toBe(false);
    expect(activeFacts(merged.draft)).toHaveLength(0);
  });
});

describe('the labelled fixture goes through the same merge and stays marked', () => {
  it('mixed example: residence and family only as stated, dislike is not a diagnosis, direction is a suggestion', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'fixture');
    const result = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'mixed', address: 'boy' });
    const merged = merge(draft, result, makeId);
    expect(merged.applied).toBe(true);
    draft = merged.draft;
    expect(activeFacts(draft).map((fact) => [fact.kind, fact.source])).toEqual([
      ['family', 'fixture'],
      ['other', 'fixture'],
      ['recent_event', 'fixture'],
    ]);
    // The typed age and residence are only questioned; the heard address equals the chosen one.
    expect(draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null, conflict.source])).toEqual([
      ['age', 6, 'fixture'],
      ['residence', 'קיבוץ', 'fixture'],
    ]);
    expect(draft.intent).toBeNull();
    expect(draft.intentSuggestions.map((item) => [item.topicId, item.reason])).toEqual([['transitions', 'asked']]);

    draft = setCompanion(confirmFactsReview(ready(draft)), 'dragon_dini');
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(requestContainsFixtureData(built.request)).toBe(true);
    expect(built.request.child).toMatchObject({ age: 5, residence: 'אודם', residenceSource: 'typed' });
    expect(summarizeRequest(built.request).containsFixtureData).toBe(true);
  });

  it('simple example never invents family, residence or a difficulty; the card asks for them', () => {
    const result = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'simple', address: 'girl' });
    expect(result.source).toBe('fixture');
    expect(result.extraction.facts.map((fact) => fact.kind)).not.toContain('family');
    expect(result.extraction.facts.map((fact) => fact.kind)).not.toContain('difficulty');
    expect(result.extraction).toMatchObject({ residence: null, mentionedName: null, mentionedAge: null, mentionedAddress: 'girl' });
    expect(result.transcript).toContain('היא');
    const merged = applyIntakeResult(startIntakeJob(createDraft('d_00000000test'), 'j_00000001', 'fixture'), result, {
      allowedTopicIds: ALLOWED_TOPICS,
      makeId: sequentialIds(),
    });
    expect(requestIssues(merged.draft).map((issue) => issue.code)).toEqual([
      'child_name_missing',
      'child_age_missing',
      'child_residence_missing',
      'hard_missing',
      'facts_unreviewed',
      'companion_missing',
    ]);
  });
});

describe('summary and request round-trip', () => {
  it('summary shows exactly the request facts: no removed, no unapproved', () => {
    const { draft: start, makeId } = basics();
    let draft = addTypedFact(start, 'interest', 'ציור', makeId).draft;
    draft = addTypedFact(draft, 'interest', 'שחייה', makeId).draft;
    draft = addTypedFact(draft, 'favorite_place', 'הים', makeId).draft;
    draft = addTypedFact(draft, 'habit', 'שר באוטו', makeId).draft;
    const toRemove = activeFacts(draft)[0];
    draft = removeFact(draft, toRemove.id);
    draft = confirmFactsReview(draft);
    draft = setCompanion(draft, 'panda_anat');
    draft = addAvoid(draft, 'בלי כלבים גדולים').draft;
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const summary = summarizeRequest(built.request);
    const byId = (left: { id: string }, right: { id: string }) => left.id.localeCompare(right.id);
    const summaryFacts = summary.factGroups.flatMap((group) => group.facts);
    expect([...summaryFacts].sort(byId)).toEqual([...built.request.facts].sort(byId));
    expect(summaryFacts.map((fact) => fact.value).sort()).toEqual(['הים', 'שחייה', 'שר באוטו'].sort());
    expect(summary.factGroups.map((group) => group.group)).toEqual(['loves', 'places', 'habits']);
    expect(built.request.facts.map((fact) => fact.kind)).toEqual(['interest', 'favorite_place', 'habit']);
    expect(summary.child.residence).toBe('אודם');
    expect(summary.noDifficulty).toBe(true);
    expect(summary.avoid).toEqual(['בלי כלבים גדולים']);
  });

  it('reports missing required choices by step (1 = tell us, 2 = companion)', () => {
    const empty = buildReviewedRequest(createDraft('d_00000000test'));
    expect(!empty.ok && empty.issues.map((issue) => [issue.code, issue.step])).toEqual([
      ['child_name_missing', 1],
      ['child_age_missing', 1],
      ['child_address_missing', 1],
      ['child_residence_missing', 1],
      ['loves_missing', 1],
      ['hard_missing', 1],
      ['companion_missing', 2],
    ]);
  });

  it('the strict request schema rejects authority fields a browser might add', () => {
    const { draft: start } = basics();
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(start)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const extra of [{ approved: true }, { runtimeEligible: true }, { budgetUsd: 5 }]) {
      expect(reviewedPersonalBookRequestSchema.safeParse({ ...built.request, ...extra }).success).toBe(false);
    }
    expect(
      reviewedPersonalBookRequestSchema.safeParse({ ...built.request, child: { ...built.request.child, address: 'other' } })
        .success,
    ).toBe(false);
    expect(
      reviewedPersonalBookRequestSchema.safeParse({ ...built.request, child: { ...built.request.child, age: 9 } }).success,
    ).toBe(false);
  });

  it('the server enforces the must-haves too: residence, something loved, and "what is hard" answered once', () => {
    const { draft: start, makeId } = basics();
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(start)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const request = built.request;
    const difficulty = { id: 'f_hard0001', kind: 'difficulty' as const, value: 'מפחד מהחושך', source: 'typed' as const };
    const refusals: Array<[string, unknown, string]> = [
      ['no residence', { ...request, child: { ...request.child, residence: '' } }, 'too_small'],
      ['nothing loved', { ...request, facts: [] }, 'loves_missing'],
      ['nothing hard and no answer', { ...request, noDifficulty: false }, 'hard_missing'],
      ['"nothing special" with a difficulty', { ...request, facts: [...request.facts, difficulty] }, 'no_difficulty_with_difficulties'],
    ];
    for (const [label, candidate, code] of refusals) {
      const parsed = reviewedPersonalBookRequestSchema.safeParse(candidate);
      expect(parsed.success, label).toBe(false);
      if (!parsed.success) expect(parsed.error.issues.map((issue) => issue.code === 'custom' ? issue.message : issue.code), label).toContain(code);
    }
    // Control: a difficulty instead of "nothing special" is a valid answer.
    expect(reviewedPersonalBookRequestSchema.safeParse({ ...request, noDifficulty: false, facts: [...request.facts, difficulty] }).success).toBe(true);
    // Ceilings are per group on the wire as well.
    const tooManyLoves = Array.from({ length: LIMITS.lovesMax + 1 }, (_, index) => ({
      id: `f_love${String(index).padStart(4, '0')}`,
      kind: 'interest' as const,
      value: `אהבה ${'א'.repeat(index + 1)}`,
      source: 'typed' as const,
    }));
    expect(reviewedPersonalBookRequestSchema.safeParse({ ...request, facts: tooManyLoves }).success).toBe(false);
    void makeId;
  });
});

describe('a corrected transcript supersedes the proposals of the transcript it corrects', () => {
  const kinds = (facts: Array<{ kind: string; value: string }>) => facts.map((fact) => `${fact.kind}:${fact.value}`);
  const record = (
    draft: PersonalBookDraft,
    jobId: string,
    facts: IntakeExtraction['facts'],
    makeId: IdFactory,
    extra: Partial<IntakeExtraction> = {},
  ) => merge(startIntakeJob(draft, jobId, 'transcript'), transcriptResult(jobId, { facts, ...extra }), makeId);
  const correct = (
    draft: PersonalBookDraft,
    jobId: string,
    supersedes: string,
    facts: IntakeExtraction['facts'],
    makeId: IdFactory,
    extra: Partial<IntakeExtraction> = {},
  ) =>
    merge(
      startIntakeJob(draft, jobId, 'transcript', { supersedesJobId: supersedes }),
      transcriptResult(jobId, { facts, ...extra }),
      makeId,
    );
  const finalRequest = (draft: PersonalBookDraft) => {
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'panda_anat'));
    if (!built.ok) throw new Error(`request not built: ${built.issues.map((issue) => issue.code).join(',')}`);
    return built.request;
  };

  it("reviewer case: correcting 'גר באודם' to 'גר בחיפה' leaves only the corrected residence, and the server agrees", () => {
    const { draft: start, makeId } = basicsWithoutResidence();
    let draft = record(start, 'j_00000001', [], makeId, { residence: 'אודם' }).draft;
    expect(draft.child).toMatchObject({ residence: 'אודם', residenceSource: 'transcript', residenceJobId: 'j_00000001' });
    const corrected = correct(draft, 'j_00000002', 'j_00000001', [], makeId, { residence: 'חיפה' });
    expect(corrected.applied && corrected.retired).toBe(1);
    draft = corrected.draft;
    expect(draft.conflicts).toEqual([]);
    const request = finalRequest(draft);
    expect(request.child).toMatchObject({ residence: 'חיפה', residenceSource: 'transcript' });
    const accepted = acceptPersonalBookRequest(request, resolvePersonalWizardOptions());
    expect(accepted.ok && accepted.canonical.child.residence).toBe('חיפה');
  });

  it('control: a second RECORDING still adds to the first; only a correction supersedes', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'family', value: 'אחות קטנה' }], makeId).draft;
    draft = record(draft, 'j_00000002', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    expect(kinds(finalRequest(draft).facts)).toEqual(['family:אחות קטנה', 'interest:ציור']);
  });

  it('a detail deleted from the transcript leaves; an unchanged one keeps its identity', () => {
    const { draft: start, makeId } = basics();
    let draft = record(
      start,
      'j_00000001',
      [
        { kind: 'interest', value: 'ציור' },
        { kind: 'habit', value: 'שירה במקלחת' },
      ],
      makeId,
    ).draft;
    const paintingId = activeFacts(draft).find((fact) => fact.value === 'ציור')?.id;
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    expect(activeFacts(draft).map((fact) => [fact.id, fact.value])).toEqual([[paintingId, 'ציור']]);
    expect(kinds(finalRequest(draft).facts)).toEqual(['interest:ציור']);
  });

  it('a changed family detail replaces the old one instead of sitting next to it', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'family', value: 'אחות קטנה בשם נועה' }], makeId).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'family', value: 'אחות קטנה בשם נוגה' }], makeId).draft;
    expect(kinds(finalRequest(draft).facts)).toEqual(['family:אחות קטנה בשם נוגה', 'interest:ספרים']);
  });

  it("the parent's own edits and removals survive a correction", () => {
    const { draft: start, makeId } = basics();
    let draft = record(
      start,
      'j_00000001',
      [
        { kind: 'interest', value: 'ציור' },
        { kind: 'interest', value: 'שחייה' },
      ],
      makeId,
    ).draft;
    const [painting, swimming] = activeFacts(draft);
    draft = editFactValue(draft, painting.id, 'ציור בצבעי מים').draft;
    draft = removeFact(draft, swimming.id);
    const corrected = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'interest', value: 'שחייה' }], makeId);
    expect(corrected.applied && corrected.retired).toBe(0);
    draft = corrected.draft;
    expect(draft.conflicts).toEqual([]);
    expect(kinds(finalRequest(draft).facts)).toEqual(['interest:ציור בצבעי מים']);
  });

  it('typed and chip details, and other recordings, are untouched', () => {
    const { draft: start, makeId } = basics();
    let draft = addTypedFact(start, 'habit', 'סופר מדרגות', makeId).draft;
    draft = toggleChip(draft, { id: 'music', label: 'מוזיקה', kind: 'interest' }, makeId).draft;
    draft = record(draft, 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    draft = record(draft, 'j_00000002', [{ kind: 'interest', value: 'כדור' }], makeId).draft;
    draft = correct(draft, 'j_00000003', 'j_00000002', [{ kind: 'interest', value: 'כדורגל' }], makeId).draft;
    expect(kinds(finalRequest(draft).facts)).toEqual([
      'habit:סופר מדרגות',
      'interest:מוזיקה',
      'interest:ציור',
      'interest:כדורגל',
    ]);
  });

  it('an already approved detail missing from the correction becomes an explicit question', () => {
    const { draft: start, makeId } = basics();
    let draft = record(
      start,
      'j_00000001',
      [
        { kind: 'interest', value: 'ציור' },
        { kind: 'interest', value: 'שחייה' },
      ],
      makeId,
    ).draft;
    draft = confirmFactsReview(draft);
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'interest', value: 'שחייה' }], makeId).draft;
    const question = draft.conflicts.find((conflict) => conflict.field === 'stale_fact');
    expect(question && 'value' in question ? question.value : null).toBe('ציור');
    expect(buildReviewedRequest(setCompanion(draft, 'panda_anat'))).toMatchObject({ ok: false });
    const removed = resolveConflict(draft, question?.id ?? '', 'accept');
    expect(kinds(finalRequest(removed).facts)).toEqual(['interest:שחייה']);
    const kept = resolveConflict(draft, question?.id ?? '', 'keep');
    expect(kinds(finalRequest(kept).facts)).toEqual(['interest:ציור', 'interest:שחייה']);
    // A removal chosen here is the parent's removal: a later recording cannot bring it back.
    const later = record(removed, 'j_00000003', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    expect(kinds(finalRequest(later).facts)).toEqual(['interest:שחייה']);
  });

  it('places follow the same rules: proposed places are replaced, approved ones are asked about', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [], makeId, { storyPlace: 'ליד הים' }).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [], makeId, { storyPlace: 'באודם' }).draft;
    expect(draft.storyPlace).toMatchObject({ value: 'באודם', status: 'proposed' });
    expect(draft.conflicts).toEqual([]);

    let approved = confirmFactsReview(draft);
    approved = correct(approved, 'j_00000003', 'j_00000002', [], makeId).draft;
    const question = approved.conflicts.find((conflict) => conflict.field === 'stale_place');
    expect(question).toBeDefined();
    const removed = resolveConflict(approved, question?.id ?? '', 'accept');
    expect(finalRequest(removed).storyPlace).toBeNull();
    expect(removed.conflicts).toEqual([]);
  });

  it('questions and topic suggestions raised by the corrected transcript are dropped with it', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [], makeId, { mentionedAge: 6, explicitTopicId: 'transitions' }).draft;
    expect(draft.conflicts).toHaveLength(1);
    expect(draft.intentSuggestions).toHaveLength(1);
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    expect(draft.conflicts).toEqual([]);
    expect(draft.intentSuggestions).toEqual([]);
  });

  it('late, failed-and-retried and unclear corrections behave', () => {
    const { draft: start, makeId } = basics();
    const original = record(start, 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;

    // Cancelled correction: its late answer changes nothing.
    const cancelled = abandonIntakeJob(startIntakeJob(original, 'j_00000002', 'transcript', { supersedesJobId: 'j_00000001' }));
    const late = merge(cancelled, transcriptResult('j_00000002', { facts: [{ kind: 'interest', value: 'שחייה' }] }), makeId);
    expect(late.applied).toBe(false);
    expect(kinds(finalRequest(late.draft).facts)).toEqual(['interest:ציור']);

    // Failed correction, then a retry with a new job id that supersedes the same transcript.
    const failed = failIntakeJob(
      startIntakeJob(original, 'j_00000003', 'transcript', { supersedesJobId: 'j_00000001' }),
      'j_00000003',
    );
    const retried = correct(failed, 'j_00000004', 'j_00000001', [{ kind: 'interest', value: 'שחייה' }], makeId);
    expect(kinds(finalRequest(retried.draft).facts)).toEqual(['interest:שחייה']);
    // The failed job's answer, if it ever arrived, is not the running job's.
    const stray = merge(retried.draft, transcriptResult('j_00000003', { facts: [{ kind: 'interest', value: 'כדור' }] }), makeId);
    expect(stray.applied).toBe(false);

    // An unclear correction retires nothing.
    const unclear = correct(original, 'j_00000005', 'j_00000001', [], makeId, { understood: false });
    expect(unclear.applied && unclear.retired).toBe(0);
    expect(kinds(finalRequest(unclear.draft).facts)).toEqual(['interest:ציור']);
  });

  it('a correction of a correction: what the first correction kept, the second can still change', () => {
    const { draft: start, makeId } = basicsWithoutResidence();
    let draft = record(start, 'j_00000001', [], makeId, { residence: 'אודם' }).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'habit', value: 'שר שירים' }], makeId, { residence: 'אודם' }).draft;
    expect(draft.child.residenceJobId).toBe('j_00000002');
    const second = correct(draft, 'j_00000003', 'j_00000002', [{ kind: 'habit', value: 'שר שירים' }], makeId, { residence: 'חיפה' });
    expect(second.applied && second.retired).toBe(1);
    const request = finalRequest(second.draft);
    expect(kinds(request.facts)).toEqual(['habit:שר שירים', 'interest:ספרים']);
    expect(request.child.residence).toBe('חיפה');
    const accepted = acceptPersonalBookRequest(request, resolvePersonalWizardOptions());
    expect(accepted.ok && accepted.canonical.child.residence).toBe('חיפה');
  });

  it('an unclear correction in the middle changes nothing, and hands its details to the next one', () => {
    const { draft: start, makeId } = basicsWithoutResidence();
    let draft = record(start, 'j_00000001', [{ kind: 'habit', value: 'שר שירים' }], makeId, {
      explicitTopicId: 'night',
      mentionedAge: 6,
      residence: 'אודם',
    }).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [], makeId, { understood: false }).draft;
    // Negative control: the unclear step itself keeps every detail, question and suggestion.
    expect(activeFacts(draft).map((fact) => fact.value)).toEqual(['שר שירים']);
    expect(draft.child).toMatchObject({ residence: 'אודם', residenceJobId: 'j_00000002' });
    expect(draft.conflicts.map((conflict) => conflict.field)).toEqual(['age']);
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['night']);
    // The next correction corrects the transcript on screen, and with it everything handed on.
    draft = correct(draft, 'j_00000003', 'j_00000002', [], makeId, { residence: 'חיפה' }).draft;
    expect(draft.conflicts).toEqual([]);
    expect(draft.intentSuggestions).toEqual([]);
    expect(kinds(finalRequest(draft).facts)).toEqual(['interest:ספרים']);
    expect(draft.child.residence).toBe('חיפה');
  });

  it('an open keep-or-remove question is asked again by the next correction, and settles when the detail returns', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'favorite_place', value: 'הים' }], makeId).draft;
    draft = confirmFactsReview(draft);
    const staleValues = (current: PersonalBookDraft) =>
      current.conflicts.flatMap((conflict) => (conflict.field === 'stale_fact' ? [conflict.value] : []));
    draft = correct(draft, 'j_00000002', 'j_00000001', [], makeId).draft;
    expect(staleValues(draft)).toEqual(['הים']);
    const unanswered = correct(draft, 'j_00000003', 'j_00000002', [], makeId).draft;
    expect(staleValues(unanswered)).toEqual(['הים']);
    // Answered "keep": a later correction that still lacks it asks once more; it never removes silently.
    const keptId = draft.conflicts[0].id;
    const keptThenCorrected = correct(resolveConflict(draft, keptId, 'keep'), 'j_00000003', 'j_00000002', [], makeId).draft;
    expect(staleValues(keptThenCorrected)).toEqual(['הים']);
    expect(activeFacts(keptThenCorrected).map((fact) => fact.value)).toEqual(['הים']);
    // The detail is back in the latest correction: no question, same approved detail.
    const back = correct(
      unanswered,
      'j_00000004',
      'j_00000003',
      [{ kind: 'favorite_place', value: 'הים' }],
      makeId,
    ).draft;
    expect(back.conflicts).toEqual([]);
    expect(activeFacts(back).map((fact) => [fact.value, fact.status])).toEqual([['הים', 'included']]);
  });

  it('a place kept by one correction is corrected by the next', () => {
    const { draft: start, makeId } = basics();
    let proposed = record(start, 'j_00000001', [], makeId, { storyPlace: 'ליד הים' }).draft;
    proposed = correct(proposed, 'j_00000002', 'j_00000001', [], makeId, { storyPlace: 'ליד הים' }).draft;
    const retiredPlace = correct(proposed, 'j_00000003', 'j_00000002', [], makeId);
    expect(retiredPlace.applied && retiredPlace.retired).toBe(1);
    expect(retiredPlace.draft.storyPlace).toBeNull();

    let approved = confirmFactsReview(record(start, 'j_00000001', [], makeId, { storyPlace: 'ליד הים' }).draft);
    approved = correct(approved, 'j_00000002', 'j_00000001', [], makeId, { storyPlace: 'ליד הים' }).draft;
    approved = correct(approved, 'j_00000003', 'j_00000002', [], makeId).draft;
    expect(approved.conflicts.map((conflict) => conflict.field)).toEqual(['stale_place']);
    expect(approved.storyPlace).toMatchObject({ value: 'ליד הים', status: 'included' });
  });

  it('controls: a new recording starts its own chain, and a result without transcript text hands nothing on', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    draft = record(draft, 'j_00000003', [{ kind: 'interest', value: 'כדור' }], makeId).draft;
    draft = correct(draft, 'j_00000004', 'j_00000003', [{ kind: 'interest', value: 'כדורגל' }], makeId).draft;
    expect(kinds(finalRequest(draft).facts)).toEqual(['interest:ציור', 'interest:כדורגל']);

    // With no transcript text the corrected transcript stays on screen, so the next correction of IT
    // still reaches what was kept.
    let silent = record(
      start,
      'j_00000001',
      [
        { kind: 'interest', value: 'ציור' },
        { kind: 'interest', value: 'שחייה' },
      ],
      makeId,
    ).draft;
    silent = merge(
      startIntakeJob(silent, 'j_00000002', 'transcript', { supersedesJobId: 'j_00000001' }),
      { ...transcriptResult('j_00000002', { facts: [{ kind: 'interest', value: 'ציור' }] }), transcript: null },
      makeId,
    ).draft;
    expect(silent.transcript?.jobId).toBe('j_00000001');
    expect(kinds(finalRequest(silent).facts)).toEqual(['interest:ציור']);
    silent = correct(silent, 'j_00000003', 'j_00000001', [], makeId).draft;
    expect(kinds(finalRequest(silent).facts)).toEqual(['interest:ספרים']);
  });
});

describe('example provenance follows every surviving value, not only facts', () => {
  const fixtureOnlyCoreValues = (makeId: IdFactory, start: PersonalBookDraft) => {
    let draft = startIntakeJob(start, 'j_00000001', 'fixture');
    draft = merge(
      draft,
      {
        jobId: 'j_00000001',
        source: 'fixture',
        transcript: 'example',
        extraction: extraction({ mentionedName: 'נועה', mentionedAge: 6, explicitTopicId: 'night' }),
      },
      makeId,
    ).draft;
    for (const conflict of [...draft.conflicts]) draft = resolveConflict(draft, conflict.id, 'accept');
    return draft;
  };

  it('reviewer case: example name, age and topic with no example facts still flag the request as example data', () => {
    const { draft: start, makeId } = basics();
    let draft = fixtureOnlyCoreValues(makeId, start);
    // Chosen straight from the topic list, as the reviewer's probe does.
    draft = setIntent(draft, { kind: 'topic', topicId: 'night' });
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.facts.map((fact) => fact.source)).toEqual(['typed']);
    expect(built.request.child).toMatchObject({ name: 'נועה', age: 6, address: 'boy', nameSource: 'fixture', ageSource: 'fixture' });
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'night', suggestedBy: 'fixture' });
    expect(requestContainsFixtureData(built.request)).toBe(true);
    const accepted = acceptPersonalBookRequest(built.request, resolvePersonalWizardOptions());
    expect(accepted.ok && accepted.containsFixtureData).toBe(true);
  });

  it('adopting a topic through the list settles its suggestion; the suggestion card does the same', () => {
    const { draft: start, makeId } = basics();
    const draft = fixtureOnlyCoreValues(makeId, start);
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['night']);
    const viaList = setIntent(draft, { kind: 'topic', topicId: 'night' });
    expect(viaList.intentSuggestions).toEqual([]);
    const viaCard = setIntent(draft, { kind: 'topic', topicId: 'night', suggestedBy: 'fixture' });
    expect(viaCard.intent).toEqual({ kind: 'topic', topicId: 'night', suggestedBy: 'fixture' });
  });

  it('editing by hand is the deliberate transition back to parent input', () => {
    const { draft: start, makeId } = basics();
    let draft = fixtureOnlyCoreValues(makeId, start);
    draft = setIntent(draft, { kind: 'topic', topicId: 'night' });
    draft = setChildName(draft, 'נועה');
    draft = setChildAge(draft, 6);
    draft = setIntent(draft, { kind: 'topic', topicId: 'social' });
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.child).toMatchObject({ nameSource: 'typed', ageSource: 'typed' });
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'social' });
    expect(requestContainsFixtureData(built.request)).toBe(false);
  });

  it('values accepted from a live recording are marked as such, not as example data', () => {
    const { draft: start, makeId } = basics();
    let draft = startIntakeJob(start, 'j_00000001', 'transcript');
    draft = merge(draft, transcriptResult('j_00000001', { mentionedAge: 6, explicitTopicId: 'transitions' }), makeId).draft;
    draft = resolveConflict(draft, draft.conflicts[0].id, 'accept');
    draft = setIntent(draft, { kind: 'topic', topicId: 'transitions' });
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.child.ageSource).toBe('transcript');
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'transitions', suggestedBy: 'transcript' });
    expect(requestContainsFixtureData(built.request)).toBe(false);
  });

  it('the strict schema requires the provenance fields and their allowed values', () => {
    const { draft: start } = basics();
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(start)), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const { nameSource: _dropped, ...withoutSource } = built.request.child;
    const { addressSource: _droppedAddress, ...withoutAddressSource } = built.request.child;
    const bad = [
      { ...built.request, child: withoutSource },
      { ...built.request, child: withoutAddressSource },
      { ...built.request, child: { ...built.request.child, nameSource: 'chip' } },
      { ...built.request, child: { ...built.request.child, ageSource: 'guessed' } },
      { ...built.request, child: { ...built.request.child, addressSource: 'voice' } },
      { ...built.request, child: { ...built.request.child, residenceSource: 'model' } },
      { ...built.request, intent: { kind: 'topic', topicId: 'night', suggestedBy: 'model' } },
      { ...built.request, intent: { kind: 'just_for_fun', suggestedBy: 'fixture' } },
    ];
    for (const candidate of bad) expect(reviewedPersonalBookRequestSchema.safeParse(candidate).success).toBe(false);
  });
});

describe('voice-first entry: a recording may fill the empty name and age; "continue" approves what is shown', () => {
  const empty = () => createDraft('d_00000000test');
  const record = (draft: PersonalBookDraft, jobId: string, partial: Partial<IntakeExtraction>, makeId: IdFactory) =>
    merge(startIntakeJob(draft, jobId, 'transcript'), transcriptResult(jobId, partial), makeId);
  const correct = (
    draft: PersonalBookDraft,
    jobId: string,
    supersedes: string,
    partial: Partial<IntakeExtraction>,
    makeId: IdFactory,
  ) => merge(startIntakeJob(draft, jobId, 'transcript', { supersedesJobId: supersedes }), transcriptResult(jobId, partial), makeId);
  const codes = (draft: PersonalBookDraft) => requestIssues(draft).map((issue) => issue.code);

  it('fills the empty basics as suggestions; what was not heard is asked, never guessed', () => {
    const makeId = sequentialIds();
    const merged = record(
      empty(),
      'j_00000001',
      { mentionedName: 'בר', mentionedAge: 5, facts: [{ kind: 'interest', value: 'כדורגל' }] },
      makeId,
    );
    expect(merged.applied && merged.added).toBe(3);
    let draft = merged.draft;
    expect(draft.child).toEqual({
      name: 'בר',
      age: 5,
      address: null,
      residence: '',
      nameSource: 'transcript',
      ageSource: 'transcript',
      addressSource: 'typed',
      residenceSource: 'typed',
      nameJobId: 'j_00000001',
      ageJobId: 'j_00000001',
      addressJobId: null,
      residenceJobId: null,
    });
    expect(draft.conflicts).toEqual([]);
    // Heard but not yet approved; the address, residence and what is hard were not said, so they are asked.
    expect(codes(draft)).toEqual([
      'child_address_missing',
      'child_residence_missing',
      'hard_missing',
      'facts_unreviewed',
      'companion_missing',
    ]);
    draft = setCompanion(setNoDifficulty(setChildResidence(setChildAddress(confirmFactsReview(draft), 'boy'), 'אודם'), true), 'fox_uri');
    expect(draft.child).toMatchObject({ nameJobId: null, ageJobId: null });
    const built = buildReviewedRequest(draft);
    expect(built.ok && built.request.child).toEqual({
      name: 'בר',
      age: 5,
      address: 'boy',
      residence: 'אודם',
      nameSource: 'transcript',
      ageSource: 'transcript',
      addressSource: 'typed',
      residenceSource: 'typed',
    });
  });

  it('the address and the residence are heard like the name: filled when empty, then approved with the list', () => {
    const makeId = sequentialIds();
    let draft = record(empty(), 'j_00000001', { mentionedAddress: 'girl', residence: 'חיפה' }, makeId).draft;
    expect(draft.child).toMatchObject({
      address: 'girl',
      addressSource: 'transcript',
      addressJobId: 'j_00000001',
      residence: 'חיפה',
      residenceSource: 'transcript',
      residenceJobId: 'j_00000001',
    });
    // Mixed or absent forms are not guessed: nothing heard, nothing filled.
    expect(record(empty(), 'j_00000002', { mentionedAddress: null }, makeId).draft.child.address).toBeNull();
    // Another recording never overwrites; it asks.
    draft = record(draft, 'j_00000003', { mentionedAddress: 'boy', residence: 'אודם' }, makeId).draft;
    expect(draft.child).toMatchObject({ address: 'girl', residence: 'חיפה' });
    expect(draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null])).toEqual([
      ['address', 'boy'],
      ['residence', 'אודם'],
    ]);
    const accepted = resolveConflict(draft, draft.conflicts[0].id, 'accept');
    expect(accepted.child).toMatchObject({ address: 'boy', addressSource: 'transcript', addressJobId: null });
    // A correction replaces or retires its own unapproved address and residence.
    const heard = record(empty(), 'j_00000004', { mentionedAddress: 'girl', residence: 'חיפה' }, makeId).draft;
    const retired = correct(heard, 'j_00000005', 'j_00000004', {}, makeId);
    expect(retired.applied && retired.retired).toBe(2);
    expect(retired.draft.child).toMatchObject({ address: null, residence: '', addressJobId: null, residenceJobId: null });
    const replaced = correct(heard, 'j_00000006', 'j_00000004', { mentionedAddress: 'boy', residence: 'אודם' }, makeId).draft;
    expect(replaced.child).toMatchObject({ address: 'boy', residence: 'אודם', addressJobId: 'j_00000006', residenceJobId: 'j_00000006' });
    // "Continue" approves them with the list.
    expect(confirmFactsReview(replaced).child).toMatchObject({ addressJobId: null, residenceJobId: null, addressSource: 'transcript' });
  });

  it('never overwrites a filled name or age: another recording, or a typed value, only asks', () => {
    const makeId = sequentialIds();
    let draft = record(empty(), 'j_00000001', { mentionedName: 'בר', mentionedAge: 5 }, makeId).draft;
    draft = record(draft, 'j_00000002', { mentionedName: 'באר', mentionedAge: 6 }, makeId).draft;
    expect(draft.child).toMatchObject({ name: 'בר', age: 5, nameJobId: 'j_00000001', ageJobId: 'j_00000001' });
    expect(draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null])).toEqual([
      ['name', 'באר'],
      ['age', 6],
    ]);
    // Control: the same values heard again change nothing and ask nothing.
    const again = record(setChildName(empty(), 'בר'), 'j_00000003', { mentionedName: 'בר' }, makeId).draft;
    expect(again.conflicts).toEqual([]);
    expect(again.child).toMatchObject({ name: 'בר', nameSource: 'typed', nameJobId: null });
    // Out-of-range or invalid values are not suggested at all.
    const ignored = record(empty(), 'j_00000004', { mentionedName: 'בר2', mentionedAge: 11 }, makeId).draft;
    expect(ignored.child).toMatchObject({ name: '', age: null, nameJobId: null, ageJobId: null });
  });

  it('a correction replaces or retires its own unapproved name and age, and the chain continues', () => {
    const makeId = sequentialIds();
    const heard = record(empty(), 'j_00000001', { mentionedName: 'בר', mentionedAge: 5 }, makeId).draft;

    const replaced = correct(heard, 'j_00000002', 'j_00000001', { mentionedName: 'באר', mentionedAge: 6 }, makeId);
    expect(replaced.applied && [replaced.added, replaced.retired]).toEqual([2, 2]);
    expect(replaced.draft.child).toMatchObject({ name: 'באר', age: 6, nameJobId: 'j_00000002', ageJobId: 'j_00000002' });
    expect(replaced.draft.conflicts).toEqual([]);

    const retired = correct(heard, 'j_00000003', 'j_00000001', {}, makeId);
    expect(retired.applied && retired.retired).toBe(2);
    expect(retired.draft.child).toMatchObject({ name: '', age: null, nameSource: 'typed', ageSource: 'typed', nameJobId: null, ageJobId: null });
    expect(codes(retired.draft)).toContain('child_name_missing');
    expect(codes(retired.draft)).toContain('child_age_missing');

    const kept = correct(heard, 'j_00000004', 'j_00000001', { mentionedName: 'בר', mentionedAge: 5 }, makeId).draft;
    expect(kept.child).toMatchObject({ name: 'בר', age: 5, nameJobId: 'j_00000004', ageJobId: 'j_00000004' });
    const chained = correct(kept, 'j_00000005', 'j_00000004', {}, makeId).draft;
    expect(chained.child).toMatchObject({ name: '', age: null });
  });

  it('an approved or hand-edited value is only ever questioned by a correction', () => {
    const makeId = sequentialIds();
    const heard = record(empty(), 'j_00000001', { mentionedName: 'בר', mentionedAge: 5 }, makeId).draft;

    const approved = confirmFactsReview(heard);
    const changed = correct(approved, 'j_00000002', 'j_00000001', { mentionedName: 'באר' }, makeId).draft;
    expect(changed.child).toMatchObject({ name: 'בר', nameSource: 'transcript' });
    expect(changed.conflicts.map((conflict) => conflict.field)).toEqual(['name']);
    const silent = correct(approved, 'j_00000003', 'j_00000001', {}, makeId).draft;
    expect(silent.child).toMatchObject({ name: 'בר', age: 5 });
    expect(silent.conflicts).toEqual([]);

    const edited = setChildName(heard, 'באר');
    expect(edited.child).toMatchObject({ nameSource: 'typed', nameJobId: null });
    const afterEdit = correct(edited, 'j_00000004', 'j_00000001', { mentionedName: 'בר' }, makeId).draft;
    expect(afterEdit.child.name).toBe('באר');
    expect(afterEdit.conflicts.map((conflict) => conflict.field)).toEqual(['name']);
  });

  it('an unclear correction keeps the suggestions and hands them to the next correction', () => {
    const makeId = sequentialIds();
    let draft = record(empty(), 'j_00000001', { mentionedName: 'בר', mentionedAge: 5 }, makeId).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', { understood: false }, makeId).draft;
    expect(draft.child).toMatchObject({ name: 'בר', age: 5, nameJobId: 'j_00000002', ageJobId: 'j_00000002' });
    draft = correct(draft, 'j_00000003', 'j_00000002', { mentionedName: 'באר', mentionedAge: 5 }, makeId).draft;
    expect(draft.child).toMatchObject({ name: 'באר', age: 5, nameJobId: 'j_00000003', ageJobId: 'j_00000003' });
  });

  it('a direction the parent asked for is approved with the shown list; the companion never is', () => {
    const { draft: start, makeId } = basics();
    const heard = record(start, 'j_00000001', { explicitTopicId: 'transitions' }, makeId).draft;
    // Negative control: before "continue" nothing is chosen.
    expect(heard.intent).toBeNull();
    const approved = confirmFactsReview(heard);
    expect(approved.intent).toEqual({ kind: 'topic', topicId: 'transitions', suggestedBy: 'transcript' });
    expect(approved.intentSuggestions).toEqual([]);
    expect(approved.companionId).toBeNull();

    // Removed from the list first: nothing is chosen.
    expect(confirmFactsReview(dismissIntentSuggestion(heard, 'transitions')).intent).toBeNull();
    // The parent's own earlier choice is kept; the suggestion waits for the next step.
    const own = confirmFactsReview(setIntent(heard, { kind: 'just_for_fun' }));
    expect(own.intent).toEqual({ kind: 'just_for_fun' });
    expect(own.intentSuggestions.map((item) => item.topicId)).toEqual(['transitions']);
    // Two suggestions: the parent picks, not the list.
    const two = confirmFactsReview(record(heard, 'j_00000002', { explicitTopicId: 'night' }, makeId).draft);
    expect(two.intent).toBeNull();
    expect(two.intentSuggestions.map((item) => item.topicId)).toEqual(['transitions', 'night']);
  });

  it("the complete example: the five must-haves exactly as said, labelled; nothing invented", () => {
    const makeId = sequentialIds();
    const context = { allowedTopicIds: new Set(['sirens', 'night']), makeId };
    const example = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'voice', address: 'boy' });
    const merged = applyIntakeResult(startIntakeJob(empty(), 'j_00000001', 'fixture'), example, context);
    expect(merged.applied).toBe(true);
    let draft = merged.draft;
    expect(draft.child).toMatchObject({
      name: 'בר',
      age: 5,
      address: 'boy',
      residence: 'אודם',
      nameSource: 'fixture',
      ageSource: 'fixture',
      addressSource: 'fixture',
      residenceSource: 'fixture',
    });
    expect(activeFacts(draft).map((fact) => [fact.kind, fact.value, fact.source])).toEqual([
      ['interest', 'כדורגל', 'fixture'],
      ['interest', 'לקפוץ על הטרמפולינה', 'fixture'],
      ['difficulty', 'רעשים חזקים, כמו אזעקות', 'fixture'],
      ['habit', 'לוחש לכדור לפני בעיטה', 'fixture'],
    ]);
    expect(draft.storyPlace).toBeNull();
    // What is hard suggests the direction; nothing else is asked for.
    expect(draft.intentSuggestions.map((item) => [item.topicId, item.reason])).toEqual([['sirens', 'hard']]);
    expect(JSON.stringify(draft)).not.toMatch(/משפחה/);
    expect(codes(draft)).toEqual(['facts_unreviewed', 'companion_missing']);

    draft = setCompanion(confirmFactsReview(draft), 'panda_anat');
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'fixture', basis: 'difficulty' });
    expect(built.request.storyPlace).toBeNull();
    expect(requestContainsFixtureData(built.request)).toBe(true);
    const accepted = acceptPersonalBookRequest(built.request, resolvePersonalWizardOptions());
    expect(accepted.ok && accepted.containsFixtureData).toBe(true);
  });

  it('normalizing the name for the request keeps where it came from', () => {
    const typed = commitChildName(setChildName(empty(), '  בר '));
    expect(typed.child).toMatchObject({ name: 'בר', nameSource: 'typed' });
    const place = commitChildResidence(setChildResidence(empty(), '  קיבוץ   עין גדי '));
    expect(place.child).toMatchObject({ residence: 'קיבוץ עין גדי', residenceSource: 'typed' });
    const heard = { ...empty(), child: { ...empty().child, name: 'בר ', nameSource: 'transcript' as const } };
    expect(commitChildName(heard).child).toMatchObject({ name: 'בר', nameSource: 'transcript' });
    expect(commitChildName(typed)).toBe(typed);
  });
});

describe('a removed direction stays removed; only a deliberate choice brings it back', () => {
  const TOPICS = new Set(['sirens', 'night', 'transitions']);
  const hear = (
    draft: PersonalBookDraft,
    jobId: string,
    topic: string | null,
    makeId: IdFactory,
    options: { supersedes?: string; source?: 'transcript' | 'fixture'; extra?: Partial<IntakeExtraction> } = {},
  ) => {
    const source = options.source ?? 'transcript';
    const started = startIntakeJob(draft, jobId, source, options.supersedes ? { supersedesJobId: options.supersedes } : {});
    return applyIntakeResult(
      started,
      { jobId, source, transcript: 'synthetic', extraction: extraction({ explicitTopicId: topic, ...options.extra }) },
      { allowedTopicIds: TOPICS, makeId },
    ).draft;
  };
  /** Continue, then the real request boundary: the built request and the server's acceptance. */
  const submit = (draft: PersonalBookDraft) => {
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'fox_uri'));
    if (!built.ok) throw new Error(`request not built: ${built.issues.map((issue) => issue.code).join(',')}`);
    const accepted = acceptPersonalBookRequest(built.request, resolvePersonalWizardOptions());
    if (!accepted.ok) throw new Error('server refused the request');
    return { intent: built.request.intent, serverIntent: accepted.canonical.intent, fixture: accepted.containsFixtureData };
  };

  it('reviewer case: removed, then an unrelated correction of the same transcript, then continue: still absent', () => {
    const { draft: start, makeId } = basics();
    const heard = hear(start, 'j_00000001', 'sirens', makeId, { extra: { facts: [{ kind: 'interest', value: 'ציור' }] } });
    const removed = dismissIntentSuggestion(heard, 'sirens');
    const corrected = hear(removed, 'j_00000002', 'sirens', makeId, {
      supersedes: 'j_00000001',
      extra: { facts: [{ kind: 'interest', value: 'ציור בגיר' }] },
    });
    expect(corrected.intentSuggestions).toEqual([]);
    expect(submit(corrected)).toEqual({ intent: null, serverIntent: null, fixture: false });
    // Control: without the removal the same sequence approves the direction the parent asked for.
    const kept = hear(heard, 'j_00000003', 'sirens', makeId, { supersedes: 'j_00000001' });
    expect(submit(kept).intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });
  });

  it('an approved direction from a recording, removed or replaced later, does not come back', () => {
    const { draft: start, makeId } = basics();
    const approved = confirmFactsReview(hear(start, 'j_00000001', 'sirens', makeId));
    expect(approved.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });

    // Removed in the card, then the transcript is corrected and still says it.
    const removed = hear(setIntent(approved, null), 'j_00000002', 'sirens', makeId, { supersedes: 'j_00000001' });
    expect(removed.intentSuggestions).toEqual([]);
    expect(submit(removed).intent).toBeNull();

    // Replaced by the parent's own choice on step 2.
    const replaced = hear(setIntent(approved, { kind: 'just_for_fun' }), 'j_00000003', 'sirens', makeId, { supersedes: 'j_00000001' });
    expect(replaced.intentSuggestions).toEqual([]);
    expect(submit(replaced).intent).toEqual({ kind: 'just_for_fun' });

    // Replaced through the card's question by a newer proposal: the old one is not re-offered later.
    const offered = hear(approved, 'j_00000004', 'night', makeId, { supersedes: 'j_00000001' });
    const switched = setIntent(offered, { kind: 'topic', topicId: 'night' });
    expect(switched.intent).toEqual({ kind: 'topic', topicId: 'night', suggestedBy: 'transcript' });
    const later = hear(switched, 'j_00000005', 'sirens', makeId, { supersedes: 'j_00000004' });
    expect(later.intentSuggestions).toEqual([]);
    expect(submit(later).serverIntent).toEqual({ kind: 'topic', topicId: 'night', suggestedBy: 'transcript' });
  });

  it("a deliberate pick restores a removed topic as the parent's own choice; choosing a suggestion keeps its origin", () => {
    const { draft: start, makeId } = basics();
    const removed = dismissIntentSuggestion(hear(start, 'j_00000001', 'sirens', makeId), 'sirens');
    const picked = setIntent(removed, { kind: 'topic', topicId: 'sirens' });
    expect(picked.intent).toEqual({ kind: 'topic', topicId: 'sirens' });
    expect(picked.topicTombstones).toEqual([]);
    // A later correction that says it again neither duplicates nor relabels the parent's pick.
    const again = hear(picked, 'j_00000002', 'sirens', makeId, { supersedes: 'j_00000001' });
    expect(again.intentSuggestions).toEqual([]);
    expect(submit(again)).toEqual({ intent: { kind: 'topic', topicId: 'sirens' }, serverIntent: { kind: 'topic', topicId: 'sirens' }, fixture: false });

    // Choosing the pending suggestion (card or list) is not a removal: origin kept, nothing remembered.
    const chosen = setIntent(hear(start, 'j_00000003', 'sirens', makeId), { kind: 'topic', topicId: 'sirens' });
    expect(chosen.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });
    expect(chosen.topicTombstones).toEqual([]);
    // Choosing it again changes nothing and never drops its origin.
    expect(setIntent(chosen, { kind: 'topic', topicId: 'sirens' })).toBe(chosen);

    // Example origin: removed, then picked by the parent, it is the parent's choice, not example data.
    const exampleRemoved = dismissIntentSuggestion(hear(start, 'j_00000004', 'night', makeId, { source: 'fixture' }), 'night');
    expect(submit(setIntent(exampleRemoved, { kind: 'topic', topicId: 'night' }))).toEqual({
      intent: { kind: 'topic', topicId: 'night' },
      serverIntent: { kind: 'topic', topicId: 'night' },
      fixture: false,
    });
  });

  it("a manual choice is never overwritten by extraction; declining the other proposal is remembered", () => {
    const { draft: start, makeId } = basics();
    const manual = setIntent(start, { kind: 'topic', topicId: 'night' });
    const heard = hear(manual, 'j_00000001', 'sirens', makeId);
    expect(heard.intent).toEqual({ kind: 'topic', topicId: 'night' });
    expect(heard.intentSuggestions.map((item) => item.topicId)).toEqual(['sirens']);
    expect(submit(heard).serverIntent).toEqual({ kind: 'topic', topicId: 'night' });

    // The same topic heard again adds nothing and does not relabel the manual choice.
    const same = hear(manual, 'j_00000002', 'night', makeId);
    expect(same.intentSuggestions).toEqual([]);
    expect(same.intent).toEqual({ kind: 'topic', topicId: 'night' });

    const fun = hear(setIntent(start, { kind: 'just_for_fun' }), 'j_00000003', 'sirens', makeId);
    expect(submit(fun).intent).toEqual({ kind: 'just_for_fun' });

    // "Keep the current one" declines the proposal; a correction does not raise it again.
    const declined = dismissIntentSuggestion(heard, 'sirens');
    const corrected = hear(declined, 'j_00000004', 'sirens', makeId, { supersedes: 'j_00000001' });
    expect(corrected.intentSuggestions).toEqual([]);
    expect(corrected.intent).toEqual({ kind: 'topic', topicId: 'night' });
  });

  it('correction chains and example-only provenance keep working', () => {
    const { draft: start, makeId } = basics();
    // Removed after the first transcript; an unclear correction, then a clear one that says it again.
    let chain = dismissIntentSuggestion(hear(start, 'j_00000001', 'sirens', makeId), 'sirens');
    chain = hear(chain, 'j_00000002', null, makeId, { supersedes: 'j_00000001', extra: { understood: false } });
    chain = hear(chain, 'j_00000003', 'sirens', makeId, { supersedes: 'j_00000002' });
    expect(chain.intentSuggestions).toEqual([]);
    expect(submit(chain).intent).toBeNull();

    // Example-only direction: approved with the list, still flagged as example data end to end.
    const example = hear(start, 'j_00000004', 'night', makeId, { source: 'fixture' });
    expect(submit(example)).toEqual({
      intent: { kind: 'topic', topicId: 'night', suggestedBy: 'fixture' },
      serverIntent: { kind: 'topic', topicId: 'night', suggestedBy: 'fixture' },
      fixture: true,
    });
    // Declined example direction: another example run does not bring it back either.
    const declined = dismissIntentSuggestion(example, 'night');
    expect(hear(declined, 'j_00000005', 'night', makeId, { source: 'fixture' }).intentSuggestions).toEqual([]);
  });
});

describe('voice-first v2: what is hard, the direction it suggests, and "nothing special"', () => {
  const hearHard = (
    draft: PersonalBookDraft,
    jobId: string,
    makeId: IdFactory,
    partial: Partial<IntakeExtraction> = {},
  ) =>
    merge(
      startIntakeJob(draft, jobId, 'transcript'),
      transcriptResult(jobId, { facts: [{ kind: 'difficulty', value: 'מפחד מהחושך' }], hardTopicId: 'night', ...partial }),
      makeId,
    ).draft;
  const hardChip = { id: 'hard_night', label: 'פחדים בלילה', topicId: 'night' };

  it('a heard difficulty suggests its topic; "continue" adopts it with its origin; an explicit request wins', () => {
    const { draft: start, makeId } = basics();
    const heard = hearHard(start, 'j_00000001', makeId);
    // "Nothing special" no longer holds once a difficulty is heard.
    expect(heard.noDifficulty).toBe(false);
    const heardFact = activeFacts(heard).find((fact) => fact.kind === 'difficulty');
    expect(heard.intentSuggestions).toEqual([
      {
        topicId: 'night',
        jobId: 'j_00000001',
        source: 'transcript',
        reason: 'hard',
        evidence: [{ factId: heardFact?.id, key: comparableText('מפחד מהחושך') }],
      },
    ]);
    // Negative control: nothing is chosen before "continue".
    expect(heard.intent).toBeNull();
    const approved = confirmFactsReview(heard);
    expect(approved.intent).toEqual({ kind: 'topic', topicId: 'night', suggestedBy: 'transcript' });
    const built = buildReviewedRequest(setCompanion(ready(approved), 'fox_uri'));
    expect(built.ok && [built.request.noDifficulty, built.request.facts.map((fact) => fact.kind)]).toEqual([
      false,
      ['difficulty', 'interest'],
    ]);

    const asked = hearHard(start, 'j_00000002', makeId, { explicitTopicId: 'transitions' });
    expect(asked.intentSuggestions.map((item) => [item.topicId, item.reason])).toEqual([['transitions', 'asked']]);
  });

  it('a removed direction from what is hard stays removed; removing the last difficulty withdraws a pending one', () => {
    const { draft: start, makeId } = basics();
    const dismissed = dismissIntentSuggestion(hearHard(start, 'j_00000001', makeId), 'night');
    expect(hearHard(dismissed, 'j_00000002', makeId, { facts: [{ kind: 'difficulty', value: 'חושך' }] }).intentSuggestions).toEqual([]);

    const heard = hearHard(start, 'j_00000003', makeId);
    const difficulty = activeFacts(heard).find((fact) => fact.kind === 'difficulty');
    const withdrawn = removeFact(heard, difficulty?.id ?? '');
    expect(withdrawn.intentSuggestions).toEqual([]);
    // Withdrawn is not declined: said again later, it is suggested again.
    expect(withdrawn.topicTombstones).toEqual([]);
    expect(hearHard(withdrawn, 'j_00000004', makeId, { facts: [{ kind: 'difficulty', value: 'חושך בלילה' }] }).intentSuggestions).toHaveLength(1);
    // Codex P1-1 case 2: the topic was matched to BOTH difficulties it came with, so removing either
    // withdraws it, even with the other still listed.
    const two = hearHard(start, 'j_00000005', makeId, {
      facts: [
        { kind: 'difficulty', value: 'מפחד מהחושך' },
        { kind: 'difficulty', value: 'רעשים חזקים' },
      ],
    });
    const first = activeFacts(two).find((fact) => fact.value === 'מפחד מהחושך');
    expect(removeFact(two, first?.id ?? '').intentSuggestions).toEqual([]);
    // Control: removing a difficulty the suggestion does not stand on leaves it alone.
    const typed = addTypedFact(start, 'difficulty', 'קשה לו להיפרד בבוקר', makeId).draft;
    const withUnrelated = hearHard(typed, 'j_00000006', makeId);
    const unrelated = activeFacts(withUnrelated).find((fact) => fact.value === 'קשה לו להיפרד בבוקר');
    expect(removeFact(withUnrelated, unrelated?.id ?? '').intentSuggestions.map((item) => item.topicId)).toEqual(['night']);
  });

  it('a "what is hard" chip proposes its topic; unpicking withdraws it; adopted, it is the parent\'s own choice', () => {
    const { draft: start, makeId } = basics();
    const picked = toggleHardChip(start, hardChip, makeId);
    expect(picked.outcome).toBe('added');
    expect(activeFacts(picked.draft).map((fact) => [fact.kind, fact.value, fact.source])).toEqual([['difficulty', 'פחדים בלילה', 'chip']]);
    expect(picked.draft.noDifficulty).toBe(false);
    const chipFact = activeFacts(picked.draft)[0];
    expect(picked.draft.intentSuggestions).toEqual([
      { topicId: 'night', jobId: null, source: 'chip', reason: 'hard', evidence: [{ factId: chipFact.id, key: comparableText('פחדים בלילה') }] },
    ]);

    const unpicked = toggleHardChip(picked.draft, hardChip, makeId);
    expect(unpicked.outcome).toBe('removed');
    expect(unpicked.draft.intentSuggestions).toEqual([]);

    const approved = confirmFactsReview(picked.draft);
    expect(approved.intent).toEqual({ kind: 'topic', topicId: 'night' });
    const built = buildReviewedRequest(setCompanion(ready(approved), 'fox_uri'));
    expect(built.ok && built.request.intent).toEqual({ kind: 'topic', topicId: 'night', basis: 'difficulty' });
    expect(built.ok && requestContainsFixtureData(built.request)).toBe(false);

    // No proposal over a chosen direction, a pending one, or a removed topic.
    expect(toggleHardChip(setIntent(start, { kind: 'just_for_fun' }), hardChip, makeId).draft.intentSuggestions).toEqual([]);
    expect(toggleHardChip(hearHard(start, 'j_00000001', makeId, { hardTopicId: 'social' }), hardChip, makeId).draft.intentSuggestions.map((item) => item.topicId)).toEqual(['social']);
    const removedTopic = dismissIntentSuggestion(picked.draft, 'night');
    const again = toggleHardChip(toggleHardChip(removedTopic, hardChip, makeId).draft, hardChip, makeId);
    expect(again.draft.intentSuggestions).toEqual([]);
  });

  it('"nothing special" answers the must-have only while no difficulty is listed', () => {
    const { draft: start, makeId } = basics();
    const open = setNoDifficulty(start, false);
    expect(requestIssues(ready(open)).map((issue) => issue.code)).toContain('hard_missing');
    const withDifficulty = addTypedFact(open, 'difficulty', 'קשה לו להיפרד בבוקר', makeId).draft;
    expect(setNoDifficulty(withDifficulty, true)).toBe(withDifficulty);
    expect(requestIssues(ready(withDifficulty)).map((issue) => issue.code)).not.toContain('hard_missing');
    // A difficulty added after "nothing special" replaces that answer.
    expect(addTypedFact(start, 'difficulty', 'רעשים', makeId).draft.noDifficulty).toBe(false);
    expect(toggleChip(start, { id: 'hard_sirens', label: 'רעשים ואזעקות', kind: 'difficulty' }, makeId).draft.noDifficulty).toBe(false);
  });

  it('live trial F1 in the merge: a full bonus group never keeps out a love or what is hard', () => {
    const { draft: start, makeId } = basics();
    let draft = start;
    for (let index = 0; index < LIMITS.bonusMax; index += 1) {
      draft = addTypedFact(draft, 'other', `תכונה ${'א'.repeat(index + 1)}`, makeId).draft;
    }
    const merged = merge(
      startIntakeJob(draft, 'j_00000001', 'transcript'),
      transcriptResult('j_00000001', {
        facts: [
          { kind: 'interest', value: 'כדורגל' },
          { kind: 'difficulty', value: 'רעשים חזקים' },
          { kind: 'difficulty', value: 'מפלצות' },
          { kind: 'family', value: 'אחות בשם יובל' },
        ],
      }),
      makeId,
    );
    expect(merged.applied && [merged.added, merged.omitted]).toEqual([3, 1]);
    expect(activeFacts(merged.draft).filter((fact) => fact.source === 'transcript').map((fact) => fact.value)).toEqual([
      'כדורגל',
      'רעשים חזקים',
      'מפלצות',
    ]);
  });
});

// ── Codex QA of v2 (HOLD 2026-09-29) and the owner addendum ─────────────────────────────────────

const V2_TOPICS = new Set(['sirens', 'night', 'transitions', 'social']);

/** A request that went all the way: the reviewed request AND the server's acceptance of it. */
function submitBoth(draft: PersonalBookDraft) {
  const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'dragon_dini'));
  if (!built.ok) throw new Error(`request not built: ${built.issues.map((issue) => issue.code).join(',')}`);
  const accepted = acceptPersonalBookRequest(built.request, resolvePersonalWizardOptions());
  if (!accepted.ok) throw new Error(`server refused: ${JSON.stringify(accepted.issues)}`);
  return { request: built.request, canonical: accepted.canonical };
}

describe('Codex QA of v2, P1-1: a derived direction stands on its exact difficulties', () => {
  const fear = { kind: 'difficulty' as const, value: 'רעשים חזקים' };
  const dark = { kind: 'difficulty' as const, value: 'חושך' };
  /** A hearing; like the probe, it corrects the transcript on screen when there is one. */
  const hear = (
    draft: PersonalBookDraft,
    jobId: string,
    makeId: IdFactory,
    facts: IntakeExtraction['facts'],
    partial: Partial<IntakeExtraction> = { hardTopicId: 'sirens' },
    source: 'transcript' | 'fixture' = 'transcript',
  ) => {
    const started = startIntakeJob(draft, jobId, source, draft.transcript ? { supersedesJobId: draft.transcript.jobId } : {});
    const merged = applyIntakeResult(
      started,
      { jobId, source, transcript: 'synthetic', extraction: extraction({ facts, ...partial }) },
      { allowedTopicIds: V2_TOPICS, makeId },
    );
    if (!merged.applied) throw new Error(`not applied: ${merged.reason}`);
    return merged.draft;
  };
  const difficultyId = (draft: PersonalBookDraft, value: string) =>
    activeFacts(draft).find((fact) => fact.kind === 'difficulty' && fact.value === value)?.id ?? '';

  it('case 1: removed, then "nothing special", then a correction repeats it: no direction comes back', () => {
    for (const source of ['transcript', 'fixture'] as const) {
      const { draft: start, makeId } = basics();
      let draft = hear(setNoDifficulty(start, false), 'j_00000001', makeId, [fear], { hardTopicId: 'sirens' }, source);
      expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['sirens']);
      draft = removeFact(draft, difficultyId(draft, fear.value), makeId);
      expect(draft.intentSuggestions).toEqual([]);
      draft = setNoDifficulty(draft, true);
      draft = hear(draft, 'j_00000002', makeId, [fear], { hardTopicId: 'sirens' }, source);
      // The fact stays excluded, and the topic that stood on it is not proposed again.
      expect(activeFacts(draft).filter((fact) => fact.kind === 'difficulty')).toEqual([]);
      expect(draft.intentSuggestions).toEqual([]);
      const { request, canonical } = submitBoth(draft);
      expect([request.intent, request.noDifficulty, canonical.intent]).toEqual([null, true, null]);
    }
  });

  it('case 2: removing one of the difficulties it was matched to withdraws it', () => {
    const { draft: start, makeId } = basics();
    let draft = hear(start, 'j_00000001', makeId, [fear, dark]);
    draft = removeFact(draft, difficultyId(draft, fear.value), makeId);
    expect(draft.intentSuggestions).toEqual([]);
    const { request, canonical } = submitBoth(draft);
    expect(request.facts.filter((fact) => fact.kind === 'difficulty').map((fact) => fact.value)).toEqual(['חושך']);
    expect([request.intent, canonical.intent]).toEqual([null, null]);
  });

  it('case 3: editing the difficulty withdraws the pending direction; nothing guesses a replacement', () => {
    const { draft: start, makeId } = basics();
    let draft = hear(start, 'j_00000001', makeId, [fear]);
    draft = editFactValue(draft, difficultyId(draft, fear.value), 'חושך', makeId).draft;
    expect(draft.intentSuggestions).toEqual([]);
    const { request, canonical } = submitBoth(draft);
    expect(request.facts.filter((fact) => fact.kind === 'difficulty').map((fact) => [fact.value, fact.source])).toEqual([['חושך', 'typed']]);
    expect([request.intent, canonical.intent]).toEqual([null, null]);
  });

  it('case 4: the complete example, its difficulty edited in the card, then continue: no stale direction', () => {
    const makeId = sequentialIds();
    const example = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'voice', address: 'boy' });
    let draft = applyIntakeResult(startIntakeJob(createDraft('d_00000000test'), 'j_00000001', 'fixture'), example, {
      allowedTopicIds: V2_TOPICS,
      makeId,
    }).draft;
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['sirens']);
    draft = editFactValue(draft, difficultyId(draft, 'רעשים חזקים, כמו אזעקות'), 'חושך', makeId).draft;
    const { request, canonical } = submitBoth(draft);
    expect(request.facts.filter((fact) => fact.kind === 'difficulty').map((fact) => fact.value)).toEqual(['חושך']);
    expect([request.intent, canonical.intent]).toEqual([null, null]);
  });

  it('controls: a dismissed direction stays out; a requested topic needs no difficulty; a deliberate pick restores', () => {
    const { draft: start, makeId } = basics();
    // Dismissed, the difficulty removed, "nothing special", then said again: still out.
    let dismissed = dismissIntentSuggestion(hear(start, 'j_00000001', makeId, [fear]), 'sirens');
    dismissed = setNoDifficulty(removeFact(dismissed, difficultyId(dismissed, fear.value), makeId), true);
    expect(submitBoth(hear(dismissed, 'j_00000002', makeId, [fear])).canonical.intent).toBeNull();
    // A topic the parent asked for stands without any difficulty, and is not marked as derived.
    const asked = hear(start, 'j_00000003', makeId, [], { explicitTopicId: 'sirens', hardTopicId: null });
    expect(submitBoth(asked).canonical.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });
    // Withdrawn by an edit, then deliberately picked: the parent's own choice, not a derived one.
    let edited = hear(start, 'j_00000004', makeId, [fear]);
    edited = editFactValue(edited, difficultyId(edited, fear.value), 'חושך', makeId).draft;
    const picked = setIntent(edited, { kind: 'topic', topicId: 'sirens' });
    expect(submitBoth(picked).canonical.intent).toEqual({ kind: 'topic', topicId: 'sirens' });
  });

  it('corrections, repeated corrections and a response landing after a removal', () => {
    const { draft: start, makeId } = basics();
    // A correction that still says the same difficulty keeps a supported proposal.
    let draft = hear(start, 'j_00000001', makeId, [fear]);
    draft = hear(draft, 'j_00000002', makeId, [fear]);
    expect(draft.intentSuggestions.map((item) => [item.topicId, item.jobId])).toEqual([['sirens', 'j_00000002']]);
    // A correction that drops the difficulty retires it and its proposal.
    const dropped = hear(draft, 'j_00000003', makeId, [], { hardTopicId: null });
    expect(dropped.intentSuggestions).toEqual([]);
    // A job started before the parent removed the difficulty cannot bring it, or its topic, back.
    const pending = startIntakeJob(hear(start, 'j_00000004', makeId, [fear]), 'j_00000005', 'transcript');
    const removed = removeFact(pending, difficultyId(pending, fear.value), makeId);
    const late = applyIntakeResult(
      removed,
      { jobId: 'j_00000005', source: 'transcript', transcript: 'synthetic', extraction: extraction({ facts: [fear], hardTopicId: 'sirens' }) },
      { allowedTopicIds: V2_TOPICS, makeId },
    );
    expect(late.applied).toBe(true);
    expect(activeFacts(late.draft).filter((fact) => fact.kind === 'difficulty')).toEqual([]);
    expect(late.draft.intentSuggestions).toEqual([]);
  });

  it('after approval: removing or rewording its difficulty asks explicitly; continue cannot approve it again', () => {
    const { draft: start, makeId } = basics();
    const approved = confirmFactsReview(ready(hear(start, 'j_00000001', makeId, [fear])));
    expect(approved.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });
    for (const change of ['remove', 'edit'] as const) {
      const changed =
        change === 'remove'
          ? removeFact(approved, difficultyId(approved, fear.value), makeId)
          : editFactValue(approved, difficultyId(approved, fear.value), 'חושך', makeId).draft;
      const question = changed.conflicts.find((conflict) => conflict.field === 'stale_direction');
      expect(question).toMatchObject({ field: 'stale_direction', topicId: 'sirens' });
      expect(requestIssues(changed).map((issue) => issue.code)).toContain('direction_unconfirmed');
      // "Continue" keeps the question open; no request can be built past it.
      const continued = confirmFactsReview(changed);
      expect(continued.conflicts.map((conflict) => conflict.field)).toEqual(['stale_direction']);
      expect(buildReviewedRequest(setCompanion(continued, 'fox_uri')).ok).toBe(false);
      // Kept: the parent's own choice now, no longer marked as derived.
      const kept = resolveConflict(changed, question?.id ?? '', 'keep');
      const keptCanonical = submitBoth(change === 'remove' ? setNoDifficulty(kept, true) : kept).canonical;
      expect(keptCanonical.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript' });
      // Removed: gone, and remembered as removed.
      const dropped = resolveConflict(changed, question?.id ?? '', 'accept');
      expect(dropped.intent).toBeNull();
      expect(dropped.topicTombstones).toContain('sirens');
    }
  });

  it('the server refuses a direction marked as derived when no difficulty is left', () => {
    const { draft: start, makeId } = basics();
    const { request } = submitBoth(hear(start, 'j_00000001', makeId, [fear]));
    expect(request.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'transcript', basis: 'difficulty' });
    const withoutDifficulty = { ...request, noDifficulty: true, facts: request.facts.filter((fact) => fact.kind !== 'difficulty') };
    const parsed = reviewedPersonalBookRequestSchema.safeParse(withoutDifficulty);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.map((issue) => issue.message)).toContain('direction_without_difficulty');
    expect(acceptPersonalBookRequest(withoutDifficulty, resolvePersonalWizardOptions()).ok).toBe(false);
  });

  it('a chip: rewording or unpicking its fact withdraws its proposal', () => {
    const { draft: start, makeId } = basics();
    const chip = { id: 'hard_night', label: 'פחדים בלילה', topicId: 'night' };
    const picked = toggleHardChip(start, chip, makeId).draft;
    const reworded = editFactValue(picked, activeFacts(picked)[0].id, 'פחד מהחושך בחדר', makeId).draft;
    expect(reworded.intentSuggestions).toEqual([]);
    expect(submitBoth(reworded).canonical.intent).toBeNull();
    expect(toggleHardChip(picked, chip, makeId).draft.intentSuggestions).toEqual([]);
  });
});

describe('owner addendum: a parent correction or exclusion is final', () => {
  const complete = (makeId: IdFactory) =>
    applyIntakeResult(
      startIntakeJob(createDraft('d_00000000test'), 'j_00000001', 'fixture'),
      buildFixtureResult({ jobId: 'j_00000001', exampleId: 'voice', address: 'boy' }),
      { allowedTopicIds: V2_TOPICS, makeId },
    ).draft;
  const factId = (draft: PersonalBookDraft, value: string) => activeFacts(draft).find((fact) => fact.value === value)?.id ?? '';
  /** A later hearing of the same things in the old wording (synthetic stand-ins for a misrecognition). */
  const hearAgain = (draft: PersonalBookDraft, jobId: string, makeId: IdFactory, supersedes?: string) =>
    applyIntakeResult(
      startIntakeJob(draft, jobId, 'transcript', supersedes ? { supersedesJobId: supersedes } : {}),
      {
        jobId,
        source: 'transcript',
        transcript: 'synthetic',
        extraction: extraction({
          mentionedName: 'בר',
          residence: 'אודם',
          facts: [
            { kind: 'interest', value: 'כדורגל' },
            { kind: 'habit', value: 'לוחש לכדור לפני בעיטה' },
          ],
        }),
      },
      { allowedTopicIds: V2_TOPICS, makeId },
    ).draft;

  it('corrected name, residence and interest reach the request; a later hearing of the old wording only asks', () => {
    for (const supersedes of [undefined, 'j_00000001']) {
      const makeId = sequentialIds();
      let draft = complete(makeId);
      draft = setChildName(draft, 'בארי');
      draft = commitChildResidence(setChildResidence(draft, 'חיפה'));
      draft = editFactValue(draft, factId(draft, 'כדורגל'), 'כדורסל', makeId).draft;
      // Approved, then the parent returns to the card and something is heard again: a new recording,
      // or a correction of the first transcript.
      draft = confirmFactsReview(draft);
      draft = hearAgain(draft, 'j_00000002', makeId, supersedes);
      // The old name and place come back only as questions; the old interest wording is not re-added.
      expect(draft.conflicts.map((conflict) => conflict.field).filter((field) => field === 'name' || field === 'residence')).toEqual([
        'name',
        'residence',
      ]);
      expect(activeFacts(draft).map((fact) => fact.value)).not.toContain('כדורגל');
      const { request, canonical } = submitBoth(draft);
      expect(canonical.child).toMatchObject({ name: 'בארי', nameSource: 'typed', residence: 'חיפה', residenceSource: 'typed' });
      expect(request.facts.map((fact) => [fact.kind, fact.value, fact.source])).toEqual([
        ['interest', 'כדורסל', 'typed'],
        ['interest', 'לקפוץ על הטרמפולינה', 'fixture'],
        ['difficulty', 'רעשים חזקים, כמו אזעקות', 'fixture'],
        ['habit', 'לוחש לכדור לפני בעיטה', 'fixture'],
      ]);
    }
  });

  it('a correctly heard detail removed before approval stays out through continue, request and re-extraction', () => {
    const makeId = sequentialIds();
    let draft = complete(makeId);
    draft = removeFact(draft, factId(draft, 'לוחש לכדור לפני בעיטה'), makeId);
    draft = confirmFactsReview(draft);
    draft = hearAgain(draft, 'j_00000002', makeId, 'j_00000001');
    const { request } = submitBoth(draft);
    expect(JSON.stringify(request)).not.toContain('לוחש לכדור');
    expect(summarizeRequest(request).factGroups.flatMap((group) => group.facts.map((fact) => fact.value))).not.toContain('לוחש לכדור לפני בעיטה');
  });

  it('removed after approval while another hearing is pending: the late answer does not reverse it', () => {
    const makeId = sequentialIds();
    let draft = confirmFactsReview(complete(makeId));
    draft = startIntakeJob(draft, 'j_00000002', 'transcript');
    draft = removeFact(draft, factId(draft, 'לוחש לכדור לפני בעיטה'), makeId);
    const late = applyIntakeResult(
      draft,
      {
        jobId: 'j_00000002',
        source: 'transcript',
        transcript: 'synthetic',
        extraction: extraction({ facts: [{ kind: 'habit', value: 'לוחש לכדור לפני בעיטה' }] }),
      },
      { allowedTopicIds: V2_TOPICS, makeId },
    );
    expect(late.applied).toBe(true);
    expect(JSON.stringify(submitBoth(late.draft).request)).not.toContain('לוחש לכדור');
  });

  it('a detail that reads like a removed one is asked about, never silently re-added', () => {
    const makeId = sequentialIds();
    const hearInterest = (draft: PersonalBookDraft, jobId: string, value: string) =>
      applyIntakeResult(
        startIntakeJob(draft, jobId, 'transcript'),
        { jobId, source: 'transcript', transcript: 'synthetic', extraction: extraction({ facts: [{ kind: 'interest', value }] }) },
        { allowedTopicIds: V2_TOPICS, makeId },
      ).draft;
    let draft = hearInterest(complete(makeId), 'j_00000002', 'לרכוב על אופניים');
    draft = removeFact(draft, factId(draft, 'לרכוב על אופניים'), makeId);
    draft = hearInterest(draft, 'j_00000003', 'לרכוב באופניים');
    const question = draft.conflicts.find((conflict) => conflict.field === 'similar_removed');
    expect(question).toMatchObject({ value: 'לרכוב באופניים', removedValue: 'לרכוב על אופניים' });
    expect(activeFacts(draft).map((fact) => fact.value)).not.toContain('לרכוב באופניים');
    // Unanswered, "continue" keeps it out.
    expect(JSON.stringify(submitBoth(draft).request)).not.toContain('אופניים');
    // Added only on the parent's explicit answer, as their own statement.
    const added = resolveConflict(draft, question?.id ?? '', 'accept');
    expect(activeFacts(added).find((fact) => fact.value === 'לרכוב באופניים')).toMatchObject({ status: 'included', parentOwned: true });
  });

  it('a deliberate re-entry restores a removed detail; a near-repeat of a listed one is not added twice', () => {
    const makeId = sequentialIds();
    let draft = complete(makeId);
    draft = removeFact(draft, factId(draft, 'כדורגל'), makeId);
    const restored = addTypedFact(draft, 'interest', 'כדורגל', makeId);
    expect(restored.outcome).toBe('restored');
    const nearRepeat = applyIntakeResult(
      startIntakeJob(restored.draft, 'j_00000002', 'transcript'),
      {
        jobId: 'j_00000002',
        source: 'transcript',
        transcript: 'synthetic',
        extraction: extraction({ facts: [{ kind: 'habit', value: 'לוחש לכדור לפני כל בעיטה' }] }),
      },
      { allowedTopicIds: V2_TOPICS, makeId },
    );
    expect(nearRepeat.applied && nearRepeat.omitted).toBe(1);
    expect(activeFacts(nearRepeat.draft).filter((fact) => fact.value.includes('לוחש'))).toHaveLength(1);
  });

  it('the request carries only reviewed, permitted inputs: never the transcript', () => {
    const makeId = sequentialIds();
    let draft = complete(makeId);
    draft = removeFact(draft, factId(draft, 'לוחש לכדור לפני בעיטה'), makeId);
    expect(draft.transcript?.text).toContain('לוחש לכדור');
    const { request, canonical } = submitBoth(draft);
    for (const payload of [request, canonical]) {
      expect(Object.keys(payload)).not.toContain('transcript');
      expect(JSON.stringify(payload)).not.toContain('לוחש');
    }
    expect(reviewedPersonalBookRequestSchema.safeParse({ ...request, transcript: 'raw text' }).success).toBe(false);
  });

  it('similar phrasings of one detail, and different details', () => {
    expect(similarDetails('לרכוב על אופניים', 'לרכוב באופניים')).toBe(true);
    expect(similarDetails('מפחד מהחושך', 'פחד מחושך')).toBe(true);
    expect(similarDetails('לצייר', 'לצייר דינוזאורים')).toBe(false);
    expect(similarDetails('כדורגל', 'כדורסל')).toBe(false);
    // A misheard place is not "similar": nothing merges or rewrites it; the parent corrects it.
    expect(similarDetails('שכונת הדקל', 'שכונת הדגל')).toBe(false);
  });
});

describe('Codex QA of v2, P2-1: an explicit switch leaves an empty card', () => {
  const empty = createDraft('d_00000000test');
  const withName = setChildName(empty, 'נוגה');

  it('"record instead" from an empty picking card returns to the recording start', () => {
    const inCard = { mode: 'chips' as const, cardOpened: true };
    expect(tellViewOf({ draft: empty, phase: 'idle', ...inCard })).toBe('card');
    const switched = switchTellMode(inCard, 'voice', empty);
    expect(switched).toEqual({ mode: 'voice', cardOpened: false });
    expect(tellViewOf({ draft: empty, phase: 'idle', ...switched })).toBe('start');
    // Writing instead, too.
    const toWrite = switchTellMode(inCard, 'write', empty);
    expect(tellViewOf({ draft: empty, phase: 'idle', ...toWrite })).toBe('write');
  });

  it('with details already in the card, switching keeps the card and every detail', () => {
    const inCard = { mode: 'chips' as const, cardOpened: true };
    const switched = switchTellMode(inCard, 'voice', withName);
    expect(switched).toEqual({ mode: 'voice', cardOpened: true });
    expect(tellViewOf({ draft: withName, phase: 'idle', ...switched })).toBe('card');
    // Recording from the card shows the recording screen, and the card again afterwards.
    expect(tellViewOf({ draft: withName, phase: 'recording', ...switched })).toBe('recording');
    expect(tellViewOf({ draft: withName, phase: 'recorded', ...switched })).toBe('card');
  });
});

// ── Codex re-gate of the correction (7086b0f0, HOLD 2026-09-29) ─────────────────────────────────

describe('Codex re-gate, P1-1: answering a stale difficulty keeps the direction question', () => {
  const fear = { kind: 'difficulty' as const, value: 'רעשים חזקים' };
  const dark = { kind: 'difficulty' as const, value: 'חושך' };
  type Source = 'transcript' | 'fixture';
  const CASES = [
    ['transcript', false],
    ['transcript', true],
    ['fixture', false],
    ['fixture', true],
  ] as const;
  /** A hearing: a correction of the transcript on screen, or with `newRecording` a recording of its own. */
  const hear = (
    draft: PersonalBookDraft,
    jobId: string,
    makeId: IdFactory,
    source: Source,
    partial: Partial<IntakeExtraction>,
    newRecording = false,
  ) => {
    const supersedes = !newRecording && draft.transcript ? { supersedesJobId: draft.transcript.jobId } : {};
    const merged = applyIntakeResult(
      startIntakeJob(draft, jobId, source, supersedes),
      { jobId, source, transcript: 'synthetic', extraction: extraction(partial) },
      { allowedTopicIds: V2_TOPICS, makeId },
    );
    if (!merged.applied) throw new Error(`not applied: ${merged.reason}`);
    return merged.draft;
  };
  /**
   * The reviewer's path: approved with the direction derived from `fear` (and `dark`, when another
   * difficulty is left), then a correction that no longer says `fear`, its question answered "remove".
   */
  const staleAnswered = (
    source: Source,
    remaining: boolean,
    first: Partial<IntakeExtraction> = { hardTopicId: 'sirens' },
    correction: Partial<IntakeExtraction> = {},
  ) => {
    const { draft: start, makeId } = basics();
    const approved = confirmFactsReview(ready(hear(start, 'j_00000001', makeId, source, { facts: remaining ? [fear, dark] : [fear], ...first })));
    const corrected = hear(approved, 'j_00000002', makeId, source, { facts: remaining ? [dark] : [], ...correction });
    const question = corrected.conflicts.find((conflict) => conflict.field === 'stale_fact');
    expect(question).toMatchObject({ field: 'stale_fact', value: fear.value });
    const answered = resolveConflict(corrected, question?.id ?? '', 'accept');
    expect(activeFacts(answered).map((fact) => fact.value)).not.toContain(fear.value);
    return { approved, answered: remaining ? answered : setNoDifficulty(answered, true), makeId };
  };
  /** What stops "continue" and the request, as the card's continue guard sees it. */
  const blockers = (draft: PersonalBookDraft) => {
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(ready(draft)), 'dragon_dini'));
    return built.ok ? [] : built.issues.map((issue) => issue.code);
  };
  const directionQuestion = (draft: PersonalBookDraft) => draft.conflicts.find((conflict) => conflict.field === 'stale_direction');

  it('the question is raised, and "continue" cannot approve past it', () => {
    for (const [source, remaining] of CASES) {
      const { approved, answered } = staleAnswered(source, remaining);
      expect(approved.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: source });
      expect(directionQuestion(answered)).toMatchObject({ topicId: 'sirens' });
      // Undecided: still shown, no longer marked as derived, and not yet approved.
      expect(answered.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: source });
      expect(answered.intentEvidence).toBeNull();
      const continued = confirmFactsReview(answered);
      expect(directionQuestion(continued)).toBeDefined();
      expect(requestIssues(continued).map((issue) => issue.code)).toContain('direction_unconfirmed');
      expect(blockers(answered)).toContain('direction_unconfirmed');
    }
  });

  it('kept: the parent\'s own choice; removed: gone, and it stays gone on later processing', () => {
    for (const [source, remaining] of CASES) {
      const { answered, makeId } = staleAnswered(source, remaining);
      const question = directionQuestion(answered);
      expect(question).toBeDefined();
      const kept = submitBoth(resolveConflict(answered, question?.id ?? '', 'keep'));
      expect(kept.canonical.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: source });
      expect(kept.request.intent).not.toHaveProperty('basis');
      expect(kept.request.facts.filter((fact) => fact.kind === 'difficulty').map((fact) => fact.value)).toEqual(remaining ? ['חושך'] : []);

      const dropped = resolveConflict(answered, question?.id ?? '', 'accept');
      expect(dropped.intent).toBeNull();
      expect(dropped.topicTombstones).toContain('sirens');
      expect(submitBoth(dropped).canonical.intent).toBeNull();
      // Said again, in a correction or in a new recording: neither the difficulty nor the direction returns.
      for (const [jobId, newRecording] of [['j_00000003', false], ['j_00000004', true]] as const) {
        const later = hear(dropped, jobId, makeId, source, { facts: [fear], hardTopicId: 'sirens' }, newRecording);
        expect(activeFacts(later).map((fact) => fact.value)).not.toContain(fear.value);
        expect(later.intentSuggestions).toEqual([]);
        expect(submitBoth(later).canonical.intent).toBeNull();
      }
    }
  });

  it('an unrelated open question stays open', () => {
    for (const [source, remaining] of CASES) {
      const { answered } = staleAnswered(source, remaining, { hardTopicId: 'sirens' }, { mentionedName: 'נועם' });
      expect(answered.conflicts.map((conflict) => conflict.field).sort()).toEqual(['name', 'stale_direction']);
    }
  });

  it('a direction the parent asked for, or chose, is not questioned when a difficulty goes', () => {
    for (const [source, remaining] of CASES) {
      const asked = staleAnswered(source, remaining, { explicitTopicId: 'sirens' }).answered;
      expect(directionQuestion(asked)).toBeUndefined();
      expect(submitBoth(asked).canonical.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: source });

      const { draft: start, makeId } = basics();
      let chosen = hear(start, 'j_00000001', makeId, source, { facts: remaining ? [fear, dark] : [fear] });
      chosen = confirmFactsReview(ready(setIntent(chosen, { kind: 'topic', topicId: 'night' })));
      chosen = hear(chosen, 'j_00000002', makeId, source, { facts: remaining ? [dark] : [] });
      const question = chosen.conflicts.find((conflict) => conflict.field === 'stale_fact');
      chosen = resolveConflict(chosen, question?.id ?? '', 'accept');
      if (!remaining) chosen = setNoDifficulty(chosen, true);
      expect(directionQuestion(chosen)).toBeUndefined();
      expect(submitBoth(chosen).canonical.intent).toEqual({ kind: 'topic', topicId: 'night' });
    }
  });

  it('a detail added back from a "reads like a removed one" question keeps the other open questions', () => {
    const { draft: start, makeId } = basics();
    let draft = confirmFactsReview(ready(hear(start, 'j_00000001', makeId, 'transcript', { facts: [fear], hardTopicId: 'sirens' })));
    draft = setNoDifficulty(removeFact(draft, activeFacts(draft).find((fact) => fact.value === fear.value)?.id ?? '', makeId), true);
    expect(directionQuestion(draft)).toBeDefined();
    draft = hear(draft, 'j_00000002', makeId, 'transcript', { facts: [{ kind: 'difficulty', value: 'רעשים חזקים מאוד' }] }, true);
    const similar = draft.conflicts.find((conflict) => conflict.field === 'similar_removed');
    expect(similar).toMatchObject({ value: 'רעשים חזקים מאוד', removedValue: fear.value });
    const added = resolveConflict(draft, similar?.id ?? '', 'accept');
    expect(activeFacts(added).map((fact) => fact.value)).toContain('רעשים חזקים מאוד');
    expect(added.noDifficulty).toBe(false);
    expect(added.conflicts.map((conflict) => conflict.field)).toEqual(['stale_direction']);
    expect(blockers(added)).toContain('direction_unconfirmed');
  });
});
