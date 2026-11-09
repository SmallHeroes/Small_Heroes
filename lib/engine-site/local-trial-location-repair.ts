/** ONE explicitly owner-authorized locations edit after a fully settled native sheet HOLD. */
import 'server-only';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { canonicalHash } from '@/lib/canonical-json';
import { auditionUsageCost } from '@/scripts/personal-simple-book-illustrator';
import { LOCATION_SHEET_PROJECTION } from '@/lib/personal-wizard/location-sheet-projection';
import type { AuditionAttempt } from '@/lib/personal-wizard/simple-book-reviewed-audition';
import type { LocalEngineGrant } from '@/scripts/engine-local-book';
import { engineSiteFail, type EngineOrderAuthority } from './contract';
import { parseEngineCheckpoint, type EngineRuntime } from './durable-worker';
import { assertLocalParentEvidence, readLocalSettledJournal } from './local-trial-continuation';
import { localChildBindingSteps, replayLocalChildBinding, type LocalChildBindingEnvelope } from './local-trial-child-binding';
import { ENGINE_RESPONSE_SCHEMA_POLICY } from './response-schema';
import { ENGINE_STORYBOARD_BINDING, ENGINE_BOUND_REVIEW_STEP } from './storyboard-binding-policy';
import { createEngineNativeRecipe, type EngineNativeSheetObservation } from './native-recipe';
import type { AdmittedEngineInitialPreparation } from './story-preparation';
import type { LocalEngineTrialRuntime, LocalTrialDispatchWitness } from './local-trial-runtime';

type Snapshot = Parameters<typeof createEngineNativeRecipe>[0]['snapshot'];
const digest = z.string().regex(/^[a-f0-9]{64}$/), ref = z.object({ file: z.string().refine(path.isAbsolute), sha256: digest }).strict();
export const localLocationRepairSchema = z.object({ version: z.literal('engine-local-locations-repair/v1'),
  parentGrant: ref, parentStop: ref, parentExit: ref, parentEvidence: ref, parentClaimSha256: digest,
  ownerAttemptAuthority: ref, boundary: z.literal('one_locations_repair_then_media') }).strict();
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function bytes(file: string) {
  const s = lstatSync(file);
  if (!s.isFile() || s.isSymbolicLink() || realpathSync(file) !== file || s.size > 64 * 1024 * 1024 || /(^|[\\/])\.env(?:\.|$)/i.test(file)) engineSiteFail('local_locations_file');
  return readFileSync(file);
}
const json = (file: string) => JSON.parse(bytes(file).toString('utf8'));
const denied = (): never => engineSiteFail('local_locations_replay_dispatch_forbidden');
const oldSteps = [ENGINE_BOUND_REVIEW_STEP, 'sheet_entities_0', 'sheet_entities_0_qa', 'sheet_locations_0', 'sheet_locations_0_qa'];
export function localLocationRepairSteps() {
  return [{ id: 'sheet_locations_1', maximumMicroUsd: 650_000 }, { id: 'sheet_locations_1_qa', maximumMicroUsd: 750_000 },
    ...localChildBindingSteps().filter(s => s.id !== ENGINE_BOUND_REVIEW_STEP && !s.id.startsWith('sheet_'))];
}
export function assertLocalLocationRepairEvidence(spec: z.infer<typeof localLocationRepairSchema>) {
  const s = localLocationRepairSchema.parse(spec);
  if (sha(bytes(s.ownerAttemptAuthority.file)) !== s.ownerAttemptAuthority.sha256) engineSiteFail('local_locations_owner_authority');
  z.object({ oneLocationsRepairOnly: z.literal(true), maximumNewReferenceCalls: z.literal(2), maximumNewReferenceReservedMicroUsd: z.literal(1_400_000),
    maximumTotalMicroUsd: z.literal(10_000_000), maximumTotalCalls: z.literal(121), independentCodeAndExactEnvelopePASSRequired: z.literal(true) }).passthrough().parse(json(s.ownerAttemptAuthority.file));
  return assertLocalParentEvidence({ version: 'engine-local-initial-hold-continuation/v1', parentGrant: s.parentGrant, parentStop: s.parentStop, parentExit: s.parentExit, parentEvidence: s.parentEvidence });
}
const envelopes = new WeakSet<object>();
export function loadLocalLocationRepair(g: LocalEngineGrant, parent: LocalEngineGrant, child: LocalChildBindingEnvelope, parentAuthority: EngineOrderAuthority, masterFile: string) {
  const spec = localLocationRepairSchema.parse(g.locationsRepairContinuation);
  if (g.continuation || g.planningRecovery || g.mediaContinuation || g.childBindingContinuation || g.locationsV2RepairContinuation || !parent.childBindingContinuation || parent.locationsRepairContinuation || parent.locationSheetPolicy !== undefined ||
      g.locationSheetPolicy !== LOCATION_SHEET_PROJECTION || g.storyboardBindingPolicy !== ENGINE_STORYBOARD_BINDING || g.responseSchemaPolicy !== ENGINE_RESPONSE_SCHEMA_POLICY ||
      canonicalHash(json(spec.parentGrant.file)) !== canonicalHash(parent) || g.approvalReference !== parent.approvalReference || g.approvedBy !== parent.approvedBy || g.approvedAt !== parent.approvedAt ||
      canonicalHash(g.profile) !== canonicalHash(parent.profile) || canonicalHash(g.credentials) !== canonicalHash(parent.credentials) || g.readerId !== parent.readerId || g.source.root !== parent.source.root ||
      g.maximumMicroUsd !== parent.maximumMicroUsd || g.maximumCalls !== parent.maximumCalls || canonicalHash(parentAuthority.budget.steps) !== canonicalHash(localChildBindingSteps())) engineSiteFail('local_locations_scope');
  const normalized = (s: string) => path.resolve(s).toLowerCase(), destination = normalized(g.directory);
  if (path.resolve(g.directory) !== g.directory || [parent.directory, child.parent.directory, child.media.parent.directory, child.media.recovery.failed.directory, child.media.recovery.parent.parent.directory]
      .some(d => { const old = normalized(d); return destination === old || destination.startsWith(old + path.sep) || old.startsWith(destination + path.sep); })) engineSiteFail('local_locations_scope');
  const { root } = assertLocalLocationRepairEvidence(spec), stop = json(spec.parentStop.file), exit = json(spec.parentExit.file), running = json(path.join(root, 'RUNNING.json'));
  if (root !== parent.directory || path.dirname(spec.parentStop.file) !== root || stop.version !== 'engine-local-book-stop/v1' || stop.reason !== 'engine_reference_sheet_held' || stop.phase !== 'native' || stop.grantSha256 !== spec.parentGrant.sha256 ||
      exit.code !== 1 || exit.signal !== null || exit.errorCode !== undefined || exit.outcomeExists !== false || !Number.isSafeInteger(exit.childPid) || exit.childPid < 1 || running.pid !== exit.childPid || running.grantSha256 !== spec.parentGrant.sha256 || existsSync(path.join(root, 'OUTCOME.json'))) engineSiteFail('local_locations_terminal');
  try { process.kill(exit.childPid, 0); engineSiteFail('local_locations_process_alive'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e; }
  const checkpoint = parseEngineCheckpoint({ engineSite: json(path.join(root, 'journal/checkpoint.json')) });
  if (canonicalHash(checkpoint.authority) !== canonicalHash(parentAuthority) || checkpoint.phase !== 'native' || checkpoint.snapshotSha256 !== child.checkpoint.snapshotSha256 || checkpoint.ownerId !== child.checkpoint.ownerId ||
      checkpoint.draftId !== child.checkpoint.draftId || canonicalHash(Object.keys(checkpoint.outputs)) !== canonicalHash(['prepared_source'])) engineSiteFail('local_locations_authority');
  const journal = readLocalSettledJournal(root, checkpoint, oldSteps, new Set(oldSteps), (step, r) => {
    const raw = r.raw as any;
    return ['sheet_entities_0', 'sheet_locations_0'].includes(step) ? r.model === 'gpt-image-2' ? auditionUsageCost(raw.usage, 'image') : null :
      raw.model === 'gpt-6.1-sol' && raw.service_tier === 'default' ? auditionUsageCost(raw.usage, 'sol') : null;
  });
  if (canonicalHash(json(path.join(root, 'journal/carry.json'))) !== canonicalHash(child.carried)) engineSiteFail('local_locations_carry');
  const known = child.carried.accountedMicroUsd + journal.known, calls = child.carried.logicalCalls + journal.results.size, m = stop.meter;
  if (!Number.isSafeInteger(known) || known >= g.maximumMicroUsd || calls >= g.maximumCalls || m?.accountedMicroUsd !== known || m?.knownEstimateMicroUsd !== known || m?.logicalCalls !== calls ||
      m?.carriedMicroUsd !== child.carried.accountedMicroUsd || m?.carriedCalls !== child.carried.logicalCalls || m?.pendingCalls !== 0 || m?.unknownCalls !== 0 || m?.failedCalls !== 0 || m?.overReservedCalls !== 0 || m?.lostLocalCalls !== 0 || m?.blocked !== false) engineSiteFail('local_locations_meter');
  const parentBinding = { version: 'engine-local-book-claim/v1', grantFile: spec.parentGrant.file, grantSha256: spec.parentGrant.sha256, authoritySha256: canonicalHash(parentAuthority), directory: parent.directory, sourceRoot: parent.source.root,
    childBindingContinuation: parent.childBindingContinuation, carried: child.carried, boundary: 'bound_media_only' };
  const checkClaims = () => {
    child.checkClaims(); assertLocalLocationRepairEvidence(spec);
    if (sha(bytes(masterFile + '.child-binding-v1.json')) !== spec.parentClaimSha256 || canonicalHash(json(masterFile + '.child-binding-v1.json')) !== canonicalHash(parentBinding)) engineSiteFail('local_locations_claim_chain');
    for (const [step, { claim }] of journal.claims) {
      const wanted = { version: 'engine-local-child-binding-dispatch/v1', executionSha256: canonicalHash(parentBinding), authoritySha256: canonicalHash(parentAuthority), step, claimSha256: canonicalHash(claim), maximumMicroUsd: claim.call.maximumMicroUsd };
      if (canonicalHash(json(masterFile + '.child-binding-v1.' + step + '.dispatch.json')) !== canonicalHash(wanted)) engineSiteFail('local_locations_claim_chain');
    }
  };
  checkClaims(); const carried = Object.freeze({ accountedMicroUsd: known, logicalCalls: calls, evidenceSha256: canonicalHash({ spec, parentCarry: child.carried }) });
  const value = Object.freeze({ spec, parent, child, parentAuthority, checkpoint, journal, carried, checkClaims, masterFile }); envelopes.add(value); return value;
}
export type LocalLocationRepairEnvelope = ReturnType<typeof loadLocalLocationRepair>;
export type AdmittedEngineLocationRepairPreparation = { readonly prepared: any; readonly initialPreparation: AdmittedEngineInitialPreparation;
  readonly entities: EngineNativeSheetObservation; readonly locations: EngineNativeSheetObservation; readonly origin: unknown };
const preparations = new WeakMap<object, { sha256: string; authoritySha256: string; ownerId: string; draftId: string; snapshotSha256: string; checkClaims: () => void }>();
/** A review error, missing binding or safety hold is never a repairable visual defect. */
export function locationRepairFindings(attempt: AuditionAttempt) {
  const a = attempt.assessment;
  if (attempt.attempt !== 0 || attempt.status !== 'held' || !attempt.candidate || !attempt.review || !a || a.invalidCitations || a.safetyBlocked) engineSiteFail('local_locations_not_repairable');
  const findings = a.findings.filter(f => f.impact !== 'detail');
  if (!findings.length || findings.some(f => !f.bound || f.impact === 'safety')) engineSiteFail('local_locations_not_repairable');
  return findings;
}
function assertScope(authority: EngineOrderAuthority) {
  if (authority.purpose !== 'test' || authority.locationSheetPolicy !== LOCATION_SHEET_PROJECTION || authority.storyboardBindingPolicy !== ENGINE_STORYBOARD_BINDING || authority.responseSchemaPolicy !== ENGINE_RESPONSE_SCHEMA_POLICY ||
      canonicalHash(authority.budget.steps) !== canonicalHash(localLocationRepairSteps())) engineSiteFail('local_locations_scope');
}
export function assertEngineLocationRepairPreparation(cap: AdmittedEngineLocationRepairPreparation, authority: EngineOrderAuthority, checkpoint: Pick<EngineRuntime['checkpoint'], 'ownerId' | 'draftId'>, cached?: any, snapshot?: Snapshot) {
  assertScope(authority); const r = preparations.get(cap);
  if (!r || r.sha256 !== canonicalHash(cap) || r.authoritySha256 !== canonicalHash(authority) || r.ownerId !== checkpoint.ownerId || r.draftId !== checkpoint.draftId || (snapshot && r.snapshotSha256 !== canonicalHash(snapshot))) engineSiteFail('local_locations_preparation_changed');
  r.checkClaims(); if (cached && canonicalHash(cached) !== canonicalHash(cap.prepared)) engineSiteFail('local_locations_cache_changed');
}
/** All19 paid operations, including the truthful held sheet, are replayed under their ORIGINAL authorities. */
export async function replayLocalLocationRepair(chain: LocalLocationRepairEnvelope, snapshot: Snapshot, authority: EngineOrderAuthority) {
  assertScope(authority);
  if (!envelopes.has(chain) || authority.orderId !== chain.parentAuthority.orderId || authority.requestSha256 !== chain.parentAuthority.requestSha256 || authority.optionsSha256 !== chain.parentAuthority.optionsSha256 ||
      authority.budget.maximumMicroUsd !== chain.parentAuthority.budget.maximumMicroUsd || authority.budget.maximumCalls !== chain.parentAuthority.budget.maximumCalls) engineSiteFail('local_locations_scope');
  chain.checkClaims(); const old = await replayLocalChildBinding(chain.child, snapshot, chain.parentAuthority), used = new Set<string>(), observations: EngineNativeSheetObservation[] = [];
  let prepared: any, stopped = '';
  const runtime: EngineRuntime = { checkpoint: { ...structuredClone(chain.checkpoint), phase: 'story' }, signal: new AbortController().signal, check: chain.checkClaims, load: async () => null, result: denied,
    async save(name, value) { if (name !== 'prepared_source' || prepared || canonicalHash(value) !== canonicalHash(chain.journal.asset(chain.checkpoint.outputs.prepared_source))) engineSiteFail('local_locations_replay_output'); prepared = structuredClone(value); },
    async advance(phase) { if (phase !== 'native') engineSiteFail('local_locations_replay_output'); runtime.checkpoint.phase = phase; },
    async call(plan) { chain.checkClaims(); plan.revalidate?.(); const saved = chain.journal.claims.get(plan.call.step), r = chain.journal.results.get(plan.call.step);
      if (used.has(plan.call.step) || !saved || !r || !plan.admitSaved || canonicalHash(saved.claim.call) !== canonicalHash(plan.call) || canonicalHash(plan.wire) !== saved.claim.call.wireSha256) engineSiteFail('local_locations_wire');
      await plan.admitSaved(r); chain.checkClaims(); used.add(plan.call.step); return r; } };
  try { await createEngineNativeRecipe({ db: new Proxy({}, { get: denied }) as PrismaClient, storage: { put: denied, read: denied, sign: denied }, snapshot,
    childBindingPreparation: old, initialPreparation: old.initialPreparation, ports: { fetch: denied, openAIKey: denied, anthropicKey: denied, image: denied },
    observeReferenceSheet(value) { observations.push(value); } })(runtime); } catch (e) { stopped = e && typeof e === 'object' && 'code' in e ? String(e.code) : e instanceof Error ? e.message : ''; }
  if (stopped !== 'engine_reference_sheet_held' || !prepared || observations.length !== 2 || observations[0].role !== 'entities' || observations[0].attempt.status !== 'qa_supported' || observations[1].role !== 'locations' ||
      canonicalHash([...used].sort()) !== canonicalHash([...chain.journal.results.keys()].sort())) engineSiteFail('local_locations_replay_changed');
  locationRepairFindings(observations[1].attempt);
  const origin = { version: 'engine-locations-repair-parent/v1', parentGrantSha256: chain.spec.parentGrant.sha256, parentEvidenceSha256: chain.spec.parentEvidence.sha256,
    ownerAttemptAuthoritySha256: chain.spec.ownerAttemptAuthority.sha256, carried: chain.carried, maximumNewReferenceCalls: 2, maximumNewReferenceReservedMicroUsd: 1_400_000 };
  const cap = Object.freeze({ prepared, initialPreparation: old.initialPreparation, entities: observations[0], locations: observations[1], origin });
  preparations.set(cap, { sha256: canonicalHash(cap), authoritySha256: canonicalHash(authority), ownerId: snapshot.ownerId, draftId: snapshot.request.draftId, snapshotSha256: canonicalHash(snapshot), checkClaims: chain.checkClaims });
  assertEngineLocationRepairPreparation(cap, authority, chain.checkpoint); return cap;
}
export async function preflightLocalLocationRepair(cap: AdmittedEngineLocationRepairPreparation, snapshot: Snapshot, authority: EngineOrderAuthority) {
  const sentinel = {}, plans: any[] = [], runtime: EngineRuntime = { checkpoint: { version: 'engine-site-job/v1', authority, ownerId: snapshot.ownerId, draftId: snapshot.request.draftId, snapshotSha256: authority.requestSha256, phase: 'story', calls: {}, outputs: {}, waiting: null },
    signal: new AbortController().signal, check() {}, load: async () => null, result: denied, save: async () => {}, advance: async p => { runtime.checkpoint.phase = p; },
    call: async plan => { plan.revalidate?.(); plans.push({ call: plan.call, wire: plan.wire }); throw sentinel; } };
  try { await createEngineNativeRecipe({ db: new Proxy({}, { get: denied }) as PrismaClient, storage: { put: denied, read: denied, sign: denied }, snapshot,
    locationsRepairPreparation: cap, initialPreparation: cap.initialPreparation, ports: { fetch: denied, openAIKey: denied, anthropicKey: denied, image: denied } })(runtime); } catch (e) { if (e !== sentinel) throw e; }
  if (plans.length !== 1 || plans[0].call.step !== 'sheet_locations_1') engineSiteFail('local_locations_preflight'); return plans[0];
}
export function claimLocalLocationRepairExecution(chain: LocalLocationRepairEnvelope, binding: unknown, resume: boolean) {
  if (!envelopes.has(chain)) engineSiteFail('local_locations_scope'); chain.checkClaims(); const file = chain.masterFile + '.locations-repair-v1.json';
  if (existsSync(file)) { if (!resume || canonicalHash(json(file)) !== canonicalHash(binding)) engineSiteFail('local_book_already_claimed'); }
  else { if (resume) engineSiteFail('local_book_resume_without_claim'); writeFileSync(file, JSON.stringify(binding, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } return file;
}
export function assertLocalLocationRepairResumeState(directory: string, resume: boolean) { if (resume && ['checkpoint.json', 'carry.json'].some(n => !existsSync(path.join(directory, 'journal', n)))) engineSiteFail('local_locations_resume_state_missing'); }
export function localLocationRepairDispatchWitness(chain: LocalLocationRepairEnvelope, binding: unknown, authority: EngineOrderAuthority): LocalTrialDispatchWitness {
  if (!envelopes.has(chain)) engineSiteFail('local_locations_scope'); assertScope(authority);
  const executionFile = chain.masterFile + '.locations-repair-v1.json', executionSha256 = canonicalHash(binding), authoritySha256 = canonicalHash(authority);
  if (z.object({ authoritySha256: digest }).passthrough().parse(binding).authoritySha256 !== authoritySha256) engineSiteFail('local_locations_dispatch_binding');
  const execution = () => { if (canonicalHash(json(executionFile)) !== executionSha256) engineSiteFail('local_locations_dispatch_binding'); }; execution();
  const schema = z.object({ version: z.literal('engine-local-locations-repair-dispatch/v1'), executionSha256: digest, authoritySha256: digest, step: z.string(), claimSha256: digest, maximumMicroUsd: z.number().int().positive() }).strict();
  const slot = (step: string) => { const s = authority.budget.steps.find(s => s.id === step); if (!s) engineSiteFail('local_locations_dispatch_binding'); return s; };
  const file = (step: string) => { slot(step); return chain.masterFile + '.locations-repair-v1.' + step + '.dispatch.json'; };
  const record = (step: string) => { execution(); const f = file(step); if (!existsSync(f)) return null; const r = schema.parse(json(f));
    if (r.executionSha256 !== executionSha256 || r.authoritySha256 !== authoritySha256 || r.step !== step || r.maximumMicroUsd !== slot(step).maximumMicroUsd) engineSiteFail('local_locations_dispatch_binding'); return r; };
  return { list: () => { chain.checkClaims(); return authority.budget.steps.map(s => record(s.id)).filter((r): r is NonNullable<typeof r> => r !== null); },
    check(step, claimSha256, dispatched) { chain.checkClaims(); const r = record(step); if (dispatched ? (!r || r.claimSha256 !== claimSha256) : r !== null) engineSiteFail('local_locations_unknown_dispatch'); },
    begin(step, claimSha256) { execution(); chain.checkClaims(); digest.parse(claimSha256); const f = file(step); if (existsSync(f)) engineSiteFail('local_locations_unknown_dispatch');
      writeFileSync(f, JSON.stringify({ version: 'engine-local-locations-repair-dispatch/v1', executionSha256, authoritySha256, step, claimSha256, maximumMicroUsd: slot(step).maximumMicroUsd }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); } };
}
export async function assertLocalLocationRepairRuntime(chain: LocalLocationRepairEnvelope, runtime: LocalEngineTrialRuntime) {
  if (!envelopes.has(chain)) engineSiteFail('local_locations_scope'); assertScope(runtime.checkpoint.authority); const m = await runtime.meter(); chain.checkClaims();
  if (m.carriedMicroUsd !== chain.carried.accountedMicroUsd || m.carriedCalls !== chain.carried.logicalCalls || m.lostLocalCalls === undefined) engineSiteFail('local_locations_carry');
  if (m.lostLocalCalls || m.blocked) engineSiteFail('local_locations_local_state_lost');
}
