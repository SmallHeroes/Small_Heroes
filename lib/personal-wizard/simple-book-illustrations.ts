import 'server-only';
import { z } from 'zod';
import { canonicalJson } from './request-acceptance';
import { prepareSimpleStory } from './simple-story-engine';
import { currentPersonalStoryboardFrame } from './storyboard';
import { sequencePredecessor, type ReviewedSequencePage } from '../local-book-sequence';
import { previewSha } from '../local-story-preview';
import { STYLE_01_SHARED } from '../style01-prompt-core';
import { qualityDisposition, runPreviewQualityLoop, type PreviewQualityReview } from '../local-preview-quality';
import type { runSimpleWizardBook } from './simple-book-flow';
import type { PersonalWizardOptions } from './options';
import type { PageChildResemblanceVisionResult } from '../generation-pipeline/page-child-resemblance-vision';

export const illustratedAuditionApprovalSchema = z.object({ version: z.literal('local-book-night-approval/v1'),
  maximumMicroUsd: z.literal(12000000), bookCount: z.literal(1), narrativePages: z.literal(8), cover: z.literal(true),
  publicRelease: z.literal(false), customerCharge: z.literal(false), gateChanges: z.literal(false),
  oneBookDiagnosticVisualException: z.object({ approved: z.literal(true), permanentlyRuntimeIneligible: z.literal(true),
    identityThreshold: z.literal(0.7) }).passthrough(),
}).passthrough();
export type AuditionImage = { imageSha: string; imageName: string };
type WizardResult = Awaited<ReturnType<typeof runSimpleWizardBook>>;
export class SimpleIllustrationError extends Error { constructor(readonly code: string) { super(code); } }
const fail = (code: string): never => { throw new SimpleIllustrationError(code); };

/** Injected audition only. No SDK, keys, auto-retry, production package or publication authority. */
export async function illustrateSimpleBook(args: {
  result: WizardResult; request: unknown; options: PersonalWizardOptions; seed: string;
  approval: unknown; childDesign: string; companion: AuditionImage; signal: AbortSignal;
  actorOwnedAppearance?: true;
  render: (step: string, prompt: string, refs: AuditionImage[], mode: 'book_identity' | 'identity') => Promise<AuditionImage>;
  judge: (step: string, candidate: AuditionImage, context: unknown, contextSha: string, refs: AuditionImage[], predecessor: AuditionImage | null) => Promise<unknown>;
  identity: (step: string, child: AuditionImage, candidate: AuditionImage) => Promise<PageChildResemblanceVisionResult>;
  save: (name: string, value: unknown) => void;
  progress: (phase: 'references' | 'illustrating', pages: { pageNumber: number; imageSha: string; imageName: string }[]) => void;
}) {
  illustratedAuditionApprovalSchema.parse(args.approval);
  if (args.result.status !== 'review_supported' || !args.result.storyboard || args.childDesign.trim().length < 20 || args.childDesign.length > 1500) fail('simple_illustration_admission');
  const result = args.result, diagnostic = result.storyboard!, book = diagnostic.storyboard;
  if (args.actorOwnedAppearance && !book.plan.actorAppearance) fail('simple_visual_ownership_required');
  const current = { request: args.request, writerResult: result.source, options: args.options };
  const prepared = prepareSimpleStory(args.request, args.options, args.seed);
  if (prepared.book.pages !== 8 || prepared.accepted.containsFixtureData || prepared.accepted.canonical.appearance.photo !== 'none') fail('simple_illustration_admission');
  const bindingValue = () => ({ request: args.request, source: result.source, approval: args.approval, childDesign: args.childDesign,
    ...(args.actorOwnedAppearance ? { actorOwnedAppearance: true } : {}) });
  const binding = previewSha(canonicalJson(bindingValue()));
  const check = () => {
    if (args.signal.aborted) fail('simple_illustration_cancelled');
    if (previewSha(canonicalJson(bindingValue())) !== binding) fail('simple_illustration_source_changed');
    if (args.actorOwnedAppearance && !book.plan.actorAppearance) fail('simple_visual_ownership_required');
    // Branded current source and whole-book review admission, not a JSON restoration shortcut.
    currentPersonalStoryboardFrame(book, diagnostic.rawReview, 0, current);
  };
  check(); args.progress('references', []);
  const designs = {
    entities: { props: book.plan.recurringProps, entities: book.plan.continuity!.entities },
    locations: { locations: book.plan.locations, geography: book.sequence.premise },
  };
  const refSpecs = [
    { name: 'child', design: { age: prepared.brief.child.age, address: prepared.brief.child.address, fictionalDesign: args.childDesign, wardrobe: book.plan.wardrobe,
      ...(book.plan.actorAppearance ? { role: 'child', clothing: book.plan.actorAppearance.child.clothing } : {}) },
      prompt: `${STYLE_01_SHARED}\nOne NEW fictional child character anchor, not a real photograph. ${prepared.brief.child.age} year old ${prepared.brief.child.address}. ${args.childDesign}. Exact wardrobe: ${book.plan.wardrobe}. One child only, full natural body, readable front three-quarter face, arms and hands visible, ordinary relaxed standing pose, warm cream near-empty background. No props, companion, words, panels or lettering.` },
    { name: 'entities', design: designs.entities,
      prompt: `${STYLE_01_SHARED}\nCanonical PROP AND SUPPORTING CAST design atlas for a single book. Isolated clear designs with short Latin ID labels, one tile per listed ID. Include EVERY ID exactly once, preserve all invariants. Do not invent extra characters, child or companion. Not a story scene. AUTHORITATIVE DESIGN DATA: ${canonicalJson(designs.entities)}` },
    { name: 'locations', design: designs.locations,
      prompt: `${STYLE_01_SHARED}\nCanonical LOCATION design atlas for a single book. One roomy establishing view per location with short Latin ID label. Clearly preserve materials, landmark shapes, relative geography and stable topology in each view. No child or companion. AUTHORITATIVE DESIGN DATA: ${canonicalJson(designs.locations)}` },
  ];
  const refs: AuditionImage[] = [];
  for (const spec of refSpecs) {
    check(); const candidate = await args.render(`reference_${spec.name}`, spec.prompt, [], 'identity'); check();
    const context = { scope: 'noncommercial_reference_design_only', design: spec.design,
      inspection: 'Check every listed design against actual pixels, age/anatomy/wardrobe for child, all entities and stable topology for atlases. Mark unrelated scene/framing categories pass with N/A evidence; uncertainty or omitted required design is not pass. This does not grant production qualification.' };
    const contextSha = previewSha(JSON.stringify(context));
    const raw = await args.judge(`reference_${spec.name}_qa`, candidate, context, contextSha, [], null); check();
    const review = qualityDisposition(raw, candidate.imageSha, contextSha);
    args.save(`reference_${spec.name}_review`, review);
    if (review.disposition !== 'passed') fail('simple_reference_held');
    refs.push(candidate);
  }
  const canonical = [refs[0], args.companion, refs[1], refs[2]];
  args.save('audition_references', { binding, sourceDigest: diagnostic.sourceDigest, storyboardDigest: diagnostic.storyboardDigest,
    roles: ['child', 'companion', 'entities', 'locations'], canonical, designs, runtimeEligible: false });
  const completed: (ReviewedSequencePage & { pageNumber: number; status: 'passed'; candidate: AuditionImage; identity: PageChildResemblanceVisionResult })[] = [];
  for (let pageNumber = 0; pageNumber <= 8; pageNumber++) {
    check(); const packet = currentPersonalStoryboardFrame(book, diagnostic.rawReview, pageNumber, current);
    const predecessor = pageNumber > 0 ? sequencePredecessor(book.sequence, pageNumber, completed) : null;
    const priorImage = predecessor ? completed.find(p => p.pageNumber === predecessor.pageNumber)!.candidate : null;
    const context = { packet: packet.context, references: canonical,
      predecessor: predecessor ? { ...predecessor, authority: 'comparison_only_not_canonical' } : null };
    const loop = await runPreviewQualityLoop({ context, maxRepairs: 1,
      render: async (attempt, _prior, review) => {
        check();
        const corrections = review?.checks.filter(c => c.verdict === 'defect').map(c => `${c.category}: ${c.correction}`).join('\n') ?? '';
        const candidate = await args.render(`page_${pageNumber}_${attempt}`, packet.render.prompt +
          '\nImage 4 is the canonical location/topology atlas, not a prior scene. Draw only current visible entities. No text, labels or panel borders. Child face must remain naturally readable for identity inspection, without changing action or camera.' +
          (corrections ? `\nTARGETED VISUAL CORRECTION; preserve ALL other canonical requirements:\n${corrections}` : ''), canonical, 'book_identity');
        check(); return candidate;
      }, judge: async (candidate, contextSha, attempt) => {
        check(); const raw = await args.judge(`page_${pageNumber}_${attempt}_qa`, candidate, context, contextSha, canonical, priorImage); check(); return raw;
      } });
    args.save(`page_${pageNumber}_quality`, loop);
    if (loop.status !== 'passed') fail(loop.status === 'held_uncertain' ? 'simple_image_uncertain' : 'simple_image_repair_limit');
    check(); const identity = await args.identity(`page_${pageNumber}_identity`, refs[0], loop.candidate); check();
    args.save(`page_${pageNumber}_identity`, identity);
    if (identity.status !== 'passed' || identity.subjectVisible !== true || identity.sameChild !== true || identity.reasonCode !== 'same_child' ||
        identity.threshold !== 0.7 || identity.resemblanceScore === null || identity.resemblanceScore < 0.7) fail('simple_image_identity_held');
    completed.push({ pageNumber, status: 'passed', candidate: loop.candidate, identity, contextSha: loop.contextSha, history: loop.history });
    args.progress('illustrating', completed.map(p => ({ pageNumber: p.pageNumber, ...p.candidate })));
  }
  check();
  const manifest = { version: 'local-simple-illustrated-audition/v1', requestId: result.source.requestId,
    sourceDigest: diagnostic.sourceDigest, storyboardDigest: diagnostic.storyboardDigest, binding,
    title: result.source.manuscript.title, manuscript: result.source.manuscript, pages: completed,
    runtimeEligible: false as const, productionQualified: false as const, identityThreshold: 0.7 };
  args.save('illustrated_book', manifest);
  return manifest;
}

export function illustratedBookHTML(manifest: Awaited<ReturnType<typeof illustrateSimpleBook>>, imageData: (name: string, sha: string) => string) {
  if (manifest.pages.length !== 9 || manifest.pages.some((p, i) => p.pageNumber !== i || p.status !== 'passed' || p.identity.status !== 'passed')) fail('simple_book_incomplete');
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const pages = manifest.pages.map(p => `<section><img alt="${p.pageNumber ? `איור לעמוד ${p.pageNumber}` : 'כריכה'}" src="${esc(imageData(p.candidate.imageName, p.candidate.imageSha))}"><h2>${p.pageNumber ? `עמוד ${p.pageNumber}` : esc(manifest.title)}</h2><p>${p.pageNumber ? esc(manifest.manuscript.pages[p.pageNumber - 1].text) : 'ספר ניסוי אישי · לא מאושר לייצור'}</p></section>`).join('\n');
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(manifest.title)}</title><style>body{background:#f5f0e6;color:#263542;margin:0;font:22px/1.8 Arial,sans-serif}main{max-width:900px;margin:auto;padding:30px}section{background:#fffdf7;padding:28px;margin:28px 0;border-radius:20px;box-shadow:0 5px 30px #293c4820;break-after:page}img{width:100%;display:block;border-radius:12px}p{white-space:pre-line}h1,h2{text-align:center}@media(max-width:600px){main,section{padding:14px}body{font-size:19px}}@media print{main{padding:0}section{box-shadow:none;margin:0}}</style><main><h1>${esc(manifest.title)}</h1><p>8 עמודי סיפור ועוד כריכה. ניסוי לא מסחרי; לא אישור לייצור.</p>${pages}</main></html>`;
}
