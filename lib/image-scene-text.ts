/**
 * Image scene text — single frozen moment (no comic-panel sequences).
 */

const TEMPORAL_CONNECTOR_RE =
  /\b(?:then|and then|next|after that)\b|(?:ואז|אחר כך|ולאחר מכן)/iu;

export function sceneTextHasTemporalConnector(text: string): boolean {
  return TEMPORAL_CONNECTOR_RE.test(text);
}

/**
 * Collapse sequential action phrases to one resolution-state moment for gpt-image-2.
 * Prefers the segment after the last temporal connector.
 */
export function collapseTemporalSequenceInSceneText(text: string): {
  text: string;
  rewritten: boolean;
} {
  if (!sceneTextHasTemporalConnector(text)) {
    return { text: text.trim(), rewritten: false };
  }

  let out = text.trim();
  const parts = out.split(TEMPORAL_CONNECTOR_RE);
  if (parts.length > 1) {
    const resolution = parts[parts.length - 1]!.trim();
    if (resolution.length > 8) {
      out = resolution;
    }
  }

  out = out
    .replace(/\bclosing to (?:a )?fist\b/gi, '')
    .replace(/\bhalf[- ]?closing\b/gi, '')
    .replace(/\bopening slowly\b/gi, 'resting open, fingers softly uncurled')
    .replace(/\bopens? slowly\b/gi, 'resting open')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  if (/hand/i.test(out) && !/blanket/i.test(out) && /blanket/i.test(text)) {
    out = `${out}, on the blanket`;
  }
  if (/hand/i.test(out) && !/resting/i.test(out) && !/open/i.test(out)) {
    out = `hand resting open on the blanket, fingers softly uncurled`;
  }

  return { text: out.trim(), rewritten: true };
}

/** Auto-rewrite temporal connectors; throws if any remain after rewrite. */
export function sanitizeSceneTextForSingleMoment(text: string): string {
  const { text: collapsed, rewritten } = collapseTemporalSequenceInSceneText(text);
  if (sceneTextHasTemporalConnector(collapsed)) {
    throw new Error(
      `Scene text still contains temporal sequence after rewrite: "${collapsed.slice(0, 120)}…"`
    );
  }
  if (rewritten) {
    console.log(
      `[image-scene-text] temporal sequence collapsed: "${text.slice(0, 80)}…" → "${collapsed.slice(0, 80)}…"`
    );
  }
  return collapsed;
}
