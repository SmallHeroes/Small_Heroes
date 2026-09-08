import { parseArgs } from 'node:util';
import { prepareSemanticCorrectionPreview } from '../lib/visual-package/semanticCorrectionPreview';

try {
  const { values, tokens } = parseArgs({ options: {
    'repo-root': { type: 'string' }, 'story-key': { type: 'string' }, 'story-path': { type: 'string' },
    candidate: { type: 'string' }, 'cast-review': { type: 'string' }, operations: { type: 'string' },
    output: { type: 'string' }, write: { type: 'boolean', default: false },
  }, strict: true, allowPositionals: false, tokens: true });
  const optionNames = tokens.filter(token => token.kind === 'option').map(token => token.name);
  if (new Set(optionNames).size !== optionNames.length) throw new Error('duplicate_option');
  const required = (key: keyof typeof values): string => {
    const value = values[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`missing_${key}`);
    return value;
  };
  const result = prepareSemanticCorrectionPreview({
    repoRoot: required('repo-root'), storyKey: required('story-key'), storyPath: required('story-path'),
    candidatePath: required('candidate'), supportingCastReviewPath: required('cast-review'),
    operationsPath: required('operations'), outputDir: required('output'), write: values.write,
  });
  process.stdout.write(JSON.stringify({ status: 'review_pending', providerCalls: result.providerCalls,
    planDigest: result.packet.plan.digest, correctionDigest: result.packet.correction.digest,
    templateDigest: result.packet.correction.effective.templateDigest,
    coverageDigest: result.packet.correction.effective.coverageDigest, artifact: result.artifact }) + '\n');
} catch {
  // Source excerpts and arbitrary input errors must not leak into CLI error output.
  process.stdout.write(JSON.stringify({ status: 'rejected', providerCalls: 0 }) + '\n');
  process.exitCode = 1;
}
