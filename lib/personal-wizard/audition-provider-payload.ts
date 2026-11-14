import 'server-only';
import sharp from 'sharp';
import { zodTextFormat } from 'openai/helpers/zod';
import { previewSha } from '@/lib/local-story-preview';
import type { AuditionImage } from './simple-book-illustrations';
import { auditionJudgeInstruction, auditionPageReviewSchemaForContext, auditionAnatomyCast,
  auditionLandmarkTopology, auditionReviewSchema, LANDMARK_COVERAGE_TOPOLOGY_VERSION, ReviewedAuditionError } from './simple-book-reviewed-audition';
import { sceneJudgeReferenceRoles } from './scene-preservation';
import { sceneRelationsFromContext } from './storyboard-scene-relations';
import { auditionReviewOutputCap, type AUDITION_REVIEW_CAPACITY_VERSION } from './audition-review-capacity';
import { PICTURE_BOOK_CONCISE_REVIEW, PICTURE_BOOK_LANDMARK_REPORTING, PICTURE_BOOK_REVIEW_DIRECTION, PICTURE_BOOK_SCALE_REPORTING, PICTURE_BOOK_SCALE_REVIEW,
  PICTURE_BOOK_SPARSE_LANDMARK_REVIEW, type PictureBookReview } from './picture-book-direction';
const REVIEW_MODEL = 'gpt-6.1-sol';
const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
const fail = (code: string): never => { throw new ReviewedAuditionError(code); };
export async function auditionJudgePayload(args: { candidate: AuditionImage; candidateBytes: Buffer; context: unknown; contextSha: string;
  refs: readonly Buffer[]; predecessor: Buffer | null; kind: 'sheet' | 'page'; reviewCapacity?: typeof AUDITION_REVIEW_CAPACITY_VERSION;
  pictureBookReview?: PictureBookReview; concisePageEvidence?: true }) {
  const outputCap = auditionReviewOutputCap(args.reviewCapacity);
  const buffer = args.candidateBytes, meta = await sharp(buffer).metadata();
  const width = meta.width!, height = meta.height!, cw = Math.ceil(width * .7), ch = Math.ceil(height * .7);
  const crops = await Promise.all([[0, 0], [width - cw, 0], [0, height - ch], [width - cw, height - ch]].map(async ([left, top]) =>
    dataUrl(await sharp(buffer).extract({ left, top, width: cw, height: ch }).png().toBuffer())));
  const imageURLs = [dataUrl(buffer), ...crops, ...args.refs.map(dataUrl), ...(args.predecessor ? [dataUrl(args.predecessor)] : [])];
  // v2 (scene-preservation/v1): the context declares each reference's judge role next to its image hash; positions are never assumed.
  const declared = sceneJudgeReferenceRoles(args.context);
  if (declared && (declared.length !== args.refs.length || declared.some((d, i) => previewSha(args.refs[i]) !== d.imageSha))) fail('scene_judge_reference_binding');
  const refRoles = declared ? declared.map(d => d.role) : ['canonical_child', 'canonical_companion', 'canonical_entities', 'canonical_locations'].slice(0, args.refs.length);
  const text = JSON.stringify({ candidateSha: args.candidate.imageSha, contextSha: args.contextSha, context: args.context,
    imageRoles: ['candidate_complete', 'candidate_crop_top_left', 'candidate_crop_top_right', 'candidate_crop_bottom_left', 'candidate_crop_bottom_right',
      ...refRoles, ...(args.predecessor ? ['prior_same_scene_comparison_not_authority'] : [])] });
  // Chosen from the judged context: an entities design carrying the opt-in lineup gets its checks; anything else the existing instruction.
  const instructions = auditionJudgeInstruction(args.kind, args.context) +
    (args.pictureBookReview ? '\n' + PICTURE_BOOK_REVIEW_DIRECTION : '') +
    (args.kind === 'page' && (args.pictureBookReview === PICTURE_BOOK_SCALE_REVIEW ||
      args.pictureBookReview === PICTURE_BOOK_SPARSE_LANDMARK_REVIEW) ? '\n' + PICTURE_BOOK_SCALE_REPORTING : '') +
    (args.kind === 'page' && args.pictureBookReview === PICTURE_BOOK_SPARSE_LANDMARK_REVIEW ? '\n' + PICTURE_BOOK_LANDMARK_REPORTING : '') +
    (args.kind === 'page' && args.concisePageEvidence ? '\n' + PICTURE_BOOK_CONCISE_REVIEW : '');
  if (imageURLs.length > 10 || Buffer.byteLength(text + instructions, 'utf8') > 104000) fail('audition_pixel_input_limit');
  return { model: REVIEW_MODEL, store: false, service_tier: 'default' as const, reasoning: { effort: 'medium' as const }, instructions,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text },
      ...imageURLs.map(image_url => ({ type: 'input_image' as const, image_url, detail: 'high' as const }))] }],
    ...(args.reviewCapacity ? { metadata: { review_capacity_version: args.reviewCapacity } } : {}),
    max_output_tokens: outputCap, text: { format: args.kind === 'page' ? zodTextFormat(auditionPageReviewSchemaForContext(args.context),
      sceneRelationsFromContext(args.context) ? 'personal_audition_pixels_scene_relations_v1'
        : auditionAnatomyCast(args.context) ? 'personal_audition_pixels_anatomy_v2'
        : auditionLandmarkTopology(args.context) === LANDMARK_COVERAGE_TOPOLOGY_VERSION ? 'personal_audition_pixels_topology_v2'
        : auditionLandmarkTopology(args.context) ? 'personal_audition_pixels_topology_v1' : 'personal_audition_pixels_v4')
      : zodTextFormat(auditionReviewSchema, 'personal_audition_pixels_v2') } };
}
