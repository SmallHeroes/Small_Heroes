import { describe, expect, it } from 'vitest';

import { projectDraftActionCastReferences } from '@/lib/visual-contract-compiler/draftActionCastReferenceProjection';
import { canonicalizePageActionCastGroups } from '@/lib/visual-contract-compiler/compileBookVisualContractTemplate';

function fullReferenceDraft() {
  return {
    cast: {
      child: { id: 'child', role: 'child' },
      companion: { id: 'koko', role: 'companion' },
    },
    pageContracts: [{
      pageNumber: 1,
      actionRequirements: [
        {
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: 'child' },
          },
          object: { kind: 'cast', id: 'koko' },
          spatialEffect: {
            kind: 'relation',
            relation: 'toward',
            target: { kind: 'cast', id: 'child' },
          },
          spatialConstraint: {
            relation: 'beside',
            target: { kind: 'cast', id: 'koko' },
          },
        },
        {
          subject: {
            kind: 'cast_group',
            castIds: ['koko', 'child'],
          },
          object: { kind: 'prop', id: 'child' },
          spatialEffect: {
            kind: 'directional',
            direction: 'forward',
          },
        },
      ],
    }],
  };
}

describe('projectDraftActionCastReferences', () => {
  it('rebinds every typed action cast-reference position without mutating input', () => {
    const input = fullReferenceDraft();
    const before = structuredClone(input);

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: 'companion:koko',
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(6);
    expect(result.conflictingReferenceCount).toBe(0);
    expect(result.draft.pageContracts).toEqual([{
      pageNumber: 1,
      actionRequirements: [
        {
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: 'child:hero' },
          },
          object: { kind: 'cast', id: 'companion:koko' },
          spatialEffect: {
            kind: 'relation',
            relation: 'toward',
            target: { kind: 'cast', id: 'child:hero' },
          },
          spatialConstraint: {
            relation: 'beside',
            target: { kind: 'cast', id: 'companion:koko' },
          },
        },
        {
          subject: {
            kind: 'cast_group',
            castIds: ['companion:koko', 'child:hero'],
          },
          object: { kind: 'prop', id: 'child' },
          spatialEffect: {
            kind: 'directional',
            direction: 'forward',
          },
        },
      ],
    }]);
    const projectedPage = (
      result.draft.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    const canonicalActions = canonicalizePageActionCastGroups(
      projectedPage.actionRequirements,
    );
    expect(
      (canonicalActions[1]!.subject as { castIds: string[] }).castIds,
    ).toEqual(['child:hero', 'companion:koko']);
    expect(input).toEqual(before);
  });

  it('hands projected cast groups to the shared canonicalizer without hiding duplicates', () => {
    const input = fullReferenceDraft();
    const group = (
      input.pageContracts[0]!.actionRequirements[1]!.subject as {
        castIds: string[];
      }
    );
    group.castIds = ['child', 'child:hero', 'koko'];

    const projected = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: 'companion:koko',
      authoritativeHumanIds: [],
    });
    const page = (
      projected.draft.pageContracts as Array<Record<string, unknown>>
    )[0]!;
    const canonical = canonicalizePageActionCastGroups(
      page.actionRequirements,
    );

    expect(
      (canonical[1]!.subject as { castIds: string[] }).castIds,
    ).toEqual([
      'child:hero',
      'child:hero',
      'companion:koko',
    ]);
    expect(
      new Set(
        (canonical[1]!.subject as { castIds: string[] }).castIds,
      ).size,
    ).toBe(2);
  });

  it('preserves authoritative IDs, unknown aliases, non-cast refs and malformed values', () => {
    const input = fullReferenceDraft();
    const page = input.pageContracts[0]!;
    page.actionRequirements = [{
      subject: {
        kind: 'cast_group',
        castIds: ['child:hero', 'companion:koko', 'unknown', 7],
      },
      object: { kind: 'anchor', id: 'child' },
      spatialEffect: {
        kind: 'relation',
        relation: 'toward',
        target: { kind: 'cast', id: 'unknown' },
      },
      spatialConstraint: null,
    }] as never;

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: 'companion:koko',
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(0);
    expect(result.conflictingReferenceCount).toBe(0);
    expect(result.draft).toEqual(input);
  });

  it('invalidates a colliding provider alias and preserves canonical IDs', () => {
    const input = {
      cast: {
        child: { id: 'shared' },
        companion: { id: 'shared' },
      },
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'cast_group',
            castIds: ['shared', 'child:hero', 'companion:koko'],
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: 'companion:koko',
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(0);
    expect(result.conflictingReferenceCount).toBe(1);
    expect(result.draft).toMatchObject({
      pageContracts: [{
        actionRequirements: [{
          subject: {
            castIds: [
              '__compiler_invalid_ambiguous_cast_reference__',
              'child:hero',
              'companion:koko',
            ],
          },
        }],
      }],
    });
  });

  it('rebinds the child independently when no companion authority exists', () => {
    const input = {
      cast: {
        child: { id: 'hero' },
        companion: { id: 'unowned-companion' },
      },
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'cast_group',
            castIds: ['hero', 'unowned-companion'],
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: null,
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(1);
    expect(result.conflictingReferenceCount).toBe(0);
    expect(
      (result.draft.pageContracts as Array<Record<string, unknown>>)[0],
    ).toMatchObject({
      actionRequirements: [{
        subject: {
          castIds: ['child:hero', 'unowned-companion'],
        },
      }],
    });
  });

  it('invalidates a shared child/companion alias when companion authority is absent', () => {
    const input = {
      cast: {
        child: { id: 'shared' },
        companion: { id: 'shared' },
      },
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'cast_group',
            castIds: ['shared', 'child:hero'],
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: null,
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(0);
    expect(result.conflictingReferenceCount).toBe(1);
    expect(result.draft).toMatchObject({
      pageContracts: [{
        actionRequirements: [{
          subject: {
            castIds: [
              '__compiler_invalid_ambiguous_cast_reference__',
              'child:hero',
            ],
          },
        }],
      }],
    });
  });

  it('invalidates a cross-role alias collision with canonical companion or human identity', () => {
    const input = {
      cast: {
        child: { id: 'human:mother' },
        companion: { id: 'companion:koko' },
      },
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'cast_group',
            castIds: ['human:mother', 'companion:koko'],
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: 'companion:koko',
      authoritativeHumanIds: ['human:mother'],
    });

    expect(result.reboundReferenceCount).toBe(0);
    expect(result.conflictingReferenceCount).toBe(1);
    expect(result.draft).toMatchObject({
      pageContracts: [{
        actionRequirements: [{
          subject: {
            castIds: [
              '__compiler_invalid_ambiguous_cast_reference__',
              'companion:koko',
            ],
          },
        }],
      }],
    });
  });

  it('ignores raw human alias claims but invalidates an unowned companion alias colliding with authoritative human identity', () => {
    const input = {
      cast: {
        child: { id: 'mother' },
        companion: { id: 'human:mother' },
      },
      humanCast: [{ id: 'mother', role: 'mother' }],
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'cast_group',
            castIds: ['mother', 'human:mother'],
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: null,
      authoritativeHumanIds: ['human:mother'],
    });

    expect(result.reboundReferenceCount).toBe(1);
    expect(result.conflictingReferenceCount).toBe(1);
    expect(result.draft).toMatchObject({
      pageContracts: [{
        actionRequirements: [{
          subject: {
            castIds: [
              'child:hero',
              '__compiler_invalid_ambiguous_cast_reference__',
            ],
          },
        }],
      }],
    });
  });

  it('keeps a canonical child reference valid when raw human cast redundantly repeats that ID', () => {
    const input = {
      cast: {
        child: { id: 'child:hero' },
        companion: null,
      },
      humanCast: [{ id: 'child:hero', role: 'spurious_duplicate' }],
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: 'child:hero' },
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: null,
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(0);
    expect(result.conflictingReferenceCount).toBe(0);
    expect(result.draft).toEqual(input);
  });

  it('rebinds the captured raw child alias even when untrusted raw human cast repeats it', () => {
    const input = {
      cast: {
        child: { id: 'child' },
        companion: null,
      },
      humanCast: [{ id: 'child', role: 'invented_human' }],
      pageContracts: [{
        pageNumber: 1,
        actionRequirements: [{
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: 'child' },
          },
        }],
      }],
    };

    const result = projectDraftActionCastReferences({
      draft: input,
      authoritativeChildId: 'child:hero',
      authoritativeCompanionId: null,
      authoritativeHumanIds: [],
    });

    expect(result.reboundReferenceCount).toBe(1);
    expect(result.conflictingReferenceCount).toBe(0);
    expect(result.draft).toMatchObject({
      pageContracts: [{
        actionRequirements: [{
          subject: {
            entity: { kind: 'cast', id: 'child:hero' },
          },
        }],
      }],
    });
  });
});
