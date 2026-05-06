export interface ReferenceImageInput {
  url: string;
  role: 'child' | 'family_member' | 'other';
}

// LEGACY_NAME: kept for compatibility; this represents resemblance guidance data, not identity validation.
export interface CharacterIdentityLock {
  name: string;
  description: string;
  anchorImageUrl?: string;
}

// LEGACY_NAME: kept for compatibility; this feeds prompt guidance, not runtime validation.
export interface CharacterConsistencyLock {
  child: CharacterIdentityLock;
  /** Optional story companion (secondary) — see `lib/companions.ts` */
  companionSecondary?: CharacterIdentityLock;
  supportingCharacters?: CharacterIdentityLock[];
  heroVisualLockText?: string;
  referenceImages?: ReferenceImageInput[];
}

export function buildCharacterConsistencyBlock(lock: CharacterConsistencyLock): string {
  // PROMPT_ONLY: This guides the model output. It is not enforced by code validation.
  const lines: string[] = [
    `CHILD_RESEMBLANCE_GUIDELINE: ${lock.child.name} | ${lock.child.description}`,
    'STRONG_GUIDANCE_RESEMBLANCE: keep a similar illustrated child character across generated images (storybook consistency).',
    'FACE_GEOMETRY_GUIDELINE: prefer consistent jaw/cheek/chin structure, eye shape+spacing, nose shape, mouth proportions, skin tone, hair color+length+style, and age impression.',
    'ALLOWED_VARIATIONS_ONLY: clothing, pose, expression, environment, and lighting may change; core facial resemblance and proportions should stay consistent.',
    'REFERENCE_MATCH_PRIORITY: when a child reference photo exists, resemblance to that child should be prioritized across styles.',
    'REFERENCE_GUIDANCE_RULE: if resemblance to the uploaded child photo is weak, prefer regeneration.',
  ];

  if (lock.heroVisualLockText) {
    lines.push(`CHILD_HERO_VISUAL_GUIDELINE: ${lock.heroVisualLockText}`);
  }

  if (lock.child.anchorImageUrl) {
    lines.push(`CHILD_ANCHOR_IMAGE: ${lock.child.anchorImageUrl}`);
  }

  if (lock.companionSecondary) {
    const c = lock.companionSecondary;
    lines.push(
      `SECONDARY CHARACTER (companion): ${c.name} — ${c.description}. The companion SHOULD appear in every illustration that includes the hero, interacting naturally. The companion's appearance should stay consistent across illustrations (same species, same clothing, similar color palette).`
    );
    if (c.anchorImageUrl) {
      lines.push(`COMPANION_ANCHOR_IMAGE: ${c.anchorImageUrl}`);
    }
  }

  if (lock.supportingCharacters && lock.supportingCharacters.length > 0) {
    const supporting = lock.supportingCharacters.map((entry) => {
      if (entry.anchorImageUrl) {
        return `${entry.name}: ${entry.description} (anchor=${entry.anchorImageUrl})`;
      }
      return `${entry.name}: ${entry.description}`;
    });
    lines.push(`SUPPORTING_CHARACTER_GUIDELINES: ${supporting.join(' | ')}`);
  }

  if (lock.referenceImages && lock.referenceImages.length > 0) {
    const refs = lock.referenceImages.map((item) => `${item.role}:${item.url}`).join(' | ');
    lines.push(`REFERENCE_IMAGE_GUIDELINES: ${refs}`);
  }

  return lines.join('\n');
}

