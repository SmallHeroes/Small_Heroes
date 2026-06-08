/**
 * Step 4 final artifact disposition markers (advisory — not bank writes).
 */

export type Step4ArtifactStatus =
  | 'retired_content_overlap_whale_territory'
  | 'candidate_pending_human_literary_signoff'
  | 'b2_reroll_ready_for_human_literary_review'
  | 'b2_scenario_fragile_needs_human_authoring_or_recipe_change'
  | 'hold_content_decision';

export const STEP4_ARTIFACT_STATUS: Record<string, Step4ArtifactStatus> = {
  tubi_s4_ha_raam_bed: 'retired_content_overlap_whale_territory',
  tubi_s6_ha_sheket_bed: 'candidate_pending_human_literary_signoff',
  bolly_b5_hamishpat_bed: 'candidate_pending_human_literary_signoff',
};
