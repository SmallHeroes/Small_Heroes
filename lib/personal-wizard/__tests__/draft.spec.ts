import { describe, expect, it } from 'vitest';

import {
  LIMITS,
  PERSONAL_INTAKE_EXTRACTION_VERSION,
  comparableText,
  isValidChildName,
  normalizeText,
  reviewedPersonalBookRequestSchema,
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
  commitStoryPlace,
  confirmFactsReview,
  createDraft,
  dismissIntentSuggestion,
  editFactValue,
  removeFact,
  requestContainsFixtureData,
  resolveConflict,
  setChildAddress,
  setChildAge,
  setChildName,
  setCompanion,
  setIntent,
  startIntakeJob,
  summarizeRequest,
  toggleChip,
  type IdFactory,
} from '../draft';
import { buildFixtureResult } from '../intake-fixture';

function sequentialIds(): IdFactory {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    return `${prefix}_${String(counter).padStart(8, '0')}`;
  };
}

const ALLOWED_TOPICS = new Set(['transitions', 'night', 'social']);

function basics(makeId = sequentialIds()): { draft: PersonalBookDraft; makeId: IdFactory } {
  let draft = createDraft('d_00000000test');
  draft = setChildName(draft, 'בר');
  draft = setChildAge(draft, 5);
  draft = setChildAddress(draft, 'boy');
  return { draft, makeId };
}

function extraction(partial: Partial<IntakeExtraction>): IntakeExtraction {
  return {
    version: PERSONAL_INTAKE_EXTRACTION_VERSION,
    understood: true,
    facts: [],
    storyPlace: null,
    mentionedName: null,
    mentionedAge: null,
    explicitTopicId: null,
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

  it('continuing with no details is allowed and invents nothing', () => {
    const { draft: start } = basics();
    const draft = setCompanion(confirmFactsReview(start), 'panda_anat');
    const built = buildReviewedRequest(draft);
    expect(built.ok && built.request.facts).toEqual([]);
    expect(built.ok && built.request.storyPlace).toBeNull();
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

  it('enforces the fact ceiling and bounded lengths', () => {
    const { draft: start, makeId } = basics();
    let draft = start;
    for (let index = 0; index < LIMITS.factsMax; index += 1) {
      draft = addTypedFact(draft, 'interest', `תחביב ${'א'.repeat(index + 1)}`, makeId).draft;
    }
    expect(addTypedFact(draft, 'interest', 'עוד אחד', makeId).outcome).toBe('limit');
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
    expect(draft.conflicts.map((conflict) => [conflict.field, conflict.proposed])).toEqual([
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

  it('ignores an out-of-range or equal age, and never extracts grammatical address', () => {
    const { draft: start, makeId } = basics();
    const draft = startIntakeJob(start, 'j_00000001', 'transcript');
    const merged = merge(draft, transcriptResult('j_00000001', { mentionedAge: 11 }), makeId);
    expect(merged.draft.conflicts).toEqual([]);
    expect(merged.draft.child.address).toBe('boy');
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
    expect(draft.intentSuggestions).toEqual([{ topicId: 'transitions', jobId: 'j_00000001', source: 'transcript' }]);
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
      ['residence', 'fixture'],
      ['family', 'fixture'],
      ['other', 'fixture'],
      ['recent_event', 'fixture'],
    ]);
    expect(draft.conflicts.map((conflict) => [conflict.field, conflict.proposed, conflict.source])).toEqual([
      ['age', 6, 'fixture'],
    ]);
    expect(draft.intent).toBeNull();
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['transitions']);

    draft = setCompanion(confirmFactsReview(draft), 'dragon_dini');
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(requestContainsFixtureData(built.request)).toBe(true);
    expect(built.request.child.age).toBe(5);
    expect(summarizeRequest(built.request).containsFixtureData).toBe(true);
  });

  it('simple example never invents family or residence', () => {
    const result = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'simple', address: 'girl' });
    expect(result.source).toBe('fixture');
    expect(result.extraction.facts.map((fact) => fact.kind)).not.toContain('family');
    expect(result.extraction.facts.map((fact) => fact.kind)).not.toContain('residence');
    expect(result.transcript).toContain('היא');
  });
});

describe('summary and request round-trip', () => {
  it('summary shows exactly the request facts: no removed, no unapproved', () => {
    const { draft: start, makeId } = basics();
    let draft = addTypedFact(start, 'interest', 'ציור', makeId).draft;
    draft = addTypedFact(draft, 'favorite_place', 'הים', makeId).draft;
    draft = addTypedFact(draft, 'residence', 'קיבוץ', makeId).draft;
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
    expect(summaryFacts.map((fact) => fact.value).sort()).toEqual(['הים', 'קיבוץ']);
    expect(summary.factGroups.map((group) => group.group)).toEqual(['places']);
    expect(built.request.facts.map((fact) => fact.kind)).toEqual(['favorite_place', 'residence']);
    expect(summary.avoid).toEqual(['בלי כלבים גדולים']);
  });

  it('reports missing required choices by step', () => {
    const empty = buildReviewedRequest(createDraft('d_00000000test'));
    expect(!empty.ok && empty.issues.map((issue) => [issue.code, issue.step])).toEqual([
      ['child_name_missing', 1],
      ['child_age_missing', 1],
      ['child_address_missing', 1],
      ['companion_missing', 3],
    ]);
  });

  it('the strict request schema rejects authority fields a browser might add', () => {
    const { draft: start } = basics();
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(start), 'fox_uri'));
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
});
