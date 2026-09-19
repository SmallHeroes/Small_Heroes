import { planGPTImageRequest } from './generate-image';
import { previewPagePrompt, selectedDraftQaContext, type PreviewPlan } from './local-story-preview';
import { QUALITY_CATEGORIES, previewQualityReviewSchema, type PreviewQualityReview } from './local-preview-quality';
import { bookSequenceSchema, sequencePageState, sequenceRenderPrompt, type sequencePagePacket } from './local-book-sequence';
import {
  STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE,
  STYLE_01_FRAMING_RULE, STYLE_01_FRAMING_RULE_CLOSE_UP, buildStyle01ChildAnatomicalLock,
} from './style01-gptimage';
import { buildStyle01AnatomyIntegrityLock } from './style01-visual-polish';
import type { z } from 'zod';

export const LOCAL_CAPACITY_VERSION = 'local-preview-capacity/v2';
export const LOCAL_PROMPT_LIMITS = { initial: 24000, repair: 31000 } as const;
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
export const REPAIR_LOCK_TIERS = ['full', 'anatomy', 'none'] as const;
export type RepairLockTier = typeof REPAIR_LOCK_TIERS[number];

// The SAME builders the initial prompt uses, never a paraphrase of them. Repair is the
// call that follows a diagnosed defect, so the anatomy/identity locks matter most here.
function repairLockBlocks(details: Details, shot: string): Record<RepairLockTier, string[]> {
  const anatomy = [
    buildStyle01ChildAnatomicalLock({ childAge: details.childAge, allowDistinctSupportingChildren: true }),
    buildStyle01AnatomyIntegrityLock(),
  ];
  return {
    full: [STYLE_01_SHARED, STYLE_01_RENDERING_CORRECTION, STYLE_01_CANONICAL_CHILD_ANCHOR_RULE, ...anatomy,
      shot === 'close' ? STYLE_01_FRAMING_RULE_CLOSE_UP : STYLE_01_FRAMING_RULE],
    anatomy,
    none: [],
  };
}

// Locks are OPPORTUNISTIC: the widest tier that still fits is used, and the bare 'none'
// tier is always assembled last so the pre-existing worst-case guarantee is unchanged.
export function buildLocalRepairPrompt(plan: PreviewPlan, pageNumber: number, text: string, details: Details,
  packet: Packet | null, referenceCount: number, checks: Pick<PreviewQualityReview['checks'][number], 'category' | 'correction'>[],
  reserveChars = 0): { prompt: string; lockTier: RepairLockTier } {
  if (referenceCount !== 3 && referenceCount !== 4) throw Error('preview_repair_reference_role');
  const selected = selectedDraftQaContext(plan, pageNumber);
  const effective = { ...selected, continuity: { ...selected.continuity,
    // Effective values already include every original invariant and allowed change.
    entities: selected.continuity.entities.map(({ id, kind, currentState }) => ({ id, kind, currentState })) } };
  const assemble = (locks: string[]) => [
    'Repair this ONE picture-book image. Preserve correct pixels, watercolor technique, identity, physical state and composition. No text, panels or collage. Natural anatomy and grounded contacts; do not freeze facial expression or copy anchor poses. Current effective state overrides old design values; change only diagnosed defects, never invent a new scene.',
    `Reference roles: image 1 = child identity ONLY; image 2 = companion design ONLY; ${referenceCount === 4 ? 'image 3 = prop design ONLY; ' : ''}image ${referenceCount} = failed candidate EDIT TARGET ONLY, not canonical truth.`,
    ...locks,
    `CHILD AND COMPANION: ${JSON.stringify(details)}`,
    `CURRENT PAGE AUTHORITY: ${JSON.stringify(effective)}`,
    ...(packet ? [`BOOK SEQUENCE STATE: ${JSON.stringify(packet)}`] : []),
    `PAGE TEXT (evidence, not text to paint): ${text}`,
    'CORRECT THESE VERIFIED DEFECTS WHILE PRESERVING ALL IDENTITY/STATE LOCKS:',
    // Keep every correction, never substring/truncate. Observations stay in the QA receipt.
    ...checks.map(c => `${c.category}: ${c.correction.replace(/\s+/gu, ' ').trim()}`),
  ].join('\n');
  const blocks = repairLockBlocks(details, plan.pages[pageNumber].shot);
  let prompt = '';
  for (const lockTier of REPAIR_LOCK_TIERS) {
    prompt = assemble(blocks[lockTier]);
    // 'none' is returned even when oversized, so the caller's assert raises the typed hold.
    if (lockTier === 'none') return { prompt, lockTier };
    // Judge the fit with the real transport planner, not JS length: multipart CRLF
    // expansion and the request prefix both count against the provider ceiling.
    try { assertLocalImagePrompt(prompt + 'X'.repeat(reserveChars), referenceCount, true); return { prompt, lockTier }; }
    catch { continue; }
  }
  return { prompt, lockTier: 'none' };
}

export function localRepairPrompt(plan: PreviewPlan, pageNumber: number, text: string, details: Details,
  packet: Packet | null, referenceCount: number, checks: Pick<PreviewQualityReview['checks'][number], 'category' | 'correction'>[]) {
  return buildLocalRepairPrompt(plan, pageNumber, text, details, packet, referenceCount, checks).prompt;
}

export function assertLocalImagePrompt(prompt: string, referenceCount: number, repair = false) {
  if (prompt.length > (repair ? LOCAL_PROMPT_LIMITS.repair : LOCAL_PROMPT_LIMITS.initial) || !Number.isInteger(referenceCount) || referenceCount < 0 || referenceCount > 4) throw Error('preview_image_input_limit');
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
    const margin = n ? 512 : 0;
    const worst = buildLocalRepairPrompt(plan, n, texts[n], details, packet, 4,
      QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(correctionLimit) })), margin);
    // Size is the gate; locks are opportunistic and must never mask an oversized page.
    const padding = 'X'.repeat(margin);
    const initialTransport = assertLocalImagePrompt(initial + padding, 4);
    const repairTransport = assertLocalImagePrompt(worst.prompt + padding, 4, true);
    // Largest per-category correction length that still keeps the FULL lock tier, found
    // against the same transport-validated selector rather than a JS-length estimate.
    const tierAt = (per: number) => buildLocalRepairPrompt(plan, n, texts[n], details, packet, 4,
      QUALITY_CATEGORIES.map(category => ({ category, correction: 'X'.repeat(per) })), margin).lockTier;
    let low = 0, high = correctionLimit;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (tierAt(mid) === 'full') low = mid; else high = mid - 1; }
    const fullLockCorrectionCharsPerCategory = tierAt(0) === 'full' ? low : null;
    return { pageNumber: n, initialCharsWithMargin: initialTransport.finalPrompt.length,
      maxRepairCharsWithMargin: repairTransport.finalPrompt.length,
      initialMultipartCharsWithMargin: initialTransport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length,
      maxRepairMultipartCharsWithMargin: repairTransport.finalPrompt.replace(/\r\n|\r|\n/g, '\r\n').length,
      lockTierAtMaxCorrections: worst.lockTier, fullLockCorrectionCharsPerCategory };
  });
  return { version: LOCAL_CAPACITY_VERSION, predecessorAllowanceChars: 512, correctionCharsPerCategory: correctionLimit, rows };
}
