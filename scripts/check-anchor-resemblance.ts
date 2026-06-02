import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/check-anchor-resemblance.ts <orderId>'
    );
    process.exit(1);
  }

  const [{ prisma }, { scoreResemblanceAgainstReference, resolveResemblanceThresholdConfig, resolveEffectiveThreshold }] =
    await Promise.all([import('@/lib/prisma'), import('@/lib/resemblance-core')]);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      illustrationStyle: true,
      childImageUrl: true,
      generationJob: { select: { pipelineCache: true } },
    },
  });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const anchorUrl =
    (order.generationJob?.pipelineCache as Record<string, any> | null)?.characterAnchorStore?.child?.url ?? null;
  if (!anchorUrl) throw new Error(`No child anchor found for order ${orderId}`);
  if (!order.childImageUrl) throw new Error(`No child image on order ${orderId}`);

  const cfg = resolveResemblanceThresholdConfig();
  const effectiveThreshold = resolveEffectiveThreshold(order.illustrationStyle, cfg);
  const strictAnchorThreshold = Math.min(0.9, Math.max(effectiveThreshold + 0.04, 0.75));
  const result = await scoreResemblanceAgainstReference({
    referenceImageUrl: order.childImageUrl,
    candidateImageUrl: anchorUrl,
    effectiveThreshold,
    minAcceptableScore: cfg.minAcceptableScore,
  });

  console.log(
    JSON.stringify(
      {
        orderId,
        anchorUrl,
        resemblanceScore: result.resemblanceScore,
        effectiveThreshold,
        strictAnchorThreshold,
        minAcceptableScore: cfg.minAcceptableScore,
        faceDetectConfidence: result.faceDetectConfidence,
        faceAreaRatio: result.faceAreaRatio,
        sanityFlags: result.sanityFlags,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

