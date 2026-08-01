import { parseStorySourceContent } from './storySourceContent';
import {
  ACTION_SEMANTIC_CATALOG,
  ACTION_SEMANTIC_CATALOG_VERSION,
} from './actionSemanticCatalog';

export const ACTION_SEMANTIC_CORPUS_AUDIT_VERSION =
  'action-semantic-corpus-audit/v2' as const;

export interface ActionSemanticCorpusSourceInput {
  sourceId: string;
  rawStorySource: string;
}

export interface ActionSemanticCorpusAudit {
  version: typeof ACTION_SEMANTIC_CORPUS_AUDIT_VERSION;
  catalogVersion: typeof ACTION_SEMANTIC_CATALOG_VERSION;
  parserPath: 'parseStorySourceContent';
  sourceCount: number;
  pageCount: number;
  reviewedCorpusPredicates: string[];
  sources: Array<{
    sourceId: string;
    pageCount: number;
    pageNumbers: number[];
  }>;
  status: 'review_evidence_only';
  semanticCompleteness: 'not_established_by_reachability';
  authorizes: [];
}

function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * One generic path for every Story Source. This audit deliberately reports
 * corpus reachability and the reviewed general catalog data; it does not infer
 * semantic equivalence or grant review/production authority.
 */
export function auditActionSemanticCorpus(
  inputs: readonly ActionSemanticCorpusSourceInput[],
): ActionSemanticCorpusAudit {
  const seenSourceIds = new Set<string>();
  const sources = [...inputs]
    .sort((left, right) =>
      lexicalCompare(left.sourceId, right.sourceId),
    )
    .map((input) => {
      if (!input.sourceId.trim()) {
        throw new Error('corpus sourceId must be non-empty');
      }
      if (seenSourceIds.has(input.sourceId)) {
        throw new Error(
          `duplicate corpus sourceId "${input.sourceId}"`,
        );
      }
      seenSourceIds.add(input.sourceId);
      const parsed = parseStorySourceContent(
        input.rawStorySource,
      );
      if (parsed.pages.length === 0) {
        throw new Error(
          `corpus source "${input.sourceId}" has no pages`,
        );
      }
      return {
        sourceId: input.sourceId,
        pageCount: parsed.pages.length,
        pageNumbers: parsed.pages.map(
          (page) => page.pageNumber,
        ),
      };
    });
  return {
    version: ACTION_SEMANTIC_CORPUS_AUDIT_VERSION,
    catalogVersion: ACTION_SEMANTIC_CATALOG_VERSION,
    parserPath: 'parseStorySourceContent',
    sourceCount: sources.length,
    pageCount: sources.reduce(
      (sum, source) => sum + source.pageCount,
      0,
    ),
    reviewedCorpusPredicates: ACTION_SEMANTIC_CATALOG
      .filter(
        (definition) =>
          definition.corpusBasis ===
          'reviewed_production_corpus',
      )
      .map((definition) => definition.predicate)
      .sort(lexicalCompare),
    sources,
    status: 'review_evidence_only',
    semanticCompleteness: 'not_established_by_reachability',
    authorizes: [],
  };
}
