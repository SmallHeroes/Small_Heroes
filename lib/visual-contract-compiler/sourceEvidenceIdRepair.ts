import {
  resolveSourceEvidenceId,
  type SourceEvidenceCatalog,
} from './sourceEvidenceCatalog';

export const SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_VERSION =
  'source-evidence-id-repair-schema/v1' as const;
export const SOURCE_EVIDENCE_ID_REPAIR_SCHEMA_NAME =
  'SourceEvidenceIdRepairPatches' as const;
export const SOURCE_EVIDENCE_ID_REPAIR_PROMPT_VERSION =
  'source-evidence-id-repair-prompt/v1' as const;
export const SOURCE_EVIDENCE_ID_REPAIR_USER_PROMPT_VERSION =
  'source-evidence-id-repair-user-prompt/v1' as const;

function strictObject(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

const sourceEvidenceIdPatch = strictObject({
  pageNumber: { type: 'integer', minimum: 1 },
  beatId: { type: 'string' },
  sourceEvidenceId: {
    type: 'string',
    pattern: '^se1_[a-f0-9]{64}$',
  },
});

export const SOURCE_EVIDENCE_ID_REPAIR_JSON_SCHEMA: Record<
  string,
  unknown
> = strictObject({
  patches: {
    type: 'array',
    minItems: 1,
    items: sourceEvidenceIdPatch,
  },
});

export interface SourceEvidenceIdRepairAffectedRecord {
  pageNumber: number;
  coverageIndex: number;
  beatId: string;
  failureCode:
    | 'source_evidence_id_malformed'
    | 'source_evidence_id_unknown'
    | 'source_evidence_id_wrong_page';
  coverageRecord: {
    beatId: string;
    sourceEvidenceId: unknown;
    disposition: unknown;
  };
  actionRequirement: {
    beatId: unknown;
    subject: unknown;
    predicate: unknown;
    object: unknown;
    spatialEffect: unknown;
    polarity: unknown;
    laterality: unknown;
  } | null;
}

export interface SourceEvidenceIdPatch {
  pageNumber: number;
  beatId: string;
  sourceEvidenceId: string;
}

export function buildSourceEvidenceIdRepairSystemPrompt(): string {
  return [
    'You repair ONLY invalid Source Evidence Catalog ID selections.',
    'The input contains only affected page/beat records and exact relevant catalog entries.',
    'Return exactly one patch for every affected pageNumber+beatId and no other patch.',
    'Each sourceEvidenceId must be copied exactly from a catalog entry on that same page.',
    'Do not rewrite beats, dispositions, action requirements, prose, or any other contract field.',
    'Output only the JSON patch object required by the schema.',
  ].join('\n');
}

export function relevantSourceEvidenceCatalogEntries(args: {
  catalog: SourceEvidenceCatalog;
  affectedRecords: readonly SourceEvidenceIdRepairAffectedRecord[];
}): Array<{
  sourceEvidenceId: string;
  pageNumber: number;
  excerptOrdinal: number;
  startOffsetUtf8: number;
  endOffsetUtf8: number;
  excerpt: string;
}> {
  const pages = new Set(
    args.affectedRecords.map((record) => record.pageNumber),
  );
  return args.catalog.entries
    .filter((entry) => pages.has(entry.pageNumber))
    .map((entry) => ({
      sourceEvidenceId: entry.sourceEvidenceId,
      pageNumber: entry.pageNumber,
      excerptOrdinal: entry.excerptOrdinal,
      startOffsetUtf8: entry.startOffsetUtf8,
      endOffsetUtf8: entry.endOffsetUtf8,
      excerpt: entry.excerpt,
    }));
}

export function buildSourceEvidenceIdRepairUserPrompt(args: {
  catalog: SourceEvidenceCatalog;
  affectedRecords: readonly SourceEvidenceIdRepairAffectedRecord[];
}): string {
  const affectedRecords = [...args.affectedRecords].sort(
    (left, right) =>
      left.pageNumber - right.pageNumber ||
      (left.beatId < right.beatId
        ? -1
        : left.beatId > right.beatId
          ? 1
          : 0),
  );
  return JSON.stringify({
    affectedRecords,
    catalogEntries: relevantSourceEvidenceCatalogEntries({
      catalog: args.catalog,
      affectedRecords,
    }),
  });
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

export function parseSourceEvidenceIdPatches(
  raw: string,
): SourceEvidenceIdPatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('source_evidence_id_repair_response_invalid_json');
  }
  const root = recordValue(parsed);
  if (!root || !exactKeys(root, ['patches']) || !Array.isArray(root.patches)) {
    throw new Error('source_evidence_id_repair_response_invalid_shape');
  }
  return root.patches.map((value) => {
    const patch = recordValue(value);
    if (
      !patch ||
      !exactKeys(patch, [
        'pageNumber',
        'beatId',
        'sourceEvidenceId',
      ]) ||
      !Number.isSafeInteger(patch.pageNumber) ||
      (patch.pageNumber as number) < 1 ||
      typeof patch.beatId !== 'string' ||
      typeof patch.sourceEvidenceId !== 'string'
    ) {
      throw new Error('source_evidence_id_repair_patch_invalid');
    }
    return {
      pageNumber: patch.pageNumber as number,
      beatId: patch.beatId,
      sourceEvidenceId: patch.sourceEvidenceId,
    };
  });
}

function patchKey(value: { pageNumber: number; beatId: string }): string {
  return `${value.pageNumber}\u0000${value.beatId}`;
}

export function applySourceEvidenceIdPatches(args: {
  draft: Record<string, unknown>;
  catalog: SourceEvidenceCatalog;
  affectedRecords: readonly SourceEvidenceIdRepairAffectedRecord[];
  patches: readonly SourceEvidenceIdPatch[];
}): Record<string, unknown> {
  const expected = new Map(
    args.affectedRecords.map((record) => [patchKey(record), record]),
  );
  if (expected.size !== args.affectedRecords.length) {
    throw new Error('source_evidence_id_repair_affected_record_duplicate');
  }
  if (args.patches.length !== expected.size) {
    throw new Error('source_evidence_id_repair_patch_set_incomplete');
  }

  const draft = structuredClone(args.draft);
  const pages = Array.isArray(draft.pageContracts)
    ? draft.pageContracts
    : [];
  const seen = new Set<string>();

  for (const patch of args.patches) {
    const key = patchKey(patch);
    if (!expected.has(key) || seen.has(key)) {
      throw new Error('source_evidence_id_repair_patch_unexpected_or_duplicate');
    }
    seen.add(key);
    const resolution = resolveSourceEvidenceId({
      catalog: args.catalog,
      sourceEvidenceId: patch.sourceEvidenceId,
      pageNumber: patch.pageNumber,
    });
    if (!resolution.ok) {
      throw new Error(`source_evidence_id_repair_patch_${resolution.code}`);
    }
    const matchingPages = pages
      .map(recordValue)
      .filter((page) => page?.pageNumber === patch.pageNumber);
    if (matchingPages.length !== 1) {
      throw new Error('source_evidence_id_repair_page_not_unique');
    }
    const coverage = Array.isArray(matchingPages[0]!.actionSemanticCoverage)
      ? matchingPages[0]!.actionSemanticCoverage
      : [];
    const matchingRecords = coverage
      .map(recordValue)
      .filter((record) => record?.beatId === patch.beatId);
    if (matchingRecords.length !== 1) {
      throw new Error('source_evidence_id_repair_beat_not_unique');
    }
    matchingRecords[0]!.sourceEvidenceId = patch.sourceEvidenceId;
    const disposition = recordValue(
      matchingRecords[0]!.disposition,
    );
    if (disposition?.kind === 'action_requirement') {
      const actions = Array.isArray(
        matchingPages[0]!.actionRequirements,
      )
        ? matchingPages[0]!.actionRequirements
        : [];
      const matchingActions = actions
        .map(recordValue)
        .filter(
          (action) =>
            action?.beatId === patch.beatId,
        );
      if (matchingActions.length !== 1) {
        throw new Error(
          'source_evidence_id_repair_action_not_unique',
        );
      }
      const subject = recordValue(matchingActions[0]!.subject);
      if (subject?.kind === 'source_phenomenon') {
        subject.sourceEvidenceId = patch.sourceEvidenceId;
      }
    }
  }
  if (seen.size !== expected.size) {
    throw new Error('source_evidence_id_repair_patch_set_incomplete');
  }
  return draft;
}
