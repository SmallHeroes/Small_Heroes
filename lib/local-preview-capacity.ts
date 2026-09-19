import { planGPTImageRequest } from './generate-image';
import { previewPagePrompt, selectedDraftQaContext, type PreviewPlan } from './local-story-preview';
import { QUALITY_CATEGORIES, previewQualityReviewSchema, type PreviewQualityReview } from './local-preview-quality';
import { bookSequenceSchema, sequencePageState, sequenceRenderPrompt, type sequencePagePacket } from './local-book-sequence';
import type { z } from 'zod';

export const LOCAL_CAPACITY_VERSION = 'local-preview-capacity/v1';
// Headroom policy, not measured output requirements or a completion guarantee.
export function localPlannerCapacity(pageCount: number, requestText: unknown) {
  if (!Number.isInteger(pageCount) || pageCount < 2 || pageCount > 24) throw Error('planner_page_count');
  const maxOutputTokens = 16000 + 1000 * pageCount;
  // Byte-level BPE text upper bound plus conservative protocol allowance; includes schema.
  const inputTokenUpperBound = Buffer.byteLength(JSON.stringify(requestText), 'utf8') + 4096;
  if (inputTokenUpperBound > 90000) throw Error('planner_input_capacity');
  const reserveUsd = Math.ceil((inputTokenUpperBound + maxOutputTokens) * 30 / 1_000_000 * 100) / 100;
  return { version: LOCAL_CAPACITY_VERSION, maxOutputTokens, inputTokenUpperBound, reserveUsd };
}

type Packet = ReturnType<typeof sequencePagePacket>;
type Details = { childAge: number; gender: string; companionDescription: string };
export function localRepairPrompt(plan: PreviewPlan, pageNumber: number, text: string, details: Details,
  packet: Packet | null, referenceCount: number, checks: Pick<PreviewQualityReview['checks'][number], 'category' | 'correction'>[]) {
  if (referenceCount !== 3 && referenceCount !== 4) throw Error('preview_repair_reference_role');
  const selected = selectedDraftQaContext(plan, pageNumber);
  const effective = { ...selected, continuity: { ...selected.continuity,
    // Effective values already include every original invariant and allowed change.
    entities: selected.continuity.entities.map(({ id, kind, currentState }) => ({ id, kind, currentState })) } };
  return [
    'Repair this ONE picture-book image. Preserve correct pixels, watercolor technique, identity, physical state and composition. No text, panels or collage. Natural anatomy and grounded contacts; do not freeze facial expression or copy anchor poses. Current effective state overrides old design values; change only diagnosed defects, never invent a new scene.',
    `Reference roles: image 1 = child identity ONLY; image 2 = companion design ONLY; ${referenceCount === 4 ? 'image 3 = prop design ONLY; ' : ''}image ${referenceCount} = failed candidate EDIT TARGET ONLY, not canonical truth.`,
    `CHILD AND COMPANION: ${JSON.stringify(details)}`,
    `CURRENT PAGE AUTHORITY: ${JSON.stringify(effective)}`,
    ...(packet ? [`BOOK SEQUENCE STATE: ${JSON.stringify(packet)}`] : []),
    `PAGE TEXT (evidence, not text to paint): ${text}`,
    'CORRECT THESE VERIFIED DEFECTS WHILE PRESERVING ALL IDENTITY/STATE LOCKS:',
    // Keep every correction, never substring/truncate. Observations stay in the QA receipt.
    ...checks.map(c => `${c.category}: ${c.correction.replace(/\s+/gu, ' ').trim()}`),
  ].join('\n');
}

export function assertLocalImagePrompt(prompt: string, referenceCount: number, repair = false) {
  if (prompt.length > (repair ? 31000 : 24000) || !Number.isInteger(referenceCount) || referenceCount < 0 || referenceCount > 4) throw Error('preview_image_input_limit');
  // Same pure transport planner as the provider: prefix + multipart CRLF, no I/O.
  return planGPTImageRequest({ finalPrompt: prompt, referenceImages: Array.from({ length: referenceCount }, (_, i) => `reference-${i}`),
    referenceMode: 'explicit_role_map', requireReferenceEdit: referenceCount > 0, modelOverride: 'gpt-image-2', quality: 'low', size: '1024x1536' },
  { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
}

export function preflightLocalBookPrompts(plan: PreviewPlan, sequence: z.infer<typeof bookSequenceSchema>, texts: string[], details: Details) {
  const correctionLimit = previewQualityReviewSchema.shape.checks.element.shape.correction.maxLength;
  if (correctionLimit === null) throw Error('preview_unbounded_correction');
  const rows = plan.pages.map(page => {
    const n = page.pageNumber;
    // No fabricated review/predecessor authority. Reserve512 chars for future bound metadata.
    const packet = n ? { ...sequencePageState(sequence, plan, n), predecessor: null } : null;
    const base = previewPagePrompt(plan, n, texts[n], details.childAge, details.gender, details.companionDescription);
    const initial = packet ? sequenceRenderPrompt(base, packet, 4) : base;
    const repair = localRepairPrompt(plan, n, texts[n], details, packet, 4,
      QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(correctionLimit) })));
    const padding = n ? 'X'.repeat(512) : '';
    const initialTransport = assertLocalImagePrompt(initial + padding, 4);
    const repairTransport = assertLocalImagePrompt(repair + padding, 4, true);
    return { pageNumber: n, initialCharsWithMargin: initialTransport.finalPrompt.length,
      maxRepairCharsWithMargin: repairTransport.finalPrompt.length,
      initialMultipartCharsWithMargin: initialTransport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length,
      maxRepairMultipartCharsWithMargin: repairTransport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length };
  });
  return { version: LOCAL_CAPACITY_VERSION, predecessorAllowanceChars: 512, correctionCharsPerCategory: correctionLimit, rows };
}
