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
  commitChildName,
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
  setCompanion,
  setIntent,
  startIntakeJob,
  summarizeRequest,
  toggleChip,
  type IdFactory,
} from '../draft';
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
    expect(draft.conflicts.map((conflict) => [conflict.field, 'proposed' in conflict ? conflict.proposed : null, conflict.source])).toEqual([
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

  it('reports missing required choices by step (1 = tell us, 2 = companion)', () => {
    const empty = buildReviewedRequest(createDraft('d_00000000test'));
    expect(!empty.ok && empty.issues.map((issue) => [issue.code, issue.step])).toEqual([
      ['child_name_missing', 1],
      ['child_age_missing', 1],
      ['child_address_missing', 1],
      ['companion_missing', 2],
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
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(draft), 'panda_anat'));
    if (!built.ok) throw new Error(`request not built: ${built.issues.map((issue) => issue.code).join(',')}`);
    return built.request;
  };

  it("reviewer case: correcting 'גר באודם' to 'גר בחיפה' leaves only the corrected residence, and the server agrees", () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'residence', value: 'גר באודם' }], makeId).draft;
    const corrected = correct(draft, 'j_00000002', 'j_00000001', [{ kind: 'residence', value: 'גר בחיפה' }], makeId);
    expect(corrected.applied && corrected.retired).toBe(1);
    draft = corrected.draft;
    expect(draft.conflicts).toEqual([]);
    const request = finalRequest(draft);
    expect(kinds(request.facts)).toEqual(['residence:גר בחיפה']);
    const accepted = acceptPersonalBookRequest(request, resolvePersonalWizardOptions());
    expect(accepted.ok && kinds(accepted.canonical.facts)).toEqual(['residence:גר בחיפה']);
  });

  it('control: a second RECORDING still adds to the first; only a correction supersedes', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'residence', value: 'גר באודם' }], makeId).draft;
    draft = record(draft, 'j_00000002', [{ kind: 'interest', value: 'ציור' }], makeId).draft;
    expect(kinds(finalRequest(draft).facts)).toEqual(['residence:גר באודם', 'interest:ציור']);
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
    expect(kinds(finalRequest(draft).facts)).toEqual(['family:אחות קטנה בשם נוגה']);
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
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'residence', value: 'גר באודם' }], makeId).draft;
    draft = correct(
      draft,
      'j_00000002',
      'j_00000001',
      [
        { kind: 'residence', value: 'גר באודם' },
        { kind: 'habit', value: 'שר שירים' },
      ],
      makeId,
    ).draft;
    const second = correct(
      draft,
      'j_00000003',
      'j_00000002',
      [
        { kind: 'residence', value: 'גר בחיפה' },
        { kind: 'habit', value: 'שר שירים' },
      ],
      makeId,
    );
    expect(second.applied && second.retired).toBe(1);
    const request = finalRequest(second.draft);
    expect(kinds(request.facts)).toEqual(['habit:שר שירים', 'residence:גר בחיפה']);
    const accepted = acceptPersonalBookRequest(request, resolvePersonalWizardOptions());
    expect(accepted.ok && kinds(accepted.canonical.facts)).toEqual(['habit:שר שירים', 'residence:גר בחיפה']);
  });

  it('an unclear correction in the middle changes nothing, and hands its details to the next one', () => {
    const { draft: start, makeId } = basics();
    let draft = record(start, 'j_00000001', [{ kind: 'residence', value: 'גר באודם' }], makeId, {
      explicitTopicId: 'night',
      mentionedAge: 6,
    }).draft;
    draft = correct(draft, 'j_00000002', 'j_00000001', [], makeId, { understood: false }).draft;
    // Negative control: the unclear step itself keeps every detail, question and suggestion.
    expect(activeFacts(draft).map((fact) => fact.value)).toEqual(['גר באודם']);
    expect(draft.conflicts.map((conflict) => conflict.field)).toEqual(['age']);
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['night']);
    // The next correction corrects the transcript on screen, and with it everything handed on.
    draft = correct(draft, 'j_00000003', 'j_00000002', [{ kind: 'residence', value: 'גר בחיפה' }], makeId).draft;
    expect(draft.conflicts).toEqual([]);
    expect(draft.intentSuggestions).toEqual([]);
    expect(kinds(finalRequest(draft).facts)).toEqual(['residence:גר בחיפה']);
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
    expect(kinds(finalRequest(silent).facts)).toEqual([]);
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
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(draft), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.facts).toEqual([]);
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
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(draft), 'fox_uri'));
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
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(draft), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.child.ageSource).toBe('transcript');
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'transitions', suggestedBy: 'transcript' });
    expect(requestContainsFixtureData(built.request)).toBe(false);
  });

  it('the strict schema requires the provenance fields and their allowed values', () => {
    const { draft: start } = basics();
    const built = buildReviewedRequest(setCompanion(confirmFactsReview(start), 'fox_uri'));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const { nameSource: _dropped, ...withoutSource } = built.request.child;
    const bad = [
      { ...built.request, child: withoutSource },
      { ...built.request, child: { ...built.request.child, nameSource: 'chip' } },
      { ...built.request, child: { ...built.request.child, ageSource: 'guessed' } },
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

  it('fills an empty name and age as suggestions; the address stays the parent\'s explicit choice', () => {
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
      nameSource: 'transcript',
      ageSource: 'transcript',
      nameJobId: 'j_00000001',
      ageJobId: 'j_00000001',
    });
    expect(draft.conflicts).toEqual([]);
    // Heard but not yet approved, and the address is never inferred.
    expect(codes(draft)).toEqual(['child_address_missing', 'facts_unreviewed', 'companion_missing']);
    draft = setCompanion(setChildAddress(confirmFactsReview(draft), 'boy'), 'fox_uri');
    expect(draft.child).toMatchObject({ nameJobId: null, ageJobId: null });
    const built = buildReviewedRequest(draft);
    expect(built.ok && built.request.child).toEqual({ name: 'בר', age: 5, address: 'boy', nameSource: 'transcript', ageSource: 'transcript' });
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

  it("the brief's example: exactly what was said, labelled; nothing invented", () => {
    const makeId = sequentialIds();
    const context = { allowedTopicIds: new Set(['sirens', 'night']), makeId };
    const example = buildFixtureResult({ jobId: 'j_00000001', exampleId: 'voice', address: 'boy' });
    const merged = applyIntakeResult(startIntakeJob(empty(), 'j_00000001', 'fixture'), example, context);
    expect(merged.applied).toBe(true);
    let draft = merged.draft;
    expect(draft.child).toMatchObject({ name: 'בר', age: 5, address: null, nameSource: 'fixture', ageSource: 'fixture' });
    expect(activeFacts(draft).map((fact) => [fact.kind, fact.value, fact.source])).toEqual([
      ['residence', 'אודם', 'fixture'],
      ['interest', 'כדורגל', 'fixture'],
      ['habit', 'לוחש לכדור לפני בעיטה', 'fixture'],
    ]);
    expect(draft.storyPlace).toBeNull();
    expect(draft.intentSuggestions.map((item) => item.topicId)).toEqual(['sirens']);
    expect(JSON.stringify(draft)).not.toMatch(/פחד|משפחה/);

    draft = setCompanion(setChildAddress(confirmFactsReview(draft), 'boy'), 'panda_anat');
    const built = buildReviewedRequest(draft);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.intent).toEqual({ kind: 'topic', topicId: 'sirens', suggestedBy: 'fixture' });
    expect(built.request.storyPlace).toBeNull();
    expect(requestContainsFixtureData(built.request)).toBe(true);
    const accepted = acceptPersonalBookRequest(built.request, resolvePersonalWizardOptions());
    expect(accepted.ok && accepted.containsFixtureData).toBe(true);
  });

  it('normalizing the name for the request keeps where it came from', () => {
    const typed = commitChildName(setChildName(empty(), '  בר '));
    expect(typed.child).toMatchObject({ name: 'בר', nameSource: 'typed' });
    const heard = { ...empty(), child: { ...empty().child, name: 'בר ', nameSource: 'transcript' as const } };
    expect(commitChildName(heard).child).toMatchObject({ name: 'בר', nameSource: 'transcript' });
    expect(commitChildName(typed)).toBe(typed);
  });
});
