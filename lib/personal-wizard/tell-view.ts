/**
 * Which screen step 1 shows, as pure functions (isomorphic; no React), so the transitions are tested
 * like the rest of the draft model.
 */
import { normalizeText, type PersonalBookDraft } from './contract';
import { activeFacts } from './draft';
import type { RecorderSnapshot } from './recorder';

/** How the parent chose to tell us: talking (the default), picking ready answers, or writing. */
export type TellMode = 'voice' | 'chips' | 'write';

/**
 * start = only the text and the big button; recording and processing = only that; write = the
 * writing box; card = what was understood, with the missing must-haves asked.
 */
export type TellView = 'start' | 'recording' | 'processing' | 'write' | 'card';

/** Unsent text and local clips are not draft revisions, but still need a loss disclosure. */
export function showDraftNotice(step: number, view: TellView, hasRecordedClip: boolean): boolean {
  if (step !== 1) return true;
  if (view === 'processing' || view === 'recording') return false;
  return view === 'write' || view === 'card' || hasRecordedClip;
}

/** Anything told, picked or typed so far. Once there is, the card replaces the start screen. */
export function hasTellContent(draft: PersonalBookDraft): boolean {
  return (
    Boolean(normalizeText(draft.child.name)) ||
    draft.child.age !== null ||
    draft.child.address !== null ||
    Boolean(normalizeText(draft.child.residence)) ||
    activeFacts(draft).length > 0 ||
    draft.noDifficulty ||
    draft.storyPlace !== null ||
    draft.conflicts.length > 0 ||
    draft.intentSuggestions.length > 0 ||
    draft.intent !== null ||
    draft.transcript !== null
  );
}

export function tellViewOf(input: {
  draft: PersonalBookDraft;
  phase: RecorderSnapshot['phase'];
  mode: TellMode;
  /** The card was shown with details in it: it stays, even if the parent then removes everything. */
  cardOpened: boolean;
}): TellView {
  if (input.draft.intake?.status === 'processing') return 'processing';
  if (input.phase === 'requesting' || input.phase === 'recording' || input.phase === 'stopping') return 'recording';
  if (input.cardOpened || input.mode === 'chips' || hasTellContent(input.draft)) return 'card';
  return input.mode === 'write' ? 'write' : 'start';
}

/**
 * An explicit switch between the ways to tell us (Codex QA of v2, P2-1). Leaving a card that holds
 * nothing yet, for recording or writing, really leaves it: the kept-open card must not override the
 * parent's explicit choice. With details already there, the card stays, so nothing is lost; recording
 * more is then done from the card itself.
 */
export function switchTellMode(
  state: { mode: TellMode; cardOpened: boolean },
  nextMode: TellMode,
  draft: PersonalBookDraft,
): { mode: TellMode; cardOpened: boolean } {
  if (nextMode !== 'chips' && !hasTellContent(draft)) return { mode: nextMode, cardOpened: false };
  return { mode: nextMode, cardOpened: state.cardOpened };
}
