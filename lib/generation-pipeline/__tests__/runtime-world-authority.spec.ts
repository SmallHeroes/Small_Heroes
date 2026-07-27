import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImageInput } from '@/backend/providers/image';
import {
  generateAllPageImages,
  generateBookCover,
  generateImage,
} from '@/backend/providers/image';
import {
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

import {
  buildRuntimeBlueprintBookProjection,
  requireRuntimeBlueprintFrame,
} from '../runtime-blueprint-projection';
import type { Style01RuntimeAuthority } from '../render-qualification-preflight';
import {
  RuntimeVisualAuthorityBoundaryError,
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

const FAMILY: ResolvedFamilyAppearanceProfile = {
  skinTone: 'warm brown',
  hairColour: 'dark brown',
  hairTexture: 'wavy',
};

function authority(): Style01RuntimeAuthority {
  const { packageValue } =
    buildVisualPackageV4Fixture('no_companion');
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
    version: 'style01-runtime-authority/v4',
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

  it('blocks direct page and cover provider entry before provider reachability when v4 authority is absent', async () => {
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

  it('provider prompt uses only the exact PVB frame and discards story/free-text composition overrides', async () => {
    const runtime = authority();
    await expect(generateImage(imageInput(runtime))).resolves.toMatchObject({
      provider: 'gpt-image-1',
    });
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
  });

  it('QA regeneration cannot change the exact frame projection or composition prompt', async () => {
    vi.stubEnv('PAGE_VISUAL_QA_ENABLED', 'true');
    evaluateQaSpy
      .mockResolvedValueOnce(qaResult(false))
      .mockResolvedValueOnce(qaResult(true));
    const reserveQualityRegen = vi.fn().mockResolvedValue(true);
    const runtime = authority();
    await generateImage({
      ...imageInput(runtime),
      reserveQualityRegen,
    });
    expect(generateGptSpy).toHaveBeenCalledTimes(2);
    const prompts = generateGptSpy.mock.calls.map(
      (call) => (call[0] as { finalPrompt: string }).finalPrompt,
    );
    expect(prompts[1]).toBe(prompts[0]);
    expect(prompts[0]).toContain(
      requireRuntimeBlueprintFrame(runtime.bookProjection, 1).frameDigest,
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
