import { describe, expect, it } from 'vitest';

import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import {
  buildSmallFrameChildFidelityLock,
  resolveStyle01PageExpressionKind,
} from '../style01-visual-polish';
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
