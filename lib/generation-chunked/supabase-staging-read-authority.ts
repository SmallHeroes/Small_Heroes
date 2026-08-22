import 'server-only';

import { createHash } from 'crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { loadRegistryEntry } from '@/lib/set-identity-board/registry';
import { setIdentityBoardRegistryPath } from '@/lib/set-identity-board/registryPath';
import type { BoardResolverDeps } from '@/lib/set-identity-board/resolveBoards';

export const STAGING_CREDENTIAL_PROOF_STATUS_VALUES = [
  'proved',
  'rejected',
  'unreachable',
] as const;

export type StagingCredentialProofStatus =
  (typeof STAGING_CREDENTIAL_PROOF_STATUS_VALUES)[number];

export interface StagingCredentialProofResult {
  status: StagingCredentialProofStatus;
  storageReads: 0 | 1;
}

export interface StagingCredentialProofDeps {
  listPrivateBucket?: (args: {
    supabaseUrl: string;
    serviceRoleKey: string;
    bucket: string;
    signal: AbortSignal;
  }) => Promise<{ data: unknown; error: unknown }>;
  timeoutMs?: number;
}

const DEFAULT_PRIVATE_CHILD_PHOTO_BUCKET = 'child-photos-private';
const DEFAULT_RENDER_STORAGE_BUCKET = 'book-images';
const DEFAULT_PROOF_TIMEOUT_MS = 5_000;
const DEFAULT_BOARD_READ_TIMEOUT_MS = 10_000;

function privateChildPhotoBucket(source: NodeJS.ProcessEnv): string {
  return (
    source.SUPABASE_PRIVATE_STORAGE_BUCKET?.trim() ||
    DEFAULT_PRIVATE_CHILD_PHOTO_BUCKET
  );
}

function renderStorageBucket(source: NodeJS.ProcessEnv): string {
  return source.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_RENDER_STORAGE_BUCKET;
}

function exactStagingSupabaseUrl(
  value: string | undefined,
  expectedProjectRef: string,
): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== `${expectedProjectRef}.supabase.co` ||
      parsed.port !== '' ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== ''
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function readOnlyClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function defaultListPrivateBucket(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  signal: AbortSignal;
}): Promise<{ data: unknown; error: unknown }> {
  return readOnlyClient(args.supabaseUrl, args.serviceRoleKey).storage
    .from(args.bucket)
    .list(
      '',
      { limit: 1, offset: 0, sortBy: { column: 'name', order: 'asc' } },
      { signal: args.signal },
    );
}

function structuredRemoteRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  return (
    (typeof candidate.status === 'number' &&
      Number.isInteger(candidate.status) &&
      candidate.status >= 400) ||
    (typeof candidate.statusCode === 'string' &&
      /^\d{3}$/u.test(candidate.statusCode))
  );
}

/**
 * Proves that the configured opaque backend key is accepted at one exact,
 * independently pinned staging project. The proof is a bounded list of at most
 * one entry from the private child-photo bucket. No object bytes or names leave
 * this module, and no write method is exposed.
 */
export async function proveStagingCredential(
  expectedProjectRef: string,
  source: NodeJS.ProcessEnv = process.env,
  deps: StagingCredentialProofDeps = {},
): Promise<StagingCredentialProofResult> {
  const supabaseUrl = exactStagingSupabaseUrl(
    source.SUPABASE_URL,
    expectedProjectRef,
  );
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = privateChildPhotoBucket(source);
  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    return { status: 'rejected', storageReads: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    deps.timeoutMs ?? DEFAULT_PROOF_TIMEOUT_MS,
  );
  try {
    const { data, error } = await (
      deps.listPrivateBucket ?? defaultListPrivateBucket
    )({
      supabaseUrl,
      serviceRoleKey,
      bucket,
      signal: controller.signal,
    });
    if (error) {
      return {
        status: structuredRemoteRejection(error) ? 'rejected' : 'unreachable',
        storageReads: 1,
      };
    }
    return {
      status: Array.isArray(data) ? 'proved' : 'rejected',
      storageReads: 1,
    };
  } catch {
    return { status: 'unreachable', storageReads: 1 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Read-only live Board adapter used only by the two dev preflight routes. It
 * deliberately does not import `image-storage`, whose public API contains
 * upload and retry capabilities that these routes must never acquire.
 */
export function createPreflightBoardResolverDeps(args: {
  expectedProjectRef: string;
  rootDir?: string;
  source?: NodeJS.ProcessEnv;
}): BoardResolverDeps {
  const source = args.source ?? process.env;
  const supabaseUrl = exactStagingSupabaseUrl(
    source.SUPABASE_URL,
    args.expectedProjectRef,
  );
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = renderStorageBucket(source);
  const client =
    supabaseUrl && serviceRoleKey
      ? readOnlyClient(supabaseUrl, serviceRoleKey)
      : null;

  return {
    loadRegistryEntry(key) {
      return loadRegistryEntry(
        setIdentityBoardRegistryPath(key, args.rootDir),
      );
    },
    async resolveDurableUrl(storageKey) {
      if (!supabaseUrl || !bucket) return null;
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${storageKey}`;
    },
    async fetchAssetSha256(storageKey) {
      if (!client || !bucket) return null;
      try {
        const { data, error } = await client.storage
          .from(bucket)
          .download(storageKey, undefined, {
            signal: AbortSignal.timeout(DEFAULT_BOARD_READ_TIMEOUT_MS),
          });
        if (error || !data) return null;
        return createHash('sha256')
          .update(Buffer.from(await data.arrayBuffer()))
          .digest('hex');
      } catch {
        return null;
      }
    },
  };
}
