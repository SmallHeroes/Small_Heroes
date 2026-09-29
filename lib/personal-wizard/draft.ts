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
 * - a recording may fill the child's EMPTY name or age with a suggestion (voice-first entry); a
 *   filled one is never overwritten, only questioned;
 * - the companion is never chosen on the parent's behalf; an explicit topic stays a suggestion until
 *   the parent approves the shown list (it is part of that list) or picks it;
 * - the five must-haves (name, age, where the child lives, what they love, what is hard) are asked
 *   when missing; the grammatical address and the residence may be heard like the name and age;
 * - what is hard suggests the story's direction unless the parent asked for one (Guy 2026-09-29);
 *   the suggestion stands on the exact difficulties it came from: withdrawn when one of them is
 *   removed or changed before approval, questioned when that happens after approval (Codex P1-1);
 * - a parent's correction or removal wins: an incoming detail that reads like a removed one is
 *   asked about, never silently re-added (owner addendum 2026-09-29).
 */
import {
  LIMITS,
  PERSONAL_BOOK_DRAFT_VERSION,
  PROTOTYPE_AGE_MAX,
  PROTOTYPE_AGE_MIN,
  REVIEWED_PERSONAL_BOOK_REQUEST_VERSION,
  comparableText,
  factCeiling,
  factCeilingGroup,
  isValidChildName,
  similarDetails,
  normalizeText,
  reviewedPersonalBookRequestSchema,
  type Conflict,
  type ConflictField,
  type CoreValueSource,
  type DirectionEvidence,
  type Fact,
  type FactKind,
  type GrammaticalAddress,
  type IntakeMedium,
  type IntakeResult,
  type Intent,
  type IntentSuggestion,
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
    child: {
      name: '',
      age: null,
      address: null,
      residence: '',
      nameSource: 'typed',
      ageSource: 'typed',
      addressSource: 'typed',
      residenceSource: 'typed',
      nameJobId: null,
      ageJobId: null,
      addressJobId: null,
      residenceJobId: null,
    },
    facts: [],
    noDifficulty: false,
    storyPlace: null,
    placeTombstones: [],
    companionId: null,
    intent: null,
    intentEvidence: null,
    intentSuggestions: [],
    topicTombstones: [],
    avoid: [],
    photo: 'none',
    bookOptions: { lengthId: null, voiceId: null },
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
    child: { ...draft.child, name: raw.slice(0, LIMITS.nameMax + 10), nameSource: 'typed', nameJobId: null },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'name'),
  });
}

/** Normalizes the name for the request without changing where it came from. */
export function commitChildName(draft: PersonalBookDraft): PersonalBookDraft {
  const normalized = normalizeText(draft.child.name);
  if (normalized === draft.child.name) return draft;
  return next(draft, { child: { ...draft.child, name: normalized } });
}

export function setChildAge(draft: PersonalBookDraft, age: number | null): PersonalBookDraft {
  const valid = age === null || (Number.isInteger(age) && age >= PROTOTYPE_AGE_MIN && age <= PROTOTYPE_AGE_MAX);
  if (!valid) return draft;
  return next(draft, {
    child: { ...draft.child, age, ageSource: 'typed', ageJobId: null },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'age'),
  });
}

/** The parent's own choice; a different address heard later is only asked about. */
export function setChildAddress(draft: PersonalBookDraft, address: GrammaticalAddress): PersonalBookDraft {
  return next(draft, {
    child: { ...draft.child, address, addressSource: 'typed', addressJobId: null },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'address'),
  });
}

/** Where the child lives. Raw input is kept while typing, like the name. */
export function setChildResidence(draft: PersonalBookDraft, raw: string): PersonalBookDraft {
  return next(draft, {
    child: { ...draft.child, residence: raw.slice(0, LIMITS.placeMax + 10), residenceSource: 'typed', residenceJobId: null },
    conflicts: draft.conflicts.filter((conflict) => conflict.field !== 'residence'),
  });
}

/** Normalizes the residence for the request without changing where it came from. */
export function commitChildResidence(draft: PersonalBookDraft): PersonalBookDraft {
  const normalized = normalizeText(normalizeText(draft.child.residence).slice(0, LIMITS.placeMax));
  if (normalized === draft.child.residence) return draft;
  return next(draft, { child: { ...draft.child, residence: normalized } });
}

// ── Facts ───────────────────────────────────────────────────────────────────

export type ChipDefinition = { id: string; label: string; kind: FactKind };

export type FactOutcome = 'added' | 'restored' | 'adopted' | 'duplicate' | 'limit' | 'empty' | 'too_long';

function factKeys(fact: Fact): string[] {
  return [comparableText(fact.value), ...fact.previousKeys];
}

/** True when the group this kind counts against is full (removed facts do not count). */
function atCeiling(facts: readonly Fact[], kind: FactKind): boolean {
  const group = factCeilingGroup(kind);
  return facts.filter((fact) => fact.status !== 'removed' && factCeilingGroup(fact.kind) === group).length >= factCeiling(group);
}

const hasActiveDifficulty = (facts: readonly Fact[]) =>
  facts.some((fact) => fact.kind === 'difficulty' && fact.status !== 'removed');

/** A difficulty answers "what is hard": the parent's earlier "nothing special" no longer holds. */
function afterFactAdded(draft: PersonalBookDraft, kind: FactKind): PersonalBookDraft {
  return kind === 'difficulty' && draft.noDifficulty ? { ...draft, noDifficulty: false } : draft;
}

/** Each fact is still listed, with the value it had when the direction was derived from it. */
function evidenceHolds(facts: readonly Fact[], evidence: DirectionEvidence | null | undefined): boolean {
  if (!evidence || evidence.length === 0) return false;
  return evidence.every(({ factId, key }) => {
    const fact = facts.find((candidate) => candidate.id === factId);
    return fact !== undefined && fact.status !== 'removed' && comparableText(fact.value) === key;
  });
}

/**
 * After a difficulty is removed or changed (Codex P1-1). A pending direction derived from it is
 * withdrawn: not declined, so said again it may be proposed again. An approved one becomes an explicit
 * keep-or-remove question; nothing guesses a replacement topic. A direction the parent asked for, or
 * chose, does not stand on a difficulty and is untouched.
 */
function reconcileDerivedDirections(draft: PersonalBookDraft, makeId: IdFactory): PersonalBookDraft {
  const intentSuggestions = draft.intentSuggestions.filter(
    (item) => item.reason !== 'hard' || evidenceHolds(draft.facts, item.evidence),
  );
  let conflicts = draft.conflicts;
  let intentEvidence = draft.intentEvidence;
  if (intentEvidence && !evidenceHolds(draft.facts, intentEvidence)) {
    if (draft.intent?.kind === 'topic' && !conflicts.some((conflict) => conflict.field === 'stale_direction')) {
      conflicts = [
        ...conflicts,
        { id: makeId('c'), field: 'stale_direction', topicId: draft.intent.topicId, jobId: null, source: draft.intent.suggestedBy ?? 'chip' },
      ];
    }
    intentEvidence = null;
  }
  if (
    intentSuggestions.length === draft.intentSuggestions.length &&
    conflicts === draft.conflicts &&
    intentEvidence === draft.intentEvidence
  ) {
    return draft;
  }
  return { ...draft, intentSuggestions, conflicts, intentEvidence };
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
      draft: afterFactAdded(
        replaceFact(draft, { ...existing, status: 'included', parentOwned: true, revision: draft.revision + 1 }),
        existing.kind,
      ),
      outcome: 'adopted',
    };
  }
  if (atCeiling(draft.facts, kind)) return { draft, outcome: 'limit' };
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
    return { draft: afterFactAdded(replaceFact(draft, restored), kind), outcome: 'restored' };
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
  return { draft: afterFactAdded(next(draft, { facts: [...draft.facts, fact] }), kind), outcome: 'added' };
}

/** Pressing a chip adds its fact; pressing it again removes it. A renamed chip value stays one fact. */
export function toggleChip(
  draft: PersonalBookDraft,
  chip: ChipDefinition,
  makeId: IdFactory,
): { draft: PersonalBookDraft; outcome: FactOutcome | 'removed' } {
  const linked = draft.facts.find((fact) => fact.chipId === chip.id);
  if (linked && linked.status !== 'removed') {
    return { draft: removeFact(draft, linked.id, makeId), outcome: 'removed' };
  }
  const key = comparableText(chip.label);
  const sameValue = draft.facts.find((fact) => fact.id !== linked?.id && factKeys(fact).includes(key));
  if (sameValue && sameValue.status !== 'removed') {
    // The detail already exists (typed or proposed); link the chip to it instead of duplicating.
    return {
      draft: afterFactAdded(
        replaceFact(draft, { ...sameValue, chipId: chip.id, status: 'included', parentOwned: true, revision: draft.revision + 1 }),
        sameValue.kind,
      ),
      outcome: 'adopted',
    };
  }
  if (atCeiling(draft.facts, chip.kind)) return { draft, outcome: 'limit' };
  const restoreTarget = linked ?? sameValue;
  if (restoreTarget) {
    const previousKeys = comparableText(restoreTarget.value) === key
      ? restoreTarget.previousKeys
      : [...restoreTarget.previousKeys, comparableText(restoreTarget.value)];
    return {
      draft: afterFactAdded(
        replaceFact(draft, {
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
        chip.kind,
      ),
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
  return { draft: afterFactAdded(next(draft, { facts: [...draft.facts, fact] }), chip.kind), outcome: 'added' };
}

export type HardChipDefinition = { id: string; label: string; topicId: string };

/**
 * "What is hard" chips name a topic. Picking one adds the difficulty and, while no direction is
 * chosen or pending, proposes that topic as the story's direction (Guy 2026-09-29): shown with the
 * details and approved with them. A topic the parent removed is not proposed again. Unpicking the
 * chip withdraws its proposal.
 */
export function toggleHardChip(
  draft: PersonalBookDraft,
  chip: HardChipDefinition,
  makeId: IdFactory,
): { draft: PersonalBookDraft; outcome: FactOutcome | 'removed' } {
  // Unpicking removes the chip's fact, and with it (see removeFact) the proposal that stood on it.
  const toggled = toggleChip(draft, { id: chip.id, label: chip.label, kind: 'difficulty' }, makeId);
  const after = toggled.draft;
  if (toggled.outcome !== 'added' && toggled.outcome !== 'restored' && toggled.outcome !== 'adopted') return toggled;
  if (after.intent !== null || after.intentSuggestions.length > 0 || after.topicTombstones.includes(chip.topicId)) {
    return toggled;
  }
  const fact = after.facts.find((candidate) => candidate.chipId === chip.id && candidate.status !== 'removed');
  if (!fact) return toggled;
  const suggestion: IntentSuggestion = {
    topicId: chip.topicId,
    jobId: null,
    source: 'chip',
    reason: 'hard',
    evidence: [{ factId: fact.id, key: comparableText(fact.value) }],
  };
  return { draft: { ...after, intentSuggestions: [suggestion] }, outcome: toggled.outcome };
}

/** "Nothing special": answers the must-have without a difficulty. Only while none is listed. */
export function setNoDifficulty(draft: PersonalBookDraft, value: boolean): PersonalBookDraft {
  if (draft.noDifficulty === value) return draft;
  if (value && hasActiveDifficulty(draft.facts)) return draft;
  return next(draft, { noDifficulty: value });
}

export type EditOutcome = 'saved' | 'unchanged' | 'empty' | 'too_long' | 'duplicate' | 'missing';

/**
 * A parent's correction: the new wording is the parent's own ('typed'), the old one can never be
 * proposed again, and a direction derived from the old wording no longer stands (Codex P1-1).
 */
export function editFactValue(
  draft: PersonalBookDraft,
  factId: string,
  rawValue: string,
  makeId: IdFactory = randomId,
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
  const edited = replaceFact(draft, {
    ...fact,
    value,
    source: 'typed',
    status: 'included',
    parentOwned: true,
    revision: draft.revision + 1,
    previousKeys,
  });
  return { draft: fact.kind === 'difficulty' ? reconcileDerivedDirections(edited, makeId) : edited, outcome: 'saved' };
}

/**
 * A parent's exclusion: the detail stays out, even if it was heard correctly, and nothing brings it
 * back silently. Typing or picking it again deliberately restores it.
 */
export function removeFact(draft: PersonalBookDraft, factId: string, makeId: IdFactory = randomId): PersonalBookDraft {
  const fact = draft.facts.find((candidate) => candidate.id === factId);
  if (!fact || fact.status === 'removed') return draft;
  const removed = replaceFact(draft, { ...fact, status: 'removed', revision: draft.revision + 1 });
  return fact.kind === 'difficulty' ? reconcileDerivedDirections(removed, makeId) : removed;
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

const withTombstone = (tombstones: readonly string[], topicId: string): string[] =>
  tombstones.includes(topicId) ? [...tombstones] : [...tombstones, topicId];

/**
 * Choosing a topic that is currently suggested (from the suggestion card or from the list) adopts the
 * suggestion: the choice keeps its origin and the suggestion is settled. Any other choice is the
 * parent's own, without an origin.
 *
 * Removal is durable, like removed places and facts: moving away from a direction that came from a
 * recording or the example (clearing it, or choosing something else) remembers that topic, so a later
 * correction cannot bring it back. Deliberately picking a topic lifts its tombstone.
 */
export function setIntent(draft: PersonalBookDraft, intent: Intent | null): PersonalBookDraft {
  const current = draft.intent;
  let topicTombstones = draft.topicTombstones;
  let intentSuggestions = draft.intentSuggestions;
  let chosen = intent;
  let intentEvidence: DirectionEvidence | null = null;
  const keepsCurrent = intent?.kind === 'topic' && current?.kind === 'topic' && intent.topicId === current.topicId;
  // Choosing the direction that is already chosen changes nothing (and never drops its origin).
  if (keepsCurrent) return draft;
  if (current?.kind === 'topic' && current.suggestedBy) {
    topicTombstones = withTombstone(topicTombstones, current.topicId);
  }
  if (intent?.kind === 'topic') {
    topicTombstones = topicTombstones.filter((topicId) => topicId !== intent.topicId);
    const suggestion = intentSuggestions.find((item) => item.topicId === intent.topicId);
    if (suggestion) {
      const origin = intent.suggestedBy ?? suggestionOrigin(suggestion);
      chosen = origin ? { kind: 'topic', topicId: intent.topicId, suggestedBy: origin } : { kind: 'topic', topicId: intent.topicId };
      intentSuggestions = intentSuggestions.filter((item) => item.topicId !== intent.topicId);
      // Adopting a derived proposal keeps what it stands on; a stale one is adopted as a plain choice.
      if (suggestion.reason === 'hard' && evidenceHolds(draft.facts, suggestion.evidence)) {
        intentEvidence = suggestion.evidence ?? null;
      }
    }
  }
  // An explicit choice settles any open question about the previous direction.
  const conflicts = draft.conflicts.filter((conflict) => conflict.field !== 'stale_direction');
  return next(draft, { intent: chosen, intentEvidence, intentSuggestions, topicTombstones, conflicts });
}

/** A suggestion adopted from what the parent told us keeps that origin; their own chip has none. */
function suggestionOrigin(suggestion: IntentSuggestion): 'transcript' | 'fixture' | undefined {
  return suggestion.source === 'chip' ? undefined : suggestion.source;
}

/** The parent declines a suggested topic: it leaves the list and later extractions do not re-suggest it. */
export function dismissIntentSuggestion(draft: PersonalBookDraft, topicId: string): PersonalBookDraft {
  return next(draft, {
    intentSuggestions: draft.intentSuggestions.filter((item) => item.topicId !== topicId),
    topicTombstones: withTombstone(draft.topicTombstones, topicId),
  });
}

export function setPhotoChoice(draft: PersonalBookDraft, photo: PhotoChoice): PersonalBookDraft {
  if (draft.photo === photo) return draft;
  return next(draft, { photo });
}

export function setLength(draft: PersonalBookDraft, lengthId: string | null): PersonalBookDraft {
  return next(draft, { bookOptions: { ...draft.bookOptions, lengthId } });
}

export function setVoice(draft: PersonalBookDraft, voiceId: string | null): PersonalBookDraft {
  return next(draft, { bookOptions: { ...draft.bookOptions, voiceId } });
}

// ── Intake jobs and merge ──────────────────────────────────────────────────

export function startIntakeJob(
  draft: PersonalBookDraft,
  jobId: string,
  source: 'transcript' | 'fixture',
  options: { supersedesJobId?: string; medium?: IntakeMedium } = {},
): PersonalBookDraft {
  // One job at a time: a newer job supersedes (abandons) any unfinished one.
  return {
    ...draft,
    intake: {
      jobId,
      basedOnRevision: draft.revision,
      source,
      medium: options.medium ?? 'voice',
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

// ── The child's basics as one kind of value ──────────────────────────────────

/** The single-valued basics a recording may propose: filled when empty, otherwise only asked. */
type CoreKey = 'name' | 'age' | 'address' | 'residence';
type CoreValue = string | number;
type Child = PersonalBookDraft['child'];

const CORE_KEYS: readonly CoreKey[] = ['name', 'age', 'address', 'residence'];

function coreOf(child: Child, key: CoreKey): { value: CoreValue | null; source: CoreValueSource; jobId: string | null } {
  switch (key) {
    case 'name':
      return { value: normalizeText(child.name) || null, source: child.nameSource, jobId: child.nameJobId };
    case 'age':
      return { value: child.age, source: child.ageSource, jobId: child.ageJobId };
    case 'address':
      return { value: child.address, source: child.addressSource, jobId: child.addressJobId };
    case 'residence':
      return { value: normalizeText(child.residence) || null, source: child.residenceSource, jobId: child.residenceJobId };
  }
}

function withCore(child: Child, key: CoreKey, value: CoreValue | null, source: CoreValueSource, jobId: string | null): Child {
  switch (key) {
    case 'name':
      return { ...child, name: value === null ? '' : String(value), nameSource: source, nameJobId: jobId };
    case 'age':
      return { ...child, age: value === null ? null : Number(value), ageSource: source, ageJobId: jobId };
    case 'address':
      return { ...child, address: value as GrammaticalAddress | null, addressSource: source, addressJobId: jobId };
    case 'residence':
      return { ...child, residence: value === null ? '' : String(value), residenceSource: source, residenceJobId: jobId };
  }
}

function withCoreJob(child: Child, key: CoreKey, jobId: string): Child {
  switch (key) {
    case 'name':
      return { ...child, nameJobId: jobId };
    case 'age':
      return { ...child, ageJobId: jobId };
    case 'address':
      return { ...child, addressJobId: jobId };
    case 'residence':
      return { ...child, residenceJobId: jobId };
  }
}

const sameCore = (key: CoreKey, left: CoreValue, right: CoreValue): boolean =>
  key === 'name' || key === 'residence' ? comparableText(String(left)) === comparableText(String(right)) : left === right;

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
    transcript: result.transcript
      ? { jobId: job.jobId, text: result.transcript, source: result.source, medium: job.medium }
      : draft.transcript,
  };
  // Ownership follows the transcript on screen: once the correction is the transcript shown, whatever
  // the corrected job S still owns moves to it, so the next correction corrects it in turn (a chain).
  const superseded = job.supersedesJobId;
  const movesToCorrection = (jobId: string | null | undefined) =>
    Boolean(superseded) && jobId === superseded && base.transcript?.jobId === job.jobId;
  const takeOver = <T extends { jobId?: string | null }>(item: T): T =>
    movesToCorrection(item.jobId) ? { ...item, jobId: job.jobId } : item;
  if (!extraction.understood) {
    // An unclear correction changes nothing: the earlier transcript's details stay as they were.
    let child = base.child;
    for (const key of CORE_KEYS) {
      if (movesToCorrection(coreOf(child, key).jobId)) child = withCoreJob(child, key, job.jobId);
    }
    const unchanged: PersonalBookDraft = {
      ...base,
      child,
      facts: base.facts.map(takeOver),
      storyPlace: base.storyPlace && takeOver(base.storyPlace),
      conflicts: base.conflicts.map(takeOver),
      intentSuggestions: base.intentSuggestions.map(takeOver),
    };
    return { applied: true, draft: unchanged, understood: false, added: 0, conflicts: 0, omitted: 0, suggestions: 0, retired: 0 };
  }

  let added = 0;
  let omitted = 0;
  let retired = 0;
  let facts = [...draft.facts];
  let storyPlace = draft.storyPlace;
  let conflicts: Conflict[] = [...draft.conflicts];
  let intentSuggestions = [...draft.intentSuggestions];
  let noDifficulty = draft.noDifficulty;

  /*
   * A corrected transcript REPLACES the transcript it corrects (job S). Details proposed by S:
   * - still present in the correction: kept as they are (same id, same status);
   * - removed by the parent: stay removed (tombstone), whatever the correction says;
   * - parent-owned (typed, chipped, edited): kept; the parent's own statement is not the model's;
   * - only proposed (never approved): retired, so they cannot accumulate next to the correction;
   * - already approved via "continue": kept, with an explicit keep-or-remove question.
   * Questions and topic suggestions raised by S are obsolete and dropped. What S kept now belongs to
   * the correction (see takeOver), so a later correction asks again about anything it still lacks.
   * Other recordings, typed and chip details are untouched.
   */
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
    facts = facts.map(takeOver);
    storyPlace = storyPlace && takeOver(storyPlace);
  }

  /*
   * Each group has its own ceiling, so a long list of one kind can never push out another (F1). The
   * parent's decisions win (owner addendum): an exact repeat of a removed or replaced wording is
   * omitted; a detail that reads like one the parent removed is only ASKED about; one that reads like a
   * detail already listed is the same detail and is omitted.
   */
  const seen = new Set<string>();
  for (const proposal of extraction.facts) {
    const key = comparableText(proposal.value);
    if (!key || seen.has(key) || facts.some((fact) => factKeys(fact).includes(key)) || atCeiling(facts, proposal.kind)) {
      omitted += 1;
      continue;
    }
    seen.add(key);
    const group = factCeilingGroup(proposal.kind);
    const sameGroup = facts.filter((fact) => factCeilingGroup(fact.kind) === group);
    const removedLike = sameGroup.find((fact) => fact.status === 'removed' && similarDetails(fact.value, proposal.value));
    if (removedLike) {
      if (!conflicts.some((conflict) => conflict.field === 'similar_removed' && comparableText(conflict.value) === key)) {
        conflicts.push({
          id: context.makeId('c'),
          field: 'similar_removed',
          kind: proposal.kind,
          value: proposal.value,
          removedValue: removedLike.value,
          jobId: job.jobId,
          source: result.source,
        });
      }
      continue;
    }
    if (sameGroup.some((fact) => fact.status !== 'removed' && similarDetails(fact.value, proposal.value))) {
      omitted += 1;
      continue;
    }
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
    // A difficulty heard now answers "what is hard" in place of an earlier "nothing special".
    if (proposal.kind === 'difficulty') noDifficulty = false;
  }

  const pushConflict = (field: ConflictField, proposed: string | number) => {
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

  /*
   * The child's basics (name, age, grammatical address, residence). A recording may fill an EMPTY
   * basic with a suggestion that awaits the parent's "continue" (voice-first entry); a filled one is
   * never overwritten, only questioned. A correction replaces or retires the unapproved suggestion of
   * the transcript it corrects, like any other detail of that transcript; an approved or typed value
   * is only ever questioned.
   */
  const heard: Record<CoreKey, CoreValue | null> = {
    name: extraction.mentionedName && isValidChildName(extraction.mentionedName) ? extraction.mentionedName : null,
    age:
      extraction.mentionedAge !== null &&
      extraction.mentionedAge >= PROTOTYPE_AGE_MIN &&
      extraction.mentionedAge <= PROTOTYPE_AGE_MAX
        ? extraction.mentionedAge
        : null,
    address: extraction.mentionedAddress,
    residence: extraction.residence ? normalizeText(extraction.residence) || null : null,
  };
  let child = draft.child;
  for (const key of CORE_KEYS) {
    const current = coreOf(child, key);
    const value = heard[key];
    if (superseded && current.jobId === superseded) {
      if (value !== null && current.value !== null && sameCore(key, value, current.value)) {
        if (movesToCorrection(current.jobId)) child = withCoreJob(child, key, job.jobId);
      } else {
        retired += 1;
        if (value !== null) {
          child = withCore(child, key, value, result.source, job.jobId);
          added += 1;
        } else {
          child = withCore(child, key, null, 'typed', null);
        }
      }
    } else if (value !== null) {
      if (current.value === null) {
        child = withCore(child, key, value, result.source, job.jobId);
        added += 1;
      } else if (!sameCore(key, value, current.value)) {
        pushConflict(key, value);
      }
    }
  }

  let suggestions = 0;
  const proposeTopic = (topicId: string | null, reason: IntentSuggestion['reason'], evidence?: DirectionEvidence) => {
    if (
      topicId &&
      context.allowedTopicIds.has(topicId) &&
      !draft.topicTombstones.includes(topicId) &&
      !(draft.intent?.kind === 'topic' && draft.intent.topicId === topicId) &&
      !intentSuggestions.some((item) => item.topicId === topicId)
    ) {
      intentSuggestions.push({ topicId, jobId: job.jobId, source: result.source, reason, ...(evidence ? { evidence } : {}) });
      suggestions += 1;
    }
  };
  proposeTopic(extraction.explicitTopicId, 'asked');
  /*
   * What is hard becomes the direction unless the parent asked for one (Guy 2026-09-29). The model
   * matched the topic against ALL the difficulties it heard, so the proposal needs every one of them
   * listed now with exactly that wording: if the parent removed or reworded any, or one was not taken
   * in, nothing is proposed rather than a topic standing on excluded content (Codex P1-1).
   */
  if (!extraction.explicitTopicId && extraction.hardTopicId) {
    const heardDifficulties = extraction.facts.filter((fact) => fact.kind === 'difficulty');
    const evidence: Array<{ factId: string; key: string }> = [];
    const complete = heardDifficulties.length > 0 && heardDifficulties.every((heardFact) => {
      const heardKey = comparableText(heardFact.value);
      const listed = facts.find(
        (fact) => fact.kind === 'difficulty' && fact.status !== 'removed' && comparableText(fact.value) === heardKey,
      );
      if (listed && !evidence.some((item) => item.factId === listed.id)) evidence.push({ factId: listed.id, key: heardKey });
      return Boolean(listed);
    });
    if (complete) proposeTopic(extraction.hardTopicId, 'hard', evidence);
  }

  // Anything this merge retired or replaced may have been what a direction stood on.
  const merged = reconcileDerivedDirections(
    { ...base, child, facts, noDifficulty, storyPlace, conflicts, intentSuggestions },
    context.makeId,
  );
  return {
    applied: true,
    draft: merged,
    understood: true,
    added,
    conflicts: conflicts.filter((conflict) => !draft.conflicts.some((old) => old.id === conflict.id)).length,
    omitted,
    suggestions,
    retired,
  };
}

/**
 * Answers one open question. Each branch builds on the state its helper returns and closes only the
 * answered question, so a question the helper raises is never overwritten by an older list.
 */
export function resolveConflict(
  draft: PersonalBookDraft,
  conflictId: string,
  choice: 'keep' | 'accept',
): PersonalBookDraft {
  const conflict = draft.conflicts.find((candidate) => candidate.id === conflictId);
  if (!conflict) return draft;
  const conflicts = draft.conflicts.filter((candidate) => candidate.id !== conflictId);
  // "keep" = keep what the list holds: the direction stays (now the parent's own), the removed detail stays out.
  if (choice === 'keep') return next(draft, { conflicts });
  if (conflict.field === 'stale_direction') {
    // "accept" = drop the direction whose basis the parent removed; the topic is then remembered as removed.
    const cleared = setIntent(draft, null);
    return next(cleared, { conflicts: cleared.conflicts.filter((candidate) => candidate.id !== conflictId) });
  }
  if (conflict.field === 'similar_removed') {
    // "accept" = the parent asks to add it after all: their own explicit statement.
    if (atCeiling(draft.facts, conflict.kind)) return next(draft, { conflicts });
    const fact: Fact = {
      id: randomId('f'),
      kind: conflict.kind,
      value: conflict.value,
      source: conflict.source,
      status: 'included',
      jobId: conflict.jobId,
      revision: draft.revision + 1,
      previousKeys: [],
      parentOwned: true,
    };
    return afterFactAdded(next(draft, { facts: [...draft.facts, fact], conflicts }), conflict.kind);
  }
  if (conflict.field === 'stale_fact') {
    // "accept" = accept what the corrected transcript says: the stale detail goes, as a parent removal.
    // Built on what removeFact returns: a direction that stood on this detail raises its own question
    // there, and it must stay open (Codex re-gate, P1-1). Only the answered question closes.
    const removed = removeFact(draft, conflict.factId);
    return next(removed, { conflicts: removed.conflicts.filter((candidate) => candidate.id !== conflictId) });
  }
  if (conflict.field === 'stale_place') {
    const cleared = commitStoryPlace(draft, '');
    return next(cleared, { conflicts: cleared.conflicts.filter((candidate) => candidate.id !== conflictId) });
  }
  if (conflict.field === 'name' || conflict.field === 'age' || conflict.field === 'address' || conflict.field === 'residence') {
    // The heard value, accepted by the parent: approved, keeping where it came from.
    return next(draft, { child: withCore(draft.child, conflict.field, conflict.proposed, conflict.source, null), conflicts });
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
 * "These are the details, continue": approves exactly the shown list. Proposed items, and basics
 * heard in a recording, become approved; open conflicts keep the existing value; and an unfinished
 * job is abandoned so a late result cannot change the book behind the parent's back.
 *
 * A story direction is shown in that list (asked for, or proposed from what is hard), so a single
 * pending suggestion is approved with it and becomes the chosen direction, keeping its origin, unless
 * the parent already chose one. Two or more are left for the parent to pick. The companion is never
 * chosen.
 */
export function confirmFactsReview(draft: PersonalBookDraft): PersonalBookDraft {
  const revision = draft.revision + 1;
  // A derived proposal is approved only while everything it stands on is still listed as it was.
  const suggestions = draft.intentSuggestions.filter(
    (item) => item.reason !== 'hard' || evidenceHolds(draft.facts, item.evidence),
  );
  const adopted = draft.intent === null && suggestions.length === 1 ? suggestions[0] : null;
  const origin = adopted ? suggestionOrigin(adopted) : undefined;
  return {
    ...draft,
    revision,
    child: { ...draft.child, nameJobId: null, ageJobId: null, addressJobId: null, residenceJobId: null },
    intent: adopted
      ? origin
        ? { kind: 'topic', topicId: adopted.topicId, suggestedBy: origin }
        : { kind: 'topic', topicId: adopted.topicId }
      : draft.intent,
    intentEvidence: adopted ? (adopted.reason === 'hard' ? adopted.evidence ?? null : null) : draft.intentEvidence,
    intentSuggestions: adopted ? [] : suggestions,
    facts: draft.facts.map((fact) => (fact.status === 'proposed' ? { ...fact, status: 'included', revision } : fact)),
    storyPlace:
      draft.storyPlace && draft.storyPlace.status === 'proposed'
        ? { ...draft.storyPlace, status: 'included', revision }
        : draft.storyPlace,
    // Unanswered questions keep what the list holds (a detail like a removed one stays out), except a
    // direction whose basis was removed: that needs the parent's explicit answer.
    conflicts: draft.conflicts.filter((conflict) => conflict.field === 'stale_direction'),
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
  | 'child_residence_missing'
  | 'loves_missing'
  | 'hard_missing'
  | 'direction_unconfirmed'
  | 'facts_unreviewed'
  | 'companion_missing'
  | 'contract_violation';

/** Steps: 1 = tell us about the child (voice or manual), 2 = companion and direction, 4 = summary. */
export type RequestIssue = { code: RequestIssueCode; step: 1 | 2 | 4; detail?: string[] };

/** In the order the card asks them: name, age, address, residence, loves, what is hard. */
export function requestIssues(draft: PersonalBookDraft): RequestIssue[] {
  const issues: RequestIssue[] = [];
  const name = normalizeText(draft.child.name);
  if (!name) issues.push({ code: 'child_name_missing', step: 1 });
  else if (!isValidChildName(name)) issues.push({ code: 'child_name_invalid', step: 1 });
  if (draft.child.age === null) issues.push({ code: 'child_age_missing', step: 1 });
  if (draft.child.address === null) issues.push({ code: 'child_address_missing', step: 1 });
  if (!normalizeText(draft.child.residence)) issues.push({ code: 'child_residence_missing', step: 1 });
  const facts = activeFacts(draft);
  if (!facts.some((fact) => fact.kind === 'interest')) issues.push({ code: 'loves_missing', step: 1 });
  if (!draft.noDifficulty && !facts.some((fact) => fact.kind === 'difficulty')) issues.push({ code: 'hard_missing', step: 1 });
  if (draft.conflicts.some((conflict) => conflict.field === 'stale_direction')) issues.push({ code: 'direction_unconfirmed', step: 1 });
  if (
    draft.facts.some((fact) => fact.status === 'proposed') ||
    draft.storyPlace?.status === 'proposed' ||
    CORE_KEYS.some((key) => coreOf(draft.child, key).jobId !== null) ||
    draft.conflicts.length > 0
  ) {
    issues.push({ code: 'facts_unreviewed', step: 1 });
  }
  if (!draft.companionId) issues.push({ code: 'companion_missing', step: 2 });
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
      residence: normalizeText(normalizeText(draft.child.residence).slice(0, LIMITS.placeMax)),
      nameSource: draft.child.nameSource,
      ageSource: draft.child.ageSource,
      addressSource: draft.child.addressSource,
      residenceSource: draft.child.residenceSource,
    },
    facts: includedFacts(draft).map((fact) => ({
      id: fact.id,
      kind: fact.kind,
      value: normalizeText(fact.value),
      source: fact.source,
    })),
    noDifficulty: draft.noDifficulty,
    storyPlace:
      draft.storyPlace && draft.storyPlace.status === 'included'
        ? { value: normalizeText(draft.storyPlace.value), source: draft.storyPlace.source }
        : null,
    companion: { id: draft.companionId },
    // A direction derived from what is hard says so, and the server then requires a difficulty.
    intent:
      draft.intent?.kind === 'topic' && evidenceHolds(draft.facts, draft.intentEvidence)
        ? { ...draft.intent, basis: 'difficulty' as const }
        : draft.intent,
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
          step: 4,
          detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
      ],
    };
  }
  return { ok: true, request: parsed.data };
}

/** True when ANY surviving value came from the labelled example: facts, place, basics or topic. */
export function requestContainsFixtureData(request: ReviewedPersonalBookRequest): boolean {
  return (
    request.facts.some((fact) => fact.source === 'fixture') ||
    request.storyPlace?.source === 'fixture' ||
    request.child.nameSource === 'fixture' ||
    request.child.ageSource === 'fixture' ||
    request.child.addressSource === 'fixture' ||
    request.child.residenceSource === 'fixture' ||
    (request.intent?.kind === 'topic' && request.intent.suggestedBy === 'fixture')
  );
}

// ── Summary (derived from the request, so it shows exactly what the request carries) ──

/** loves and hard are must-haves; places, habits and more are the bonus details. */
export type FactGroupId = 'loves' | 'hard' | 'places' | 'habits' | 'more';

export const FACT_GROUP_OF_KIND: Record<FactKind, FactGroupId> = {
  interest: 'loves',
  difficulty: 'hard',
  favorite_place: 'places',
  habit: 'habits',
  recent_event: 'more',
  family: 'more',
  other: 'more',
};

export const FACT_GROUP_ORDER: readonly FactGroupId[] = ['loves', 'hard', 'places', 'habits', 'more'];
export const BONUS_GROUP_ORDER: readonly FactGroupId[] = ['places', 'habits', 'more'];

export type SummaryModel = {
  child: ReviewedPersonalBookRequest['child'];
  storyPlace: ReviewedPersonalBookRequest['storyPlace'];
  factGroups: Array<{ group: FactGroupId; facts: ReviewedPersonalBookRequest['facts'] }>;
  noDifficulty: boolean;
  companionId: string;
  intent: ReviewedPersonalBookRequest['intent'];
  avoid: string[];
  photo: ReviewedPersonalBookRequest['appearance']['photo'];
  lengthId: string | null;
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
    noDifficulty: request.noDifficulty,
    companionId: request.companion.id,
    intent: request.intent,
    avoid: request.avoid,
    photo: request.appearance.photo,
    lengthId: request.bookOptions.lengthId,
    voiceId: request.bookOptions.voiceId,
    containsFixtureData: requestContainsFixtureData(request),
  };
}
