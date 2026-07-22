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
import { createHash } from 'crypto';

import { downloadStorageObjectBytes, resolveStoragePublicUrl } from '@/lib/image-storage';

import { loadRegistryEntry } from './registry';
import type { BoardResolverDeps } from './resolveBoards';
import {
  setIdentityBoardRegistryPath,
} from './registryPath';

export {
  SET_IDENTITY_BOARD_REGISTRY_DIR,
  setIdentityBoardRegistryPath,
  setIdentityBoardStorageKey,
} from './registryPath';

/** The identity a board's STORAGE key is addressed by: the registry identity PLUS the bytes' own sha256. */
export interface BoardStorageIdentity {
  storyKey: string;
  setIdentityId: string;
  styleId: string;
  setDefinitionHash: string;
  /** sha256 (hex) of the board bytes. Part of the key — this is what makes the object immutable-by-address. */
  assetSha256: string;
}

/**
 * (P0-4a) THE single definition of a board's durable storage key — CONTENT-ADDRESSED: the asset sha256 is a path
 * component, so DIFFERENT BYTES ARE A DIFFERENT OBJECT, always. Mint writes here and the live binder verifies
 * here, from this one function, so the two agree by construction rather than by convention.
 *
 * Why the sha is in the key and not just in the registry entry: a key that identifies only "the board for this
 * set/style" is a mutable location — re-render at that key and every approved entry silently points at new bytes.
 * With the sha in the key, an approved entry's `storageKey` can only ever address the exact bytes a human signed
 * off on; new bytes are unreachable from it. Paired with `uploadContentAddressedObjectNoOverwrite`
 * (`x-upsert:false`), a board object is write-once.
 *
 * Mirrors `setIdentityBoardRegistryPath`'s tuple + `safeSegment` sanitation, one segment per key component, so the
 * storage tree and the committed sidecar tree are browsable side by side.
 */
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
