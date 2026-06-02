import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/stage0-diagnostics.ts <orderId>'
    );
    process.exit(1);
  }

  const [{ prisma }, { createClient }] = await Promise.all([
    import('@/lib/prisma'),
    import('@supabase/supabase-js'),
  ]);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      childName: true,
      childGender: true,
      childImageUrl: true,
      generationJob: {
        select: { status: true, currentStage: true, lastError: true, pipelineCache: true },
      },
    },
  });
  if (!order) throw new Error(`Order not found: ${orderId}`);

  const cache = (order.generationJob?.pipelineCache ?? {}) as Record<string, any>;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'book-images';
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing supabase env for diagnostics');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const dir = `orders/${orderId}/character-anchors`;
  const listed = await supabase.storage.from(bucket).list(dir, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (listed.error) throw listed.error;
  const rows = (listed.data ?? []).map((x) => ({
    name: x.name,
    size: x.metadata?.size ?? null,
    url: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${dir}/${x.name}`,
  }));

  console.log(
    JSON.stringify(
      {
        orderId,
        childName: order.childName,
        childGender: order.childGender,
        childImageUrl: order.childImageUrl,
        jobStatus: order.generationJob?.status ?? null,
        jobStage: order.generationJob?.currentStage ?? null,
        lastError: order.generationJob?.lastError ?? null,
        childPhotoDescription: cache.childPhotoDescription ?? null,
        childStructured: cache?.dna?.childStructured ?? null,
        childAnchorApproved: cache.childAnchorApproved ?? false,
        stage0SelectedAttempt: cache.stage0SelectedAttempt ?? null,
        anchorReview: {
          approved: cache.childAnchorApproved === true,
          qaStatus: (cache.characterAnchorStore as Record<string, unknown> | undefined)?.child
            ? ((cache.characterAnchorStore as Record<string, { qaStatus?: string }>).child?.qaStatus ?? null)
            : null,
        },
        stage0AnchorPrompt: cache.stage0AnchorPrompt ?? null,
        stage0AnchorReferenceOrderLabels: cache.stage0AnchorReferenceOrderLabels ?? null,
        lockedChildDescription: cache.lockedChildDescription ?? null,
        stage0Candidates: cache.stage0AnchorCandidates ?? null,
        storageCandidates: rows,
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

