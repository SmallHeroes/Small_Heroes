/**
 * Strict adapter: legacy family-coherence → `ResolvedFamilyAppearanceProfile` (P0 commit 3 + Fix 2).
 *
 * WRAPS `lib/family-coherence` (never rewrites it — uses the additive `matchFamilyAppearance` signal) to produce the
 * concrete skin/hair colour/hair texture the visual-contract materializer resolves `family_profile` traits FROM.
 * Deterministic + fail-closed:
 *   - EXCLUDES `derivedAt` and every clock/metadata field — only the deterministic values feed materialize, so the
 *     resulting Resolved contract stays byte-identical across renders.
 *   - FAILS CLOSED when skin OR hair (colour or texture) was DEFAULTED rather than positively evidenced — refusing the
 *     legacy `inferSkinToneBand` light-neutral / `inferHair*` mixed fallback (a wrong-ethnicity mother by another
 *     door). A legitimately-evidenced light/neutral child (e.g. "light skin") still MATCHES and resolves.
 */
import type { Order } from '@prisma/client';
import type { FamilyContext } from '@/backend/providers/story';
import { matchFamilyAppearance } from '@/lib/family-coherence/derive';
import type { ResolvedFamilyAppearanceProfile } from '@/lib/visual-contract-compiler';
import type { PipelineCache } from './types';

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function deriveResolvedFamilyAppearanceProfile(
  order: Pick<Order, 'familyContext'>,
  cache: Pick<PipelineCache, 'childPhotoDescription' | 'dna'>,
): ResolvedFamilyAppearanceProfile {
  const childPhotoDescription = isStr(cache.childPhotoDescription) ? cache.childPhotoDescription : null;
  const childStructured = (cache.dna?.childStructured ?? null) as
    | { face?: string; hair?: string; body?: string; signature?: string }
    | null;
  const familyContext = (order.familyContext ?? null) as unknown as FamilyContext | null;

  // Require POSITIVE, trait-specific evidence for skin AND hair (colour + texture) — no silent default.
  const matched = matchFamilyAppearance({ childPhotoDescription, childStructured, familyContext });
  if (!matched.ok) {
    throw new Error(
      `[resolve-family-appearance] family appearance DEFAULTED (no positive evidence) for: ${matched.defaulted.join(', ')} — ` +
        'refusing a silent light-neutral/mixed default; skin AND hair colour+texture need trait-specific evidence',
    );
  }
  // { skinTone, hairColour, hairTexture } — concrete, deterministic, NO derivedAt / metadata.
  return matched.value;
}
