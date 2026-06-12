/**
 * Sprint 11 catalog production — premise tournament + optional structure phase.
 *
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-sprint-11-slot.ts --slot=1
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-sprint-11-slot.ts --slot=1 --phase=structure --premise=uri_premise_10 --source=<premise-run-dir>
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-sprint-11-slot.ts --slot=1 --phase=prose --source=<structure-run-dir>
 *
 * Premise → structure → prose HARD STOPs — human gate between each phase. No render.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';

import { extractAllGoldenPremises } from '../lib/story-gen-v3/golden-premise-extract';
import { runMomentumGateBeforeProse } from '../lib/story-gen-v3/momentum-gate';
import { runPremiseTournament } from '../lib/story-gen-v3/premise-tournament';
import { buildSprintAReport } from '../lib/story-gen-v3/report';
import { hasDiniCollapseResidue } from '../lib/story-gen-v3/premise-normalize';
import {
  getDefaultHardenedPremise,
  loadPremiseFromRun,
  runPhase2SpineAndBeats,
} from '../lib/story-gen-v3/spine-beats-gen';
import { normalizePartialGenderChips } from '../lib/story-gen/chip-normalize';
import { applyTtsAmbiguityNiqqudPass } from '../lib/story-gen-v2/tts-ambiguity-niqqud';
import { generateProseV3 } from '../lib/story-gen-v3/prose-gen-v3';
import { rerunStop3Gates } from '../lib/story-gen-v3/stop3-gates';
import { sprint11SpecForSlot } from '../lib/story-gen-v3/sprint-11-specs';
import {
  applyUriP10StructureGateBeatRepairs,
  URI_P10_PROSE_MANDATES,
} from '../lib/story-gen-v3/uri-p10-beat-repairs';
import { applyV3ChipArtifactFixes } from '../lib/story-gen-v3/chip-artifact-fix';
import type {
  GoldenPremiseRecord,
  PageBeatV3,
  StoryPremiseCandidate,
  StorySpineV3,
} from '../lib/story-gen-v3/types';

const CONTAMINATION_RE =
  /דיני|דרקון|עטיפה|פופקורן|הגנה דרקונית|העטיפה\/החזקה/i;

const MODEL_ID = 'gpt-5-chat-latest';

function parseSlot(): number {
  const raw = process.argv.find((a) => a.startsWith('--slot='))?.split('=')[1];
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Usage: --slot=1 [--phase=structure --premise=<id> --source=<run-dir>]');
  }
  return n;
}

function parsePhase(): 'premise' | 'structure' | 'prose' {
  const raw = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1];
  if (raw === 'structure') return 'structure';
  if (raw === 'prose') return 'prose';
  return 'premise';
}

function parsePremiseId(): string {
  const raw = process.argv.find((a) => a.startsWith('--premise='))?.split('=')[1];
  if (!raw?.trim()) {
    throw new Error('--phase=structure requires --premise=<id> (e.g. uri_premise_10)');
  }
  return raw.trim();
}

function parseSourceDir(phase: 'structure' | 'prose'): string {
  const raw = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1];
  if (!raw?.trim()) {
    throw new Error(
      phase === 'prose'
        ? '--phase=prose requires --source=<structure-run-dir>'
        : '--phase=structure requires --source=<premise-tournament-run-dir>'
    );
  }
  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source run dir not found: ${resolved}`);
  }
  return resolved;
}

function resolveHardenedPremise(premiseId: string, sourceDir: string): StoryPremiseCandidate {
  try {
    return getDefaultHardenedPremise(premiseId);
  } catch {
    const fromRun = loadPremiseFromRun(sourceDir, premiseId);
    if (!fromRun) {
      throw new Error(`No hardened premise for ${premiseId} and not found in ${sourceDir}`);
    }
    return fromRun;
  }
}

async function runStructurePhase(slot: number): Promise<void> {
  const spec = sprint11SpecForSlot(slot);
  if (!spec) throw new Error(`Sprint 11 slot ${slot} spec not defined yet`);

  const premiseId = parsePremiseId();
  const sourceDir = parseSourceDir('structure');
  const premise = resolveHardenedPremise(premiseId, sourceDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'sprint-11-runs',
    `slot${String(slot).padStart(2, '0')}-${spec.id}-structure-${premiseId}-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'guy-approved-premise.json'),
    JSON.stringify({ premiseId, sourceDir, approvedAt: 'Guy 2026-06-12' }, null, 2)
  );

  console.log(`[sprint-11] slot #${slot} structure (harden → spine → beats → momentum) → ${runDir}`);
  console.log(`[sprint-11] premise: ${premise.id} — ${premise.oneLineHook}`);

  const { spine, beats, spineHardFails, beatHardFails } = await runPhase2SpineAndBeats({
    premise,
    spec,
    runDir,
    modelId: MODEL_ID,
    pageCount: spec.pageCount,
    sourceRunDir: sourceDir,
  });

  const momentum = runMomentumGateBeforeProse({ spine, beats, premise });
  fs.writeFileSync(
    path.join(runDir, 'momentum-report-before-prose.json'),
    JSON.stringify(momentum, null, 2)
  );

  const beatTable = beats
    .map(
      (b) =>
        `| ${b.page} | ${b.event.replace(/\|/g, '/').slice(0, 70)} | ${b.childDoes.replace(/\|/g, '/').slice(0, 50)} | ${b.whatChanges.replace(/\|/g, '/').slice(0, 50)} |`
    )
    .join('\n');

  const structureDoc = [
    `# Sprint 11 — Slot #${slot} structure gate (STOP before prose)`,
    '',
    `**Guy approved premise:** ${premiseId}`,
    `**Hook:** ${premise.oneLineHook}`,
    `**Source tournament:** \`${sourceDir}\``,
    '',
    '## Hardened premise',
    '',
    `- **titleSeed:** ${premise.titleSeed}`,
    `- **opening:** ${premise.openingWeirdEvent}`,
    `- **child want:** ${premise.childWant}`,
    `- **discovery:** ${premise.childDiscovery}`,
    `- **brave action:** ${premise.braveChildAction}`,
    `- **payoff:** ${premise.bigReleasePayoff}`,
    '',
    '## Story spine (oneSentenceEventChain)',
    '',
    spine.oneSentenceEventChain ?? '(missing)',
    '',
    '### Spine fields',
    '',
    `- **playSystem:** ${spine.playSystem}`,
    `- **firstTryFail:** ${spine.firstTryFail}`,
    `- **secondTryFail:** ${spine.secondTryFail}`,
    `- **toneGuard:** ${spine.toneGuard}`,
    '',
    '## Page beats',
    '',
    '| page | event | childDoes | whatChanges |',
    '|------|-------|-----------|-------------|',
    beatTable,
    '',
    '## Gates',
    '',
    `- spine hard fails: ${spineHardFails.length}${spineHardFails.length ? ` — ${spineHardFails.map((f) => f.code).join(', ')}` : ''}`,
    `- beat hard fails: ${beatHardFails.length}${beatHardFails.length ? ` — ${beatHardFails.map((f) => f.code).join(', ')}` : ''}`,
    `- momentum: ${momentum.pass ? '**PASS**' : '**FAIL**'} (childActionPages=${momentum.childActionPages})`,
    momentum.failures.length ? `- momentum failures: ${momentum.failures.join('; ')}` : '',
    momentum.warnings.length ? `- momentum warnings: ${momentum.warnings.join('; ')}` : '',
    '',
    '## STOP — Guy read spine/beats before prose',
    '',
    '- [ ] Arc feels drip-tick → leak-song specific (not generic shadow map)?',
    '- [ ] Child owns climax on bucket move?',
    '- [ ] Uri comic guard duty without solving?',
    '',
    `Artifacts: \`${runDir}\``,
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(path.join(runDir, 'STRUCTURE_GATE.md'), structureDoc, 'utf8');

  console.log('[sprint-11] HARD STOP before prose — see STRUCTURE_GATE.md');
  console.log(
    JSON.stringify(
      {
        runDir,
        premiseId: premise.id,
        spineHardFails: spineHardFails.length,
        beatHardFails: beatHardFails.length,
        momentumPass: momentum.pass,
        childActionPages: momentum.childActionPages,
      },
      null,
      2
    )
  );

  if (!momentum.pass || spineHardFails.length || beatHardFails.length) process.exitCode = 2;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

async function runProsePhase(slot: number): Promise<void> {
  const spec = sprint11SpecForSlot(slot);
  if (!spec) throw new Error(`Sprint 11 slot ${slot} spec not defined yet`);

  const structureDir = parseSourceDir('prose');
  const premiseId = 'uri_premise_10';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'sprint-11-runs',
    `slot${String(slot).padStart(2, '0')}-${spec.id}-prose-${premiseId}-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });

  for (const f of [
    'hardened-premise.json',
    'story-spine.json',
    'experiment-spec.json',
    'guy-approved-premise.json',
  ]) {
    const src = path.join(structureDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(runDir, f));
  }
  fs.writeFileSync(
    path.join(runDir, 'source-structure.json'),
    JSON.stringify({ structureDir, structureGateApproved: 'Guy + Claude 2026-06-12' }, null, 2)
  );

  const spine = readJson<StorySpineV3>(path.join(structureDir, 'story-spine.json'));
  let beats = readJson<PageBeatV3[]>(path.join(structureDir, 'page-beats.json'));
  beats = applyUriP10StructureGateBeatRepairs(beats);
  const premise =
    fs.existsSync(path.join(structureDir, 'hardened-premise.json'))
      ? readJson<StoryPremiseCandidate>(path.join(structureDir, 'hardened-premise.json'))
      : getDefaultHardenedPremise(premiseId);

  fs.writeFileSync(path.join(runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));
  fs.writeFileSync(path.join(runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));
  fs.writeFileSync(path.join(runDir, 'hardened-premise.json'), JSON.stringify(premise, null, 2));
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'structure-gate-beat-repairs.json'),
    JSON.stringify({ applied: ['p4 dry-railing causality', 'p8 conscious pretend play'], pages: [4, 8] }, null, 2)
  );

  console.log(`[sprint-11] slot #${slot} prose → ${runDir}`);
  console.log(`[sprint-11] structure source: ${structureDir}`);

  const generatedAt = new Date().toISOString();
  const { storyMarkdown: rawMd, inputTokens, outputTokens } = await generateProseV3({
    spec,
    spine,
    beats,
    premise,
    modelId: MODEL_ID,
    generatedAt,
    proseMandates: URI_P10_PROSE_MANDATES,
  });

  let md = applyV3ChipArtifactFixes(rawMd).markdown;
  const chipNorm = normalizePartialGenderChips(md);
  md = chipNorm.markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();
  md = applyV3ChipArtifactFixes(md).markdown;
  const { markdown: withNiqqud, applied: ttsApplied } = applyTtsAmbiguityNiqqudPass(md);
  md = withNiqqud;

  fs.writeFileSync(path.join(runDir, 'story.md'), md, 'utf8');
  if (ttsApplied.length) {
    fs.writeFileSync(
      path.join(runDir, 'tts-niqqud-applied.json'),
      JSON.stringify({ applied: ttsApplied }, null, 2)
    );
  }

  const gateResult = await rerunStop3Gates({ runDir, spec, premise, beats });

  const proseDoc = [
    `# Sprint 11 — Slot #${slot} prose gate (STOP before render)`,
    '',
    `**Premise:** ${premiseId} — ${premise.oneLineHook}`,
    `**Structure source:** \`${structureDir}\``,
    '',
    '## Structure-gate repairs applied to beats',
    '- p4: dry railing tap only — no water before bucket discovery',
    '- p8: "כאילו מישהו עונה" = conscious pretend (post-drip discovery p7)',
    '',
    '## Tokens',
    `in: ${inputTokens} / out: ${outputTokens}`,
    '',
    '## Automated gates',
    `- StoryAlive: ${gateResult.storyAliveVerdict}`,
    `- chip-safety: see chip-safety-report.json`,
    `- HebrewReadAloudEditor: ${gateResult.hebrewVerdict}`,
    `- read-back: ${gateResult.readBackPass ? 'PASS' : 'FAIL'}`,
    `- gatePassAutomated: ${gateResult.gatePassAutomated}`,
    '',
    '## STOP — Guy aloud read required',
    '',
    '- [ ] Guy read story.md aloud',
    '- [ ] No render until human prose approval',
    '',
    `Artifacts: \`${runDir}\``,
  ].join('\n');

  fs.writeFileSync(path.join(runDir, 'PROSE_GATE.md'), proseDoc, 'utf8');

  console.log('[sprint-11] HARD STOP before render — Guy aloud read. See PROSE_GATE.md');
  console.log(
    JSON.stringify(
      {
        runDir,
        storyAlive: gateResult.storyAliveVerdict,
        hebrew: gateResult.hebrewVerdict,
        readBack: gateResult.readBackPass,
        gatePassAutomated: gateResult.gatePassAutomated,
      },
      null,
      2
    )
  );

  if (!gateResult.gatePassAutomated) process.exitCode = 2;
}

function goldenMetaForIds(ids: string[]): Array<{
  id: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
}> {
  const COMPANION_FROM_ID: Record<string, string> = {
    fox_uri: 'fox_uri',
    panda_anat: 'panda_anat',
    bunny_ometz: 'bunny_ometz',
    chameleon_koko: 'chameleon_koko',
    dragon_dini: 'dragon_dini',
    lion_shaket: 'lion_shaket',
  };

  return ids.map((id) => {
    const prefix = id.replace(/_(bedtime|adventure|fantasy)$/, '');
    const companionId = COMPANION_FROM_ID[prefix] ?? prefix;
    const direction = id.includes('_bedtime')
      ? 'bedtime'
      : id.includes('_fantasy')
        ? 'fantasy'
        : 'adventure';
    return { id, companionId, direction };
  });
}

async function runPremisePhase(slot: number): Promise<void> {
  const spec = sprint11SpecForSlot(slot);
  if (!spec) throw new Error(`Sprint 11 slot ${slot} spec not defined yet`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(
    process.cwd(),
    'outputs',
    'sprint-11-runs',
    `slot${String(slot).padStart(2, '0')}-${spec.id}-${timestamp}`
  );
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'experiment-spec.json'), JSON.stringify(spec, null, 2));

  console.log(`[sprint-11] slot #${slot} premise tournament → ${runDir}`);

  const goldenIds = goldenMetaForIds(spec.calibrationGoldenIds);
  const goldenPremises: GoldenPremiseRecord[] = await extractAllGoldenPremises({
    goldenIds,
    modelId: MODEL_ID,
  });
  fs.writeFileSync(
    path.join(runDir, 'golden-premise.json'),
    JSON.stringify(goldenPremises, null, 2)
  );

  console.log('[sprint-11] generating 12 candidates + tournament...');
  const tournament = await runPremiseTournament({
    spec,
    goldenPremises,
    modelId: MODEL_ID,
  });

  fs.writeFileSync(
    path.join(runDir, 'premise-candidates.json'),
    JSON.stringify(
      tournament.candidates.map((s) => ({
        ...s.candidate,
        _meta: {
          disqualified: s.disqualified,
          hardFails: s.hardFails,
          scores: s.scores,
          weightedTotal: s.weightedTotal,
          judgeNotes: s.judgeNotes,
          criticAttacks: s.criticAttacks,
          diversityCluster: s.diversityCluster,
        },
      })),
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'premise-score-report.json'),
    JSON.stringify(
      {
        slot,
        specId: spec.id,
        category: spec.category,
        pageCount: spec.pageCount,
        candidates: tournament.candidates,
        topThree: tournament.topThree.map((t) => t.candidate.id),
        selectedId: tournament.selected.id,
        selectionReason: tournament.selectionReason,
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(runDir, 'selected-premise.json'),
    JSON.stringify(
      {
        selected: tournament.selected,
        selectionReason: tournament.selectionReason,
        topThree: tournament.topThree.map((t) => ({
          id: t.candidate.id,
          score: t.weightedTotal,
          disqualified: t.disqualified,
          oneLineHook: t.candidate.oneLineHook,
        })),
      },
      null,
      2
    )
  );

  const report = buildSprintAReport({ spec, runDir, goldenPremises, tournament });
  fs.writeFileSync(path.join(runDir, 'report.md'), report, 'utf8');

  const contaminationAudit = tournament.candidates.map((t) => {
    const c = t.candidate;
    const blob = [
      c.companionComicEngineUsed,
      c.companionWrongHelp,
      c.escalation,
      c.childDiscovery,
    ].join(' ');
    return {
      id: c.id,
      diniResidue: hasDiniCollapseResidue(c),
      contamination: CONTAMINATION_RE.test(blob),
      engine: c.companionComicEngineUsed?.slice(0, 80) ?? '',
    };
  });
  const diniHits = contaminationAudit.filter((a) => a.diniResidue || a.contamination).length;

  const premiseTable = tournament.candidates
    .map((t) => {
      const c = t.candidate;
      const gate = t.disqualified ? 'FAIL' : 'PASS';
      const engineSnippet = (c.companionComicEngineUsed ?? '').replace(/\|/g, '/').slice(0, 60);
      return `| ${c.id} | ${c.premiseFamily ?? '?'} | ${gate} | ${t.weightedTotal ?? '—'} | ${c.oneLineHook.replace(/\|/g, '/')} | ${engineSnippet} |`;
    })
    .join('\n');

  const stopDoc = [
    `# Sprint 11 — Slot #${slot} premise gate`,
    '',
    `**Spec:** ${spec.id}`,
    `**Matrix:** ${spec.category} · ${spec.direction} · ${spec.companionId} · ${spec.pageCount} beats`,
    `**Auto-selected:** ${tournament.selected.id} — ${tournament.selectionReason}`,
    '',
    '## Premise table (Guy picks — auto-select is advisory only)',
    '',
    `**Contamination audit:** ${diniHits}/12 with Dini/dragon/wrap/popcorn markers in creative fields (target: 0)`,
    '',
    '| id | family | gate | score | hook | companionComicEngineUsed (snippet) |',
    '|----|--------|------|-------|------|----------------------------------|',
    premiseTable,
    '',
    '### companionComicEngineUsed per candidate',
    '',
    ...contaminationAudit.map(
      (a) => `- **${a.id}**: ${a.engine || '(empty)'}${a.contamination ? ' ⚠️ CONTAMINATION' : ''}`
    ),
    '',
    '## Top 3',
    '',
    ...tournament.topThree.map((t, i) => {
      const c = t.candidate;
      return `${i + 1}. **${c.id}** (${t.weightedTotal ?? 'DQ'}) — ${c.oneLineHook}\n   - Opening: ${c.openingWeirdEvent}\n   - Payoff: ${c.bigReleasePayoff}`;
    }),
    '',
    '## STOP — Guy premise approval before spine/prose',
    '',
    '- [ ] Guy approved premise id: _______________',
    '- [ ] Do NOT run spine/beats/prose until checked',
    '',
    `Artifacts: \`${runDir}\``,
  ].join('\n');

  fs.writeFileSync(path.join(runDir, 'PREMISE_GATE.md'), stopDoc, 'utf8');

  console.log('[sprint-11] HARD STOP — Guy premise gate. See PREMISE_GATE.md + report.md');
  console.log(
    JSON.stringify(
      {
        runDir,
        slot,
        category: spec.category,
        companionId: spec.companionId,
        direction: spec.direction,
        pageCount: spec.pageCount,
        passedGate: tournament.candidates.filter((c) => !c.disqualified).length,
        autoSelected: tournament.selected.id,
        autoHook: tournament.selected.oneLineHook,
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const slot = parseSlot();
  const phase = parsePhase();
  if (phase === 'structure') {
    await runStructurePhase(slot);
    return;
  }
  if (phase === 'prose') {
    await runProsePhase(slot);
    return;
  }
  await runPremisePhase(slot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
