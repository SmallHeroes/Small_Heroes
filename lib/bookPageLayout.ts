/**
 * Book Page Composition Templates (Option B)
 * Deterministic assignment with controlled rhythm.
 */

export type BookPageTemplate =
  | 'full_bleed_overlay'
  | 'art_top_text_bottom'
  | 'character_vignette_text';

export type BookPageIntent = {
  type?: string;
  focus?: 'hero' | 'entity' | 'environment';
  camera?: 'close' | 'medium' | 'wide';
  background?: 'full' | 'partial' | 'minimal';
  emotion?: 'excitement' | 'tension' | 'calm';
};

export type BookPageForTemplate = {
  pageNumber: number;
  text: string;
  imageUrl?: string | null;
  imageSubject?: string;
  pageIntent?: BookPageIntent | null;
};

const SHORT_TEXT = 130;
const LONG_TEXT = 280;
const MAX_BLEED_STREAK = 2;
const MAX_VIGNETTE_STREAK = 2;

function normalizedLength(text: string): number {
  return text.replace(/\s+/g, ' ').trim().length;
}

function isImmersiveBeat(page: BookPageForTemplate): boolean {
  const intent = page.pageIntent;
  const subject = (page.imageSubject ?? '').toLowerCase();
  if (!intent) return subject === 'action' || subject === 'entity';
  if (intent.emotion === 'tension' || intent.emotion === 'excitement') return true;
  if (intent.type === 'action_page' || intent.type === 'magical_event' || intent.type === 'world_scene') return true;
  return false;
}

function isIntimateBeat(page: BookPageForTemplate): boolean {
  const intent = page.pageIntent;
  const subject = (page.imageSubject ?? '').toLowerCase();
  if (!intent) return subject.startsWith('supporting:') || subject === 'symbolic';
  if (intent.camera === 'close') return true;
  if (intent.emotion === 'calm' && intent.focus === 'hero') return true;
  if (
    intent.type === 'emotional_closeup' ||
    intent.type === 'minimal_vignette' ||
    intent.type === 'object_symbolic' ||
    intent.type === 'symbolic_page'
  ) {
    return true;
  }
  return false;
}

function assignRawTemplate(page: BookPageForTemplate, totalPages: number): BookPageTemplate {
  const len = normalizedLength(page.text);
  const first = page.pageNumber <= 1;
  const last = totalPages > 0 && page.pageNumber >= totalPages;

  if ((first || last) && len <= 190) return 'full_bleed_overlay';
  if (isImmersiveBeat(page) && len <= 180) return 'full_bleed_overlay';
  if (isIntimateBeat(page) || len <= SHORT_TEXT) return 'character_vignette_text';
  if (len >= LONG_TEXT) return 'art_top_text_bottom';
  return 'art_top_text_bottom';
}

function applyStreakCaps(templates: BookPageTemplate[]): void {
  let bleedStreak = 0;
  let vignetteStreak = 0;
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    if (t === 'full_bleed_overlay') {
      bleedStreak += 1;
      vignetteStreak = 0;
      if (bleedStreak > MAX_BLEED_STREAK) {
        templates[i] = 'art_top_text_bottom';
        bleedStreak = 0;
      }
      continue;
    }
    if (t === 'character_vignette_text') {
      vignetteStreak += 1;
      bleedStreak = 0;
      if (vignetteStreak > MAX_VIGNETTE_STREAK) {
        templates[i] = 'art_top_text_bottom';
        vignetteStreak = 0;
      }
      continue;
    }
    bleedStreak = 0;
    vignetteStreak = 0;
  }
}

function applyNeighborRhythm(templates: BookPageTemplate[], pages: BookPageForTemplate[]): void {
  for (let i = 1; i < templates.length; i++) {
    if (templates[i] !== templates[i - 1]) continue;
    if (templates[i] !== 'art_top_text_bottom') continue;
    const len = normalizedLength(pages[i].text);
    if (len <= SHORT_TEXT && isIntimateBeat(pages[i])) {
      templates[i] = 'character_vignette_text';
    }
  }
}

function applyInteriorBleedGuarantee(templates: BookPageTemplate[], pages: BookPageForTemplate[]): void {
  if (pages.length < 6) return;
  const hasInteriorBleed = templates.some(
    (template, index) => template === 'full_bleed_overlay' && index > 0 && index < templates.length - 1
  );
  if (hasInteriorBleed) return;

  let bestIndex = -1;
  let bestScore = -1;
  for (let i = 1; i < pages.length - 1; i++) {
    const len = normalizedLength(pages[i].text);
    let score = 0;
    if (isImmersiveBeat(pages[i])) score += 3;
    if ((pages[i].pageIntent?.emotion ?? 'calm') !== 'calm') score += 1;
    if ((pages[i].pageIntent?.type ?? '') === 'magical_event') score += 1;
    if (len <= 220) score += 1;
    if (len > 320) score -= 2;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  if (bestIndex >= 0) templates[bestIndex] = 'full_bleed_overlay';
}

export function assignTemplatesForBook(pages: BookPageForTemplate[]): BookPageTemplate[] {
  const total = pages.length;
  const templates = pages.map((page) => assignRawTemplate(page, total));
  applyStreakCaps(templates);
  applyNeighborRhythm(templates, pages);
  applyInteriorBleedGuarantee(templates, pages);
  return templates;
}

export function textPlacementForTemplate(template: BookPageTemplate): 'overlay' | 'bottom_white' | 'paper_flow' {
  if (template === 'full_bleed_overlay') return 'overlay';
  if (template === 'character_vignette_text') return 'paper_flow';
  return 'bottom_white';
}
