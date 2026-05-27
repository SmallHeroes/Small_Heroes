/**
 * Production Recipe — type contract.
 *
 * A Recipe is a deterministic, hand-authored blueprint that the v0.5
 * Story Composer pipeline uses as source-of-truth. The Author LLM does
 * NOT invent structure — it fills Page Cards. The Plan LLM is largely
 * replaced by Recipe selection + variation slot picking.
 *
 * v0.5 design principles encoded here:
 *   - Page Cards are concrete (dramaticRole + requiredEvent), not vague
 *   - companionAction is PHYSICAL, never "helps" / "comforts" / "supports"
 *   - mustInclude / mustNotInclude give validators precise anchors
 *   - variationSlots add texture WITHOUT touching dramaticRole/beat order
 *   - acceptanceCriteria are post-hoc gates (Y-lite checks them)
 *   - forbiddenPatterns are absolute (validators reject on match)
 */

export type AgeTier = '3-4' | '5-6' | '7-8';

export type StoryCategory =
  | 'MEDICAL_PROCEDURE'
  | 'BEDTIME_ANTICIPATION'
  | 'SEPARATION'
  | 'NEW_PLACE'
  | 'SOCIAL_FEAR'
  | 'BODY_CHANGE';

export type StoryDirection = 'bedtime' | 'adventure' | 'fantasy';

/**
 * The dramatic function of a page within the resilience arc.
 * Bound to a closed vocabulary — Author cannot invent new roles.
 */
export type DramaticRole =
  | 'opening_state'             // child in starting emotional state
  | 'companion_introduction'    // companion first becomes visible/present
  | 'journey_step'              // movement toward the feared situation
  | 'arrival_at_setting'        // entry into the procedure/sleep/fear setting
  | 'environment_sensing'       // child takes in surroundings
  | 'fear_object_appears'       // the thing-that-causes-fear becomes visible
  | 'child_body_resists'        // physical resistance: pulling back, shoulders, eyes
  | 'companion_closes'          // companion performs its core defensive mechanic
  | 'child_mirrors'             // child copies the companion's mechanic with own body
  | 'procedure_happens'         // the feared event occurs, short and concrete
  | 'residue_appears'           // physical evidence of survival (sticker, mark)
  | 'companion_opens'           // companion reverses its closure
  | 'cooldown_journey'          // leaving the setting
  | 'home_inspection'           // looking at the residue at home
  | 'settling_in'               // body relaxation in safe place
  | 'sleep_or_calm'             // final state — body soft, no moral
  // ── Bedtime / anticipation roles (added for bolly_bedtime_age_5) ──
  | 'fear_object_revisited'     // child's eyes return to a KNOWN worry object
  | 'anticipation_body_resists' // body tightens from the THOUGHT of tomorrow,
                                //   not from a procedure happening now
  | 'companion_contact'         // child makes a small physical contact with the
                                //   companion — not a big hug, not on the shoulder
  | 'object_revisited_safely'   // the worry object is still there, but the child
                                //   can now look at it without the body recoiling
  | 'quiet_spark_settling'      // a soft, small spark of warmth as the body softens
  | 'sleep_with_residue'        // sleep — the worry object still present but smaller
  // ── Fantasy / guided-imagery role (added for bolly_fantasy_age_5) ──
  | 'imaginative_reframe';      // child uses IMAGINATION as a coping tool on a
                                //   real thing — a short concrete mental picture,
                                //   anchored to body + companion, never a magic
                                //   world and never replacing the real object

/**
 * Concrete page-level contract. Author writes prose to satisfy this card.
 * Validators check the result against it directly.
 */
export interface PageCard {
  /** 1-indexed page number within the book. */
  page: number;

  /** What this page DOES dramatically. Closed vocabulary. */
  dramaticRole: DramaticRole;

  /** One-line description of the literal event. Hebrew. */
  requiredEvent: string;

  /** Child's PHYSICAL state on this page. Hebrew. e.g. "יד נמשכת לאחור, כתפיים עולות". */
  childBodyState: string;

  /**
   * Companion's PHYSICAL action. MUST be concrete — never "helps",
   * "comforts", "supports", "is there for her". Hebrew.
   * Examples:
   *   - "בּוֹלִי נסגר לכדור בתוך כיס התרמיל. טוּמְפּ."
   *   - "בּוֹלִי פותח פס שריון אחד ומציץ."
   */
  companionAction: string;

  /**
   * v0.5 Phase B.3 — the page modeled as an INTERACTION, not two parallel
   * actors. The persistent "sequence of actions" feel had a structural
   * cause: childBodyState + companionAction are two parallel-actor fields,
   * so the Author wrote two tracks. The fix is to model a page as ONE
   * exchange: the child feels/does something -> the companion registers
   * THAT and answers in body -> the child registers the answer ->
   * something small in the child shifts.
   *
   * When a page has a relationshipLoop, it IS the page — the Author renders
   * the four beats as one connected exchange, and childBodyState /
   * companionAction demote to constraint-data (not rendered as their own
   * separate sentences). A directive, NOT prose. Hebrew, concrete,
   * body-only, the companion never speaks, never a moral.
   *
   * Optional: a few deliberately-solo pages carry no loop — a pure
   * fear-object beat, and the child-resists beat where the companion is
   * intentionally silent (his answer is held for the next page).
   * See STORYBOOK_STANDARD.md.
   *
   * v0.5.4 Phase B.4 — `loopType` controls how the exchange RESOLVES
   * (beat 4). Earlier EVERY loop ended in a calming `shift`, so all 18
   * loop pages were identical mini-arcs (feel → answer → calm) and the
   * book read as a regulation machine, not a story. loopType breaks that
   * formula so relief ACCUMULATES across the arc instead of resetting on
   * every page:
   *   - 'relief'    — beat 4 softens the body a little (the original
   *                   default; the worry eases)
   *   - 'no-relief' — the companion answered, but the child stays tense;
   *                   the page ends UNRESOLVED, companion still close
   *   - 'hold'      — nothing resolves; child + companion near each other
   *                   in the quiet — presence itself is the page
   *   - 'spark'     — a small light moment: a tiny smile, a playful copy
   * Default when omitted: 'relief'.
   */
  relationshipLoop?: {
    /** How the exchange RESOLVES — controls beat 4. Default 'relief'. */
    loopType?: 'relief' | 'no-relief' | 'hold' | 'spark';
    /** What the child feels or does, in the body. */
    childFeels: string;
    /** How the companion registers THAT and answers — body only, no speech. */
    companionAnswers: string;
    /** How the child registers the companion's answer. */
    childNotices: string;
    /**
     * Beat 4 — how the page ENDS. Reinterpreted by loopType: a small body
     * softening (relief), an unresolved-but-accompanied beat (no-relief),
     * a still togetherness (hold), or a small light moment (spark).
     */
    shift: string;
  };

  /**
   * The fear-object or focal object on this page, if any.
   * Resolved from variationSlots at story-generation time.
   * Slot key reference, e.g. "medicalObject" or "stickerType".
   */
  requiredObjectSlot?: keyof RecipeVariationSlots;

  /** Hebrew strings that MUST appear (substring match after nikud-normalize). */
  mustInclude: string[];

  /** Hebrew patterns that MUST NOT appear (substring or regex). */
  mustNotInclude: string[];

  /** Target word count for prose on this page. */
  targetWords: number;

  /** Hard upper cap on word count. Validator BLOCKING above this. */
  maxWords: number;

  /** Hard upper cap on sentence count. Validator BLOCKING above this. */
  maxSentences: number;

  /**
   * What the illustration should depict — for downstream image generation.
   * Hebrew or English, kept short and concrete.
   */
  imageIntent: string;

  /** guarded-v2 — scene wardrobe state (assembler infers when omitted). */
  sceneState?: 'daytime' | 'transitional' | 'in-bed' | 'sleeping';

  /** guarded-v2 — per-page camera/framing contract. */
  framingType?:
    | 'wide-establishing'
    | 'medium-environment'
    | 'medium-action'
    | 'close-emotional'
    | 'object-close-up'
    | 'hand-detail'
    | 'over-the-shoulder'
    | 'top-down'
    | 'low-angle'
    | 'intimate-low-light';

  /** Required when framingType === 'object-close-up'. */
  focalObject?: string;

  /** Required when framingType === 'hand-detail'. */
  gestureFocus?: string;

  /**
   * Load-bearing pages for the resilience arc.
   * Critical pages get strictest reroll priority and Y-lite anchors there.
   * Bolly Adventure: pages 8-11 (body-resists → companion-closes → child-mirrors → procedure).
   * Default: false.
   */
  critical?: boolean;

  /**
   * v0.5.5 Phase B.5 — name-economy anchor. When true, the prompt tells
   * the Author to carry this page with the child's actual NAME as a
   * subject (not only a pronoun or a body part). Set on a small,
   * arc-spread set of pages so the child's name lands ~8-12 times across
   * the book. Default: false.
   */
  nameAnchor?: boolean;

  /**
   * Foundation-beat lock. When set, the Author MUST include this exact
   * Hebrew sentence verbatim as one of the page's sentences. The remaining
   * sentence slots are free Author prose.
   *
   * Used for pages where the companion's presence is non-negotiable but
   * auto-inject has no room to fix it post-hoc (typical case: page 1, where
   * the dramaticRole is `opening_state` and the Author may otherwise write
   * a "morning + child only" intro and skip the companion entirely).
   *
   * Counts toward maxSentences and maxWords. Pick a SHORT line (3-6 words).
   */
  requiredExactLine?: string;
}

/**
 * Variation slots add texture across customers without touching beats.
 * Each slot has 1+ candidate strings; story-generation picks one.
 * For MVP we keep slot cardinality conservative.
 */
export interface RecipeVariationSlots {
  clinicSetting?: string[];
  medicalObject?: string[];
  waitingObject?: string[];
  sensoryDetail?: string[];
  stickerType?: string[];
  weatherOutside?: string[];
  homeRoomDetail?: string[];

  // Bedtime-specific (placeholder — will be used by bolly_bedtime recipe)
  worryObject?: string[];
  bedroomLight?: string[];
  comfortObject?: string[];

  // Fantasy-specific — the concrete, comforting, body-anchored image the
  // child pictures the companion's closed ball as. NEVER magic.
  imaginativeImage?: string[];

  // Fantasy-specific — the inanimate, concrete object the thermometer's
  // silver tip is likened to on the p10 imaginative-reframe beat. Closed
  // set, inanimate only, so the calming simile can never become a living
  // creature that steals focus from the real thermometer.
  calmSimile?: string[];
}

/**
 * Quality target — anchors what "good enough" means for this recipe.
 * Compared against the matching Gold Candidate so we never silently
 * regress below the floor we already proved.
 */
export interface RecipeQualityTarget {
  /** The Gold Candidate this recipe was reverse-engineered from. */
  goldCandidateId: string;
  /** Minimum Y-lite Book Editor average score (1–5). */
  minBookScore: number;
  /** Minimum Y-lite Resilience Reviewer average score (1–5). */
  minResilienceScore: number;
  /** Hard cap on technical-fail page rerolls before REVIEW_REQUIRED. */
  maxTechnicalRetries: number;
  /** Hard cap on Y-lite-driven full Author rerolls before REVIEW_REQUIRED. */
  maxAuthorRerolls: number;
}

/**
 * Production Recipe — top-level contract.
 */
export interface ProductionRecipe {
  /** Stable kebab-case id, used by pipeline to load this recipe. */
  id: string;

  /** Companion this recipe is bound to. */
  companionId: string;

  /** Story category (resilience pattern type). */
  category: StoryCategory;

  /** Direction — also determines page count via Pricing v2. */
  direction: StoryDirection;

  /** Age tier (closed set). */
  ageTier: AgeTier;

  /** Total page count. Must match pageCards.length. */
  pageCount: number;

  /**
   * One-sentence promise to the parent buyer.
   * What this book gives the child by the end.
   */
  storyPromise: string;

  /**
   * The emotional arc as a single line.
   * e.g. "reluctance to resistance to mirroring to small acceptance to soft residue"
   */
  emotionalArc: string;

  /**
   * The resilience pattern this recipe instantiates.
   * Used by Resilience Reviewer to anchor scoring.
   */
  resiliencePattern: string;

  /** Texture variation across stories. Conservative for MVP. */
  variationSlots: RecipeVariationSlots;

  /** The 15 pages, in order. Validated: pageCards[i].page === i+1. */
  pageCards: PageCard[];

  /**
   * Absolute forbidden patterns across the whole book.
   * Validator rejects on any match (BLOCKING).
   */
  forbiddenPatterns: string[];

  /**
   * Post-hoc qualitative gates. Resilience Reviewer + Book Editor
   * check these. Failure means REVIEW_REQUIRED or reroll, never silent pass.
   */
  acceptanceCriteria: string[];

  /**
   * Quality floor — recipe must reproduce at least this score, or we
   * mark the run REVIEW_REQUIRED instead of READY.
   */
  qualityTarget: RecipeQualityTarget;

  /**
   * Authoring metadata. Helps future-us understand intent.
   */
  meta: {
    version: string;
    derivedFrom: string;
    authoredAt: string;
    authoredBy: string;
    notes?: string[];
  };
}
