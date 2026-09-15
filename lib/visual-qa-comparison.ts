import { z } from 'zod';
import { SEVERE_ANATOMY_INSTRUCTION } from './illustrated-anatomy-severity';

export const COMPARISON_VERSION = 'visual-qa-cross-family/v1';
export const comparisonModels = {
  sonnet: { name: 'anthropic/claude-4.5-sonnet', version: '459655107e29a683cb6deb73a9640cf9aeae39ea7c87803a2ae81c311f6ef44f' },
  qwen: { name: 'qwen/qwen3-7-plus', version: 'b964682d1c195be9959b5ebab520cb203fafd1d3b318b4893ebbb68ac8acfd98' },
} as const;
export type ComparisonModel = keyof typeof comparisonModels;
export const STYLE_TOLERANCE = `STYLE CALIBRATION: This is a children's watercolor illustration, not an anatomical diagram.
Do not report missing nail beds, skin creases, knuckle detail, visible toes inside a shoe, or an exact count of visible fingers as defects by themselves. A rounded finger group in a grip, fingers partly overlapping, an occluded thumb, and simplified shoes are acceptable when the visible outer form, ownership and attachment are coherent.
Still reject clear structural errors: extra/disconnected body fragments, a limb belonging to no plausible body, a hand visibly fused through another body part, or an impossible exposed joint. Simplification is not permission to ignore these errors. Do not require unseen anatomy and do not invent a connection to excuse an exposed contradiction.`;
export type StyleCalibration = { mode: 'rubric' | 'examples' | 'severe-only'; examples: Array<{ image: string; verdict: 'pass' | 'defect'; explanation: string }> };
const finding = z.object({ location: z.string().trim().min(1).max(400), evidence: z.string().trim().min(1).max(1200) }).strict();
export const comparisonReviewSchema = z.object({
  anatomy: z.object({ verdict: z.enum(['pass', 'defect', 'uncertain']), explanation: z.string().trim().min(1).max(2000), findings: z.array(finding).max(8) }).strict(),
  otherFindings: z.array(finding).max(8),
}).strict();
export const COMPARISON_INSTRUCTION = `Inspect this illustrated storybook image for visible drawing defects, not photorealism or artistic taste.
Assess the main child's anatomy: body ownership and attachments, plausible limbs and joints, and hand/foot structure. Distinguish normal stylization, perspective and occlusion from visible malformed connections. Do not demand visibility of hidden limbs or invent hidden structure to excuse a visible defect. Use uncertain when the visible evidence is insufficient.
Independently note clear non-anatomical drawing defects elsewhere, such as merged or disconnected object parts, incoherent perspective or broken surfaces. You have no prior page or canonical reference, so do not invent continuity or identity violations.
Return ONLY JSON: {"anatomy":{"verdict":"pass|defect|uncertain","explanation":"observed evidence","findings":[{"location":"visible location","evidence":"specific defect or unresolved anatomy"}]},"otherFindings":[{"location":"visible location","evidence":"specific drawing defect"}]}.
For anatomy pass, findings must be empty. For defect or uncertain, provide at least one specific finding. No markdown fences.`;

export function parseComparisonReview(text: string) {
  const r = comparisonReviewSchema.parse(JSON.parse(text));
  if ((r.anatomy.verdict === 'pass') !== (r.anatomy.findings.length === 0)) throw Error('comparison_verdict_conflict');
  return r;
}

export function comparisonInput(model: ComparisonModel, image: string, calibration?: StyleCalibration, details: string[] = []) {
  if (!Object.prototype.hasOwnProperty.call(comparisonModels, model)) throw Error('comparison_model_not_allowed');
  if (!image.startsWith('data:image/png;base64,')) throw Error('comparison_image_not_inline_png');
  const common = { prompt: 'Inspect the supplied image.', system_prompt: COMPARISON_INSTRUCTION, max_tokens: 3000 };
  if (details.length && (model !== 'qwen' || !['rubric','severe-only'].includes(calibration?.mode ?? '') || details.length > 4 || new Set(details).size !== details.length || details.some(d=>!d.startsWith('data:image/png;base64,') || d===image))) throw Error('invalid_comparison_details');
  if (calibration) {
    if (model !== 'qwen' || !['rubric','examples','severe-only'].includes(calibration.mode) ||
      (calibration.mode !== 'examples' ? calibration.examples.length !== 0 : calibration.examples.length < 1 || calibration.examples.length > 4)) throw Error('invalid_style_calibration');
    for (const e of calibration.examples) {
      if (!e.image.startsWith('data:image/png;base64,') || !['pass','defect'].includes(e.verdict) || !e.explanation.trim() || e.explanation.length > 1500 || e.image === image) throw Error('invalid_calibration_example');
    }
    return { ...common, system_prompt: calibration.mode === 'severe-only' ? SEVERE_ANATOMY_INSTRUCTION : `${COMPARISON_INSTRUCTION}\n\n${STYLE_TOLERANCE}`,
      prompt: details.length ? 'IMAGE 1 is the complete target illustration. Subsequent images are unmodified detail crops of that SAME target, not examples, extra people, or different scenes. Inspect the full image and its details together. Crops may omit anatomy that is visible in the full image; do not count that as missing anatomy. Return one review of the target.' : calibration.mode !== 'examples' ? common.prompt : `${calibration.examples.map((e,i) => `IMAGE ${i+1}: STYLE EXAMPLE ONLY. Anatomy verdict: ${e.verdict}. Explanation: ${e.explanation}`).join('\n')}\nIMAGE ${calibration.examples.length+1}: TARGET TO INSPECT. Evaluate ONLY this final image. Do not copy an example verdict or its objects onto the target.`,
      image: [...calibration.examples.map(e => e.image), image, ...details], temperature: 0 };
  }
  return model === 'sonnet' ? { ...common, image, max_image_resolution: 2 } : { ...common, image: [image], temperature: 0 };
}

export type ComparisonLabel = { expected: 'pass' | 'defect' | null; authority: 'owner' | 'provisional' | 'unlabelled' };
export function comparisonSummary(rows: Array<{ label: ComparisonLabel; observed: 'pass' | 'defect' | 'uncertain' | 'unknown' }>) {
  const count = (authority: ComparisonLabel['authority']) => {
    const selected = rows.filter(r => r.label.authority === authority && r.label.expected !== null);
    return { total: selected.length, matched: selected.filter(r => r.observed === r.label.expected).length,
      missedDefects: selected.filter(r => r.label.expected === 'defect' && r.observed === 'pass').length,
      falseAlarms: selected.filter(r => r.label.expected === 'pass' && r.observed === 'defect').length,
      unresolved: selected.filter(r => ['unknown', 'uncertain'].includes(r.observed)).length };
  };
  return { owner: count('owner'), provisional: count('provisional'), unlabelled: rows.filter(r => r.label.expected === null).length,
    renderAuthorized: false, generalAccuracyProven: false };
}
