import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageInput } from '@/backend/providers/image';
import {
  generateAllPageImages,
  generateBookCover,
  generateImage,
} from '@/backend/providers/image';
import {
  buildPvbVisualContractFactsPromptBlock,
  buildVisualContractPromptBlock,
  computeVisualContractHash,
  materialize,
  type ResolvedFamilyAppearanceProfile,
} from '@/lib/visual-contract-compiler';
import {
  buildFrozenVisualPackageAuthority,
  canonicalJsonDigest,
} from '@/lib/visual-package';
import {
  bindApprovedPvbRuntimeAuthority,
  buildApprovedPvbRuntimeAuthorityBinding,
  runtimeWorldProjectionDigest,
} from '@/lib/visual-package/runtimeAuthority';
import { buildVisualPackageV4Fixture } from '@/lib/visual-package/__tests__/visual-package-v4.fixtures';
import type { BlueprintFixtureShape } from '@/lib/visual-package/__tests__/pre-render-book-visual-blueprint.fixtures';
import {
  assembleStyle01Phase2Prompt,
  buildPvbTypedActionGeometryBlock,
} from '@/lib/style01-prompt-assembly';
import {
  STYLE_01_ANTI_STYLE02,
  STYLE_01_RENDERING_CORRECTION,
} from '@/lib/style01-gptimage';
import { buildStyle01AnatomyIntegrityLock } from '@/lib/style01-visual-polish';
import { CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY } from '@/lib/companion-appearance-state';

import {
  RuntimeBlueprintCanvasError,
  resolveRuntimeBlueprintProviderCanvas,
} from '../runtime-blueprint-canvas';
import { generateSinglePageWithRuntimeCanvas } from '../../single-page-image-regen';
import {
  buildRuntimeBlueprintFrameEvidence,
  buildRuntimeBlueprintBookProjection,
  requireRuntimeBlueprintFrame,
} from '../runtime-blueprint-projection';
import type { Style01RuntimeAuthority } from '../render-qualification-preflight';
import {
  RuntimeVisualAuthorityBoundaryError,
  assertStyle01RuntimeAuthorityForPage,
  buildRuntimePageAuthorityProjection,
} from '../runtime-visual-authority';

const { evaluateQaSpy, generateGptSpy, storeBufferSpy } = vi.hoisted(() => ({
  evaluateQaSpy: vi.fn(),
  generateGptSpy: vi.fn(),
  storeBufferSpy: vi.fn(),
}));

vi.mock('@/lib/generation-pipeline/page-visual-qa', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/lib/generation-pipeline/page-visual-qa')
  >()),
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

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

const FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

function authority(
  shape: BlueprintFixtureShape = 'no_companion',
  options?: Parameters<typeof buildVisualPackageV4Fixture>[2],
): Style01RuntimeAuthority {
  const { packageValue } =
    buildVisualPackageV4Fixture(shape, undefined, options);
  const packagePath = `visual-packages/approved/revisions/${packageValue.revisionDigest}.visual-package.json`;
  const frozenAuthority = buildFrozenVisualPackageAuthority({
    packageValue,
    packagePath,
  });
  const contract = bindApprovedPvbRuntimeAuthority(
    materialize(
      structuredClone(packageValue.visualContractTemplate.content),
      FAMILY,
    ),
    packageValue,
    frozenAuthority,
  );
  const contractHash = computeVisualContractHash(contract);
  const bookProjection = buildRuntimeBlueprintBookProjection({
    packageValue,
    frozenAuthority,
    contract,
  });
  return {
    version: 'style01-runtime-authority/v7',
    repoRoot: process.cwd(),
    qualification: {
      storyKey: packageValue.storyKey,
      styleId: packageValue.styleId,
      approvedPackagePath: packagePath,
      renderQualified: true,
      reasons: [],
      packageValue,
      template: packageValue.visualContractTemplate.content,
      frozenAuthority,
      orderVisualPackageAuthorityRequired: false,
    },
    packageValue,
    frozenAuthority,
    contract,
    contractHash,
    packageBinding: buildApprovedPvbRuntimeAuthorityBinding({
      packageValue,
      frozen: frozenAuthority,
    }),
    bookProjection,
    orderVisualPackageAuthorityRequired: false,
  };
}

function imageInput(
  runtimeAuthority?: Style01RuntimeAuthority | null,
): ImageInput {
  const contract = runtimeAuthority?.contract;
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
    operatorNote:
      'MALICIOUS_OPERATOR move the camera and add a dragon in the background',
    directionArchetype: 'fantasy',
    directionStoryPremise: 'MALICIOUS_DIRECTION_WORLD',
    childDescription: 'round child face; wavy dark hair; warm brown skin',
    childFirstName: contract?.cast.child.name ?? 'Noa',
    childAge: 6,
    childGender: 'girl',
    referenceImages: ['https://fixtures.invalid/child.png'],
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
      mustNotInclude: ['approved world'],
      camera: 'wrong camera',
      composition: 'wrong composition',
    },
    pageIntent: {
      type: 'action_page',
      focus: 'hero',
      camera: 'close',
      background: 'full',
      emotion: 'tension',
    },
    compositionRules:
      'MALICIOUS_COMPOSITION_OVERRIDE use a close-up and top text',
    storyFile: 'dragon_story_specific',
    direction: 'fantasy',
  };
}

function authorityWithConflictingContractSteering(): Style01RuntimeAuthority {
  return authority('no_companion', {
    mutateTemplate(template) {
      const page = template.pageContracts.find(
        (candidate) => candidate.pageNumber === 1,
      );
      if (!page) throw new Error('fixture page 1 missing');
      page.camera =
        'CONFLICTING_CONTRACT_CAMERA extreme overhead close-up with centered symmetry';
      page.castStates = [
        {
          castId: template.cast.child.id,
          bodyState:
            'CONFLICTING_CONTRACT_ACTION kneeling and posing toward the camera',
          injectionArm: 'left',
          freeHand: 'right',
        },
      ];
    },
  });
}

function qaResult(pass: boolean) {
  return {
    passed: pass,
    verdict: pass ? ('passed' as const) : ('failed' as const),
    reason: pass ? ('ok' as const) : ('object_geometry_failed' as const),
    details: pass ? 'synthetic pass' : 'synthetic retry',
    flags: {
      anatomyOk: true,
      identityOk: true,
      styleOk: true,
      singleChildOk: true,
      objectGeometryOk: pass,
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

describe('R1D-PVB-C shared runtime Blueprint authority', () => {
  beforeEach(() => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'true');
    vi.stubEnv('PHASE2_STYLE01_BOOK_PIPELINE', 'true');
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'false');
    vi.stubEnv('STYLE_01_GPT_MODEL', 'gpt-image-1');
    vi.stubEnv('GPT_IMAGE_QUALITY', 'low');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('network must be unreachable in PVB tests');
      }),
    );
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
    storeBufferSpy.mockResolvedValue(
      'https://fixtures.invalid/render.png',
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports the exact v5 runtime-authority requirement for absent or stale authority', () => {
    const expectedMessage =
      '[runtime_world_authority:runtime_authority_missing] required Style01 provider call has no style01-runtime-authority/v7 preflight-issued authority';
    expect(() =>
      assertStyle01RuntimeAuthorityForPage({
        illustrationStyle: 'soft_hand_drawn_storybook',
        authority: null,
        pageNumber: 1,
      }),
    ).toThrowError(expectedMessage);

    const staleAuthority = {
      ...authority(),
      version: 'style01-runtime-authority/v4',
    } as unknown as Style01RuntimeAuthority;
    expect(() =>
      assertStyle01RuntimeAuthorityForPage({
        illustrationStyle: 'soft_hand_drawn_storybook',
        authority: staleAuthority,
        pageNumber: 1,
      }),
    ).toThrowError(expectedMessage);
  });

  it('keeps the package-required provider fence active in Production with enforcement off', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    await expect(
      generateImage({
        ...imageInput(null),
        runtimeVisualAuthorityRequired: true,
      }),
    ).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    await expect(
      generateBookCover({
        childName: 'Noa',
        topicLabel: 'Courage',
        storyTitle: 'Fixture',
        illustrationStyle: 'soft_hand_drawn_storybook',
        runtimeVisualAuthorityRequired: true,
      }),
    ).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    expect(generateGptSpy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a legacy runtime authority when the provider call claims Order-frozen package authority', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    expect(() =>
      assertStyle01RuntimeAuthorityForPage({
        illustrationStyle: 'soft_hand_drawn_storybook',
        authority: authority(),
        runtimeVisualAuthorityRequired: true,
        pageNumber: 1,
      }),
    ).toThrow(/received a legacy runtime authority/);
  });

  it('blocks direct page and cover provider entry before provider reachability when v5 authority is absent', async () => {
    await expect(generateImage(imageInput(null))).rejects.toBeInstanceOf(
      RuntimeVisualAuthorityBoundaryError,
    );
    await expect(
      generateBookCover({
        childName: 'Noa',
        topicLabel: 'Courage',
        storyTitle: 'Fixture',
        illustrationStyle: 'soft_hand_drawn_storybook',
      }),
    ).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    expect(generateGptSpy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('projects exact package, Blueprint, frame, source, approval, layout, camera, placements and resolved appearance', () => {
    const runtime = authority();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const page = buildRuntimePageAuthorityProjection({
      illustrationStyle: 'soft_hand_drawn_storybook',
      authority: runtime,
      pageNumber: 1,
      requestedVisualDirection: imageInput(runtime).visualDirection,
    });
    expect(page?.blueprintFrame.projectionDigest).toBe(
      frame.projectionDigest,
    );
    expect(page?.blueprintFrame).toMatchObject({
      packageRevisionDigest: runtime.packageValue.revisionDigest,
      blueprintDigest: runtime.packageValue.blueprint.digest,
      frameId: frame.frameId,
      frameDigest: frame.frameDigest,
      planningApprovalDigest:
        runtime.packageValue.planningApproval.content.digest,
      camera: frame.camera,
      placements: frame.placements,
      layoutPlan: {
        aspectRatio: '2:3',
        textZone: 'bottom_clear',
        remapPolicy: 'reject',
      },
    });
    expect(page?.visualDirection.camera).toBe(
      `${frame.camera.shot} ${frame.camera.angle}`,
    );
    expect(page?.safeScenePrompt).not.toMatch(/MALICIOUS_|castle|dragon/);
  });

  it('projects an exact typed into relation as mandatory provider geometry', () => {
    const runtime = authority();
    const frame = structuredClone(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1),
    );
    const checkId = 'action:page_1_water_enters_container';
    const targetId = 'prop:container';
    frame.contractPage.actionRequirements = [
      {
        checkId,
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId: `se1_${'a'.repeat(64)}`,
          sourcePhrase: 'one drop falls',
        },
        predicate: 'moves',
        object: { kind: 'prop', id: 'prop:moving_drop' },
        spatialEffect: {
          kind: 'relation',
          relation: 'into',
          target: { kind: 'prop', id: targetId },
        },
        polarity: 'must',
      },
    ];
    frame.placements.push(
      {
        id: 'placement:action:origin',
        subject: { kind: 'action', checkId },
        region: { x: 480, y: 280, width: 80, height: 320 },
        depth: 'midground',
        importance: 'key',
      },
      {
        id: 'placement:action:destination',
        subject: { kind: 'action_destination', checkId },
        region: { x: 500, y: 590, width: 30, height: 30 },
        depth: 'foreground',
        importance: 'key',
      },
      {
        id: 'placement:target',
        subject: { kind: 'prop', propId: targetId },
        region: { x: 450, y: 560, width: 150, height: 170 },
        depth: 'foreground',
        importance: 'key',
      },
    );

    const block = buildPvbTypedActionGeometryBlock(frame);
    expect(block).toContain(
      '[PVB TYPED ACTION GEOMETRY — STRUCTURAL AUTHORITY]',
    );
    expect(block).toContain('"relation":"into"');
    expect(block).toContain('"targetRegion":{"height":170');
    expect(block).toContain(
      'entry must pass through its visible opening',
    );
    expect(block).toContain('do not add a contradictory duplicate path');

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: frame.pageNumber,
      authoritativeBlueprintFrame: frame,
    });
    expect(assembled.compositionBlock).toContain(block);
    expect(assembled.prompt).toContain(
      '[PVB TYPED ACTION GEOMETRY — STRUCTURAL AUTHORITY]',
    );
    expect(assembled.prompt).toContain('"relation":"into"');
  });

  it('does not invent geometry for non-spatial or incomplete actions', () => {
    const runtime = authority();
    const frame = structuredClone(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1),
    );
    expect(buildPvbTypedActionGeometryBlock(frame)).toBe('');

    const action = frame.contractPage.actionRequirements?.[0];
    if (!action) throw new Error('expected action fixture');
    action.spatialEffect = { kind: 'directional', direction: 'down' };
    frame.placements = frame.placements.filter(
      (placement) => placement.subject.kind !== 'action_destination',
    );
    expect(buildPvbTypedActionGeometryBlock(frame)).toBe('');
  });

  it('keeps watercolor illustration while requiring naturalistic child anatomy', () => {
    expect(STYLE_01_RENDERING_CORRECTION).toContain(
      'observational semi-naturalistic human drawing',
    );
    expect(STYLE_01_RENDERING_CORRECTION).not.toContain(
      'rounded expressive characters',
    );
    expect(STYLE_01_ANTI_STYLE02).toContain('NOT chibi');
    expect(STYLE_01_ANTI_STYLE02).toContain('NOT photoreal skin');
    expect(buildStyle01AnatomyIntegrityLock()).toContain(
      'ordinary-size eyes with visible eyelids',
    );
    expect(buildStyle01AnatomyIntegrityLock()).toContain(
      'clearly hand-painted in watercolor',
    );
  });

  it.each<BlueprintFixtureShape>([
    'single_location',
    'multi_zone_transition',
    'journey_fantastical',
    'no_companion',
    'reveal_timeline',
  ])(
    'uses the same public runtime projection path for synthetic Story Source shape %s',
    (shape) => {
      const runtime = authority(shape);
      expect(runtime.bookProjection.frames).toHaveLength(
        runtime.packageValue.blueprint.content.frames.length,
      );
      for (const projected of runtime.bookProjection.frames) {
        const evidence = buildRuntimeBlueprintFrameEvidence(
          runtime.bookProjection,
          projected.pageNumber,
        );
        expect(evidence).toMatchObject({
          packageRevisionDigest: runtime.packageValue.revisionDigest,
          blueprintDigest: runtime.packageValue.blueprint.digest,
          sourceRawDigest: runtime.packageValue.sourceSnapshot.rawDigest,
          bookProjectionDigest: runtime.bookProjection.projectionDigest,
          frameId: projected.frameId,
          frameDigest: projected.frameDigest,
          frameProjectionDigest: projected.projectionDigest,
        });
      }
    },
  );

  it('provider prompt uses only the exact PVB frame and discards story/free-text composition overrides', async () => {
    const runtime = authority();
    const result = await generateImage(imageInput(runtime));
    expect(result).toMatchObject({
      provider: 'gpt-image-1',
    });
    expect(result.style01Meta?.runtimeBlueprintEvidence).toEqual(
      buildRuntimeBlueprintFrameEvidence(runtime.bookProjection, 1),
    );
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    const providerInput = generateGptSpy.mock.calls[0][0] as {
      finalPrompt: string;
    };
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    expect(providerInput.finalPrompt).toContain(
      '[PVB RUNTIME FRAME — SOLE WORLD/COMPOSITION AUTHORITY]',
    );
    expect(providerInput.finalPrompt).toContain(frame.frameId);
    expect(providerInput.finalPrompt.match(/\[PVB RUNTIME FRAME/g)).toHaveLength(1);
    expect(providerInput.finalPrompt.match(/=== VISUAL CONTRACT FACTS/g)).toHaveLength(1);
    expect(providerInput.finalPrompt).toContain(frame.frameDigest);
    expect(providerInput.finalPrompt).toContain(
      runtime.packageValue.revisionDigest,
    );
    expect(providerInput.finalPrompt).not.toMatch(
      /MALICIOUS_|wrong camera|wrong composition|dragon_story_specific/,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('removes internal spatial markers from active narrative, location, forbidden, and final provider prompt paths only', async () => {
    const markedVisible =
      'the child looks across the stable clear floor plane [spatial:floor]';
    const markedForbidden =
      'the child must not cross the stable clear floor plane [spatial:floor]';
    const markedNarrative =
      'The child pauses beside the stable clear floor plane [spatial:floor]';
    const markedGlobalForbidden =
      'keep every character away from [spatial:floor]';
    const runtime = authority('no_companion', {
      mutateTemplate(template) {
        template.pageContracts[0]!.mustShow.push(markedVisible);
        template.pageContracts[0]!.mustNotShow.push(markedForbidden);
        template.forbiddenGlobalElements.push(markedGlobalForbidden);
      },
      mutateWorld({ frames }) {
        const frame = frames.find(
          (candidate) =>
            candidate.kind === 'page' && candidate.pageNumber === 1,
        );
        if (!frame) throw new Error('fixture page frame 1 missing');
        frame.narrative.summary = markedNarrative;
      },
    });
    const canonicalPage = runtime.contract.pageContracts[0]!;
    const canonicalFrame = runtime.packageValue.blueprint.content.frames.find(
      (candidate) =>
        candidate.kind === 'page' && candidate.pageNumber === 1,
    )!;
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);

    expect(canonicalPage.mustShow).toContain(markedVisible);
    expect(canonicalPage.mustNotShow).toContain(markedForbidden);
    expect(runtime.contract.forbiddenGlobalElements).toContain(
      markedGlobalForbidden,
    );
    expect(canonicalFrame.narrative.summary).toBe(markedNarrative);
    expect(frame.narrative.summary).toBe(
      'The child pauses beside the stable clear floor plane',
    );
    expect(frame.pageLocationPlan.visibleAnchors).toContain(
      'the child looks across the stable clear floor plane',
    );
    expect(frame.pageLocationPlan.forbiddenDrift).toContain(
      'the child must not cross the stable clear floor plane',
    );
    expect(frame.entityPresence.forbiddenEntities).toContain(
      'the child must not cross the stable clear floor plane',
    );
    expect(frame.entityPresence.forbiddenEntities).toContain(
      'keep every character away from the stable clear floor plane',
    );
    expect(frame.visualDirection.mustNotInclude).toContain(
      'keep every character away from the stable clear floor plane',
    );
    expect(frame.locationBible.forbiddenDrift).toContain(
      'keep every character away from the stable clear floor plane',
    );
    expect(JSON.stringify(frame.pageLocationPlan)).not.toContain('[spatial:');
    expect(JSON.stringify(frame.entityPresence)).not.toContain('[spatial:');
    expect(frame.blueprintPromptBlock).not.toContain('[spatial:');

    await generateImage(imageInput(runtime));
    const providerInput = generateGptSpy.mock.calls[0][0] as {
      finalPrompt: string;
    };
    expect(providerInput.finalPrompt).toContain(
      'the stable clear floor plane',
    );
    expect(providerInput.finalPrompt).not.toContain('[spatial:');
  });

  it('enforced prompt keeps contract world facts but excludes conflicting contract camera, body state, laterality and action authority', async () => {
    const runtime = authorityWithConflictingContractSteering();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    await generateImage(imageInput(runtime));

    const providerInput = generateGptSpy.mock.calls[0][0] as {
      finalPrompt: string;
    };
    expect(providerInput.finalPrompt).toContain(frame.frameId);
    expect(providerInput.finalPrompt).toContain(
      `camera ${frame.camera.shot}/${frame.camera.angle}`,
    );
    expect(providerInput.finalPrompt).toContain('LOCATION:');
    expect(providerInput.finalPrompt).toContain('ZONE:');
    expect(providerInput.finalPrompt).toContain('CAST PRESENT:');
    expect(providerInput.finalPrompt).toContain('CHILD WARDROBE (locked):');
    expect(providerInput.finalPrompt).not.toMatch(
      /CONFLICTING_CONTRACT_CAMERA|CONFLICTING_CONTRACT_ACTION/,
    );
    expect(providerInput.finalPrompt).not.toMatch(
      /^CAMERA \/ ACTION:|^BODY STATE:|^LATERALITY:|^ACTION BEATS:/m,
    );
    expect(providerInput.finalPrompt).toContain(
      'Blueprint frame is the sole authority for camera, action, composition, staging, pose, blocking, eyeline, placements, and page layout.',
    );
  });

  it('keeps the enforcement-off legacy contract prompt unchanged while PVB uses the typed facts-only projection', () => {
    const runtime = authorityWithConflictingContractSteering();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const legacyBlock = buildVisualContractPromptBlock(
      frame.contractPage,
      runtime.contract,
    );
    const factsOnlyBlock = buildPvbVisualContractFactsPromptBlock(
      frame.contractPage,
      runtime.contract,
    );

    expect(legacyBlock).toContain(
      'CAMERA / ACTION: CONFLICTING_CONTRACT_CAMERA',
    );
    expect(legacyBlock).toContain(
      'BODY STATE: the child CONFLICTING_CONTRACT_ACTION',
    );
    expect(legacyBlock).toContain('LATERALITY:');
    expect(legacyBlock).toContain('ACTION BEATS:');
    expect(factsOnlyBlock).toBe(frame.contractPromptBlock);
    expect(factsOnlyBlock).not.toMatch(
      /CAMERA \/ ACTION:|BODY STATE:|LATERALITY:|ACTION BEATS:/,
    );
  });

  it('projects an explicit page wardrobe transition into the runtime frame and page authority only on that page', () => {
    const pajamas =
      'Soft two-piece sage-green pajamas with a small cream moon print, matching pajama trousers, and cream slipper-socks.';
    const runtime = authority('no_companion', {
      mutateTemplate(template) {
        template.pageContracts[0]!.childWardrobeOverride = {
          description: pajamas,
          forbidden: ['day clothes', 'outdoor shoes'],
          origin: {
            kind: 'authored',
            authorNote: 'Reviewed bedtime wardrobe transition.',
          },
        };
      },
    });
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const pageAuthority = buildRuntimePageAuthorityProjection({
      authority: runtime,
      pageNumber: 1,
    });
    expect(pageAuthority).not.toBeNull();
    if (!pageAuthority) throw new Error('expected runtime page authority');

    expect(frame.resolvedChildWardrobe).toEqual({
      description: pajamas,
      forbidden: ['day clothes', 'outdoor shoes'],
    });
    expect(pageAuthority.childCast.wardrobe).toEqual(
      frame.resolvedChildWardrobe,
    );
    expect(frame.contractPromptBlock).toContain(pajamas);
    expect(frame.contractPromptBlock).not.toContain(
      'the same practical story outfit on every page',
    );
  });

  it('keeps Kim canonical mustard satchel mandatory in the authoritative Blueprint prompt whenever she is visible', () => {
    const runtime = authority('single_location');
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    expect(frame.entityPresence.companionPresence).toBe('present');

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      authoritativeBlueprintFrame: frame,
      companion: {
        id: 'chameleon_koko',
        name: 'Kim',
        visualDescription: 'A small natural green chameleon.',
      },
    });

    expect(assembled.prompt).toContain(
      'tiny fabric shoulder satchel in warm mustard',
    );
    expect(assembled.prompt).toContain(
      'Do not add, remove, restyle, resize, substitute, or omit a required canonical accessory.',
    );
  });

  it('carries frozen typed companion state through Blueprint runtime authority into the final provider prompt', () => {
    const runtime = authority('single_location', {
      mutateTemplate(template) {
        const companion = template.cast.companion;
        if (!companion) throw new Error('companion fixture missing');
        const authority = structuredClone(
          CHAMELEON_KOKO_APPEARANCE_STATE_AUTHORITY,
        );
        authority.companionId = companion.id;
        authority.subjectAliases = [companion.id, 'Guide'];
        companion.companionAppearanceStateAuthority = authority;
        template.pageContracts[0]!.companionStateOverride = {
          stateId: 'alert_olive_shift',
          origin: {
            kind: 'authored',
            authorNote: 'Offline runtime projection fixture.',
          },
        };
      },
    });
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const pageAuthority = buildRuntimePageAuthorityProjection({
      authority: runtime,
      pageNumber: 1,
    });
    if (!pageAuthority) throw new Error('runtime page authority missing');

    expect(frame.resolvedCompanionState?.id).toBe('alert_olive_shift');
    expect(pageAuthority.resolvedCompanionState).toEqual(
      frame.resolvedCompanionState,
    );
    expect(frame.contractPromptBlock).toContain('alert_olive_shift');

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      authoritativeBlueprintFrame: frame,
      companion: {
        id: 'companion:guide',
        name: 'Guide',
        visualDescription:
          'LEGACY_FIXED_GREEN_DESCRIPTION_MUST_NOT_REACH_PROVIDER',
      },
    });
    expect(assembled.prompt).toContain('stateId=alert_olive_shift');
    expect(assembled.prompt).toContain(
      'one harmonious muted olive-green body tone',
    );
    expect(assembled.prompt).toContain(
      'tiny warm-mustard fabric shoulder satchel',
    );
    expect(assembled.prompt).not.toContain(
      'LEGACY_FIXED_GREEN_DESCRIPTION_MUST_NOT_REACH_PROVIDER',
    );
  });

  it('authoritative direct provider canvas ignores conflicting PDF optimization and stays exact portrait', async () => {
    const runtime = authority();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    await generateImage({
      ...imageInput(runtime),
      printPdfOptimized: true,
    });

    expect(frame.layoutPlan).toMatchObject({
      aspectRatio: '2:3',
      remapPolicy: 'reject',
    });
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(generateGptSpy.mock.calls[0][0]).toMatchObject({
      size: '1024x1536',
    });
  });

  it('rejects an unrepresentable authoritative layout at the provider seam before the provider mock', async () => {
    const runtime = authority();
    const approved = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    const malformedFrames = [
      (() => {
        const frame = structuredClone(approved) as unknown as {
          layoutPlan: { aspectRatio: string };
        };
        frame.layoutPlan.aspectRatio = '1:1';
        return frame;
      })(),
      (() => {
        const frame = structuredClone(approved) as unknown as {
          layoutPlan: { remapPolicy: string };
        };
        frame.layoutPlan.remapPolicy = 'quantize';
        return frame;
      })(),
      (() => {
        const frame = structuredClone(approved) as unknown as {
          layoutPlan: { textZone: string };
        };
        frame.layoutPlan.textZone = 'top_clear';
        return frame;
      })(),
    ];

    for (const malformed of malformedFrames) {
      await expect(
        generateImage({
          ...imageInput(null),
          runtimeBlueprintFrame:
            malformed as typeof approved,
          printPdfOptimized: true,
        }),
      ).rejects.toThrow(RuntimeBlueprintCanvasError);
    }
    expect(generateGptSpy).not.toHaveBeenCalled();
  });

  it('accepts the same supported body-band range as Visual Package without remapping it', () => {
    const runtime = authority();
    const frame = structuredClone(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1),
    );
    frame.layoutPlan.textSafeRegion = {
      x: 0,
      y: 650,
      width: 1000,
      height: 350,
    };
    expect(
      resolveRuntimeBlueprintProviderCanvas({
        frame,
        legacyCanvas: '1024x1024',
      }),
    ).toBe('1024x1536');
    expect(frame.layoutPlan.textSafeRegion).toEqual({
      x: 0,
      y: 650,
      width: 1000,
      height: 350,
    });
  });

  it('authoritative batch canvas stays portrait when the order is PDF-enabled', async () => {
    const runtime = authority();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const outcome = await generateAllPageImages(
      [
        {
          pageNumber: 1,
          imagePrompt: frame.safeScenePrompt,
          expectedCharacterIds: [...frame.castIds],
          runtimeBlueprintFrame: frame,
        },
      ],
      {
        illustrationStyle: 'soft_hand_drawn_storybook',
        runtimeVisualAuthority: runtime,
        childName: runtime.contract.cast.child.name,
        childDescription: 'round child face',
        referenceImages: ['https://fixtures.invalid/child.png'],
        initialCharacterAnchors: {
          child: 'https://fixtures.invalid/child.png',
        },
        pdfEnabled: true,
      },
    );

    expect(outcome.failedPages).toEqual([]);
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(generateGptSpy.mock.calls[0][0]).toMatchObject({
      size: '1024x1536',
    });
  });

  it('single-page PDF adaptation reuses the frozen frame/digest and reaches the shared provider as portrait', async () => {
    const runtime = authority();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const frameDigestBefore = frame.projectionDigest;

    const outcome = await generateSinglePageWithRuntimeCanvas({
      pages: [
        {
          pageNumber: 1,
          imagePrompt: frame.safeScenePrompt,
          expectedCharacterIds: [...frame.castIds],
          runtimeBlueprintFrame: frame,
        },
      ],
      config: {
        illustrationStyle: 'soft_hand_drawn_storybook',
        runtimeVisualAuthority: runtime,
        childName: runtime.contract.cast.child.name,
        childDescription: 'round child face',
        referenceImages: ['https://fixtures.invalid/child.png'],
        initialCharacterAnchors: {
          child: 'https://fixtures.invalid/child.png',
        },
      },
      approvedBlueprintFrame: frame,
      orderPdfEnabled: true,
    });

    expect(frame.projectionDigest).toBe(frameDigestBefore);
    expect(outcome.results.get(1)?.style01Meta?.runtimeBlueprintEvidence)
      .toEqual(buildRuntimeBlueprintFrameEvidence(runtime.bookProjection, 1));
    expect(generateGptSpy.mock.calls[0][0]).toMatchObject({
      size: '1024x1536',
    });
  });

  it('cover consumes the same immutable book projection with its exact top text-safe frame', async () => {
    const runtime = authority();
    await generateBookCover({
      childName: runtime.contract.cast.child.name ?? 'Noa',
      topicLabel: 'MALICIOUS_TOPIC',
      storyTitle: 'MALICIOUS_TITLE',
      coverText: 'MALICIOUS_COVER_TEXT',
      coverSceneHint: 'MALICIOUS_CLOSE_UP',
      illustrationStyle: 'soft_hand_drawn_storybook',
      runtimeVisualAuthority: runtime,
      childDescription: 'round child face',
      referenceImages: ['https://fixtures.invalid/child.png'],
      printPdfOptimized: true,
    });
    const coverFrame = requireRuntimeBlueprintFrame(
      runtime.bookProjection,
      0,
    );
    const prompt = (
      generateGptSpy.mock.calls[0][0] as { finalPrompt: string }
    ).finalPrompt;
    expect(coverFrame.layoutPlan.textZone).toBe('top_clear');
    expect(prompt).toContain(coverFrame.frameId);
    expect(prompt).toContain(coverFrame.frameDigest);
    expect(prompt).not.toMatch(/MALICIOUS_/);
    expect(generateGptSpy.mock.calls[0][0]).toMatchObject({
      size: '1024x1536',
    });
  });

  it('QA regeneration cannot change the exact frame projection or composition prompt', async () => {
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'true');
    evaluateQaSpy
      .mockResolvedValueOnce(qaResult(false))
      .mockResolvedValueOnce(qaResult(true));
    const reserveQualityRegen = vi.fn().mockResolvedValue(true);
    const runtime = authority();
    const result = await generateImage({
      ...imageInput(runtime),
      reserveQualityRegen,
    });
    expect(generateGptSpy).toHaveBeenCalledTimes(2);
    const prompts = generateGptSpy.mock.calls.map(
      (call) => (call[0] as { finalPrompt: string }).finalPrompt,
    );
    expect(prompts[1]).toBe(prompts[0]);
    expect(
      generateGptSpy.mock.calls.map((call) => (call[0] as { size: string }).size),
    ).toEqual(['1024x1536', '1024x1536']);
    expect(prompts[0]).toContain(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1).frameDigest,
    );
    expect(result.style01Meta?.runtimeBlueprintEvidence).toEqual(
      buildRuntimeBlueprintFrameEvidence(runtime.bookProjection, 1),
    );
  });

  it('batch path succeeds with Director enabled while returning a deterministic Blueprint storyboard', async () => {
    vi.stubEnv('USE_DIRECTOR_LAYER', 'true');
    const runtime = authority();
    const frame = requireRuntimeBlueprintFrame(runtime.bookProjection, 1);
    const outcome = await generateAllPageImages(
      [
        {
          pageNumber: 1,
          imagePrompt: 'MALICIOUS_STORYBOARD_INPUT',
          rawScenePrompt: 'MALICIOUS_RAW',
          bookPageText: 'MALICIOUS_BOOK_TEXT',
          pageIntent: {
            type: 'action_page',
            focus: 'hero',
            camera: 'close',
            background: 'full',
            emotion: 'tension',
          },
        },
      ],
      {
        illustrationStyle: 'soft_hand_drawn_storybook',
        runtimeVisualAuthority: runtime,
        childName: runtime.contract.cast.child.name,
        childDescription: 'round child face',
        referenceImages: ['https://fixtures.invalid/child.png'],
        initialCharacterAnchors: {
          child: 'https://fixtures.invalid/child.png',
        },
      },
    );
    expect(outcome.failedPages).toEqual([]);
    expect(outcome.storyboardPlan).toEqual([
      expect.objectContaining({
        pageNumber: 1,
        shotType: frame.camera.shot,
        cameraAngle: frame.camera.angle,
        textZone: 'bottom_clear',
        action: frame.narrative.summary,
      }),
    ]);
    expect(generateGptSpy).toHaveBeenCalledTimes(1);
    expect(
      (generateGptSpy.mock.calls[0][0] as { finalPrompt: string }).finalPrompt,
    ).not.toMatch(/MALICIOUS_/);
  }, 10_000);

  it('rejects changed package binding, changed book projection, and missing frames before provider calls', async () => {
    const staleBinding = authority();
    staleBinding.packageBinding.packageRevisionDigest = 'f'.repeat(64);
    await expect(generateImage(imageInput(staleBinding))).rejects.toBeInstanceOf(
      RuntimeVisualAuthorityBoundaryError,
    );

    const staleProjection = authority();
    staleProjection.bookProjection.frames[0].camera.shot = 'close_up';
    await expect(
      generateImage(imageInput(staleProjection)),
    ).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);

    const missingPage = authority();
    await expect(
      generateImage({ ...imageInput(missingPage), pageNumber: 99 }),
    ).rejects.toBeInstanceOf(RuntimeVisualAuthorityBoundaryError);
    expect(generateGptSpy).not.toHaveBeenCalled();
  });

  it('keeps runtime world digest sensitive to reviewed geometry and preserves enforcement-off development behavior', async () => {
    const runtime = authority();
    const changed = structuredClone(
      runtime.packageValue.blueprint.content.visualContract,
    );
    changed.zones[0].description += ' changed geometry';
    expect(runtimeWorldProjectionDigest(changed)).not.toBe(
      runtimeWorldProjectionDigest(
        runtime.packageValue.blueprint.content.visualContract,
      ),
    );

    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    await expect(generateImage(imageInput(null))).resolves.toMatchObject({
      provider: 'gpt-image-1',
    });
  });

  it('preserves the legacy square PDF canvas only when enforcement is off', async () => {
    vi.stubEnv('VISUAL_CONTRACT_ENFORCEMENT', 'false');
    await generateImage({
      ...imageInput(null),
      printPdfOptimized: true,
    });
    expect(generateGptSpy.mock.calls[0][0]).toMatchObject({
      size: '1536x1536',
    });
  });

  it('keeps one immutable digest across cloned retry/resume authority values', () => {
    const runtime = authority();
    const resumed = structuredClone(runtime);
    expect(canonicalJsonDigest(resumed.bookProjection)).toBe(
      canonicalJsonDigest(runtime.bookProjection),
    );
    expect(
      requireRuntimeBlueprintFrame(resumed.bookProjection, 1)
        .projectionDigest,
    ).toBe(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1)
        .projectionDigest,
    );
  });
});
