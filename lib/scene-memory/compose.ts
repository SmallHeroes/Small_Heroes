import type { SceneMemory, SceneMemoryLockOptions } from './types';

export function promptContainsSceneMemoryLock(prompt: string): boolean {
  return /SCENE MEMORY LOCK/i.test(prompt);
}

function isCloseUpShot(options?: SceneMemoryLockOptions): boolean {
  return options?.pageShot?.shot === 'close_up';
}

/** Per-page SCENE MEMORY LOCK — extends SET TOPOLOGY LOCK; does not replace it. */
export function buildSceneMemoryLockBlock(
  memory: SceneMemory | null | undefined,
  options?: SceneMemoryLockOptions
): string | null {
  if (!memory?.stableFacts || !Object.keys(memory.stableFacts).length) return null;

  const closeUp = isCloseUpShot(options);

  if (closeUp) {
    return [
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
  }

  const lines = [
    'SCENE MEMORY LOCK (same physical set every page — camera may move, geography may NOT):',
    `scene: ${memory.sceneId} (${memory.sceneType}) · seed: ${memory.seedSource}`,
    '',
    'STABLE FACTS:',
    ...Object.entries(memory.stableFacts).map(([id, fact]) => {
      const color = fact.color ? ` · ${fact.color}` : '';
      const appearance = fact.appearance ? ` · ${fact.appearance}` : '';
      return `- ${id}: ${fact.position}${color}${appearance}`;
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

  return lines.join('\n');
}
