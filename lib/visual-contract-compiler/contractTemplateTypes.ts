/**
 * Contract Template + Resolved types (P0 — the structured-appearance foundation).
 *
 * Two distinct shapes, ONE authoritative source of truth per human trait:
 *  - `BookVisualContractTemplate` — story-level, authored/compiled. Carries TYPED bindings and may hold UNRESOLVED
 *    traits (skin/hair for a relative or a compiler-picked human). Stored as `{storyKey}.visual-contract-template.json`
 *    with a DISTINCT loader. It must NEVER be frozen/rendered — only a Resolved contract is.
 *  - `ResolvedBookVisualContract` — per-order, fully concrete; a SUPERSET of today's vNext `BookVisualContract`, so it
 *    flows through the existing steering/adapters/QA/freeze unchanged. Structured traits are AUTHORITATIVE;
 *    `coarseAppearance`/`wardrobe.description` may remain as deterministic PROJECTIONS of the structured traits
 *    (never a parallel editable source — this permanently kills the vague-prose drift).
 *
 * Scope of concrete resolution = recurring HUMANS only (mother/father/doctor/nurse/teacher…). NOT the child (hero
 * anchor + book wardrobe lock) and NOT the companion (existing companion lock).
 *
 * P0 commit 1 is PURE (types + validators + tests): no materializer, no palette table, no live-path wiring.
 */
import type {
  BookVisualContract,
  CoverContract,
  HumanCastGender,
  PageVisualContract,
  RecurringHumanCastMember,
  RecurringProp,
  VisualCast,
  VisualLocation,
  VisualZone,
} from './types';

/** Bump when the Template/Resolved SHAPE changes (part of the Resolved hash → a bump safely re-hashes). */
export const VISUAL_CONTRACT_SCHEMA_VERSION = 'vc-schema/v1' as const;
/** Bump when the materialize() logic changes (recorded on the Resolved → auditable, safely re-hashes). */
export const MATERIALIZER_VERSION = 'materializer/v1' as const;
/** Bump when the deterministic palette table changes (recorded on the Resolved → auditable, safely re-hashes). */
export const PALETTE_VERSION = 'palette/v1' as const;
export const APPROVED_RUNTIME_AUTHORITY_VERSION = 'approved-runtime-authority/v2' as const;

/**
 * Exact approved-package identity carried inside the resolved/frozen contract. This is reviewer-owned metadata,
 * never an authoring-LLM field. It intentionally uses primitive compiler-layer types so the visual-package module
 * may build it without introducing a compiler <-> package dependency cycle.
 */
export interface ApprovedRuntimeAuthorityBinding {
  version: typeof APPROVED_RUNTIME_AUTHORITY_VERSION;
  manifestVersion: 'visual-package/v2';
  storyKey: string;
  styleId: string;
  sourcePath: string;
  sourceDigest: string;
  templatePath: string;
  templateDigest: string;
  coverageDigest: string;
  requiredBoardsDigest: string;
  requiredPropReferencesDigest: string;
  worldMode: 'grounded' | 'grounded_with_visual_metaphor' | 'fantastical';
}

/** Closed set of roles for which a `family_profile` binding is legal (relatives share the hero's appearance band).
 *  `parent` is included: the extractor emits it when a parent's gender is unspecified, and a parent IS a relative. */
export const RELATIVE_ROLES = ['child', 'mother', 'father', 'parent', 'sibling', 'grandparent'] as const;
export type RelativeRole = (typeof RELATIVE_ROLES)[number];

/** How a human appearance trait is bound. `family_profile` is relatives-ONLY (a doctor is NOT family). */
export type AppearanceBindingMode = 'explicit' | 'family_profile' | 'deterministic_palette';

/**
 * Typed evidence origin for a trait — a compiler-picked colour has NO story phrase, so evidence is never fabricated.
 * `story_evidence` binds to a real page phrase; the others record the deterministic source + version.
 */
export type AppearanceEvidenceOrigin =
  | { kind: 'story_evidence'; page: number; phrase: string }
  | { kind: 'family_profile' }
  | { kind: 'policy_default'; policyId: string; version: string }
  | { kind: 'deterministic_palette'; paletteId: string; version: string };

/** A trait binding in a TEMPLATE. `value` is present ONLY for `explicit`; absent (unresolved) for family/palette. */
export interface TemplateTraitBinding {
  mode: AppearanceBindingMode;
  origin: AppearanceEvidenceOrigin;
  value?: string;
}

/** A trait in a RESOLVED contract — a concrete value plus the mode/origin it was resolved from (audit trail). */
export interface ResolvedTrait {
  value: string;
  mode: AppearanceBindingMode;
  origin: AppearanceEvidenceOrigin;
}

export interface Garment<B> {
  id: string;
  label?: string;
  colour: B;
}

export interface HumanAppearanceTraits<B> {
  skinTone: B;
  /** Hair COLOUR only (orthogonal to texture + style, so the deterministic prose projection is checkable). */
  hairColour: B;
  /** Hair TEXTURE only (curly/wavy/straight/coily…) — ethnicity-adjacent, so typically `family_profile`/palette. */
  hairTexture: B;
  /** Hair STYLE only (length/parting/how it's worn) — a styling choice, typically `explicit`. */
  hairStyle: B;
}

/** A recurring human in a TEMPLATE — structured typed bindings instead of free prose. */
export interface TemplateHumanCastMember {
  id: string;
  role: string;
  gender: HumanCastGender;
  aliases: string[];
  /** The story phrase that fixes this person's identity/role/gender (e.g. "הרופא" → doctor). Carried to the Resolved. */
  textEvidence: string;
  pagesPresent: number[];
  appearance: HumanAppearanceTraits<TemplateTraitBinding>;
  garments: Garment<TemplateTraitBinding>[];
  forbiddenAppearance: string[];
}

/**
 * The concrete family appearance a `family_profile` trait resolves FROM (a strict adapter TYPE — commit 3 wraps the
 * legacy `lib/family-coherence` into this; the materializer never imports family-coherence). A missing field for a
 * requested trait FAILS materialization (no silent neutral default).
 */
export interface ResolvedFamilyAppearanceProfile {
  skinTone: string;
  hairColour: string;
  hairTexture: string;
}

/** A recurring human in a RESOLVED contract — concrete structured traits (authoritative) + projected vNext prose. */
export interface ResolvedHumanCastMember extends RecurringHumanCastMember {
  appearance: HumanAppearanceTraits<ResolvedTrait>;
  garments: Garment<ResolvedTrait>[];
}

/** Story-level authored/compiled contract. Distinct type + loader; may hold UNRESOLVED bindings; NEVER frozen. */
export interface BookVisualContractTemplate {
  contractKind: 'template';
  schemaVersion: typeof VISUAL_CONTRACT_SCHEMA_VERSION;
  version: BookVisualContract['version'];
  storyKey?: string;
  worldType: string;
  locations: VisualLocation[];
  zones: VisualZone[];
  cast: VisualCast;
  humanCast: TemplateHumanCastMember[];
  recurringProps: RecurringProp[];
  forbiddenGlobalElements: string[];
  coverContract: CoverContract;
  pageContracts: PageVisualContract[];
  provenance?: BookVisualContract['provenance'];
}

/**
 * Per-order fully-concrete contract — a SUPERSET of vNext `BookVisualContract` (so it flows through the existing
 * steering/adapters/QA/freeze unchanged). The ONLY thing hashed/frozen/rendered/QA'd. The version fields are part of
 * the hashed content so a schema/materializer/palette bump safely produces a NEW hash (never a silent stale one).
 */
export interface ResolvedBookVisualContract extends BookVisualContract {
  contractKind: 'resolved';
  /** Version provenance (auditable; part of the hashed content so a bump safely re-hashes). Strings — an injected
   * palette may carry its own version. */
  schemaVersion: string;
  materializerVersion: string;
  paletteVersion: string;
  humanCast: ResolvedHumanCastMember[];
  /** Present only on the enforced, source-bound Style01 path; included in the frozen contract hash. */
  approvedRuntimeAuthority?: ApprovedRuntimeAuthorityBinding;
}
