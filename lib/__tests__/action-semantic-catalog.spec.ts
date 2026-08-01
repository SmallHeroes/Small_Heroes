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
  actionSemanticCoverageIssues,
  type ActionSemanticCoverageRecord,
} from '../visual-contract-compiler/actionSemanticCoverage';
import {
  auditActionSemanticCorpus,
} from '../visual-contract-compiler/actionSemanticCorpusAudit';
import {
  projectActionPredicateProse,
} from '../visual-contract-compiler/projectContractProse';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
} from '../visual-contract-compiler/templateDraftSchema';
import {
  PRE_RENDER_BLUEPRINT_DRAFT_JSON_SCHEMA,
} from '../visual-package/preRenderBlueprintDraftSchema';

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value as Obj;
}

function visualContractPredicateEnum(): unknown {
  const root = obj(TEMPLATE_DRAFT_JSON_SCHEMA);
  const pageContracts = obj(obj(root.properties).pageContracts);
  const page = obj(pageContracts.items);
  const actions = obj(obj(page.properties).actionRequirements);
  const action = obj(actions.items);
  return obj(obj(action.properties).predicate).enum;
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
      mustShow: ['current contract value'],
      actionRequirements: [
        {
          checkId: 'action:look',
          actorId: 'child:hero',
          predicate: 'looks_at',
          polarity: 'must',
        },
      ],
    },
    {
      pageNumber: 2,
      mustShow: ['second page value'],
    },
  ],
};

describe('central Action Semantic Catalog', () => {
  it('is the one predicate list used by both strict schemas and prose projection', () => {
    expect(visualContractPredicateEnum()).toBe(
      ACTION_PREDICATE_VALUES,
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
});

describe('Action Semantic Coverage validation', () => {
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
                '/pageContracts/1/mustShow/0',
              contractValue: 'second page value',
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
        contractPointer: '/pageContracts/1/mustShow/0',
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
        contractPointer: '/pageContracts/1/mustShow/99',
        contractValue: 'second page value',
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
        actorId: 'child:hero',
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
