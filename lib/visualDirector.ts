import { normalizeStyleId, STYLE_IDS } from '@/lib/styles';

export type VisualDirectorInput = {
  selectedStyle: string;
  pageNumber: number;
  totalPages: number;
  pageText: string;
  stage4Prompt?: string;
  pageIntent?: unknown;
  visualBible?: unknown;
  composition?: unknown;
  expectedCharacters?: string[];
  childName?: string;
  companionName?: string;
  companionDescription?: string;
  directionArchetype?: string;
  photoQuality?: string;
};

export type VisualDirectorOutput = {
  finalPrompt: string;
  negativePrompt: string;
};

function compact(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function toOneLine(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return compact(value) || fallback;
  if (value == null) return fallback;
  try {
    return compact(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function truncate(value: string, max = 260): string {
  if (value.length <= max) return value;
  const clipped = value.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

export function resolveStyleSentence(selectedStyle: string): string {
  const styleId = normalizeStyleId(selectedStyle);
  if (styleId === STYLE_IDS.SOFT_HAND_DRAWN_STORYBOOK) {
    return "Realistic artistic portrait with dissolving watercolor background: characters in sharp painterly detail, surroundings fade into warm watercolor washes. Rich warm palette, cinematic lighting on subjects, top area open for text. Like a fine art painting emerging from abstract warm tones. No cartoon, no sketch, no flat illustration, no fully detailed edge-to-edge backgrounds.";
  }
  return "Charming pencil illustration on warm cream paper with soft watercolor touches: cute expressive characters drawn prominently, soft pencil lines, gentle muted watercolor washes, cream paper visible at edges. Characters fill most of the image — not tiny. Each character has correct separate anatomy. No full-color, no busy backgrounds, no digital look.";
}

function buildSceneSentence(input: VisualDirectorInput): string {
  const sceneFromText = truncate(compact(input.pageText), 220);
  const stage4 = truncate(compact(input.stage4Prompt), 220);
  const pageBeat = `Page ${input.pageNumber} of ${input.totalPages}`;
  if (stage4) {
    return `${pageBeat}: Stage a concrete scene based on this story beat "${sceneFromText}" and these visual notes "${stage4}". Show where it happens, what the child is doing, what the companion/entity is doing, and what surrounds them.`;
  }
  return `${pageBeat}: Stage a concrete scene based on "${sceneFromText}". Show where it happens, what the child is doing, what the companion/entity is doing, and what surrounds them.`;
}

function buildCharacterSentence(input: VisualDirectorInput): string {
  const child = compact(input.childName) || 'the child hero';
  const expected = (input.expectedCharacters ?? []).map(compact).filter(Boolean);
  const companion = compact(input.companionName);
  const companionDesc = compact(input.companionDescription);
  const hasCompanion = companion.length > 0 || expected.some((name) => name !== child);
  if (!hasCompanion) {
    return `Keep ${child} clearly visible and active in the scene, with expressive face and body language.`;
  }
  const companionLabel = companion || expected.find((name) => name !== child) || 'the companion';
  const companionDetail = companionDesc ? ` (${truncate(companionDesc, 120)})` : '';
  return `Keep ${child} and ${companionLabel}${companionDetail} both visible and interacting directly; use action verbs like guiding, walking with, leaning toward, pointing, carrying, or flying beside.`;
}

function buildToneSentence(input: VisualDirectorInput): string {
  const archetype = compact(input.directionArchetype);
  if (archetype) {
    return `Children's book emotional floor: warm, safe, hopeful, curious, magical, brave. Match tone to archetype "${archetype}" while avoiding consistently sad, depressed, lonely, exhausted, or frightening mood.`;
  }
  return 'Children\'s book emotional floor: warm, safe, hopeful, curious, magical, brave. Avoid consistently sad, depressed, lonely, exhausted, or frightening mood.';
}

function buildCompositionSentence(input: VisualDirectorInput): string {
  const intent = truncate(toOneLine(input.pageIntent), 150);
  const composition = truncate(toOneLine(input.composition), 150);
  const visualBible = truncate(toOneLine(input.visualBible), 120);
  const quality = compact(input.photoQuality);
  const contextParts = [intent, composition, visualBible].filter(Boolean);
  const contextSuffix =
    contextParts.length > 0 ? ` Use this composition context: ${contextParts.join(' | ')}.` : '';
  const qualitySuffix = quality ? ` Photo quality note: ${quality}.` : '';
  return `Use story-aware composition with environment context; avoid default portrait framing and avoid close-up unless explicitly intimate.${contextSuffix}${qualitySuffix}`;
}

function buildEnvironmentSentence(): string {
  return 'Always include full environment depth with foreground, midground, and background; keep setting details readable and supportive of narrative action.';
}

export function composeVisualDirectorPrompt(input: VisualDirectorInput): VisualDirectorOutput {
  const style = resolveStyleSentence(input.selectedStyle);
  const scene = buildSceneSentence(input);
  const characters = buildCharacterSentence(input);
  const tone = buildToneSentence(input);
  const composition = buildCompositionSentence(input);
  const environment = buildEnvironmentSentence();

  const finalPrompt = [style, scene, characters, tone, composition, environment].join(' ');
  const negativePrompt = [
    'no text',
    'no letters',
    'no captions',
    'no logos',
    'no watermarks',
    'no speech bubbles',
    'no white background',
    'no plain background',
    'no portrait',
    'no headshot',
    'no character sheet',
    'no concept art sheet',
    'no isolated character',
  ].join(', ');

  return { finalPrompt, negativePrompt };
}

