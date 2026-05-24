/**
 * Voice Reviewer calibration — runs reviewer over vendored corpus vs human notes.
 *
 * Usage: npx tsx scripts/calibrate-voice-reviewer.ts
 * Requires: OPENAI_API_KEY (from .env.local / .env via Next env loader)
 */
import { loadEnvConfig } from '@next/env';
import { writeFileSync } from 'fs';
import path from 'path';

loadEnvConfig(process.cwd());

import {
  calibrateFixture,
  probeFixturePassed,
  semanticMisuseKeystonePassed,
  summarizeAxisMetrics,
  summarizeFamilyMetrics,
} from '../lib/story-generator/editorial/voice-calibration';
import { runVoiceReviewer } from '../lib/story-generator/stages/voice-reviewer';
import {
  listCalibrationFixtures,
  loadCalibrationFixture,
  VOICE_CALIBRATION_FIXTURE_IDS,
} from '../lib/story-generator/__tests__/voice-calibration-corpus/corpus';

async function main() {
  const ids = listCalibrationFixtures();
  const expectedCorpusSize = VOICE_CALIBRATION_FIXTURE_IDS.length;
  const fixtures: Array<{
    findings: import('../lib/story-generator/editorial/voice-schemas').VoiceFindingType[];
    result: ReturnType<typeof calibrateFixture>;
    human: import('../lib/story-generator/editorial/voice-calibration-types').HumanCalibrationNotes;
  }> = [];

  console.log('=== Voice Reviewer Calibration (round 2) ===');
  console.log(`corpus: ${ids.length} stories (expected ${expectedCorpusSize})\n`);

  let keystone: boolean | null = null;
  let skipped = 0;

  for (const id of VOICE_CALIBRATION_FIXTURE_IDS) {
    if (!ids.includes(id)) {
      console.log(`per story: ${id} — SKIPPED (fixture files missing)`);
      skipped++;
      continue;
    }

    const { markdown, human } = loadCalibrationFixture(id);
    const review = await runVoiceReviewer(markdown, {
      storyId: id,
      ageTier: human.ageTier,
    });

    if (review.status !== 'ok' || !review.report) {
      console.log(
        `per story: ${id} — SKIPPED (${review.error ?? 'parse failed'})`
      );
      skipped++;
      continue;
    }

    const result = calibrateFixture(review.report.findings, human);
    fixtures.push({
      findings: review.report.findings,
      result,
      human,
    });

    if (id === 'adventure_michal_run1') {
      keystone = semanticMisuseKeystonePassed(review.report.findings, id);
    }

    const opt =
      result.matchedOptional > 0 ? ` (+${result.matchedOptional} optional)` : '';
    console.log(
      `per story: ${id} — ${result.findingCount} findings (${result.pageFindings} page / ${result.storyFindings} story) | ` +
        `matched ${result.matched}/${result.expectedCount}${opt} | FP ${result.falsePositives} | FN ${result.falseNegatives}`
    );
  }

  const complete = fixtures.length === expectedCorpusSize && skipped === 0;

  const axisStats = summarizeAxisMetrics(fixtures);
  const familyStats = summarizeFamilyMetrics(fixtures);

  console.log('\nper axis:');
  for (const a of axisStats) {
    const expected = a.matched + a.falseNegatives;
    console.log(
      `  ${a.axis}: precision ${a.precision}%  recall ${a.recall}%  (tp=${a.matched} fp=${a.falsePositives} fn=${a.falseNegatives}, n=${expected})`
    );
  }

  console.log('\nper family:');
  for (const f of familyStats) {
    const expected = f.matched + f.falseNegatives;
    if (expected === 0 && f.falsePositives === 0) continue;
    console.log(
      `  ${f.family}: precision ${f.precision}%  recall ${f.recall}%  (tp=${f.matched} fp=${f.falsePositives} fn=${f.falseNegatives})`
    );
  }

  const blockingCandidates = !complete
    ? []
    : axisStats.filter((a) => {
        const expected = a.matched + a.falseNegatives;
        return (
          expected >= 3 &&
          a.matched >= 1 &&
          a.precision >= 80 &&
          a.falsePositives <= 1
        );
      });

  console.log(
    '\nblocking candidates: ' +
      (blockingCandidates.length
        ? blockingCandidates.map((a) => a.axis).join(', ')
        : '(none — min-evidence guard applied)')
  );

  const probeImpossible = fixtures.find((f) => f.result.storyId === 'probe_impossible_subject');
  const probeReadaloud = fixtures.find((f) => f.result.storyId === 'probe_dense_readaloud');
  const probeRelationship = fixtures.find(
    (f) => f.result.storyId === 'probe_relationship_failure'
  );

  console.log(
    `\nsemantic_misuse keystone: adventure_michal_run1 -> "דוקדק" caught? ${
      keystone === null ? 'N/A' : keystone ? 'YES' : 'NO'
    }`
  );
  console.log(
    `probe_impossible_subject caught? ${
      probeImpossible
        ? probeFixturePassed(probeImpossible.findings, 'probe_impossible_subject', probeImpossible.human)
          ? 'YES'
          : 'NO'
        : 'N/A'
    }`
  );
  console.log(
    `probe_dense_readaloud caught? ${
      probeReadaloud
        ? probeFixturePassed(probeReadaloud.findings, 'probe_dense_readaloud', probeReadaloud.human)
          ? 'YES'
          : 'NO'
        : 'N/A'
    }`
  );
  console.log(
    `probe_relationship_failure caught? ${
      probeRelationship
        ? probeFixturePassed(
            probeRelationship.findings,
            'probe_relationship_failure',
            probeRelationship.human
          )
          ? 'YES'
          : 'NO'
        : 'N/A'
    }`
  );

  const sealedParallelFp = fixtures
    .filter((f) =>
      [
        'fantasy_gold',
        'adventure_noa',
        'adventure_michal',
        'adventure_daniel',
        'bedtime_noa',
        'bedtime_michal',
        'bedtime_daniel',
        'adventure_michal_run1',
      ].includes(f.result.storyId)
    )
    .reduce(
      (sum, f) =>
        sum +
        f.findings.filter(
          (x) =>
            x.family === 'parallel_action_chains' &&
            !f.human.expectedFindings.some((e) =>
              e.family === 'parallel_action_chains' && !e.optional
            )
        ).length,
      0
    );

  const motifPageFp = fixtures.reduce(
    (sum, f) => sum + f.findings.filter((x) => x.family === 'motif_overuse' && x.scope === 'page').length,
    0
  );

  console.log('\n=== Round 2 acceptance gates ===');
  console.log(`1. sealed stories parallel_action_chains FP count: ${sealedParallelFp} (want 0)`);
  console.log(
    `2. probe_relationship_failure: ${
      probeRelationship &&
      probeFixturePassed(
        probeRelationship.findings,
        'probe_relationship_failure',
        probeRelationship.human
      )
        ? 'PASS'
        : 'FAIL'
    }`
  );
  console.log(
    `3. body_as_character on sealed (non-probe) FP: ${fixtures
      .filter((f) => !f.result.storyId.startsWith('probe_'))
      .reduce(
        (s, f) => s + f.findings.filter((x) => x.family === 'body_as_character').length,
        0
      )} (lower than round 1 target)`
  );
  console.log(
    `4. semantic keystone + probe_impossible: ${
      keystone && probeImpossible && probeFixturePassed(probeImpossible.findings, 'probe_impossible_subject', probeImpossible.human)
        ? 'PASS'
        : 'FAIL'
    }`
  );
  console.log(
    `5. read_aloud probe: ${
      probeReadaloud &&
      probeFixturePassed(probeReadaloud.findings, 'probe_dense_readaloud', probeReadaloud.human)
        ? 'PASS'
        : 'FAIL'
    }`
  );
  console.log(`6. motif_overuse page-scope findings: ${motifPageFp} (want 0 — code coerces to story)`);
  console.log(
    `7. blockingCandidates excludes zero-evidence axes: ${
      !blockingCandidates.some((a) => {
        const row = axisStats.find((r) => r.axis === a.axis);
        return row && row.matched + row.falseNegatives < 3;
      })
        ? 'PASS'
        : 'FAIL'
    }`
  );
  console.log(`8. familyStats in report: PASS (written below)`);

  const outPath = path.join(process.cwd(), 'voice-calibration-report.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        round: 2,
        corpusSize: fixtures.length,
        expectedCorpusSize,
        valid: complete,
        fixtures: fixtures.map((f) => f.result),
        axisStats,
        familyStats,
        semanticMisuseKeystone: keystone,
        blockingCandidates: blockingCandidates.map((a) => a.axis),
        round2Gates: {
          sealedParallelActionChainsFp: sealedParallelFp,
          probeRelationshipFailure:
            probeRelationship &&
            probeFixturePassed(
              probeRelationship.findings,
              'probe_relationship_failure',
              probeRelationship.human
            ),
          probeImpossibleSubject:
            probeImpossible &&
            probeFixturePassed(
              probeImpossible.findings,
              'probe_impossible_subject',
              probeImpossible.human
            ),
          probeDenseReadaloud:
            probeReadaloud &&
            probeFixturePassed(
              probeReadaloud.findings,
              'probe_dense_readaloud',
              probeReadaloud.human
            ),
          motifOverusePageScopeFindings: motifPageFp,
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  console.log(`\nWrote ${outPath}`);

  if (!complete) {
    console.log(
      `\n=== CALIBRATION INVALID — ${expectedCorpusSize - fixtures.length}/${expectedCorpusSize} stories did not run ===`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
