/**
 * Rewrite Preservation Validator — faithfulness gate (not taste).
 * A better story that is not the same story = FAIL.
 */

import { parseJsonFromLLM } from '../story-generator/llm';
import { getDeepProfile } from '../companion-deep-profiles';
import { callAdvisoryLlmJson } from './advisory-llm';
import { extractStoryBodyFromMarkdown } from './craft-rubric-v2';
import { formatScenarioPromptBlock } from './scenario-prompt-block';
import { extractTasteProseFromMarkdown } from './taste-judge';
import { pageProseOnly, parseStoryPages } from './story-page-utils';
import type { PhaseBScenario, Scenario, StoryOutline } from './story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';
import { isPhaseBScenario } from './scenario-prompt-block';

export const REWRITE_PRESERVATION_VERSION = 'rewrite-preservation-v1';

export type RewritePreservationVerdict = 'pass' | 'fail' | 'caution';

export type RewritePreservationFailureCode =
  | 'COMPANION_IDENTITY_CHANGED'
  | 'COMPANION_LAUNDERING'
  | 'SPECIES_CHANGED'
  | 'ENGINE_CHANGED'
  | 'SCENARIO_FLATTENED'
  | 'CHILD_AGENCY_CHANGED'
  | 'CLIMAX_CHANGED'
  | 'EMOTIONAL_PROBLEM_CHANGED'
  | 'DONOTWRITE_VIOLATION'
  | 'PAGE_COUNT_CHANGED'
  | 'BEAT_ORDER_CHANGED'
  | 'TITLE_OR_SCENARIO_DRIFT'
  | 'STRUCTURAL_REPLACEMENT';

export interface RewritePreservationReport {
  version: typeof REWRITE_PRESERVATION_VERSION;
  verdict: RewritePreservationVerdict;
  failureCodes: RewritePreservationFailureCode[];
  reasons: string[];
  deterministicChecks: {
    companionNamePreserved: boolean;
    noOtherKnownCompanionIntroduced: boolean;
    speciesPreserved: boolean | null;
    pageCountPreserved: boolean;
    titleStable: boolean | null;
    scenarioIdStable: boolean | null;
  };
  llmChecks?: {
    enginePreserved: boolean;
    childAgencyPreserved: boolean;
    climaxShapePreserved: boolean;
    emotionalProblemPreserved: boolean;
    scenarioDistinctnessPreserved: boolean;
    doNotWritePreserved: boolean;
  };
  evidence: {
    before?: string[];
    after?: string[];
  };
  modelId?: string;
}

interface CompanionSignature {
  id: string;
  label: string;
  markers: string[];
  isRosterCompanion: boolean;
}

const ROSTER_COMPANIONS: CompanionSignature[] = [
  { id: 'bolly_armadillo', label: 'Bolly', markers: ['בולי', 'בּוֹלִי', 'ארמדיל', 'armadillo', 'קליפה', 'שריון'], isRosterCompanion: true },
  { id: 'baby_elephant', label: 'Tubi', markers: ['טובי', 'טוּבִּי', 'טוּבִּי', 'פיל', 'elephant', 'חדק'], isRosterCompanion: true },
  { id: 'fox_uri', label: 'Uri', markers: ['אורי', 'אוּרִי', 'שועל', 'fox'], isRosterCompanion: true },
  { id: 'dragon_dini', label: 'Dini', markers: ['דיני', 'דִּינִי', 'דרקון', 'dragon', 'זנב'], isRosterCompanion: true },
  { id: 'song_whale', label: 'Shiru', markers: ['שירו', 'שִׁירוֹ', 'לוויתן', 'whale'], isRosterCompanion: true },
  { id: 'bunny_ometz', label: 'Ometz', markers: ['אומץ', 'ארנב', 'bunny', 'ארנבון'], isRosterCompanion: true },
  { id: 'chameleon_koko', label: 'Koko', markers: ['קוקו', 'קוֹקוֹ', 'זיקית', 'chameleon'], isRosterCompanion: true },
  { id: 'panda_anat', label: 'Anat', markers: ['ענת', 'פנדה', 'panda'], isRosterCompanion: true },
  { id: 'lion_shaket', label: 'Shaket', markers: ['שקט', 'אריה', 'lion', 'ארי'], isRosterCompanion: true },
  { id: 'dolphin_shahkan', label: 'Shachkan', markers: ['שחקן', 'שַׁחְקָן', 'דולפין', 'dolphin'], isRosterCompanion: true },
  { id: 'fawn_tzvi', label: 'Tzvi', markers: ['צבי', 'אייל', 'fawn'], isRosterCompanion: true },
];

const PROBE_COMPANIONS: CompanionSignature[] = [
  { id: 'probe_owl', label: 'Owl', markers: ['ינשוף', 'owl'], isRosterCompanion: false },
  { id: 'probe_cat', label: 'Cat', markers: ['חתול', 'cat'], isRosterCompanion: false },
  { id: 'probe_snail', label: 'Snail', markers: ['חילזון', 'snail'], isRosterCompanion: false },
  { id: 'probe_moth', label: 'Moth', markers: ['עש', 'עָשׁ', 'moth'], isRosterCompanion: false },
  { id: 'generic_owl', label: 'Owl', markers: ['ינשוף', 'owl'], isRosterCompanion: false },
  { id: 'fictional_anchor_snail', label: 'Snail', markers: ['חילזון', 'snail'], isRosterCompanion: false },
  { id: 'fictional_anchor_moth', label: 'Moth', markers: ['עש', 'עָשׁ', 'moth'], isRosterCompanion: false },
];

const ALL_COMPANIONS = [...ROSTER_COMPANIONS, ...PROBE_COMPANIONS];

function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

function normalizeForMatch(text: string): string {
  return stripHebrewDiacritics(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

function detectCompanionIds(text: string): string[] {
  const lower = normalizeForMatch(text);
  const hits: string[] = [];
  for (const c of ALL_COMPANIONS) {
    if (c.markers.some((m) => lower.includes(normalizeForMatch(m)))) hits.push(c.id);
  }
  return [...new Set(hits)];
}

function extractTitle(markdown: string): string | null {
  const m =
    markdown.match(/^title:\s*"([^"]+)"/m) ??
    markdown.match(/^title:\s*([^\n]+)/m) ??
    markdown.match(/title:\s*"([^"]+)"/);
  return m?.[1]?.trim() ?? null;
}

function extractYamlCompanionId(markdown: string): string | null {
  const m = markdown.match(/^companionId:\s*(\S+)/m);
  return m?.[1]?.trim() ?? null;
}

function prosePages(markdown: string): Array<{ page: number; prose: string }> {
  const body = extractStoryBodyFromMarkdown(markdown);
  return parseStoryPages(body).map(({ page, body: pageBody }) => ({
    page,
    prose: pageProseOnly(pageBody),
  }));
}

function pageOrderKey(pages: Array<{ page: number; prose: string }>): string {
  return pages.map((p) => `${p.page}:${p.prose.slice(0, 40)}`).join('|');
}

function firstMentionSnippet(text: string, marker: string): string | undefined {
  const idx = text.indexOf(marker);
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + marker.length + 40);
  return text.slice(start, end).trim();
}

interface RawPreservationLlm {
  enginePreserved?: boolean;
  childAgencyPreserved?: boolean;
  climaxShapePreserved?: boolean;
  emotionalProblemPreserved?: boolean;
  scenarioDistinctnessPreserved?: boolean;
  doNotWritePreserved?: boolean;
  failureCodes?: RewritePreservationFailureCode[];
  reasons?: string[];
  evidenceBefore?: string[];
  evidenceAfter?: string[];
}

function buildLlmSystemPrompt(): string {
  return `You are a rewrite faithfulness judge for Hebrew children's picture books.

Compare BEFORE and AFTER rewrite prose. This is NOT a taste judge.

QUESTION: Did the rewrite preserve the SAME story identity?

FAIL if the rewrite:
- changed companion identity, name, or species (e.g. owl → Bolly)
- introduced a different SmallHeroes roster companion
- changed companion engine / coping mechanism
- changed child agency moment materially
- changed climax shape materially
- changed core emotional problem
- flattened a specific scenario into a generic companion-default story
- violated doNotWrite / forbidden patterns
- replaced the story instead of improving prose

PASS only if the rewrite improved prose while keeping the same story contract.

Do NOT excuse companion/species swaps because the scenario YAML names a different companion. Judge BEFORE vs AFTER prose identity.

Pretty but replaced = FAIL.

Return ONLY valid JSON:
{
  "enginePreserved": boolean,
  "childAgencyPreserved": boolean,
  "climaxShapePreserved": boolean,
  "emotionalProblemPreserved": boolean,
  "scenarioDistinctnessPreserved": boolean,
  "doNotWritePreserved": boolean,
  "failureCodes": ["ENGINE_CHANGED" | ...],
  "reasons": ["string with Hebrew evidence"],
  "evidenceBefore": ["Hebrew quote"],
  "evidenceAfter": ["Hebrew quote"]
}

Prompt version: ${REWRITE_PRESERVATION_VERSION}`;
}

function buildLlmUserPrompt(args: {
  beforeMarkdown: string;
  afterMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
}): string {
  const beforePages = prosePages(args.beforeMarkdown);
  const afterPages = prosePages(args.afterMarkdown);
  const scenarioBlock = isPhaseBScenario(args.scenario)
    ? formatScenarioPromptBlock(args.scenario, args.scenario.companionId)
    : `scenarioId=${args.scenario.id} · companionId=${args.scenario.companionId}`;

  const beforeText = beforePages.map((p) => `p${p.page}: ${p.prose}`).join('\n');
  const afterText = afterPages.map((p) => `p${p.page}: ${p.prose}`).join('\n');

  return `Scenario contract:
${scenarioBlock}

Outline title: ${args.outline.title}
World rule: ${args.outline.worldRule}
Stakes: ${args.outline.metadata.stakes}

=== BEFORE PROSE ===
${beforeText}
=== END BEFORE ===

=== AFTER PROSE ===
${afterText}
=== END AFTER ===`;
}

const DETERMINISTIC_HARD_FAIL_CODES: RewritePreservationFailureCode[] = [
  'COMPANION_IDENTITY_CHANGED',
  'COMPANION_LAUNDERING',
  'SPECIES_CHANGED',
  'PAGE_COUNT_CHANGED',
  'BEAT_ORDER_CHANGED',
  'TITLE_OR_SCENARIO_DRIFT',
];

function mergeVerdict(
  failureCodes: RewritePreservationFailureCode[],
  llm?: RawPreservationLlm
): RewritePreservationVerdict {
  if (failureCodes.some((c) => DETERMINISTIC_HARD_FAIL_CODES.includes(c))) {
    return 'fail';
  }
  if (failureCodes.length > 0) return 'fail';
  if (llm) {
    const llmFails = [
      llm.enginePreserved === false,
      llm.childAgencyPreserved === false,
      llm.climaxShapePreserved === false,
      llm.emotionalProblemPreserved === false,
      llm.scenarioDistinctnessPreserved === false,
      llm.doNotWritePreserved === false,
    ].filter(Boolean).length;
    if (llmFails >= 2) return 'fail';
    if (llmFails === 1) return 'caution';
  }
  return 'pass';
}

export async function runRewritePreservationValidator(args: {
  beforeMarkdown: string;
  afterMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  modelId?: string;
  skipLlm?: boolean;
}): Promise<RewritePreservationReport> {
  const failureCodes: RewritePreservationFailureCode[] = [];
  const reasons: string[] = [];
  const evidenceBefore: string[] = [];
  const evidenceAfter: string[] = [];

  const beforePages = prosePages(args.beforeMarkdown);
  const afterPages = prosePages(args.afterMarkdown);
  const beforeProse = extractTasteProseFromMarkdown(args.beforeMarkdown);
  const afterProse = extractTasteProseFromMarkdown(args.afterMarkdown);

  const pageCountPreserved = beforePages.length === afterPages.length;
  if (!pageCountPreserved) {
    failureCodes.push('PAGE_COUNT_CHANGED');
    reasons.push(
      `Page count changed: ${beforePages.length} → ${afterPages.length}`
    );
  }

  const beforeOrder = beforePages.map((p) => p.page);
  const afterOrder = afterPages.map((p) => p.page);
  if (pageCountPreserved && beforeOrder.join(',') !== afterOrder.join(',')) {
    failureCodes.push('BEAT_ORDER_CHANGED');
    reasons.push('Page order changed after rewrite.');
  } else if (
    pageCountPreserved &&
    pageOrderKey(beforePages) !== pageOrderKey(afterPages)
  ) {
    const beforeKeys = new Set(beforePages.map((p) => p.page));
    const reordered = afterPages.some((p) => !beforeKeys.has(p.page));
    if (reordered) {
      failureCodes.push('BEAT_ORDER_CHANGED');
      reasons.push('Beat order materially changed after rewrite.');
    }
  }

  const titleBefore = extractTitle(args.beforeMarkdown);
  const titleAfter = extractTitle(args.afterMarkdown);
  const titleStable =
    titleBefore && titleAfter
      ? titleBefore.replace(/\s+/g, '') === titleAfter.replace(/\s+/g, '') ||
        titleAfter.includes(titleBefore.slice(0, 12))
      : null;
  if (titleBefore && titleAfter && titleStable === false) {
    failureCodes.push('TITLE_OR_SCENARIO_DRIFT');
    reasons.push(`Title drift: "${titleBefore}" → "${titleAfter}"`);
    evidenceBefore.push(titleBefore);
    evidenceAfter.push(titleAfter);
  }

  const scenarioIdStable = true;

  const beforeCompanionIds = detectCompanionIds(beforeProse);
  const afterCompanionIds = detectCompanionIds(afterProse);
  const yamlCompanion = extractYamlCompanionId(args.beforeMarkdown);

  const rosterBefore = beforeCompanionIds.filter((id) =>
    ROSTER_COMPANIONS.some((c) => c.id === id)
  );
  const rosterAfter = afterCompanionIds.filter((id) =>
    ROSTER_COMPANIONS.some((c) => c.id === id)
  );

  const probeBefore = beforeCompanionIds.filter((id) =>
    PROBE_COMPANIONS.some((c) => c.id === id)
  );
  const probeAfter = afterCompanionIds.filter((id) =>
    PROBE_COMPANIONS.some((c) => c.id === id)
  );

  const proseBaseline = probeBefore.length > 0;
  const primaryBeforeIds =
    proseBaseline ? probeBefore : rosterBefore.length > 0 ? rosterBefore : beforeCompanionIds;
  const primaryAfterIds = proseBaseline
    ? probeAfter
    : probeAfter.length > 0
      ? probeAfter
      : rosterAfter.length > 0
        ? rosterAfter
        : afterCompanionIds;

  let companionNamePreserved = true;
  let noOtherKnownCompanionIntroduced = true;
  let speciesPreserved: boolean | null = null;

  for (const id of primaryBeforeIds) {
    if (!primaryAfterIds.includes(id)) {
      const sig = ALL_COMPANIONS.find((c) => c.id === id);
      companionNamePreserved = false;
      failureCodes.push('COMPANION_IDENTITY_CHANGED');
      reasons.push(
        `Original companion signals lost: ${sig?.label ?? id} present before, missing after.`
      );
      const marker = sig?.markers[0];
      if (marker) {
        const b = firstMentionSnippet(beforeProse, marker);
        if (b) evidenceBefore.push(b);
      }
    }
  }

  const introducedRoster = rosterAfter.filter((id) => !rosterBefore.includes(id));
  const introducedRosterWhenProbeBefore =
    proseBaseline && rosterAfter.some((id) => !rosterBefore.includes(id));

  if (introducedRosterWhenProbeBefore || (introducedRoster.length > 0 && proseBaseline)) {
    noOtherKnownCompanionIntroduced = false;
    if (!failureCodes.includes('COMPANION_LAUNDERING')) {
      failureCodes.push('COMPANION_LAUNDERING');
    }
    for (const id of [
      ...new Set([
        ...introducedRoster,
        ...rosterAfter.filter((r) => proseBaseline && !rosterBefore.includes(r)),
      ]),
    ]) {
      const sig = ROSTER_COMPANIONS.find((c) => c.id === id);
      reasons.push(
        `Roster companion introduced unexpectedly: ${sig?.label ?? id} (possible laundering).`
      );
      const marker = sig?.markers[0];
      if (marker) {
        const a = firstMentionSnippet(afterProse, marker);
        if (a) evidenceAfter.push(a);
      }
    }
  }

  if (primaryBeforeIds.length > 0 && primaryAfterIds.length > 0) {
    speciesPreserved =
      primaryBeforeIds.some((id) => primaryAfterIds.includes(id)) ||
      primaryBeforeIds.join() === primaryAfterIds.join();
    if (!speciesPreserved) {
      failureCodes.push('SPECIES_CHANGED');
      reasons.push(
        `Species/identity shift: before=[${primaryBeforeIds.join(', ')}] after=[${primaryAfterIds.join(', ')}]`
      );
    }
  }

  if (
    yamlCompanion &&
    args.scenario.companionId !== yamlCompanion &&
    probeBefore.length > 0
  ) {
    reasons.push(
      `Note: YAML host companionId=${yamlCompanion} but prose identity=[${probeBefore.join(', ')}]; judging prose baseline.`
    );
  }

  const profile = getDeepProfile(args.scenario.companionId);
  const forbidden = [
    ...(isPhaseBScenario(args.scenario) ? args.scenario.forbiddenPatterns ?? [] : []),
    ...(profile.doNotWriteList ?? []),
  ];
  for (const pattern of forbidden) {
    const needle = pattern.trim().slice(0, 24);
    if (needle.length >= 6 && afterProse.toLowerCase().includes(needle.toLowerCase())) {
      failureCodes.push('DONOTWRITE_VIOLATION');
      reasons.push(`Possible doNotWrite / forbidden pattern in after: ${pattern}`);
    }
  }

  let llmChecks: RewritePreservationReport['llmChecks'];
  let llmRaw: RawPreservationLlm | undefined;
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;

  if (!args.skipLlm) {
    const llmResult = await callAdvisoryLlmJson({
      stage: 'rewrite-preservation-v1',
      systemPrompt: buildLlmSystemPrompt(),
      userPrompt: buildLlmUserPrompt({
        beforeMarkdown: args.beforeMarkdown,
        afterMarkdown: args.afterMarkdown,
        scenario: args.scenario,
        outline: args.outline,
      }),
      modelId,
      maxOutputTokens: 4096,
    });
    llmRaw = parseJsonFromLLM<RawPreservationLlm>(
      llmResult.text,
      'rewrite-preservation-v1'
    );
    llmChecks = {
      enginePreserved: llmRaw.enginePreserved !== false,
      childAgencyPreserved: llmRaw.childAgencyPreserved !== false,
      climaxShapePreserved: llmRaw.climaxShapePreserved !== false,
      emotionalProblemPreserved: llmRaw.emotionalProblemPreserved !== false,
      scenarioDistinctnessPreserved: llmRaw.scenarioDistinctnessPreserved !== false,
      doNotWritePreserved: llmRaw.doNotWritePreserved !== false,
    };
    for (const rawCode of llmRaw.failureCodes ?? []) {
      const code =
        rawCode === 'SCENARIO_REPLACED' ? 'STRUCTURAL_REPLACEMENT' : rawCode;
      if (!failureCodes.includes(code)) failureCodes.push(code);
    }
    for (const r of llmRaw.reasons ?? []) reasons.push(r);
    for (const e of llmRaw.evidenceBefore ?? []) evidenceBefore.push(e);
    for (const e of llmRaw.evidenceAfter ?? []) evidenceAfter.push(e);
  }

  const verdict = mergeVerdict(failureCodes, llmRaw);
  if (verdict === 'caution') {
    reasons.push('LLM preservation: one semantic dimension flagged — human review.');
  }

  return {
    version: REWRITE_PRESERVATION_VERSION,
    verdict,
    failureCodes: [...new Set(failureCodes)],
    reasons: [...new Set(reasons)],
    deterministicChecks: {
      companionNamePreserved,
      noOtherKnownCompanionIntroduced,
      speciesPreserved,
      pageCountPreserved,
      titleStable,
      scenarioIdStable,
    },
    llmChecks,
    evidence: {
      before: evidenceBefore.length ? evidenceBefore : undefined,
      after: evidenceAfter.length ? evidenceAfter : undefined,
    },
    modelId: args.skipLlm ? undefined : modelId,
  };
}

export function preservationBlocksShip(
  report: RewritePreservationReport
): boolean {
  return report.verdict === 'fail';
}
