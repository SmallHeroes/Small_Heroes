/**
 * Personal-book Wizard prototype: the ONE shared contract for voice, chips and typing.
 *
 * Isomorphic (browser + server). No fs, no server-only imports, no provider types.
 * The browser builds a `ReviewedPersonalBookRequest`; the server re-validates it with the
 * strict schema below and derives the content-bound identity itself. Nothing the browser
 * sends is authority: there are no approval, budget, key or runtime fields in the request,
 * and the strict schema rejects any that are added.
 *
 * Prototype scope (brief 2026-09-28): ages 3..8, grammatical address boy/girl only. This is
 * a reversible prototype assumption, not a change to the public Wizard's options.
 */
import { z } from 'zod';

/**
 * v3: a recording may propose the child's name and age while they are still empty (voice-first entry).
 * v4: a direction the parent removed is remembered (`topicTombstones`), like removed places and facts.
 * v5: the five must-haves (name, age, where the child lives, what they love, what is hard for them);
 *     a recording may also propose the grammatical address and the residence; book length tiers.
 */
export const PERSONAL_BOOK_DRAFT_VERSION = 'personal-book-draft/v5' as const;
/**
 * v2 carries the provenance of the child's name/age and of a suggested direction.
 * v3 carries the must-haves (residence, loves, what is hard or an explicit "nothing special") and a
 * length tier instead of a story type.
 */
export const REVIEWED_PERSONAL_BOOK_REQUEST_VERSION = 'reviewed-personal-book-request/v3' as const;
/** v2 gives the must-haves their own slots, so other details can never crowd them out. */
export const PERSONAL_INTAKE_EXTRACTION_VERSION = 'personal-intake-extraction/v2' as const;

export const PROTOTYPE_AGES = [3, 4, 5, 6, 7, 8] as const;
export const PROTOTYPE_AGE_MIN = 3;
export const PROTOTYPE_AGE_MAX = 8;

export const GRAMMATICAL_ADDRESSES = ['boy', 'girl'] as const;
export type GrammaticalAddress = (typeof GRAMMATICAL_ADDRESSES)[number];

export const LIMITS = {
  nameMax: 20,
  factValueMax: 80,
  /**
   * Story-bound facts, per group, so bonus details can never crowd out what the child loves or
   * what is hard for them (live trial F1). A few small details are enough; ceilings, not targets.
   */
  lovesMax: 6,
  hardMax: 4,
  bonusMax: 8,
  placeMax: 60,
  avoidItemMax: 60,
  avoidMax: 5,
  transcriptMax: 4000,
  /** Recording: engineering defaults for the prototype, not a product promise. */
  recordingMaxMs: 90_000,
  recordingWarnMs: 75_000,
  recordingMaxBytes: 3 * 1024 * 1024,
} as const;

/**
 * Fact kinds. Two are must-haves: `interest` (what the child loves) and `difficulty` (what is hard
 * for them, in the parent's words, never a diagnosis). The others are bonus details.
 *
 * Where the child lives is one of the child's basics (`child.residence`), asked like the name, not a
 * fact. `favorite_place` ("loves the sea") is never a residence, and the adventure's starting place is
 * a separate field (`storyPlace`).
 */
export const FACT_KINDS = ['interest', 'difficulty', 'favorite_place', 'habit', 'recent_event', 'family', 'other'] as const;
export type FactKind = (typeof FACT_KINDS)[number];
export const BONUS_FACT_KINDS = ['favorite_place', 'habit', 'recent_event', 'family', 'other'] as const;

/** Which ceiling a fact counts against. */
export type FactCeilingGroup = 'loves' | 'hard' | 'bonus';

export function factCeilingGroup(kind: FactKind): FactCeilingGroup {
  return kind === 'interest' ? 'loves' : kind === 'difficulty' ? 'hard' : 'bonus';
}

export function factCeiling(group: FactCeilingGroup): number {
  return group === 'loves' ? LIMITS.lovesMax : group === 'hard' ? LIMITS.hardMax : LIMITS.bonusMax;
}

/** All story-bound facts together. */
export const FACTS_MAX = LIMITS.lovesMax + LIMITS.hardMax + LIMITS.bonusMax;

/** Adds an issue for every group above its ceiling (shared by the request and extraction schemas). */
function checkFactCeilings(facts: ReadonlyArray<{ kind: FactKind }>, ctx: z.RefinementCtx): void {
  for (const group of ['loves', 'hard', 'bonus'] as const) {
    if (facts.filter((fact) => factCeilingGroup(fact.kind) === group).length > factCeiling(group)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts'], message: `too_many_${group}` });
    }
  }
}

/** Provenance, not proof of truth. `fixture` = a prepared example, never derived from the parent's audio. */
export const FACT_SOURCES = ['typed', 'chip', 'transcript', 'fixture'] as const;

/**
 * Where the child's name, age, grammatical address or residence came from. 'typed' = the parent
 * entered or chose it; 'transcript' or 'fixture' = the parent accepted a suggested value from what
 * they told us (recorded or written) or from the labelled example. Editing the field by hand is the
 * deliberate transition back to 'typed'.
 */
export const CORE_VALUE_SOURCES = ['typed', 'transcript', 'fixture'] as const;
export type CoreValueSource = (typeof CORE_VALUE_SOURCES)[number];
export type FactSource = (typeof FACT_SOURCES)[number];

/** proposed = extracted, awaiting the parent's "continue with these details"; removed = tombstone. */
export const FACT_STATUSES = ['proposed', 'included', 'removed'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

// ── Text hygiene ────────────────────────────────────────────────────────────

/** C0/C1 controls and bidi overrides/isolates: stripped so stored values cannot spoof display order. */
const CONTROL_OR_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;

export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(CONTROL_OR_BIDI, '').replace(/\s+/gu, ' ').trim();
}

/** Comparison key for de-duplication: ignores niqqud, quotes, punctuation, case and spacing. */
export function comparableText(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[֑-ׇ]/gu, '')
    .replace(/["'`׳״.,!?;:()\-־]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Letters (any script), combining marks, spaces, apostrophe/geresh, gershayim and hyphen/maqaf. */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’׳״"\-־]*$/u;

export function isValidChildName(value: string): boolean {
  const name = normalizeText(value);
  return name.length > 0 && name.length <= LIMITS.nameMax && NAME_PATTERN.test(name) && name === value;
}

const normalizedText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => value === normalizeText(value) && value.length > 0, {
      message: 'text_not_normalized',
    });

// ── Identifiers ─────────────────────────────────────────────────────────────

export const ID_PATTERNS = {
  draft: /^d_[a-z0-9]{8,32}$/,
  fact: /^f_[a-z0-9]{8,32}$/,
  job: /^j_[a-z0-9]{8,32}$/,
  conflict: /^c_[a-z0-9]{8,32}$/,
} as const;

/** Catalogue-style ids for companions, topics, voices and packages. */
const OPTION_ID = /^[a-z][a-z0-9_]{1,40}$/;

// ── Draft (browser memory only; never persisted by the prototype) ─────────

export type Fact = {
  id: string;
  kind: FactKind;
  value: string;
  source: FactSource;
  status: FactStatus;
  /** Chip-originated facts keep their chip link, so renaming a chip value never creates a second fact. */
  chipId?: string;
  /** Intake job that proposed it (transcript/fixture facts). */
  jobId?: string;
  /** Draft revision of the last change to this fact. */
  revision: number;
  /** Comparison keys of values this fact held before a parent edit; a later proposal of one never returns. */
  previousKeys: string[];
  /**
   * True once the parent stated the detail themselves: typed it, pressed its chip, edited it, or
   * adopted a proposal by typing it. Approving the shown list does not make a proposal parent-owned;
   * a corrected transcript may therefore retire or question it, but never a parent-owned detail.
   */
  parentOwned: boolean;
};

/** The adventure's starting place. A story choice, never an address or a residence fact. */
export type StoryPlace = {
  value: string;
  source: FactSource;
  status: 'proposed' | 'included';
  jobId?: string;
  revision: number;
  /** Typed by the parent, or chosen by the parent in a question; see `Fact.parentOwned`. */
  parentOwned: boolean;
};

export type ConflictField = 'name' | 'age' | 'address' | 'residence' | 'storyPlace';

/**
 * Questions shown next to the list; none of them overwrites anything by itself.
 * - name/age/address/residence/storyPlace: a suggestion that differs from the current value.
 * - stale_fact/stale_place: a corrected transcript no longer contains a detail the parent had already
 *   approved; the parent decides whether it stays.
 */
export type Conflict =
  | {
      id: string;
      field: ConflictField;
      proposed: string | number;
      jobId: string;
      source: 'transcript' | 'fixture';
    }
  | {
      id: string;
      field: 'stale_fact';
      factId: string;
      value: string;
      jobId: string;
      source: 'transcript' | 'fixture';
    }
  | {
      id: string;
      field: 'stale_place';
      value: string;
      jobId: string;
      source: 'transcript' | 'fixture';
    };

/**
 * `suggestedBy` records that a topic was chosen from a recording's or the example's suggestion, so
 * example-derived choices stay flagged as example data.
 */
export type Intent =
  | { kind: 'just_for_fun' }
  | { kind: 'topic'; topicId: string; suggestedBy?: 'transcript' | 'fixture' };

/**
 * A proposed direction, awaiting the parent's "continue". `reason`: 'asked' = the parent explicitly
 * asked for the topic; 'hard' = it matches what the parent said is hard for the child (Guy
 * 2026-09-29: what is hard becomes the story's direction unless the parent removes it). A 'chip'
 * suggestion comes from the parent's own "what is hard" chip and has no intake job.
 */
export type IntentSuggestion = {
  topicId: string;
  jobId: string | null;
  source: 'transcript' | 'fixture' | 'chip';
  reason: 'asked' | 'hard';
};

/** How the parent told us: a recording, or a written text. Display only; provenance is `source`. */
export type IntakeMedium = 'voice' | 'written';

export type IntakeJobState = {
  jobId: string;
  basedOnRevision: number;
  source: 'transcript' | 'fixture';
  medium: IntakeMedium;
  status: 'processing' | 'applied' | 'abandoned' | 'failed';
  /**
   * Set when the job re-organises a corrected transcript: the job whose transcript it replaces. Its
   * unapproved proposals are retired instead of left to accumulate next to the corrected ones.
   */
  supersedesJobId?: string;
};

export type TranscriptView = {
  jobId: string;
  text: string;
  source: 'transcript' | 'fixture';
  medium: IntakeMedium;
};

export type PhotoChoice = 'none' | 'local_preview_not_sent';

export type PersonalBookDraft = {
  version: typeof PERSONAL_BOOK_DRAFT_VERSION;
  draftId: string;
  /** Monotonic; every story-relevant change bumps it. Intake jobs bind to the revision they started from. */
  revision: number;
  child: {
    name: string;
    age: number | null;
    /**
     * Heard only from how the parent speaks about the child ("he is five", "she loves"), never from
     * the name or the voice (Guy 2026-09-29). Asked when not heard or when the forms are mixed.
     */
    address: GrammaticalAddress | null;
    /** Where the child lives, in the parent's words. Raw while typing; normalized for the request. */
    residence: string;
    nameSource: CoreValueSource;
    ageSource: CoreValueSource;
    addressSource: CoreValueSource;
    residenceSource: CoreValueSource;
    /**
     * The intake job whose suggestion filled an EMPTY basic and still awaits the parent's "continue"
     * (voice-first entry). null once the parent edits the value or approves the list, and always
     * for typed values. A correction of that job may replace or retire the suggestion.
     */
    nameJobId: string | null;
    ageJobId: string | null;
    addressJobId: string | null;
    residenceJobId: string | null;
  };
  facts: Fact[];
  /**
   * The parent said nothing is especially hard right now: the "what is hard" must-have is answered
   * without a difficulty, and the story is an adventure without a topic. Never set by an extraction.
   */
  noDifficulty: boolean;
  storyPlace: StoryPlace | null;
  /** Comparison keys of places the parent removed or replaced; a proposal of one is omitted. */
  placeTombstones: string[];
  companionId: string | null;
  intent: Intent | null;
  intentSuggestions: IntentSuggestion[];
  /**
   * Topic ids the parent removed: a declined suggestion, or a direction from a recording or the
   * example that the parent removed or replaced. A later extraction never suggests them again; the
   * parent picking one deliberately lifts it.
   */
  topicTombstones: string[];
  avoid: string[];
  photo: PhotoChoice;
  /**
   * Every book is an adventure with fantasy; the tiers differ only in length and plot depth (Guy
   * 2026-09-29). Prototype tiers; production pricing and the story bank are a separate decision.
   */
  bookOptions: { lengthId: string | null; voiceId: string | null };
  conflicts: Conflict[];
  /** Revision at which the parent pressed "continue with these details" (approves the shown list). */
  factsReviewedAtRevision: number | null;
  intake: IntakeJobState | null;
  transcript: TranscriptView | null;
};

// ── Reviewed request (what leaves the browser) ─────────────────────────────

const requestFactSchema = z
  .object({
    id: z.string().regex(ID_PATTERNS.fact),
    kind: z.enum(FACT_KINDS),
    value: normalizedText(LIMITS.factValueMax),
    source: z.enum(FACT_SOURCES),
  })
  .strict();

const requestIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('just_for_fun') }).strict(),
  z
    .object({
      kind: z.literal('topic'),
      topicId: z.string().regex(OPTION_ID),
      suggestedBy: z.enum(['transcript', 'fixture']).optional(),
    })
    .strict(),
]);

export const reviewedPersonalBookRequestSchema = z
  .object({
    kind: z.literal('personal_book_request'),
    version: z.literal(REVIEWED_PERSONAL_BOOK_REQUEST_VERSION),
    draftId: z.string().regex(ID_PATTERNS.draft),
    draftRevision: z.number().int().nonnegative(),
    child: z
      .object({
        name: z.string().refine(isValidChildName, { message: 'invalid_child_name' }),
        age: z.number().int().min(PROTOTYPE_AGE_MIN).max(PROTOTYPE_AGE_MAX),
        address: z.enum(GRAMMATICAL_ADDRESSES),
        residence: normalizedText(LIMITS.placeMax),
        nameSource: z.enum(CORE_VALUE_SOURCES),
        ageSource: z.enum(CORE_VALUE_SOURCES),
        addressSource: z.enum(CORE_VALUE_SOURCES),
        residenceSource: z.enum(CORE_VALUE_SOURCES),
      })
      .strict(),
    facts: z.array(requestFactSchema).max(FACTS_MAX),
    /** The parent answered "what is hard" with "nothing special": then no difficulty may be sent. */
    noDifficulty: z.boolean(),
    storyPlace: z
      .object({ value: normalizedText(LIMITS.placeMax), source: z.enum(FACT_SOURCES) })
      .strict()
      .nullable(),
    companion: z.object({ id: z.string().regex(OPTION_ID) }).strict(),
    /** null = no emotional direction. `just_for_fun` = the parent explicitly asked for none. */
    intent: requestIntentSchema.nullable(),
    avoid: z.array(normalizedText(LIMITS.avoidItemMax)).max(LIMITS.avoidMax),
    appearance: z.object({ photo: z.enum(['none', 'local_preview_not_sent']) }).strict(),
    bookOptions: z
      .object({
        lengthId: z.string().regex(OPTION_ID).nullable(),
        voiceId: z.string().regex(OPTION_ID).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((request, ctx) => {
    const ids = new Set<string>();
    const values = new Set<string>();
    request.facts.forEach((fact, index) => {
      if (ids.has(fact.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts', index, 'id'], message: 'duplicate_fact_id' });
      }
      ids.add(fact.id);
      const key = `${fact.kind}:${comparableText(fact.value)}`;
      if (values.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts', index, 'value'], message: 'duplicate_fact_value' });
      }
      values.add(key);
    });
    checkFactCeilings(request.facts, ctx);
    // The must-haves: at least one thing the child loves, and "what is hard" answered either way.
    if (!request.facts.some((fact) => fact.kind === 'interest')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts'], message: 'loves_missing' });
    }
    const difficulties = request.facts.filter((fact) => fact.kind === 'difficulty').length;
    if (request.noDifficulty && difficulties > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['noDifficulty'], message: 'no_difficulty_with_difficulties' });
    }
    if (!request.noDifficulty && difficulties === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['facts'], message: 'hard_missing' });
    }
  });

export type ReviewedPersonalBookRequest = z.infer<typeof reviewedPersonalBookRequestSchema>;

// ── Intake extraction (identical shape for the fixture and the live adapter) ─

export const EXTRACTABLE_FACT_KINDS = FACT_KINDS;

export const intakeExtractionSchema = z
  .object({
    version: z.literal(PERSONAL_INTAKE_EXTRACTION_VERSION),
    /** false = too little was understood; the UI says so and never guesses. */
    understood: z.boolean(),
    /** Must-haves first (loves, then what is hard), each group within its own ceiling. */
    facts: z
      .array(z.object({ kind: z.enum(EXTRACTABLE_FACT_KINDS), value: normalizedText(LIMITS.factValueMax) }).strict())
      .max(FACTS_MAX),
    storyPlace: normalizedText(LIMITS.placeMax).nullable(),
    /** Only when explicitly said; used for conflict prompts, never to overwrite. */
    mentionedName: normalizedText(LIMITS.nameMax).nullable(),
    mentionedAge: z.number().int().min(0).max(18).nullable(),
    /** Only from how the parent refers to the child; never from the name or the voice. */
    mentionedAddress: z.enum(GRAMMATICAL_ADDRESSES).nullable(),
    /** Only when the parent said where the child lives. Not the adventure's starting place. */
    residence: normalizedText(LIMITS.placeMax).nullable(),
    /** Only an explicitly requested direction. */
    explicitTopicId: z.string().regex(OPTION_ID).nullable(),
    /** The allowed topic that best matches what is hard for the child; null without a difficulty. */
    hardTopicId: z.string().regex(OPTION_ID).nullable(),
  })
  .strict()
  .superRefine((extraction, ctx) => {
    checkFactCeilings(extraction.facts, ctx);
    if (extraction.hardTopicId !== null && !extraction.facts.some((fact) => fact.kind === 'difficulty')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hardTopicId'], message: 'hard_topic_without_difficulty' });
    }
  });

export type IntakeExtraction = z.infer<typeof intakeExtractionSchema>;

export const intakeResultSchema = z
  .object({
    jobId: z.string().regex(ID_PATTERNS.job),
    source: z.enum(['transcript', 'fixture']),
    transcript: z.string().max(LIMITS.transcriptMax).nullable(),
    extraction: intakeExtractionSchema,
  })
  .strict();

export type IntakeResult = z.infer<typeof intakeResultSchema>;
