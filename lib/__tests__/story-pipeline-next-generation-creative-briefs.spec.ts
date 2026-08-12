import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { MVP_STORY_MATRIX } from '../../backend/config/mvp-story-matrix';

type Direction = 'bedtime' | 'adventure' | 'fantasy';

interface CatalogManifest {
  schemaVersion: 'next-generation-story-brief-catalog/v1';
  status: 'staging_only';
  writerContractPath: string;
  briefSetPaths: string[];
  expectedSlotCount: number;
  directions: Record<Direction, { pageCount: number; minimumMeaningfulSetPieces: number }>;
}

interface StoryBrief {
  briefVersion: 'story-creative-brief/v1';
  id: string;
  status: 'draft_for_guy_review';
  category: string;
  direction: Direction;
  pageCount: number;
  workingTitle: string;
  mechanicKey: string;
  creativePromise: string;
  hiddenUnderlayer: string;
  openingHook: string;
  childWant: string;
  physicalProblem: string;
  playRule: string;
  setPieces: Array<{ id: string; name: string; dramaticUse: string }>;
  lockedCausalMovement: string[];
  companionWrongHelp: string;
  comicEscalations: Array<{ level: number; setup: string; consequence: string }>;
  attempts: Array<{ attempt: string; failure: string }>;
  childDiscovery: string;
  childClimaxAction: string;
  visiblePayoff: string;
  endingEnergy: string;
  recurringObjects: string[];
  transientCast: string[];
  rereadHooks: string[];
  lineTargets: { childRepeatable: string; parentReread: string };
  companionIndispensability: string;
  worldAndSafetyLocks: string[];
  mustAvoid: string[];
  oldStoryAntiCopy: string[];
  modelFreedom: string[];
}

interface CompanionBriefSet {
  schemaVersion: 'next-generation-companion-story-brief-set/v1';
  status: 'staging_only';
  companionId: string;
  companionBiblePath: string;
  briefs: StoryBrief[];
}

const ROOT = process.cwd();
const PIPELINE_ROOT = path.join(ROOT, 'story-pipeline');
const BRIEFS_ROOT = path.join(PIPELINE_ROOT, '03_story_briefs');
const CATALOG_PATH = path.join(BRIEFS_ROOT, 'story-brief-catalog.json');

const DIRECTIONS: Direction[] = ['bedtime', 'adventure', 'fantasy'];
const PAGE_COUNTS: Record<Direction, number> = {
  bedtime: 8,
  adventure: 12,
  fantasy: 16,
};

const REQUIRED_STRING_FIELDS: Array<keyof StoryBrief> = [
  'id',
  'status',
  'category',
  'direction',
  'workingTitle',
  'mechanicKey',
  'creativePromise',
  'hiddenUnderlayer',
  'openingHook',
  'childWant',
  'physicalProblem',
  'playRule',
  'companionWrongHelp',
  'childDiscovery',
  'childClimaxAction',
  'visiblePayoff',
  'endingEnergy',
  'companionIndispensability',
];

const COMPANION_CAUSAL_MARKERS: Record<string, RegExp[]> = {
  fox_uri: [/אוּרי/, /פנס/, /זנב/, /חשוד|תיאורי/],
  panda_anat: [/עֲנָת/, /מחכה|ממתין|המתנה|עיכוב|איחור/, /הזמנ|תזמון|פעימה/],
  bunny_ometz: [/בּוּנִי/, /אוזנ/, /תוכנית|הכרז/],
  dragon_dini: [/דיני/, /כנף/, /זנב/, /בונ|שכבה|קן|קיר|הגנה/],
  chameleon_koko: [/קִים/, /עינ/, /לשו(?:ן|נ)/, /תווית|תיוג/],
  lion_shaket: [/ליאו/, /רעמה/, /רטינ|רעם|ררר|רטט/, /כלי|קופס|פח|מכל|צנצנת|תוף/],
};

const KNOWN_OLD_PLOT_FINGERPRINTS =
  /בד כחול|כפתור כחול|מדבקת שמש|אבן רגע|כיסאות מוזיקליים|פינת רעם|בריכת רעם|צנצנת רעם|ביצה ירוקה|עגלת תינוק|דלת לב|סטטוסקופ|פס אור מתחת לדלת|מנגינת הטיפות|ים החושך|שומר הנשימות/i;

const DIRECT_THERAPY_OR_MORAL =
  /תירגע|אין מה לפחד|זה כלום|תרגיל נשימה|נשימה עמוקה|כעס זה בסדר|להתגבר על הפחד|ואז (?:הוא|היא) הבי(?:ן|נה) ש|מוסר השכל/i;

function readJson<T>(relativeOrAbsolutePath: string): T {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.join(ROOT, relativeOrAbsolutePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as T;
}

function loadCatalog(): { manifest: CatalogManifest; sets: CompanionBriefSet[] } {
  const manifest = readJson<CatalogManifest>(CATALOG_PATH);
  return {
    manifest,
    sets: manifest.briefSetPaths.map((briefPath) => readJson<CompanionBriefSet>(briefPath)),
  };
}

function positiveCreativeText(brief: StoryBrief): string {
  return [
    brief.workingTitle,
    brief.creativePromise,
    brief.hiddenUnderlayer,
    brief.openingHook,
    brief.childWant,
    brief.physicalProblem,
    brief.playRule,
    ...brief.setPieces.flatMap(({ name, dramaticUse }) => [name, dramaticUse]),
    ...brief.lockedCausalMovement,
    brief.companionWrongHelp,
    ...brief.comicEscalations.flatMap(({ setup, consequence }) => [setup, consequence]),
    ...brief.attempts.flatMap(({ attempt, failure }) => [attempt, failure]),
    brief.childDiscovery,
    brief.childClimaxAction,
    brief.visiblePayoff,
    brief.endingEnergy,
    ...brief.recurringObjects,
    ...brief.transientCast,
    ...brief.rereadHooks,
    brief.lineTargets.childRepeatable,
    brief.lineTargets.parentReread,
    brief.companionIndispensability,
  ].join('\n');
}

function validateBriefShape(
  brief: StoryBrief,
  companionId: string,
  minimumSetPieces: number
): string[] {
  const issues: string[] = [];

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = brief[field];
    if (typeof value !== 'string' || value.trim().length < 3) {
      issues.push(`${String(field)} missing`);
    }
  }
  if (brief.briefVersion !== 'story-creative-brief/v1') issues.push('briefVersion');
  if (brief.status !== 'draft_for_guy_review') issues.push('status');
  if (brief.pageCount !== PAGE_COUNTS[brief.direction]) issues.push('pageCount');
  if (brief.setPieces.length < minimumSetPieces) issues.push('setPieces');
  if (brief.lockedCausalMovement.length < 5) issues.push('causal movement too thin');
  if (brief.lockedCausalMovement.length >= PAGE_COUNTS[brief.direction]) {
    issues.push('manual page spine encoded');
  }
  if (brief.comicEscalations.length !== 3) issues.push('comicEscalations');
  if (brief.comicEscalations.map(({ level }) => level).join(',') !== '1,2,3') {
    issues.push('comic escalation levels');
  }
  if (brief.attempts.length !== 2) issues.push('attempts');
  if (brief.recurringObjects.length < 2 || brief.recurringObjects.length > 4) {
    issues.push('recurringObjects');
  }
  if (brief.transientCast.length < 1 || brief.transientCast.length > 3) {
    issues.push('transientCast');
  }
  if (brief.rereadHooks.length !== 2) issues.push('rereadHooks');
  if (brief.worldAndSafetyLocks.length < 3) issues.push('worldAndSafetyLocks');
  if (brief.mustAvoid.length < 4) issues.push('mustAvoid');
  if (brief.oldStoryAntiCopy.length < 3) issues.push('oldStoryAntiCopy');
  if (brief.modelFreedom.length < 3) issues.push('modelFreedom');
  if (!brief.childDiscovery.startsWith('{{childName}}')) issues.push('childDiscovery owner');
  if (!brief.childClimaxAction.startsWith('{{childName}}')) issues.push('childClimaxAction owner');

  const setIds = brief.setPieces.map(({ id }) => id);
  const setNames = brief.setPieces.map(({ name }) => name);
  const setUses = brief.setPieces.map(({ dramaticUse }) => dramaticUse);
  if (new Set(setIds).size !== setIds.length) issues.push('duplicate set id');
  if (new Set(setNames).size !== setNames.length) issues.push('duplicate set name');
  if (new Set(setUses).size !== setUses.length) issues.push('duplicate set dramatic use');

  const comicConsequences = brief.comicEscalations.map(({ consequence }) => consequence);
  if (new Set(comicConsequences).size !== 3) issues.push('duplicate comic consequence');

  const positiveText = positiveCreativeText(brief);
  for (const marker of COMPANION_CAUSAL_MARKERS[companionId] ?? []) {
    if (!marker.test(positiveText)) issues.push(`missing companion marker ${marker.source}`);
  }
  if (KNOWN_OLD_PLOT_FINGERPRINTS.test(positiveText)) issues.push('old plot in positive fields');
  if (DIRECT_THERAPY_OR_MORAL.test(positiveText)) issues.push('therapy/moral in positive fields');

  return issues;
}

describe('next-generation story creative briefs', () => {
  it('covers the exact 18-slot MVP matrix with one staging brief per slot', () => {
    const { manifest, sets } = loadCatalog();

    expect(manifest.schemaVersion).toBe('next-generation-story-brief-catalog/v1');
    expect(manifest.status).toBe('staging_only');
    expect(manifest.expectedSlotCount).toBe(18);
    expect(manifest.briefSetPaths).toHaveLength(6);
    expect(new Set(manifest.briefSetPaths).size).toBe(6);
    expect(sets).toHaveLength(6);

    const actualSlots = new Map<string, StoryBrief>();
    for (const set of sets) {
      expect(set.schemaVersion).toBe('next-generation-companion-story-brief-set/v1');
      expect(set.status).toBe('staging_only');
      expect(set.briefs).toHaveLength(3);
      expect(set.companionBiblePath).toBe(`story-pipeline/01_companions/${set.companionId}.md`);
      expect(fs.existsSync(path.join(ROOT, set.companionBiblePath))).toBe(true);
      expect(set.briefs.map(({ direction }) => direction).sort()).toEqual([...DIRECTIONS].sort());

      for (const brief of set.briefs) {
        actualSlots.set(`${set.companionId}:${brief.direction}`, brief);
      }
    }

    const expectedSlots = new Map<string, { category: string; pageCount: number }>();
    for (const [category, matrixEntry] of Object.entries(MVP_STORY_MATRIX)) {
      for (const direction of DIRECTIONS) {
        expectedSlots.set(`${matrixEntry.companionId}:${direction}`, {
          category,
          pageCount: PAGE_COUNTS[direction],
        });
      }
    }

    expect(actualSlots.size).toBe(18);
    expect([...actualSlots.keys()].sort()).toEqual([...expectedSlots.keys()].sort());
    for (const [slotKey, expected] of expectedSlots) {
      expect(actualSlots.get(slotKey)?.category, slotKey).toBe(expected.category);
      expect(actualSlots.get(slotKey)?.pageCount, slotKey).toBe(expected.pageCount);
    }
  });

  it('keeps every brief complete, bounded, causal, companion-specific, and short of a manual page spine', () => {
    const { manifest, sets } = loadCatalog();

    for (const set of sets) {
      for (const brief of set.briefs) {
        const minimumSetPieces = manifest.directions[brief.direction].minimumMeaningfulSetPieces;
        expect(
          validateBriefShape(brief, set.companionId, minimumSetPieces),
          `${set.companionId}:${brief.direction}`
        ).toEqual([]);
      }
    }
  });

  it('proves the guard rejects a representative malformed, generic, companion-owned brief', () => {
    const { manifest, sets } = loadCatalog();
    const original = sets[0]!.briefs[0]!;
    const broken: StoryBrief = {
      ...structuredClone(original),
      pageCount: 9,
      setPieces: [original.setPieces[0]!],
      lockedCausalMovement: Array.from({ length: original.pageCount }, () => 'אותו מצב שוב'),
      comicEscalations: original.comicEscalations.slice(0, 2),
      childDiscovery: 'החבר מסביר את התשובה',
      childClimaxAction: 'החבר פותר הכול',
      companionWrongHelp: 'חבר חמוד עוזר',
    };

    const issues = validateBriefShape(
      broken,
      sets[0]!.companionId,
      manifest.directions[broken.direction].minimumMeaningfulSetPieces
    );
    expect(issues).toContain('pageCount');
    expect(issues).toContain('setPieces');
    expect(issues).toContain('manual page spine encoded');
    expect(issues).toContain('comicEscalations');
    expect(issues).toContain('childDiscovery owner');
    expect(issues).toContain('childClimaxAction owner');
  });

  it('keeps all 18 premise identities and climax/payoff mechanics distinct', () => {
    const { sets } = loadCatalog();
    const briefs = sets.flatMap(({ briefs: setBriefs }) => setBriefs);
    const review = fs.readFileSync(path.join(BRIEFS_ROOT, 'STORY_BRIEF_REVIEW_HE.md'), 'utf8');

    for (const values of [
      briefs.map(({ id }) => id),
      briefs.map(({ workingTitle }) => workingTitle),
      briefs.map(({ mechanicKey }) => mechanicKey),
      briefs.map(({ openingHook }) => openingHook),
      briefs.map(({ childClimaxAction }) => childClimaxAction),
      briefs.map(({ visiblePayoff }) => visiblePayoff),
    ]) {
      expect(new Set(values).size).toBe(18);
    }
    for (const brief of briefs) {
      expect(review, brief.id).toContain(`**${brief.workingTitle}**`);
    }
  });

  it('uses old stories only as closed anti-copy evidence and contains no generated prose', () => {
    const { sets } = loadCatalog();

    for (const set of sets) {
      const rawSet = JSON.stringify(set);
      expect(rawSet).not.toContain('--- Page 1 ---');
      expect(rawSet).not.toContain('imageDirection:');

      for (const brief of set.briefs) {
        expect(brief.oldStoryAntiCopy).toHaveLength(3);
        expect(brief.oldStoryAntiCopy.every((entry) => entry.startsWith('לא '))).toBe(true);
        expect(positiveCreativeText(brief)).not.toMatch(KNOWN_OLD_PLOT_FINGERPRINTS);
        expect(positiveCreativeText(brief)).not.toMatch(DIRECT_THERAPY_OR_MORAL);
      }
    }

    const rejectedSpineDir = path.join(PIPELINE_ROOT, '03_spines');
    expect(
      fs.existsSync(rejectedSpineDir) ? fs.readdirSync(rejectedSpineDir) : []
    ).toEqual([]);
  });

  it('gives ChatGPT one complete fail-closed output contract without granting bank authority', () => {
    const { manifest } = loadCatalog();
    const contract = fs.readFileSync(path.join(ROOT, manifest.writerContractPath), 'utf8');
    const readme = fs.readFileSync(path.join(BRIEFS_ROOT, 'README.md'), 'utf8');

    expect(contract).toContain('exactly 8 pages');
    expect(contract).toContain('exactly 12 pages');
    expect(contract).toContain('exactly 16 pages');
    expect(contract).toContain('25–45 Hebrew words per page');
    expect(contract).toContain('35–50 Hebrew words per page');
    expect(contract).toContain('45–60 Hebrew words per page');
    expect(contract).toContain('{{childName}}');
    expect(contract).toContain('{boy-form|girl-form}');
    expect(contract).toContain('imageDirection:');
    expect(contract).toContain('BRIEF_CONFLICT:');
    expect(contract).toContain('untrusted staging draft');
    expect(contract).toContain('Do not add `approvedBy`');
    expect(contract).not.toContain('story-bank/v3-approved/');

    expect(readme).toContain('exactly one structured story brief');
    expect(readme).toContain('Do not supply any V3/V5 story');
    expect(readme).toContain('Brief acceptance does not approve prose.');
  });
});
