import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ACTION_SEMANTIC_CATALOG_PROMPT_COLUMNS,
  REPAIR_PROMPT_VERSION,
  REPAIR_USER_PROMPT_VERSION,
  SOURCE_EVIDENCE_CATALOG_PROMPT_COLUMNS,
  TEMPLATE_PROMPT_VERSION,
  TEMPLATE_USER_PROMPT_VERSION,
  actionSemanticCatalogPromptTable,
  buildTemplateCompileSystemPrompt,
  buildTemplateCompileUserPrompt,
  buildTemplateRepairSystemPrompt,
  buildTemplateRepairUserPrompt,
  sourceEvidenceCatalogPromptTable,
} from '../visual-contract-compiler/compileBookVisualContractTemplate';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
} from '../visual-contract-compiler/actionSemanticCatalog';
import {
  extractDeterministicFacts,
} from '../visual-contract-compiler/extractDeterministicFacts';
import type {
  SourceEvidenceCatalogEntry,
} from '../visual-contract-compiler/sourceEvidenceCatalog';
import {
  TEMPLATE_DRAFT_JSON_SCHEMA,
  TEMPLATE_DRAFT_SCHEMA_VERSION,
} from '../visual-contract-compiler/templateDraftSchema';
import {
  PAGE_CONTRACT_REPAIR_JSON_SCHEMA,
  buildPageContractRepairSystemPrompt,
  buildPageContractRepairUserPrompt,
  pageContractRepairAffectedPages,
} from '../visual-contract-compiler/pageContractRepair';
import type { DraftAuthorityReferenceIssue } from '../visual-contract-compiler/draftAuthorityReferenceDiagnostics';
import type { DraftValidationIssue } from '../visual-contract-compiler/draftValidationDiagnostics';
import {
  buildStorySourceAuthoritySnapshot,
  buildVisualContractAuthoringRequest,
  canonicalJsonDigest,
  runVisualContractAuthoring,
  storySourceSnapshotToTemplateInput,
} from '../visual-package';

const REPO_ROOT = process.cwd();
const BANK = path.join(
  REPO_ROOT,
  'story-bank',
  'v3-approved',
);
const REQUESTED_AT = '2026-08-04T00:00:00.000Z';
const tempRoots: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function approvedSourceFiles(): string[] {
  return fs
    .readdirSync(BANK)
    .filter(
      (name) =>
        name.endsWith('.md') && !name.startsWith('_'),
    )
    .sort();
}

function approvedSnapshot(name: string) {
  const storyKey = name.slice(0, -3);
  return buildStorySourceAuthoritySnapshot({
    repoRoot: REPO_ROOT,
    storyKey,
    storyPath: `story-bank/v3-approved/${name}`,
  });
}

function utf8Lines(lines: readonly string[]): number {
  return Buffer.byteLength(lines.join('\n'), 'utf8');
}

function sourceProjection(entry: SourceEvidenceCatalogEntry) {
  return {
    pageNumber: entry.pageNumber,
    excerptOrdinal: entry.excerptOrdinal,
    startOffsetUtf8: entry.startOffsetUtf8,
    endOffsetUtf8: entry.endOffsetUtf8,
    sourceEvidenceId: entry.sourceEvidenceId,
    excerpt: entry.excerpt,
  };
}

function actionProjection(
  definition: (typeof ACTION_SEMANTIC_CATALOG)[number],
) {
  return {
    predicate: definition.predicate,
    subjectKinds: [...definition.subjectKinds],
    objectRule: definition.objectRule,
    objectKinds: [...definition.objectKinds],
    spatialEffectRule: definition.spatialEffectRule,
    spatialConstraintRule:
      definition.spatialConstraintRule,
    spatialConstraintRelations: [
      ...definition.spatialConstraintRelations,
    ],
    lateralityAllowed: definition.lateralityAllowed,
    proseProjection: definition.proseProjection,
  };
}

describe('Visual Contract prompt authority-table compaction', () => {
  it('round-trips every Source Evidence prompt value, duplicate excerpt, Unicode, punctuation, and JSON escape in exact order', () => {
    const duplicateExcerpt =
      '×˜×™×¤×” "×§×¨×”" \\ × ×’×¢×”; ××– × ×¢×¦×¨×”.';
    const entries: SourceEvidenceCatalogEntry[] = [
      {
        sourceEvidenceId: `se1_${'1'.repeat(64)}`,
        pageNumber: 2,
        excerptOrdinal: 1,
        startOffsetUtf16: 0,
        endOffsetUtf16: duplicateExcerpt.length,
        startOffsetUtf8: 0,
        endOffsetUtf8: Buffer.byteLength(
          duplicateExcerpt,
          'utf8',
        ),
        excerpt: duplicateExcerpt,
      },
      {
        sourceEvidenceId: `se1_${'2'.repeat(64)}`,
        pageNumber: 2,
        excerptOrdinal: 2,
        startOffsetUtf16: duplicateExcerpt.length + 1,
        endOffsetUtf16: duplicateExcerpt.length * 2 + 1,
        startOffsetUtf8:
          Buffer.byteLength(duplicateExcerpt, 'utf8') + 1,
        endOffsetUtf8:
          Buffer.byteLength(duplicateExcerpt, 'utf8') * 2 +
          1,
        excerpt: duplicateExcerpt,
      },
      {
        sourceEvidenceId: `se1_${'3'.repeat(64)}`,
        pageNumber: 10,
        excerptOrdinal: 1,
        startOffsetUtf16: 0,
        endOffsetUtf16: 12,
        startOffsetUtf8: 0,
        endOffsetUtf8: 12,
        excerpt: 'line\ttab\nmark',
      },
    ];

    const first = sourceEvidenceCatalogPromptTable(entries);
    const second = sourceEvidenceCatalogPromptTable(entries);
    const reconstructed = first.slice(1).map((line) => {
      const [
        pageNumber,
        excerptOrdinal,
        startOffsetUtf8,
        endOffsetUtf8,
        sourceEvidenceId,
        excerpt,
      ] = JSON.parse(line) as [
        number,
        number,
        number,
        number,
        string,
        string,
      ];
      return {
        pageNumber,
        excerptOrdinal,
        startOffsetUtf8,
        endOffsetUtf8,
        sourceEvidenceId,
        excerpt,
      };
    });

    expect(first).toEqual(second);
    expect(JSON.parse(first[0]!)).toEqual(
      SOURCE_EVIDENCE_CATALOG_PROMPT_COLUMNS,
    );
    expect(reconstructed).toEqual(
      entries.map(sourceProjection),
    );
    expect(
      reconstructed.filter(
        (entry) => entry.excerpt === duplicateExcerpt,
      ),
    ).toHaveLength(2);
    expect(first.join('\n')).toContain('\\"');
    expect(first.join('\n')).toContain('\\\\');
    expect(first.join('\n')).toContain('\\t');
    expect(first.join('\n')).toContain('\\n');
  });

  it('round-trips the complete Action Semantic canonical prompt projection in exact catalog order', () => {
    const first = actionSemanticCatalogPromptTable();
    const second = actionSemanticCatalogPromptTable();
    const reconstructed = first.slice(1).map((line) => {
      const [
        predicate,
        subjectKinds,
        objectRule,
        objectKinds,
        spatialEffectRule,
        spatialConstraintRule,
        spatialConstraintRelations,
        lateralityAllowed,
        proseProjection,
      ] = JSON.parse(line) as [
        string,
        string[],
        string,
        string[],
        string,
        string,
        string[],
        boolean,
        string,
      ];
      return {
        predicate,
        subjectKinds,
        objectRule,
        objectKinds,
        spatialEffectRule,
        spatialConstraintRule,
        spatialConstraintRelations,
        lateralityAllowed,
        proseProjection,
      };
    });

    expect(first).toEqual(second);
    expect(JSON.parse(first[0]!)).toEqual(
      ACTION_SEMANTIC_CATALOG_PROMPT_COLUMNS,
    );
    expect(reconstructed).toEqual(
      ACTION_SEMANTIC_CATALOG.map(actionProjection),
    );
    expect(reconstructed.map((entry) => entry.predicate)).toEqual(
      ACTION_SEMANTIC_CATALOG.map(
        (definition) => definition.predicate,
      ),
    );
  });

  it('reuses the exact Source Evidence serializer for initial and relevant full-draft repair catalogs', () => {
    const snapshot = approvedSnapshot(
      'fox_uri_adventure.md',
    );
    const input = storySourceSnapshotToTemplateInput(snapshot);
    const facts = extractDeterministicFacts(input);
    const initialTable = sourceEvidenceCatalogPromptTable(
      input.sourceEvidenceCatalog.entries,
    ).join('\n');
    const pageSixEntries =
      input.sourceEvidenceCatalog.entries.filter(
        (entry) => entry.pageNumber === 6,
      );
    const repairTable = sourceEvidenceCatalogPromptTable(
      pageSixEntries,
    ).join('\n');

    const initial = buildTemplateCompileUserPrompt(
      input,
      facts,
    );
    const repair = buildTemplateRepairUserPrompt(
      {},
      [
        'source_evidence_id_invalid:source_evidence_id_unknown: page 6.actionSemanticCoverage[0].sourceEvidenceId must resolve',
      ],
      facts,
      input,
    );

    expect(initial).toContain(initialTable);
    expect(repair).toContain(repairTable);
    expect(initial).not.toContain(' | occurrence ');
    expect(repair).not.toContain(' | occurrence ');
    expect(pageSixEntries.length).toBeGreaterThan(0);
  });

  it('keeps the exact five-issue Fox page-spatial compact repair below 64K with safety headroom', () => {
    const snapshot = approvedSnapshot(
      'fox_uri_adventure.md',
    );
    const previousDraft = JSON.parse(
      fs.readFileSync(
        path.join(
          BANK,
          'fox_uri_adventure.visual-contract-template.json',
        ),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const positions = [
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [4, 0],
    ] as const;
    const authorityIssues: DraftAuthorityReferenceIssue[] = positions.map(
      ([pageNumber, actionIndex]) => ({
        code: 'page_spatial_reference_outside_zone',
        locator: {
          kind: 'page_spatial_action',
          referenceClass: 'page_spatial_selection',
          fieldRole: 'object',
          pageNumber,
          actionIndex,
        },
      }),
    );
    const diagnosticIssues: DraftValidationIssue[] = positions.map(
      ([pageNumber, actionIndex]) => ({
        family: 'draft_contract',
        code: 'out_of_scope_reference',
        locator: {
          kind: 'page_item',
          collectionRole: 'page_actions',
          fieldRole: 'reference',
          pageNumber,
          itemIndex: actionIndex,
        },
      }),
    );
    const affectedPages = pageContractRepairAffectedPages({
      draft: previousDraft,
      diagnosticIssues,
      pageSpatialIssues: authorityIssues,
      pageSpatialAuthority: [...new Set(positions.map(([page]) => page))]
        .sort((left, right) => left - right)
        .map((pageNumber) => {
          const pageContract = (
            previousDraft.pageContracts as Array<Record<string, unknown>>
          ).find((page) => page.pageNumber === pageNumber)!;
          const zone = (
            previousDraft.zones as Array<Record<string, unknown>>
          ).find((candidate) => candidate.id === pageContract.zoneId)!;
          return {
            pageNumber,
            zoneId: String(pageContract.zoneId),
            permittedSpatialReferences: (
              zone.spatialNodes as Array<Record<string, unknown>>
            ).map((node) => ({
              id: String(node.id),
              kind: String(node.kind),
              description: String(node.description),
            })),
          };
        }),
    });
    expect(affectedPages?.map((page) => page.pageNumber)).toEqual([
      1, 2, 4,
    ]);
    const systemPrompt = buildPageContractRepairSystemPrompt();
    const userPrompt = buildPageContractRepairUserPrompt({
      affectedPages: affectedPages!,
    });
    const promptAndSchemaTokenUpperBound =
      Buffer.byteLength(
        [
          systemPrompt,
          userPrompt,
          JSON.stringify(PAGE_CONTRACT_REPAIR_JSON_SCHEMA),
        ].join('\n'),
        'utf8',
      ) + 4_096;

    expect(promptAndSchemaTokenUpperBound).toBeLessThan(64_000);
    expect(64_000 - promptAndSchemaTokenUpperBound).toBeGreaterThan(
      4_096,
    );
    expect(userPrompt).toContain('permittedSpatialReferences');
    expect(userPrompt).not.toContain('AUTHORITATIVE FACTS');
  });

  it('saves the approved exact Fox upper-bound units while preserving the immutable draft schema', () => {
    const snapshot = approvedSnapshot(
      'fox_uri_adventure.md',
    );
    const catalog = snapshot.content.sourceEvidenceCatalog;
    const legacySourceTable = [
      `SOURCE EVIDENCE CATALOG (${catalog.version}; compiler-owned exact excerpts):`,
      ...catalog.entries.map(
        (entry) =>
          `- page ${entry.pageNumber} | occurrence ${entry.excerptOrdinal} | utf8 ${entry.startOffsetUtf8}-${entry.endOffsetUtf8} | ${entry.sourceEvidenceId} | ${JSON.stringify(entry.excerpt)}`,
      ),
    ];
    const compactSourceTable = [
      `SOURCE EVIDENCE CATALOG (${catalog.version}; compiler-owned exact excerpts)`,
      ...sourceEvidenceCatalogPromptTable(catalog.entries),
    ];
    const legacyActionTable = [
      `- Action Semantic Catalog authority is ${ACTION_SEMANTIC_CATALOG_VERSION}. Use only these atomic predicates:`,
      ...ACTION_SEMANTIC_CATALOG.map((definition) => {
        const objectKinds =
          definition.objectKinds.length > 0
            ? definition.objectKinds.join('|')
            : 'none';
        return (
          `- ${definition.predicate}: projection="${definition.proseProjection}"; ` +
          `subjects=${definition.subjectKinds.join('|')}; ` +
          `object=${definition.objectRule}[${objectKinds}]; ` +
          `spatialEffect=${definition.spatialEffectRule}; ` +
          `spatialConstraint=${definition.spatialConstraintRule}` +
          `[${definition.spatialConstraintRelations.join('|') || 'none'}]; ` +
          `laterality=${definition.lateralityAllowed ? 'allowed' : 'forbidden'}`
        );
      }),
    ];
    const compactActionTable = [
      `- Action Semantic Catalog authority is ${ACTION_SEMANTIC_CATALOG_VERSION}. Use this JSON tuple table:`,
      ...actionSemanticCatalogPromptTable(),
    ];

    expect(
      utf8Lines(legacySourceTable) -
        utf8Lines(compactSourceTable),
    ).toBe(4_361);
    expect(
      utf8Lines(legacyActionTable) -
        utf8Lines(compactActionTable),
    ).toBe(2_060);
    expect(TEMPLATE_DRAFT_SCHEMA_VERSION).toBe(
      'vc-draft-schema/v13',
    );
    expect(
      Buffer.byteLength(
        JSON.stringify(TEMPLATE_DRAFT_JSON_SCHEMA),
        'utf8',
      ),
    ).toBe(13_072);
    expect(
      canonicalJsonDigest(TEMPLATE_DRAFT_JSON_SCHEMA),
    ).toBe(
      'e4d28ce7446e58dd627757f55da112de98a02da8988e3052c91fd3d99bf67508',
    );
  });

  it('keeps all 18 approved Story Sources within 64K with more than 1,024 units of headroom and never reaches the provider', async () => {
    const sourceFiles = approvedSourceFiles();
    const provider = {
      call: vi.fn(async () => {
        throw new Error('provider must remain unreachable');
      }),
    };
    const measurements: Array<{
      storyKey: string;
      upperBound: number;
      headroom: number;
    }> = [];

    for (const name of sourceFiles) {
      const storyKey = name.slice(0, -3);
      const snapshot = approvedSnapshot(name);
      const request = buildVisualContractAuthoringRequest({
        snapshot,
        mode: 'preflight',
        requestId: `prompt-compaction-${storyKey}`,
        requestedAt: REQUESTED_AT,
      });
      const result = await runVisualContractAuthoring({
        request,
        snapshot,
        provider,
      });
      const upperBound =
        request.tokenBudget.promptAndSchemaTokenUpperBound;
      measurements.push({
        storyKey,
        upperBound,
        headroom:
          request.tokenBudget.maxInputTokens - upperBound,
      });
      expect(
        result.receipt.failure?.issues ?? [],
      ).not.toContain('input_token_ceiling_exceeded');
      expect(result.receipt.callCount).toBe(0);
    }

    const fox = measurements.find(
      (measurement) =>
        measurement.storyKey === 'fox_uri_adventure',
    );
    const worst = [...measurements].sort(
      (left, right) =>
        right.upperBound - left.upperBound,
    )[0];
    expect(sourceFiles).toHaveLength(18);
    expect(measurements).toHaveLength(18);
    expect(
      measurements.every(
        (measurement) => measurement.upperBound <= 64_000,
      ),
    ).toBe(true);
    expect(
      Math.min(
        ...measurements.map(
          (measurement) => measurement.headroom,
        ),
      ),
    ).toBeGreaterThan(1_024);
    expect(fox).toEqual({
      storyKey: 'fox_uri_adventure',
      upperBound: 57_926,
      headroom: 6_074,
    });
    expect(worst).toEqual({
      storyKey: 'lion_shaket_fantasy',
      upperBound: 62_932,
      headroom: 1_068,
    });
    expect(provider.call).not.toHaveBeenCalled();
  });

  it('binds only the changed prompt authorities and fails closed on a genuinely over-budget synthetic input before provider reachability', async () => {
    expect(TEMPLATE_PROMPT_VERSION).toBe(
      'vc-template-prompt/v10',
    );
    expect(TEMPLATE_USER_PROMPT_VERSION).toBe(
      'vc-template-user-prompt/v10',
    );
    expect(REPAIR_PROMPT_VERSION).toBe(
      'vc-repair-prompt/v9',
    );
    expect(REPAIR_USER_PROMPT_VERSION).toBe(
      'vc-repair-user-prompt/v10',
    );

    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'prompt-ceiling-'),
    );
    tempRoots.push(repoRoot);
    const storyKey = 'general_over_budget_fixture';
    const storyPath = `stories/${storyKey}.md`;
    const absoluteStoryPath = path.join(
      repoRoot,
      storyPath,
    );
    fs.mkdirSync(path.dirname(absoluteStoryPath), {
      recursive: true,
    });
    fs.writeFileSync(
      absoluteStoryPath,
      [
        '---',
        'title: "General over-budget fixture"',
        'gender: female',
        'pages: 12',
        '---',
        '',
        ...Array.from(
          { length: 12 },
          (_, index) => index + 1,
        ).flatMap((pageNumber) => [
          `--- Page ${pageNumber} ---`,
          `The child chooses a careful next step on page ${pageNumber} ${'with visible detail '.repeat(500)}.`,
          '',
          `imageDirection: A neutral composition for page ${pageNumber}.`,
          '',
        ]),
      ].join('\n'),
      'utf8',
    );
    const snapshot = buildStorySourceAuthoritySnapshot({
      repoRoot,
      storyKey,
      storyPath,
    });
    const request = buildVisualContractAuthoringRequest({
      snapshot,
      mode: 'preflight',
      requestId: 'genuinely-over-budget',
      requestedAt: REQUESTED_AT,
    });
    const provider = {
      call: vi.fn(async () => {
        throw new Error('provider must remain unreachable');
      }),
    };
    const result = await runVisualContractAuthoring({
      request,
      snapshot,
      provider,
    });

    expect(
      request.tokenBudget.promptAndSchemaTokenUpperBound,
    ).toBeGreaterThan(64_000);
    expect(result.receipt.status).toBe('failed');
    expect(result.receipt.failure?.issues).toContain(
      'input_token_ceiling_exceeded',
    );
    expect(provider.call).not.toHaveBeenCalled();
    expect(buildTemplateCompileSystemPrompt()).toContain(
      JSON.stringify(ACTION_SEMANTIC_CATALOG_PROMPT_COLUMNS),
    );
  });
});
