import {
  assertFrozenVisualPackageAuthority,
  InvalidVisualPackageV4Error,
  type FrozenVisualPackageAuthority,
} from '@/lib/visual-package/visualPackageV4';
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
