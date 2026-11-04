import type { AdmittedFrame, LaunchGatePolicy } from '../delivery-gate';
import { authorityDigest, type EngineBookManifest, type EngineOrderAuthority } from '../contract';

/** Entirely synthetic. These are domain fixtures, never provider or independent QA evidence. */
export const hash = (digit = 'a') => digit.repeat(64);
export const NOW = new Date('2026-11-04T12:00:00.000Z');
export function authority(orderId = 'synthetic_order'): EngineOrderAuthority {
  return {
    version: 'engine-site/v1', orderId, requestSha256: hash(), optionsSha256: hash('b'),
    offer: { id: 'synthetic_offer', revisionSha256: hash('c') }, engine: 'native-cde-book/v1',
    sourceRevision: 'a'.repeat(40), policySha256: hash('d'), purpose: 'customer', imageQuality: 'medium',
    narrativePages: 8, entitlements: { narration: true, pdf: false },
    budget: { maximumMicroUsd: 100, maximumCalls: 3, approvalReference: 'SYNTHETIC_ONLY',
      approvedBy: 'synthetic_owner', approvedAt: NOW.toISOString(),
      steps: ['page_0_0', 'page_0_0_qa', 'page_0_0_identity'].map((id, index) => ({ id, maximumMicroUsd: index === 1 ? 70 : 40 })) },
  };
}
export function manifest(auth = authority()): EngineBookManifest {
  return {
    version: 'engine-site-book/v1', orderId: auth.orderId, authoritySha256: authorityDigest(auth),
    sourceSha256: hash(), storyboardSha256: hash('b'), imageQuality: auth.imageQuality,
    pages: Array.from({ length: 9 }, (_, pageNumber) => ({ pageNumber, textSha256: hash('c'),
      imageSha256: hash('d'), audioSha256: hash('e') })), pdfSha256: null,
  };
}
export function frames(book = manifest()): AdmittedFrame[] {
  return book.pages.map(page => ({ pageNumber: page.pageNumber, attempt: {
    candidate: { imageSha: page.imageSha256, imageName: `synthetic-${page.pageNumber}` },
    assessment: { findings: [], counts: { safety: 0, story: 0, identity: 0, continuity: 0, detail: 0 },
      safetyBlocked: false, invalidCitations: 0 },
    identity: { evaluatorVersion: 'page-child-resemblance-vision/v1', status: 'passed', resemblanceScore: 0.7,
      threshold: 0.7, subjectVisible: true, sameChild: true, reasonCode: 'same_child',
      attempts: 1, model: 'synthetic', featureAssessments: null },
  } }));
}
export function gate(mode: LaunchGatePolicy['mode'] = 'required'): LaunchGatePolicy {
  return { version: 'engine-site-launch-gate/v1', revision: 'synthetic_revision_1', mode,
    changedBy: 'synthetic_owner', changedAt: NOW.toISOString(), reason: 'Synthetic launch test' };
}
