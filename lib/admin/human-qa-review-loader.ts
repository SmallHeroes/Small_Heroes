import 'server-only';

import type { PrismaClient, HumanQaHoldKind } from '@prisma/client';
import {
  artifactKeyToPageNumber,
  notesFromEvidenceJson,
  parsePageNumbersFromReason,
} from '@/lib/admin/human-qa-review-helpers';
import type {
  BookPageDto,
  OpenReviewCaseSummary,
  PageEvidenceDto,
  ReviewCaseDetail,
} from '@/lib/admin/human-qa-review-types';

/** Prisma select for Order — NEVER includes payment/access-key columns. */
const ORDER_SAFE_SELECT = {
  id: true,
  childName: true,
  status: true,
  storyDirection: true,
  deliveryHoldReason: true,
  inputVersion: true,
  visualContractHash: true,
} as const;

function asHoldKind(kind: HumanQaHoldKind): OpenReviewCaseSummary['kind'] {
  return kind;
}

function buildEvidenceDto(row: {
  artifactKey: string;
  verdict: string;
  reason: string | null;
  contractHash: string | null;
  evidence: unknown;
  safetyHazardsFromAsset?: string[];
  flaggedByCase?: boolean;
}): PageEvidenceDto {
  const parsed = notesFromEvidenceJson(row.evidence);
  const safetyHazards = [
    ...new Set([...(row.safetyHazardsFromAsset ?? []), ...parsed.safetyHazards]),
  ];
  const pageNumber = artifactKeyToPageNumber(row.artifactKey);
  const verdictBad = row.verdict !== 'passed';
  const flagged =
    Boolean(row.flaggedByCase) ||
    verdictBad ||
    safetyHazards.length > 0 ||
    (row.reason?.startsWith('safety:') ?? false) ||
    (row.reason?.startsWith('contract_world') ?? false);

  return {
    artifactKey: row.artifactKey,
    pageNumber,
    verdict: row.verdict,
    reason: row.reason,
    contractHash: row.contractHash,
    safetyHazards,
    notes: parsed.notes,
    anchorConfidence: parsed.anchorConfidence,
    flagged,
  };
}

export async function loadOpenReviewCases(prisma: PrismaClient): Promise<OpenReviewCaseSummary[]> {
  const cases = await prisma.humanQaReviewCase.findMany({
    where: { status: 'open' },
    orderBy: { heldAt: 'desc' },
    select: {
      id: true,
      orderId: true,
      kind: true,
      humanReason: true,
      rawReason: true,
      heldAt: true,
      order: { select: ORDER_SAFE_SELECT },
    },
  });

  return cases.map((c) => ({
    caseId: c.id,
    orderId: c.orderId,
    childName: c.order.childName,
    kind: asHoldKind(c.kind),
    humanReason: c.humanReason,
    rawReason: c.rawReason,
    heldAt: c.heldAt.toISOString(),
    pageNumbers: parsePageNumbersFromReason(c.rawReason),
    storyDirection: c.order.storyDirection,
    orderStatus: c.order.status,
  }));
}

export async function loadReviewCaseDetail(
  prisma: PrismaClient,
  orderId: string,
): Promise<ReviewCaseDetail | null> {
  const openCase = await prisma.humanQaReviewCase.findFirst({
    where: { orderId, status: 'open' },
    orderBy: { heldAt: 'desc' },
    select: {
      id: true,
      orderId: true,
      kind: true,
      status: true,
      humanReason: true,
      rawReason: true,
      holdFingerprint: true,
      inputVersion: true,
      contractHash: true,
      heldAt: true,
      order: {
        select: {
          ...ORDER_SAFE_SELECT,
          book: {
            select: {
              coverImageUrl: true,
              coverSafetyHazards: true,
              pages: {
                orderBy: { pageNumber: 'asc' },
                select: {
                  pageNumber: true,
                  text: true,
                  imageAsset: {
                    select: {
                      url: true,
                      presentationUrl: true,
                      safetyVerified: true,
                      safetyHazards: true,
                    },
                  },
                },
              },
            },
          },
          qualityEvidence: {
            select: {
              artifactKey: true,
              verdict: true,
              reason: true,
              contractHash: true,
              evidence: true,
            },
          },
        },
      },
    },
  });

  if (!openCase) return null;

  const flaggedFromReason = new Set(parsePageNumbersFromReason(openCase.rawReason));
  const assetHazardsByPage = new Map<number, string[]>();
  for (const p of openCase.order.book?.pages ?? []) {
    if (p.imageAsset?.safetyHazards?.length) {
      assetHazardsByPage.set(p.pageNumber, p.imageAsset.safetyHazards);
    }
  }

  const evidence: PageEvidenceDto[] = openCase.order.qualityEvidence.map((row) => {
    const pageNumber = artifactKeyToPageNumber(row.artifactKey);
    const flaggedByCase = pageNumber != null && flaggedFromReason.has(pageNumber);
    return buildEvidenceDto({
      ...row,
      safetyHazardsFromAsset: pageNumber != null ? assetHazardsByPage.get(pageNumber) : undefined,
      flaggedByCase,
    });
  });

  const evidenceByPage = new Map<number, PageEvidenceDto>();
  for (const e of evidence) {
    if (e.pageNumber != null) evidenceByPage.set(e.pageNumber, e);
  }

  const pages: BookPageDto[] = (openCase.order.book?.pages ?? []).map((p) => {
    const ev = evidenceByPage.get(p.pageNumber) ?? null;
    const hazards = p.imageAsset?.safetyHazards ?? [];
    const flagged =
      flaggedFromReason.has(p.pageNumber) ||
      hazards.length > 0 ||
      Boolean(ev?.flagged);
    return {
      pageNumber: p.pageNumber,
      text: p.text,
      imageUrl: p.imageAsset?.presentationUrl ?? p.imageAsset?.url ?? null,
      safetyVerified: p.imageAsset?.safetyVerified ?? null,
      safetyHazards: hazards,
      flagged,
      evidence: ev,
    };
  });

  const flaggedPageNumbers = [
    ...new Set([
      ...flaggedFromReason,
      ...pages.filter((p) => p.flagged).map((p) => p.pageNumber),
      ...evidence.filter((e) => e.flagged && e.pageNumber != null).map((e) => e.pageNumber!),
    ]),
  ].sort((a, b) => a - b);

  return {
    caseId: openCase.id,
    orderId: openCase.orderId,
    childName: openCase.order.childName,
    kind: asHoldKind(openCase.kind),
    status: openCase.status,
    humanReason: openCase.humanReason,
    rawReason: openCase.rawReason,
    holdFingerprint: openCase.holdFingerprint,
    inputVersion: openCase.inputVersion,
    contractHash: openCase.contractHash,
    heldAt: openCase.heldAt.toISOString(),
    storyDirection: openCase.order.storyDirection,
    orderStatus: openCase.order.status,
    deliveryHoldReason: openCase.order.deliveryHoldReason,
    flaggedPageNumbers,
    coverImageUrl: openCase.order.book?.coverImageUrl ?? null,
    coverSafetyHazards: openCase.order.book?.coverSafetyHazards ?? [],
    pages,
    evidence,
  };
}
