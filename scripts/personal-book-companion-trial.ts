/** Fixed owner-approved local diagnostic. Dry by default. No render/audio/routes. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseEnv } from 'dotenv';
import { companionTrialCohort } from './personal-book-companion-cohort';
import { loadFrozenBookEngine, gitAt, type FrozenBookEngine } from './personal-story-frozen-engine';
import { BookTrialGuard, BOOK_TRIAL_FAMILY, BOOK_TRIAL_MODEL, BOOK_TRIAL_STAGES, assertBookTrialSlots, bookSlotReservation, type BookTrialSlot } from './personal-book-companion-trial-guard';
import type { PersonalBookProvider } from '../lib/personal-wizard/book-runner';

const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const save = (root: string, name: string, data: unknown) => writeFileSync(path.join(root, name), JSON.stringify(data, null, 2), { flag: 'wx' });
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function bookTrialPlan(engine: FrozenBookEngine, repo: string) {
  const options = engine.resolvePersonalWizardOptions(repo), cases = companionTrialCohort();
  const slots: BookTrialSlot[] = [], reserves: number[] = [];
  for (const row of cases) {
    const prepared = engine.preparePersonalStory(row.request, options), spreads = prepared.brief.beats;
    const story = engine.personalStoryOutputLimits(spreads), visual = engine.personalBookOutputLimits(spreads);
    const caps = [story.planOutputTokens, story.manuscriptOutputTokens, engine.storyEditorOutputTokens(spreads), visual.storyboardOutputTokens, visual.reviewOutputTokens];
    BOOK_TRIAL_STAGES.forEach((stage, i) => slots.push({ caseId: row.id, stage, maxOutputTokens: caps[i], inputCeiling: i < 3 ? 64_000 : engine.BOOK_LIMITS.inputBytesPerCall }));
    reserves.push(engine.personalBookReservationUsd(BOOK_TRIAL_MODEL, spreads));
  }
  assertBookTrialSlots(slots);
  if (reserves.some((reserve, i) => Math.abs(reserve - slots.slice(i * 5, (i + 1) * 5).reduce((sum, slot) => sum + bookSlotReservation(slot), 0)) > 1e-10)) throw Error('book_trial_policy_changed');
  return { cases, options, slots, reserves };
}

export async function executeBookTrial(args: { engine: FrozenBookEngine; plan: ReturnType<typeof bookTrialPlan>; guard: BookTrialGuard;
  root: string; key: string; signal: AbortSignal; providerFactory?: () => PersonalBookProvider }) {
  const { engine, plan, guard, root, key, signal } = args;
  const outcomes: { id: string; status: string; title: string | null }[] = [];
  try {
    for (const [index, row] of plan.cases.entries()) {
      if (guard.snapshot().sealed) break;
      if (signal.aborted) throw Error('book_trial_cancelled');
      save(root, `${row.id}-request.json`, row.request);
      const prepared = engine.preparePersonalStory(row.request, plan.options);
      save(root, `${row.id}-character.json`, prepared.brief.companion);
      const provider = args.providerFactory?.() ?? engine.createPersonalBookProvider(key, BOOK_TRIAL_MODEL);
      const track = async (call: Parameters<PersonalBookProvider['story']['generate']>[0] | Parameters<PersonalBookProvider['editor']['generate']>[0] | Parameters<PersonalBookProvider['visual']['generate']>[0],
        stageSignal: AbortSignal, run: () => ReturnType<PersonalBookProvider['story']['generate']>) => {
        if (stageSignal.aborted || signal.aborted) throw Error('book_trial_cancelled');
        const id = `${row.id}-${call.stage}`;
        save(root, `${id}-call.json`, { kind: 'orchestrator_call_not_raw_sdk_response', call,
          inputSha: hash(call.input), instructionsSha: hash(call.instructions) });
        const abortStage = () => guard.stop('book_trial_cancelled');
        stageSignal.addEventListener('abort', abortStage, { once: true });
        let answer;
        try {
          if (stageSignal.aborted) { abortStage(); throw Error('book_trial_cancelled'); }
          answer = await guard.dispatch(row.id, call, async () => {
            const response = await run();
            if (signal.aborted || stageSignal.aborted || guard.snapshot().sealed) throw Error('book_trial_cancelled');
            // Preserve even an unknown-usage/malformed output before validation fails.
            try { save(root, `${id}-output.json`, { kind: 'adapter_normalized_output_not_raw_sdk_response', ...response }); }
            catch { throw Object.assign(Error('book_trial_output_failed'), { providerUsage: response.usage }); }
            return response;
          });
        } finally { stageSignal.removeEventListener('abort', abortStage); }
        console.log(JSON.stringify({ caseId: row.id, stage: call.stage, status: 'completed',
          attempts: guard.snapshot().providerAttempts, knownUsageEstimateUsd: guard.snapshot().knownUsageEstimateUsd }));
        return answer;
      };
      const wrapped: PersonalBookProvider = {
        story: { generate: (call, s) => track(call, s, () => provider.story.generate(call, s)) },
        editor: { generate: (call, s) => track(call, s, () => provider.editor.generate(call, s)) },
        visual: { generate: (call, s) => track(call, s, () => provider.visual.generate(call, s)) },
      };
      try {
        const result = await engine.generatePersonalBook({ request: row.request, options: plan.options, userId: 'synthetic_companion_cohort',
          operatorEmail: 'synthetic@trial.invalid', jobId: `j_companiontrial0${index + 1}`, scope: 'storyboard',
          settings: { model: BOOK_TRIAL_MODEL, budgetUsd: plan.reserves[index], maxJobs: 1, operators: new Set(['synthetic@trial.invalid']) },
          ledger: new engine.IntakeLedger(), signal, provider: () => wrapped });
        save(root, `${row.id}-result.json`, result);
        // Restore authority in the SAME frozen module, not by JSON-casting a WeakMap-origin book.
        const rawDraft = JSON.parse(readFileSync(path.join(root, `${row.id}-storyboard-output.json`), 'utf8')).output;
        const rawReview = JSON.parse(readFileSync(path.join(root, `${row.id}-review-output.json`), 'utf8')).output;
        const source = engine.preparePersonalStoryboard(row.request, result.writerResult, plan.options);
        const restored = engine.compilePersonalStoryboard(source, rawDraft);
        const reviewed = engine.storyboardReviewDisposition(restored, rawReview);
        if (restored.sourceDigest !== result.storyboard.sourceDigest || restored.storyboardDigest !== result.storyboard.storyboardDigest ||
            JSON.stringify(reviewed) !== JSON.stringify(result.review)) throw Error('book_trial_replay_mismatch');
        if (result.status === 'review_supported') {
          const restoredPackets = Array.from({ length: restored.narrativeSpreads + 1 }, (_, n) => engine.personalStoryboardFrame(restored, rawReview, n,
            { request: row.request, writerResult: result.writerResult, options: plan.options }));
          if (JSON.stringify(restoredPackets) !== JSON.stringify(result.framePackets)) throw Error('book_trial_replay_mismatch');
        }
        save(root, `${row.id}-replay.json`, { verified: true, sourceDigest: restored.sourceDigest, storyboardDigest: restored.storyboardDigest,
          framePackets: result.framePackets.length, providerCalls: 0, runtimeEligible: false });
        guard.finishCase(row.id, result.status === 'review_supported' ? 'completed' : 'held');
        outcomes.push({ id: row.id, status: result.status, title: result.writerResult.manuscript.title });
      } catch (error) {
        const held = error instanceof engine.PersonalBookPlanningHeldError;
        const editedHold = error instanceof engine.PersonalBookError && error.code === 'book_editorial_held';
        if ((!held && !editedHold) || guard.snapshot().sealed) {
          guard.stop('book_trial_failed');
          save(root, `${row.id}-failed.json`, { status: 'technical_failure', writerResult: error instanceof engine.PersonalBookError ? error.writerResult ?? null : null });
          outcomes.push({ id: row.id, status: 'technical_failure', title: null });
          throw error;
        }
        save(root, `${row.id}-held.json`, held ? { status: 'book_outline_held', planningResult: error.planningResult, accounting: error.accounting }
          : { status: 'book_editorial_held', writerResult: error.writerResult, accounting: error.accounting });
        guard.finishCase(row.id, 'held'); outcomes.push({ id: row.id, status: held ? 'book_outline_held' : 'book_editorial_held', title: null });
      }
    }
    return outcomes;
  } finally { save(root, 'outcomes.json', outcomes); }
}

export function renderBookTrial(root: string) {
  const bodies = companionTrialCohort().map(row => {
    const records: Record<string, any> = {};
    for (const suffix of ['failed', 'held', 'result']) { try { records[suffix] = JSON.parse(readFileSync(path.join(root, `${row.id}-${suffix}.json`), 'utf8')); } catch { /* unavailable */ } }
    const result = records.failed ?? records.held ?? records.result;
    // Terminal failure wins the label; earlier valid prose remains inspectable.
    const writer = result?.writerResult ?? records.result?.writerResult;
    return `<section id="${row.id}"><h2>${escape(row.request.child.name)} · ${escape(row.request.companion.id)}</h2><p>${escape(result?.status ?? 'לא נוצר')}</p>` +
      (writer ? `<h3>${escape(writer.manuscript.title)}</h3>${writer.manuscript.pages.map((p: any) => `<article><h4>כפולה ${p.pageNumber}</h4><p>${escape(p.text)}</p></article>`).join('')}` : '<p>אין סיפור מלא. ראיות חלקיות נשמרו.</p>') + '</section>';
  }).join('');
  return `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>שישה סיפורים אישיים · ניסוי מנוע</title><style>body{margin:auto;max-width:780px;padding:24px;background:#fffaf1;color:#302b24;font:20px/1.8 Arial}article{padding:14px;border-top:1px solid #ddd}section{margin-bottom:64px}p{white-space:pre-wrap}</style><h1>ניסוי סיפורים אישיים</h1><p>פרופילים סינתטיים. טקסט וסטוריבורד בלבד, ללא איורים. שיפוט המודל אינו קבלת מוצר.</p>${bodies}</html>`;
}

export function bookTrialTerminal(outcomes: { status: string }[], snapshot: ReturnType<BookTrialGuard['snapshot']>) {
  if (snapshot.terminalReason) return snapshot.terminalReason;
  if (outcomes.length !== 6) return 'book_trial_incomplete';
  return outcomes.every(row => row.status === 'review_supported') ? 'book_trial_complete' : 'book_trial_completed_with_holds';
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length && !(argv.length === 3 && argv[0] === '--execute' && argv[1] === '--env-file' && argv[2])) throw Error('book_trial_arguments');
  if (process.env.OPENAI_BASE_URL && process.env.OPENAI_BASE_URL.replace(/\/$/u, '') !== 'https://api.openai.com/v1') throw Error('book_trial_endpoint');
  const repo = path.resolve(__dirname, '..');
  if (gitAt(repo, ['status', '--porcelain']).length) throw Error('book_trial_source_dirty');
  const commit = gitAt(repo, ['rev-parse', 'HEAD']).toString().trim();
  const loaded = await loadFrozenBookEngine(repo, commit), plan = bookTrialPlan(loaded.engine, repo);
  const root = path.join(repo, 'outputs', BOOK_TRIAL_FAMILY);
  const provenance = { engine: loaded.evidence, modelRequested: BOOK_TRIAL_MODEL, reasoning: 'medium',
    cases: plan.cases, slots: plan.slots, harnessSourceSha256: Object.fromEntries([
      'scripts/personal-book-companion-trial.ts', 'scripts/personal-book-companion-trial-guard.ts',
      'scripts/personal-book-companion-cohort.ts', 'scripts/personal-story-frozen-engine.ts', 'scripts/personal-story-trial-guard.ts',
    ].map(file => [file, hash(gitAt(repo, ['show', `${commit}:${file}`]))])), noImagesOrAudio: true };
  if (!argv.length) { console.log(JSON.stringify({ dryRun: true, commit, root, cases: plan.cases.map(row => row.id),
    reserveUsd: 14.4716, budgetUsd: 15, maxProviderAttempts: 30, keyReads: 0, writes: 0, providerCalls: 0 })); return; }
  const common = gitAt(repo, ['rev-parse', '--path-format=absolute', '--git-common-dir']).toString().trim();
  const guard = BookTrialGuard.claim(common, root, plan.slots, provenance), controller = new AbortController();
  const abort = () => { controller.abort(); guard.stop('book_trial_cancelled'); };
  process.once('SIGINT', abort); let terminal = 'book_trial_failed';
  try {
    save(root, 'source-freeze.json', provenance); writeFileSync(path.join(root, 'engine.cjs'), loaded.bundle, { flag: 'wx' });
    const lines = readFileSync(path.resolve(argv[2]), 'utf8').split(/\r?\n/u).filter(line => /^\s*OPENAI_API_KEY\s*=/u.test(line));
    const key = lines.length === 1 ? parseEnv(lines[0]).OPENAI_API_KEY : null;
    if (!key) throw Error('book_trial_key_unavailable');
    const outcomes = await executeBookTrial({ engine: loaded.engine, plan, guard, root, key, signal: controller.signal });
    terminal = bookTrialTerminal(outcomes, guard.snapshot());
  } catch (error) {
    const code = error instanceof loaded.engine.PersonalBookError && /^book_[a-z_]+$/.test(error.code) ? error.code : error instanceof Error && /^book_trial_[a-z_]+$/.test(error.message) ? error.message : 'book_trial_failed';
    save(root, 'failure.json', { code, noRetry: true, partialWriterResult: error instanceof loaded.engine.PersonalBookError ? error.writerResult ?? null : null });
  } finally {
    process.removeListener('SIGINT', abort); guard.stop(terminal);
    terminal = guard.snapshot().terminalReason ?? terminal;
    save(root, 'accounting.json', guard.snapshot()); writeFileSync(path.join(root, 'index.html'), renderBookTrial(root), { flag: 'wx' });
    save(root, 'files.json', readdirSync(root).map(name => ({ name, bytes: statSync(path.join(root, name)).size, sha: hash(readFileSync(path.join(root, name))) })));
    console.log(JSON.stringify({ root, terminal, ...guard.snapshot() }));
    if (terminal !== 'book_trial_complete') process.exitCode = 2;
  }
}
if (require.main === module) main().catch(() => { console.error('book_trial_failed'); process.exitCode = 1; });
