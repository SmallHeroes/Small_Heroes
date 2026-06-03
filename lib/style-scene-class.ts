import type { StoryTimeOfDay } from './story-time-of-day';

/** Environment + time scene class for Style 01 telemetry and style-ref routing. */
export type Style01SceneClass =
  | 'fantasy-cave'
  | 'fantasy-cave-night'
  | 'forest-day'
  | 'forest-night'
  | 'forest-clearing'
  | 'forest-clearing-night'
  | 'forest-path'
  | 'forest-path-night'
  | 'yard-night'
  | 'garden-night'
  | 'porch-night'
  | 'bedroom-night'
  | 'outdoor-nature'
  | 'outdoor-night'
  | 'cozy-interior'
  | 'cozy-interior-night'
  | 'outdoor-magical'
  | 'outdoor-magical-night';

const FANTASY_CAVE_RE =
  /\b(cave|cave mouth|cave entrance|cave interior|inside cave|stalactites|stalagmites|mountain cave|mountain peak|cliff|glowing stones?|warm stone|amber glow|cavern|grotto|hollow|rocky walls|מערה|אבנ(?:ים|ה)|הר|מצוק|נטיפים|זיבים)\b/iu;
const FOREST_CLEARING_RE =
  /\b(forest clearing|sunny forest|berry bush|mossy green rock|clearing)\b/iu;
const FOREST_PATH_RE =
  /\b(forest path|deeper forest path|walking into the forest|woods path|path into the forest)\b/iu;
const FOREST_RE =
  /\b(forest edge|forest\b|woods\b|trees(?: around| nearby| above)|meadow|woodland|יער|חורש|squirrel)\b/iu;
const PORCH_RE = /\b(porch|doorstep|porch steps|steps toward the door|מרפסת)\b/iu;
const YARD_GARDEN_RE =
  /\b(backyard|yard|lawn|garden|grass|mint patch|חצר|דשא|גינה|שיח)\b/iu;
const BEDROOM_RE = /\b(bedroom|nightstand|bedside|warm bedroom|indoors? inside|חדר(?: שינה)?)\b/iu;
const COZY_INTERIOR_RE = /\b(bedroom|bedside|windowsill|indoor room|חדר|מיטה)\b/iu;
const OUTDOOR_MAGICAL_RE = /\b(sky|clouds|mountain peak|above the clouds|starlit|starry|moon|stars|שמיים|עננים|כוכב)\b/iu;

type BaseEnvironment =
  | 'cave'
  | 'forest-path'
  | 'forest-clearing'
  | 'forest'
  | 'porch'
  | 'yard'
  | 'bedroom'
  | 'cozy-interior'
  | 'outdoor-magical'
  | 'outdoor-nature';

function classifyBaseEnvironment(hay: string): BaseEnvironment {
  if (FANTASY_CAVE_RE.test(hay)) return 'cave';
  if (FOREST_PATH_RE.test(hay)) return 'forest-path';
  if (FOREST_CLEARING_RE.test(hay)) return 'forest-clearing';
  if (PORCH_RE.test(hay)) return 'porch';
  if (BEDROOM_RE.test(hay)) return 'bedroom';
  if (YARD_GARDEN_RE.test(hay)) return 'yard';
  if (FOREST_RE.test(hay)) return 'forest';
  if (COZY_INTERIOR_RE.test(hay)) return 'cozy-interior';
  if (OUTDOOR_MAGICAL_RE.test(hay)) return 'outdoor-magical';
  return 'outdoor-nature';
}

function toNightClass(base: BaseEnvironment): Style01SceneClass {
  switch (base) {
    case 'cave':
      return 'fantasy-cave-night';
    case 'forest-path':
      return 'forest-path-night';
    case 'forest-clearing':
      return 'forest-clearing-night';
    case 'forest':
      return 'forest-night';
    case 'porch':
      return 'porch-night';
    case 'yard':
      return 'garden-night';
    case 'bedroom':
      return 'bedroom-night';
    case 'cozy-interior':
      return 'cozy-interior-night';
    case 'outdoor-magical':
      return 'outdoor-magical-night';
    default:
      return 'outdoor-night';
  }
}

function toDayClass(base: BaseEnvironment): Style01SceneClass {
  switch (base) {
    case 'cave':
      return 'fantasy-cave';
    case 'forest-path':
      return 'forest-path';
    case 'forest-clearing':
      return 'forest-clearing';
    case 'forest':
      return 'forest-day';
    case 'porch':
    case 'yard':
      return 'outdoor-nature';
    case 'bedroom':
    case 'cozy-interior':
      return 'cozy-interior';
    case 'outdoor-magical':
      return 'outdoor-magical';
    default:
      return 'outdoor-nature';
  }
}

export function isNightEffectiveTime(effective?: StoryTimeOfDay | null): boolean {
  return effective === 'night' || effective === 'dusk';
}

export function classifyStyle01SceneClass(input: {
  imagePrompt?: string;
  bookPageText?: string;
  rawScenePrompt?: string;
  effectivePageTimeOfDay?: StoryTimeOfDay | null;
}): Style01SceneClass {
  const hay = [input.rawScenePrompt ?? '', input.imagePrompt ?? '', input.bookPageText ?? ''].join(' ');
  const base = classifyBaseEnvironment(hay);
  if (isNightEffectiveTime(input.effectivePageTimeOfDay)) {
    const nightClass = toNightClass(base);
    if (nightClass.endsWith('-night') && !nightClass.includes('-day')) return nightClass;
    return 'outdoor-night';
  }
  return toDayClass(base);
}

export type Style01SceneSubsetKey = 'fantasy-cave' | 'cozy-interior' | 'outdoor-magical';

export function resolveStyle01SceneRefSubset(sceneClass: Style01SceneClass): Style01SceneSubsetKey {
  if (sceneClass.startsWith('fantasy-cave')) return 'fantasy-cave';
  if (sceneClass.startsWith('bedroom') || sceneClass.startsWith('cozy-interior')) return 'cozy-interior';
  return 'outdoor-magical';
}

export function sceneClassIsNight(sceneClass: Style01SceneClass): boolean {
  return sceneClass.endsWith('-night') || sceneClass.includes('night');
}
