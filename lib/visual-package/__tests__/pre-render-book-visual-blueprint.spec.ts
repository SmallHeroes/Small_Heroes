import { describe, expect, it } from 'vitest';

import {
  PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION,
  assertValidPreRenderBookVisualBlueprint,
  computePreRenderBookVisualBlueprintDigest,
  finalizePreRenderBookVisualBlueprint,
  serializePreRenderBookVisualBlueprint,
  validatePreRenderBookVisualBlueprint,
  InvalidPreRenderBookVisualBlueprintError,
  type PreRenderBlueprintIssueCode,
  type PreRenderBookVisualBlueprint,
} from '@/lib/visual-package';
import { projectZoneStableGeometry } from '@/lib/visual-contract-compiler';

import {
  buildBlueprintFixture,
  type BlueprintFixtureShape,
} from './pre-render-book-visual-blueprint.fixtures';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function issueCodes(
  blueprint: unknown,
  context: ReturnType<typeof buildBlueprintFixture>['context'],
): PreRenderBlueprintIssueCode[] {
  const result = validatePreRenderBookVisualBlueprint(blueprint, context);
  return result.ok ? [] : result.issues.map((entry) => entry.code);
}

function restamp(blueprint: PreRenderBookVisualBlueprint): PreRenderBookVisualBlueprint {
  const { digest: _digest, digestAlgorithm: _algorithm, ...draft } = blueprint;
  return finalizePreRenderBookVisualBlueprint(draft);
}

describe('R1D-PVB-A — schema generalization fixtures', () => {
  const shapes: BlueprintFixtureShape[] = [
    'single_location',
    'multi_zone_transition',
    'journey_fantastical',
    'no_companion',
    'reveal_timeline',
  ];

  it.each(shapes)('accepts a complete %s book blueprint', (shape) => {
    const fixture = buildBlueprintFixture(shape);
    const result = validatePreRenderBookVisualBlueprint(fixture.blueprint, fixture.context);
    expect(result.ok, result.ok ? '' : result.issues.map((entry) => `${entry.code}: ${entry.message}`).join('\n')).toBe(true);
  });

  it('represents no-companion authority without inventing a companion frame placement', () => {
    const fixture = buildBlueprintFixture('no_companion');
    expect(fixture.blueprint.visualContract.cast.companion).toBeUndefined();
    expect(
      fixture.blueprint.frames.every(
        (frame) =>
          frame.castIds.every((castId) => !castId.startsWith('companion:')) &&
          frame.placements.every(
            (placement) =>
              placement.subject.kind !== 'cast' ||
              !placement.subject.castId.startsWith('companion:'),
          ),
      ),
    ).toBe(true);
  });

  it('requires exact 2:3 portrait authority for the cover and every authored page', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    bad.frames[1].aspectRatio = { width: 3, height: 2 } as never;
    const restamped = restamp(bad);
    expect(issueCodes(restamped, fixture.context)).toContain('aspect_ratio_invalid');
  });
});

describe('R1D-PVB-A — coverage, references, and deterministic authority', () => {
  it('fails closed on a missing, duplicate, or extra page frame', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');

    const missing = clone(fixture.blueprint);
    missing.frames = missing.frames.filter(
      (frame) => frame.kind !== 'page' || frame.pageNumber !== 2,
    );
    expect(issueCodes(restamp(missing), fixture.context)).toContain('coverage_incomplete');

    const duplicate = clone(fixture.blueprint);
    duplicate.frames.push(clone(duplicate.frames.find((frame) => frame.id === 'frame:page:1')!));
    expect(issueCodes(restamp(duplicate), fixture.context)).toContain('coverage_duplicate');

    const extra = clone(fixture.blueprint);
    const page = clone(extra.frames.find((frame) => frame.id === 'frame:page:2')!);
    if (page.kind !== 'page') throw new Error('fixture page missing');
    page.id = 'frame:page:99';
    page.pageNumber = 99;
    extra.frames.push(page);
    expect(issueCodes(restamp(extra), fixture.context)).toContain('coverage_extra');
  });

  it('rejects unresolved frame, connection, and affordance references', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const bad = clone(fixture.blueprint);
    const page2 = bad.frames.find((frame) => frame.id === 'frame:page:2')!;
    page2.zoneId = 'zone:missing';
    page2.camera.affordanceId = 'affordance:missing';
    page2.continuity.connectionId = 'connection:missing';
    const codes = issueCodes(restamp(bad), fixture.context);
    expect(codes).toContain('reference_unresolved');
    expect(codes).toContain('camera_infeasible');
    expect(codes).toContain('transition_invalid');
  });

  it('canonical normalization makes array order and object-key order digest-stable', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const reordered = clone(fixture.blueprint);
    reordered.worldPlan.affordances.reverse();
    reordered.worldPlan.connections.reverse();
    reordered.frames.reverse();
    for (const frame of reordered.frames) {
      frame.placements.reverse();
      frame.affordanceIds.reverse();
    }
    const restamped = restamp(reordered);
    expect(restamped.digest).toBe(fixture.blueprint.digest);

    const keyReordered = JSON.parse(
      JSON.stringify(fixture.blueprint, Object.keys(fixture.blueprint).reverse()),
    ) as unknown;
    // A JSON replacer-array is lossy for nested keys, so use parse/stringify with a recursive
    // explicit reordering instead to prove canonical serialization stability.
    void keyReordered;
    const recursiveReverse = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(recursiveReverse);
      if (!value || typeof value !== 'object') return value;
      return Object.keys(value as Record<string, unknown>)
        .reverse()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = recursiveReverse((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    };
    const reversedKeys = recursiveReverse(fixture.blueprint) as PreRenderBookVisualBlueprint;
    expect(computePreRenderBookVisualBlueprintDigest(reversedKeys)).toBe(fixture.blueprint.digest);
    expect(serializePreRenderBookVisualBlueprint(reversedKeys)).toBe(
      serializePreRenderBookVisualBlueprint(fixture.blueprint),
    );
  });

  it('finalization is pure and does not mutate caller-owned draft arrays', () => {
    const fixture = buildBlueprintFixture('journey_fantastical');
    const { digest: _digest, digestAlgorithm: _algorithm, ...draft } = clone(fixture.blueprint);
    draft.frames.reverse();
    draft.worldPlan.affordances.reverse();
    const before = clone(draft);
    finalizePreRenderBookVisualBlueprint(draft);
    expect(draft).toEqual(before);
  });

  it('rejects schema, content, and digest mutation', () => {
    const fixture = buildBlueprintFixture('single_location');

    const schemaMutation = clone(fixture.blueprint);
    schemaMutation.version = 'pre-render-book-visual-blueprint/v0' as typeof PRE_RENDER_BOOK_VISUAL_BLUEPRINT_VERSION;
    expect(issueCodes(schemaMutation, fixture.context)).toContain('schema_version_unsupported');

    const contentMutation = clone(fixture.blueprint);
    contentMutation.frames[0].narrative.summary = 'mutated without re-stamping';
    expect(issueCodes(contentMutation, fixture.context)).toContain('digest_mismatch');

    const digestMutation = clone(fixture.blueprint);
    digestMutation.digest = '0'.repeat(64);
    expect(issueCodes(digestMutation, fixture.context)).toContain('digest_mismatch');
  });

  it('returns structured issues instead of throwing on malformed nested arrays', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint) as unknown as Record<string, unknown>;
    (bad.worldPlan as Record<string, unknown>).affordances = null;
    bad.frames = [null];
    expect(() => validatePreRenderBookVisualBlueprint(bad, fixture.context)).not.toThrow();
    const result = validatePreRenderBookVisualBlueprint(bad, fixture.context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((entry) => entry.code)).toContain('schema_invalid');
  });
});

describe('R1D-PVB-A — spatial feasibility and safety', () => {
  it('rejects a declared action without compatible footprint/predicate support', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    const action = bad.worldPlan.affordances.find(
      (entry) => entry.kind === 'action_space',
    );
    if (!action || action.kind !== 'action_space') throw new Error('action fixture missing');
    action.supportedPredicates = ['points_at'];
    expect(issueCodes(restamp(bad), fixture.context)).toContain('action_infeasible');
  });

  it('rejects required prop placement without compatible support', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const support = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'placement_support' &&
        entry.consumers.some(
          (consumer) => consumer.kind === 'placement' && consumer.pageNumber === 2,
        ),
    );
    if (!support || support.kind !== 'placement_support') throw new Error('placement fixture missing');
    support.support = { kind: 'anchor', id: 'anchor:focus' };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('placement_infeasible');
  });

  it('rejects a transition without traversal/opening clearance and authored connection support', () => {
    const fixture = buildBlueprintFixture('multi_zone_transition');
    const bad = clone(fixture.blueprint);
    const connection = bad.worldPlan.connections[0];
    connection.traversalAffordanceId = 'affordance:missing';
    connection.openingClearanceAffordanceIds = [];
    const codes = issueCodes(restamp(bad), fixture.context);
    expect(codes).toContain('traversal_infeasible');
  });

  it('rejects camera access that cannot see all key actors/actions/props', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const camera = bad.worldPlan.affordances.find(
      (entry) =>
        entry.kind === 'camera_access' &&
        entry.consumers.some(
          (consumer) => consumer.kind === 'frame' && consumer.frameId === 'frame:page:2',
        ),
    );
    if (!camera || camera.kind !== 'camera_access') throw new Error('camera fixture missing');
    camera.visibleRegion = { x: 0, y: 250, width: 300, height: 300 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('camera_infeasible');
  });

  it('rejects actor blocking outside the deterministic safe boundary', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    const boundary = bad.worldPlan.affordances.find(
      (entry) => entry.kind === 'safe_boundary',
    );
    if (!boundary || boundary.kind !== 'safe_boundary') throw new Error('safety fixture missing');
    boundary.permittedRegion = { x: 700, y: 250, width: 300, height: 750 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('safety_infeasible');
  });

  it('rejects deterministic text-safe collision with key actor/action/required-prop evidence', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const page2 = bad.frames.find((frame) => frame.id === 'frame:page:2')!;
    const requiredProp = page2.placements.find(
      (placement) => placement.subject.kind === 'prop',
    )!;
    requiredProp.region = { x: 100, y: 100, width: 120, height: 100 };
    expect(issueCodes(restamp(bad), fixture.context)).toContain('text_safe_collision');
  });
});

describe('R1D-PVB-A — reveal lifecycle and staleness', () => {
  it('allows explicitly spoiler-neutral supporting geometry before reveal', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const result = validatePreRenderBookVisualBlueprint(fixture.blueprint, fixture.context);
    expect(result.ok).toBe(true);
    expect(
      fixture.blueprint.frames
        .filter((frame) => frame.kind === 'cover' || frame.pageNumber < 2)
        .every((frame) =>
          frame.placements.some(
            (placement) => placement.subject.kind === 'supporting_geometry',
          ),
        ),
    ).toBe(true);
  });

  it('forbids direct depiction or naming of a hidden prop before reveal', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');

    const depicted = clone(fixture.blueprint);
    const page1 = depicted.frames.find((frame) => frame.id === 'frame:page:1')!;
    page1.placements.push({
      id: 'placement:page1:hidden-prop',
      subject: { kind: 'prop', propId: 'prop:hidden_keepsake' },
      region: { x: 560, y: 580, width: 110, height: 100 },
      depth: 'foreground',
      importance: 'supporting',
    });
    expect(issueCodes(restamp(depicted), fixture.context)).toContain('reveal_violation');

    const named = clone(fixture.blueprint);
    named.frames.find((frame) => frame.id === 'frame:page:1')!.narrative.summary =
      'The child sees the hidden keepsake';
    expect(issueCodes(restamp(named), fixture.context)).toContain('reveal_violation');
  });

  it('rejects supporting geometry unless it is explicitly spoiler-neutral', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    bad.worldPlan.revealSafeSupportingGeometry[0].spoilerNeutral = false as true;
    expect(issueCodes(restamp(bad), fixture.context)).toContain('reveal_violation');
  });

  it('rejects neutral-geometry prose that names the future reveal object', () => {
    const fixture = buildBlueprintFixture('reveal_timeline');
    const bad = clone(fixture.blueprint);
    const zone = bad.visualContract.zones[0];
    const node = zone.spatialNodes?.find((entry) => entry.id === 'future_support');
    if (!node) throw new Error('supporting-geometry node missing');
    node.description = 'a platform labeled Hidden keepsake';
    zone.stableGeometry = projectZoneStableGeometry(zone);
    expect(issueCodes(restamp(bad), fixture.context)).toContain('reveal_violation');
  });

  it('becomes stale when the current Story Source, template, or visual package changes', () => {
    const fixture = buildBlueprintFixture('single_location');

    const sourceContext = clone(fixture.context);
    sourceContext.source.digest = 'a'.repeat(64);
    expect(issueCodes(fixture.blueprint, sourceContext)).toContain('source_stale');

    const templateContext = clone(fixture.context);
    templateContext.template.worldType = 'changed_world';
    expect(issueCodes(fixture.blueprint, templateContext)).toContain('template_stale');

    const packageContext = clone(fixture.context);
    packageContext.visualPackage.candidateEvidence.reviewDigest = 'changed-review';
    expect(issueCodes(fixture.blueprint, packageContext)).toContain('package_stale');
  });

  it('provides a fail-closed assertion API', () => {
    const fixture = buildBlueprintFixture('single_location');
    const bad = clone(fixture.blueprint);
    bad.digest = 'f'.repeat(64);
    expect(() => assertValidPreRenderBookVisualBlueprint(bad, fixture.context)).toThrow(
      InvalidPreRenderBookVisualBlueprintError,
    );
  });
});
