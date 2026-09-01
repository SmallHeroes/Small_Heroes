import 'server-only';

import type { Prisma } from '@prisma/client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import { logServerEvent } from '@/lib/server-events';

// (Track-4 Unit 1) A failed child-photo deletion leaves a photograph of a child reachable. It must be OBSERVABLE —
// structured log + a greppable metric event — so it is retried by the sweeper, never silently swallowed.
const log = createLogger({ subsystem: 'child-photo-deletion' });
import {
  buildCharacterAnchorsAfterPhotoDeletion,
  CHILD_PHOTO_DELETION_POLICY,
  getChildPhotoPrivacyMeta,
  isOriginalChildPhotoStorageKey,
  orderHasChildPhotoEvidence,
  parseSupabasePublicObjectKey,
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
      // (Track-4 Unit 1) Do NOT discard the real Supabase error — a child's photo is still reachable. Log it so the
      // batch can be diagnosed + retried; the failedKeys still flip the order outcome to 'failed'.
      log.error('storage remove failed — child photo still reachable', result.error, { bucket, batchSize: batch.length });
      failedKeys.push(...batch);
      continue;
    }
    deletedKeys.push(...batch);
  }

  return { deletedKeys, failedKeys };
}

/**
 * Compensating cleanup for a release/v1 Order attempt whose child-photo upload
 * succeeded but whose atomic database commit did not. The caller supplies the
 * exact draft scope it created, so this helper cannot delete another Order's
 * reference photo even when handed a hostile URL.
 */
export async function deleteDraftChildPhotoUpload(params: {
  publicUrl: string;
  draftScopeId: string;
}): Promise<void> {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error('missing_supabase_env');
  }

  const key = parseSupabasePublicObjectKey(params.publicUrl, env.bucket);
  const expectedPrefix = `orders/${params.draftScopeId}/references/`;
  if (
    !key ||
    !key.startsWith(expectedPrefix) ||
    !isOriginalChildPhotoStorageKey(key)
  ) {
    throw new Error('draft_child_photo_cleanup_scope_mismatch');
  }

  const result = await getSupabaseClient(env).storage.from(env.bucket).remove([key]);
  if (result.error) {
    log.error('draft child-photo cleanup failed — photo remains reachable', result.error, {
      draftScopeId: params.draftScopeId,
      key,
    });
    logServerEvent('child_photo_deletion_failed', {
      orderId: params.draftScopeId,
      stage: 'release_v1_order_commit_compensation',
    });
    throw new Error(`draft_child_photo_cleanup_failed:${result.error.message}`);
  }
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
    log.error('cannot delete child photo — Supabase env missing; photo remains reachable', undefined, { orderId });
    logServerEvent('child_photo_deletion_failed', { orderId, stage: 'missing_supabase_env' });
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
    log.error('child-photo deletion PARTIAL — some objects still reachable', undefined, { orderId, failedKeys, deletedKeys });
    logServerEvent('child_photo_deletion_failed', { orderId, stage: 'storage_delete_partial', failedKeyCount: failedKeys.length });
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

/**
 * Non-throwing hook — deletion failure must not break book delivery, BUT (Track-4 Unit 1) it must never be silent:
 * a 'failed' outcome or a throw emits a structured error log + a greppable `child_photo_deletion_failed` metric event
 * so monitoring can alert and the sweeper (sweepPendingChildPhotoDeletions) retries the straggler.
 */
export async function tryDeleteOriginalChildPhotoAfterGeneration(orderId: string): Promise<void> {
  if (CHILD_PHOTO_DELETION_POLICY.delayMs > 0) return;

  try {
    const result = await deleteOriginalChildPhotoForOrder(orderId);
    if (result.outcome === 'failed') {
      log.error('completion hook: child-photo deletion FAILED — photo still reachable, awaiting sweeper retry', undefined, {
        orderId, error: result.error, failedKeys: result.failedKeys, deletedKeys: result.deletedKeys,
      });
      logServerEvent('child_photo_deletion_failed', { orderId, stage: 'completion_hook', error: result.error, failedKeyCount: result.failedKeys.length });
    }
  } catch (error) {
    log.error('completion hook THREW (non-fatal) — child-photo deletion did not run', error, { orderId });
    logServerEvent('child_photo_deletion_failed', { orderId, stage: 'completion_hook_threw' });
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
    if (result.outcome === 'failed') {
      // (Track-4 Unit 1) A straggler the sweeper could not clear — keep it observable so it is not lost between sweeps.
      log.error('sweeper: child-photo deletion FAILED — photo still reachable', undefined, { orderId: order.id, error: result.error, failedKeys: result.failedKeys });
      logServerEvent('child_photo_deletion_failed', { orderId: order.id, stage: 'sweeper', error: result.error, failedKeyCount: result.failedKeys.length });
    }
    if (result.outcome !== 'skipped') processed += 1;
  }

  return processed;
}
