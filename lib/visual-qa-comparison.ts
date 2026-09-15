import { z } from 'zod';

export const COMPARISON_VERSION = 'visual-qa-cross-family/v1';
export const comparisonModels = {
  sonnet: { name: 'anthropic/claude-4.5-sonnet', version: '459655107e29a683cb6deb73a9640cf9aeae39ea7c87803a2ae81c311f6ef44f' },
  qwen: { name: 'qwen/qwen3-7-plus', version: 'b964682d1c195be9959b5ebab520cb203fafd1d3b318b4893ebbb68ac8acfd98' },
} as const;
export type ComparisonModel = keyof typeof comparisonModels;
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

export function comparisonInput(model: ComparisonModel, image: string) {
  if (!Object.prototype.hasOwnProperty.call(comparisonModels, model)) throw Error('comparison_model_not_allowed');
  if (!image.startsWith('data:image/png;base64,')) throw Error('comparison_image_not_inline_png');
  const common = { prompt: 'Inspect the supplied image.', system_prompt: COMPARISON_INSTRUCTION, max_tokens: 3000 };
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
