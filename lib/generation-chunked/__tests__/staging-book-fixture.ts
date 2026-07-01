/**
 * #7-b staging live-DB proofs — shared throwaway-fixture seed/cleanup. NOT a spec (no tests run here; importing
 * it never connects). Every function takes an injected PrismaClient so a skipped run never touches a DB.
 *
 * seedPassingBook creates a COMPLETE, integrity-passing base book (Order with frozen product-truth + GeneratedBook
 * + contiguous pages + ImageAssets + GenerationJob + QualityEvidence rows) so that commitBaseBookReadiness — with
 * an injected `inspect` that returns a deterministic hash — evaluates the REAL integrity + quality gates to PASS
 * without rendering a single image. Vary `qualityVerdict`/`qualityRegenCount`/`assetSha` to seed the fail paths.
 */
import type { PrismaClient } from '@prisma/client';
import { ROUTES } from '@/lib/routes';
import {
  coverArtifactKey,
  pageArtifactKey,
  QUALITY_EVALUATOR_CONTRACT_VERSION,
} from '@/lib/generation-pipeline/quality-evidence';
import type { AssetInspection } from '@/lib/generation-pipeline/asset-integrity';

/** Canonical app origin the readUrl is validated against (passed as CommitDeps.appBaseUrl — never a prod origin). */
export const STAGING_APP_BASE_URL = 'https://staging.smallheroes.invalid';
/** A deterministic 64-hex delivered-bytes hash: the injected inspect returns it, and the seeded evidence matches it. */
export const FIXTURE_SHA = 'a1b2c3d4'.repeat(8);

/** An injected inspect that reports every delivered URL as a valid raster with a fixed sha — no network, no bytes. */
export function fixtureInspect(sha: string = FIXTURE_SHA) {
  return async (_url: string | null | undefined): Promise<AssetInspection> => ({
    ok: true, bytes: 4096, format: 'webp', mime: 'image/webp', width: 800, height: 1200, sha256: sha,
  });
}

const QA_CTX = {
  expectsChild: true, expectsCompanion: false, expectedPageTimeOfDay: null,
  isEmotionalClosing: false, hasStructuredObjects: false, hasRailedBedOrCrib: false, hasHumanFamily: false,
};

export interface SeedOpts {
  orderId: string;
  /** Contiguous 1..pageCount pages (default 1). expectedPageCount is set to match, so integrity passes. */
  pageCount?: number;
  /** Verdict written to EVERY QualityEvidence row (default 'passed'). Use 'failed' + regenCount for the fail path. */
  qualityVerdict?: 'passed' | 'failed' | 'evidence_unknown';
  /** Durable regen budget already consumed (default 0). >= QUALITY_REGEN_BUDGET makes a 'failed' terminal. */
  qualityRegenCount?: number;
  /** assetSha256 stored on the evidence rows (default FIXTURE_SHA — matches fixtureInspect). Mismatch → hash_mismatch. */
  assetSha?: string;
  /** Initial Order.status (default 'generating'). The commit flips it to ready/needs_human_qa. */
  orderStatus?: string;
}

/** The canonical reader link the integrity gate demands (origin + /ready + ?orderId=). */
export function fixtureReadUrl(orderId: string): string {
  return `${STAGING_APP_BASE_URL}${ROUTES.ready}?orderId=${orderId}`;
}

export async function seedPassingBook(prisma: PrismaClient, opts: SeedOpts): Promise<void> {
  const pageCount = opts.pageCount ?? 1;
  const sha = opts.assetSha ?? FIXTURE_SHA;
  await prisma.order.create({
    data: {
      id: opts.orderId,
      status: (opts.orderStatus ?? 'generating') as never,
      inputVersion: 0,
      fulfillmentVersion: 1,
      // Frozen product-truth — all four required present, expectedPageCount matches the rendered pages.
      expectedPageCount: pageCount,
      storySourceHash: 'fixture-story-hash',
      selectionFilename: 'fixture-selection.md',
      frozenProductVersion: 'fixture-v1',
      customerEmail: 'sevenb-fixture@example.invalid',
      customerName: 'Fixture Parent',
      childName: 'Fixture Child',
      topic: '7b-fixture',
      basePrice: 0, addonsPrice: 0, totalPrice: 0,
      book: {
        create: {
          title: 'Fixture Book',
          readUrl: fixtureReadUrl(opts.orderId),
          coverImageUrl: `https://img.invalid/${opts.orderId}/cover.webp`,
          pages: {
            create: Array.from({ length: pageCount }, (_, i) => ({
              pageNumber: i + 1,
              text: `Fixture page ${i + 1} text with no unresolved markers.`,
              imageAsset: {
                create: {
                  provider: 'test',
                  prompt: `fixture prompt p${i + 1}`,
                  url: `https://img.invalid/${opts.orderId}/p${i + 1}.webp`,
                },
              },
            })),
          },
        },
      },
    },
  });
  // The commit's terminal step updates the GenerationJob → it must exist.
  await prisma.generationJob.create({ data: { orderId: opts.orderId, status: 'running', currentStage: 'package' } });

  const keys = [coverArtifactKey(), ...Array.from({ length: pageCount }, (_, i) => pageArtifactKey(i + 1))];
  for (const artifactKey of keys) {
    await prisma.qualityEvidence.create({
      data: {
        orderId: opts.orderId,
        artifactKey,
        assetSha256: sha,
        verdict: opts.qualityVerdict ?? 'passed',
        evaluatorContractVersion: QUALITY_EVALUATOR_CONTRACT_VERSION,
        regenCount: opts.qualityRegenCount ?? 0,
        evidence: { qaContext: QA_CTX } as never,
      },
    });
  }
}

/** Delete every row this fixture created (children first; Order cascades ExceptionCase + QualityEvidence). */
export async function cleanupFixture(prisma: PrismaClient, orderId: string): Promise<void> {
  const swallow = () => { /* best-effort cleanup */ };
  await prisma.deliveryOutbox.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.bookReadinessManifest.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.bookReadiness.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.imageAsset.deleteMany({ where: { page: { book: { orderId } } } }).catch(swallow);
  await prisma.bookPage.deleteMany({ where: { book: { orderId } } }).catch(swallow);
  await prisma.generatedBook.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.generationJob.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.exceptionCase.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.qualityEvidence.deleteMany({ where: { orderId } }).catch(swallow);
  await prisma.order.delete({ where: { id: orderId } }).catch(swallow);
}
