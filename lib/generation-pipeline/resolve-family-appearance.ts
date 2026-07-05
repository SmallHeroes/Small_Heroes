/**
 * Strict adapter: legacy family-coherence → `ResolvedFamilyAppearanceProfile` (P0 commit 3).
 *
 * WRAPS `lib/family-coherence` (never rewrites it) to produce the concrete skin/hair the visual-contract materializer
 * resolves `family_profile` traits FROM. Deterministic + fail-closed:
 *   - EXCLUDES `derivedAt` and every clock/metadata field — only the deterministic skin/hair values feed materialize,
 *     so the resulting Resolved contract stays byte-identical across renders.
 *   - THROWS when there is NO family appearance input to derive from (childPhotoDescription / childStructured /
 *     familyContext all empty) — refusing the legacy `inferSkinToneBand` light-neutral fallback, so materialization
 *     fails closed rather than silently rendering a default appearance. (A genuinely light-neutral child is a valid
 *     derivation and is NOT rejected — only the ABSENCE of input is.)
 */
import type { Order } from '@prisma/client';
import { ensureFamilyCoherenceBundle } from '@/lib/family-coherence/ensure';
import { familyProfileHairDescriptor } from '@/lib/family-coherence/member-locks';
import type { ResolvedFamilyAppearanceProfile } from '@/lib/visual-contract-compiler';
import type { PipelineCache } from './types';

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function deriveResolvedFamilyAppearanceProfile(
  order: Pick<Order, 'characterAnchors' | 'familyContext'>,
  cache: Pick<PipelineCache, 'childPhotoDescription' | 'dna'>,
): ResolvedFamilyAppearanceProfile {
  const childPhotoDescription = isStr(cache.childPhotoDescription) ? cache.childPhotoDescription : null;
  const cs = (cache.dna?.childStructured ?? null) as
    | { face?: string; hair?: string; body?: string; signature?: string }
    | null;
  const structuredHasSignal = !!cs && [cs.face, cs.hair, cs.body, cs.signature].some(isStr);
  const familyContextHasSignal = order.familyContext != null;

  if (!childPhotoDescription && !structuredHasSignal && !familyContextHasSignal) {
    throw new Error(
      '[resolve-family-appearance] no family appearance input (childPhotoDescription / childStructured / ' +
        'familyContext) — cannot resolve family_profile traits; refusing a silent light-neutral default',
    );
  }

  const bundle = ensureFamilyCoherenceBundle(order, { childPhotoDescription, childStructured: cs });
  const skinTone = bundle.profile.skinTonePrompt;
  const hairColour = familyProfileHairDescriptor(bundle.profile);
  if (!isStr(skinTone) || !isStr(hairColour)) {
    throw new Error('[resolve-family-appearance] derived family profile is incomplete (no skin/hair) — refusing a silent default');
  }
  // Deterministic values ONLY — no derivedAt / metadata.
  return { skinTone, hairColour };
}
