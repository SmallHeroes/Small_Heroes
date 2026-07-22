/**
 * Build the AUTHORITATIVE prompt block for a page — the text injected into the image prompt that
 * OUTRANKS imageDirection and any legacy variation copy. It states the location/zone, cast +
 * wardrobe locks, prop state, mustShow/mustNotShow (incl. global forbiddens), and pins camera/action
 * as the ONLY thing imageDirection may influence.
 *
 * Pure string assembly — no I/O. The contract content here is the source of truth; the renderer must
 * treat this block as overriding any conflicting direction.
 */
import { projectPageActionProse, projectPageSafetyProse } from './projectContractProse';
import type { BookVisualContract } from './types';
import type { ResolvedPageContract } from './derivePageVisualContracts';

function line(label: string, value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value.trim()}`;
}

export function buildVisualContractPromptBlock(
  page: ResolvedPageContract,
  contract: BookVisualContract
): string {
  const location = contract.locations.find((l) => l.id === page.locationId);
  const runtimeAuthority = (contract as BookVisualContract & {
    approvedRuntimeAuthority?: { worldMode?: string };
  }).approvedRuntimeAuthority;
  const presence: string[] = [];
  const authoredCastIds = page.castIds ?? [];
  if (authoredCastIds.length > 0) {
    for (const castId of authoredCastIds) {
      if (castId === contract.cast.child.id) presence.push(`child (id=${castId})`);
      else if (castId === contract.cast.companion?.id) presence.push(`companion (id=${castId})`);
      else {
        const human = contract.humanCast?.find((member) => member.id === castId);
        presence.push(`${human?.role ?? 'cast member'} (id=${castId})`);
      }
    }
  } else {
    if (page.characterPresence.child) presence.push('child');
    if (page.characterPresence.companion) presence.push('companion');
  }

  const propState = (page.propState ?? [])
    .map((p) => {
      const prop = contract.recurringProps.find((rp) => rp.id === p.propId);
      return `${prop?.name ?? p.propId} = ${p.state}`;
    })
    .filter(Boolean)
    .join('; ');

  // (Slice B) resolve a castId → display name (child/companion name, else the human's role) for BODY STATE/LATERALITY.
  const castName = (id: string): string => {
    if (id === contract.cast.child.id) return contract.cast.child.name ?? 'the child';
    if (id === contract.cast.companion?.id) return contract.cast.companion.name ?? 'the companion';
    return contract.humanCast?.find((h) => h.id === id)?.role ?? id;
  };

  // (Slice B) PERSISTENT PROP identity (material / scale-to-child / persistence) for the page's recurring props.
  const persistentProp = (page.propState ?? [])
    .map((p) => {
      const rp = contract.recurringProps.find((x) => x.id === p.propId);
      const bits = [rp?.material, rp?.scale, rp?.persistence].filter((b): b is string => !!b && !!b.trim());
      return bits.length ? `${rp?.name ?? p.propId} = ${bits.join('; ')}` : null;
    })
    .filter((s): s is string => s != null)
    .join(' | ');

  // (Slice B) per-(page,castId) BODY STATE (e.g. "seated on the exam chair") and LATERALITY (injection/bandage arm).
  const bodyState = (page.castStates ?? [])
    .filter((s) => s.bodyState?.trim())
    .map((s) => `${castName(s.castId)} ${s.bodyState!.trim()}`)
    .join('; ');
  const laterality = (page.castStates ?? [])
    .map((s) => {
      const bits: string[] = [];
      if (s.injectionArm) bits.push(`injection on the ${s.injectionArm} arm`);
      if (s.bandageArm) bits.push(`bandage on the ${s.bandageArm} arm`);
      if (s.freeHand) bits.push(`holds the parent's hand with the ${s.freeHand} hand`);
      return bits.length ? `${castName(s.castId)}: ${bits.join(', ')}` : null;
    })
    .filter((s): s is string => s != null)
    .join('; ');

  const zoneGeometry = (page.zoneStableGeometry ?? []).join('; ');
  const transition = page.transition
    ? [
        `kind=${page.transition.kind}`,
        page.transition.fromZoneId ? `from=${page.transition.fromZoneId}` : null,
        page.transition.toZoneId ? `to=${page.transition.toZoneId}` : null,
        page.transition.cue ? `cue=${page.transition.cue}` : null,
      ].filter(Boolean).join('; ')
    : undefined;

  // (Stage 3) Deterministic PROJECTIONS of the page's structured action beats + hazard prohibitions. Computed here
  // and never stored/hashed, so no v1 prose field competes with them and they need no migration. A page that
  // authors no structure projects to '' → line() → null → the block stays byte-identical.
  const actionProse = projectPageActionProse(page, contract);
  const safetyProse = projectPageSafetyProse(page, contract);

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
    line('REALITY MODE (reviewer-owned)', runtimeAuthority?.worldMode),
    line('TIME / LIGHT', [location?.timeOfDay, location?.lighting].filter(Boolean).join('; ') || undefined),
    line('SET IDENTITY', location?.setIdentityId),
    line('TRANSITION AUTHORITY', transition),
    sameLocationNote,
    line('CAST PRESENT', presence.join(' + ') || 'none'),
    line('CHILD WARDROBE (locked)', page.childWardrobeLock),
    line('COMPANION WARDROBE (locked)', page.companionWardrobeLock),
    line('PROP STATE', propState || undefined),
    line('MUST SHOW', (page.mustShow ?? []).join('; ') || undefined),
    line('MUST NOT SHOW (never render)', (page.mustNotShow ?? []).join('; ') || undefined),
    line('CAMERA / ACTION', page.camera),
    // (Slice B) Authored steering fields — each omitted (line() → null) when unauthored, so the block is byte-identical
    // for contracts that do not use them. They are contract statements → protected by the AUTHORITY closer below.
    line('STABLE GEOMETRY', zoneGeometry || undefined),
    line('PERSISTENT PROP', persistentProp || undefined),
    line('BODY STATE', bodyState || undefined),
    line('LATERALITY', laterality || undefined),
    // (Stage 3) Projected from the page's structure — placed BEFORE the AUTHORITY closer so "THIS contract wins"
    // covers them too.
    line('ACTION BEATS', actionProse || undefined),
    line('SAFETY (never render)', safetyProse || undefined),
    'AUTHORITY: runtime presentation may influence camera, composition, staging, pose, blocking, eyeline, and emotion ONLY. It may NEVER change reality mode, location, zone, transition, set identity, cast, wardrobe, required content, props, or forbidden content. Where they conflict, THIS contract wins.',
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
