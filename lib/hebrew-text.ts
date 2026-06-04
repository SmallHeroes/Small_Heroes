/**
 * Hebrew text helpers — shared by reader display, PDF, and validators.
 * Bank + DB keep partial nikud for TTS; UI strips niqqud for a clean read.
 */

/** Remove Hebrew niqqud + cantillation (U+0591–U+05C7). Preserves letters, punctuation, {{chips}}. */
export function stripNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, '');
}

/** Reader / print display — same as stripNikud (explicit call site). */
export function formatHebrewForDisplay(text: string): string {
  return stripNikud(text);
}
