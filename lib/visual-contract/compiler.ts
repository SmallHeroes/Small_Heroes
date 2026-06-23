/**
 * Visual Contract Compiler — Phase 1 (deterministic).
 *
 * Derives a hard `BookVisualContract` from a normalized story input: frontmatter
 * motifs + English imageDirections + prose signals. No LLM — every element is
 * grounded in an explicit signal and tagged with provenance + confidence, so the
 * contract can FAIL CLOSED when confidence is low or render-critical sections are
 * missing.
 *
 * Enforces all three failure classes the Leo render exhibited:
 *  - continuity  → scenes / worldStateByPage / criticalObjects identity+state
 *  - entity      → characterLock (one child, illustrated) + companionLock scale
 *  - storytelling→ pageContracts mustShow/mustNotShow (the central action shows)
 */

import type { CompilerStoryInput, CompilerStoryPage } from './parse-story';
import type {
  BookVisualContract,
  ContractProvenanceEntry,
  CriticalObject,
  FailureClass,
  ObjectStateEntry,
  PageContract,
  SceneDef,
} from './types';

export interface CompileOptions {
  /** ISO timestamp — render-safe code must not call Date.now(). */
  generatedAt: string;
  maxRerolls?: number;
  /** Below this overall confidence the contract is NOT render-ready (fail-closed). */
  minConfidence?: number;
}

const DEFAULT_MIN_CONFIDENCE = 0.6;

type SceneId = 'bedroom' | 'fantasy_exterior' | 'gate_area' | 'return';

interface ObjectPattern {
  re: RegExp;
  objectId: string;
  canonicalDescription: string;
  scaleLock: string;
  forbiddenVariants: string[];
  /** Derive a per-page state from that page's direction+prose. */
  stateFor: (pageText: string, direction: string) => string;
}

/** Generic object knowledge base — matched against the ENGLISH imageDirections. */
const OBJECT_PATTERNS: ObjectPattern[] = [
  {
    // English directions ("red block") + Hebrew prose ("קובייה" = the red play cube).
    re: /\bred (?:block|cube)\b|קובייה/i,
    objectId: 'red_cube',
    canonicalDescription: 'a single small red wooden play block (toy cube)',
    scaleLock: 'small toy block that fits in the child’s hand — never wall-sized, furniture-sized, or itself a portal',
    forbiddenVariants: ['giant/huge cube', 'red wall', 'furniture-sized block', 'the cube rendered as the portal'],
    stateFor: (t, d) =>
      /tremb|rattl|רעד|shak/i.test(`${t} ${d}`) ? 'small block trembling / triggering the portal' : 'small red play block',
  },
  {
    re: /\bblock castle\b|(?:collapsed|fallen)[^.]*\bcastle\b/i,
    objectId: 'fallen_block_castle',
    canonicalDescription: 'a small toy castle built from wooden blocks on the bedroom floor, now collapsed',
    scaleLock: 'child-built toy scale on the floor',
    forbiddenVariants: ['real/giant stone castle', 'a sandcastle substituted for the block castle'],
    stateFor: (t, d) => (/rebuild|בונה|wider|stronger base/i.test(`${t} ${d}`) ? 'being rebuilt' : 'collapsed / fallen'),
  },
  {
    re: /\b(?:golden sand portal|sand portal|golden sand)\b/i,
    objectId: 'golden_sand_portal',
    canonicalDescription: 'a swirl of golden sand opening as a portal on the bedroom floor',
    scaleLock: 'floor-level opening on the room floor — a transition, NOT a wall, door, or the stone gate',
    forbiddenVariants: ['the stone gate', 'a door/archway', 'a wall of sand', 'an outdoor structure'],
    stateFor: () => 'golden sand portal open on the floor',
  },
  {
    re: /\bstone gate\b|\bgate\b/i,
    objectId: 'stone_gate',
    canonicalDescription:
      'one large outdoor stone gate/archway with a single clear circular mark at its center (one consistent design across all pages)',
    scaleLock: 'large outdoor structure; identical design every page it appears',
    forbiddenVariants: ['the golden sand portal', 'placed indoors / in the bedroom', 'a different gate design per page'],
    stateFor: (t, d) =>
      /\bopen|opens|opened|נפתח|רעד\b/i.test(`${t} ${d}`) ? 'opening / opened' : 'closed with a circular center mark',
  },
];

function classifyScene(page: CompilerStoryPage): { sceneId: SceneId; explicit: boolean } {
  const hay = `${page.imageDirection} ${page.text}`;
  if (/\bstone gate\b|\bgate\b/i.test(hay)) return { sceneId: 'gate_area', explicit: true };
  if (/kingdom|golden sand|sandy path|low stone|\bhill\b|sand castle|round stones/i.test(hay))
    return { sceneId: 'fantasy_exterior', explicit: true };
  if (/bedroom|back in the bedroom|bedroom floor/i.test(hay)) return { sceneId: 'bedroom', explicit: true };
  return { sceneId: 'bedroom', explicit: false };
}

function extractBeatPage(beat: string | null): number | null {
  if (!beat) return null;
  const m = beat.match(/עמוד\s*(\d+)|page\s*(\d+)/i);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? m[2], 10);
  return Number.isFinite(n) ? n : null;
}

function firstSentence(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : trimmed).trim().slice(0, 200);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function compileBookVisualContract(
  input: CompilerStoryInput,
  opts: CompileOptions
): BookVisualContract {
  const provenance: ContractProvenanceEntry[] = [];
  const tag = (path: string, source: ContractProvenanceEntry['source'], confidence: number, note?: string) => {
    provenance.push({ path, source, confidence, ...(note ? { note } : {}) });
    return confidence;
  };

  const fm = input.frontmatter;
  const pages = input.pages;
  const pageCount = pages.length || fm.pages || 0;

  // ── characterLock (entity) — policy lock; per-child attributes filled at render.
  tag('characterLock', 'derived', 0.9, 'one protagonist, illustrated (NO-PHOTO), no clones');
  const characterLock = {
    protagonistId: 'child',
    age: null,
    hair: null,
    skin: null,
    outfit: null,
    singleInstance: true as const,
    photoPolicy: 'illustrated_not_photoreal' as const,
  };

  // ── companionLock (entity) — scale lock is the headline check.
  const allDirText = pages.map((p) => `${p.imageDirection} ${p.text}`).join(' ');
  const isCub = /\bcub\b|young lion|גוּר|גור|small[^.]*mane|messy[^.]*mane/i.test(allDirText);
  const companionId = fm.companionId;
  let companionLock = null as BookVisualContract['companionLock'];
  if (companionId) {
    const scaleConf = isCub ? 0.85 : 0.5;
    tag('companionLock.characterScaleLock', isCub ? 'story_prose' : 'derived', scaleConf,
      isCub ? 'cub detected in prose/directions' : 'no explicit size signal — fail-closed candidate');
    const species = /lion/i.test(`${companionId} ${allDirText}`) ? 'lion' : null;
    companionLock = {
      companionId,
      name: null,
      species,
      visualDescription: null,
      characterScaleLock: {
        rule: isCub ? 'small_cub_always' : 'match_story_described_size',
        relativeScale: isCub ? 'knee-to-waist height of the child' : 'as described in the story',
        neverAdultOrGiant: isCub,
        approvedExceptions: [],
      },
    };
  }

  // ── criticalObjects (continuity) — from frontmatter motifs + English directions.
  const objectsById = new Map<string, CriticalObject>();
  const objectConfidence = new Map<string, number>();

  // Seed from frontmatter visualMotifs (canonical motif list), object-typed only.
  for (const motif of fm.visualMotifs) {
    const pat = OBJECT_PATTERNS.find((p) => p.re.test(motif));
    if (!pat) continue; // poses/effects (e.g. "paws planted ritual", "roar-line") are not objects
    if (!objectsById.has(pat.objectId)) {
      objectsById.set(pat.objectId, {
        objectId: pat.objectId,
        canonicalDescription: pat.canonicalDescription,
        scaleLock: pat.scaleLock,
        allowedVariants: [],
        forbiddenVariants: [...pat.forbiddenVariants],
        stateTimeline: [],
      });
      objectConfidence.set(pat.objectId, 0.6); // frontmatter-only until matched in a direction
    }
  }

  // Scan directions/prose for objects + per-page state.
  for (const page of pages) {
    const hay = `${page.imageDirection} ${page.text}`;
    for (const pat of OBJECT_PATTERNS) {
      if (!pat.re.test(hay)) continue;
      if (!objectsById.has(pat.objectId)) {
        objectsById.set(pat.objectId, {
          objectId: pat.objectId,
          canonicalDescription: pat.canonicalDescription,
          scaleLock: pat.scaleLock,
          allowedVariants: [],
          forbiddenVariants: [...pat.forbiddenVariants],
          stateTimeline: [],
        });
      }
      objectConfidence.set(pat.objectId, Math.max(objectConfidence.get(pat.objectId) ?? 0, 0.85));
      const obj = objectsById.get(pat.objectId)!;
      if (!obj.stateTimeline.some((s) => s.page === page.pageNumber)) {
        obj.stateTimeline.push({ page: page.pageNumber, state: pat.stateFor(page.text, page.imageDirection) });
      }
    }
  }
  const criticalObjects = [...objectsById.values()];
  for (const obj of criticalObjects) {
    obj.stateTimeline.sort((a, b) => a.page - b.page);
    tag(`criticalObjects.${obj.objectId}`, 'story_frontmatter', objectConfidence.get(obj.objectId) ?? 0.6);
  }

  const objectStateTimeline: Record<string, ObjectStateEntry[]> = {};
  for (const obj of criticalObjects) objectStateTimeline[obj.objectId] = obj.stateTimeline;

  // ── scenes + worldStateByPage (continuity).
  const sceneOfPage = new Map<number, SceneId>();
  let sceneConfSum = 0;
  // Carry-forward continuity: a page with no explicit scene keyword inherits the
  // previous page's scene (a mid-sequence page like the pebble beat stays in the
  // gate area) rather than snapping back to the bedroom default.
  let carriedScene: SceneId = 'bedroom';
  for (const page of pages) {
    const { sceneId, explicit } = classifyScene(page);
    const resolved = explicit ? sceneId : carriedScene;
    sceneOfPage.set(page.pageNumber, resolved);
    if (explicit) carriedScene = sceneId;
    sceneConfSum += explicit ? 0.85 : 0.6;
  }
  // The LAST bedroom page is the "return" scene (the room comes back).
  const bedroomPages = [...sceneOfPage.entries()].filter(([, s]) => s === 'bedroom').map(([p]) => p);
  if (bedroomPages.length > 1) {
    const lastBedroom = Math.max(...bedroomPages);
    sceneOfPage.set(lastBedroom, 'return');
  }
  const worldStateByPage: Record<string, string> = {};
  for (const page of pages) worldStateByPage[String(page.pageNumber)] = sceneOfPage.get(page.pageNumber)!;

  const sceneLabels: Record<SceneId, string> = {
    bedroom: 'Child’s bedroom (real world)',
    fantasy_exterior: 'Golden-sand fantasy kingdom (outdoor)',
    gate_area: 'Outdoor stone-gate area',
    return: 'Back in the child’s bedroom',
  };
  const scenes: SceneDef[] = (['bedroom', 'fantasy_exterior', 'gate_area', 'return'] as SceneId[])
    .map((sceneId) => {
      const sp = pages.filter((p) => sceneOfPage.get(p.pageNumber) === sceneId).map((p) => p.pageNumber);
      return { sceneId, label: sceneLabels[sceneId], pages: sp, transitionRules: [] as string[] };
    })
    .filter((s) => s.pages.length > 0);
  for (const s of scenes) {
    if (s.sceneId === 'bedroom') s.transitionRules.push('exits to fantasy via the golden_sand_portal on the room floor');
    if (s.sceneId === 'gate_area') s.transitionRules.push('outdoor only — the stone_gate is NEVER inside the bedroom');
    if (s.sceneId === 'return') s.transitionRules.push('the room is the SAME bedroom as scene "bedroom" — it stays the room');
  }
  tag('scenes', 'image_direction', pages.length ? sceneConfSum / pages.length : 0);
  tag('worldStateByPage', 'image_direction', pages.length ? sceneConfSum / pages.length : 0);

  // ── pageContracts (storytelling).
  const beatPages = {
    quiet: fm.beats.quietPagePosition,
    mistake: extractBeatPage(fm.beats.emotionalMistake),
    heart: extractBeatPage(fm.beats.heartLine),
    agency: extractBeatPage(fm.beats.agencyTransfer),
    truth: extractBeatPage(fm.beats.uncomfortableTruth),
  };
  function beatFor(page: CompilerStoryPage): string {
    if (page.pageNumber === beatPages.heart) return 'focused_breakthrough';
    if (page.pageNumber === beatPages.mistake) return 'misdirected_anger';
    if (page.pageNumber === beatPages.agency) return 'child_leads';
    if (page.pageNumber === beatPages.quiet) return 'quiet_vulnerable';
    if (page.pageNumber === beatPages.truth) return 'uncomfortable_truth';
    if (/כַּעַס|כעס|רעם|רותח|שאג|נפל|"לא!"/.test(page.text)) return 'anger_rising';
    if (/בונה|שוב|בסיס רחב|grounded|rebuild/i.test(`${page.text} ${page.imageDirection}`)) return 'grounded';
    return 'story_beat';
  }

  let pageContractConfSum = 0;
  const pageContracts: PageContract[] = pages.map((page) => {
    const sceneId = sceneOfPage.get(page.pageNumber)!;
    const present = page.companionPresence === 'present';
    const hay = `${page.imageDirection} ${page.text}`;
    const objectsHere = criticalObjects
      .filter((o) => o.stateTimeline.some((s) => s.page === page.pageNumber))
      .map((o) => o.objectId);

    const mustShow: string[] = [];
    if (sceneId !== 'fantasy_exterior' || /child|{{childName}}/i.test(hay)) mustShow.push('protagonist:child');
    for (const oid of objectsHere) mustShow.push(`object:${oid}`);
    if (present && companionLock) mustShow.push(`companion:${companionLock.companionId} (small cub)`);
    // Storytelling beat assertions for the climactic focused roar.
    if (/roar-line|roar line|קו של רעם|golden roar/i.test(hay) && objectsHere.includes('stone_gate')) {
      mustShow.push('focused golden roar-line aimed at the stone_gate circular mark, gate opening');
    }

    const mustNotShow: string[] = ['duplicate/clone of the child', 'photoreal cutout (must be illustrated)'];
    // No uninvited creatures (the calibration armadillo): only the declared companion may appear.
    mustNotShow.push(
      present && companionLock
        ? `any animals or creatures other than the companion ${companionLock.companionId}`
        : 'any animals, pets, or creatures of any kind'
    );
    if (present && companionLock?.characterScaleLock.neverAdultOrGiant) {
      mustNotShow.push('adult or giant lion (companion must stay a small cub)');
    }
    if (sceneId === 'bedroom' || sceneId === 'return') {
      mustNotShow.push('the stone_gate (it is outdoor — never in the bedroom)');
      mustNotShow.push('the golden-sand fantasy kingdom');
    }
    if (sceneId === 'gate_area' || sceneId === 'fantasy_exterior') {
      mustNotShow.push('bedroom furniture (bed, shelves, toy bins)');
    }
    if (objectsHere.includes('stone_gate')) mustNotShow.push('the golden_sand_portal in place of the stone_gate');
    if (objectsHere.includes('golden_sand_portal')) mustNotShow.push('the stone_gate in place of the golden_sand_portal');

    const action = firstSentence(page.imageDirection) || firstSentence(page.text);
    pageContractConfSum += page.imageDirection ? 0.8 : 0.5;
    return {
      page: page.pageNumber,
      sceneId,
      action,
      emotionalBeat: beatFor(page),
      companion: { present, scale: present && companionLock ? companionLock.characterScaleLock.relativeScale : null },
      mustShow,
      mustNotShow,
    };
  });
  tag('pageContracts', 'image_direction', pages.length ? pageContractConfSum / pages.length : 0);

  // ── confidence rollup by failure class.
  const objConf = criticalObjects.length
    ? criticalObjects.reduce((a, o) => a + (objectConfidence.get(o.objectId) ?? 0), 0) / criticalObjects.length
    : 0;
  const sceneConf = pages.length ? sceneConfSum / pages.length : 0;
  const continuity = Math.min(objConf || 0.0, sceneConf || 0.0) || 0;
  const entity = companionLock ? (0.9 + (companionLock.characterScaleLock.neverAdultOrGiant ? 0.85 : 0.5)) / 2 : 0.9;
  const storytelling = pages.length ? pageContractConfSum / pages.length : 0;
  const byClass: Record<FailureClass, number> = {
    continuity: Number(continuity.toFixed(3)),
    entity: Number(entity.toFixed(3)),
    storytelling: Number(storytelling.toFixed(3)),
  };
  const overall = Number(Math.min(byClass.continuity, byClass.entity, byClass.storytelling).toFixed(3));
  const minConf = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  const contract: BookVisualContract = {
    schemaVersion: 1,
    storyKey: input.storyKey,
    companionId: companionId ?? null,
    direction: fm.direction,
    category: fm.category,
    pageCount,
    generatedAt: opts.generatedAt,
    characterLock,
    companionLock,
    criticalObjects,
    scenes,
    worldStateByPage,
    objectStateTimeline,
    pageContracts,
    referencePlan: {
      priority: ['child_identity', 'companion_identity', 'critical_object_state', 'location', 'style'],
      dropPolicy: 'style_first',
      criticalRefsOutrankStyle: true,
    },
    qaPolicy: {
      hardAssertions: ['continuity', 'entity', 'storytelling'],
      warningAssertions: ['palette_drift', 'composition_text_safe_area'],
      maxRerolls: Math.max(0, opts.maxRerolls ?? 2),
      failClosed: true,
    },
    coverContract: { reviewedSeparately: true, title: fm.title },
    provenance,
    confidence: { overall, min: overall, byClass },
    renderReady: false,
    renderReadyBlockers: [],
  };

  const blockers = computeRenderReadyBlockers(contract, minConf);
  contract.renderReadyBlockers = blockers;
  contract.renderReady = blockers.length === 0;
  return contract;
}

/** Fail-closed checks: render-critical sections must exist and confidence must clear the bar. */
export function computeRenderReadyBlockers(contract: BookVisualContract, minConfidence: number): string[] {
  const blockers: string[] = [];
  if (contract.confidence.overall < minConfidence) {
    blockers.push(`contract confidence ${contract.confidence.overall} < ${minConfidence}`);
  }
  if (contract.criticalObjects.length === 0) blockers.push('no criticalObjects derived');
  if (Object.keys(contract.worldStateByPage).length < contract.pageCount) {
    blockers.push('worldStateByPage does not cover every page');
  }
  if (contract.pageContracts.length < contract.pageCount) blockers.push('pageContracts do not cover every page');
  if (contract.companionId && !contract.companionLock) blockers.push('companion present but no companionLock');
  if (contract.companionLock && !contract.companionLock.characterScaleLock.neverAdultOrGiant) {
    blockers.push('companion scale lock unresolved (no cub/size signal) — refusing to render');
  }
  return blockers;
}

/** Throw if the contract is not render-ready (amendment #2 + #5: fail closed). */
export function assertContractRenderReady(contract: BookVisualContract): void {
  if (!contract.renderReady) {
    throw new Error(
      `[visual-contract] ${contract.storyKey} is NOT render-ready (fail-closed): ${contract.renderReadyBlockers.join('; ')}`
    );
  }
}
