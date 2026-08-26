import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractSourceFromMarkdown } from '../../scripts/extract-visual-contract-sources';
import {
  auditReviewedActionSemanticIntents,
  type ReviewedActionSemanticIntent,
} from '../visual-contract-compiler/actionSemanticRepresentabilityAudit';
import type { TemplateCompileInput } from '../visual-contract-compiler/compileBookVisualContractTemplate';
import { extractDeterministicFacts } from '../visual-contract-compiler/extractDeterministicFacts';
import { runOfflineRepairHarness } from '../visual-contract-compiler/offlineRepairHarness';

const QA_BANK = path.join(process.cwd(), 'story-bank/qa-autonomous-20260815-v1');
const APPROVED_BANK = path.join(process.cwd(), 'story-bank/v3-approved');
const VISUAL_DIRECTIONS_PATH = path.join(
  process.cwd(),
  'story-pipeline/05_storyboard_inputs/autonomous-20260815-v1/chameleon_koko_bedtime.visual-directions.json',
);

interface VisualDirectionPage {
  pageNumber: number;
  settingKey: string;
  setting: string;
  childPresence: 'present' | 'partial' | 'absent';
  companionPresence: 'present' | 'partial' | 'absent';
  mainAction: string;
  shotType: string;
  cameraAngle: string;
  lighting: string;
}

function chameleonSource(): TemplateCompileInput {
  return extractSourceFromMarkdown(
    'chameleon_koko_bedtime',
    fs.readFileSync(path.join(QA_BANK, 'chameleon_koko_bedtime.md'), 'utf8'),
  ) as TemplateCompileInput;
}

function visualDirections(): VisualDirectionPage[] {
  return (JSON.parse(fs.readFileSync(VISUAL_DIRECTIONS_PATH, 'utf8')) as {
    pages: VisualDirectionPage[];
  }).pages;
}

function sourceEvidenceId(pageNumber: number, needle: string): string {
  const entry = chameleonSource().sourceEvidenceCatalog.entries.find(
    (candidate) =>
      candidate.pageNumber === pageNumber && candidate.excerpt.includes(needle),
  );
  if (!entry) {
    throw new Error(`missing Chameleon calibration evidence on page ${pageNumber}`);
  }
  return entry.sourceEvidenceId;
}

function actionIntent(args: Omit<
  Extract<ReviewedActionSemanticIntent, { representation: 'action_requirement' }>,
  'sourceEvidenceId'
> & { evidenceNeedle: string }): ReviewedActionSemanticIntent {
  const { evidenceNeedle, ...intent } = args;
  return {
    ...intent,
    sourceEvidenceId: sourceEvidenceId(intent.pageNumber, evidenceNeedle),
  };
}

function reviewedChameleonIntents(): ReviewedActionSemanticIntent[] {
  return [
    actionIntent({
      pageNumber: 1,
      beatKey: 'station_walks',
      evidenceNeedle: 'והתחילה ללכת',
      representation: 'action_requirement',
      predicate: 'walks',
      subjectKind: 'prop',
      subjectAuthority: 'available',
      objectKind: null,
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    {
      pageNumber: 2,
      beatKey: 'kim_blinks',
      sourceEvidenceId: sourceEvidenceId(2, 'מצמצה'),
      representation: 'review_required',
      candidatePredicate: 'blinks',
    },
    actionIntent({
      pageNumber: 2,
      beatKey: 'child_turns_station',
      evidenceNeedle: 'ניסתה לסובב',
      representation: 'action_requirement',
      predicate: 'turns',
      subjectKind: 'cast',
      subjectAuthority: 'available',
      objectKind: 'prop',
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    {
      pageNumber: 2,
      beatKey: 'bench_folds',
      sourceEvidenceId: sourceEvidenceId(2, 'התקפל'),
      representation: 'review_required',
      candidatePredicate: 'folds',
    },
    actionIntent({
      pageNumber: 3,
      beatKey: 'child_climbs_bench',
      evidenceNeedle: 'טיפסה על הספסל',
      representation: 'action_requirement',
      predicate: 'climbs_onto',
      subjectKind: 'cast',
      subjectAuthority: 'available',
      objectKind: 'prop',
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    {
      pageNumber: 4,
      beatKey: 'baker_sings',
      sourceEvidenceId: sourceEvidenceId(4, 'האופה שר בקול'),
      representation: 'presentation_requirement',
      presentationClass: 'ambient_event',
    },
    actionIntent({
      pageNumber: 4,
      beatKey: 'child_listens',
      evidenceNeedle: 'הקשיבה איתה לעיר',
      representation: 'action_requirement',
      predicate: 'listens_to',
      subjectKind: 'cast',
      subjectAuthority: 'available',
      objectKind: 'spatial',
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    {
      pageNumber: 4,
      beatKey: 'child_nods',
      sourceEvidenceId: sourceEvidenceId(4, 'הנהנה'),
      representation: 'review_required',
      candidatePredicate: 'nods',
    },
    actionIntent({
      pageNumber: 5,
      beatKey: 'station_runs',
      evidenceNeedle: 'רצה אחריו',
      representation: 'action_requirement',
      predicate: 'runs',
      subjectKind: 'prop',
      subjectAuthority: 'available',
      objectKind: null,
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    actionIntent({
      pageNumber: 5,
      beatKey: 'station_waves',
      evidenceNeedle: 'נופפה בלוח הזמנים',
      representation: 'action_requirement',
      predicate: 'waves',
      subjectKind: 'prop',
      subjectAuthority: 'available',
      objectKind: null,
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    actionIntent({
      pageNumber: 6,
      beatKey: 'child_places_backpack',
      evidenceNeedle: 'הניחה את תיק הגב',
      representation: 'action_requirement',
      predicate: 'places',
      subjectKind: 'cast',
      subjectAuthority: 'available',
      objectKind: 'prop',
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    actionIntent({
      pageNumber: 6,
      beatKey: 'bus_opens_door',
      evidenceNeedle: 'פתח את הדלת',
      representation: 'action_requirement',
      predicate: 'opens',
      subjectKind: 'prop',
      subjectAuthority: 'available',
      objectKind: 'anchor',
      spatialEffect: 'absent',
      spatialConstraint: null,
      laterality: 'absent',
    }),
    {
      pageNumber: 7,
      beatKey: 'cat_sits_on_bench',
      sourceEvidenceId: sourceEvidenceId(7, 'התיישב עליה חתול'),
      representation: 'review_required',
      candidatePredicate: 'sits_on',
    },
    {
      pageNumber: 7,
      beatKey: 'station_settles',
      sourceEvidenceId: sourceEvidenceId(7, 'פרשה את גגה והתמקמה'),
      representation: 'review_required',
      candidatePredicate: null,
    },
    {
      pageNumber: 8,
      beatKey: 'bedtime_sleep_state',
      sourceEvidenceId: sourceEvidenceId(8, 'נכנסה {{childName}} למיטה'),
      representation: 'presentation_requirement',
      presentationClass: 'static_state',
    },
  ];
}

function calibrationDraft(): Record<string, unknown> & {
  pageContracts: Array<Record<string, unknown>>;
} {
  const source = chameleonSource();
  const directions = visualDirections();
  const base = JSON.parse(
    fs.readFileSync(
      path.join(APPROVED_BANK, 'bunny_ometz_adventure.visual-contract-template.json'),
      'utf8',
    ),
  ) as Record<string, unknown> & {
    cast: Record<string, Record<string, unknown>>;
  };
  const settingKeys = [...new Set(directions.map((page) => page.settingKey))];
  const directionBySetting = new Map(
    directions.map((page) => [page.settingKey, page]),
  );

  base.worldType = 'grounded_storybook_city_with_gentle_anthropomorphism';
  base.locations = settingKeys.map((settingKey) => {
    const direction = directionBySetting.get(settingKey)!;
    return {
      id: settingKey,
      name: direction.setting,
      description: direction.setting,
      timeOfDay: 'evening_to_night',
      environmentClass: settingKey === 'child_bedroom' ? 'indoor' : 'outdoor',
      lighting: direction.lighting,
      anchors: [],
      topology: `one review-only calibration location: ${direction.setting}`,
    };
  });
  base.zones = settingKeys.map((settingKey) => ({
    id: `${settingKey}.primary`,
    locationId: settingKey,
    name: `${directionBySetting.get(settingKey)!.setting} primary zone`,
    description: directionBySetting.get(settingKey)!.setting,
    stableGeometry: [
      `the same ${directionBySetting.get(settingKey)!.setting} geometry within this page`,
    ],
  }));
  base.humanCast = [];
  base.recurringProps = [];
  base.forbiddenGlobalElements = [
    'duplicate child or duplicate companion',
    'daylight after the story reaches night',
  ];
  base.cast.companion = {
    id: 'companion:chameleon_koko',
    role: 'companion',
    name: 'קִים',
    wardrobe: {
      description:
        'Kim the small chameleon with one bright orange nose and one mustard shoulder satchel',
      forbidden: [
        'duplicate Kim',
        'a changed nose colour',
        'a replacement accessory',
      ],
    },
  };
  base.coverContract = {
    worldType: base.worldType,
    locationId: directions[0]!.settingKey,
    timeOfDay: 'evening',
    mustShow: [
      'the child and Kim beside the walking bus stop at dusk',
      'the walking bus stop beginning its gentle journey home',
    ],
    mustNotShow: [
      'duplicate child or duplicate Kim',
      'the final garden home reveal',
    ],
  };
  base.pageContracts = directions.map((direction, pageIndex) => {
    const evidence = source.sourceEvidenceCatalog.entries.find(
      (candidate) => candidate.pageNumber === direction.pageNumber,
    );
    if (!evidence) throw new Error('missing calibration page evidence');
    return {
      pageNumber: direction.pageNumber,
      locationId: direction.settingKey,
      zoneId: `${direction.settingKey}.primary`,
      sameLocationAs: null,
      mustShow: [direction.setting, direction.mainAction],
      mustNotShow: ['duplicate child or duplicate Kim'],
      characterPresence: {
        child: direction.childPresence !== 'absent',
        companion: direction.companionPresence !== 'absent',
      },
      propState: [],
      propConstraints: [],
      actionRequirements: [],
      camera: `${direction.shotType} ${direction.cameraAngle}`,
      castIds: [
        ...(direction.childPresence === 'absent' ? [] : ['child:hero']),
        ...(direction.companionPresence === 'absent'
          ? []
          : ['companion:chameleon_koko']),
      ],
      transition:
        pageIndex === 0 ||
        directions[pageIndex - 1]!.settingKey === direction.settingKey
          ? { kind: 'steady' }
          : {
              kind: 'after_transition',
              fromZoneId: `${directions[pageIndex - 1]!.settingKey}.primary`,
              toZoneId: `${direction.settingKey}.primary`,
              cue: direction.mainAction,
            },
      actionSemanticCoverage: [
        {
          beatId: `beat:p${direction.pageNumber}:calibration_main_action`,
          sourceEvidenceId: evidence.sourceEvidenceId,
          disposition: {
            kind: 'presentation_requirement',
            presentationClass: 'composition_focus',
            mustShowIndex: 1,
          },
        },
      ],
    };
  });
  return base as unknown as Record<string, unknown> & {
    pageContracts: Array<Record<string, unknown>>;
  };
}

describe('Chameleon action representability calibration', () => {
  it('separates catalog, subject-domain, presentation and review decisions', () => {
    const source = chameleonSource();
    const audit = auditReviewedActionSemanticIntents(
      reviewedChameleonIntents(),
      source.sourceEvidenceCatalog,
    );

    expect(audit).toMatchObject({
      version: 'action-semantic-representability-audit/v1',
      catalogVersion: 'action-semantic-catalog/v3',
      status: 'review_evidence_only',
      authorizes: [],
      intentCount: 15,
      representableCount: 5,
      actionGapCount: 5,
      reviewRequiredCount: 5,
    });
    expect(
      audit.items
        .filter((item) => item.status === 'representable_action')
        .map((item) => item.beatKey),
    ).toEqual([
      'child_climbs_bench',
      'child_listens',
      'child_places_backpack',
    ]);
    expect(
      audit.items
        .filter((item) => item.status === 'action_gap')
        .map((item) => [item.beatKey, item.gaps]),
    ).toEqual([
      ['station_walks', ['subject_kind_unsupported']],
      ['child_turns_station', ['object_forbidden']],
      ['station_runs', ['predicate_missing']],
      ['station_waves', ['subject_kind_unsupported']],
      ['bus_opens_door', ['subject_kind_unsupported']],
    ]);
    expect(
      audit.items
        .filter((item) => item.status === 'representable_presentation')
        .map((item) => item.beatKey),
    ).toEqual(['baker_sings', 'bedtime_sleep_state']);
    expect(JSON.stringify(audit)).not.toMatch(
      /sourcePhrase|contractValue|mainAction|systemPrompt|userPrompt/i,
    );
  });

  it('fails closed on duplicate or malformed reviewed identities', () => {
    const source = chameleonSource();
    const catalog = source.sourceEvidenceCatalog;
    const intent = reviewedChameleonIntents()[0]! as Extract<
      ReviewedActionSemanticIntent,
      { representation: 'action_requirement' }
    >;
    expect(() =>
      auditReviewedActionSemanticIntents(
        [intent, structuredClone(intent)],
        catalog,
      ),
    ).toThrow('action_semantic_audit_beat_duplicate');
    expect(() =>
      auditReviewedActionSemanticIntents([
        {
          ...intent,
          sourceEvidenceId: 'not-current-source-evidence',
        },
      ], catalog),
    ).toThrow('action_semantic_audit_source_evidence_id_malformed');
    expect(() =>
      auditReviewedActionSemanticIntents([
        {
          ...intent,
          sourceEvidenceId: `se1_${'0'.repeat(64)}`,
        },
      ], catalog),
    ).toThrow('action_semantic_audit_source_evidence_id_unknown');
    expect(() =>
      auditReviewedActionSemanticIntents([
        {
          ...intent,
          pageNumber: 2,
        },
      ], catalog),
    ).toThrow('action_semantic_audit_source_evidence_id_wrong_page');
    expect(() =>
      auditReviewedActionSemanticIntents([
        {
          ...intent,
          beatKey: 'Story Phrase Must Not Become Identity',
        },
      ], catalog),
    ).toThrow('action_semantic_audit_beat_key_invalid');
    expect(() =>
      auditReviewedActionSemanticIntents([
        {
          ...intent,
          predicate: 'source phrase must not become a candidate',
        },
      ], catalog),
    ).toThrow('action_semantic_audit_candidate_predicate_invalid');
  });

  it('proves the exact source and visual-direction surface accepts the prefixed companion mention offline', async () => {
    const input = chameleonSource();
    const facts = extractDeterministicFacts(input);
    expect(input.pages[6]!.text).toContain('וקִים');
    expect(visualDirections()[6]).toMatchObject({
      pageNumber: 7,
      childPresence: 'partial',
      companionPresence: 'partial',
    });
    expect(facts.companionPresentPages).toContain(7);

    const draft = calibrationDraft();
    const result = await runOfflineRepairHarness({
      input,
      initialDraft: draft,
    });

    expect(result.providerCalls).toBe(0);
    expect(result.outcome).toBe('candidate');
    expect(result.calls.map((call) => call.repairMode)).toEqual([null]);
    expect(result.stages).toEqual([
      expect.objectContaining({
        attempt: 1,
        surfacedIssueCount: 0,
        completeIssueCount: 0,
        classification: 'baseline',
      }),
    ]);
    expect(result.actionCoverageCensuses).toHaveLength(1);
    expect(
      result.actionCoverageCensuses.every(
        (census) =>
          census.records.length === 8 &&
          census.records.every(
            (record) =>
              record.dispositionKind === 'presentation_requirement' &&
              record.attemptedPredicates.length === 0,
          ),
      ),
    ).toBe(true);
  });
});
