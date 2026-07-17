/**
 * Set Identity Board — the LIVE adapter behind `BoardResolverDeps`. The ONLY module in this subsystem that does I/O.
 *
 * It is a pure LOOKUP surface, deliberately: it can read a committed registry sidecar, resolve a durable url, and
 * hash the stored bytes. It cannot mint, render, upload, approve, or write anything at all. Milestone C's rule —
 * "the paid worker only LOOKS UP / VERIFIES / BINDS an already-approved board" — is enforced here by omission.
 *
 * REGISTRY LAYOUT: an approved board's sidecar is a COMMITTED repo artifact under `set-identity-boards/`, read the
 * same way story-bank artifacts are (`process.cwd()`-relative, read-only, present in the serverless bundle). The
 * layout is `set-identity-boards/<storyKey>/<styleId>/<setIdentityId>/<setDefinitionHash>.json` — the same tuple
 * Milestone A's `computeExpectedRegistryKey` declares as the GLOBAL key, one segment per component so a directory
 * listing is browsable by a human approver. `setIdentityBoardRegistryPath` is exported so the (later) mint/approve
 * tooling writes to exactly this layout via Milestone A's `saveRegistryEntry` — there must be exactly one place
 * that knows the path shape.
 *
 * Until that tooling lands, `loadRegistryEntry` simply finds nothing → the resolver fails closed with "no approved
 * board". That is the correct behaviour, not a gap: flag-on with an empty registry must refuse to render, never
 * invent a fallback.
 */
import path from 'path';
import { createHash } from 'crypto';

import { downloadStorageObjectBytes, resolveStoragePublicUrl } from '@/lib/image-storage';

import { loadRegistryEntry, type ExpectedRegistryIdentity } from './registry';
import type { BoardResolverDeps } from './resolveBoards';

/** Repo-relative root of the committed board registry. */
export const SET_IDENTITY_BOARD_REGISTRY_DIR = 'set-identity-boards';

/**
 * One path segment, made filesystem-safe without collapsing distinct ids together: anything outside
 * `[a-z0-9._-]` becomes `-`. Ids in this codebase are already snake/kebab-cased (`home_living_room`, `style01`),
 * so this is a no-op in practice; it exists so a hostile/unusual id can never escape the registry dir.
 */
function safeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

/**
 * The absolute sidecar path for one registry identity. THE single definition of the registry layout — the mint /
 * approve tooling must build its write path from this same function.
 */
export function setIdentityBoardRegistryPath(key: ExpectedRegistryIdentity, rootDir?: string): string {
  return path.join(
    rootDir ?? path.join(process.cwd(), SET_IDENTITY_BOARD_REGISTRY_DIR),
    safeSegment(key.storyKey),
    safeSegment(key.styleId),
    safeSegment(key.setIdentityId),
    `${safeSegment(key.setDefinitionHash)}.json`
  );
}

/**
 * The live deps: committed sidecar → durable Supabase object. `resolveDurableUrl` and `fetchAssetSha256` both work
 * off the entry's `storageKey` (the durable authority) — never off any url a contract or a sidecar suggests.
 *
 * Every door returns null rather than throwing on "not found"; the resolver turns null into the fail-closed error
 * with the precise reason attached, so an operator sees WHICH check failed rather than a raw storage stack trace.
 */
export function createLiveBoardResolverDeps(opts?: { rootDir?: string }): BoardResolverDeps {
  return {
    loadRegistryEntry: (key) => loadRegistryEntry(setIdentityBoardRegistryPath(key, opts?.rootDir)),

    resolveDurableUrl: async (storageKey) => {
      try {
        return resolveStoragePublicUrl(storageKey);
      } catch {
        // Missing storage env → unresolvable. Fail closed via the resolver, never render without the board.
        return null;
      }
    },

    fetchAssetSha256: async (storageKey) => {
      const bytes = await downloadStorageObjectBytes(storageKey);
      if (!bytes) return null;
      return createHash('sha256').update(bytes).digest('hex');
    },
  };
}
