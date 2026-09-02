import { createHash } from 'node:crypto';

import { stripNikud } from '@/lib/hebrew-text';

export const NARRATION_AUDITION_POLICY_VERSION = 'narration-pronunciation-audition/v1' as const;

export const NARRATION_AUDITION_NIQQUD_SCOPES = ['none', 'risk_words', 'full_sentence'] as const;
export const NARRATION_AUDITION_PUNCTUATION_MODES = ['current_ellipsis', 'natural'] as const;

export type NarrationAuditionNiqqudScope = (typeof NARRATION_AUDITION_NIQQUD_SCOPES)[number];
export type NarrationAuditionPunctuationMode = (typeof NARRATION_AUDITION_PUNCTUATION_MODES)[number];

export interface NarrationAuditionItem {
  id: string;
  labelHe: string;
  source: string;
  rawText: string;
  riskWordsText: string;
  fullyVocalizedText: string;
  expectedReadings: readonly string[];
}

export const NARRATION_AUDITION_ITEMS: readonly NarrationAuditionItem[] = [
  {
    id: 'echo_hed',
    labelHe: 'הֵד — echo',
    source: 'Constructed minimal context for the reported word',
    rawText: 'הד נשמע במערה.',
    riskWordsText: 'הֵד נשמע במערה.',
    fullyVocalizedText: 'הֵד נִשְׁמַע בַּמְּעָרָה.',
    expectedReadings: ['הד נקרא הֵד (hed, echo)'],
  },
  {
    id: 'escaped_barcha',
    labelHe: 'בָּרְחָה — she escaped',
    source: 'Constructed minimal context for the reported word',
    rawText: 'היא ברחה אל הגן.',
    riskWordsText: 'היא בָּרְחָה אל הגן.',
    fullyVocalizedText: 'הִיא בָּרְחָה אֶל הַגַּן.',
    expectedReadings: ['ברחה נקראת בָּרְחָה (bar-kha, she escaped)'],
  },
  {
    id: 'poplar_and_honked_tziftzefa',
    labelHe: 'צפצפה — עץ מול פועל',
    source: 'Constructed contrast sentence containing both reported senses',
    rawText: 'המכונית צפצפה ליד צפצפה.',
    riskWordsText: 'המכונית צִפְצְפָה ליד צַפְצָפָה.',
    fullyVocalizedText: 'הַמְּכוֹנִית צִפְצְפָה לְיַד צַפְצָפָה.',
    expectedReadings: [
      'צפצפה נקראת צִפְצְפָה (tziftzefa, honked)',
      'צפצפה נקראת צַפְצָפָה (tzaftzafa, poplar)',
    ],
  },
  {
    id: 'apple_and_inflated_tapuach',
    labelHe: 'תפוח — פרי מול תיאור מנופח',
    source: 'Constructed contrast sentence containing both reported senses',
    rawText: 'תפוח היה ליד בלון תפוח.',
    riskWordsText: 'תַּפּוּחַ היה ליד בלון תָּפוּחַ.',
    fullyVocalizedText: 'תַּפּוּחַ הָיָה לְיַד בָּלוֹן תָּפוּחַ.',
    expectedReadings: [
      'תפוח נקרא תַּפּוּחַ (tapuach, apple)',
      'תפוח נקרא תָּפוּחַ (tafuach, inflated)',
    ],
  },
] as const;

export interface NarrationAuditionCell {
  clipId: string;
  itemId: string;
  itemLabelHe: string;
  source: string;
  niqqudScope: NarrationAuditionNiqqudScope;
  punctuationMode: NarrationAuditionPunctuationMode;
  seed: number;
  rawText: string;
  inputText: string;
  expectedReadings: readonly string[];
  inputCodePoints: number;
  inputUtf8Bytes: number;
  inputSha256: string;
}

function stableItemSeed(itemId: string): number {
  let hash = 0;
  for (const char of itemId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 900_000) + 1_000;
}

/** Snapshot of the current normal-mode punctuation transform. The baseline cell is tested byte-for-byte against prod. */
export function applyCurrentRuntimePunctuation(text: string): string {
  return text.replace(/\./g, '... ').replace(/,/g, ',  ');
}

export function textForNiqqudScope(
  item: NarrationAuditionItem,
  scope: NarrationAuditionNiqqudScope,
): string {
  switch (scope) {
    case 'none':
      return item.rawText;
    case 'risk_words':
      return item.riskWordsText;
    case 'full_sentence':
      return item.fullyVocalizedText;
  }
}

export function inputTextForCombination(
  item: NarrationAuditionItem,
  scope: NarrationAuditionNiqqudScope,
  punctuationMode: NarrationAuditionPunctuationMode,
): string {
  const text = textForNiqqudScope(item, scope);
  return punctuationMode === 'current_ellipsis' ? applyCurrentRuntimePunctuation(text) : text;
}

export function validateNarrationAuditionItems(
  items: readonly NarrationAuditionItem[] = NARRATION_AUDITION_ITEMS,
): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate or empty narration audition item id: ${item.id}`);
    ids.add(item.id);
    if (!item.rawText.trim() || !item.riskWordsText.trim() || !item.fullyVocalizedText.trim()) {
      throw new Error(`Narration audition item ${item.id} has empty text`);
    }
    if (stripNikud(item.riskWordsText) !== item.rawText) {
      throw new Error(`Narration audition item ${item.id} risk-word text changes source letters or punctuation`);
    }
    if (stripNikud(item.fullyVocalizedText) !== item.rawText) {
      throw new Error(`Narration audition item ${item.id} full-niqqud text changes source letters or punctuation`);
    }
    if (item.riskWordsText === item.rawText || item.fullyVocalizedText === item.rawText) {
      throw new Error(`Narration audition item ${item.id} does not exercise a niqqud variant`);
    }
    if (item.expectedReadings.length === 0) {
      throw new Error(`Narration audition item ${item.id} has no expected reading`);
    }
  }
}

export function buildNarrationAuditionCells(
  items: readonly NarrationAuditionItem[] = NARRATION_AUDITION_ITEMS,
): NarrationAuditionCell[] {
  validateNarrationAuditionItems(items);
  const cells: NarrationAuditionCell[] = [];
  for (const item of items) {
    const seed = stableItemSeed(item.id);
    for (const niqqudScope of NARRATION_AUDITION_NIQQUD_SCOPES) {
      for (const punctuationMode of NARRATION_AUDITION_PUNCTUATION_MODES) {
        const inputText = inputTextForCombination(item, niqqudScope, punctuationMode);
        cells.push({
          clipId: `${item.id}__${niqqudScope}__${punctuationMode}__fairy`,
          itemId: item.id,
          itemLabelHe: item.labelHe,
          source: item.source,
          niqqudScope,
          punctuationMode,
          seed,
          rawText: item.rawText,
          inputText,
          expectedReadings: item.expectedReadings,
          inputCodePoints: Array.from(inputText).length,
          inputUtf8Bytes: Buffer.byteLength(inputText, 'utf8'),
          inputSha256: createHash('sha256').update(inputText, 'utf8').digest('hex'),
        });
      }
    }
  }
  const ids = new Set(cells.map((cell) => cell.clipId));
  if (ids.size !== cells.length) throw new Error('Narration audition generated duplicate clip ids');
  if (cells.length !== 24) throw new Error(`Narration audition must contain exactly 24 cells; got ${cells.length}`);
  return cells;
}
