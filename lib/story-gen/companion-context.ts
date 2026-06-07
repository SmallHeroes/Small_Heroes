import { BOLLY_ARMADILLO } from '../companions';
import { getCompanionBible } from '../companion-bible';
import { getDeepProfile, type DeepProfile } from '../companion-deep-profiles';

function formatDeepProfileBlock(profile: DeepProfile, displayName: string): string {
  const lines: string[] = [
    `Companion: ${displayName} (${profile.companionId})`,
    `Speech: ${profile.speechPattern}`,
  ];
  if (profile.speechExamples.length > 0) {
    lines.push(`Examples: ${profile.speechExamples.join(' | ')}`);
  }
  lines.push(`Humor: ${profile.humorType}`);
  lines.push(`Comfort ritual: ${profile.comfortRitual}`);
  lines.push(`Relaxed body: ${profile.bodyLanguageRelaxed}`);
  lines.push(`Stressed body: ${profile.bodyLanguageStressed}`);
  if (profile.internalRules.length > 0) {
    lines.push(`Internal rules: ${profile.internalRules.join('; ')}`);
  }
  lines.push(`Coping: ${profile.copingStrategy}`);
  if (profile.essence) lines.push(`Essence: ${profile.essence}`);
  if (profile.signatureBehavior) lines.push(`Signature behavior: ${profile.signatureBehavior}`);
  if (profile.doNotWriteList?.length) {
    lines.push(`Do-not-write: ${profile.doNotWriteList.join('; ')}`);
  }
  if (profile.bookVoiceImplications) {
    lines.push(
      `Voice by direction — bedtime: ${profile.bookVoiceImplications.bedtime}; adventure: ${profile.bookVoiceImplications.adventure}; fantasy: ${profile.bookVoiceImplications.fantasy}`
    );
  }
  return lines.join('\n');
}

function formatBollyFallbackProfile(): string {
  const bible = getCompanionBible('bolly_armadillo');
  return [
    'Companion: בּוֹלִי (bolly_armadillo) — MALE armadillo',
    BOLLY_ARMADILLO.tagline,
    BOLLY_ARMADILLO.narrativeHook,
    'Speech: קצר, רך, לפעמים רק נשימה או תנועת קליפה; לא מעורר/מעוררת.',
    'Signature: curl to ball when overwhelmed; peek sequence — nose, one eye, small step; shell return is OK and does not erase the peek.',
    'Humor: גוף — קליפה נתקעת, אף מציץ לפני שהגוף מוכן.',
    'Do-not-write: "הוא אמיץ", medical lectures, flashlight/notebook/sword/shield/stars, feathers/fur/wings on shell.',
    bible
      ? `Forbidden objects: ${bible.forbiddenObjects.join(', ')}; forbidden tone: ${bible.forbiddenTone.join(', ')}`
      : '',
    'Coping: PEEK_GRADUALLY — one exposure at a time, not all-at-once bravery.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCompanionContextBlock(companionId: string): string {
  const profile = getDeepProfile(companionId);
  const bible = getCompanionBible(companionId);
  const displayName =
    companionId === 'bolly_armadillo'
      ? BOLLY_ARMADILLO.name
      : profile.companionId === companionId
        ? profile.companionId
        : companionId;

  const hasRichProfile =
    profile.companionId === companionId &&
    profile.speechExamples.length > 0 &&
    profile.companionId !== 'unknown';

  let block = hasRichProfile
    ? formatDeepProfileBlock(profile, displayName)
    : companionId === 'bolly_armadillo'
      ? formatBollyFallbackProfile()
      : formatDeepProfileBlock({ ...profile, companionId }, displayName);

  if (bible && companionId !== 'bolly_armadillo') {
    block += `\nBible constraints — forbidden objects: ${bible.forbiddenObjects.join(', ')}; tone: ${bible.forbiddenTone.join(', ')}`;
  }
  return block;
}
