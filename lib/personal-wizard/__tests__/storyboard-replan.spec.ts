import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { replanFixture, withKind, providerStoryboard, providerReview } from './storyboard-replan-fixture';
import { storyboardReviewDisposition } from '../storyboard';
import { BOOK_LIMITS } from '../book-config';
import { canonicalJson } from '../request-acceptance';
import { LANDMARK_KIND_CONTRACT_VERSION } from '../storyboard-landmark-kind';
import { CACHE_AWARE_PRICING_VERSION, CACHE_AWARE_RATES, CACHE_POLICY, cacheAwareCostMicroUsd, cacheAwareReservationMicroUsd,
  cacheAwareUsage } from '../../../scripts/personal-cache-aware-pricing';
import { REPLAN_CLAUDE_MAX, REPLAN_EXECUTABLE_FILES, readReplanGrant, replanPayloadPlan, runStoryboardReplan, ledgerSnapshotSchema,
  type ReplanParent } from '../../../scripts/personal-simple-storyboard-replan';
import { admitReplanStoryboard, assertReplanAuditionScope, auditionGrantSchema, replanFiles, AuditionMeter, PARENT_STORYBOARD_DIR, REPLAN_INDEX_FILE,
  REPLAN_INDEX_VERSION } from '../../../scripts/personal-simple-book-reviewed-audition';

const sha = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const workspace = path.resolve(__dirname, '../../..');
const usage = (input: number, write: number, read: number, output: number) => ({ input_tokens: input,
  input_tokens_details: { cached_tokens: read, cache_write_tokens: write }, output_tokens: output,
  output_tokens_details: { reasoning_tokens: Math.floor(output / 4) }, total_tokens: input + output });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('cache-aware pricing and settlement (QA F3)', () => {
  it('re-estimates the two saved Goni receipts (the recorded values stay as they were: non-cache estimates)', () => {
    const appearance = cacheAwareUsage(usage(2055, 2052, 0, 169) && { ...usage(2055, 2052, 0, 169), output_tokens_details: { reasoning_tokens: 0 } });
    const review = cacheAwareUsage({ ...usage(14360, 14357, 0, 2641), output_tokens_details: { reasoning_tokens: 431 } });
    expect(appearance).toMatchObject({ ordinaryInputTokens: 3, cacheWriteTokens: 2052, cacheReadTokens: 0 });
    expect(cacheAwareCostMicroUsd('gpt-6-astra', appearance)).toBe(34130);
    expect(cacheAwareCostMicroUsd('gpt-6.1-sol', review)).toBe(62309);
    // The recorded receipts priced every input token at the ordinary rate: 29,000 and 55,130.
    expect(2055 * 10 + 169 * 50).toBe(29000);
    expect(14360 * 2 + 2641 * 10).toBe(55130);
  });

  it('a cache read is billed at the read rate and a cache write REPLACES the ordinary rate (never both)', () => {
    const u = cacheAwareUsage(usage(1000, 300, 600, 100))!;
    expect(u).toMatchObject({ ordinaryInputTokens: 100, cacheReadTokens: 600, cacheWriteTokens: 300 });
    expect(cacheAwareCostMicroUsd('gpt-6-astra', u)).toBe((100 * 100 + 600 * 10 + 300 * 125 + 100 * 500) / 10);
    expect(cacheAwareCostMicroUsd('gpt-6.1-sol', u)).toBe((100 * 20 + 600 * 1 + 300 * 25 + 100 * 100) / 10);
    // Rounded UP to a whole micro-USD: one cached Sol token is a tenth of a micro-USD.
    expect(cacheAwareCostMicroUsd('gpt-6.1-sol', cacheAwareUsage(usage(1, 0, 1, 0)))).toBe(1);
    expect(CACHE_AWARE_RATES).toEqual({ 'gpt-6-astra': { ordinary: 100, cacheRead: 10, cacheWrite: 125, output: 500 },
      'gpt-6.1-sol': { ordinary: 20, cacheRead: 1, cacheWrite: 25, output: 100 } });
  });

  it('missing, malformed or inconsistent usage has NO known cost', () => {
    const good = usage(1000, 300, 600, 100);
    const bad: unknown[] = [null, {}, { ...good, input_tokens_details: undefined }, { ...good, input_tokens_details: { cached_tokens: 600 } },
      { ...good, input_tokens_details: { cache_write_tokens: 300 } }, { ...good, output_tokens_details: undefined }, { ...good, input_tokens: -1 },
      { ...good, output_tokens: 1.5 }, { ...good, input_tokens_details: { cached_tokens: 800, cache_write_tokens: 300 } },
      { ...good, output_tokens_details: { reasoning_tokens: 101 } }, { ...good, total_tokens: 1099 }, { ...usage(272001, 0, 0, 1) }];
    for (const raw of bad) expect(cacheAwareUsage(raw), JSON.stringify(raw)).toBeNull();
    expect(cacheAwareCostMicroUsd('gpt-6-astra', null)).toBeNull();
    expect(cacheAwareCostMicroUsd('gpt-6-astra-mini', cacheAwareUsage(good))).toBeNull();
  });

  it('reserves the worst case (every input token written to cache) plus 10%, in exact integers', () => {
    // Codex's figures: 2,354,262 + 781,001; the review's extra micro-USD was floating-point rounding (exactly 781,000).
    expect(cacheAwareReservationMicroUsd('gpt-6-astra', 43219, 32000)).toBe(2354262);
    expect(cacheAwareReservationMicroUsd('gpt-6.1-sol', 128000, 39000)).toBe(781000);
    // With the preserved parent storyboard in the planning input (measured, real book): 72,570 payload bytes.
    expect(cacheAwareReservationMicroUsd('gpt-6-astra', 72570, 32000)).toBe(2757838);
    for (const [read, write] of [[0, 0], [0, 1000], [1000, 0], [500, 500]]) {
      const cost = cacheAwareCostMicroUsd('gpt-6-astra', cacheAwareUsage(usage(1000, write, read, 500)))!;
      expect(cost).toBeLessThanOrEqual(cacheAwareReservationMicroUsd('gpt-6-astra', 1000, 500));
    }
    expect(() => cacheAwareReservationMicroUsd('gpt-6-astra-mini', 1, 1)).toThrow('cache_aware_pricing_policy');
    expect(() => cacheAwareReservationMicroUsd('gpt-6-astra', 0, 1)).toThrow('cache_aware_pricing_policy');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The real runner, rehearsed against a mocked provider (global fetch) and a synthetic parent: no key, no network.
// ---------------------------------------------------------------------------------------------------------------
const KEY = 'sk-rehearsal-not-a-provider-key';
async function setup() {
  const r = await replanFixture(), root = mkdtempSync(path.join(tmpdir(), 'replan-'));
  const bookDir = path.join(root, 'book'), visual = path.join(bookDir, PARENT_STORYBOARD_DIR);
  mkdirSync(visual, { recursive: true });
  const resultFile = path.join(visual, 'visual_simple_book_result.json'), draftFile = path.join(visual, 'owned_storyboard_draft.json');
  writeFileSync(resultFile, JSON.stringify({ synthetic: 'stand-in for the reviewed parent result' })); writeFileSync(draftFile, JSON.stringify(r.draft));
  const parent: ReplanParent = { bookDir, requestId: r.book.requestId, request: r.request, options: r.options, source: r.writerResult, book: r.book,
    rawReview: r.review, draft: r.draft, files: { result: { file: resultFile, sha256: sha(readFileSync(resultFile)) },
      draft: { file: draftFile, sha256: sha(readFileSync(draftFile)) } } };
  const plan = replanPayloadPlan(parent), evidence = path.join(root, 'ledger.json'), out = path.join(root, 'out');
  writeFileSync(evidence, JSON.stringify({ historicalRecordedEstimateMicroUsd: 7100254 }));
  const meter = new AuditionMeter(path.join(root, 'earlier-run'), 8143778, 2, 6943778);
  for (const [step, cost] of [['rejudge_0', 78238], ['rejudge_1', 78238]] as const)
    await meter.run(step, { step }, 600000, async () => ({ value: null, estimatedMicroUsd: cost, receipt: { cost } }));
  const snapshot = path.join(root, 'spend.json'); writeFileSync(snapshot, JSON.stringify(meter.snapshot(), null, 2));
  let n = 0;
  const grant = (change: (g: any) => void = () => {}) => {
    const g: any = { version: 'storyboard-replan-grant/v1', approvalReference: 'REHEARSAL ONLY: mocked provider, synthetic fixture, no spend authorised.',
      parent: { bookDir, storyboardDir: PARENT_STORYBOARD_DIR, requestId: parent.requestId, sourceDigest: r.book.sourceDigest, storyboardDigest: r.book.storyboardDigest,
        reviewDigest: storyboardReviewDisposition(r.book, r.review).reviewDigest, resultSha256: parent.files.result.sha256, draftSha256: parent.files.draft.sha256,
        savedSourceSha256: sha(canonicalJson(r.writerResult)) },
      replan: { sourceDigest: plan.sourceDigest, actorOwnedAppearance: true, landmarkKindContract: LANDMARK_KIND_CONTRACT_VERSION,
        preservation: 'storyboard-preservation/v1', moments: 'not_enabled', pairPages: [4] },
      payloads: { storyboard: { ...plan.storyboard }, review: { ...plan.review } },
      executable: { files: REPLAN_EXECUTABLE_FILES.map(p => ({ path: p, sha256: sha(readFileSync(path.join(workspace, p))) })) },
      pricing: { version: CACHE_AWARE_PRICING_VERSION, policy: CACHE_POLICY, ratesTenthMicroUsdPerToken: { 'gpt-6-astra': { ...CACHE_AWARE_RATES['gpt-6-astra'] },
        'gpt-6.1-sol': { ...CACHE_AWARE_RATES['gpt-6.1-sol'] } }, bufferPercent: 10, reservations: { ...plan.reservations } },
      ledger: { priorKnownApiMicroUsd: 7100254, snapshot: { file: snapshot, sha256: sha(readFileSync(snapshot)) },
        evidence: [{ file: evidence, sha256: sha(readFileSync(evidence)) }], note: 'historical recorded estimate (rehearsal)' },
      capMicroUsd: 7100254 + plan.reservations.storyboard + plan.reservations.review, maxCalls: 2,
      scope: { stages: ['storyboard', 'review'], retries: 0, downstream: 'none' }, out, deadlineMs: 60000, claudeMax: REPLAN_CLAUDE_MAX };
    change(g);
    const file = path.join(root, `grant-${n++}.json`); writeFileSync(file, JSON.stringify(g));
    return file;
  };
  const kindDraft = withKind(r.draft);
  return { r, root, bookDir, parent, plan, grant, out, kindDraft, snapshot };
}
type Reply = (body: any, init: RequestInit) => Response | Promise<Response>;
const respond = (body: any, output: unknown, u: unknown, extra: Record<string, unknown> = {}) => new Response(JSON.stringify({ id: 'resp_rehearsal',
  object: 'response', created_at: 0, status: 'completed', model: body.model, service_tier: 'default',
  output: [{ id: 'msg_1', type: 'message', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: typeof output === 'string' ? output : JSON.stringify(output), annotations: [] }] }], usage: u, ...extra }),
  { status: 200, headers: { 'content-type': 'application/json' } });
function provider(replies: Reply[]) {
  const bodies: any[] = [];
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init!.body)); bodies.push(body);
    const reply = replies[bodies.length - 1];
    if (!reply) throw Error('unexpected provider call');
    return reply(body, init!);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, bodies };
}
const storyboardUsage = (s: Awaited<ReturnType<typeof setup>>) => usage(Math.floor(s.plan.storyboard.payloadBytes / 4), Math.floor(s.plan.storyboard.payloadBytes / 4) - 5, 0, 9000);
const reviewUsage = () => usage(6000, 0, 5990, 1500);
const okStoryboard = (s: Awaited<ReturnType<typeof setup>>): Reply => b => respond(b, providerStoryboard(s.kindDraft), storyboardUsage(s));
const okReview = (s: Awaited<ReturnType<typeof setup>>, verdict: 'supported' | 'uncertain' = 'supported'): Reply => b => {
  const review = structuredClone(s.r.review) as any;
  if (verdict !== 'supported') review.frames[4].checks[0].verdict = verdict;
  return respond(b, providerReview(review), reviewUsage());
};
const run = (s: Awaited<ReturnType<typeof setup>>, file: string, extra: Partial<Parameters<typeof runStoryboardReplan>[0]> = {}) =>
  runStoryboardReplan({ parent: s.parent, grantFile: file, workspace, signal: new AbortController().signal, readKey: vi.fn(() => KEY), log: () => {}, ...extra });
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const costOf = (model: 'gpt-6-astra' | 'gpt-6.1-sol', u: unknown) => cacheAwareCostMicroUsd(model, cacheAwareUsage(u))!;
const reindex = (dir: string) => {
  rmSync(path.join(dir, REPLAN_INDEX_FILE));
  const files = replanFiles(dir).map(rel => { const bytes = readFileSync(path.join(dir, ...rel.split('/'))); return { path: rel, sha256: sha(bytes), bytes: bytes.length }; });
  writeFileSync(path.join(dir, REPLAN_INDEX_FILE), JSON.stringify({ version: REPLAN_INDEX_VERSION, files }));
};

describe('re-plan runner: grant and offline refusal paths (no key, no client, no provider)', () => {
  it('a draft grant, an old audition grant, a wrong scope and every mismatched pin are refused before any folder, key or call', async () => {
    const s = await setup();
    const { fetchMock } = provider([]);
    const cases: [string, (g: any) => void][] = [
      ['replan_grant_draft', g => { g.version = 'storyboard-replan-grant/v1-DRAFT'; }],
      ['replan_grant_invalid', g => { g.version = 'audition-spend-grant/v1'; }],
      ['replan_grant_invalid', g => { g.scope.retries = 1; }],
      ['replan_grant_invalid', g => { g.maxCalls = 3; }],
      ['replan_grant_scope', g => { g.replan.pairPages = [s.r.book.narrativeSpreads + 1]; }],
      ['replan_grant_invalid', g => { g.replan.pairPages = [4, 4]; }],
      ['replan_grant_invalid', g => { g.replan.pairPages = [5, 4]; }],
      ['replan_grant_invalid', g => { g.replan.pairPages = []; }],
      ['replan_grant_invalid', g => { delete g.ledger.snapshot; }],
      ['replan_grant_invalid', g => { g.ledger.adjustments = [{ microUsd: -1000000, reason: 'a lower floor by adjustment', approvalReference: 'not allowed: corrected snapshot only' }]; }],
      ['replan_grant_invalid', g => { g.extra = true; }],
      ['replan_grant_parent', g => { g.parent.reviewDigest = 'a'.repeat(64); }],
      ['replan_grant_parent', g => { g.parent.savedSourceSha256 = 'a'.repeat(64); }],
      ['replan_grant_parent', g => { g.parent.draftSha256 = 'a'.repeat(64); }],
      ['replan_grant_parent', g => { g.parent.storyboardDigest = 'a'.repeat(64); }],
      ['replan_grant_payload', g => { g.payloads.storyboard.inputSha256 = 'a'.repeat(64); }],
      ['replan_grant_payload', g => { g.payloads.review.schemaSha256 = 'a'.repeat(64); }],
      ['replan_grant_payload', g => { g.replan.sourceDigest = 'a'.repeat(64); }],
      ['replan_grant_executable', g => { g.executable.files[1].sha256 = 'a'.repeat(64); }],
      ['replan_grant_pricing', g => { g.pricing.ratesTenthMicroUsdPerToken['gpt-6-astra'].cacheWrite = 100; }],
      ['replan_grant_pricing', g => { g.pricing.reservations.review -= 1; }],
      ['replan_cap_too_low', g => { g.capMicroUsd -= 1; }],
      ['replan_grant_cap', g => { g.capMicroUsd = g.ledger.priorKnownApiMicroUsd + 8000001; }],
      ['replan_grant_evidence', g => { g.ledger.evidence[0].sha256 = 'a'.repeat(64); }],
      ['replan_out_fence', g => { g.out = path.join(s.bookDir, 'replan'); }],
      ['replan_out_fence', g => { g.out = path.join(workspace, 'replan-out'); }],
    ];
    for (const [code, change] of cases) {
      const readKey = vi.fn(() => KEY), file = s.grant(change), target = json(file).out;
      await expect(run(s, file, { readKey }), code).rejects.toMatchObject({ code });
      expect(readKey, code).not.toHaveBeenCalled();
      expect(existsSync(s.out) || (typeof target === 'string' && existsSync(target)), code).toBe(false);
    }
    // The fence is part of the grant check itself (the dry-run reader), not only of the runner.
    for (const out of [path.join(s.bookDir, 'replan'), path.join(workspace, 'replan-out')])
      expect(() => readReplanGrant(s.grant(g => { g.out = out; }), s.parent, workspace), out).toThrow('replan_out_fence');
    // The dry-run path may READ a draft grant to check its pins; it can never execute one.
    expect(readReplanGrant(s.grant(g => { g.version = 'storyboard-replan-grant/v1-DRAFT'; }), s.parent, workspace, { allowDraft: true }).draft).toBe(true);
    // An existing folder is never reused or overwritten.
    mkdirSync(s.out); const readKey = vi.fn(() => KEY);
    await expect(run(s, s.grant(), { readKey })).rejects.toMatchObject({ code: 'replan_out_exists' });
    expect(readKey).not.toHaveBeenCalled();
    expect(readdirSync(s.out)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('input limits: an oversized storyboard payload is refused before any claim; a driver content limit stops before the first call', async () => {
    const s = await setup(), file = s.grant(), { fetchMock } = provider([]), limit = BOOK_LIMITS.inputBytesPerCall;
    try {
      (BOOK_LIMITS as { inputBytesPerCall: number }).inputBytesPerCall = s.plan.storyboard.payloadBytes - 1;
      await expect(run(s, file)).rejects.toMatchObject({ code: 'replan_provider_input_limit' });
      expect(existsSync(s.out)).toBe(false);
    } finally { (BOOK_LIMITS as { inputBytesPerCall: number }).inputBytesPerCall = limit; }
    const readKey = vi.fn(() => KEY);
    await expect(run(s, file, { readKey, inputByteLimit: s.plan.storyboard.contentBytes - 1 })).rejects.toMatchObject({ code: 'input_limit' });
    expect(readKey).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json(path.join(s.out, 'failure.json'))).toMatchObject({ status: 'incomplete', code: 'input_limit', completedStages: [], storyboardSaved: false });
    expect(json(path.join(s.out, 'spend.json'))).toMatchObject({ calls: 0, newKnownApiMicroUsd: 0 });
    // Only a LOWER driver limit or a SHORTER deadline may be requested, and either is refused before any folder exists.
    const t = await setup(), tFile = t.grant();
    await expect(run(t, tFile, { deadlineMs: 60001 })).rejects.toMatchObject({ code: 'replan_deadline_policy' });
    await expect(run(t, tFile, { inputByteLimit: 104001 })).rejects.toMatchObject({ code: 'replan_input_limit_policy' });
    expect(existsSync(t.out)).toBe(false);
  });
});

describe('inherited ledger: the typed, settled snapshot is the floor (QA F3)', () => {
  it("Codex's counterexample: a prior lowered by USD 1 with every other pin unchanged is refused before any folder, key or call", async () => {
    const s = await setup(), readKey = vi.fn(() => KEY), { fetchMock } = provider([]);
    expect(ledgerSnapshotSchema.parse(json(s.snapshot))).toMatchObject({ cumulativeAccountedMicroUsd: 7100254, unknownCost: 0, reservedUnsettledMicroUsd: 0 });
    expect(() => readReplanGrant(s.grant(), s.parent, workspace)).not.toThrow();
    await expect(run(s, s.grant(g => { g.ledger.priorKnownApiMicroUsd -= 1000000; }), { readKey })).rejects.toMatchObject({ code: 'replan_grant_ledger' });
    expect(readKey).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled(); expect(existsSync(s.out)).toBe(false);
  });

  it('a higher prior needs an explicit, reconciled owner-approved adjustment; the recorded snapshot itself is never rewritten', async () => {
    const s = await setup(), before = readFileSync(s.snapshot, 'utf8'), raise = (g: any) => { g.ledger.priorKnownApiMicroUsd += 429307; g.capMicroUsd += 429307; };
    expect(() => readReplanGrant(s.grant(raise), s.parent, workspace)).toThrow('replan_grant_ledger');
    const adjusted = s.grant(g => { raise(g); g.ledger.adjustments = [{ microUsd: 429307,
      reason: 'cache-aware re-estimate of the saved text receipts (separate reconciliation)', approvalReference: 'synthetic owner approval for this test only' }]; });
    expect(readReplanGrant(adjusted, s.parent, workspace).grant.ledger.priorKnownApiMicroUsd).toBe(7529561);
    // The adjustment must reconcile exactly: one micro-USD off either way is refused.
    expect(() => readReplanGrant(s.grant(g => { raise(g); g.ledger.adjustments = [{ microUsd: 429306, reason: 'off by one micro-USD here',
      approvalReference: 'synthetic owner approval for this test only' }]; }), s.parent, workspace)).toThrow('replan_grant_ledger');
    expect(readFileSync(s.snapshot, 'utf8')).toBe(before);
  });

  it('a missing, changed, malformed, inconsistent or unsettled snapshot is refused', async () => {
    const s = await setup();
    const variant = (name: string, change: (snap: any) => void) => {
      const file = path.join(s.root, `${name}.json`), snap = json(s.snapshot); change(snap); writeFileSync(file, JSON.stringify(snap));
      // The grant agrees with the variant's own total, so only the targeted snapshot check can refuse it.
      return s.grant(g => { g.ledger.snapshot = { file, sha256: sha(readFileSync(file)) }; g.ledger.priorKnownApiMicroUsd = snap.cumulativeAccountedMicroUsd;
        g.capMicroUsd = snap.cumulativeAccountedMicroUsd + s.plan.reservations.storyboard + s.plan.reservations.review; });
    };
    const cases: [string, string][] = [
      ['missing file', s.grant(g => { g.ledger.snapshot.file = path.join(s.root, 'absent.json'); })],
      ['sha mismatch', s.grant(g => { g.ledger.snapshot.sha256 = 'a'.repeat(64); })],
      ['extra field', variant('extra', snap => { snap.note = 'x'; })],
      ['wrong Claude Max wording', variant('max', snap => { snap.claudeMax = 'included'; })],
      ['cumulative not prior + new', variant('sum', snap => { snap.cumulativeAccountedMicroUsd -= 1; })],
      ['unknown cost', variant('unknown', snap => { snap.unknownCost = 1; })],
      ['unknown outcome', variant('outcome', snap => { snap.unknownOutcome = 1; })],
      ['reserved, unsettled', variant('reserved', snap => { snap.reservedUnsettledMicroUsd = 600000; snap.cumulativeAccountedMicroUsd += 600000; })],
    ];
    for (const [label, file] of cases) expect(() => readReplanGrant(file, s.parent, workspace), label).toThrow('replan_grant_ledger');
  });
});

describe('re-plan runner: rehearsed paid path (mocked provider)', () => {
  it('success: two journaled calls, key read only after each claim, cache-aware settlement, and a bound folder the loader admits', async () => {
    const s = await setup(), file = s.grant();
    const { bodies } = provider([okStoryboard(s), okReview(s)]);
    const readKey = vi.fn(() => {
      const stage = readKey.mock.calls.length === 1 ? 'storyboard' : 'review';
      expect(existsSync(path.join(s.out, 'paid-stages', `${stage}.claim.json`))).toBe(true);
      expect(existsSync(path.join(s.out, 'paid-stages', `${stage}.wire.json`))).toBe(true);
      return KEY;
    });
    const result = await run(s, file, { readKey });
    expect(result).toMatchObject({ status: 'review_supported', comparability: { verdict: 'COMPARABLE', kindAdded: [{ entityId: 'hut', kind: 'hut' }] } });
    expect(readKey).toHaveBeenCalledTimes(2);
    expect(bodies.map(b => [b.model, b.text.format.name, b.max_output_tokens])).toEqual([['gpt-6-astra', 'personal_book_storyboard', 32000],
      ['gpt-6.1-sol', 'personal_book_review', s.plan.review.maxOutputTokens]]);
    expect(JSON.parse(bodies[0].input).priorApprovedStoryboard.storyboard).toEqual(s.r.draft);
    expect(bodies[1].input.includes('priorApprovedStoryboard')).toBe(false);
    const expected = costOf('gpt-6-astra', storyboardUsage(s)) + costOf('gpt-6.1-sol', reviewUsage());
    expect(result.spend).toMatchObject({ priorKnownApiMicroUsd: 7100254, newKnownApiMicroUsd: expected, calls: 2, failed: 0, unknownCost: 0, unknownOutcome: 0 });
    expect(json(path.join(s.out, 'paid-stages', 'storyboard.receipt.json')).pricing).toEqual({ version: CACHE_AWARE_PRICING_VERSION, policy: CACHE_POLICY });
    expect(json(path.join(s.out, 'paid-stages', 'storyboard.claim.json')).maximumMicroUsd).toBe(s.plan.reservations.storyboard);
    expect(readFileSync(path.join(s.out, 'grant.json'), 'utf8')).toBe(readFileSync(file, 'utf8'));
    const admitted = admitReplanStoryboard(s.parent, s.out);
    expect(admitted.book.landmarkKind).toBe(LANDMARK_KIND_CONTRACT_VERSION);
    expect(admitted.book.storyboardDigest).toBe(result.storyboardDigest);
    expect(admitted.comparability.verdict).toBe('COMPARABLE');
    expect(admitted.pairPages).toEqual([4]);
    expect(admitted.result.storyboard.framePackets[1].context.landmarkKind).toBe(LANDMARK_KIND_CONTRACT_VERSION);
    expect(result.storyboardDigest).not.toBe(s.r.book.storyboardDigest);
    expect(ledgerSnapshotSchema.parse(json(path.join(s.out, 'spend.json')))).toMatchObject({ cumulativeAccountedMicroUsd: 7100254 + expected, unknownCost: 0 });
  });

  it('a held review is a result: recorded with no packets, never re-asked, and not admitted', async () => {
    const s = await setup(), { fetchMock } = provider([okStoryboard(s), okReview(s, 'uncertain')]);
    const result = await run(s, s.grant());
    expect(result.status).toBe('held_uncertain');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(json(path.join(s.out, 'visual_simple_book_result.json')).storyboard.framePackets).toEqual([]);
    expect(() => admitReplanStoryboard(s.parent, s.out)).toThrow('audition_replan_status');
  });

  const failing: [string, (s: Awaited<ReturnType<typeof setup>>) => Reply, { known: boolean; saved: boolean }][] = [
    ['replan_provider_json', s => b => respond(b, '{"plan": truncated', storyboardUsage(s)), { known: true, saved: false }],
    ['replan_provider_incomplete', s => b => respond(b, '{"plan":', storyboardUsage(s), { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
      { known: true, saved: false }],
    ['replan_provider_schema', s => b => respond(b, { plan: {} }, storyboardUsage(s)), { known: true, saved: false }],
    ['replan_unknown_cost', s => b => respond(b, providerStoryboard(s.kindDraft), { ...storyboardUsage(s), input_tokens_details: undefined }), { known: false, saved: false }],
    ['replan_unknown_cost', s => b => respond(b, providerStoryboard(s.kindDraft), { ...storyboardUsage(s), total_tokens: 1 }), { known: false, saved: false }],
    ['replan_unknown_cost', s => b => respond({ ...b, model: 'gpt-6-astra-mini' }, providerStoryboard(s.kindDraft), storyboardUsage(s)), { known: false, saved: false }],
    ['replan_reservation_breach', s => b => respond(b, providerStoryboard(s.kindDraft), usage(s.plan.storyboard.payloadBytes, s.plan.storyboard.payloadBytes, 0, 40000)),
      { known: true, saved: false }],
    ['replan_provider_transport', () => () => new Response(JSON.stringify({ error: { message: 'server error' } }), { status: 500, headers: { 'content-type': 'application/json' } }),
      { known: false, saved: false }],
  ];
  for (const [code, reply, expectation] of failing) it(`storyboard ${code}: kept, settled or held unknown, and nothing after it`, async () => {
    const s = await setup(), { fetchMock } = provider([reply(s)]), readKey = vi.fn(() => KEY);
    await expect(run(s, s.grant(), { readKey })).rejects.toMatchObject({ code });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readKey).toHaveBeenCalledTimes(1);
    const settled = json(path.join(s.out, 'paid-stages', 'storyboard.result.json'));
    expect(settled.completed).toBe(false);
    expect(typeof settled.estimatedMicroUsd === 'number').toBe(expectation.known);
    expect(json(path.join(s.out, 'spend.json'))).toMatchObject({ calls: 1, unknownCost: expectation.known ? 0 : 1 });
    expect(json(path.join(s.out, 'failure.json'))).toMatchObject({ code, completedStages: [], storyboardSaved: expectation.saved });
    expect(existsSync(path.join(s.out, 'paid-stages', 'review.claim.json'))).toBe(false);
    expect(() => admitReplanStoryboard(s.parent, s.out)).toThrow('audition_replan_status');
  });

  it('the review payload over the provider limit: the paid storyboard is kept and compared, the review is never claimed', async () => {
    const s = await setup(), limit = BOOK_LIMITS.inputBytesPerCall;
    const { fetchMock } = provider([b => { (BOOK_LIMITS as { inputBytesPerCall: number }).inputBytesPerCall = 1000; return okStoryboard(s)(b, {}); }]);
    try { await expect(run(s, s.grant())).rejects.toMatchObject({ code: 'replan_provider_input_limit' }); }
    finally { (BOOK_LIMITS as { inputBytesPerCall: number }).inputBytesPerCall = limit; }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json(path.join(s.out, 'failure.json'))).toMatchObject({ completedStages: ['storyboard'], storyboardSaved: true });
    expect(json(path.join(s.out, 'comparability.json')).verdict).toBe('COMPARABLE');
    expect(existsSync(path.join(s.out, 'paid-stages', 'review.claim.json'))).toBe(false);
    expect(json(path.join(s.out, 'spend.json'))).toMatchObject({ calls: 1, unknownCost: 0, newKnownApiMicroUsd: costOf('gpt-6-astra', storyboardUsage(s)) });
  });

  it('the review content over the driver limit: stopped after the paid storyboard, before any review claim', async () => {
    // A storyboard that grew (long staging text) makes the review input the larger one; the content limit sits between the two.
    const s = await setup(), long = (d: any) => { for (const n of [1, 2, 3, 5, 6]) d.plan.pages[n].composition += ' ' + 'wide quiet lawn '.repeat(60); };
    const grown: Reply = b => respond(b, providerStoryboard(withKind(s.r.draft, 'hut', long)), storyboardUsage(s));
    const probe = await setup(); provider([b => respond(b, providerStoryboard(withKind(probe.r.draft, 'hut', long)), storyboardUsage(probe)), okReview(probe)]);
    const measured = (await run(probe, probe.grant())).out;
    const calls = json(path.join(measured, 'visual_simple_book_result.json')).storyboard.calls;
    expect(calls.map((c: { stage: string }) => c.stage)).toEqual(['storyboard', 'review']);
    vi.unstubAllGlobals(); const { fetchMock } = provider([grown]);
    expect(calls[1].contentBytes).toBeGreaterThan(calls[0].contentBytes);
    await expect(run(s, s.grant(), { inputByteLimit: calls[1].contentBytes - 1 })).rejects.toMatchObject({ code: 'input_limit' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json(path.join(s.out, 'failure.json'))).toMatchObject({ completedStages: ['storyboard'], storyboardSaved: true });
    expect(existsSync(path.join(s.out, 'paid-stages', 'review.claim.json'))).toBe(false);
  });

  it('abort and deadline: the in-flight call is held as unknown cost (never retried), and the run stops', async () => {
    for (const mode of ['abort', 'deadline'] as const) {
      const s = await setup(), controller = new AbortController();
      const hang: Reply = (_b, init) => new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        if (mode === 'abort') controller.abort();
      });
      const { fetchMock } = provider([hang]);
      await expect(run(s, s.grant(), { signal: controller.signal, ...(mode === 'deadline' ? { deadlineMs: 30 } : {}) }))
        .rejects.toMatchObject({ code: mode === 'abort' ? 'replan_cancelled' : 'replan_deadline' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(json(path.join(s.out, 'paid-stages', 'storyboard.result.json'))).toMatchObject({ completed: false, estimatedMicroUsd: null });
      expect(json(path.join(s.out, 'spend.json'))).toMatchObject({ calls: 1, unknownCost: 1 });
    }
  });

  it('a compile failure after a paid storyboard: the draft and its comparison are kept, the review never runs', async () => {
    const s = await setup(), bad = withKind(s.r.draft, 'beside the red sign');
    const { fetchMock } = provider([b => respond(b, providerStoryboard(bad), storyboardUsage(s))]);
    await expect(run(s, s.grant())).rejects.toMatchObject({ code: 'personal_storyboard_landmark_kind' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json(path.join(s.out, 'owned_storyboard_draft.json'))).toEqual(bad);
    expect(json(path.join(s.out, 'failure.json'))).toMatchObject({ completedStages: ['storyboard'], storyboardSaved: true });
  });
});

describe('re-plan folder admission (loader): immutable, fenced, bound to the parent, comparable', () => {
  async function admitted() {
    const s = await setup(); provider([okStoryboard(s), okReview(s)]);
    await run(s, s.grant());
    vi.unstubAllGlobals();
    let n = 0;
    const copy = (edit: (dir: string) => void, reindexAfter = true) => {
      const dir = path.join(s.root, `copy-${n++}`); cpSync(s.out, dir, { recursive: true }); edit(dir); if (reindexAfter) reindex(dir); return dir;
    };
    const editResult = (dir: string, change: (r: any) => void) => {
      const file = path.join(dir, 'visual_simple_book_result.json'), r = json(file); change(r); writeFileSync(file, JSON.stringify(r));
    };
    return { s, copy, editResult };
  }

  it('the index is the folder: a changed byte, an added or a removed file refuses it', async () => {
    const { s, copy } = await admitted();
    expect(() => admitReplanStoryboard(s.parent, s.out)).not.toThrow();
    const draft = (dir: string) => path.join(dir, 'owned_storyboard_draft.json');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => writeFileSync(draft(dir), readFileSync(draft(dir), 'utf8') + ' '), false))).toThrow('audition_replan_index');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => writeFileSync(path.join(dir, 'extra.json'), '{}'), false))).toThrow('audition_replan_index');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => rmSync(path.join(dir, 'comparability.json')), false))).toThrow('audition_replan_index');
  });

  it('fenced: never inside the protected parent book, never a relative path', async () => {
    const { s } = await admitted(), inside = path.join(s.bookDir, 'replan-copy');
    cpSync(s.out, inside, { recursive: true });
    expect(() => admitReplanStoryboard(s.parent, inside)).toThrow('audition_replan_fence');
    expect(() => admitReplanStoryboard(s.parent, path.relative(process.cwd(), s.out))).toThrow('audition_replan_fence');
  });

  it('stale or tampered parent, source, review or packets are refused even when re-indexed', async () => {
    const { s, copy, editResult } = await admitted();
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.parent.storyboardDigest = 'a'.repeat(64); })))).toThrow('audition_replan_parent');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.source.manuscript.title = 'another title'; })))).toThrow('audition_replan_parent');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.replan.preservation = 'none'; })))).toThrow('audition_replan_parent');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.storyboard.rawReview = s.r.review; })))).toThrow('review_binding');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.storyboard.framePackets[1].context.text = 'changed'; }))))
      .toThrow('audition_frame_binding');
    expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { delete r.storyboard.storyboard.landmarkKind; })))).toThrow('audition_replan_kind');
    // Against a different (stale) parent draft the preservation, and so every digest, no longer matches.
    const stale = { ...s.parent, draft: (() => { const d = structuredClone(s.r.draft) as any; d.plan.visualLanguage = 'crayon'; return d; })() };
    expect(() => admitReplanStoryboard(stale, s.out)).toThrow('preservation_binding');
  });

  describe('the compared pages come from the producer grant, anchored by the audition approval (QA F4)', () => {
    const editJson = (file: string, change: (v: any) => void) => { const v = json(file); change(v); writeFileSync(file, JSON.stringify(v)); };
    /** Rewrites the folder's producer grant and the two records of its sha, as a consistent forger would. */
    const forgeGrant = (dir: string, change: (g: any) => void) => {
      editJson(path.join(dir, 'grant.json'), change);
      const grantSha = sha(readFileSync(path.join(dir, 'grant.json')));
      editJson(path.join(dir, 'visual_simple_book_result.json'), r => { r.replan.grantSha256 = grantSha; });
      editJson(path.join(dir, 'admission.json'), a => { a.grantSha256 = grantSha; });
    };
    const scope = (replan: unknown, pages = [4], extra: Record<string, unknown> = {}) => ({ mode: 'rejudge', sourceDirectory: 'x',
      references: {}, frames: pages.map(pageNumber => ({ label: `page ${pageNumber}`, pageNumber, image: {}, predecessor: null })),
      ...(replan ? { replan } : {}), ...extra }) as any;

    it("Codex's counterexample: only the result's pages changed to [5] and re-indexed is refused; the page-4 control is admitted", async () => {
      const { s, copy, editResult } = await admitted();
      expect(admitReplanStoryboard(s.parent, s.out).pairPages).toEqual([4]);
      expect(() => admitReplanStoryboard(s.parent, copy(dir => editResult(dir, r => { r.replan.pairPages = [5]; })))).toThrow('audition_replan_scope');
      expect(() => admitReplanStoryboard(s.parent, copy(dir => editJson(path.join(dir, 'admission.json'), a => { a.replan.pairPages = [5]; })))).toThrow('audition_replan_scope');
    });

    it('the producer grant itself is bound: edited without its recorded sha, for another parent, another source, or a draft: refused', async () => {
      const { s, copy } = await admitted();
      expect(() => admitReplanStoryboard(s.parent, copy(dir => editJson(path.join(dir, 'grant.json'), g => { g.replan.pairPages = [5]; }))))
        .toThrow('audition_replan_grant');
      expect(() => admitReplanStoryboard(s.parent, copy(dir => forgeGrant(dir, g => { g.parent.storyboardDigest = 'a'.repeat(64); })))).toThrow('audition_replan_grant');
      // Each record of the producer grant's sha is checked on its own: one stale record is enough to refuse.
      for (const stale of ['visual_simple_book_result.json', 'admission.json']) expect(() => admitReplanStoryboard(s.parent, copy(dir => {
        const before = json(path.join(dir, stale));
        forgeGrant(dir, g => { g.approvalReference += ' (re-saved)'; });
        writeFileSync(path.join(dir, stale), JSON.stringify(before));
      })), stale).toThrow('audition_replan_grant');
      expect(() => admitReplanStoryboard(s.parent, copy(dir => forgeGrant(dir, g => { g.parent.reviewDigest = 'a'.repeat(64); })))).toThrow('audition_replan_grant');
      expect(() => admitReplanStoryboard(s.parent, copy(dir => forgeGrant(dir, g => { g.replan.sourceDigest = 'a'.repeat(64); })))).toThrow('audition_replan_grant');
      expect(() => admitReplanStoryboard(s.parent, copy(dir => forgeGrant(dir, g => { g.version = 'storyboard-replan-grant/v1-DRAFT'; })))).toThrow('audition_replan_grant');
    });

    it('a consistently forged folder passes its own checks, so the audition approval must name the exact producer grant and index', async () => {
      const { s, copy, editResult } = await admitted();
      const valid = admitReplanStoryboard(s.parent, s.out);
      const anchor = { producerGrantSha256: valid.producerGrantSha256, indexSha256: valid.indexSha256 };
      const forged = admitReplanStoryboard(s.parent, copy(dir => {
        forgeGrant(dir, g => { g.replan.pairPages = [5]; });
        editResult(dir, r => { r.replan.pairPages = [5]; });
        editJson(path.join(dir, 'admission.json'), a => { a.replan.pairPages = [5]; });
      }));
      expect(forged.pairPages).toEqual([5]);
      expect(() => assertReplanAuditionScope(scope(anchor, [5]), forged, false)).toThrow('audition_replan_scope');
      // The valid page-4 control passes only with its own anchor, a rejudge of its own pages, and no resume.
      expect(() => assertReplanAuditionScope(scope(anchor), valid, false)).not.toThrow();
      expect(() => assertReplanAuditionScope(scope(anchor, [5]), valid, false)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope(scope(anchor), valid, true)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope(scope(undefined), valid, false)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope(scope({ ...anchor, indexSha256: 'a'.repeat(64) }), valid, false)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope(scope({ ...anchor, producerGrantSha256: 'a'.repeat(64) }), valid, false)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope({ mode: 'render', pages: [4] } as any, valid, false)).toThrow('audition_replan_scope');
      // A legacy (no re-plan) run never accepts a grant that names a re-plan folder; legacy grants without one are unchanged.
      expect(() => assertReplanAuditionScope(scope(anchor), undefined, false)).toThrow('audition_replan_scope');
      expect(() => assertReplanAuditionScope(scope(undefined), undefined, false)).not.toThrow();
    });

    it('the audition grant schema accepts the anchor only on a rejudge, and legacy grants without it still parse', () => {
      const shape = auditionGrantSchema.innerType().shape.scope.options.find((o: any) => o.shape.mode.value === 'rejudge')!.shape as any;
      expect(shape.replan.safeParse(undefined).success).toBe(true);
      expect(shape.replan.safeParse({ producerGrantSha256: 'a'.repeat(64), indexSha256: 'b'.repeat(64) }).success).toBe(true);
      expect(shape.replan.safeParse({ producerGrantSha256: 'a'.repeat(64) }).success).toBe(false);
    });
  });

  it('a well-formed, reviewed re-plan that drifted from the parent design is refused as NOT comparable', async () => {
    const s = await setup(), drifted = withKind(s.r.draft, 'hut', d => { d.plan.recurringProps[0].design = 'two red cotton ribbons'; });
    provider([b => respond(b, providerStoryboard(drifted), storyboardUsage(s)), okReview(s)]);
    const result = await run(s, s.grant());
    expect(result.status).toBe('review_supported');
    expect(result.comparability).toMatchObject({ verdict: 'NOT_COMPARABLE', drift: [{ category: 'prop_design' }] });
    expect(() => admitReplanStoryboard(s.parent, s.out)).toThrow('audition_replan_not_comparable');
  });
});
