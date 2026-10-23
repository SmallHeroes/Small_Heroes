/** Prospective scene-presentation guidance only. Never a pixel verdict or permission to render. */
export const READER_SAFE_FRAMING_VERSION = 'reader-safe-scene-framing/v1' as const;
export const READER_FIT_FRAMING_VERSION = 'reader-safe-scene-framing/v2' as const;
export const READER_SAFE_FRAMING_VERSIONS = [READER_SAFE_FRAMING_VERSION, READER_FIT_FRAMING_VERSION] as const;
export type ReaderSafeFramingVersion = typeof READER_SAFE_FRAMING_VERSIONS[number];
type Shot = 'wide' | 'medium' | 'close';

/** Preserve smaller authored targets. A ceiling must never become the default character size. */
export function readerSafeSceneFraming(version: ReaderSafeFramingVersion, shot: Shot, authoredChildHeightFraction?: number) {
  if (!READER_SAFE_FRAMING_VERSIONS.includes(version) || !['wide', 'medium', 'close'].includes(shot) ||
      authoredChildHeightFraction !== undefined && (!Number.isFinite(authoredChildHeightFraction) ||
        authoredChildHeightFraction <= 0 || authoredChildHeightFraction > 1)) throw Error('reader_safe_scene_framing_contract');
  if (version === READER_FIT_FRAMING_VERSION) {
    const target = shot === 'wide' ? .3 : shot === 'close' ? .5 : .4;
    return { version, scope: 'cover_and_body_scenes_only' as const, profile: 'complete_source_contain_reader' as const,
      shot, authoredChildHeightFraction: authoredChildHeightFraction ?? null,
      targetChildHeightFraction: Math.min(authoredChildHeightFraction ?? target, target),
      maximumVisibleActorHeightFraction: .55,
      safeActionRect: { left: .08, top: .08, right: .92, bottom: .92 },
      sourcePlanUnchanged: true as const, ratioDeviationImpact: 'detail' as const };
  }
  const shotTargetMaximum = shot === 'wide' ? .35 : shot === 'close' ? .65 : .5;
  return {
    version, scope: 'cover_and_body_scenes_only' as const,
    profile: 'square_source_center_cover_tall_reader' as const,
    shot, authoredChildHeightFraction: authoredChildHeightFraction ?? null,
    targetChildHeightFraction: Math.min(authoredChildHeightFraction ?? shotTargetMaximum, shotTargetMaximum),
    maximumVisibleActorHeightFraction: .7,
    // Survives centered crops retaining >=40% width and >=80% height, not arbitrary reader aspect ratios/object-position.
    safeActionRect: { left: .3, top: .1, right: .7, bottom: .9 },
    sourcePlanUnchanged: true as const,
    ratioDeviationImpact: 'detail' as const,
  };
}

export function readerSafeSceneFramingPrompt(framing: ReturnType<typeof readerSafeSceneFraming>) {
  const percent = (fraction: number) => Math.round(fraction * 10000) / 100;
  if (framing.version === READER_FIT_FRAMING_VERSION) return `READER-SAFE SCENE FRAMING (${framing.version}; complete-artwork presentation guidance, not a new acceptance gate):
- Pull the CAMERA BACK. Target the child's visible height at about ${percent(framing.targetChildHeightFraction)}% of the COMPLETE source image height. Wide/normal scenes target30–40%;even planned close scenes target at most50%. No visible foreground actor should exceed55%;that ceiling is NOT the target.
- Draw the whole interaction with substantial environmental context and clear breathing room above,below and around every visible actor. Keep essential faces,hands,feet/tail and the story object inside x=8–92%,y=8–92%;no giant isolated face and no essential action at the edge.
- The reader contains the COMPLETE source image;do not enlarge the cast for a hypothetical portrait crop. A group can spread naturally across the source rather than crowding into a narrow central strip. Preserve each character's canonical size relative to the others and grounded perspective;never shrink only the companion,hide required cast,change anatomy/identity or invent another event/location.
- This prospective version changes drawing occupancy/composition only;source world,cast,action and plan remain unchanged. Numeric framing drift alone is detail and does NOT trigger HOLD,retries or a new render. Actual loss of required story action,identity or safety remains subject to existing requirements. Do not draw measurement labels,rectangles or borders.`;
  return `READER-SAFE SCENE FRAMING (${framing.version}; presentation guidance, not a new acceptance gate):
- Target the child's visible height at about ${percent(framing.targetChildHeightFraction)}% of the COMPLETE source image height. Normal scenes stay around 35–50% or the smaller authored target; wide scenes at most 35%, planned close scenes at most 65%. The 70% ceiling is NOT the target.
- No visible foreground actor's silhouette should occupy more than 70% of source image height. Leave air above/below and space around the cast. For normal/wide shots keep mostly full figures and substantial environmental context. A planned close shot may crop intentionally, but must retain the meaningful hands/face/object interaction, never a giant isolated face.
- Compose for the square-source CENTER-COVER tall-reader envelope: keep the essential visible cast, faces, hands, story object and the complete action together inside the central 40% of source width (x=30–70%) and central 80% of height (y=10–90%). Background scenery may bleed beyond this safe action rectangle; the child, companion or plot-critical gesture must not be parked at opposite outer edges.
- Pull the CAMERA BACK and leave margins around the whole interaction. Preserve each character's canonical body size relative to the others and grounded perspective; never shrink only the companion, change identity/anatomy, hide required actors or move them to a different story location to fit. Preserve all world-state relationships and the written action; choose permitted camera/staging, not new events.
- This version refines only the source plan's frame-occupancy drawing target; its world, cast, action and source plan remain unchanged. Numeric framing drift alone remains a detail note and does NOT trigger HOLD, retries or a new render. Actual loss of required story action, identity or safety remains subject to the existing requirements.
- This profile protects only centered crops that retain at least 40% of source width and 80% of source height. It is not permission to ignore a different canvas/crop profile. Do not draw a rectangle, measurements, labels or borders.`;
}
