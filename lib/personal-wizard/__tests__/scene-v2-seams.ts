// Provider-free v1 request seams for the scene-preservation (native-cde-book/v2) regression control. The SAME function produced the committed
// baseline (fixtures/scene-v2-v1-seams.json) at the parent commit, before any v2 code; the spec recomputes it and requires byte equality.
// Only APIs that existed before v2 are used here.
import sharp from 'sharp';
import { planGPTImageRequest } from '../../generate-image';
import { auditionRenderPlan, auditionJudgePayload, digestImages } from '../../../scripts/personal-simple-book-reviewed-audition';
import { AUDITION_PAGE_SUFFIX, AUDITION_SCALE_LINEUP_PAGE_SUFFIX, AUDITION_JUDGE_INSTRUCTIONS } from '../simple-book-reviewed-audition';
import { nativePageProofSteps } from '../native-page-proof';
import { previewSha } from '../../local-story-preview';
import { canonicalJson } from '../request-acceptance';

const solid = (r: number, g: number, b: number) => sharp({ create: { width: 64, height: 96, channels: 3, background: { r, g, b } } }).png().toBuffer();
const image = (name: string) => ({ imageName: `${name}.png`, imageSha: previewSha(name) });
const digest = (value: unknown) => previewSha(canonicalJson(JSON.parse(JSON.stringify(value))));

export async function v1RequestSeams() {
  const refs = ['child', 'companion', 'entities', 'locations'].map(image);
  const plan = (mode: 'book_identity' | 'book_scene_edit' | 'book_design' | 'identity', roles?: string[]) => {
    const p = planGPTImageRequest({ finalPrompt: 'SYNTHETIC PAGE PROMPT', referenceImages: refs.map(r => `/virtual/${r.imageName}`), referenceMode: mode,
      ...(roles ? { referenceRoles: roles as never } : {}), requireReferenceEdit: true, quality: 'low', size: '1024x1536', modelOverride: 'gpt-image-2' },
      { defaultQuality: 'low', defaultModel: 'gpt-image-2', maxReferences: 4 });
    return { finalPrompt: p.finalPrompt, body: p.bodyWithoutBinaryImage, roles: p.referenceRoles ?? null, passed: p.referenceCountPassed, cap: p.referenceCountCap };
  };
  const editRoles = ['scene_edit_target', 'child_design_authority', 'companion_design_authority', 'entity_design_authority'];
  const designRoles = ['rejected_edit_target', 'child_design_authority', 'companion_design_authority', 'entity_design_authority'];
  const renderPlan = (mode: 'book_identity' | 'book_scene_edit', roles?: string[], framing?: true) =>
    auditionRenderPlan('/virtual', 'SYNTHETIC PAGE PROMPT', refs, mode, roles as never, undefined, framing ? 'reader-safe-scene-framing/v1' as never : undefined).wire;
  const [a, b, c, d, e, f] = await Promise.all([solid(250, 240, 230), solid(10, 20, 30), solid(200, 30, 30), solid(30, 200, 30), solid(30, 30, 200), solid(120, 120, 120)]);
  const judge = await auditionJudgePayload({ candidate: { imageName: 'candidate.png', imageSha: previewSha(a) }, candidateBytes: a,
    context: { version: 'audition-page-context/v2', requirementIds: ['page_text'] }, contextSha: 'a'.repeat(64), refs: [b, c, d, e], predecessor: f, kind: 'page' });
  return {
    planner: { book_identity: digest(plan('book_identity')), book_scene_edit: digest(plan('book_scene_edit', editRoles)),
      book_design: digest(plan('book_design', designRoles)), identity: digest(plan('identity')) },
    renderPlan: { book_identity: digest(renderPlan('book_identity')), book_identity_framed: digest(renderPlan('book_identity', undefined, true)),
      book_scene_edit: digest(renderPlan('book_scene_edit', editRoles)) },
    judgePayload: digest(digestImages(judge)),
    text: { pageSuffix: previewSha(AUDITION_PAGE_SUFFIX), lineupSuffix: previewSha(AUDITION_SCALE_LINEUP_PAGE_SUFFIX),
      judgeInstructions: digest(AUDITION_JUDGE_INSTRUCTIONS) },
    steps: { proof: digest(nativePageProofSteps([3, 7])), book: digest(nativePageProofSteps([0, 1, 2, 3, 4, 5, 6, 7, 8], 3, true)) },
  };
}
