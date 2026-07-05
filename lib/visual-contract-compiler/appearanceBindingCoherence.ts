/**
 * Shared, PURE mode/origin coherence rule for appearance bindings (P0 Fix 3b).
 *
 * A binding's `mode` must match a coherent evidence `origin.kind`: a compiler-picked colour can NEVER wear a
 * fabricated story phrase, and an `explicit` story/policy value can never masquerade as a family/palette pick. This is
 * the ONE authoritative table — used by BOTH the Template validator (on a `TemplateTraitBinding`) and the Resolved
 * validator (on a `ResolvedTrait`), so the two can't drift. No I/O, no clock.
 */
import type { AppearanceBindingMode } from './contractTemplateTypes';

export type OriginKind = 'story_evidence' | 'family_profile' | 'policy_default' | 'deterministic_palette';

/** The origin kinds that are coherent with each binding mode (an `explicit` value comes from a story phrase or a policy). */
export function coherentOriginKindsFor(mode: AppearanceBindingMode): readonly OriginKind[] {
  switch (mode) {
    case 'explicit':
      return ['story_evidence', 'policy_default'];
    case 'family_profile':
      return ['family_profile'];
    case 'deterministic_palette':
      return ['deterministic_palette'];
    default:
      return [];
  }
}

function isBindingMode(v: unknown): v is AppearanceBindingMode {
  return v === 'explicit' || v === 'family_profile' || v === 'deterministic_palette';
}

/**
 * Return an error string if the `(mode, originKind)` pair is incoherent, else `null`. Pure.
 * `originKind === undefined` returns `null` — origin PRESENCE/shape is validated separately (this only checks the
 * mode↔origin AGREEMENT once an origin kind is known).
 */
export function bindingCoherenceError(label: string, mode: unknown, originKind: string | undefined): string | null {
  if (!isBindingMode(mode)) return `${label}.mode invalid "${String(mode)}"`;
  if (originKind === undefined) return null;
  const allowed = coherentOriginKindsFor(mode);
  if (!allowed.includes(originKind as OriginKind)) {
    return `${label} ${mode} mode requires a ${allowed.join('/')} origin (got ${originKind})`;
  }
  return null;
}
