import type { Companion } from '@/lib/companions';
import type { BookPageTemplate } from '@/lib/bookPageLayout';

export type PipelineCache = {
  /**
   * Story `.md` reference. Stored REPO-RELATIVE (posix) — never an absolute/`process.cwd()` path —
   * so the cross-chunk cache-invariant guard does not flag it (0095 P0). Resolve to absolute via
   * `resolveCachedStoryFilePath()` (lib/generation-pipeline/story-path.ts). Legacy in-flight caches may
   * still hold an absolute committed path; the resolver and guard both tolerate that.
   */
  storyFilePath?: string;
  /** Repo-relative story-bank subdir (e.g. `v3-approved`) — pairs with `selectionFilename`. */
  storyDir?: string;
  storyBankVersion?: 'v3' | 'v1';
  selectionFilename?: string;
  directionForV3?: 'bedtime' | 'adventure' | 'fantasy';
  challengeCategory?: string;
  /** Dev story-bank: direct file path already loaded */
  devStoryBankFile?: string;
  devSkipCover?: boolean;
  /** Skip LLM gender/name personalization in text finalization (dev generalization tests). */
  skipLlmPersonalization?: boolean;
  lockedChildDescription?: string;
  childPhotoDescription?: string | null;
  dna?: {
    childDNA: string;
    companionDNA: string;
    childStructured?: {
      face: string;
      hair: string;
      body: string;
      clothing: string;
      signature: string;
    };
    companionStructured?: {
      species: string;
      size: string;
      coloring: string;
      feature: string;
    };
    propDNA?: Record<string, string>;
    negativeRules?: string[];
    worldDNA?: string;
  };
  expectedPageCount?: number;
  /** Per-book cinematography plan (derived at render or story override). JSON-serializable for pipelineCache. */
  bookShotPlan?: {
    pageCount: number;
    source: 'derived' | 'override';
    pages: Array<{
      page: number;
      shot: string;
      angle?: string;
      rationale: string;
    }>;
  };
  /** Per-book location continuity (derived or sidecar). JSON-serializable for pipelineCache. */
  storyLocationPlan?: {
    bible: {
      continuityMode: string;
      primarySetting: string;
      forbiddenDrift: string[];
      transitionRules: string[];
      source: string;
      pageCount?: number;
      allowedZones: Array<{ id: string; description: string }>;
    };
    pagePlans: Array<{
      page: number;
      zoneId: string;
      visibleAnchors: string[];
      allowedVariation: string;
      forbiddenDrift: string[];
      cameraPositionHint?: string;
    }>;
  };
  textFinalized?: boolean;
  characterAnchorStore?: Record<
    string,
    {
      orderId: string;
      styleId: string;
      characterId: string;
      role: 'child' | 'companion' | 'creature' | 'family_member';
      anchorType: 'canonical_portrait' | 'character_sheet' | 'predefined_sheet';
      source: 'uploaded_photo' | 'companion_sheet' | 'generated_story_anchor' | 'static_asset';
      url: string;
      provider?: string;
      model?: string;
      quality?: string;
      promptUsed?: string;
      inputDescriptionUsed?: string;
      referenceOrderUsed?: string[];
      qaStatus?: 'pending' | 'pending_review' | 'passed' | 'failed';
      anchorQuality?: string;
      resemblanceScore?: number;
      thresholdUsed?: number;
      qaNotes?: string;
      createdAt: string;
      updatedAt: string;
    }
  >;
  /**
   * Set true once the child anchor is accepted for page generation — via auto-accept
   * (best-of-N >= soft threshold), the dev/QA override, or accept-best-and-flag after
   * the regenerate budget is spent. Anchors are never left in a customer dead-end.
   */
  childAnchorApproved?: boolean;
  /**
   * True when the accepted anchor was below the auto-accept soft threshold after the
   * regenerate budget was exhausted (accepted as best-available). Flags the order for
   * asynchronous human QA; does NOT block generation. `reason` records severity.
   */
  childAnchorLowConfidence?: { reason: 'soft_band' | 'hard_band'; score: number };
  stage0SelectedAttempt?: number;
  stage0AnchorPrompt?: string;
  stage0AnchorReferenceOrderLabels?: string[];
  /** Per-order mini expression sheet (edits from approved canonical anchor). */
  childExpressionSheet?: {
    baseAnchorUrl: string;
    /** Legacy: all kinds approved at once. */
    approved?: boolean;
    /** Per-kind approval (neutral, happy, worried, action, etc.). */
    approvedKinds?: Array<'neutral' | 'happy' | 'worried' | 'shouting' | 'action'>;
    /** Selected shouting ref for pages: v1 = anchors.shouting, v2/v3 = shoutingVariants. */
    selectedShouting?: 'v1' | 'v2' | 'v3';
    shoutingVariants?: Partial<
      Record<
        'v2' | 'v3',
        {
          url: string;
          qaStatus: 'pending_review' | 'passed' | 'failed';
          resemblanceToBase?: number;
          createdAt: string;
        }
      >
    >;
    anchors: Partial<
      Record<
        'neutral' | 'happy' | 'worried' | 'shouting' | 'action',
        {
          url: string;
          qaStatus: 'pending_review' | 'passed' | 'failed';
          resemblanceToBase?: number;
          styleQaPass?: boolean;
          attempts?: number;
          createdAt: string;
        }
      >
    >;
  };
  /** Order-level human family coherence (#18) — mirrors Order.characterAnchors._familyCoherence */
  familyCoherence?: import('../family-coherence').FamilyCoherenceBundle;
  stage0AnchorCandidates?: Array<{
    attempt: number;
    url: string;
    model?: string;
    resemblanceScore?: number;
    faceDetectConfidence?: number;
    faceAreaRatio?: number;
    embeddingMismatch?: boolean;
    colorMismatch?: boolean;
    geometryWeird?: boolean;
    passed?: boolean;
    semanticPass?: boolean;
    embeddingVerdict?: 'hard_fail' | 'soft_ok';
    createdAt: string;
  }>;
};

export type ChunkProcessResult = {
  stage: string;
  done: boolean;
  stopChunk: boolean;
  error?: string;
};

export type PageForGeneration = {
  pageTemplate: BookPageTemplate;
  pageNumber: number;
  imagePrompt: string;
  rawScenePrompt?: string;
  bookPageText?: string;
  imageSubject?: string;
  pageIntent?: unknown;
  composition?: Record<string, string>;
  compositionRules?: string;
  environmentContinuity?: string;
  expectedCharacterIds?: string[];
  supportingCharacters?: Array<{
    name: string;
    description: string;
    relationship?: string;
  }>;
  visualDirection?: unknown;
};

export type ResolvedCompanionRef = Companion | null;
