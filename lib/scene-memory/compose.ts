import type {
  SceneMemory,
  SceneMemoryLockOptions,
  SceneMemoryObservedState,
  SceneMemoryStableFact,
} from './types';
import {
  getExpectedStateForPage,
  isAcceptableCollapsedPile,
  isBlanketFact,
  isFortFormPrimaryFact,
  isLampFact,
  isStandingCanopy,
  pageHasStatefulExpectation,
} from './fact-compare';

export function promptContainsSceneMemoryLock(prompt: string): boolean {
  return /SCENE MEMORY LOCK/i.test(prompt);
}

export function promptContainsSceneMemoryGenerationConstraints(prompt: string): boolean {
  return /SCENE MEMORY GENERATION CONSTRAINTS/i.test(prompt);
}

function isCloseUpShot(options?: SceneMemoryLockOptions): boolean {
  return options?.pageShot?.shot === 'close_up';
}

function factPlacementSummary(fact: SceneMemoryStableFact): string {
  const color = fact.color ? ` · ${fact.color}` : '';
  const appearance = fact.appearance ? ` · ${fact.appearance}` : '';
  return `${fact.position}${color}${appearance}`;
}

function buildFortFormConstraintLine(
  factId: string,
  expected: SceneMemoryObservedState,
  fact: SceneMemoryStableFact
): string | null {
  if (isAcceptableCollapsedPile(expected)) {
    return [
      `- ${factId}: REQUIRED STATE = ${expected.replace(/_/g, ' ').toUpperCase()}.`,
      `  Render a LOW loose pillow pile at ${fact.position} — soft heap, pillows scattered or leaning, NO stable roof plane.`,
      `  FORBIDDEN: standing tent, teepee, canopy, tunnel entrance, blanket/pillow held up as roof, or any rebuilt fort enclosing interior space.`,
    ].join('\n');
  }
  if (isStandingCanopy(expected) || expected === 'built_or_tent') {
    return `- ${factId}: story authorizes BUILT fort this page — standing canopy permitted only because pageAction requires it; anchor at ${fact.position}.`;
  }
  return null;
}

function buildStatefulConstraintLine(
  factId: string,
  expected: SceneMemoryObservedState,
  fact: SceneMemoryStableFact
): string | null {
  if (isBlanketFact(factId) && expected === 'folded') {
    return `- ${factId}: show authorized blanket FOLD detail at ${fact.position}${fact.color ? ` (${fact.color})` : ''}.`;
  }
  if (isLampFact(factId) && expected === 'dimmed') {
    return `- ${factId}: DIMMED soft warm bedside lamp — ${fact.position}.`;
  }
  return null;
}

/** J2 — proactive per-page generation constraints from SceneMemory (no autonomy/reroll). */
export function buildSceneMemoryGenerationConstraints(
  memory: SceneMemory,
  pageNumber: number
): string | null {
  const lines: string[] = [];

  for (const [factId, fact] of Object.entries(memory.stableFacts)) {
    if (!isFortFormPrimaryFact(factId)) continue;
    const expected = getExpectedStateForPage(memory, factId, pageNumber);
    const line = buildFortFormConstraintLine(factId, expected, fact);
    if (line) lines.push(line);
  }

  for (const factId of Object.keys(memory.statefulObjects)) {
    if (isFortFormPrimaryFact(factId)) continue;
    if (!pageHasStatefulExpectation(memory, factId, pageNumber)) continue;
    const fact = memory.stableFacts[factId];
    if (!fact) continue;
    const expected = getExpectedStateForPage(memory, factId, pageNumber);
    const line = buildStatefulConstraintLine(factId, expected, fact);
    if (line) lines.push(line);
  }

  const positionLines: string[] = [];
  for (const [factId, fact] of Object.entries(memory.stableFacts)) {
    if (fact.factKind !== 'position') continue;
    if (isFortFormPrimaryFact(factId)) continue;
    positionLines.push(
      `- ${factId}: MUST remain at ${factPlacementSummary(fact)} — never flip to opposite wall or swap with another anchor.`
    );
  }
  if (positionLines.length) {
    lines.push('', 'FIXED POSITIONS (hard — geography must not flip):', ...positionLines);
  }

  const paletteLines: string[] = [];
  for (const [factId, fact] of Object.entries(memory.stableFacts)) {
    if (fact.factKind === 'appearance') {
      paletteLines.push(`- ${factId}: ${fact.position}`);
      continue;
    }
    if (fact.color && !isFortFormPrimaryFact(factId)) {
      paletteLines.push(`- ${factId}: ${fact.color}`);
    }
  }
  if (paletteLines.length) {
    lines.push('', 'PALETTE / APPEARANCE (locked):', ...paletteLines);
  }

  if (!lines.length) return null;

  return [
    'THIS PAGE — SCENE MEMORY GENERATION CONSTRAINTS (proactive — mandatory for set continuity):',
    ...lines,
  ].join('\n');
}

function appendGenerationConstraints(
  block: string,
  memory: SceneMemory,
  pageNumber?: number
): string {
  if (!pageNumber) return block;
  const constraints = buildSceneMemoryGenerationConstraints(memory, pageNumber);
  if (!constraints) return block;
  return `${block}\n\n${constraints}`;
}

/** Per-page SCENE MEMORY LOCK — extends SET TOPOLOGY LOCK; does not replace it. */
export function buildSceneMemoryLockBlock(
  memory: SceneMemory | null | undefined,
  options?: SceneMemoryLockOptions
): string | null {
  if (!memory?.stableFacts || !Object.keys(memory.stableFacts).length) return null;

  const closeUp = isCloseUpShot(options);
  const pageNumber = options?.pageNumber;

  if (closeUp) {
    const block = [
      'SCENE MEMORY LOCK (same room — close-up; geography unchanged):',
      `scene: ${memory.sceneId} (${memory.sceneType})`,
      'Match the established room palette and fixed geography from prior pages.',
      `Closed inventory — only these set elements may appear: ${memory.inventory.join(', ')}.`,
      'Do not invent furniture, props, or decor not listed in inventory.',
      memory.forbiddenChanges.length
        ? `Forbidden: ${memory.forbiddenChanges.slice(0, 6).join('; ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    return appendGenerationConstraints(block, memory, pageNumber);
  }

  const lines = [
    'SCENE MEMORY LOCK (same physical set every page — camera may move, geography may NOT):',
    `scene: ${memory.sceneId} (${memory.sceneType}) · seed: ${memory.seedSource}`,
    '',
    'STABLE FACTS:',
    ...Object.entries(memory.stableFacts).map(([id, fact]) => {
      return `- ${id}: ${factPlacementSummary(fact)}`;
    }),
  ];

  const stateful = Object.entries(memory.statefulObjects);
  if (stateful.length) {
    lines.push('', 'STATEFUL OBJECTS (story-authorized changes only):');
    for (const [id, obj] of stateful) {
      const states = obj.timeline.map((t) => `p${t.page}=${t.state}`).join(', ');
      lines.push(`- ${id}: ${obj.identity} · timeline: ${states}`);
    }
  }

  lines.push(
    '',
    `INVENTORY (closed set): ${memory.inventory.join(', ')}.`,
    'Do not add props, furniture, or decor not listed in inventory.',
    memory.forbiddenChanges.length
      ? `Forbidden changes: ${memory.forbiddenChanges.slice(0, 8).join('; ')}.`
      : 'Do not redesign, recolor, or relocate fixed set elements without story authorization.'
  );

  return appendGenerationConstraints(lines.join('\n'), memory, pageNumber);
}
