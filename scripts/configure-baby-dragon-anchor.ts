import { config as loadEnv } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

async function upsertEnvVar(envPath: string, key: string, value: string): Promise<void> {
  let text = '';
  try {
    text = await fs.readFile(envPath, 'utf8');
  } catch {
    text = '';
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  const next = re.test(text)
    ? text.replace(re, line)
    : `${text.replace(/\s*$/, '')}\n${line}\n`;
  await fs.writeFile(envPath, next, 'utf8');
}

async function main() {
  const orderId = process.argv[2]?.trim();
  if (!orderId) {
    console.error(
      'Usage: npx tsx --require ./scripts/shims/register-server-only.cjs scripts/configure-baby-dragon-anchor.ts <orderId>'
    );
    process.exit(1);
  }

  const [{ generateGPTImage }, { uploadOrderSubpathAsset }, { prisma }] = await Promise.all([
    import('@/lib/generate-image'),
    import('@/lib/image-storage'),
    import('@/lib/prisma'),
  ]);

  const prompt = [
    'Canonical NEWBORN baby dragon hatchling anchor — characterId: baby_dragon:dini_hatchling.',
    'Neutral character-only on clean cream background. NO child, NO Dini mother dragon, NO egg, NO scene, NO text.',
    'Style 01 soft watercolor storybook — cute, non-realistic.',
    'Moss-green scales, copper freckles, peach-coral oversized wings, pale cream belly, soft rounded head bumps (NOT horns).',
    'SIZE: small-cat / lap-pet scale — round baby proportions, clearly a NEWBORN — MUCH smaller than an adult or juvenile dragon.',
    'Front or 3/4 standing/sitting, gentle curious expression.',
  ].join('\n');

  const result = await generateGPTImage({
    finalPrompt: prompt,
    negativePrompt:
      'No photorealism. No hard horns. No child. No egg shell. No scene composition. No text or letters.',
    referenceMode: 'style02_book',
    size: '1024x1536',
    quality: (process.env.GPT_IMAGE_QUALITY?.trim() || 'low') as 'low' | 'medium' | 'high',
    modelOverride: process.env.STYLE_01_GPT_MODEL?.trim() || 'gpt-image-2',
  });

  const url = await uploadOrderSubpathAsset({
    orderId,
    subpath: `character-anchors/baby-dragon-dini-hatchling-${Date.now()}.png`,
    buffer: result.buffer,
    contentType: 'image/png',
  });

  const envPath = path.join(process.cwd(), '.env.local');
  await upsertEnvVar(envPath, 'DINI_BABY_DRAGON_ANCHOR_URL', url);

  const [job, orderMeta] = await Promise.all([
    prisma.generationJob.findUnique({
      where: { orderId },
      select: { pipelineCache: true },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      select: { illustrationStyle: true, characterAnchors: true },
    }),
  ]);
  const styleId = orderMeta?.illustrationStyle ?? 'pencil_watercolor';
  const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
  const store = (cache.characterAnchorStore ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const babyEntry = {
    orderId,
    styleId,
    characterId: 'baby_dragon:dini_hatchling',
    role: 'creature',
    anchorType: 'predefined_sheet',
    source: 'static_asset',
    url,
    provider: 'openai',
    model: result.model,
    quality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    qaStatus: 'passed',
    anchorQuality: process.env.GPT_IMAGE_QUALITY?.trim() || 'low',
    createdAt: now,
    updatedAt: now,
  };

  await prisma.generationJob.update({
    where: { orderId },
    data: {
      pipelineCache: {
        ...(cache as object),
        characterAnchorStore: {
          ...store,
          'baby_dragon:dini_hatchling': babyEntry,
        },
      },
    },
  });
  const existingAnchors =
    orderMeta?.characterAnchors && typeof orderMeta.characterAnchors === 'object'
      ? (orderMeta.characterAnchors as Record<string, unknown>)
      : {};
  await prisma.order.update({
    where: { id: orderId },
    data: {
      characterAnchors: {
        ...existingAnchors,
        'baby_dragon:dini_hatchling': {
          ...((existingAnchors['baby_dragon:dini_hatchling'] as Record<string, unknown>) ?? {}),
          name: 'Baby Dragon Hatchling',
          description:
            'Moss-green baby dragon with copper freckles, peach-coral oversized wings, and soft rounded head bumps.',
          relationship: 'creature',
          aliases: ['baby dragon', 'hatchling', 'dini hatchling', 'דרקון קטן'],
          anchorImageUrl: url,
          anchorType: 'predefined_sheet',
          source: 'static_asset',
          qaStatus: 'passed',
          styleId,
          model: result.model,
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        orderId,
        characterId: 'baby_dragon:dini_hatchling',
        url,
        envUpdated: true,
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

