import { describe, expect, it } from 'vitest';

import type {
  BlueprintFrameCamera,
  PortraitBlueprintFrame,
} from '../preRenderBlueprintTypes';
import {
  PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
} from '../preRenderBlueprintTypes';
import {
  finalizePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
} from '../preRenderBlueprint';
import {
  preRenderBlueprintCompositionPolicyDiagnostics,
  preRenderBlueprintCompositionPolicyIssues,
} from '../preRenderBlueprintCompositionPolicy';
import { buildBlueprintFixture } from './pre-render-book-visual-blueprint.fixtures';

function pageFrame(args: {
  page: number;
  shot: BlueprintFrameCamera['shot'];
  angle: BlueprintFrameCamera['angle'];
  castWidth: number;
  castHeight: number;
}): PortraitBlueprintFrame {
  return {
    id: `frame:page:${args.page}`,
    kind: 'page',
    pageNumber: args.page,
    camera: {
      shot: args.shot,
      angle: args.angle,
      affordanceId: `camera:${args.page}`,
    },
    placements: [
      {
        id: `placement:${args.page}:child`,
        subject: { kind: 'cast', castId: 'child:hero' },
        region: {
          x: 100,
          y: 300,
          width: args.castWidth,
          height: args.castHeight,
        },
        depth: 'foreground',
        importance: 'key',
      },
    ],
  } as unknown as PortraitBlueprintFrame;
}

describe('pre-render Blueprint composition policy', () => {
  it('rejects the measured eight-page trajectory: label variety without a close-up or material scale change', () => {
    const cameras: Array<[
      BlueprintFrameCamera['shot'],
      BlueprintFrameCamera['angle'],
    ]> = [
      ['wide', 'eye_level'],
      ['medium', 'low_angle'],
      ['medium', 'three_quarter'],
      ['wide', 'high_angle'],
      ['tracking', 'low_angle'],
      ['wide', 'eye_level'],
      ['wide', 'three_quarter'],
      ['medium', 'eye_level'],
    ];
    const frames = cameras.map(([shot, angle], index) =>
      pageFrame({
        page: index + 1,
        shot,
        angle,
        castWidth: 120 + (index % 3) * 10,
        castHeight: 135 + (index % 2) * 20,
      }),
    );

    const issues = preRenderBlueprintCompositionPolicyIssues(frames);
    expect(issues).toContain(
      'an eight-page Blueprint must contain at least one authored close_up frame',
    );
    expect(issues.some((entry) => entry.includes('cast scale contrast is too small'))).toBe(true);
  });

  it('rejects a close_up label whose geometry still keeps every key subject distant', () => {
    const frames = Array.from({ length: 8 }, (_, index) =>
      pageFrame({
        page: index + 1,
        shot: index === 2 ? 'close_up' : index % 2 === 0 ? 'wide' : 'medium',
        angle: index % 3 === 0 ? 'eye_level' : index % 3 === 1 ? 'low_angle' : 'three_quarter',
        castWidth: index === 2 ? 150 : 120,
        castHeight: index === 2 ? 160 : 140,
      }),
    );

    const diagnostics = preRenderBlueprintCompositionPolicyDiagnostics(frames);
    expect(diagnostics).toContainEqual({
      message:
      'page 3 labels a close_up but no key subject occupies at least 10% of the normalized frame',
      expected: {
        pageNumber: 3,
        shot: 'close_up',
        minimumLargestKeySubjectAreaRatio: 0.1,
      },
      actual: { largestKeySubjectAreaRatio: 0.024 },
    });
    expect(preRenderBlueprintCompositionPolicyIssues(frames)).toEqual(
      diagnostics.map((diagnostic) => diagnostic.message),
    );
  });

  it('carries measured expected/actual evidence for every aggregate and per-shot policy family', () => {
    const frames = Array.from({ length: 8 }, (_, index) =>
      pageFrame({
        page: index + 1,
        shot: index === 0 ? 'over_shoulder' : 'medium',
        angle: 'eye_level',
        castWidth: 100,
        castHeight: 100,
      }),
    );

    const diagnostics = preRenderBlueprintCompositionPolicyDiagnostics(frames);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expected: expect.objectContaining({
            shot: 'over_shoulder',
            minimumLargestCastAreaRatio: 0.04,
          }),
          actual: { largestCastAreaRatio: 0.01 },
        }),
        expect.objectContaining({
          expected: expect.objectContaining({
            shot: 'medium',
            minimumLargestCastAreaRatio: 0.035,
          }),
          actual: { largestCastAreaRatio: 0.01 },
        }),
        {
          message:
            'an eight-page Blueprint must contain at least one authored close_up frame',
          expected: { requiredShot: 'close_up', minimumCount: 1 },
          actual: { count: 0 },
        },
        {
          message: 'an eight-page Blueprint must contain at least one authored wide frame',
          expected: { requiredShot: 'wide', minimumCount: 1 },
          actual: { count: 0 },
        },
        expect.objectContaining({
          expected: { minimumDistinctShotTypes: 3 },
          actual: { distinctShotTypes: ['medium', 'over_shoulder'] },
        }),
        expect.objectContaining({
          expected: { minimumDistinctCameraAngles: 3 },
          actual: { distinctCameraAngles: ['eye_level'] },
        }),
        expect.objectContaining({
          expected: { maximumConsecutiveSameShot: 2 },
          actual: expect.objectContaining({
            shot: 'medium',
            consecutiveCount: 3,
          }),
        }),
        expect.objectContaining({
          expected: { minimumCastScaleRatio: 3.5 },
          actual: expect.objectContaining({ castScaleRatio: 1 }),
        }),
      ]),
    );
    for (const diagnostic of diagnostics) {
      expect(Object.keys(diagnostic.expected).length).toBeGreaterThan(0);
      expect(Object.keys(diagnostic.actual).length).toBeGreaterThan(0);
    }
  });

  it('accepts an eight-page plan with a real close-up, three angles, dynamic framing, and 3.5x scale contrast', () => {
    const frames = [
      pageFrame({ page: 1, shot: 'wide', angle: 'eye_level', castWidth: 120, castHeight: 150 }),
      pageFrame({ page: 2, shot: 'medium', angle: 'low_angle', castWidth: 210, castHeight: 210 }),
      pageFrame({ page: 3, shot: 'close_up', angle: 'eye_level', castWidth: 360, castHeight: 360 }),
      pageFrame({ page: 4, shot: 'wide', angle: 'high_angle', castWidth: 125, castHeight: 150 }),
      pageFrame({ page: 5, shot: 'tracking', angle: 'low_angle', castWidth: 170, castHeight: 180 }),
      pageFrame({ page: 6, shot: 'over_shoulder', angle: 'three_quarter', castWidth: 220, castHeight: 220 }),
      pageFrame({ page: 7, shot: 'wide', angle: 'three_quarter', castWidth: 115, castHeight: 145 }),
      pageFrame({ page: 8, shot: 'medium', angle: 'eye_level', castWidth: 205, castHeight: 205 }),
    ];

    expect(preRenderBlueprintCompositionPolicyIssues(frames)).toEqual([]);
  });

  it('keeps shorter calibration proofs backward-compatible', () => {
    const frames = Array.from({ length: 5 }, (_, index) =>
      pageFrame({
        page: index + 1,
        shot: 'wide',
        angle: 'eye_level',
        castWidth: 120,
        castHeight: 140,
      }),
    );
    expect(preRenderBlueprintCompositionPolicyIssues(frames)).toEqual([]);
  });

  it('enforces the policy through the durable Blueprint validator only when the Blueprint opts in', () => {
    const fixture = buildBlueprintFixture('no_companion', { pageCount: 8 });
    expect(
      validatePreRenderBookVisualBlueprint(
        fixture.blueprint,
        fixture.context,
      ).ok,
    ).toBe(true);

    const {
      digest: _digest,
      digestAlgorithm: _digestAlgorithm,
      ...draft
    } = fixture.blueprint;
    const optedIn = finalizePreRenderBookVisualBlueprint({
      ...draft,
      compositionPolicyVersion:
        PRE_RENDER_BLUEPRINT_COMPOSITION_POLICY_VERSION,
    });
    const result = validatePreRenderBookVisualBlueprint(
      optedIn,
      fixture.context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'composition_policy_invalid')).toBe(true);
    }
  });
});
