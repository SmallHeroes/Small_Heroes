/** Frozen paid candidate, NOT acceptance. All remaining semantic holds still apply. */
import fs from 'node:fs';
import path from 'node:path';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareAcceptedSupportingCastReview } from '../../acceptedSupportingCastReview';
import { buildSemanticCorrectionPlan, type SemanticCorrectionOperation } from '../../visualContractSemanticCorrection';
import type { VisualContractCandidateArtifact } from '../../visualContractAuthoringLifecycle';

export const PANDA_REQUEST = {
  repoRoot: process.cwd(), storyKey: 'panda_anat_adventure',
  storyPath: 'story-pipeline/04_approved_story_sources/accepted/panda_anat_adventure/revisions/407c34c88fd6c5a851ed253c0534f01332a599222a2d6a6ecff967e65b81d160/integrated.md',
};
export function pandaPresenceFixture() {
  const candidate = JSON.parse(fs.readFileSync(path.join(process.cwd(),
    'lib/visual-package/__tests__/fixtures/semantic-recovery-held-panda.json'), 'utf8')) as VisualContractCandidateArtifact;
  const { digest, digestAlgorithm: _algorithm, ...payload } = candidate;
  if (digest !== '41d400698df1aa452b326a050b5f1a316ea4679ffb80e093fa16c6466c7ff2ba' || canonicalHash(payload) !== digest) throw new Error('panda_fixture_changed');
  const accepted = prepareAcceptedSupportingCastReview({ ...PANDA_REQUEST, entries: [] });
  const context = { snapshot: accepted.snapshot, candidate, supportingCastReview: accepted.review };
  const operation: Extract<SemanticCorrectionOperation, { kind: 'require_companion_presence' }> = {
    kind: 'require_companion_presence', pageNumber: 6,
    companionId: candidate.template.cast.companion!.id,
    expectedCompanionPresent: false, expectedCastIds: ['child:hero'],
    acceptedVisualDirectionsJson: fs.readFileSync(path.join(process.cwd(), path.dirname(PANDA_REQUEST.storyPath), 'visual-directions.json'), 'utf8'),
  };
  return { context, operation, plan: buildSemanticCorrectionPlan(context, [operation]) };
}
