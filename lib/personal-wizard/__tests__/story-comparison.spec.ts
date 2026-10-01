import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { buildStoryComparison, renderBlindStoryComparison, storyReviewPacket, STORY_REVIEW_PHASES } from '../story-comparison';
import { preparePersonalStory, writePersonalStory } from '../story-writer';
import { prepareStoryEdit, compileStoryEdit } from '../story-editor';
import { fixtureEditorOutput, personalStoryboardFixture } from './personal-storyboard-fixture';
import { fixtureAdventureSelection } from './story-planning-fixture';
import { resolvePersonalWizardOptions } from '../options';
import { IntakeLedger } from '../intake-ledger';
import { canonicalJson } from '../request-acceptance';
import { personalStoryEvaluationProfiles } from '../story-evaluation-profiles';
import { PROTOTYPE_COMPANION_ROSTER } from '../options';
import { main as packageMain } from '../../../scripts/personal-story-comparison-package';
const options = resolvePersonalWizardOptions(), oldCommit = 'a'.repeat(40), newCommit = 'b'.repeat(40);
const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function fixture() {
  const f = await personalStoryboardFixture(); const request = structuredClone(f.request);
  request.child.nameSource = request.child.ageSource = request.child.addressSource = request.child.residenceSource = 'fixture';
  request.facts.forEach(fact => { fact.source = 'fixture'; }); request.storyPlace!.source = 'fixture';
  const prepared = preparePersonalStory(request, options);
  const improved = await writePersonalStory({ prepared, userId: 'synthetic', jobId: 's_comparison01', ledger: new IntakeLedger(),
    settings: { model: 'gpt-6-sol', budgetUsd: 1, maxJobs: 1, operators: new Set() }, signal: new AbortController().signal,
    provider: () => ({ generate: async call => ({ output: call.stage === 'plan'
      ? { ...f.draftResult.plan, requestId: prepared.accepted.requestId, adventureSelection: fixtureAdventureSelection() }
      : { ...f.draftResult.manuscript, requestId: prepared.accepted.requestId, planDigest: JSON.parse(call.input).planDigest }, usage: null }) }) });
  improved.planning!.selection.reason = 'PRIVATE_SELECTION_SENTINEL, declared reason only';
  const { planning: _planning, ...baseline } = structuredClone(improved);
  const edit = (draft: typeof baseline) => {
    const call = prepareStoryEdit(prepared, draft); const output = fixtureEditorOutput(call);
    output.manuscript.pages[0].text = Array(70).fill('נועה').join(' ');
    output.checks.hebrew_and_age.note = 'PRIVATE_EDITOR_SENTINEL, model still says ready';
    return compileStoryEdit(prepared, draft, output, null);
  };
  const artifact = (result: unknown, sourceCommit: string) => ({ request, result, reasoning: 'medium' as const, sourceCommit });
  return { manifest: { version: 'personal-story-comparison/offline-v1', seed: 'PRIVATE_SEED_SENTINEL', baselineCommit: oldCommit, improvedCommit: newCommit,
    cases: [{ id: 'synthetic_one', split: 'development', registeredRequest: request,
      baselineDraft: artifact(baseline, oldCommit), baselineEdited: artifact(edit(baseline), oldCommit),
      improvedDraft: artifact(improved, newCommit), improvedEdited: artifact(edit(improved), newCommit) }] }, f, prepared };
}
describe('offline phase-separated blind evidence packaging', () => {
  it('registers diverse synthetic inputs without paying for them or treating held-out as already evaluated', () => {
    const rows = personalStoryEvaluationProfiles();
    expect(rows).toHaveLength(12); expect(rows.filter(row => row.split === 'held_out')).toHaveLength(3);
    expect(rows.filter(row => row.detail === 'rich')).toHaveLength(6);
    expect(rows.filter(row => row.request.intent?.kind === 'topic')).toHaveLength(6);
    for (const id of PROTOTYPE_COMPANION_ROSTER) expect(rows.filter(row => row.request.companion.id === id)).toHaveLength(2);
    for (const id of ['short', 'medium', 'long']) expect(rows.filter(row => row.request.bookOptions.lengthId === id)).toHaveLength(4);
    for (const row of rows) expect(() => preparePersonalStory(row.request, options)).not.toThrow();
    // Companion-only swaps preserve the entire child context, not a changed topic.
    expect(rows[0].request.child).toEqual(rows[1].request.child);
    expect(rows[0].request.facts).toEqual(rows[1].request.facts);
    expect(readFileSync('lib/personal-wizard/story-writer.ts', 'utf8')).not.toContain('story-evaluation-profiles');
  });
  it('compares first drafts separately, preserves both premises privately, and measures editor disagreement', async () => {
    const { manifest } = await fixture(); const before = structuredClone(manifest);
    vi.stubGlobal('fetch', vi.fn(() => { throw Error('NETWORK_NOT_ALLOWED'); }));
    const output = buildStoryComparison(manifest, options);
    expect(output.blind.firstDraftPairs).toHaveLength(1); expect(output.blind.editingPairs).toHaveLength(2);
    expect(output.blind.finalTexts).toHaveLength(2); expect(output.blind.premisePairs).toHaveLength(1);
    const rows: any = output.privateEvidence.cases;
    expect(rows[0].artifacts.improvedEdited.editorReadyDespiteLengthDeviation).toBe(true);
    expect(rows[0].artifacts.improvedEdited.metrics.aboveTarget).toContain(1);
    expect(rows[0].artifacts.improvedDraft.planning.selection.candidates).toHaveLength(2);
    expect(output.privateEvidence).toMatchObject({ providerCalls: 0, keyReads: 0, costUsd: 0, noQualityVerdict: true });
    expect(manifest).toEqual(before); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps version/selection/editor metadata out of every blind byte and critic text', async () => {
    const { manifest } = await fixture(); const output = buildStoryComparison(manifest, options);
    const publicBytes = JSON.stringify(output.blind) + renderBlindStoryComparison(output.blind);
    expect(publicBytes).not.toMatch(/PRIVATE_SELECTION_SENTINEL|PRIVATE_EDITOR_SENTINEL|PRIVATE_SEED_SENTINEL|sourceCommit|planDigest|draftDigest|selectedId|accounting|baselineCommit|improvedCommit/);
    expect(JSON.stringify(output.privateEvidence)).toContain('PRIVATE_SELECTION_SENTINEL');
    expect(renderBlindStoryComparison(output.blind)).not.toContain('<details');
  });
  it('editor assertions cannot change final critic inputs or deterministic length statistics', async () => {
    const { manifest } = await fixture(); const before = buildStoryComparison(manifest, options);
    (manifest.cases[0].improvedEdited.result as any).editing.checks.hebrew_and_age.note = 'A changed claim with no changed prose';
    const after = buildStoryComparison(manifest, options);
    expect(after.blind).toEqual(before.blind);
    expect((after.privateEvidence.cases[0] as any).artifacts.improvedEdited.metrics).toEqual((before.privateEvidence.cases[0] as any).artifacts.improvedEdited.metrics);
  });
  it('opaque final IDs do not shift when an earlier arm or review phase is absent', async () => {
    const { manifest } = await fixture(); const full = buildStoryComparison(manifest, options);
    const source = (output: typeof full) => (output.privateEvidence.labels as any[]).find(row => row.phase === 'final_text_only' && row.source === 'improvedEdited').packet;
    manifest.cases[0].baselineDraft = manifest.cases[0].baselineEdited = null as any;
    const partial = buildStoryComparison(manifest, options);
    expect(source(partial)).toBe(source(full)); expect(source(full)).toMatch(/^r[a-f0-9]{24}$/);
  });
  it('each semantic packet identity changes when only the private seed changes', async () => {
    const { manifest } = await fixture();
    const first = buildStoryComparison(manifest, options);
    const second = buildStoryComparison({ ...manifest, seed: 'another-frozen-private-evaluation-seed' }, options);
    const identities = (output: typeof first) => new Map((output.privateEvidence.labels as any[])
      .map(row => [JSON.stringify([row.caseId, row.phase, row.source ?? null]), row.packet]));
    const before = identities(first), after = identities(second);
    expect([...after.keys()]).toEqual([...before.keys()]); expect(before.size).toBe(6);
    for (const [identity, packet] of before) expect(after.get(identity)).not.toBe(packet);
  });
  it('counterbalances actual public first-draft prose and keeps private A/B labels aligned', async () => {
    const { manifest } = await fixture(); const row = manifest.cases[0];
    // Distinguishable synthetic prose; no edit receipts can mask the assignment.
    const baseline: any = row.baselineDraft.result, improved: any = row.improvedDraft.result;
    baseline.manuscript.pages[0].text += ' לפתע התגלגל אגוז אל השביל.';
    row.baselineEdited = row.improvedEdited = null as any;
    const texts: Record<string, string> = { baselineDraft: baseline.manuscript.pages[0].text, improvedDraft: improved.manuscript.pages[0].text };
    expect(texts.baselineDraft).not.toBe(texts.improvedDraft);
    const inA = new Set<string>();
    for (let i = 0; i < 12; i++) {
      manifest.seed = `a-frozen-private-evaluation-seed-${i}`;
      const output = buildStoryComparison(manifest, options);
      const pair: any = output.blind.firstDraftPairs[0];
      const labels: any = (output.privateEvidence.labels as any[]).find(label => label.packet === pair.packet);
      const a = pair.A.pages[0].text, b = pair.B.pages[0].text;
      expect(new Set([a, b])).toEqual(new Set(Object.values(texts)));
      expect(a).toBe(texts[labels.A]); expect(b).toBe(texts[labels.B]); inA.add(a);
    }
    expect(inA).toEqual(new Set(Object.values(texts)));
  });
  it('independently shuffles editing arms instead of always putting the baseline first', async () => {
    const { manifest } = await fixture(); const firstArms = new Set<string>();
    for (let i = 0; i < 12; i++) {
      manifest.seed = `a-frozen-private-evaluation-seed-${i}`;
      const output = buildStoryComparison(manifest, options); const first: any = output.blind.editingPairs[0];
      firstArms.add((output.privateEvidence.labels as any[]).find(row => row.packet === first.packet).phase);
    }
    expect(firstArms).toEqual(new Set(['baseline_editing', 'improved_editing']));
  });
  it('does not relabel missing edits as final and uses final-specific critique instructions', async () => {
    const { manifest } = await fixture(); manifest.cases[0].improvedEdited = null as any;
    const output = buildStoryComparison(manifest, options);
    expect(output.blind.finalTexts).toHaveLength(1);
    expect((output.privateEvidence.labels as any[]).filter(row => row.phase === 'final_text_only').map(row => row.source)).toEqual(['baselineEdited']);
    const packet = storyReviewPacket(output.blind, 'final');
    expect(packet.instructions).not.toContain('Choose A'); expect(packet.instructions).toContain('actual passages');
    expect(output.privateEvidence.cases[0]).toMatchObject({ missingSlots: ['improvedEdited'] });
  });
  it.each(['request', 'companion', 'source_commit', 'model', 'phase', 'plan_digest', 'missing_selection', 'unrelated_edit', 'receipt_replaced', 'duplicate_case'])('rejects %s instead of mixing evaluation conditions', async kind => {
    const { manifest } = await fixture(); const row: any = manifest.cases[0];
    if (kind === 'request') row.improvedDraft.request = { ...row.improvedDraft.request, draftRevision: 99 };
    if (kind === 'companion') row.improvedDraft.request = { ...row.improvedDraft.request, companion: { id: 'fox_uri' } };
    if (kind === 'source_commit') row.improvedDraft.sourceCommit = oldCommit;
    if (kind === 'model') row.improvedDraft.result.accounting.model = 'gpt-6-astra';
    if (kind === 'phase') row.improvedDraft.result = row.improvedEdited.result;
    if (kind === 'plan_digest') row.improvedDraft.result.planDigest = 'c'.repeat(64);
    if (kind === 'missing_selection') delete row.improvedDraft.result.planning;
    if (kind === 'unrelated_edit') {
      row.improvedEdited.result.editing.original.manuscript.pages[0].text += ' Something different from the supplied draft';
      row.improvedEdited.result.editing.draftDigest = digest(row.improvedEdited.result.editing.original);
    }
    if (kind === 'receipt_replaced') row.improvedEdited.result.planning.selection.reason += ' Another reason';
    if (kind === 'duplicate_case') manifest.cases.push(manifest.cases[0]);
    expect(() => buildStoryComparison(manifest, options)).toThrow();
  });
  it('keeps unavailable arms in coverage and never infers planner improvement from an old draft/edit pair', async () => {
    const { manifest } = await fixture(); const row: any = manifest.cases[0];
    row.improvedDraft = row.improvedEdited = null;
    const output = buildStoryComparison(manifest, options);
    expect(output.blind.firstDraftPairs).toHaveLength(0); expect(output.blind.editingPairs).toHaveLength(1);
    expect(output.privateEvidence.cases[0]).toMatchObject({ planningComparisonAvailable: false, missingSlots: ['improvedDraft', 'improvedEdited'] });
  });
  it('accepts an all-fixture registry with no supplied artifacts and retains missing coverage', async () => {
    const { manifest } = await fixture(); const row = manifest.cases[0];
    row.baselineDraft = row.baselineEdited = row.improvedDraft = row.improvedEdited = null as any;
    const output = buildStoryComparison(manifest, options);
    expect(output.blind.firstDraftPairs).toEqual([]); expect(output.blind.editingPairs).toEqual([]);
    expect(output.blind.finalTexts).toEqual([]); expect(output.blind.premisePairs).toEqual([]);
    expect(output.privateEvidence.cases[0]).toMatchObject({ missingSlots: ['baselineDraft', 'baselineEdited', 'improvedDraft', 'improvedEdited'] });
  });
  it.each(['name', 'age', 'address', 'residence', 'fact', 'story_place'])('rejects non-fixture %s at the registry without any downstream artifact', async kind => {
    const { manifest } = await fixture(); const row = manifest.cases[0], request = row.registeredRequest;
    row.baselineDraft = row.baselineEdited = row.improvedDraft = row.improvedEdited = null as any;
    if (kind === 'name') request.child.nameSource = 'typed';
    if (kind === 'age') request.child.ageSource = 'typed';
    if (kind === 'address') request.child.addressSource = 'typed';
    if (kind === 'residence') { expect(request.child.residence).not.toBeNull(); request.child.residenceSource = 'typed'; }
    if (kind === 'fact') { expect(request.facts.length).toBeGreaterThan(0); request.facts[0].source = 'typed'; }
    if (kind === 'story_place') { expect(request.storyPlace).not.toBeNull(); request.storyPlace!.source = 'typed'; }
    expect(() => preparePersonalStory(request, options)).not.toThrow();
    expect(() => buildStoryComparison(manifest, options)).toThrow('story_comparison_synthetic_registry');
  });
  it('is reproducible for a frozen seed and escapes story markup', async () => {
    const { manifest } = await fixture(); const result: any = manifest.cases[0].improvedDraft.result;
    result.manuscript.pages[0].text += ' <img src=x onerror=alert(1)>';
    manifest.cases[0].improvedEdited = null as any;
    const first = buildStoryComparison(manifest, options); const second = buildStoryComparison(manifest, options);
    expect(first).toEqual(second);
    const html = renderBlindStoryComparison(first.blind);
    expect(html).toContain('&lt;img'); expect(html).not.toContain('<img src=x');
  });
  it('offline packager has no provider, key, process env, fetch or execute flag', () => {
    for (const file of ['scripts/personal-story-comparison-package.ts', 'lib/personal-wizard/story-comparison.ts']) {
      const code = readFileSync(file, 'utf8');
      expect(code).not.toMatch(/from ['"]openai|createPersonalStoryProvider|OPENAI_API_KEY|process\.env|fetch\(|--execute|--env-file/);
    }
  });
  it('actual offline command separates final critique and private evidence, refuses output reuse and path traversal', async () => {
    const { manifest } = await fixture();
    const temporary = mkdtempSync(path.join(tmpdir(), 'personal-comparison-spec-'));
    try {
      const outputs = path.join(temporary, 'outputs'); mkdirSync(outputs);
      const file = path.join(temporary, 'manifest.json'); writeFileSync(file, JSON.stringify(manifest), { flag: 'wx' });
      const originalResolve = path.resolve.bind(path);
      vi.spyOn(path, 'resolve').mockImplementation((...parts) => parts.length === 1 && parts[0] === 'outputs' ? outputs : originalResolve(...parts));
      vi.spyOn(console, 'log').mockImplementation(() => {});
      packageMain(['--manifest', file, '--output-name', 'synthetic-sample']);
      const root = path.join(outputs, 'synthetic-sample');
      const final = readFileSync(path.join(root, 'review-final/review.json'), 'utf8');
      expect(final).not.toMatch(/firstDraftPairs|editingPairs|premisePairs|PRIVATE_SELECTION_SENTINEL|PRIVATE_EDITOR_SENTINEL|PRIVATE_SEED_SENTINEL/);
      expect(final).not.toContain('Choose A');
      for (const phase of STORY_REVIEW_PHASES) {
        const packet = JSON.parse(readFileSync(path.join(root, `review-${phase}/review.json`), 'utf8'));
        expect(packet).toEqual(storyReviewPacket(buildStoryComparison(manifest, options).blind, phase));
        const html = readFileSync(path.join(root, `review-${phase}/index.html`), 'utf8');
        expect(html).toBe(renderBlindStoryComparison(buildStoryComparison(manifest, options).blind, phase));
        expect(packet).not.toHaveProperty(phase === 'final' ? 'pairs' : 'finalTexts');
        if (phase === 'first-drafts') expect(packet.pairs).toHaveLength(1);
        if (phase === 'editing') expect(packet.pairs).toHaveLength(2);
        if (phase === 'premises') expect(packet.pairs).toHaveLength(1);
      }
      expect(readFileSync(path.join(root, 'private-evidence.json'), 'utf8')).toContain('PRIVATE_SELECTION_SENTINEL');
      expect(() => packageMain(['--manifest', 'does-not-exist', '--output-name', 'synthetic-sample'])).toThrow('already_exists');
      expect(() => packageMain(['--manifest', file, '--output-name', '../escape'])).toThrow('arguments');
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
  it.each(['binding', 'schema'])('actual offline command leaves no package behind after rejecting a %s-invalid manifest', async kind => {
    const { manifest } = await fixture();
    if (kind === 'binding') manifest.cases[0].improvedDraft.sourceCommit = oldCommit;
    else manifest.version = 'unsupported-comparison-version';
    const temporary = mkdtempSync(path.join(tmpdir(), 'personal-comparison-rejected-spec-'));
    try {
      const outputs = path.join(temporary, 'outputs'); mkdirSync(outputs);
      const file = path.join(temporary, 'manifest.json'); writeFileSync(file, JSON.stringify(manifest), { flag: 'wx' });
      const originalResolve = path.resolve.bind(path);
      vi.spyOn(path, 'resolve').mockImplementation((...parts) => parts.length === 1 && parts[0] === 'outputs' ? outputs : originalResolve(...parts));
      const before = readdirSync(outputs); const root = path.join(outputs, 'rejected-sample');
      const run = () => packageMain(['--manifest', file, '--output-name', 'rejected-sample']);
      if (kind === 'binding') expect(run).toThrow('story_comparison_request_or_commit');
      else expect(run).toThrow();
      expect(existsSync(root)).toBe(false); expect(readdirSync(outputs)).toEqual(before);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
});
