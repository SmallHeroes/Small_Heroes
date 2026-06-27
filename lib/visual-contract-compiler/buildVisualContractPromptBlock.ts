/**
 * Build the AUTHORITATIVE prompt block for a page — the text injected into the image prompt that
 * OUTRANKS imageDirection and any legacy variation copy. It states the location/zone, cast +
 * wardrobe locks, prop state, mustShow/mustNotShow (incl. global forbiddens), and pins camera/action
 * as the ONLY thing imageDirection may influence.
 *
 * Pure string assembly — no I/O. The contract content here is the source of truth; the renderer must
 * treat this block as overriding any conflicting direction.
 */
import type { BookVisualContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';
import { buildCompanionScalePromptLine } from '@/lib/companion-scale';

function line(label: string, value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value.trim()}`;
}

export function buildVisualContractPromptBlock(
  page: ResolvedPageContract,
  contract: BookVisualContract
): string {
  const location = contract.locations.find((l) => l.id === page.locationId);
  const presence: string[] = [];
  if (page.characterPresence.child) presence.push('child');
  if (page.characterPresence.companion) presence.push('companion');
  // Companion size-vs-child lock — only when the companion is actually on the page.
  const companionScale = page.characterPresence.companion
    ? contract.cast.companion?.scaleContract
    : undefined;

  const propState = (page.propState ?? [])
    .map((p) => {
      const prop = contract.recurringProps.find((rp) => rp.id === p.propId);
      return `${prop?.name ?? p.propId} = ${p.state}`;
    })
    .filter(Boolean)
    .join('; ');

  const sameLocationNote =
    page.sameLocationAs != null
      ? `This is the SAME place as page ${page.sameLocationAs}; only the camera angle/action changes — do NOT change the setting.`
      : null;

  const lines: Array<string | null> = [
    '=== VISUAL CONTRACT (AUTHORITATIVE — overrides imageDirection and any other location/cast/wardrobe direction) ===',
    line(
      'LOCATION',
      `${page.locationName} (id=${page.locationId})${location?.description ? ` — ${location.description}` : ''}`
    ),
    line('ZONE', page.zoneName ? `${page.zoneName} (id=${page.zoneId}) — a zone WITHIN this location, not a new place` : undefined),
    line('WORLD', contract.worldType),
    sameLocationNote,
    line('CAST PRESENT', presence.join(' + ') || 'none'),
    line('CHILD WARDROBE (locked)', page.childWardrobeLock),
    line('COMPANION WARDROBE (locked)', page.companionWardrobeLock),
    companionScale ? buildCompanionScalePromptLine(companionScale) : null,
    line('PROP STATE', propState || undefined),
    line('MUST SHOW', (page.mustShow ?? []).join('; ') || undefined),
    line('MUST NOT SHOW (never render)', (page.mustNotShow ?? []).join('; ') || undefined),
    line('CAMERA / ACTION', page.camera),
    'AUTHORITY: imageDirection may influence camera angle and action ONLY. It may NEVER change the location, zone, cast, wardrobe, or introduce any MUST-NOT-SHOW element. Where they conflict, THIS contract wins.',
  ];

  return lines.filter((l): l is string => l != null).join('\n');
}

/**
 * Compose the final GPT-Image prompt with the contract block FIRST (authoritative), then the legacy
 * scene prompt. Pure + idempotent: a blank/absent block returns the base prompt unchanged (legacy
 * behavior), and a base prompt that already begins with the block is not double-prefixed.
 */
export function composeContractAuthoritativePrompt(
  contractBlock: string | undefined | null,
  basePrompt: string
): string {
  const block = (contractBlock ?? '').trim();
  if (!block) return basePrompt;
  if (basePrompt.startsWith(block)) return basePrompt;
  return `${block}\n\n${basePrompt}`;
}
