import 'server-only';

import type { Prisma } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import {
  buildCharacterAnchorsAfterPhotoDeletion,
  CHILD_PHOTO_DELETION_POLICY,
  getChildPhotoPrivacyMeta,
  isOriginalChildPhotoStorageKey,
  orderHasChildPhotoEvidence,
  resolveDeletableStorageKeysFromOrder,
} from '@/lib/child-photo-deletion-policy';

export {
  buildCharacterAnchorsAfterPhotoDeletion,
  CHILD_PHOTO_DELETION_POLICY,
  getChildPhotoPrivacyMeta,
  isOriginalChildPhotoStorageKey,
  mergeOriginalChildPhotoUrlIntoAnchors,
  parseSupabasePublicObjectKey,
  resolveDeletableStorageKeysFromOrder,
} from '@/lib/child-photo-deletion-policy';
export type { ChildPhotoPrivacyMeta } from '@/lib/child-photo-deletion-policy';

export type ChildPhotoDeletionResult = {
  orderId: string;
  outcome: 'deleted' | 'skipped' | 'nothing_to_delete' | 'failed';
  deletedKeys: string[];
  failedKeys: string[];
  error?: string;
};

type SupabaseEnv = { url: string; serviceRoleKey: string; bucket: string };

function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'book-images';
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey, bucket };
}

function getSupabaseClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey);
}

async function listReferencePhotoKeys(
  supabase: SupabaseClient,
  bucket: string,
  orderId: string
): Promise<string[]> {
  const prefix = `orders/${orderId}/references`;
  const listed = await supabase.storage.from(bucket).list(prefix, {
    limit: 200,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (listed.error || !listed.data?.length) return [];

  return listed.data
    .map((row) => `${prefix}/${row.name}`)
    .filter((key) => isOriginalChildPhotoStorageKey(key));
}

async function deleteStorageKeys(
  supabase: SupabaseClient,
  bucket: string,
  keys: string[]
): Promise<{ deletedKeys: string[]; failedKeys: string[] }> {
  const deletedKeys: string[] = [];
  const failedKeys: string[] = [];

  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const result = await supabase.storage.from(bucket).remove(batch);
    if (result.error) {
      failedKeys.push(...batch);
      continue;
    }
    deletedKeys.push(...batch);
  }

  return { deletedKeys, failedKeys };
}

export async function deleteOriginalChildPhotoForOrder(
  orderId: string,
  options?: { force?: boolean }
): Promise<ChildPhotoDeletionResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, packageStatus: true, childImageUrl: true, characterAnchors: true },
  });
  if (!order) {
    return { orderId, outcome: 'failed', deletedKeys: [], failedKeys: [], error: 'order_not_found' };
  }

  const privacy = getChildPhotoPrivacyMeta(order.characterAnchors);
  if (privacy.childPhotoDeletedAt && !options?.force) {
    return { orderId, outcome: 'skipped', deletedKeys: [], failedKeys: [] };
  }

  if (!orderHasChildPhotoEvidence(order)) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        childImageUrl: null,
        characterAnchors: buildCharacterAnchorsAfterPhotoDeletion(
          order.characterAnchors,
          'no_photo'
        ) as Prisma.InputJsonValue,
      },
    });
    return { orderId, outcome: 'nothing_to_delete', deletedKeys: [], failedKeys: [] };
  }

  const env = getSupabaseEnv();
  if (!env) {
    return {
      orderId,
      outcome: 'failed',
      deletedKeys: [],
      failedKeys: [],
      error: 'missing_supabase_env',
    };
  }

  const supabase = getSupabaseClient(env);
  const keySet = new Set(resolveDeletableStorageKeysFromOrder(order, env.bucket));
  for (const key of await listReferencePhotoKeys(supabase, env.bucket, orderId)) {
    keySet.add(key);
  }
  const keys = [...keySet];

  let deletedKeys: string[] = [];
  let failedKeys: string[] = [];
  if (keys.length > 0) {
    const storageResult = await deleteStorageKeys(supabase, env.bucket, keys);
    deletedKeys = storageResult.deletedKeys;
    failedKeys = storageResult.failedKeys;
  }

  const note = failedKeys.length > 0 ? ('storage_partial' as const) : ('completed' as const);

  if (failedKeys.length > 0) {
    return {
      orderId,
      outcome: 'failed',
      deletedKeys,
      failedKeys,
      error: 'storage_delete_partial',
    };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      childImageUrl: null,
      characterAnchors: buildCharacterAnchorsAfterPhotoDeletion(
        order.characterAnchors,
        note
      ) as Prisma.InputJsonValue,
    },
  });

  return {
    orderId,
    outcome: keys.length > 0 ? 'deleted' : 'nothing_to_delete',
    deletedKeys,
    failedKeys,
  };
}

/** Non-throwing hook — deletion failure must not break book delivery. */
export async function tryDeleteOriginalChildPhotoAfterGeneration(orderId: string): Promise<void> {
  if (CHILD_PHOTO_DELETION_POLICY.delayMs > 0) return;

  try {
    const result = await deleteOriginalChildPhotoForOrder(orderId);
    if (result.outcome === 'failed') {
      console.warn('[child_photo_deletion] completion hook failed', result);
    }
  } catch (error) {
    console.warn('[child_photo_deletion] completion hook threw (non-fatal)', {
      orderId,
      error: String(error),
    });
  }
}

/** Retry stragglers: completed orders that still retain an original photo reference. */
export async function sweepPendingChildPhotoDeletions(limit = 20): Promise<number> {
  const candidates = await prisma.order.findMany({
    where: {
      status: { in: ['ready', 'partial'] },
      packageStatus: 'done',
    },
    orderBy: { updatedAt: 'asc' },
    take: limit * 3,
    select: { id: true, childImageUrl: true, characterAnchors: true },
  });

  let processed = 0;
  for (const order of candidates) {
    if (processed >= limit) break;
    const privacy = getChildPhotoPrivacyMeta(order.characterAnchors);
    if (privacy.childPhotoDeletedAt) continue;
    if (!orderHasChildPhotoEvidence(order)) continue;

    const result = await deleteOriginalChildPhotoForOrder(order.id);
    if (result.outcome !== 'skipped') processed += 1;
  }

  return processed;
}
