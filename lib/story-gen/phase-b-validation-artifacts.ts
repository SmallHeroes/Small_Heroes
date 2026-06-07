/**
 * Phase B pipeline validation artifacts — advisory runs only, not bank promotion.
 */

export interface PhaseBValidationArtifact {
  scenarioId: string;
  companionId: string;
  direction: 'adventure' | 'bedtime' | 'fantasy';
  runFolder: string;
  pipelineValidation: 'pass' | 'fail' | 'pending';
  bankPromotion: 'yes' | 'no' | 'pending';
  notes?: string;
}

/** Human-reviewed pipeline outcomes; bank writes remain blocked until bankPromotion=yes. */
export const PHASE_B_VALIDATION_ARTIFACTS: PhaseBValidationArtifact[] = [
  {
    scenarioId: 'bolly_b1_lahitraf_adv',
    companionId: 'bolly_armadillo',
    direction: 'adventure',
    runFolder: 'outputs/story-gen-runs/2026-06-07T18-49-32-189Z',
    pipelineValidation: 'pass',
    bankPromotion: 'no',
    notes:
      'Architecture/density/validators pass. Human literary polish deferred; swap/freshness placeholders only.',
  },
  {
    scenarioId: 'tubi_s2_ha_bayit_bed',
    companionId: 'baby_elephant',
    direction: 'bedtime',
    runFolder: 'outputs/story-gen-runs/2026-06-07T18-59-38-961Z',
    pipelineValidation: 'pass',
    bankPromotion: 'no',
    notes:
      'Tubi engine pass; no whale drift. Local cleanup: remove English too-SHUT, fix אסוג, replace קול כשר, p7 polish/thinness. swap/freshness placeholders only.',
  },
];

export function getValidationArtifact(scenarioId: string): PhaseBValidationArtifact | undefined {
  return PHASE_B_VALIDATION_ARTIFACTS.find((a) => a.scenarioId === scenarioId);
}
