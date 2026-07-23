import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageInput } from '@/backend/providers/image';
import {
  computeVisualContractHash,
  materialize,
  VISUAL_CONTRACT_SCHEMA_VERSION,
  type BookVisualContractTemplate,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import { resolveEffectiveThreshold, resolveResemblanceThresholdConfig } from '@/lib/resemblance-core';
import {
  bindApprovedRuntimeAuthority,
  buildApprovedRuntimeAuthorityBinding,
} from '@/lib/visual-package/runtimeAuthority';
import {
  VISUAL_PACKAGE_MANIFEST_VERSION,
  VISUAL_PACKAGE_PROMOTION_VERSION,
  type VisualPackageManifest,
} from '@/lib/visual-package/types';

import type { Style01RuntimeAuthority } from '../render-qualification-preflight';
import {
  RuntimeVisualAuthorityBoundaryError,
  buildRuntimePageAuthorityProjection,
} from '../runtime-visual-authority';
import { constrainSceneBlockingToPresentation } from '@/backend/providers/director';

const { evaluateQaSpy, generateGptSpy, storeBufferSpy } = vi.hoisted(() => ({
  evaluateQaSpy: vi.fn(),
  generateGptSpy: vi.fn(),
  storeBufferSpy: vi.fn(),
}));

vi.mock('@/lib/generation-pipeline/page-visual-qa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/generation-pipeline/page-visual-qa')>()),
  evaluatePageVisualQaWithReQa: evaluateQaSpy,
}));

vi.mock('@/lib/generate-image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/generate-image')>()),
  generateGPTImage: generateGptSpy,
  generateReplicateImage: vi.fn(),
  resolveGPTImageEditMaxReferences: () => 16,
}));

vi.mock('@/lib/image-storage', () => ({
  storeImageFromBuffer: storeBufferSpy,
  storeImageFromProviderUrl: vi.fn(),
  isImagePersistenceError: () => false,
}));

import { generateBookCover, generateImage } from '@/backend/providers/image';
import { planGPTImageRequest } from '@/lib/generate-image';

const FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

function template(): BookVisualContractTemplate {
  return {
    contractKind: 'template',
    schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    version: 1,
    storyKey: 'runtime_fixture',
    worldType: 'grounded_clinic',
    locations: [{
      id: 'loc_clinic',
      name: 'Neighborhood clinic',
      description: 'a small grounded neighborhood clinic',
      environmentClass: 'indoor',
      timeOfDay: 'day',
      lighting: 'soft window daylight',
      setIdentityId: 'set_clinic',
    }],
    zones: [{
      id: 'zone_exam',
      locationId: 'loc_clinic',
      name: 'Exam room',
      description: 'a compact exam room with fixed pale-blue walls',
    }],
    cast: {
      child: { id: 'child:hero', role: 'child', name: 'Noa', wardrobe: { description: 'green shirt' } },
      companion: { id: 'companion:friend', role: 'companion', name: 'Pip', wardrobe: { description: 'no clothing' } },
    },
    recurringProps: [{ id: 'prop_stool', name: 'round stool', description: 'one low round blue stool' }],
    forbiddenGlobalElements: ['castles', 'dragons', 'generic bedrooms'],
    coverContract: {
      worldType: 'grounded_clinic',
      locationId: 'loc_clinic',
      zoneId: 'zone_exam',
      castIds: ['child:hero', 'companion:friend'],
      mustShow: ['clinic doorway'],
      mustNotShow: ['medical procedure'],
    },
    pageContracts: [{
      pageNumber: 1,
      locationId: 'loc_clinic',
      zoneId: 'zone_exam',
      sameLocationAs: null,
      mustShow: [
        'round stool',
        'the child smiles with relieved delight while touching the stool',
      ],
      mustNotShow: ['castles', 'dragons'],
      characterPresence: { child: true, companion: false },
      castIds: ['child:hero'],
      propState: [{ propId: 'prop_stool', state: 'beside the child' }],
      castStates: [{
        castId: 'child:hero',
        bodyState: 'relaxed shoulders and a bright relieved smile',
      }],
      actionRequirements: [{
        checkId: 'action:touch_stool',
        actorId: 'child:hero',
        predicate: 'touches',
        object: { kind: 'prop', id: 'prop_stool' },
        polarity: 'must',
      }],
      transition: { kind: 'steady' },
      camera: 'wide eye-level composition with child and stool sharing the foreground',
    }],
    humanCast: [],
  };
}

function manifest(): VisualPackageManifest {
  return {
    manifestVersion: VISUAL_PACKAGE_MANIFEST_VERSION,
    state: 'approved',
    storyKey: 'runtime_fixture',
    styleId: 'soft_hand_drawn_storybook',
    source: {
      version: 'story-source/v1',
      path: 'story-bank/fixtures/runtime_fixture.md',
      digestAlgorithm: 'sha256-normalized-utf8',
      digest: 'source-digest',
      pageCount: 1,
      pageNumbers: [1],
    },
    template: {
      artifactPath: 'story-bank/fixtures/runtime_fixture.visual-contract-template.json',
      digestAlgorithm: 'canonical-json-sha256',
      digest: 'template-digest',
      schemaVersion: VISUAL_CONTRACT_SCHEMA_VERSION,
    },
    reconciliation: {
      artifactPath: 'story-bank/fixtures/runtime_fixture.visual-contract-reconciliation.json',
      digestAlgorithm: 'canonical-json-sha256',
      digest: 'reconciliation-digest',
      version: 'source-prompt-reconciliation/v1',
      projectionVersion: 'style01-source-prompt-projection/v1',
    },
    coverage: {
      coverDigest: 'cover-digest',
      pageContractsDigest: 'pages-digest',
      pageCount: 1,
      pageNumbers: [1],
    },
    candidateEvidence: {
      version: 'visual-package-candidate/v1',
      sourceInputDigest: 'source-input',
      reviewDigest: 'review-digest',
      provenanceDigest: 'provenance-digest',
    },
    review: {
      authoredBy: 'fixture author',
      reviewedBy: 'fixture reviewer',
      reviewedAt: '2026-07-22T10:00:00.000Z',
      worldMode: 'grounded',
    },
    approval: { approvedBy: 'Guy', approvedAt: '2026-07-22T10:05:00.000Z' },
    requiredBoards: [{
      artifactPath: 'set-identity-boards/runtime_fixture/set_clinic.json',
      artifactDigest: 'board-artifact-digest',
      registryVersion: 'set-registry/v2',
      boardVersion: 'set-board/v2',
      storyKey: 'runtime_fixture',
      setIdentityId: 'set_clinic',
      styleId: 'soft_hand_drawn_storybook',
      setDefinitionHash: 'set-definition-hash',
      contentPolicyDigest: 'content-policy-digest',
      declaredPropIds: [],
      storageKey: 'set-identity-boards/runtime_fixture/set_clinic.png',
      assetSha256: 'board-bytes-sha',
      approvedBy: 'Guy',
      approvedAt: '2026-07-22T10:05:00.000Z',
    }],
    requiredPropReferences: [],
    promotion: {
      toolVersion: VISUAL_PACKAGE_PROMOTION_VERSION,
      promotedAt: '2026-07-22T10:06:00.000Z',
      templateDestination: 'story-bank/fixtures/runtime_fixture.visual-contract-template.json',
      reconciliationDestination: 'story-bank/fixtures/runtime_fixture.visual-contract-reconciliation.json',
      manifestDestination: 'visual-packages/approved/runtime_fixture.visual-package.json',
    },
  };
}

function authority(): Style01RuntimeAuthority {
  const approved = manifest();
  const sourceTemplate = template();
  const contract = bindApprovedRuntimeAuthority(
    materialize(structuredClone(sourceTemplate), FAMILY),
    approved,
  );
  const contractHash = computeVisualContractHash(contract);
  return {
    version: 'style01-runtime-authority/v3',
    repoRoot: process.cwd(),
    qualification: {
      storyKey: approved.storyKey,
      storySourcePath: approved.source.path,
      approvedPackagePath: 'visual-packages/approved/runtime_fixture.visual-package.json',
      renderQualified: true,
      reasons: [],
      manifest: approved,
      template: sourceTemplate,
    },
    contract,
    contractHash,
    packageBinding: buildApprovedRuntimeAuthorityBinding(approved),
    boardBindings: {
      mode: 'required-v2',
      frozenContractHash: contractHash,
      bindings: {
        set_clinic: {
          setIdentityId: 'set_clinic',
          setDefinitionHash: 'set-definition-hash',
          contentPolicyDigest: 'content-policy-digest',
          declaredPropIds: [],
          styleId: 'soft_hand_drawn_storybook',
          storageKey: 'set-identity-boards/runtime_fixture/set_clinic.png',
          resolvedUrl: 'https://fixtures.invalid/set-clinic.png',
          assetSha256: 'board-bytes-sha',
          boardVersion: 'set-board/v2',
          approvedAt: '2026-07-22T10:05:00.000Z',
        },
      },
    },
  };
}

function imageInput(runtimeAuthority?: Style01RuntimeAuthority | null): ImageInput {
  return {
    pagePrompt: 'MALICIOUS_REALITY castle at midnight with an extra dragon',
    rawScenePrompt: 'MALICIOUS_RAW_WORLD generic bedroom',
    bookPageText: 'MALICIOUS_STORY_WORLD',
    illustrationStyle: 'soft_hand_drawn_storybook',
    orderId: 'runtime-authority-order',
    pageNumber: 1,
    totalPages: 1,
    runtimeVisualAuthority: runtimeAuthority,
    visualContractPromptBlock: 'MALICIOUS_CONTRACT_OVERRIDE',
    setIdentityBoardRefs: [{ kind: 'set', url: 'https://fixtures.invalid/wrong-board.png' }],
    directionArchetype: 'fantasy',
    directionStoryPremise: 'MALICIOUS_DIRECTION_WORLD',
    childDescription: 'MALICIOUS_CHILD dragon monarch in a castle',
    heroVisualLock: {
      sourceImageUrl: null,
      faceShape: 'round child face',
      hair: 'wavy dark hair',
      skinTone: 'warm brown',
      eyes: 'brown eyes',
      ageImpression: 'young child',
      clothing: 'MALICIOUS_WARDROBE dragon costume',
      identityGuardrails: ['MALICIOUS_GUARD add a castle'],
    },
    childStructured: {
      face: 'round child face',
      hair: 'wavy dark hair',
      body: 'young child proportions',
      clothing: 'MALICIOUS_STRUCTURED_WARDROBE',
      signature: 'MALICIOUS_SIGNATURE carries a dragon',
    },
    visualDirection: {
      locationZone: 'MALICIOUS_ZONE',
      mainAction: 'summon an extra dragon',
      visibleObjects: ['castle'],
      characterPose: 'kneeling beside MALICIOUS_PROP',
      emotionVisual: 'curious inside MALICIOUS_REALITY',
      lightingSource: 'moonlit fantasy',
      environmentDetail: 'generic bedroom',
      mustInclude: ['dragon'],
      mustNotInclude: ['clinic'],
      camera: 'wide',
      composition: 'diagonal castle composition',
    },
    blocking: {
      blocking: 'dragon at foreground-left inside MALICIOUS_REALITY',
      interaction: 'summoning a castle while kneeling',
      eyeline: 'toward the dragon on the right',
      emotion: 'curious terror in a fantasy realm',
    },
    operatorNote: 'put a second dragon in the castle background while kneeling on the left',
    characterSheet: {
      mainCharacter: { name: 'MALICIOUS_CAST', visualDescription: 'a dragon king' },
      supportingCharacters: [{ name: 'extra dragon', relationship: 'invader', visualDescription: 'castle dragon' }],
      worldDescription: 'MALICIOUS_WORLD castle at midnight',
    },
    compositionRules: 'center the castle and add dragons',
    environmentContinuity: 'generic bedroom fallback',
    referenceImages: [
      'https://fixtures.invalid/child.png',
      'https://fixtures.invalid/wrong-extra-cast.png',
    ],
    anchorCharacters: [{
      characterId: 'extra:dragon',
      name: 'extra dragon',
      anchorImageUrl: 'https://fixtures.invalid/wrong-extra-cast.png',
    }],
  };
}

function qaResult(passed: boolean) {
  return {
    passed,
    verdict: passed ? 'passed' as const : 'failed' as const,
    reason: passed ? 'ok' as const : 'anatomy_failed' as const,
    details: passed ? 'fixture pass' : 'fixture verified defect',
    flags: {
      anatomyOk: passed,
      identityOk: true,
      styleOk: true,
      singleChildOk: true,
      objectGeometryOk: true,
      emotionalStagingOk: true,
      timeOfDayOk: true,
      companionSilhouetteOk: true,
      childPresenceOk: true,
      safetyOk: true,
    },
    safetyHazards: [],
    safetyStatus: 'safe' as const,
  };
}

describe('R1C shared runtime world-authority boundary', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    vi.stubEnv('PHASE2_STYLE01_BOOK_PIPELINE', 'true');
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'false');
    vi.stubEnv('STYLE_01_GPT_MODEL', 'gpt-image-1');
    vi.stubEnv('GPT_IMAGE_QUALITY', 'low');
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('network must be unreachable in R1C tests');
    }));
    generateGptSpy.mockReset();
    storeBufferSpy.mockReset();
    evaluateQaSpy.mockReset();
    evaluateQaSpy.mockResolvedValue(qaResult(true));
    generateGptSpy.mockResolvedValue({
      buffer: Buffer.from('fixture-image'),
      model: 'gpt-image-1',
      finalPrompt: 'provider-result',
      durationMs: 1,
      usage: null,
    });
    storeBufferSpy.mockResolvedValue('https://fixtures.invalid/render.png');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('blocks direct page and cover provider callers before provider invocation when authority is absent', async () => {
    await expect(generateImage(imageInput(null))).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    await expect(generateBookCover({
      childName: 'Noa',
      topicLabel: 'Courage',
      storyTitle: 'Fixture',
      illustrationStyle: 'soft_hand_drawn_storybook',
    })).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    expect(generateGptSpy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('carries reviewer worldMode and exact cover/page location, zone, cast, content, and board into projections', () => {
    const runtimeAuthority = authority();
    const page = buildRuntimePageAuthorityProjection({
      illustrationStyle: 'soft_hand_drawn_storybook',
      authority: runtimeAuthority,
      pageNumber: 1,
      requestedVisualDirection: imageInput(runtimeAuthority).visualDirection,
    });
    const cover = buildRuntimePageAuthorityProjection({
      illustrationStyle: 'soft_hand_drawn_storybook',
      authority: runtimeAuthority,
      pageNumber: 0,
    });
    expect(page?.contractPromptBlock).toContain('REALITY MODE (reviewer-owned): grounded');
    expect(page?.contractPromptBlock).toContain('LOCATION: Neighborhood clinic (id=loc_clinic)');
    expect(page?.contractPromptBlock).toContain('ZONE: Exam room (id=zone_exam)');
    expect(page?.expectedCharacterIds).toEqual(['child:hero']);
    expect(page?.setIdentityBoardRefs?.[0]).toMatchObject({
      url: 'https://fixtures.invalid/set-clinic.png',
      identityId: 'set_clinic',
      assetSha256: 'board-bytes-sha',
    });
    expect(cover?.expectedCharacterIds).toEqual(['child:hero', 'companion:friend']);
    expect(cover?.pageLocationPlan.zoneId).toBe('zone_exam');
  });

  it('does not project a structurally forbidden propState entry as a visible runtime object', () => {
    const approved = manifest();
    const sourceTemplate = template();
    sourceTemplate.pageContracts[0].mustShow = [];
    sourceTemplate.pageContracts[0].mustNotShow = [
      ...sourceTemplate.pageContracts[0].mustNotShow,
      'round stool',
    ];
    sourceTemplate.pageContracts[0].propState = [{
      propId: 'prop_stool',
      state: 'not visible on this page',
    }];
    sourceTemplate.pageContracts[0].propConstraints = [{
      propId: 'prop_stool',
      visibility: 'forbidden',
    }];
    const contract = bindApprovedRuntimeAuthority(
      materialize(structuredClone(sourceTemplate), FAMILY),
      approved,
    );
    const runtimeAuthority = authority();
    runtimeAuthority.qualification.manifest = approved;
    runtimeAuthority.qualification.template = sourceTemplate;
    runtimeAuthority.contract = contract;
    runtimeAuthority.contractHash = computeVisualContractHash(contract);
    runtimeAuthority.packageBinding = buildApprovedRuntimeAuthorityBinding(approved);
    runtimeAuthority.boardBindings!.frozenContractHash = runtimeAuthority.contractHash;

    const projection = buildRuntimePageAuthorityProjection({
      illustrationStyle: 'soft_hand_drawn_storybook',
      authority: runtimeAuthority,
      pageNumber: 1,
    });
    expect(projection?.entityPresence.recurringObjects).not.toContain('round stool');
    expect(projection?.visualDirection.visibleObjects).not.toContain('round stool');
  });

  it('deterministically removes caller and Director world overrides before the image provider', async () => {
    const runtimeAuthority = authority();
    await generateImage(imageInput(runtimeAuthority));
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    const providerInput = generateGptSpy.mock.calls[0][0] as {
      finalPrompt: string;
      negativePrompt?: string;
      referenceImages: string[];
      referenceMode?: Parameters<typeof planGPTImageRequest>[0]['referenceMode'];
      quality?: Parameters<typeof planGPTImageRequest>[0]['quality'];
      size?: Parameters<typeof planGPTImageRequest>[0]['size'];
    };
    expect(providerInput.finalPrompt).toContain('REALITY MODE (reviewer-owned): grounded');
    expect(providerInput.finalPrompt).toContain('Neighborhood clinic');
    expect(providerInput.finalPrompt).toContain('Exam room');
    expect(providerInput.finalPrompt).toContain('green shirt');
    expect(providerInput.finalPrompt).not.toMatch(/MALICIOUS_|summon an extra dragon|wrong-board/);
    expect(providerInput.finalPrompt).not.toMatch(/home-night|moonlit home/i);
    expect(providerInput.finalPrompt).not.toMatch(/sky-blue t-shirt|RED sneakers/);
    expect(providerInput.finalPrompt).toContain('relaxed shoulders and a bright relieved smile');
    expect(providerInput.finalPrompt).toContain('Noa touches round stool');
    expect(providerInput.finalPrompt).toContain('child and stool sharing the foreground');
    expect(providerInput.referenceImages).toContain('https://fixtures.invalid/set-clinic.png');
    expect(providerInput.referenceImages).toContain('https://fixtures.invalid/child.png');
    expect(providerInput.referenceImages).not.toContain('https://fixtures.invalid/wrong-board.png');
    expect(providerInput.referenceImages).not.toContain('https://fixtures.invalid/wrong-extra-cast.png');
    const finalRequest = planGPTImageRequest(providerInput, {
      defaultModel: 'gpt-image-1',
      defaultQuality: 'low',
      maxReferences: 16,
    });
    expect(finalRequest.apiMode).toBe('images.edit');
    expect(finalRequest.finalPrompt).toContain('[STYLE 02 BOOK — REFERENCE IMAGES]');
    expect(finalRequest.finalPrompt).toContain('[AVOID]');
    expect(finalRequest.finalPrompt).toContain('relaxed shoulders and a bright relieved smile');
    expect(finalRequest.finalPrompt).toContain('Noa touches round stool');
    expect(finalRequest.finalPrompt).toContain('child and stool sharing the foreground');
    expect(finalRequest.finalPrompt).not.toMatch(/MALICIOUS_|wrong-board|wrong-extra-cast/);
    expect(finalRequest.bodyWithoutBinaryImage.prompt).toBe(finalRequest.finalPrompt);
    expect(finalRequest.orderedReferenceSources).toEqual(providerInput.referenceImages);
    expect(finalRequest.requestOptions.maxRetries).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('applies the same exact authority to the shipped cover provider path', async () => {
    vi.stubEnv('ALLOW_SINGLE_IMAGE_COMPANION_REF', 'true');
    const runtimeAuthority = authority();
    await generateBookCover({
      childName: 'Noa',
      topicLabel: 'MALICIOUS_TOPIC castle',
      storyTitle: 'MALICIOUS_TITLE dragon realm',
      coverText: 'MALICIOUS_COVER generic bedroom',
      coverSceneHint: 'MALICIOUS_HINT switch to midnight fantasy',
      illustrationStyle: 'soft_hand_drawn_storybook',
      runtimeVisualAuthority: runtimeAuthority,
      setIdentityBoardRefs: [{ kind: 'set', url: 'https://fixtures.invalid/wrong-board.png' }],
      directionArchetype: 'fantasy',
      directionStoryPremise: 'MALICIOUS_DIRECTION castle',
      companion: {
        id: 'friend',
        name: 'MALICIOUS_COMPANION dragon',
        visualDescription: 'MALICIOUS_COMPANION castle dragon',
        image: 'https://fixtures.invalid/companion.png',
      },
      referenceImages: [
        'https://fixtures.invalid/child.png',
        'https://fixtures.invalid/wrong-extra-cast.png',
      ],
    });
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    const providerInput = generateGptSpy.mock.calls[0][0] as { finalPrompt: string; referenceImages: string[] };
    expect(providerInput.finalPrompt).toContain('REALITY MODE (reviewer-owned): grounded');
    expect(providerInput.finalPrompt).toContain('Neighborhood clinic');
    expect(providerInput.finalPrompt).toContain('Exam room');
    expect(providerInput.finalPrompt).toContain('no clothing');
    expect(providerInput.finalPrompt).not.toMatch(/MALICIOUS_/);
    expect(providerInput.finalPrompt).not.toMatch(/home-night|moonlit home/i);
    expect(providerInput.finalPrompt).not.toMatch(/sky-blue t-shirt|RED sneakers/);
    expect(providerInput.referenceImages).toContain('https://fixtures.invalid/set-clinic.png');
    expect(providerInput.referenceImages).toContain('https://fixtures.invalid/child.png');
    expect(providerInput.referenceImages).not.toContain('https://fixtures.invalid/wrong-board.png');
    expect(providerInput.referenceImages).not.toContain('https://fixtures.invalid/wrong-extra-cast.png');
  });

  it('reapplies exact authority to each verified-QA regeneration attempt', async () => {
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'true');
    vi.stubEnv('PAGE_VISUAL_QA_MAX_REGENS', '1');
    evaluateQaSpy.mockResolvedValueOnce(qaResult(false)).mockResolvedValueOnce(qaResult(true));
    const reserveQualityRegen = vi.fn(async () => true);

    await generateImage({ ...imageInput(authority()), reserveQualityRegen });

    expect(reserveQualityRegen).toHaveBeenCalledTimes(1);
    expect(evaluateQaSpy).toHaveBeenCalledTimes(2);
    expect(generateGptSpy).toHaveBeenCalledTimes(2);
    for (const call of generateGptSpy.mock.calls) {
      const providerInput = call[0] as { finalPrompt: string; referenceImages: string[] };
      expect(providerInput.finalPrompt).toContain('REALITY MODE (reviewer-owned): grounded');
      expect(providerInput.finalPrompt).toContain('Neighborhood clinic');
      expect(providerInput.finalPrompt).not.toMatch(/MALICIOUS_/);
      expect(providerInput.referenceImages).toContain('https://fixtures.invalid/set-clinic.png');
      expect(providerInput.referenceImages).not.toContain('https://fixtures.invalid/wrong-extra-cast.png');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects stale, incomplete, missing-page, and wrong-board authority at the caller before provider invocation', async () => {
    const stale = authority();
    stale.packageBinding = { ...stale.packageBinding, sourceDigest: 'stale-source' };
    await expect(generateImage(imageInput(stale))).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);

    const staleReconciliation = authority();
    staleReconciliation.qualification.manifest!.reconciliation.digest = 'changed-reconciliation';
    await expect(generateImage(imageInput(staleReconciliation))).rejects.toBeInstanceOf(
      RuntimeVisualAuthorityBoundaryError,
    );

    const changedWorld = authority();
    changedWorld.contract.locations[0].name = 'Changed physical world';
    changedWorld.contractHash = computeVisualContractHash(changedWorld.contract);
    changedWorld.boardBindings!.frozenContractHash = changedWorld.contractHash;
    await expect(generateImage(imageInput(changedWorld))).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);

    await expect(generateImage({ ...imageInput(authority()), pageNumber: 2 })).rejects.toBeInstanceOf(
      RuntimeVisualAuthorityBoundaryError,
    );

    const wrongBoard = authority();
    wrongBoard.boardBindings!.bindings.set_clinic.assetSha256 = 'wrong-bytes';
    await expect(generateImage(imageInput(wrongBoard))).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);

    const incompleteWorld = authority();
    incompleteWorld.qualification.template!.locations[0].lighting = '';
    await expect(generateImage(imageInput(incompleteWorld))).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    expect(generateGptSpy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('the bounded Director projection contains presentation vocabulary only', () => {
    const bounded = constrainSceneBlockingToPresentation({
      blocking: 'MALICIOUS_CAST rides a dragon in a castle at foreground-left',
      interaction: 'summoning a dragon while reaching',
      eyeline: 'toward MALICIOUS_PROP on the right',
      emotion: 'curious inside MALICIOUS_REALITY',
    });
    expect(JSON.stringify(bounded)).not.toMatch(/MALICIOUS_|dragon|castle/);
    expect(bounded.blocking).toContain('foreground-left');
    expect(bounded.interaction).toContain('reaching');
    expect(bounded.emotion).toBe('curious');
  });

  it('keeps the protected effective Style01 page resemblance threshold at 0.70', () => {
    const config = resolveResemblanceThresholdConfig();
    expect(resolveEffectiveThreshold('pencil_watercolor', config)).toBe(0.7);
  });

  it('preserves enforcement-off and production-hard-off legacy behavior at the shared provider seam', async () => {
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    await expect(generateImage(imageInput(null))).resolves.toMatchObject({ provider: 'gpt-image-1' });

    generateGptSpy.mockClear();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    await expect(generateImage(imageInput(null))).resolves.toMatchObject({ provider: 'gpt-image-1' });
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
  });
});
