import type { Prisma } from '@prisma/client';
import type { Companion } from '@/lib/companions';
import type { BookPageTemplate } from '@/lib/bookPageLayout';

export type RuntimeStorySourceAuthorityKind =
  | 'legacy_story_bank'
  | 'product_accepted_revision';

export type PipelineCache = {
  /**
   * Fresh release continuity is durable job input, not deployment-global
   * configuration. It pins package-backed self-chain and recovery dispatch to
   * the initiating deployment's versioned worker. Legacy jobs omit it.
   */
  releaseContinuity?: import('./release-v1-continuity').GenerationReleaseContinuityV1;
  /**
   * Reviewed release/v1 recovery history. The recovery endpoint writes this together
   * with the new immutable deployment continuity, preserving every other cache
   * key. It is also the idempotency fence for a repeated apply request.
   */
  releaseRecovery?: {
    version: 'release-v1-recovery-log/v1';
    attempts: Array<{
      version:
        | 'release-v1-recovery-attempt/v1'
        | 'release-v1-page-rerender-attempt/v1';
      attemptId: string;
      reason:
        | 'reviewed_code_fix_resume'
        | 'reviewed_single_page_rerender_resume';
      snapshotDigest: string;
      oldContinuityDigest: string;
      newContinuityDigest: string;
      previousFailedAt: string;
      previousLastErrorDigest: string | null;
      retainedArtifactDigests: {
        cover: string;
        pages: Array<{ pageNumber: number; sha256: string }>;
      };
      /** Exact-byte, zero-render safety reconciliation performed by this attempt. */
      safetyReverification?: Array<{
        artifactKey: string;
        sha256: string;
        qaContextDigest: string;
        evaluatorContractVersion: string;
        visualVerdict: 'passed' | 'failed' | 'evidence_unknown';
        safetyStatus: 'safe' | 'hazard' | 'unverified';
        worldStatus: 'pass' | 'fail' | 'error' | null;
      }>;
      /**
       * One reviewed release recovery may invalidate exactly one existing page
       * and route its replacement through the ordinary render + QA worker.
       * The old storage object is retained; this is the durable pointer/SHA
       * audit for the delivery-input row that was removed.
       */
      rerenderedArtifacts?: Array<{
        artifactKey: string;
        pageNumber: number;
        pageId: string;
        assetId: string;
        sha256: string;
        sourceUrl: string;
        presentationUrl: string | null;
        rawUrl: string | null;
        deliveredUrl: string;
        provider: string;
        idempotencyKey: string;
        qaContextDigest: string;
        evidenceDigest: string;
        candidateId: string | null;
        evaluatorContractVersion: string;
        contractHash: string | null;
        priorAssetReceipt: {
          operationKey: string;
          payloadHash: string;
          kind: string;
          resultDigest: string;
          createdAt: string;
        } | null;
      }>;
      effectiveResemblanceThreshold?: number;
      previousJobProgress?: {
        completedPageNumbers: Prisma.JsonValue | null;
        failedPageNumbers: Prisma.JsonValue | null;
        pageAttempts: Prisma.JsonValue | null;
      };
      recoveredAt: string;
    }>;
  };
  /**
   * Story `.md` reference. Stored REPO-RELATIVE (posix) — never an absolute/`process.cwd()` path —
   * so the cross-chunk cache-invariant guard does not flag it (0095 P0). Resolve to absolute via
   * `resolveCachedStoryFilePath()` (lib/generation-pipeline/story-path.ts). Legacy in-flight caches may
   * still hold an absolute committed path; the resolver and guard both tolerate that.
   */
  storyFilePath?: string;
  /** Repo-relative story-bank subdir (e.g. `v3-approved`) — pairs with `selectionFilename`. */
  storyDir?: string;
  /** Canonical product/package identity. Required for accepted-revision sources; optional on legacy caches. */
  storyKey?: string;
  /** Closed origin grammar for the exact frozen Story Source reference. */
  storySourceAuthorityKind?: RuntimeStorySourceAuthorityKind;
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
  /**
   * (dev Creator audition) Cap the number of PAGE IMAGES rendered to the first N pages — the full
   * authored story + visual contract are still loaded and finalized (so `expectedPageCount` == the
   * full count and the finalization guard is satisfied truthfully; location/continuity stay real).
   * Only image generation is limited, for cost control. Undefined / >= full count => render the whole
   * book. Set by the dev story-bank route; absent on the prod path (renders all pages, unchanged).
   */
  renderImagePageLimit?: number;
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
  /**
   * (WS0b) The frozen `BookVisualContract` for this book — produced once (bank artifact load or dynamic compile)
   * and persisted here by `ensureFrozenVisualContract` before the cover, atomically with `Order.visualContractHash`
   * (= its canonical hash). Typed as opaque JSON (the contract is a deep interface tree that isn't structurally a
   * `Prisma.InputJsonObject`, so a typed field would break every `PipelineCache → InputJsonValue` write); consumers
   * cast/parse it back to `BookVisualContract`. Legacy presence remains rollout-controlled; package-backed Orders
   * require it in every environment. Absence is renderable only for a genuine legacy Order whose gate is off.
   */
  visualContract?: Prisma.InputJsonValue;
  /**
   * Exact immutable PVB runtime authority frozen for this order. The selector/current locator is never persisted
   * here: resume and regeneration load only this content-addressed package revision. Written atomically with the
   * resolved Visual Contract and Order.visualContractHash on the enforced Style01 path.
   */
  visualPackageAuthority?: import('@/lib/visual-package').FrozenVisualPackageAuthority;
  /**
   * (Set Identity Board, Milestone C) This order's per-order board ACTIVATION + BINDINGS, pinned to the frozen
   * contract hash. Written ONLY by `set-identity-board-stage.ts`, before the first paid image (fresh or recovery),
   * when either the legacy rollout gate is active or the durable Order is package-backed — via a single-key
   * `jsonb_set`, never `saveCache`.
   *
   * ABSENT may remain the permanent legacy state only for a genuine legacy Order. Package-backed Orders must acquire
   * a `required-v2` snapshot before their first paid image and fail closed if it is missing or cannot be bound.
   *
   * Carries only DURABLE descriptors (`storageKey` + a resolved url), never a local /tmp path —
   * `assertCacheHasNoLocalArtifactPaths` would reject the cache on serverless.
   */
  setIdentityBoards?: import('@/lib/set-identity-board').SetIdentityBoardBindingContext;
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
    /** Absent on legacy rows and therefore interpreted as the existing photo identity lane. */
    identityMode?: 'photo' | 'description_template';
    model?: string;
    resemblanceScore?: number;
    faceDetectConfidence?: number;
    faceAreaRatio?: number;
    embeddingMismatch?: boolean;
    colorMismatch?: boolean;
    geometryWeird?: boolean;
    passed?: boolean;
    semanticPass?: boolean;
    stylePass?: boolean;
    qaDiagnostics?: import('./stage0-qa-diagnostics').Stage0DescriptionTemplateCandidateQaDiagnostics;
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
  /** (WS0b e4a) Contract environment lock (indoor|outdoor|neutral) → Style 01 style-ref routing. Ephemeral;
   *  set only when VISUAL_CONTRACT_STEERING is on. Absent → regex style-ref selection (byte-identical). */
  contractStyleRefEnvironment?: 'indoor' | 'outdoor' | 'neutral';
  /** (WS0b location authority) Authoritative per-page contract prompt block (LOCATION/CAST/WARDROBE/MUST-SHOW/
   *  MUST-NOT-SHOW/CAMERA) → PREPENDED to the Style 01 prompt so the frozen contract outranks imageDirection.
   *  Ephemeral; set only when VISUAL_CONTRACT_STEERING is on. Absent → legacy prompt unchanged (byte-identical). */
  visualContractPromptBlock?: string;
  /** (Set Identity Board, Milestone C) This page's approved set board as a TAGGED ref (Milestone B transport).
   *  Ephemeral; set only for an order carrying a `required-v2` board snapshot. Absent → no protected ref, no role
   *  map, no set-copy instruction → byte-identical. */
  setIdentityBoardRefs?: import('@/lib/set-identity-board').ReferenceAsset[];
};

export type ResolvedCompanionRef = Companion | null;
