/**
 * Pure operations over the in-memory `PersonalBookDraft`.
 *
 * Every entry path (typing, chips, recorded transcript, labelled fixture) lands in the same
 * facts list through these functions, and the reviewed request is built from that list only.
 *
 * Merge rules (brief 2026-09-28 §7):
 * - an intake proposal never overwrites a parent value: it is added as `proposed`, becomes a
 *   conflict prompt, or is omitted;
 * - removed facts, replaced values and removed places are tombstoned and never return;
 * - a result is applied only to the job that is still `processing` (late results after a cancel,
 *   a newer job or "continue without" are ignored);
 * - companion and intent are never chosen on the parent's behalf; an explicit topic is only a
 *   suggestion.
 */
import {
  LIMITS,
  PERSONAL_BOOK_DRAFT_VERSION,
  PROTOTYPE_AGE_MAX,
  PROTOTYPE_AGE_MIN,
  REVIEWED_PERSONAL_BOOK_REQUEST_VERSION,
  comparableText,
  isValidChildName,
  normalizeText,
  reviewedPersonalBookRequestSchema,
  type Conflict,
  type Fact,
  type FactKind,
  type GrammaticalAddress,
  type IntakeResult,
  type Intent,
  type PersonalBookDraft,
  type PhotoChoice,
  type ReviewedPersonalBookRequest,
} from './contract';

export type IdPrefix = 'd' | 'f' | 'j' | 'c';
export type IdFactory = (prefix: IdPrefix) => string;

export function randomId(prefix: IdPrefix): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function createDraft(draftId: string): PersonalBookDraft {
  return {
    version: PERSONAL_BOOK_DRAFT_VERSION,
    draftId,
    revision: 0,
    child: { name: '', age: null, address: null },
    facts: [],
    storyPlace: null,
    placeTombstones: [],
    companionId: null,
    intent: null,
    intentSuggestions: [],
    avoid: [],
    photo: 'none',
    bookOptions: { packageId: null, voiceId: null },
    conflicts: [],
    factsReviewedAtRevision: null,
    intake: null,
    transcript: null,
  };
}

function next(draft: PersonalBookDraft, patch: Partial<PersonalBookDraft>): PersonalBookDraft {
  return { ...draft, ...patch, revision: draft.revision + 1 };
}

// ── Child basics ────────────────────────────────────────────────────────────

/** Raw input is kept while typing; normalization happens when the request is built. */
export function setChildName(draft: PersonalBookDraft, raw: string): PersonalBookDraft {
  return next(draft, {
    child: { ...draft.child, name: raw.slice(0, LIMITS.nameMax + 10) },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'name'),
  });
}

export function setChildAge(draft: PersonalBookDraft, age: number | null): PersonalBookDraft {
  const valid = age === null || (Number.isInteger(age) && age >= PROTOTYPE_AGE_MIN && age <= PROTOTYPE_AGE_MAX);
  if (!valid) return draft;
  return next(draft, {
    child: { ...draft.child, age },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'age'),
  });
}

export function setChildAddress(draft: PersonalBookDraft, address: GrammaticalAddress): PersonalBookDraft {
  return next(draft, { child: { ...draft.child, address } });
}

// ── Facts ───────────────────────────────────────────────────────────────────

export type ChipDefinition = { id: string; label: string; kind: FactKind };

export type FactOutcome = 'added' | 'restored' | 'adopted' | 'duplicate' | 'limit' | 'empty' | 'too_long';

function factKeys(fact: Fact): string[] {
  return [comparableText(fact.value), ...fact.previousKeys];
}

function storyFactCount(facts: readonly Fact[]): number {
  return facts.filter((fact) => fact.status !== 'removed').length;
}

export function activeFacts(draft: PersonalBookDraft): Fact[] {
  return draft.facts.filter((fact) => fact.status !== 'removed');
}

export function includedFacts(draft: PersonalBookDraft): Fact[] {
  return draft.facts.filter((fact) => fact.status === 'included');
}

export function chipIsSelected(draft: PersonalBookDraft, chipId: string): boolean {
  return draft.facts.some((fact) => fact.chipId === chipId && fact.status !== 'removed');
}

function replaceFact(draft: PersonalBookDraft, updated: Fact): PersonalBookDraft {
  return next(draft, { facts: draft.facts.map((fact) => (fact.id === updated.id ? updated : fact)) });
}

export function addTypedFact(
  draft: PersonalBookDraft,
  kind: FactKind,
  rawValue: string,
  makeId: IdFactory,
): { draft: PersonalBookDraft; outcome: FactOutcome } {
  const value = normalizeText(rawValue);
  if (!value) return { draft, outcome: 'empty' };
  if (value.length > LIMITS.factValueMax) return { draft, outcome: 'too_long' };
  const key = comparableText(value);
  const existing = draft.facts.find((fact) => factKeys(fact).includes(key));
  if (existing?.status === 'included') return { draft, outcome: 'duplicate' };
  if (existing?.status === 'proposed') {
    // The parent typed what a recording proposed: that is the parent's own statement now.
    return {
      draft: replaceFact(draft, { ...existing, status: 'included', parentOwned: true, revision: draft.revision + 1 }),
      outcome: 'adopted',
    };
  }
  if (storyFactCount(draft.facts) >= LIMITS.factsMax) return { draft, outcome: 'limit' };
  if (existing) {
    // Explicit re-entry of a removed detail restores it.
    const restored: Fact = {
      ...existing,
      kind,
      value,
      source: 'typed',
      status: 'included',
      parentOwned: true,
      revision: draft.revision + 1,
    };
    return { draft: replaceFact(draft, restored), outcome: 'restored' };
  }
  const fact: Fact = {
    id: makeId('f'),
    kind,
    value,
    source: 'typed',
    status: 'included',
    revision: draft.revision + 1,
    previousKeys: [],
    parentOwned: true,
  };
  return { draft: next(draft, { facts: [...draft.facts, fact] }), outcome: 'added' };
}

/** Pressing a chip adds its fact; pressing it again removes it. A renamed chip value stays one fact. */
export function toggleChip(
  draft: PersonalBookDraft,
  chip: ChipDefinition,
  makeId: IdFactory,
): { draft: PersonalBookDraft; outcome: FactOutcome | 'removed' } {
  const linked = draft.facts.find((fact) => fact.chipId === chip.id);
  if (linked && linked.status !== 'removed') {
    return { draft: replaceFact(draft, { ...linked, status: 'removed', revision: draft.revision + 1 }), outcome: 'removed' };
  }
  const key = comparableText(chip.label);
  const sameValue = draft.facts.find((fact) => fact.id !== linked?.id && factKeys(fact).includes(key));
  if (sameValue && sameValue.status !== 'removed') {
    // The detail already exists (typed or proposed); link the chip to it instead of duplicating.
    return {
      draft: replaceFact(draft, { ...sameValue, chipId: chip.id, status: 'included', parentOwned: true, revision: draft.revision + 1 }),
      outcome: 'adopted',
    };
  }
  if (storyFactCount(draft.facts) >= LIMITS.factsMax) return { draft, outcome: 'limit' };
  const restoreTarget = linked ?? sameValue;
  if (restoreTarget) {
    const previousKeys = comparableText(restoreTarget.value) === key
      ? restoreTarget.previousKeys
      : [...restoreTarget.previousKeys, comparableText(restoreTarget.value)];
    return {
      draft: replaceFact(draft, {
        ...restoreTarget,
        chipId: chip.id,
        kind: chip.kind,
        value: chip.label,
        source: 'chip',
        status: 'included',
        parentOwned: true,
        revision: draft.revision + 1,
        previousKeys,
      }),
      outcome: 'restored',
    };
  }
  const fact: Fact = {
    id: makeId('f'),
    kind: chip.kind,
    value: chip.label,
    source: 'chip',
    status: 'included',
    chipId: chip.id,
    revision: draft.revision + 1,
    previousKeys: [],
    parentOwned: true,
  };
  return { draft: next(draft, { facts: [...draft.facts, fact] }), outcome: 'added' };
}

export type EditOutcome = 'saved' | 'unchanged' | 'empty' | 'too_long' | 'duplicate' | 'missing';

export function editFactValue(
  draft: PersonalBookDraft,
  factId: string,
  rawValue: string,
): { draft: PersonalBookDraft; outcome: EditOutcome } {
  const fact = draft.facts.find((candidate) => candidate.id === factId);
  if (!fact || fact.status === 'removed') return { draft, outcome: 'missing' };
  const value = normalizeText(rawValue);
  if (!value) return { draft, outcome: 'empty' };
  if (value.length > LIMITS.factValueMax) return { draft, outcome: 'too_long' };
  if (value === fact.value) {
    if (fact.status === 'proposed') {
      return {
        draft: replaceFact(draft, { ...fact, status: 'included', parentOwned: true, revision: draft.revision + 1 }),
        outcome: 'saved',
      };
    }
    return { draft, outcome: 'unchanged' };
  }
  const key = comparableText(value);
  const clash = draft.facts.find(
    (candidate) => candidate.id !== factId && candidate.status !== 'removed' && comparableText(candidate.value) === key,
  );
  if (clash) return { draft, outcome: 'duplicate' };
  const oldKey = comparableText(fact.value);
  const previousKeys = oldKey !== key && !fact.previousKeys.includes(oldKey) ? [...fact.previousKeys, oldKey] : fact.previousKeys;
  return {
    draft: replaceFact(draft, { ...fact, value, status: 'included', parentOwned: true, revision: draft.revision + 1, previousKeys }),
    outcome: 'saved',
  };
}

export function removeFact(draft: PersonalBookDraft, factId: string): PersonalBookDraft {
  const fact = draft.facts.find((candidate) => candidate.id === factId);
  if (!fact || fact.status === 'removed') return draft;
  return replaceFact(draft, { ...fact, status: 'removed', revision: draft.revision + 1 });
}

// ── Story place (commit on blur: every committed replacement tombstones the old value) ──

export function commitStoryPlace(draft: PersonalBookDraft, rawValue: string): PersonalBookDraft {
  const value = normalizeText(rawValue).slice(0, LIMITS.placeMax).trim();
  const current = draft.storyPlace;
  const currentKey = current ? comparableText(current.value) : null;
  const key = value ? comparableText(value) : null;
  if (current && key === currentKey && value === current.value) return draft;
  if (!current && !key) return draft;
  const tombstones =
    current && currentKey && currentKey !== key && !draft.placeTombstones.includes(currentKey)
      ? [...draft.placeTombstones, currentKey]
      : draft.placeTombstones;
  return next(draft, {
    storyPlace: value
      ? { value, source: 'typed', status: 'included', revision: draft.revision + 1, parentOwned: true }
      : null,
    placeTombstones: tombstones,
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'storyPlace' && conflict.field !== 'stale_place'),
  });
}

// ── Avoid list ──────────────────────────────────────────────────────────────

export function addAvoid(draft: PersonalBookDraft, rawValue: string): { draft: PersonalBookDraft; outcome: FactOutcome } {
  const value = normalizeText(rawValue);
  if (!value) return { draft, outcome: 'empty' };
  if (value.length > LIMITS.avoidItemMax) return { draft, outcome: 'too_long' };
  if (draft.avoid.some((item) => comparableText(item) === comparableText(value))) return { draft, outcome: 'duplicate' };
  if (draft.avoid.length >= LIMITS.avoidMax) return { draft, outcome: 'limit' };
  return { draft: next(draft, { avoid: [...draft.avoid, value] }), outcome: 'added' };
}

export function removeAvoid(draft: PersonalBookDraft, index: number): PersonalBookDraft {
  if (index < 0 || index >= draft.avoid.length) return draft;
  return next(draft, { avoid: draft.avoid.filter((_, position) => position !== index) });
}

// ── Companion, intent, look and sound ──────────────────────────────────────

/** Changing the companion never touches the intent, and vice versa. */
export function setCompanion(draft: PersonalBookDraft, companionId: string): PersonalBookDraft {
  if (draft.companionId === companionId) return draft;
  return next(draft, { companionId });
}

export function setIntent(draft: PersonalBookDraft, intent: Intent | null): PersonalBookDraft {
  return next(draft, { intent });
}

export function dismissIntentSuggestion(draft: PersonalBookDraft, topicId: string): PersonalBookDraft {
  return next(draft, { intentSuggestions: draft.intentSuggestions.filter((item) => item.topicId !== topicId) });
}

export function setPhotoChoice(draft: PersonalBookDraft, photo: PhotoChoice): PersonalBookDraft {
  if (draft.photo === photo) return draft;
  return next(draft, { photo });
}

export function setPackage(draft: PersonalBookDraft, packageId: string | null): PersonalBookDraft {
  return next(draft, { bookOptions: { ...draft.bookOptions, packageId } });
}

export function setVoice(draft: PersonalBookDraft, voiceId: string | null): PersonalBookDraft {
  return next(draft, { bookOptions: { ...draft.bookOptions, voiceId } });
}

// ── Intake jobs and merge ──────────────────────────────────────────────────

export function startIntakeJob(
  draft: PersonalBookDraft,
  jobId: string,
  source: 'transcript' | 'fixture',
  options: { supersedesJobId?: string } = {},
): PersonalBookDraft {
  // One job at a time: a newer job supersedes (abandons) any unfinished one.
  return {
    ...draft,
    intake: {
      jobId,
      basedOnRevision: draft.revision,
      source,
      status: 'processing',
      ...(options.supersedesJobId ? { supersedesJobId: options.supersedesJobId } : {}),
    },
  };
}

export function abandonIntakeJob(draft: PersonalBookDraft): PersonalBookDraft {
  if (!draft.intake || draft.intake.status !== 'processing') return draft;
  return { ...draft, intake: { ...draft.intake, status: 'abandoned' } };
}

export function failIntakeJob(draft: PersonalBookDraft, jobId: string): PersonalBookDraft {
  if (!draft.intake || draft.intake.jobId !== jobId || draft.intake.status !== 'processing') return draft;
  return { ...draft, intake: { ...draft.intake, status: 'failed' } };
}

export function isIntakeProcessing(draft: PersonalBookDraft): boolean {
  return draft.intake?.status === 'processing';
}

export type MergeOutcome =
  | {
      applied: true;
      draft: PersonalBookDraft;
      understood: boolean;
      added: number;
      conflicts: number;
      omitted: number;
      suggestions: number;
      /** Unapproved proposals of a superseded transcript that the correction no longer contains. */
      retired: number;
    }
  | {
      applied: false;
      draft: PersonalBookDraft;
      reason: 'no_active_job' | 'job_mismatch' | 'job_not_processing' | 'source_mismatch';
    };

export function applyIntakeResult(
  draft: PersonalBookDraft,
  result: IntakeResult,
  context: { allowedTopicIds: ReadonlySet<string>; makeId: IdFactory },
): MergeOutcome {
  const job = draft.intake;
  if (!job) return { applied: false, draft, reason: 'no_active_job' };
  if (job.jobId !== result.jobId) return { applied: false, draft, reason: 'job_mismatch' };
  if (job.status !== 'processing') return { applied: false, draft, reason: 'job_not_processing' };
  if (job.source !== result.source) return { applied: false, draft, reason: 'source_mismatch' };

  const { extraction } = result;
  const revision = draft.revision + 1;
  const base: PersonalBookDraft = {
    ...draft,
    revision,
    intake: { ...job, status: 'applied' },
    transcript: result.transcript ? { jobId: job.jobId, text: result.transcript, source: result.source } : draft.transcript,
  };
  if (!extraction.understood) {
    // An unclear correction changes nothing: the earlier transcript's details stay as they were.
    return { applied: true, draft: base, understood: false, added: 0, conflicts: 0, omitted: 0, suggestions: 0, retired: 0 };
  }

  let added = 0;
  let omitted = 0;
  let retired = 0;
  let facts = [...draft.facts];
  let storyPlace = draft.storyPlace;
  let conflicts: Conflict[] = [...draft.conflicts];
  let intentSuggestions = [...draft.intentSuggestions];

  /*
   * A corrected transcript REPLACES the transcript it corrects (job S). Details proposed by S:
   * - still present in the correction: kept as they are (same id, same status);
   * - removed by the parent: stay removed (tombstone), whatever the correction says;
   * - parent-owned (typed, chipped, edited): kept; the parent's own statement is not the model's;
   * - only proposed (never approved): retired, so they cannot accumulate next to the correction;
   * - already approved via "continue": kept, with an explicit keep-or-remove question.
   * Questions and topic suggestions raised by S are obsolete and dropped. Other recordings, typed
   * and chip details are untouched.
   */
  const superseded = job.supersedesJobId;
  if (superseded) {
    const correctedKeys = new Set(extraction.facts.map((fact) => comparableText(fact.value)));
    const kept: Fact[] = [];
    const questions: Conflict[] = [];
    for (const fact of facts) {
      const fromSuperseded = fact.jobId === superseded && fact.status !== 'removed' && !fact.parentOwned;
      if (!fromSuperseded || correctedKeys.has(comparableText(fact.value))) {
        kept.push(fact);
      } else if (fact.status === 'proposed') {
        retired += 1;
      } else {
        kept.push(fact);
        questions.push({
          id: context.makeId('c'),
          field: 'stale_fact',
          factId: fact.id,
          value: fact.value,
          jobId: job.jobId,
          source: result.source,
        });
      }
    }
    facts = kept;
    conflicts = [...conflicts.filter((conflict) => conflict.jobId !== superseded), ...questions];
    intentSuggestions = intentSuggestions.filter((item) => item.jobId !== superseded);
    if (storyPlace && storyPlace.jobId === superseded && !storyPlace.parentOwned) {
      const correctedPlace = extraction.storyPlace ? comparableText(extraction.storyPlace) : null;
      if (correctedPlace !== comparableText(storyPlace.value)) {
        if (storyPlace.status === 'proposed') {
          storyPlace = null;
          retired += 1;
        } else if (!correctedPlace) {
          conflicts.push({ id: context.makeId('c'), field: 'stale_place', value: storyPlace.value, jobId: job.jobId, source: result.source });
        }
        // An approved place with a different corrected place is asked below like any other mismatch.
      }
    }
  }

  const seen = new Set<string>();
  for (const proposal of extraction.facts) {
    const key = comparableText(proposal.value);
    if (!key || seen.has(key) || facts.some((fact) => factKeys(fact).includes(key)) || storyFactCount(facts) >= LIMITS.factsMax) {
      omitted += 1;
      continue;
    }
    seen.add(key);
    facts.push({
      id: context.makeId('f'),
      kind: proposal.kind,
      value: proposal.value,
      source: result.source,
      status: 'proposed',
      jobId: job.jobId,
      revision,
      previousKeys: [],
      parentOwned: false,
    });
    added += 1;
  }

  const pushConflict = (field: 'name' | 'age' | 'storyPlace', proposed: string | number) => {
    conflicts = [
      ...conflicts.filter((conflict) => conflict.field !== field),
      { id: context.makeId('c'), field, proposed, jobId: job.jobId, source: result.source },
    ];
  };

  if (extraction.storyPlace) {
    const key = comparableText(extraction.storyPlace);
    if (draft.placeTombstones.includes(key)) {
      omitted += 1;
    } else if (storyPlace) {
      if (comparableText(storyPlace.value) !== key) pushConflict('storyPlace', extraction.storyPlace);
    } else {
      storyPlace = {
        value: extraction.storyPlace,
        source: result.source,
        status: 'proposed',
        jobId: job.jobId,
        revision,
        parentOwned: false,
      };
      added += 1;
    }
  }

  const currentName = normalizeText(draft.child.name);
  if (
    extraction.mentionedName &&
    currentName &&
    isValidChildName(extraction.mentionedName) &&
    comparableText(extraction.mentionedName) !== comparableText(currentName)
  ) {
    pushConflict('name', extraction.mentionedName);
  }
  if (
    extraction.mentionedAge !== null &&
    draft.child.age !== null &&
    extraction.mentionedAge >= PROTOTYPE_AGE_MIN &&
    extraction.mentionedAge <= PROTOTYPE_AGE_MAX &&
    extraction.mentionedAge !== draft.child.age
  ) {
    pushConflict('age', extraction.mentionedAge);
  }

  let suggestions = 0;
  const topicId = extraction.explicitTopicId;
  if (
    topicId &&
    context.allowedTopicIds.has(topicId) &&
    !(draft.intent?.kind === 'topic' && draft.intent.topicId === topicId) &&
    !intentSuggestions.some((item) => item.topicId === topicId)
  ) {
    intentSuggestions.push({ topicId, jobId: job.jobId, source: result.source });
    suggestions += 1;
  }

  return {
    applied: true,
    draft: { ...base, facts, storyPlace, conflicts, intentSuggestions },
    understood: true,
    added,
    conflicts: conflicts.filter((conflict) => !draft.conflicts.some((old) => old.id === conflict.id)).length,
    omitted,
    suggestions,
    retired,
  };
}

export function resolveConflict(
  draft: PersonalBookDraft,
  conflictId: string,
  choice: 'keep' | 'accept',
): PersonalBookDraft {
  const conflict = draft.conflicts.find((candidate) => candidate.id === conflictId);
  if (!conflict) return draft;
  const conflicts = draft.conflicts.filter((candidate) => candidate.id !== conflictId);
  if (choice === 'keep') return next(draft, { conflicts });
  // "accept" = accept what the corrected transcript says: the stale detail goes, as a parent removal.
  if (conflict.field === 'stale_fact') return next(removeFact(draft, conflict.factId), { conflicts });
  if (conflict.field === 'stale_place') {
    const cleared = commitStoryPlace(draft, '');
    return next(cleared, { conflicts: cleared.conflicts.filter((candidate) => candidate.id !== conflictId) });
  }
  if (conflict.field === 'name') {
    return next(draft, { child: { ...draft.child, name: String(conflict.proposed) }, conflicts });
  }
  if (conflict.field === 'age') {
    return next(draft, { child: { ...draft.child, age: Number(conflict.proposed) }, conflicts });
  }
  const oldKey = draft.storyPlace ? comparableText(draft.storyPlace.value) : null;
  const placeTombstones =
    oldKey && !draft.placeTombstones.includes(oldKey) ? [...draft.placeTombstones, oldKey] : draft.placeTombstones;
  return next(draft, {
    storyPlace: {
      value: String(conflict.proposed),
      source: conflict.source,
      status: 'included',
      jobId: conflict.jobId,
      revision: draft.revision + 1,
      parentOwned: true,
    },
    placeTombstones,
    conflicts,
  });
}

/**
 * "Continue with these details": approves exactly the shown list. Proposed items become
 * included, open conflicts keep the parent's existing value, and an unfinished job is abandoned
 * so a late result cannot change the book behind the parent's back.
 */
export function confirmFactsReview(draft: PersonalBookDraft): PersonalBookDraft {
  const revision = draft.revision + 1;
  return {
    ...draft,
    revision,
    facts: draft.facts.map((fact) => (fact.status === 'proposed' ? { ...fact, status: 'included', revision } : fact)),
    storyPlace:
      draft.storyPlace && draft.storyPlace.status === 'proposed'
        ? { ...draft.storyPlace, status: 'included', revision }
        : draft.storyPlace,
    conflicts: [],
    intake: draft.intake && draft.intake.status === 'processing' ? { ...draft.intake, status: 'abandoned' } : draft.intake,
    factsReviewedAtRevision: revision,
  };
}

// ── Reviewed request ───────────────────────────────────────────────────────

export type RequestIssueCode =
  | 'child_name_missing'
  | 'child_name_invalid'
  | 'child_age_missing'
  | 'child_address_missing'
  | 'facts_unreviewed'
  | 'companion_missing'
  | 'contract_violation';

export type RequestIssue = { code: RequestIssueCode; step: 1 | 2 | 3 | 5; detail?: string[] };

export function requestIssues(draft: PersonalBookDraft): RequestIssue[] {
  const issues: RequestIssue[] = [];
  const name = normalizeText(draft.child.name);
  if (!name) issues.push({ code: 'child_name_missing', step: 1 });
  else if (!isValidChildName(name)) issues.push({ code: 'child_name_invalid', step: 1 });
  if (draft.child.age === null) issues.push({ code: 'child_age_missing', step: 1 });
  if (draft.child.address === null) issues.push({ code: 'child_address_missing', step: 1 });
  if (
    draft.facts.some((fact) => fact.status === 'proposed') ||
    draft.storyPlace?.status === 'proposed' ||
    draft.conflicts.length > 0
  ) {
    issues.push({ code: 'facts_unreviewed', step: 2 });
  }
  if (!draft.companionId) issues.push({ code: 'companion_missing', step: 3 });
  return issues;
}

export type RequestBuildResult =
  | { ok: true; request: ReviewedPersonalBookRequest }
  | { ok: false; issues: RequestIssue[] };

/** Only reviewed (`included`) facts leave the browser; removed and unapproved ones never do. */
export function buildReviewedRequest(draft: PersonalBookDraft): RequestBuildResult {
  const issues = requestIssues(draft);
  if (issues.length > 0) return { ok: false, issues };
  const candidate = {
    kind: 'personal_book_request' as const,
    version: REVIEWED_PERSONAL_BOOK_REQUEST_VERSION,
    draftId: draft.draftId,
    draftRevision: draft.revision,
    child: {
      name: normalizeText(draft.child.name),
      age: draft.child.age,
      address: draft.child.address,
    },
    facts: includedFacts(draft).map((fact) => ({
      id: fact.id,
      kind: fact.kind,
      value: normalizeText(fact.value),
      source: fact.source,
    })),
    storyPlace:
      draft.storyPlace && draft.storyPlace.status === 'included'
        ? { value: normalizeText(draft.storyPlace.value), source: draft.storyPlace.source }
        : null,
    companion: { id: draft.companionId },
    intent: draft.intent,
    avoid: draft.avoid.map(normalizeText),
    appearance: { photo: draft.photo },
    bookOptions: { ...draft.bookOptions },
  };
  const parsed = reviewedPersonalBookRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: [
        {
          code: 'contract_violation',
          step: 5,
          detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
      ],
    };
  }
  return { ok: true, request: parsed.data };
}

export function requestContainsFixtureData(request: ReviewedPersonalBookRequest): boolean {
  return request.facts.some((fact) => fact.source === 'fixture') || request.storyPlace?.source === 'fixture';
}

// ── Summary (derived from the request, so it shows exactly what the request carries) ──

export type FactGroupId = 'interests' | 'places' | 'habits' | 'more';

export const FACT_GROUP_OF_KIND: Record<FactKind, FactGroupId> = {
  interest: 'interests',
  favorite_place: 'places',
  residence: 'places',
  habit: 'habits',
  recent_event: 'more',
  family: 'more',
  other: 'more',
};

export const FACT_GROUP_ORDER: readonly FactGroupId[] = ['interests', 'places', 'habits', 'more'];

export type SummaryModel = {
  child: ReviewedPersonalBookRequest['child'];
  storyPlace: ReviewedPersonalBookRequest['storyPlace'];
  factGroups: Array<{ group: FactGroupId; facts: ReviewedPersonalBookRequest['facts'] }>;
  companionId: string;
  intent: ReviewedPersonalBookRequest['intent'];
  avoid: string[];
  photo: ReviewedPersonalBookRequest['appearance']['photo'];
  packageId: string | null;
  voiceId: string | null;
  containsFixtureData: boolean;
};

export function summarizeRequest(request: ReviewedPersonalBookRequest): SummaryModel {
  return {
    child: request.child,
    storyPlace: request.storyPlace,
    factGroups: FACT_GROUP_ORDER.map((group) => ({
      group,
      facts: request.facts.filter((fact) => FACT_GROUP_OF_KIND[fact.kind] === group),
    })).filter((entry) => entry.facts.length > 0),
    companionId: request.companion.id,
    intent: request.intent,
    avoid: request.avoid,
    photo: request.appearance.photo,
    packageId: request.bookOptions.packageId,
    voiceId: request.bookOptions.voiceId,
    containsFixtureData: requestContainsFixtureData(request),
  };
}
