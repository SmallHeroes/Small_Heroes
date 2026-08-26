import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
  ACTION_PREDICATE_VALUES,
  actionSemanticDefinition,
} from '../visual-contract-compiler/actionSemanticCatalog';
import {
  ACTION_SEMANTIC_COVERAGE_VERSION,
  PRESENTATION_REQUIREMENT_CLASS_VALUES,
  actionSemanticCoverageIssues,
  permittedRepresentedElsewherePointerValuesForPage,
  representedElsewherePointerIsPermittedForPage,
  presentationRequirementPointerIsPermittedForPage,
  resolveJsonPointer,
  type ActionSemanticCoverageRecord,
  type ActionSemanticCoverageTemplate,
} from '../visual-contract-compiler/actionSemanticCoverage';
import {
  auditActionSemanticCorpus,
} from '../visual-contract-compiler/actionSemanticCorpusAudit';
import {
  projectActionPredicateProse,
} from '../visual-contract-compiler/projectContractProse';
import {
  CATALOG_STRICT_ACTION_REQUIREMENT_JSON_SCHEMA,
  TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS,
  TEMPLATE_DRAFT_JSON_SCHEMA,
} from '../visual-contract-compiler/templateDraftSchema';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
} from '../visual-package/preRenderBlueprintDraftSchema';

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value as Obj;
}

function resolveVisualContractSchema(value: unknown): Obj {
  const schema = obj(value);
  if (typeof schema.$ref !== 'string') return schema;
  const prefix = '#/$defs/';
  expect(schema.$ref.startsWith(prefix)).toBe(true);
  return obj(
    obj(TEMPLATE_DRAFT_ACTION_REQUIREMENT_JSON_SCHEMA_DEFINITIONS)[
      schema.$ref.slice(prefix.length)
    ],
  );
}

function visualContractPredicateBranches(): Obj[] {
  return obj(CATALOG_STRICT_ACTION_REQUIREMENT_JSON_SCHEMA)
    .anyOf as Obj[];
}

function visualContractPredicates(): unknown[] {
  return visualContractPredicateBranches().flatMap(
    (branch) =>
      obj(obj(branch.properties).predicate).enum as unknown[],
  );
}

function blueprintPredicateEnum(): unknown {
  const root = obj(PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA);
  const worldPlan = obj(obj(root.properties).worldPlan);
  const affordances = obj(obj(worldPlan.properties).affordances);
  const variants = obj(affordances.items).anyOf as unknown[];
  const actionSpace = variants
    .map(obj)
    .find(
      (variant) =>
        obj(obj(variant.properties).kind).const ===
        'action_space',
    );
  const supported = obj(
    obj(actionSpace?.properties).supportedPredicates,
  );
  return obj(supported.items).enum;
}

function coverage(
  overrides: Partial<ActionSemanticCoverageRecord> = {},
): ActionSemanticCoverageRecord {
  return {
    version: ACTION_SEMANTIC_COVERAGE_VERSION,
    pageNumber: 1,
    beatId: 'beat:p1:look',
    sourceEvidenceId: `se1_${'1'.repeat(64)}`,
    sourcePhrase: 'Exact source phrase.',
    disposition: {
      kind: 'action_requirement',
      checkId: 'action:look',
    },
    reviewState: 'unreviewed',
    ...overrides,
  };
}

const template = {
  pageContracts: [
    {
      pageNumber: 1,
      locationId: 'location:one',
      mustShow: ['current contract value'],
      actionRequirements: [
        {
          checkId: 'action:look',
          subject: {
            kind: 'entity',
            entity: { kind: 'cast', id: 'child:hero' },
          },
          predicate: 'looks_at',
          polarity: 'must',
        },
      ],
    },
    {
      pageNumber: 2,
      locationId: 'location:two',
      mustShow: ['second page value'],
    },
  ],
};

describe('central Action Semantic Catalog', () => {
  it('is the one predicate list used by both strict schemas and prose projection', () => {
    const encodedPredicates = visualContractPredicates();
    expect(encodedPredicates).toHaveLength(
      ACTION_PREDICATE_VALUES.length,
    );
    expect(new Set(encodedPredicates)).toEqual(
      new Set(ACTION_PREDICATE_VALUES),
    );
    expect(blueprintPredicateEnum()).toBe(
      ACTION_PREDICATE_VALUES,
    );
    expect(new Set(ACTION_PREDICATE_VALUES).size).toBe(
      ACTION_PREDICATE_VALUES.length,
    );
    for (const definition of ACTION_SEMANTIC_CATALOG) {
      expect(
        projectActionPredicateProse(definition.predicate),
      ).toBe(definition.proseProjection);
      expect(
        actionSemanticDefinition(definition.predicate),
      ).toBe(definition);
    }
    expect(actionSemanticDefinition('sneezes')).toMatchObject({
      subjectKinds: ['cast'],
      objectRule: 'forbidden',
      spatialEffectRule: 'forbidden',
    });
    expect(actionSemanticDefinition('recoils')).toMatchObject({
      subjectKinds: ['cast'],
      objectRule: 'forbidden',
      spatialEffectRule: 'forbidden',
      spatialConstraintRule: 'forbidden',
      lateralityAllowed: false,
    });
    expect(actionSemanticDefinition('sits')).toMatchObject({
      subjectKinds: ['cast', 'cast_group'],
      objectRule: 'forbidden',
      spatialEffectRule: 'forbidden',
      spatialConstraintRule: 'optional',
      spatialConstraintRelations: ['beside'],
      lateralityAllowed: false,
    });
    expect(actionSemanticDefinition('touches').subjectKinds).toContain(
      'source_phenomenon',
    );
    expect(actionSemanticDefinition('moves')).toMatchObject({
      objectRule: 'required',
      spatialEffectRule: 'required',
    });
  });

  it('groups only identical catalog signatures and encodes every predicate static rule exactly once', () => {
    const branches = visualContractPredicateBranches();
    expect(branches).toHaveLength(16);
    for (const definition of ACTION_SEMANTIC_CATALOG) {
      const branch = branches.find(
        (candidate) =>
          (
            obj(obj(candidate.properties).predicate)
              .enum as string[]
          ).includes(definition.predicate),
      );
      expect(branch).toBeDefined();
      expect(branch?.additionalProperties).toBe(false);
      expect(branch?.required).toEqual(
        Object.keys(obj(branch?.properties)),
      );

      const properties = obj(branch?.properties);
      const subjectVariants = resolveVisualContractSchema(
        properties.subject,
      ).anyOf as Obj[];
      const encodedSubjectKinds = subjectVariants.flatMap((variant) => {
        const subjectProperties = obj(variant.properties);
        const kind = obj(subjectProperties.kind).const;
        if (kind === 'entity') {
          return obj(
            obj(subjectProperties.entity).properties,
          ).kind
            ? (obj(obj(obj(subjectProperties.entity).properties).kind)
                .enum as string[])
            : [];
        }
        return [kind];
      });
      expect(encodedSubjectKinds).toEqual(definition.subjectKinds);

      const objectAuthority = resolveVisualContractSchema(
        properties.object,
      );
      if (definition.objectRule === 'forbidden') {
        expect(objectAuthority).toEqual({ type: 'null' });
      } else {
        const objectSchema = definition.objectRule === 'optional'
          ? obj((objectAuthority.anyOf as Obj[])[0])
          : objectAuthority;
        expect(
          obj(obj(objectSchema.properties).kind).enum,
        ).toEqual(definition.objectKinds);
        if (definition.objectRule === 'optional') {
          expect((objectAuthority.anyOf as Obj[])[1]).toEqual({
            type: 'null',
          });
        }
      }

      const effectAuthority = resolveVisualContractSchema(
        properties.spatialEffect,
      );
      if (definition.spatialEffectRule === 'forbidden') {
        expect(effectAuthority).toEqual({ type: 'null' });
      } else if (definition.spatialEffectRule === 'optional') {
        expect((effectAuthority.anyOf as Obj[])[1]).toEqual({
          type: 'null',
        });
      } else {
        expect(effectAuthority.anyOf).toBeDefined();
      }

      const constraintAuthority = resolveVisualContractSchema(
        properties.spatialConstraint,
      );
      if (definition.spatialConstraintRule === 'forbidden') {
        expect(constraintAuthority).toEqual({ type: 'null' });
      } else {
        const constraintSchema =
          definition.spatialConstraintRule === 'optional'
            ? obj((constraintAuthority.anyOf as Obj[])[0])
            : constraintAuthority;
        expect(
          obj(obj(constraintSchema.properties).relation).enum,
        ).toEqual(definition.spatialConstraintRelations);
      }

      expect(resolveVisualContractSchema(properties.laterality)).toEqual(
        definition.lateralityAllowed
          ? {
              anyOf: [
                { type: 'string', enum: ['left', 'right'] },
                { type: 'null' },
              ],
            }
          : { type: 'null' },
      );
    }

    const root = obj(TEMPLATE_DRAFT_JSON_SCHEMA);
    const pageContracts = obj(obj(root.properties).pageContracts);
    const page = obj(pageContracts.items);
    const actions = obj(obj(page.properties).actionRequirements);
    expect(actions).not.toHaveProperty('minItems');
  });

  it('audits all production Story Sources through one generic parser path without embedding source identities in catalog data', () => {
    const bank = path.join(
      process.cwd(),
      'story-bank',
      'v3-approved',
    );
    const sourceFiles = fs
      .readdirSync(bank)
      .filter(
        (name) =>
          name.endsWith('.md') && !name.startsWith('_'),
      )
      .sort();
    const result = auditActionSemanticCorpus(
      sourceFiles.map((name) => ({
        sourceId: name.slice(0, -3),
        rawStorySource: fs.readFileSync(
          path.join(bank, name),
          'utf8',
        ),
      })),
    );
    expect(result).toMatchObject({
      catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
      parserPath: 'parseStorySourceContent',
      sourceCount: 18,
      status: 'review_evidence_only',
      semanticCompleteness:
        'not_established_by_reachability',
      authorizes: [],
    });
    expect(result.sources).toHaveLength(sourceFiles.length);
    expect(result.sources.every((source) => source.pageCount > 0)).toBe(true);
    const catalogJson = JSON.stringify(
      ACTION_SEMANTIC_CATALOG,
    );
    for (const name of sourceFiles) {
      expect(catalogJson).not.toContain(name.slice(0, -3));
    }
  });

  it('keeps calibration story identities and observed gap literals out of production action authority', () => {
    const productionFiles = [
      'actionSemanticCatalog.ts',
      'actionSemanticCoverage.ts',
      'actionSemanticCorpusAudit.ts',
      'compileBookVisualContractTemplate.ts',
      'pageCheckIds.ts',
      'projectContractProse.ts',
      'sourceEvidenceIdRepair.ts',
      'templateDraftSchema.ts',
      'types.ts',
      'validateBookVisualContract.ts',
    ].map((name) =>
      fs.readFileSync(
        path.join(
          process.cwd(),
          'lib',
          'visual-contract-compiler',
          name,
        ),
        'utf8',
      ),
    );
    const production = productionFiles.join('\n');
    for (const literal of [
      'fox_uri',
      'uri_sneezes',
      'drop_touches_finger',
      'bucket_moves_sideways',
      'p6:uri_recoils',
      'p11:seated_beside_bucket',
      'אוּרי התעטש',
      'טיפה קרירה נגעה',
      'אוּרי נרתע.',
      'הם ישבו ליד הדלי.',
    ]) {
      expect(production).not.toContain(literal);
    }
  });
});

describe('Action Semantic Coverage validation', () => {
  it('projects exactly the validator-accepted same-page structured string domain', () => {
    const projectionTemplate = {
      pageContracts: [
        {
          pageNumber: 7,
          locationId: 'location:seven',
          zoneId: 'zone:seven',
          castIds: ['child:hero'],
          mustShow: ['raw page prose'],
          mustNotShow: ['other raw page prose'],
          camera: 'portrait close shot',
          shot: 'close',
          companionStateOverride: {
            stateId: 'companion_state:quiet_green',
            origin: {
              kind: 'story_evidence',
              page: 7,
              phrase: 'source prose is provenance, not visual state',
            },
          },
          propState: [{ propId: 'prop:key', state: 'held' }],
          actionRequirements: [
            {
              checkId: 'action:look',
              predicate: 'looks_at',
            },
          ],
          transition: {
            kind: 'steady',
            fromZoneId: 'zone:six',
            toZoneId: null,
            cue: 'raw transition prose',
          },
        },
        {
          pageNumber: 8,
          locationId: 'location:eight',
          actionRequirements: [],
        },
      ],
    } as unknown as ActionSemanticCoverageTemplate;
    const projected =
      permittedRepresentedElsewherePointerValuesForPage({
        template: projectionTemplate,
        pageNumber: 7,
      });
    expect(projected).toEqual([
      {
        contractPointer: '/pageContracts/0/castIds/0',
        contractValue: 'child:hero',
      },
      {
        contractPointer:
          '/pageContracts/0/companionStateOverride/stateId',
        contractValue: 'companion_state:quiet_green',
      },
      {
        contractPointer: '/pageContracts/0/locationId',
        contractValue: 'location:seven',
      },
      {
        contractPointer: '/pageContracts/0/propState/0/propId',
        contractValue: 'prop:key',
      },
      {
        contractPointer: '/pageContracts/0/propState/0/state',
        contractValue: 'held',
      },
      {
        contractPointer: '/pageContracts/0/transition/fromZoneId',
        contractValue: 'zone:six',
      },
      {
        contractPointer: '/pageContracts/0/transition/kind',
        contractValue: 'steady',
      },
      {
        contractPointer: '/pageContracts/0/zoneId',
        contractValue: 'zone:seven',
      },
    ]);
    for (const pair of projected) {
      expect(
        representedElsewherePointerIsPermittedForPage({
          template: projectionTemplate,
          pageNumber: 7,
          pointer: pair.contractPointer,
        }),
      ).toBe(true);
      expect(
        resolveJsonPointer(
          projectionTemplate,
          pair.contractPointer,
        ),
      ).toEqual({ found: true, value: pair.contractValue });
    }
    for (const pointer of [
      '/pageContracts/0/mustShow/0',
      '/pageContracts/0/mustNotShow/0',
      '/pageContracts/0/camera',
      '/pageContracts/0/shot',
      '/pageContracts/0/transition/cue',
      '/pageContracts/0/actionRequirements/0/checkId',
      '/pageContracts/0/companionStateOverride/origin/kind',
      '/pageContracts/0/companionStateOverride/origin/phrase',
      '/pageContracts/1/locationId',
    ]) {
      expect(
        representedElsewherePointerIsPermittedForPage({
          template: projectionTemplate,
          pageNumber: 7,
          pointer,
        }),
      ).toBe(false);
      expect(projected.map((pair) => pair.contractPointer)).not.toContain(
        pointer,
      );
    }
  });

  it('requires exact same-page action or real current contract-pointer evidence', () => {
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [
          coverage(),
          coverage({
            pageNumber: 2,
            beatId: 'beat:p2:contract',
            disposition: {
              kind: 'represented_elsewhere',
              contractPointer:
                '/pageContracts/1/locationId',
              contractValue: 'location:two',
            },
          }),
        ],
      }),
    ).toEqual([]);

    const stale = coverage({
      pageNumber: 2,
      beatId: 'beat:p2:contract',
      disposition: {
        kind: 'represented_elsewhere',
        contractPointer: '/pageContracts/1/locationId',
        contractValue: 'stale value',
      },
    });
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [coverage(), stale],
      }),
    ).toContainEqual(
      expect.stringContaining(
        'does not exactly match the current pointed-to string value',
      ),
    );
    const missing = coverage({
      pageNumber: 2,
      beatId: 'beat:p2:missing',
      disposition: {
        kind: 'represented_elsewhere',
        contractPointer: '/pageContracts/1/locationId/extra',
        contractValue: 'location:two',
      },
    });
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [coverage(), missing],
      }),
    ).toContainEqual(
      expect.stringContaining('does not resolve'),
    );
  });

  it('rejects prose-only represented_elsewhere and exact-evidence drift for phenomenon subjects', () => {
    const proseOnly = coverage({
      pageNumber: 2,
      beatId: 'beat:p2:prose_only',
      disposition: {
        kind: 'represented_elsewhere',
        contractPointer: '/pageContracts/1/mustShow/0',
        contractValue: 'second page value',
      },
    });
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [coverage(), proseOnly],
      }),
    ).toContainEqual(
      expect.stringContaining('structured non-action, non-prose'),
    );

    const phenomenonTemplate = structuredClone(template);
    (phenomenonTemplate.pageContracts[0] as Obj).actionRequirements = [
      {
        checkId: 'action:touch',
        subject: {
          kind: 'source_phenomenon',
          sourceEvidenceId: `se1_${'2'.repeat(64)}`,
          sourcePhrase: 'Different exact phrase.',
        },
        predicate: 'touches',
        polarity: 'must',
      },
    ];
    expect(
      actionSemanticCoverageIssues({
        template: phenomenonTemplate,
        coverage: [
          coverage({
            disposition: {
              kind: 'action_requirement',
              checkId: 'action:touch',
            },
          }),
          coverage({
            pageNumber: 2,
            beatId: 'beat:p2:context',
            disposition: {
              kind: 'non_visual',
              rationale: 'narrative_context',
            },
          }),
        ],
      }),
    ).toContainEqual(
      expect.stringContaining('exact same-page Source Evidence'),
    );
  });

  it('admits visible non-action beats only through exact same-page typed presentation requirements', () => {
    const requirement = coverage({
      pageNumber: 2,
      beatId: 'beat:p2:quiet_light',
      disposition: {
        kind: 'presentation_requirement',
        presentationClass: 'lighting_state',
        contractPointer: '/pageContracts/1/mustShow/0',
        contractValue: 'second page value',
      },
    });
    expect(PRESENTATION_REQUIREMENT_CLASS_VALUES).toEqual([
      'static_state',
      'lighting_state',
      'composition_focus',
      'graphic_sound_cue',
      'ambient_event',
    ]);
    expect(
      presentationRequirementPointerIsPermittedForPage({
        template,
        pageNumber: 2,
        pointer: '/pageContracts/1/mustShow/0',
      }),
    ).toBe(true);
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [coverage(), requirement],
      }),
    ).toEqual([]);

    for (const bad of [
      {
        ...requirement,
        disposition: {
          ...requirement.disposition,
          contractPointer: '/pageContracts/0/mustShow/0',
        },
      },
      {
        ...requirement,
        disposition: {
          ...requirement.disposition,
          contractPointer: '/pageContracts/1/locationId',
        },
      },
      {
        ...requirement,
        disposition: {
          ...requirement.disposition,
          contractValue: 'stale',
        },
      },
    ]) {
      expect(
        actionSemanticCoverageIssues({
          template,
          coverage: [coverage(), bad as ActionSemanticCoverageRecord],
        }),
      ).not.toEqual([]);
    }
  });

  it('never lets a presentation requirement satisfy an actionRequirement binding', () => {
    const visualPage = structuredClone(template);
    visualPage.pageContracts[1].actionRequirements = [
      {
        checkId: 'action:required_visual',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        polarity: 'must',
      },
    ];
    expect(
      actionSemanticCoverageIssues({
        template: visualPage,
        coverage: [
          coverage(),
          coverage({
            pageNumber: 2,
            beatId: 'beat:p2:presentation',
            disposition: {
              kind: 'presentation_requirement',
              presentationClass: 'static_state',
              contractPointer: '/pageContracts/1/mustShow/0',
              contractValue: 'second page value',
            },
          }),
        ],
      }),
    ).toContainEqual(
      expect.stringContaining(
        'actionRequirement "action:required_visual" has no Action Semantic Coverage binding',
      ),
    );
  });

  it('keeps non-visual disposition explicitly unreviewed and unable to self-approve', () => {
    const evidence = coverage({
      pageNumber: 2,
      beatId: 'beat:p2:internal',
      disposition: {
        kind: 'non_visual',
        rationale: 'internal_state',
      },
    });
    expect(evidence.reviewState).toBe('unreviewed');
    expect(
      actionSemanticCoverageIssues({
        template,
        coverage: [coverage(), evidence],
      }),
    ).toEqual([]);

    const visualPage = structuredClone(template);
    visualPage.pageContracts[1].actionRequirements = [
      {
        checkId: 'action:required_visual',
        subject: {
          kind: 'entity',
          entity: { kind: 'cast', id: 'child:hero' },
        },
        predicate: 'looks_at',
        polarity: 'must',
      },
    ];
    expect(
      actionSemanticCoverageIssues({
        template: visualPage,
        coverage: [coverage(), evidence],
      }),
    ).toContainEqual(
      expect.stringContaining(
        'actionRequirement "action:required_visual" has no Action Semantic Coverage binding',
      ),
    );
  });
});
