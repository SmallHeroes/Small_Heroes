/**
 * Recurring entities declared in story-bank frontmatter (data, not code).
 * Pipeline reads these per story file.
 */

export type StoryRecurringEntityRole = 'object' | 'creature' | 'character' | 'prop';

export type StoryRecurringEntityDeclaration = {
  entityId: string;
  role: StoryRecurringEntityRole;
  visualDescription: string;
  sizeLock?: string;
  colorLock?: string;
  ageStage?: string;
  appearsFromPage?: number;
  appearsUntilPage?: number;
  /** Env var name holding reference anchor URL (e.g. DINI_BABY_DRAGON_ANCHOR_URL). */
  referenceAnchorEnv?: string;
  referenceAnchorUrl?: string;
  negativeDriftRules?: string[];
  aliases?: string[];
};

export function buildRecurringLocksFromDeclarations(
  declarations: StoryRecurringEntityDeclaration[]
): {
  catalog: Record<string, string[]>;
  locks: Record<string, string>;
} {
  const catalog: Record<string, string[]> = {};
  const locks: Record<string, string> = {};

  for (const d of declarations) {
    const keywords = [
      d.entityId,
      d.entityId.replace(/_/g, ' '),
      ...(d.aliases ?? []),
    ].filter(Boolean);
    catalog[d.entityId] = [...new Set(keywords.map((k) => k.toLowerCase()))];

    const parts = [
      `RECURRING ${d.role.toUpperCase()} LOCK — ${d.entityId}:`,
      d.visualDescription.trim(),
      d.sizeLock ? `SIZE LOCK: ${d.sizeLock.trim()}` : '',
      d.colorLock ? `COLOR LOCK: ${d.colorLock.trim()}` : '',
      d.ageStage ? `AGE/STAGE: ${d.ageStage.trim()}` : '',
      d.appearsFromPage != null || d.appearsUntilPage != null
        ? `PAGE RANGE: appears from page ${d.appearsFromPage ?? 1} through ${d.appearsUntilPage ?? 'end'}.`
        : '',
      d.referenceAnchorUrl || d.referenceAnchorEnv
        ? 'When a reference anchor image is attached for this entity: IDENTITY ONLY — match species/colors/proportions; pose and scene come from the page.'
        : '',
      d.negativeDriftRules?.length
        ? `NEGATIVE DRIFT (never): ${d.negativeDriftRules.join('; ')}.`
        : '',
    ];
    locks[d.entityId] = parts.filter(Boolean).join('\n');
  }

  return { catalog, locks };
}

/** Parse `recurringEntities:` map from v5 story-bank frontmatter (between --- markers). */
export function parseRecurringEntitiesFromStoryMarkdown(raw: string): StoryRecurringEntityDeclaration[] {
  const fmMatch = raw.match(/(?:^|\r?\n)---\r?\n([\s\S]*?)\r?\n---(?:\s|$)/);
  if (!fmMatch) return [];
  const fm = fmMatch[1];
  const blockStart = fm.search(/^recurringEntities:\s*$/m);
  if (blockStart < 0) return [];
  const afterHeader = fm.slice(blockStart).replace(/^recurringEntities:\s*\r?\n/, '');
  const blockLines: string[] = [];
  for (const line of afterHeader.split(/\r?\n/)) {
    if (line.length === 0) continue;
    if (!/^  /.test(line)) break;
    blockLines.push(line);
  }
  if (blockLines.length === 0) return [];

  const lines = blockLines;
  const out: StoryRecurringEntityDeclaration[] = [];
  let currentId: string | null = null;
  let current: Partial<StoryRecurringEntityDeclaration> = {};
  let driftRules: string[] = [];
  let inDriftList = false;

  const flush = () => {
    if (!currentId || !current.role || !current.visualDescription) return;
    out.push({
      entityId: currentId,
      role: current.role as StoryRecurringEntityRole,
      visualDescription: current.visualDescription,
      sizeLock: current.sizeLock,
      colorLock: current.colorLock,
      ageStage: current.ageStage,
      appearsFromPage: current.appearsFromPage,
      appearsUntilPage: current.appearsUntilPage,
      referenceAnchorEnv: current.referenceAnchorEnv,
      referenceAnchorUrl: current.referenceAnchorUrl,
      negativeDriftRules: driftRules.length ? driftRules : undefined,
      aliases: current.aliases,
    });
  };

  for (const line of lines) {
    const entityMatch = line.match(/^  ([a-z0-9_]+):\s*$/);
    if (entityMatch) {
      flush();
      currentId = entityMatch[1];
      current = {};
      driftRules = [];
      inDriftList = false;
      continue;
    }
    if (!currentId) continue;

    const kv = line.match(/^    ([a-zA-Z]+):\s*(.*)$/);
    if (kv) {
      inDriftList = false;
      const key = kv[1];
      const val = kv[2].trim();
      if (key === 'role') current.role = val as StoryRecurringEntityRole;
      else if (key === 'visualDescription') current.visualDescription = val;
      else if (key === 'sizeLock') current.sizeLock = val;
      else if (key === 'colorLock') current.colorLock = val;
      else if (key === 'ageStage') current.ageStage = val;
      else if (key === 'appearsFromPage') current.appearsFromPage = Number.parseInt(val, 10);
      else if (key === 'appearsUntilPage') current.appearsUntilPage = Number.parseInt(val, 10);
      else if (key === 'referenceAnchorEnv') current.referenceAnchorEnv = val;
      else if (key === 'referenceAnchorUrl') current.referenceAnchorUrl = val;
      else if (key === 'negativeDriftRules') inDriftList = true;
      continue;
    }

    const listItem = line.match(/^      - (.+)$/);
    if (listItem && inDriftList) {
      driftRules.push(listItem[1].trim());
    }
  }
  flush();
  return out;
}

export function resolveDeclarationAnchorUrls(
  declarations: StoryRecurringEntityDeclaration[]
): StoryRecurringEntityDeclaration[] {
  return declarations.map((d) => {
    if (d.referenceAnchorUrl) return d;
    if (d.referenceAnchorEnv) {
      const url = process.env[d.referenceAnchorEnv]?.trim();
      if (url) return { ...d, referenceAnchorUrl: url };
    }
    return d;
  });
}
