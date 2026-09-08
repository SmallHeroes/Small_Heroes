/** Exact accepted P1 choices, test/review input only; never imported by production. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalHash } from '@/lib/canonical-json';
import { prepareAcceptedSupportingCastReview } from '../../acceptedSupportingCastReview';
import { buildStorySourceAuthoritySnapshot, storySourceSnapshotToTemplateInput } from '../../storySourceAuthority';
import { buildSemanticCorrectionPlan, type SemanticCorrectionOperation } from '../../visualContractSemanticCorrection';
import type { VisualContractCandidateArtifact } from '../../visualContractAuthoringLifecycle';
import type { SupportingCastEntry } from '@/lib/visual-contract-compiler/supportingCastReview';

export const P1_REQUEST = {
  repoRoot: process.cwd(), storyKey: 'dragon_dini_adventure',
  storyPath: 'story-pipeline/04_approved_story_sources/accepted/dragon_dini_adventure/revisions/64dcd0e741f17fc08cde95ad8a5a00b303955aa28ccd065d44f01e49e9d155fc/integrated.md',
};
export function p1SemanticRecoveryFixture() {
  const raw = fs.readFileSync(path.join(process.cwd(), 'lib/visual-package/__tests__/fixtures/semantic-recovery-held-p1.json'));
  if (crypto.createHash('sha256').update(raw).digest('hex') !== '33ce501865735be68fe99776a6ae3968efc88bc60d555da2b3fd7290c18d31f4') throw new Error('Held P1 fixture raw bytes changed');
  const candidate = JSON.parse(raw.toString('utf8')) as VisualContractCandidateArtifact;
  const snapshot = buildStorySourceAuthoritySnapshot(P1_REQUEST);
  const cite = (pageNumber: number) => ({ source: 'story' as const, pageNumber, quote: snapshot.content.pages.find(p => p.pageNumber === pageNumber)!.text });
  const presence = (pages: number[]) => pages.map(pageNumber => ({ pageNumber, evidence: [cite(pageNumber)] }));
  const individual = (id: string, role: string, alias: string, gender: 'male' | 'female', pages: number[]): SupportingCastEntry => ({
    kind: 'human_individual', id, role, aliases: [alias], gender, appearanceClass: 'reviewed_non_relative',
    identityEvidence: [cite(pages[0]!)], genderEvidence: [cite(pages[0]!)], relationshipEvidence: [], presence: presence(pages),
  });
  const group = (id: string, role: string, alias: string, pages: number[]): SupportingCastEntry => ({
    kind: 'human_group', id, role, aliases: [alias], identityEvidence: [cite(pages[0]!)], presence: presence(pages),
    appearanceClass: 'reviewed_human_ensemble', cardinality: 'multiple_unspecified', membership: 'same_ensemble_when_recurring',
  });
  const entries = [
    individual('human:baker', 'baker', 'האופה', 'female', [1, 12]),
    { ...individual('human:broom_holder', 'broom_holder', 'broom man', 'male', [5]),
      identityEvidence: [{ source: 'visual_direction' as const, pageNumber: 5,
        quote: storySourceSnapshotToTemplateInput(snapshot).pageImageDirections!.find(p => p.pageNumber === 5)!.imageDirection }] },
    individual('human:birthday_child', 'birthday_child', 'ילדת יום ההולדת', 'female', [11]),
    group('human-group:band', 'band', 'הלהקה', [9, 11]),
    group('human-group:playing_children', 'playing_children', 'ילדים', [9]),
  ];
  const reviewed = prepareAcceptedSupportingCastReview({ ...P1_REQUEST, entries });
  const context = { snapshot, candidate, supportingCastReview: reviewed.review };
  const page = (number: number) => candidate.template.pageContracts.find(p => p.pageNumber === number)!;
  const beat = (beatId: string) => candidate.actionSemanticCoverage.find(r => r.beatId === beatId)!;
  const actionTarget = (pageNumber: number, beatId: string, newBeatId: string) => {
    const record = beat(beatId);
    if (record.disposition.kind !== 'action_requirement') throw new Error('Expected action beat');
    const checkId = record.disposition.checkId;
    const action = page(pageNumber).actionRequirements!.find(a => a.checkId === checkId)!;
    return { pageNumber, beatId, newBeatId, sourceEvidenceId: record.sourceEvidenceId,
      expectedCheckId: action.checkId, expectedPredicate: action.predicate, expectedActionDigest: canonicalHash(action) };
  };
  const operations: SemanticCorrectionOperation[] = [
    { kind: 'replace_action_predicate', ...actionTarget(6, 'beat:p6:dini_walks', 'beat:p6:dini_runs'), predicate: 'runs' },
    { kind: 'replace_action_predicate', ...actionTarget(10, 'beat:p10:dini_walks', 'beat:p10:dini_runs'), predicate: 'runs' },
    { kind: 'replace_presentation', pageNumber: 2, mustShowIndex: 2, expectedMustShow: page(2).mustShow[2]!,
      replacement: 'Dini hurriedly darting from side to side around the cart to support the swaying cake.',
      sourceEvidenceIds: [beat('beat:p2:dini_supports').sourceEvidenceId, beat('beat:p2:dini_walks').sourceEvidenceId], castIds: ['companion:dragon_dini'] },
    { kind: 'action_to_presentation', ...actionTarget(2, 'beat:p2:dini_walks', 'beat:p2:dini_hurried_side_changes'),
      mustShowIndex: 2, expectedMustShow: page(2).mustShow[2]!, presentationClass: 'composition_focus' },
    { kind: 'action_to_presentation', ...actionTarget(12, 'beat:p12:dini_recoils', 'beat:p12:dini_gentle_withdrawal'),
      mustShowIndex: 4, expectedMustShow: page(12).mustShow[4]!, presentationClass: 'ambient_event' },
    { kind: 'replace_presentation', pageNumber: 12, mustShowIndex: 0, expectedMustShow: page(12).mustShow[0]!,
      replacement: 'The same female baker cutting the first slice from the cake at the celebration table.',
      sourceEvidenceIds: [beat('beat:p12:first_slice').sourceEvidenceId], castIds: ['human:baker'] },
    { kind: 'require_prop_state', pageNumber: 12, propId: 'prop_delivery_cart',
      expectedState: page(12).propState.find(p => p.propId === 'prop_delivery_cart')!.state,
      replacement: 'Delivery complete; visibly parked unobtrusively beside the picnic serving area.', decisionBasis: 'owner_required_visible_disposition' },
    ...['prop_cake', 'prop_delivery_cart'].map(propId => {
      const prop = candidate.template.recurringProps.find(p => p.id === propId)!;
      const cover = candidate.template.coverContract;
      const forbiddenIndex = cover.mustNotShow.findIndex(value => value.includes(prop.name));
      const shownIndex = propId === 'prop_cake' ? 2 : 0;
      return { kind: 'cover_visible_recurring_prop' as const, propId, expectedFirstRevealPage: prop.firstRevealPage!,
        expectedCoverMustShowIndex: shownIndex, expectedCoverMustShowValue: cover.mustShow[shownIndex]!,
        expectedCoverMustNotShowIndex: forbiddenIndex, expectedCoverMustNotShowValue: cover.mustNotShow[forbiddenIndex]!,
        decisionBasis: 'cover_hero_object_intentionally_visible' as const };
    }),
  ];
  return { context, plan: buildSemanticCorrectionPlan(context, operations) };
}
