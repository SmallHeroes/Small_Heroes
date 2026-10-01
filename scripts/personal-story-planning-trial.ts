/** Owner-approved fixed text experiment. Dry by default; no routes, images or audio. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { parse as parseEnv } from 'dotenv';
import { loadFrozenStoryEngine, gitAt, type FrozenEngine } from './personal-story-frozen-engine';
import { TrialFamilyGuard, TRIAL_FAMILY, trialSlotReservation, type TrialSlot } from './personal-story-trial-guard';
import { trialFailureDiagnostic } from './personal-story-editor-trial';
import { personalStoryEvaluationProfiles } from '../lib/personal-wizard/story-evaluation-profiles';
import { assertStoryPlanningHoldBinding, type PreparedStory, type StoryCall } from '../lib/personal-wizard/story-writer';
import { withGenerationDeadline } from '../lib/personal-wizard/generation-deadline';
import { buildStoryComparison, renderBlindStoryComparison, storyReviewPacket, STORY_REVIEW_PHASES } from '../lib/personal-wizard/story-comparison';
import type { StoryEditorCall } from '../lib/personal-wizard/story-editor';
import type { PersonalStoryResult } from '../lib/personal-wizard/story-contract';

export const TRIAL_MODEL = 'gpt-6.1-sol' as const;
export const TRIAL_BASELINE = '6de84b4f1b20a15fd260fed68e6723d17e58edf9';
export const TRIAL_CURRENT = 'a5d8d6bcde4b2486b7cf44b2a8917929821d22c5';
export const TRIAL_PROFILES = ['synthetic_1', 'synthetic_5', 'synthetic_9'] as const;
export const trialRepo = path.resolve(__dirname, '..');
const saveJson = (root: string, name: string, value: unknown) => writeFileSync(path.join(root, name), JSON.stringify(value, null, 2), { flag: 'wx' });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Profile = ReturnType<typeof personalStoryEvaluationProfiles>[number];

export function trialPlan(old: FrozenEngine, current: FrozenEngine) {
  const profiles = TRIAL_PROFILES.map(id => personalStoryEvaluationProfiles().find(profile => profile.id === id)!);
  const slots: TrialSlot[] = [];
  for (const profile of profiles) {
    if (!profile || profile.split !== 'development') throw Error('trial_profile');
    for (const [arm, engine] of [['baseline', old], ['improved', current]] as const) {
      const prepared = engine.preparePersonalStory(profile.request, engine.resolvePersonalWizardOptions());
      const limits = engine.personalStoryOutputLimits(prepared.brief.beats);
      slots.push({ id: `${profile.id}/${arm}/plan`, maxOutputTokens: limits.planOutputTokens },
        { id: `${profile.id}/${arm}/manuscript`, maxOutputTokens: limits.manuscriptOutputTokens });
    }
    slots.push({ id: `${profile.id}/improved/editor`, maxOutputTokens: 12_000 + 500 * (profile.request.bookOptions.lengthId === 'short' ? 8 : profile.request.bookOptions.lengthId === 'medium' ? 12 : 16) });
  }
  const reservedUsd = slots.reduce((sum, slot) => sum + trialSlotReservation(slot), 0);
  if (slots.length !== 15 || Math.abs(reservedUsd - 4.158) > 1e-10) throw Error('trial_policy_changed');
  return { profiles, slots, reservedUsd };
}

export async function executeCohort(args: { old: FrozenEngine; current: FrozenEngine; guard: TrialFamilyGuard;
  profiles: Profile[]; root: string; key: string; signal: AbortSignal }) {
  const { old, current, guard, profiles, root, key, signal } = args;
  const manifest = { version: 'personal-story-comparison/offline-v1' as const, seed: randomBytes(24).toString('hex'),
    baselineCommit: TRIAL_BASELINE, improvedCommit: TRIAL_CURRENT,
    cases: profiles.map(profile => ({ id: profile.id, split: profile.split, registeredRequest: profile.request,
      baselineDraft: null as null | unknown, baselineEdited: null, improvedDraft: null as null | unknown, improvedEdited: null as null | unknown })) };
  const drafts = new Map<string, { prepared: PreparedStory; result: PersonalStoryResult }>();
  const tracked = async (id: string, call: StoryCall | StoryEditorCall, generate: (s: AbortSignal) => Promise<{ output: unknown; usage: PersonalStoryResult['accounting']['usage'][number] }>, stageSignal = signal) => {
    if (stageSignal.aborted) throw Error('trial_cancelled');
    const filename = id.split('/').join('-');
    saveJson(root, `${filename}-call.json`, { kind: 'orchestrator_call_not_raw_sdk_response',
      call, instructionsSha256: hash(call.instructions), inputSha256: hash(call.input) });
    const answer = await guard.dispatch(id, call.maxOutputTokens, () => withGenerationDeadline(call.maxOutputTokens, stageSignal,
      () => Error('trial_deadline'), generate));
    saveJson(root, `${filename}-output.json`, { kind: 'adapter_normalized_output_not_raw_provider_response', ...answer });
    writeFileSync(path.join(root, 'accounting.json'), JSON.stringify(guard.snapshot(), null, 2));
    console.log(JSON.stringify({ id, status: 'completed', providerAttempts: guard.snapshot().providerAttempts,
      knownUsageEstimateUsd: guard.snapshot().knownUsageEstimateUsd }));
    return answer;
  };
  try {
    // All first drafts precede editing; alternate arm order to avoid fixed-order bias.
    for (const [index, profile] of profiles.entries()) {
      const arms = index % 2 ? ['improved', 'baseline'] as const : ['baseline', 'improved'] as const;
      for (const arm of arms) {
        const engine = arm === 'baseline' ? old : current;
        const prepared = engine.preparePersonalStory(profile.request, engine.resolvePersonalWizardOptions());
        const provider = engine.createPersonalStoryProvider(key, TRIAL_MODEL);
        try {
          const result = await engine.writePersonalStory({ prepared, userId: 'synthetic_matched_trial', jobId: `${profile.id}_${arm}`,
            ledger: new engine.IntakeLedger(), settings: { model: TRIAL_MODEL, budgetUsd: 5, maxJobs: 1, operators: new Set() }, signal,
            provider: () => ({ generate: (call, stageSignal) => tracked(`${profile.id}/${arm}/${call.stage}`, call, s => provider.generate(call, s), stageSignal) }) });
          const artifact = { sourceCommit: arm === 'baseline' ? TRIAL_BASELINE : TRIAL_CURRENT, reasoning: 'medium', request: profile.request, result };
          saveJson(root, `${profile.id}-${arm}-draft.json`, artifact);
          manifest.cases[index][arm === 'baseline' ? 'baselineDraft' : 'improvedDraft'] = artifact;
          if (arm === 'improved') drafts.set(profile.id, { prepared, result });
        } catch (error) {
          const held = error as { code?: unknown; planningResult?: unknown };
          if (arm !== 'improved' || held?.code !== 'story_outline_held' || guard.snapshot().stopped) throw error;
          const diagnostic = assertStoryPlanningHoldBinding(prepared, held.planningResult);
          saveJson(root, `${profile.id}-improved-held.json`, { request: profile.request, result: diagnostic,
            kind: 'plan_only_hold_not_manuscript', sourceCommit: TRIAL_CURRENT });
          console.log(JSON.stringify({ id: profile.id, status: 'planning_held', manuscriptAndEditorSkipped: true }));
        }
      }
    }
    const editor = current.createStoryEditorProvider!(key, TRIAL_MODEL);
    for (const [index, profile] of profiles.entries()) {
      const draft = drafts.get(profile.id); if (!draft) continue;
      const call = current.prepareStoryEdit!(draft.prepared, draft.result);
      const answer = await tracked(`${profile.id}/improved/editor`, call, s => editor.generate(call, s));
      const result = current.compileStoryEdit!(draft.prepared, draft.result, answer.output, answer.usage);
      const artifact = { sourceCommit: TRIAL_CURRENT, reasoning: 'medium', request: profile.request, result };
      saveJson(root, `${profile.id}-improved-edited.json`, artifact);
      manifest.cases[index].improvedEdited = artifact;
      console.log(JSON.stringify({ id: profile.id, status: current.editorNeedsWork!(result) ? 'editorial_held' : 'pending_product_review' }));
    }
    return { outcome: 'completed_measurement', manuscriptCount: manifest.cases.reduce((sum, row) => sum + Number(Boolean(row.baselineDraft)) + Number(Boolean(row.improvedDraft)), 0) };
  } finally {
    saveJson(root, 'manifest.json', manifest);
    const pack = buildStoryComparison(manifest, current.resolvePersonalWizardOptions());
    saveJson(root, 'private-evidence.json', pack.privateEvidence);
    for (const phase of STORY_REVIEW_PHASES) {
      const phaseRoot = path.join(root, `review-${phase}`); mkdirSync(phaseRoot);
      saveJson(phaseRoot, 'review.json', storyReviewPacket(pack.blind, phase));
      writeFileSync(path.join(phaseRoot, 'index.html'), renderBlindStoryComparison(pack.blind, phase), { flag: 'wx' });
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length && !(argv.length === 3 && argv[0] === '--execute' && argv[1] === '--env-file' && argv[2])) throw Error('trial_arguments');
  const old = await loadFrozenStoryEngine(trialRepo, TRIAL_BASELINE, false);
  const current = await loadFrozenStoryEngine(trialRepo, TRIAL_CURRENT, true);
  const plan = trialPlan(old.engine, current.engine);
  const root = path.join(trialRepo, 'outputs', TRIAL_FAMILY);
  const provenance = { baseline: old.evidence, current: current.evidence, model: TRIAL_MODEL, reasoning: 'medium',
    profiles: plan.profiles.map(({ id }) => id), noImagesOrAudio: true };
  if (!argv.length) {
    console.log(JSON.stringify({ dryRun: true, ...provenance, reservedUsd: plan.reservedUsd, maxProviderAttempts: 15,
      budgetUsd: 5, output: root, providerAttempts: 0, keyReads: 0, writes: 0 })); return;
  }
  const common = gitAt(trialRepo, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  const guard = TrialFamilyGuard.claim(common, root, plan.slots, provenance);
  const controller = new AbortController(); const abort = () => controller.abort(); process.once('SIGINT', abort);
  let terminal = 'trial_setup_failed';
  try {
    saveJson(root, 'source-freeze.json', provenance);
    writeFileSync(path.join(root, 'baseline-engine.cjs'), old.bundle, { flag: 'wx' });
    writeFileSync(path.join(root, 'current-engine.cjs'), current.bundle, { flag: 'wx' });
    const text = readFileSync(path.resolve(argv[2]), 'utf8');
    const lines = text.split(/\r?\n/u).filter(line => /^\s*OPENAI_API_KEY\s*=/u.test(line));
    const key = lines.length === 1 ? parseEnv(lines[0]).OPENAI_API_KEY : null;
    if (!key) throw Error('trial_key_unavailable');
    const result = await executeCohort({ old: old.engine, current: current.engine, guard, profiles: plan.profiles, root, key, signal: controller.signal });
    terminal = 'trial_complete'; saveJson(root, 'result.json', result);
    console.log(JSON.stringify({ ...result, root, ...guard.snapshot() }));
  } catch (error) {
    terminal = 'trial_failed';
    saveJson(root, 'failure.json', { diagnostic: trialFailureDiagnostic(error), noRetry: true });
    throw Error('trial_failed');
  } finally {
    process.removeListener('SIGINT', abort); guard.stop(terminal);
    writeFileSync(path.join(root, 'accounting.json'), JSON.stringify(guard.snapshot(), null, 2));
  }
}
if (require.main === module) main().catch(error => { console.error(/^trial_[a-z_]+$/.test(error?.message ?? '') ? error.message : 'trial_failed'); process.exitCode = 1; });
