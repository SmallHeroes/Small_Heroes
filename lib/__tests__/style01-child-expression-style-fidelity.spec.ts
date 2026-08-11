import { describe, expect, it, vi } from 'vitest';

import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import {
  buildSmallFrameChildFidelityLock,
  resolveStyle01PageExpressionKind,
} from '../style01-visual-polish';
import {
  style01UsesCanonicalChildAnchor,
  STYLE_01_CANONICAL_CHILD_ANCHOR_RULE,
  STYLE_01_CHILD_TEMPLATE_STYLE_RULE,
} from '../style01-gptimage';
import {
  evaluateAnchorStyleFromVision,
  STYLE01_ANCHOR_STYLE_QA_PROMPT,
} from '../anchor-style-qa';
import type { RuntimeBlueprintFrameProjection } from '../generation-pipeline/runtime-blueprint-projection';

function frame(input?: {
  summary?: string;
  shot?: RuntimeBlueprintFrameProjection['camera']['shot'];
  width?: number;
  height?: number;
}): RuntimeBlueprintFrameProjection {
  return {
    version: 'runtime-blueprint-frame-projection/v3',
    packageRevisionDigest: 'a'.repeat(64),
    packagePath: 'visual-packages/approved/revisions/fixture.json',
    sourcePath: 'story-bank/v3-approved/fixture.md',
    sourceDigest: 'b'.repeat(64),
    sourceRawDigest: 'c'.repeat(64),
    blueprintDigest: 'd'.repeat(64),
    authoringAuthorityDigest: 'e'.repeat(64),
    planningApprovalDigest: 'f'.repeat(64),
    styleAuthorityDigest: '1'.repeat(64),
    frameId: 'frame:page:1',
    frameDigest: '2'.repeat(64),
    pageNumber: 1,
    kind: 'page',
    locationId: 'location:bedroom',
    zoneId: 'zone:bed',
    castIds: ['child:hero'],
    requiredPropIds: [],
    forbiddenPropIds: [],
    narrative: {
      purpose: 'establish_world',
      summary: input?.summary ?? 'child sits in a quiet hush, feeling crowded out',
    },
    camera: {
      shot: input?.shot ?? 'wide',
      angle: 'eye_level',
      affordanceId: 'affordance:camera',
    },
    placements: [
      {
        id: 'placement:child',
        subject: { kind: 'cast', castId: 'child:hero' },
        region: {
          x: 80,
          y: 270,
          width: input?.width ?? 280,
          height: input?.height ?? 270,
        },
        depth: 'midground',
        importance: 'key',
      },
    ],
    worldGeometry: [],
    affordances: [],
    connections: [],
    continuity: {
      previousFrameId: null,
      transitionKind: 'steady',
      carryoverRefs: [],
    },
    layoutPlan: {
      aspectRatio: '2:3',
      coordinateSpace: 'portrait-normalized-1000',
      textZone: 'bottom_clear',
      textSafeRegion: { x: 0, y: 750, width: 1000, height: 250 },
      remapPolicy: 'reject',
    },
    references: { boards: [], props: [] },
    resolvedAppearanceDigest: '3'.repeat(64),
    resolvedAppearance: {
      child: {
        id: 'child:hero',
        role: 'child',
        name: 'Test child',
        wardrobe: { description: 'teal top', forbidden: [] },
      },
      companion: undefined,
      humans: [],
    },
    contractPage: {
      pageNumber: 1,
      locationId: 'location:bedroom',
      zoneId: 'zone:bed',
      transition: 'steady',
      castIds: ['child:hero'],
      mustShow: [],
      mustNotShow: [],
      actionRequirements: [],
      safetyConstraints: [],
    },
    contractPromptBlock: 'fixture contract',
    blueprintPromptBlock: '[PVB RUNTIME FRAME] fixture',
    safeScenePrompt: 'approved quiet bedroom scene',
    visualDirection: {
      locationZone: 'bedroom / bed',
      mainAction: 'child sits on bed',
      visibleObjects: [],
      characterPose: 'seated',
      emotionVisual: 'quiet',
      lightingSource: 'day',
      environmentDetail: 'bedroom',
      mustInclude: [],
      mustNotInclude: [],
      camera: 'wide eye level',
      composition: 'approved placement',
    },
    entityPresence: {
      childPresence: 'present',
      companionPresence: 'absent',
      recurringObjects: [],
      recurringEntities: [],
      forbiddenEntities: [],
    },
    supportingCharacters: [],
    expectedCharacterNames: ['Test child'],
    contractStyleRefEnvironment: 'indoor',
    locationBible: {
      version: 'book-location-bible/v1',
      locations: [],
      pages: [],
    },
    pageLocationPlan: {
      pageNumber: 1,
      locationId: 'location:bedroom',
      zoneId: 'zone:bed',
      pageAction: null,
      expectedBucketVisibility: null,
      referenceSheets: { isolatedObjectPaths: [] },
    },
    timeOfDay: 'day',
    digestAlgorithm: 'canonical-json-sha256',
    projectionDigest: '4'.repeat(64),
  } as unknown as RuntimeBlueprintFrameProjection;
}

describe('Style 01 child expression and small-frame fidelity', () => {
  it('uses explicit child reference authority with a Windows-safe legacy fallback', () => {
    expect(
      style01UsesCanonicalChildAnchor({
        childReferenceKind: 'canonical_anchor',
        referencePath: 'C:\\audition\\raw-upload.png',
      }),
    ).toBe(true);
    expect(
      style01UsesCanonicalChildAnchor({
        childReferenceKind: 'raw_photo',
        referencePath: 'C:\\audition\\character-anchors\\child.png',
      }),
    ).toBe(false);
    expect(
      style01UsesCanonicalChildAnchor({
        referencePath: 'C:\\audition\\character-anchors\\child.png',
      }),
    ).toBe(true);
  });

  it('keeps canonical-anchor style fidelity while leaving pose and expression to the page', () => {
    expect(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE).toContain('IDENTITY + STYLE FIDELITY ONLY');
    expect(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE).toContain('exact level of human realism');
    expect(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE).toContain('natural, varied pose');
    expect(STYLE_01_CANONICAL_CHILD_ANCHOR_RULE).not.toMatch(/Mia|Bar|Dini/i);
  });

  it('aligns canonical-anchor generation, generic templates, and the hard style gate', async () => {
    expect(STYLE_01_CHILD_TEMPLATE_STYLE_RULE).toContain('refined semi-naturalistic Style 01');
    expect(STYLE01_ANCHOR_STYLE_QA_PROMPT).toContain('refined semi-naturalistic');
    expect(STYLE01_ANCHOR_STYLE_QA_PROMPT).toContain('Do NOT reject');
    expect(STYLE01_ANCHOR_STYLE_QA_PROMPT).not.toMatch(/cute simplified|semi-realistic digital portrait/i);

    const previousKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-only-key';
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                style01Match: true,
                looksPhotoreal: false,
                looksPortrait: false,
                notes: 'hand-painted semi-naturalistic watercolor',
              }),
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    try {
      await expect(evaluateAnchorStyleFromVision('data:image/png;base64,fixture')).resolves.toMatchObject({
        ok: true,
        style01Match: true,
        looksPhotoreal: false,
        looksPortrait: false,
      });
      const request = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      expect(String(request.body)).toContain('refined semi-naturalistic');
      expect(String(request.body)).not.toMatch(/cute simplified|semi-realistic digital portrait/i);
    } finally {
      vi.unstubAllGlobals();
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it.each([
    ['child feels crowded out in a quiet hush', 'subdued'],
    ['the protective circle is a little too tight', 'wary'],
    ['the child watches with a surprised almost-smile', 'restrained_amusement'],
    ['the child kneels nearby, curious and unsure', 'curious_uncertain'],
    ['the child smiles with relief', 'joyful'],
  ] as const)('classifies closed page expression %s', (summary, expected) => {
    expect(resolveStyle01PageExpressionKind({ narrativeSummary: summary })).toBe(expected);
  });

  it('adds the fidelity guard only when the approved child placement is small', () => {
    const small = frame();
    expect(
      buildSmallFrameChildFidelityLock({
        cameraShot: small.camera.shot,
        childCastId: 'child:hero',
        placements: small.placements,
      })
    ).toContain('SMALL-IN-FRAME CHILD FIDELITY');

    const large = frame({ shot: 'close_up', width: 410, height: 349 });
    expect(
      buildSmallFrameChildFidelityLock({
        cameraShot: large.camera.shot,
        childCastId: 'child:hero',
        placements: large.placements,
      })
    ).toBe('');
  });

  it('sanitizes photo expression and binds page expression on the Blueprint path without changing geometry', () => {
    const authority = frame();
    const placementsBefore = structuredClone(authority.placements);
    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      authoritativeBlueprintFrame: authority,
      authoritativeChildWardrobe: {
        description: 'teal top',
        forbidden: [],
      },
      childFirstName: 'Test child',
      childAge: 5,
      childGender: 'boy',
      childStructured: {
        face: 'warm brown eyes, round cheeks, natural child nose and broad open smile',
        hair: 'short dark curls',
        body: 'natural five-year-old proportions',
        clothing: 'authority supplied',
        signature: 'recognisable smile; thick brows',
      },
      bookPageText: 'The child feels left out.',
      rawScenePrompt: 'The child looks crowded out and quiet.',
    });

    expect(assembled.prompt).toContain('PAGE EXPRESSION [subdued]');
    expect(assembled.prompt).toContain('SMALL-IN-FRAME CHILD FIDELITY');
    expect(assembled.prompt).toContain('photographed gaze, mouth pose, smile');
    expect(assembled.prompt).not.toContain('broad open smile');
    expect(assembled.prompt).not.toContain('recognisable smile');
    expect(assembled.prompt).toContain(JSON.stringify(authority.placements));
    expect(authority.placements).toEqual(placementsBefore);
  });

  it('uses a distinct restrained almost-smile without the small-frame guard on a close frame', () => {
    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: 4,
      authoritativeBlueprintFrame: frame({
        summary: 'the child watches with a surprised almost-smile',
        shot: 'close_up',
        width: 410,
        height: 349,
      }),
      childStructured: {
        face: 'round face and broad open smile',
        hair: 'short dark curls',
        body: 'natural five-year-old proportions',
        clothing: 'authority supplied',
        signature: '',
      },
    });
    expect(assembled.prompt).toContain('PAGE EXPRESSION [restrained_amusement]');
    expect(assembled.prompt).not.toContain('SMALL-IN-FRAME CHILD FIDELITY');
  });
});
