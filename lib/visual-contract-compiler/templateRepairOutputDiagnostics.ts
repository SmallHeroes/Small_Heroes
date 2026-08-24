export const TEMPLATE_REPAIR_MODE_VALUES = [
  'source_evidence_id_patch',
  'page_contract_patch',
  'page_spatial_reference_patch',
  'stable_prop_scope_patch',
  'presentation_requirement_patch',
  'structural_bundle_patch',
  'book_surface_patch',
  'full_draft',
] as const;

export type TemplateRepairMode =
  (typeof TEMPLATE_REPAIR_MODE_VALUES)[number];

export const TEMPLATE_REPAIR_OUTPUT_FAILURE_CODE_VALUES = [
  'json_invalid',
  'shape_invalid',
  'target_identity_invalid',
  'reference_authority_invalid',
  'recurring_prop_invalid',
  'non_target_drift',
  'application_rejected',
] as const;

export type TemplateRepairOutputFailureCode =
  (typeof TEMPLATE_REPAIR_OUTPUT_FAILURE_CODE_VALUES)[number];

export const TEMPLATE_REPAIR_OUTPUT_IDENTITY_V2_ADDITION_VALUES = [
  'page_contract_repair_action_binding_component_beat_id_invalid',
  'page_contract_repair_action_binding_component_scope_invalid',
  'page_contract_repair_action_binding_component_stale',
  'page_contract_repair_action_binding_component_target_invalid',
] as const;

export const TEMPLATE_REPAIR_OUTPUT_IDENTITY_V3_ADDITION_VALUES = [
  'book_surface_repair_action_binding_changed',
  'book_surface_repair_action_binding_stale',
  'book_surface_repair_lifecycle_obligation_invalid',
] as const;

export const TEMPLATE_REPAIR_OUTPUT_IDENTITY_V4_ADDITION_VALUES = [
  'presentation_requirement_repair_class_invalid',
  'presentation_requirement_repair_pointer_choice_not_permitted',
  'presentation_requirement_repair_target_association_invalid',
] as const;

/**
 * Closed, compiler-owned identities that may cross the repair-output boundary.
 * They contain no authored/provider content. Unknown exceptions deliberately
 * collapse to `unclassified` rather than persisting an arbitrary message.
 */
export const TEMPLATE_REPAIR_OUTPUT_IDENTITY_VALUES = [
  'book_surface_repair_authority_mismatch',
  ...TEMPLATE_REPAIR_OUTPUT_IDENTITY_V3_ADDITION_VALUES,
  ...TEMPLATE_REPAIR_OUTPUT_IDENTITY_V4_ADDITION_VALUES,
  'book_surface_repair_cover_invalid',
  'book_surface_repair_cover_reference_invalid',
  'book_surface_repair_non_target_drift',
  'book_surface_repair_page_invalid',
  'book_surface_repair_prop_change_not_authorized',
  'book_surface_repair_prop_invalid',
  'book_surface_repair_prop_target_stale',
  'book_surface_repair_response_invalid_json',
  'book_surface_repair_response_invalid_shape',
  'page_contract_repair_action_beat_id_invalid',
  ...TEMPLATE_REPAIR_OUTPUT_IDENTITY_V2_ADDITION_VALUES,
  'page_contract_repair_action_binding_scope_invalid',
  'page_contract_repair_action_target_stale',
  'page_contract_repair_affected_page_duplicate',
  'page_contract_repair_coverage_beat_id_invalid',
  'page_contract_repair_coverage_target_stale',
  'page_contract_repair_page_collection_invalid',
  'page_contract_repair_page_invalid',
  'page_contract_repair_page_not_unique',
  'page_contract_repair_page_unexpected_or_duplicate',
  'page_contract_repair_patch_set_incomplete',
  'page_contract_repair_presentation_target_invalid',
  'page_contract_repair_represented_elsewhere_target_invalid',
  'page_contract_repair_response_invalid_json',
  'page_contract_repair_response_invalid_shape',
  'page_contract_repair_spatial_target_invalid',
  'page_contract_repair_spatial_target_stale',
  'page_contract_repair_spatial_reference_not_permitted',
  'page_contract_repair_target_invalid_or_duplicate',
  'page_contract_repair_target_set_empty',
  'page_spatial_repair_non_target_drift',
  'page_spatial_repair_patch_invalid',
  'page_spatial_repair_patch_set_incomplete',
  'page_spatial_repair_patch_unexpected_or_duplicate',
  'page_spatial_repair_reference_not_permitted',
  'page_spatial_repair_response_invalid_json',
  'page_spatial_repair_response_invalid_shape',
  'page_spatial_repair_target_duplicate',
  'page_spatial_repair_target_set_empty',
  'page_spatial_repair_target_stale',
  'presentation_requirement_repair_non_target_drift',
  'presentation_requirement_repair_page_not_unique',
  'presentation_requirement_repair_patch_invalid',
  'presentation_requirement_repair_patch_set_incomplete',
  'presentation_requirement_repair_patch_unexpected_or_duplicate',
  'presentation_requirement_repair_pointer_not_permitted',
  'presentation_requirement_repair_response_invalid_json',
  'presentation_requirement_repair_response_invalid_shape',
  'presentation_requirement_repair_target_duplicate',
  'presentation_requirement_repair_target_stale',
  'source_evidence_id_repair_affected_record_duplicate',
  'source_evidence_id_repair_action_not_unique',
  'source_evidence_id_repair_beat_not_unique',
  'source_evidence_id_repair_page_not_unique',
  'source_evidence_id_repair_patch_invalid',
  'source_evidence_id_repair_patch_set_incomplete',
  'source_evidence_id_repair_patch_unexpected_or_duplicate',
  'source_evidence_id_repair_response_invalid_json',
  'source_evidence_id_repair_response_invalid_shape',
  'stable_prop_scope_repair_non_target_drift',
  'stable_prop_scope_repair_patch_invalid',
  'stable_prop_scope_repair_patch_set_incomplete',
  'stable_prop_scope_repair_patch_unexpected_or_duplicate',
  'stable_prop_scope_repair_response_invalid_json',
  'stable_prop_scope_repair_response_invalid_shape',
  'stable_prop_scope_repair_target_duplicate',
  'stable_prop_scope_repair_target_set_empty',
  'stable_prop_scope_repair_target_stale',
  'structural_bundle_repair_non_target_drift',
  'structural_bundle_repair_page_invalid',
  'structural_bundle_repair_page_set_mismatch',
  'structural_bundle_repair_page_target_stale',
  'structural_bundle_repair_prop_invalid',
  'structural_bundle_repair_prop_set_mismatch',
  'structural_bundle_repair_prop_target_stale',
  'structural_bundle_repair_response_invalid_json',
  'structural_bundle_repair_response_invalid_shape',
  'unclassified',
] as const;

export type TemplateRepairOutputIdentity =
  (typeof TEMPLATE_REPAIR_OUTPUT_IDENTITY_VALUES)[number];

const TEMPLATE_REPAIR_OUTPUT_IDENTITIES =
  new Set<TemplateRepairOutputIdentity>(
    TEMPLATE_REPAIR_OUTPUT_IDENTITY_VALUES,
  );

export function templateRepairOutputIdentityIsValid(
  value: unknown,
): value is TemplateRepairOutputIdentity {
  return (
    typeof value === 'string' &&
    TEMPLATE_REPAIR_OUTPUT_IDENTITIES.has(
      value as TemplateRepairOutputIdentity,
    )
  );
}

export function sanitizedTemplateRepairOutputIdentity(
  error: unknown,
): TemplateRepairOutputIdentity {
  return error instanceof Error &&
    templateRepairOutputIdentityIsValid(error.message)
    ? error.message
    : 'unclassified';
}
