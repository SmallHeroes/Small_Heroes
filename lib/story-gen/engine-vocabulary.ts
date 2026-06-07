/**
 * Companion engine vocabulary — mask for shape comparison; preserve for swap/freshness engine channel.
 */

import { maskEngineVocabulary as maskBollyEngine } from './craft-rubric-v2.1';

export type FreshnessChannel = 'engine' | 'shape';

export interface FreshnessDimensionDef {
  id: string;
  label: string;
  channel: FreshnessChannel;
}

/** Decision Gate §6 — 15 dimensions. Engine dims allow same-companion recurrence. */
export const FRESHNESS_DIMENSIONS: FreshnessDimensionDef[] = [
  { id: 'openingDevice', label: 'opening device', channel: 'shape' },
  { id: 'companionEntry', label: 'companion entry', channel: 'shape' },
  { id: 'settingWorld', label: 'setting/world', channel: 'shape' },
  { id: 'incitingTrigger', label: 'inciting trigger', channel: 'shape' },
  { id: 'agencyMechanism', label: 'agency mechanism', channel: 'shape' },
  { id: 'companionFlawExpression', label: 'companion-flaw expression', channel: 'shape' },
  { id: 'toolCopingAction', label: 'tool/coping action', channel: 'engine' },
  { id: 'climaxShape', label: 'climax shape', channel: 'shape' },
  { id: 'emotionalResolution', label: 'emotional resolution', channel: 'shape' },
  { id: 'signatureImagery', label: 'signature imagery', channel: 'engine' },
  { id: 'comicEngine', label: 'comic engine', channel: 'engine' },
  { id: 'endingResidue', label: 'ending residue', channel: 'shape' },
  { id: 'pageRhythm', label: 'page rhythm', channel: 'shape' },
  { id: 'languagePattern', label: 'language pattern', channel: 'shape' },
  { id: 'imageDirectionDiversity', label: 'imageDirection diversity', channel: 'shape' },
];

const TUBI_ENGINE_RE =
  /טוּ?בִ?י|טubi|tubi|אוזנ|חצי.?אוזן|קול.?אחד|כפות|חדק|בּ?וּם|פּ?וּף|רְ?רוּם|וילון|מְקָרֵר|תִּק.?תּ?וּ?ק/giu;

const WHALE_ENGINE_RE = /שִׁירוֹ|שירו|whale|שיר בתוך|רעש.?שיר|noise.?song/giu;

export function maskCompanionEngine(text: string, companionId: string): string {
  let t = text;
  if (companionId === 'bolly_armadillo') {
    t = maskBollyEngine(t);
  }
  if (companionId === 'baby_elephant') {
    t = t
      .replace(TUBI_ENGINE_RE, 'ENGINE_TOKEN')
      .replace(/פיל|elephant/giu, 'COMPANION_SPECIES');
  }
  if (companionId === 'song_whale') {
    t = t.replace(WHALE_ENGINE_RE, 'ENGINE_TOKEN');
  }
  t = t
    .replace(/בּ?וֹ?לִ?י/gu, 'COMPANION')
    .replace(/בולי/gu, 'COMPANION')
    .replace(/טוּ?בִ?י/gu, 'COMPANION');
  return t;
}

export function stripCompanionIdentity(text: string, companionId: string): string {
  let t = maskCompanionEngine(text, companionId);
  t = t.replace(/\{\{childName\}\}/g, 'CHILD');
  return t;
}

export function engineChannelIds(): string[] {
  return FRESHNESS_DIMENSIONS.filter((d) => d.channel === 'engine').map((d) => d.id);
}

export function shapeChannelIds(): string[] {
  return FRESHNESS_DIMENSIONS.filter((d) => d.channel === 'shape').map((d) => d.id);
}
