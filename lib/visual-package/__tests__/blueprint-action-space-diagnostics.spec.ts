import { describe, expect, it } from 'vitest';
import { buildBlueprintFixture } from './pre-render-book-visual-blueprint.fixtures';
import { validatePreRenderBookVisualBlueprint, actionSupportRejection, staticSpatialConstraintIsFeasible } from '../preRenderBlueprint';
import { buildPreRenderBlueprintRepairUserPrompt, groupPreRenderBlueprintRepairDiagnostics, buildActionSpaceRepairSidecar, compilePreRenderBookVisualBlueprint } from '../preRenderBlueprintAuthoring';
import { buildBlueprintAuthoringSanitizedCensus } from '../blueprintAuthoringSanitizedFailureCapture';
import { buildBlueprintAuthoringExecutionProgram, blueprintAuthoringExecutionProgramStatus, LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_V10 } from '../blueprintAuthoringExecutionProgram';
import type { PreRenderBlueprintIssue, BlueprintSpatialAffordance } from '../preRenderBlueprintTypes';
import { canonicalJsonDigest } from '../integrity';
import { buildPreRenderBlueprintAffordanceConsumerCatalog, projectPreRenderBlueprintAffordanceConsumerChoices } from '../preRenderBlueprintAffordanceConsumerChoices';

describe('action-space repair diagnostics', () => {
  it('explains predicate support without changing the issue identity', () => {
    const { blueprint, context } = buildBlueprintFixture('single_location');
    const support = blueprint.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    if (support.kind !== 'action_space') throw new Error('fixture');
    support.supportedPredicates = [];
    const result = validatePreRenderBookVisualBlueprint(blueprint, context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const diagnostic = result.issues.find(i => i.code === 'action_infeasible' && i.field?.endsWith('.affordanceIds'))!;
    expect(diagnostic.actionSpaceRejections?.candidates).toContainEqual([support.id, 'predicate_unsupported']);
    const { actionSpaceRejections: _details, ...oldIssue } = diagnostic;
    expect(groupPreRenderBlueprintRepairDiagnostics([diagnostic])).toEqual(groupPreRenderBlueprintRepairDiagnostics([oldIssue]));
    expect(buildBlueprintAuthoringSanitizedCensus([diagnostic])).toEqual(buildBlueprintAuthoringSanitizedCensus([oldIssue]));
    expect(buildPreRenderBlueprintRepairUserPrompt({ context, previousDraft: {}, diagnostics: [diagnostic] })).toContain('ACTION_SPACE_REJECTIONS');
  });

  it.each([
    ['zone_mismatch', (s: any) => { s.zoneId = 'zone:missing'; }],
    ['consumer_binding_missing', (s: any) => { s.consumers = []; }],
    ['subject_kind_unsupported', (s: any) => { s.supportedSubjectKinds = []; }],
    ['participant_entity_unsupported', (s: any) => { s.supportedEntities = []; }],
    ['support_shape_invalid', (s: any) => { s.supportedPredicates = null; }],
    ['participant_outside_space', (s: any) => { s.footprint = { x: 0, y: 0, width: 1, height: 1 }; }],
  ] as const)('explains %s without accepting the draft', (reason, mutate) => {
    const { blueprint, context } = buildBlueprintFixture('single_location');
    const s = blueprint.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    mutate(s);
    const result = validatePreRenderBookVisualBlueprint(blueprint, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.flatMap(i => i.actionSpaceRejections?.candidates ?? [])).toContainEqual([s.id, reason]);
  });

  it.each(['not_selected_in_frame', 'action_region_outside_space', 'destination_infeasible'] as const)('explains frame %s', reason => {
    const { blueprint, context } = buildBlueprintFixture('single_location');
    const s = blueprint.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    const frame = blueprint.frames.find(f => f.kind === 'page')!;
    if (reason === 'not_selected_in_frame') frame.affordanceIds = frame.affordanceIds.filter(id => id !== s.id);
    const action = frame.placements.find(p => p.subject.kind === 'action')!;
    if (reason === 'action_region_outside_space') action.region.x = 900;
    if (reason === 'destination_infeasible' && action.subject.kind === 'action') frame.placements.push({ ...action, id: 'placement:extra-destination', subject: { kind: 'action_destination', checkId: action.subject.checkId } });
    const result = validatePreRenderBookVisualBlueprint(blueprint, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.flatMap(i => i.actionSpaceRejections?.candidates ?? [])).toContainEqual([s.id, reason]);
  });

  it('preserves valid and ambiguous outcomes and caps candidate guidance', () => {
    const { blueprint, context } = buildBlueprintFixture('single_location');
    expect(validatePreRenderBookVisualBlueprint(blueprint, context).ok).toBe(true);
    const s = blueprint.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    const frame = blueprint.frames.find(f => f.kind === 'page')!;
    for (let i = 0; i < 20; i++) {
      const copy = structuredClone(s); copy.id = `affordance:extra${i}`;
      blueprint.worldPlan.affordances.push(copy); frame.affordanceIds.push(copy.id);
    }
    let result = validatePreRenderBookVisualBlueprint(blueprint, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(i => i.code === 'affordance_incompatible')).toBe(true);
    for (const a of blueprint.worldPlan.affordances) if (a.kind === 'action_space') a.supportedPredicates = [];
    result = validatePreRenderBookVisualBlueprint(blueprint, context);
    if (result.ok) throw new Error('accepted broken fixture');
    const details = result.issues.find(i => i.actionSpaceRejections)?.actionSpaceRejections!;
    expect(details.candidates).toHaveLength(8);
    expect(details.omittedCandidates).toBeGreaterThan(0);
  });

  it('bounds UTF-8 sidecar without changing grouping or census at scale', () => {
    const base: PreRenderBlueprintIssue = { code: 'action_infeasible', field: 'frames[12].affordanceIds', message: 'same action' };
    const diagnostics = Array.from({ length: 1000 }, (_, i) => ({ ...base, actionSpaceRejections: { candidates: [[`affordance:${i}${'א'.repeat(50)}`, 'predicate_unsupported']] as Array<[string, string]>, omittedCandidates: 0 } }));
    const sidecar = buildActionSpaceRepairSidecar(diagnostics);
    expect(Buffer.byteLength(sidecar)).toBeLessThanOrEqual(8192);
    const parsed = JSON.parse(sidecar);
    expect(parsed.rows.length + parsed.omittedRows).toBe(1000);
    expect(parsed.omittedRows).toBeGreaterThan(0);
    expect(groupPreRenderBlueprintRepairDiagnostics(diagnostics)).toEqual(groupPreRenderBlueprintRepairDiagnostics(diagnostics.map(() => base)));
    expect(buildBlueprintAuthoringSanitizedCensus(diagnostics)).toEqual(buildBlueprintAuthoringSanitizedCensus(diagnostics.map(() => base)));
  });

  it('classifies exact old program as replay-only and rejects a resealed mutation', () => {
    expect(blueprintAuthoringExecutionProgramStatus(LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_V10)).toBe('legacy_immutable');
    expect(buildBlueprintAuthoringExecutionProgram().digest).not.toBe(LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_V10.digest);
    const { digest: _old, ...payload } = LEGACY_BLUEPRINT_AUTHORING_EXECUTION_PROGRAM_REPAIR_V10;
    const changed = { ...payload, repairSystemPromptDigest: 'f'.repeat(64) };
    expect(blueprintAuthoringExecutionProgramStatus({ ...changed, digest: canonicalJsonDigest(changed) })).toBe('unsupported');
  });

  it.each(['direction_unsupported', 'relation_unsupported', 'static_relation_unsupported', 'static_geometry_infeasible'] as const)('explains spatial %s', reason => {
    const { blueprint } = buildBlueprintFixture('single_location');
      const a = structuredClone(blueprint.visualContract.pageContracts[0].actionRequirements![0]);
      if (reason === 'direction_unsupported') a.spatialEffect = { kind: 'directional', direction: 'left' };
      else if (reason === 'relation_unsupported') a.spatialEffect = { kind: 'relation', relation: 'toward', target: { kind: 'cast', id: 'child:hero' } };
      else a.spatialConstraint = { relation: 'beside', target: { kind: 'cast', id: 'child:hero' } };
    const s = blueprint.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    if (s.kind !== 'action_space') throw new Error('fixture');
    s.supportedSpatialDirections = []; s.supportedSpatialRelations = [];
    s.supportedSpatialConstraintRelations = reason === 'static_geometry_infeasible' ? ['beside'] : [];
    if (reason === 'static_geometry_infeasible') {
      expect(actionSupportRejection(s, a)).toBeNull();
      expect(staticSpatialConstraintIsFeasible({ action: a, affordance: s, placements: blueprint.frames[1].placements })).toBe(false);
    } else expect(actionSupportRejection(s, a)).toBe(reason);
  });

  it('passes bounded reasons through the real compiler repair input and then accepts a valid draft', async () => {
    const { blueprint, context } = buildBlueprintFixture('single_location');
    const draft = {
      worldPlan: structuredClone(blueprint.worldPlan),
      frames: blueprint.frames.map(f => ({ kind: f.kind, pageNumber: f.kind === 'cover' ? null : f.pageNumber,
        narrative: f.narrative, placements: f.placements, camera: f.camera, affordanceIds: f.affordanceIds,
        continuity: { connectionId: f.continuity.connectionId ?? null, carryoverRefs: f.continuity.carryoverRefs } })),
    };
    draft.worldPlan.affordances = projectPreRenderBlueprintAffordanceConsumerChoices({ affordances: draft.worldPlan.affordances,
      catalog: buildPreRenderBlueprintAffordanceConsumerCatalog(blueprint.visualContract) }) as BlueprintSpatialAffordance[];
    const broken = structuredClone(draft);
    const s = broken.worldPlan.affordances.find(a => a.kind === 'action_space')!;
    if (s.kind !== 'action_space') throw new Error('fixture');
    s.supportedPredicates = [];
    const calls: string[] = [];
    const result = await compilePreRenderBookVisualBlueprint(context, { model: 'fixture', reasoningEffort: 'medium', maxOutputTokens: 48000, compositionPolicyVersion: null }, {
      callAuthor: async (_system, user) => { calls.push(user); return calls.length === 1 ? broken : draft; },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('ACTION_SPACE_REJECTIONS');
    expect(calls[1]).toContain('predicate_unsupported');
    expect(result.provenance.passingAttempt).toBe(2);
  });
});
