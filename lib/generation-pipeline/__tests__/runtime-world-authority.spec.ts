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
  RuntimeBlueprintCanvasError,
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
    version: 'style01-runtime-authority/v5',
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
      '[runtime_world_authority:runtime_authority_missing] enforced Style01 provider call has no style01-runtime-authority/v5 preflight-issued authority';
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
    expect(providerInput.finalPrompt).toContain(frame.frameDigest);
    expect(providerInput.finalPrompt).toContain(
      runtime.packageValue.revisionDigest,
    );
    expect(providerInput.finalPrompt).not.toMatch(
      /MALICIOUS_|wrong camera|wrong composition|dragon_story_specific/,
    );
    expect(fetch).not.toHaveBeenCalled();
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
