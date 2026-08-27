import {
  assertFrozenVisualPackageAuthority,
  InvalidVisualPackageV4Error,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';
import { canonicalJsonDigest } from '@/lib/visual-package/integrity';
// Leaf module import (never the compiler index): adapters.ts inside the
// compiler imports generation-pipeline modules, so the index would cycle.
import { computeVisualContractHash } from '@/lib/visual-contract-compiler/contractHash';
import type { BookVisualContract } from '@/lib/visual-contract-compiler/types';
import { styleIdFromDatabaseValue } from '@/lib/styles';

import {
  resolveFrozenOrderStorySelection,
  storyRefClaimsAcceptedRevisionNamespace,
} from './story-path';

export interface OrderVisualPackageAuthorityInput {
  selectionFilename?: string | null;
  storySourceHash?: string | null;
  illustrationStyle?: string | null;
  visualPackageAuthority?: unknown;
}

export class OrderVisualPackageAuthorityError extends Error {
  readonly isOrderVisualPackageAuthorityError = true as const;

  constructor(readonly reasons: readonly string[]) {
    const stable = [...new Set(reasons)].sort((left, right) =>
      left.localeCompare(right),
    );
    super(`[order_visual_package_authority] ${stable.join('; ')}`);
    this.name = 'OrderVisualPackageAuthorityError';
  }
}

function acceptedRevisionSelection(
  order: OrderVisualPackageAuthorityInput,
) {
  const supplied = String(order.selectionFilename ?? '');
  // The canonical parser must see the exact persisted bytes. Hostile
  // normalization is used only to detect an attempted accepted-namespace alias
  // (`./`, doubled separators, backslashes, whitespace, case aliases), never to
  // turn a noncanonical spelling into accepted authority — and never to let one
  // fall through to legacy classification.
  const selection = resolveFrozenOrderStorySelection(supplied);
  if (
    storyRefClaimsAcceptedRevisionNamespace(supplied) &&
    selection?.storySourceAuthorityKind !== 'product_accepted_revision'
  ) {
    throw new OrderVisualPackageAuthorityError([
      'accepted-revision Story Source reference is malformed',
    ]);
  }
  return selection?.storySourceAuthorityKind === 'product_accepted_revision'
    ? selection
    : null;
}

/** Durable product discriminator. It is derived from frozen Order truth, never flags or a locator. */
export function orderRequiresVisualPackageAuthority(
  order: OrderVisualPackageAuthorityInput,
): boolean {
  return acceptedRevisionSelection(order) !== null;
}

/**
 * Return the exact authority for a package-backed Order, or null for a genuine
 * legacy story-bank Order. Accepted revisions missing authority are held; a
 * legacy Order carrying package authority is also rejected as an origin mix.
 */
export function requireOrderVisualPackageAuthority(
  order: OrderVisualPackageAuthorityInput,
): FrozenVisualPackageAuthority | null {
  const selection = acceptedRevisionSelection(order);
  const raw = order.visualPackageAuthority;
  if (!selection) {
    if (raw != null) {
      throw new OrderVisualPackageAuthorityError([
        'legacy Story Source unexpectedly carries Visual Package authority',
      ]);
    }
    return null;
  }
  if (raw == null) {
    throw new OrderVisualPackageAuthorityError([
      'package-backed Order is missing frozen Visual Package authority',
    ]);
  }
  try {
    assertFrozenVisualPackageAuthority(raw);
  } catch (error) {
    throw new OrderVisualPackageAuthorityError(
      error instanceof InvalidVisualPackageV4Error
        ? error.issues
        : [error instanceof Error ? error.message : String(error)],
    );
  }
  const reasons: string[] = [];
  if (raw.sourcePath !== selection.storyFileRef) {
    reasons.push('Visual Package sourcePath differs from Order Story Source');
  }
  if (raw.storyKey !== selection.storyKey) {
    reasons.push('Visual Package storyKey differs from Order Story Source');
  }
  if (!order.storySourceHash?.trim()) {
    reasons.push('package-backed Order Story Source digest is missing');
  } else if (raw.sourceRawDigest !== order.storySourceHash) {
    reasons.push('Visual Package source digest differs from Order Story Source');
  }
  if (raw.styleId !== styleIdFromDatabaseValue(order.illustrationStyle)) {
    reasons.push('Visual Package style differs from Order illustration style');
  }
  if (reasons.length > 0) {
    throw new OrderVisualPackageAuthorityError(reasons);
  }
  return raw;
}

/**
 * Producing-snapshot delivery binding. A fresh Order row that is internally
 * self-consistent under Package B must never authorize shipping artifacts that
 * were PRODUCED under Package A. The durable record of what production ran
 * under is the pipeline cache written atomically at freeze time and enforced
 * by the provider fence on every paid call: `cache.visualPackageAuthority`
 * (the authority every render-qualification compared against the Order) and
 * `cache.visualContract` (the frozen contract whose canonical hash was
 * stamped onto `Order.visualContractHash` in the same barrier mutation, and
 * whose bytes embed the producing package's revision digest).
 *
 * For a package-backed Order this therefore requires, beyond the fresh row's
 * own validity:
 *   1. the producing cache carries an authority byte-equal (canonical digest)
 *      to the fresh Order authority;
 *   2. the fresh `visualContractHash` stamp equals the canonical hash of the
 *      producing cache contract (stamp ↔ produced bytes);
 *   3. the contract-embedded `approvedRuntimeAuthority.packageRevisionDigest`
 *      equals the fresh authority's `packageRevisionDigest` (produced bytes ↔
 *      fresh package identity).
 * A genuine legacy Order (null authority both sides) is returned as `null`
 * with no binding, preserving legacy behavior exactly.
 */
export function requireProducingSnapshotBinding(args: {
  order: OrderVisualPackageAuthorityInput & {
    visualContractHash?: string | null;
  };
  pipelineCache: unknown;
}): FrozenVisualPackageAuthority | null {
  const fresh = requireOrderVisualPackageAuthority(args.order);
  if (fresh === null) return null;
  const reasons: string[] = [];
  const cache =
    args.pipelineCache &&
    typeof args.pipelineCache === 'object' &&
    !Array.isArray(args.pipelineCache)
      ? (args.pipelineCache as Record<string, unknown>)
      : null;
  if (!cache) {
    throw new OrderVisualPackageAuthorityError([
      'package-backed Order has no producing pipeline snapshot',
    ]);
  }
  const cacheAuthority = cache.visualPackageAuthority ?? null;
  if (cacheAuthority == null) {
    reasons.push('producing snapshot carries no Visual Package authority');
  } else if (
    canonicalJsonDigest(cacheAuthority) !== canonicalJsonDigest(fresh)
  ) {
    reasons.push(
      'producing snapshot authority differs from the fresh Order authority',
    );
  }
  const contract = cache.visualContract ?? null;
  if (contract == null) {
    reasons.push('producing snapshot carries no frozen visual contract');
  } else {
    const stamp = args.order.visualContractHash?.trim();
    if (!stamp) {
      reasons.push('package-backed Order has no frozen contract stamp');
    } else if (
      computeVisualContractHash(contract as BookVisualContract) !== stamp
    ) {
      reasons.push(
        'Order contract stamp does not match the producing contract bytes',
      );
    }
    const embedded = (contract as Record<string, unknown>)
      .approvedRuntimeAuthority;
    const embeddedRevision =
      embedded && typeof embedded === 'object' && !Array.isArray(embedded)
        ? (embedded as Record<string, unknown>).packageRevisionDigest
        : undefined;
    if (embeddedRevision !== fresh.packageRevisionDigest) {
      reasons.push(
        'producing contract package revision differs from the fresh Order authority',
      );
    }
  }
  if (reasons.length > 0) {
    throw new OrderVisualPackageAuthorityError(reasons);
  }
  return fresh;
}
