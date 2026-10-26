/**
 * Geometry of the personal landing's friends row (`app/landing/personal-companion-carousel.tsx`).
 *
 * While it drifts, the row is a CSS transform over two identical copies of the friends: the track moves one copy's
 * width toward the reading start and loops. When it stops (the button, or keyboard focus) it becomes an ordinary
 * scroller of the same cards, opened exactly where the drift stood; when it plays again the drift continues from
 * wherever the parent left the scroller. These pure functions are that mapping, so it is tested without a browser.
 * The page is right to left, where scrolling further along makes `scrollLeft` negative.
 */

/** The drift's translate (px, growing as the friends move toward the reading start) as a distance into one copy. */
export function driftOffset(translateX: number, copyWidth: number): number {
  if (!(copyWidth > 0) || !Number.isFinite(translateX)) return 0;
  return ((translateX % copyWidth) + copyWidth) % copyWidth;
}

/** The still row's `scrollLeft` that shows exactly what a drift offset showed (RTL: further along is negative). */
export function stillScrollLeft(offset: number): number {
  return offset > 0 ? -offset : 0;
}

/** Milliseconds into one loop at which the drift shows what the still row shows, so play never jumps. */
export function driftTimeForScroll(scrollLeft: number, copyWidth: number, loopMs: number): number {
  if (!(copyWidth > 0) || !(loopMs > 0) || !Number.isFinite(scrollLeft)) return 0;
  return (driftOffset(Math.abs(scrollLeft), copyWidth) / copyWidth) * loopMs;
}
