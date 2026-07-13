/**
 * Reader-v2 navigation ordering — PURE + testable.
 *
 * The sequence at the end of a book is: [story pages] → power card → DEDICATION → end screen. The power card is
 * a terminal overlay and the dedication is the FINAL page shown AFTER it. So the power card triggers from the last
 * STORY page (the scene just before the dedication), advancing past the power card lands on the dedication page,
 * and advancing past the dedication opens the end screen. Empty dedication (no dedication scene) → the dedication
 * steps collapse and the flow is exactly the pre-existing [story] → power card → end.
 *
 * State is (index, powerCard, end); the reader applies the returned state and animates when the index changes.
 */
export interface ReaderNavState {
  /** Current scene index (into storyScenes). */
  index: number;
  /** The power-card overlay is showing. */
  powerCard: boolean;
  /** The end screen is showing. */
  end: boolean;
}

export interface ReaderNavContext {
  /** The last STORY scene index (the scene before the dedication, or the last scene when there is no dedication). */
  lastStoryIndex: number;
  /** The dedication scene index, or -1 when the book has no dedication. */
  dedicationIndex: number;
  hasDedication: boolean;
  hasPowerCard: boolean;
  sceneCount: number;
}

/** The next state when the reader advances (tap/swipe/‹ / power-card "continue"). */
export function readerNavForward(s: ReaderNavState, c: ReaderNavContext): ReaderNavState {
  if (c.sceneCount <= 0) return s;
  // From the power-card overlay → the dedication page (if any), else the end screen.
  if (s.powerCard) {
    return c.hasDedication
      ? { index: c.dedicationIndex, powerCard: false, end: false }
      : { index: s.index, powerCard: false, end: true };
  }
  // From the dedication page (the final page) → the end screen.
  if (c.hasDedication && s.index === c.dedicationIndex) {
    return { index: s.index, powerCard: false, end: true };
  }
  // Already at the end screen → no-op.
  if (s.end) return s;
  // From the last STORY page → power card (then dedication), else dedication, else end.
  if (s.index >= c.lastStoryIndex) {
    if (c.hasPowerCard) return { index: s.index, powerCard: true, end: false };
    if (c.hasDedication) return { index: c.dedicationIndex, powerCard: false, end: false };
    return { index: s.index, powerCard: false, end: true };
  }
  // Normal forward within the story — clamp to the last story page (never slide into the dedication directly).
  return { index: Math.min(s.index + 1, c.lastStoryIndex), powerCard: false, end: false };
}

/** The next state when the reader goes back (tap/swipe/› ). */
export function readerNavBackward(s: ReaderNavState, c: ReaderNavContext): ReaderNavState {
  if (c.sceneCount <= 0) return s;
  // From the end screen → back to the dedication (if any), else the power card, else the last story page.
  if (s.end) {
    if (c.hasDedication) return { index: c.dedicationIndex, powerCard: false, end: false };
    if (c.hasPowerCard) return { index: s.index, powerCard: true, end: false };
    return { index: s.index, powerCard: false, end: false };
  }
  // From the dedication page → back to the power card (if any), else the last story page.
  if (c.hasDedication && s.index === c.dedicationIndex) {
    return c.hasPowerCard
      ? { index: c.lastStoryIndex, powerCard: true, end: false }
      : { index: c.lastStoryIndex, powerCard: false, end: false };
  }
  // From the power-card overlay → back to the last story page.
  if (s.powerCard) return { index: s.index, powerCard: false, end: false };
  // Normal backward within the story.
  return { index: Math.max(s.index - 1, 0), powerCard: false, end: false };
}
