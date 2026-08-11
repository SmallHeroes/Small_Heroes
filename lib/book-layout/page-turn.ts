export type PageTurnDirection = 'initial' | 'forward' | 'backward';

/** Direction is derived only from scene order, never from story or locale prose. */
export function pageTurnDirectionForIndexChange(
  currentIndex: number,
  nextIndex: number,
): PageTurnDirection {
  if (nextIndex === currentIndex) return 'initial';
  return nextIndex > currentIndex ? 'forward' : 'backward';
}

export type ReaderRestartTransition = Readonly<{
  sceneIndex: 0;
  pageTurnDirection: 'initial';
}>;

/** Restart is a state reset, not a synthetic backward turn from the final scene. */
export function readerRestartTransition(): ReaderRestartTransition {
  return { sceneIndex: 0, pageTurnDirection: 'initial' };
}
