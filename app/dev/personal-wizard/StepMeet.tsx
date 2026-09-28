'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { CHIPS, COMMON, INTAKE_ERRORS, RECORDER, SOURCE_BADGE, TEST_PANEL, TRANSCRIPT, meetCopy } from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import {
  addTypedFact,
  chipIsSelected,
  commitStoryPlace,
  randomId,
  resolveConflict,
  toggleChip,
  type FactOutcome,
} from '@/lib/personal-wizard/draft';
import type { FixtureExampleId } from '@/lib/personal-wizard/intake-fixture';
import type { LiveIntakeError } from '@/lib/personal-wizard/intake-live-client';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { FactsList } from './FactsList';
import { RecorderPanel } from './RecorderPanel';
import styles from './personal-wizard.module.css';

export type IntakeNotice =
  | { kind: 'added'; count: number; suggestions: number }
  | { kind: 'nothing_new' }
  | { kind: 'not_understood' }
  | { kind: 'abandoned' }
  | { kind: 'failed' }
  | { kind: 'error'; error: LiveIntakeError };

export type MeetPrompt = 'processing' | 'recording' | null;

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
  recorder: {
    snapshot: RecorderSnapshot;
    stream: MediaStreamLike | null;
    controller: () => RecordingController | null;
  };
  playback: { playingId: string | null; play: (id: string, url: string) => void; stop: () => void };
  liveIntake: boolean;
  intakeNotice: IntakeNotice | null;
  lateIgnored: boolean;
  onStartFixture: (exampleId: FixtureExampleId) => void;
  onCancelIntake: () => void;
  onSendClip: () => void;
  clipSent: boolean;
  /** Live only: explicit re-organisation of a corrected transcript. Absent when not connected. */
  onReorganize?: (text: string) => void;
  prompt: MeetPrompt;
  onPromptChoice: (choice: 'wait' | 'skip') => void;
};

export function StepMeet(props: Props) {
  const { draft, update, titleRef, recorder, playback, liveIntake, prompt } = props;
  const name = normalizeText(draft.child.name);
  const copy = meetCopy(name, draft.child.address);
  const processing = draft.intake?.status === 'processing';
  const fixtureProcessing = processing && draft.intake?.source === 'fixture';
  const transcriptProcessing = processing && draft.intake?.source === 'transcript';

  const [showOther, setShowOther] = useState(false);
  const [otherValue, setOtherValue] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [factMessage, setFactMessage] = useState<{ field: 'chips' | 'other' | 'extra'; text: string } | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptText = draft.transcript?.text ?? '';
  const [transcriptDraft, setTranscriptDraft] = useState(transcriptText);
  useEffect(() => setTranscriptDraft(transcriptText), [transcriptText]);
  const canReorganize = Boolean(props.onReorganize) && draft.transcript?.source === 'transcript';

  const placeRef = useRef<HTMLInputElement | null>(null);
  const [placeValue, setPlaceValue] = useState(draft.storyPlace?.value ?? '');
  const placeFocused = useRef(false);
  const draftPlace = draft.storyPlace?.value ?? '';
  useEffect(() => {
    // Sync external changes (a proposal, an accepted conflict, a removal) unless the parent is typing.
    if (!placeFocused.current) setPlaceValue(draftPlace);
  }, [draftPlace]);

  const promptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prompt) promptRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [prompt]);

  const outcomeText = (outcome: FactOutcome | 'removed'): string | null => {
    if (outcome === 'limit' || outcome === 'duplicate' || outcome === 'too_long' || outcome === 'empty') {
      return copy.factOutcome[outcome];
    }
    return null;
  };

  const addFact = (field: 'other' | 'extra', value: string, onDone: () => void) => {
    let outcome = 'empty' as FactOutcome;
    update((current) => {
      const result = addTypedFact(current, field === 'other' ? 'interest' : 'habit', value, randomId);
      outcome = result.outcome;
      return result.draft;
    });
    const text = outcomeText(outcome);
    setFactMessage(text ? { field, text } : null);
    if (!text) onDone();
  };

  const commitPlace = () => {
    placeFocused.current = false;
    if (normalizeText(placeValue) !== normalizeText(draftPlace) || (!placeValue && draftPlace)) {
      update((current) => commitStoryPlace(current, placeValue));
    }
  };

  const placeSource = draft.storyPlace?.source;
  const placeBadge = placeSource === 'fixture' || placeSource === 'transcript' ? placeSource : null;

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h1>
      <p className={styles.stepSub}>{copy.lead}</p>

      <RecorderPanel
        snapshot={recorder.snapshot}
        stream={recorder.stream}
        controller={recorder.controller}
        playback={playback}
        liveIntake={liveIntake}
        voiceCta={copy.voiceCta}
        voiceNote={liveIntake ? copy.voiceNoteLive : copy.voiceNoteLocal}
        transcriptProcessing={transcriptProcessing}
        clipSent={props.clipSent}
        onCancelProcessing={props.onCancelIntake}
        onSend={props.onSendClip}
      />

      <IntakeStatus notice={props.intakeNotice} />

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{copy.orPickOrType}</h2>
        <div className={styles.chips} role="group" aria-label={copy.chipsLabel}>
          {CHIPS.map((chip) => {
            const selected = chipIsSelected(draft, chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                className={styles.chip}
                aria-pressed={selected}
                data-selected={selected || undefined}
                onClick={() => {
                  let outcome = 'empty' as FactOutcome | 'removed';
                  update((current) => {
                    const result = toggleChip(current, { id: chip.id, label: chip.label, kind: 'interest' }, randomId);
                    outcome = result.outcome;
                    return result.draft;
                  });
                  const text = outcomeText(outcome);
                  setFactMessage(text ? { field: 'chips', text } : null);
                }}
              >
                {chip.label}
              </button>
            );
          })}
          <button
            type="button"
            className={styles.chip}
            aria-expanded={showOther}
            aria-controls="pw-other-field"
            onClick={() => setShowOther((open) => !open)}
          >
            {copy.otherChip}
          </button>
        </div>
        {factMessage?.field === 'chips' ? <p className={styles.error}>{factMessage.text}</p> : null}

        {showOther ? (
          <form
            id="pw-other-field"
            className={styles.field}
            onSubmit={(event) => {
              event.preventDefault();
              addFact('other', otherValue, () => setOtherValue(''));
            }}
          >
            <label className={styles.label} htmlFor="pw-other-input">
              {copy.otherLabel}
            </label>
            <div className={styles.inlineForm}>
              <input
                id="pw-other-input"
                className={styles.input}
                value={otherValue}
                maxLength={LIMITS.factValueMax}
                onChange={(event) => setOtherValue(event.target.value)}
              />
              <button type="submit" className={styles.btnSecondary}>
                {COMMON.add}
              </button>
            </div>
            {factMessage?.field === 'other' ? <p className={styles.error}>{factMessage.text}</p> : null}
          </form>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pw-place-input">
            {copy.placeLabel}
            {placeBadge ? (
              <span className={styles.sourceBadge} data-source={placeBadge}>
                {SOURCE_BADGE[placeBadge]}
              </span>
            ) : null}
          </label>
          <input
            id="pw-place-input"
            ref={placeRef}
            className={styles.input}
            value={placeValue}
            maxLength={LIMITS.placeMax}
            aria-describedby="pw-place-hint"
            onFocus={() => {
              placeFocused.current = true;
            }}
            onChange={(event) => setPlaceValue(event.target.value)}
            onBlur={commitPlace}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitPlace();
              }
            }}
          />
          <p id="pw-place-hint" className={styles.hint}>
            {copy.placeHint}
          </p>
        </div>

        <form
          className={styles.field}
          onSubmit={(event) => {
            event.preventDefault();
            addFact('extra', extraValue, () => setExtraValue(''));
          }}
        >
          <label className={styles.label} htmlFor="pw-extra-input">
            {copy.extraLabel}
          </label>
          <div className={styles.inlineForm}>
            <input
              id="pw-extra-input"
              className={styles.input}
              value={extraValue}
              maxLength={LIMITS.factValueMax}
              aria-describedby="pw-extra-hint"
              onChange={(event) => setExtraValue(event.target.value)}
            />
            <button type="submit" className={styles.btnSecondary}>
              {COMMON.add}
            </button>
          </div>
          <p id="pw-extra-hint" className={styles.hint}>
            {copy.extraHint}
          </p>
          {factMessage?.field === 'extra' ? <p className={styles.error}>{factMessage.text}</p> : null}
        </form>
      </div>

      {draft.conflicts.length > 0 ? (
        <div className={styles.conflicts}>
          {draft.conflicts.map((conflict) => {
            const typed =
              conflict.field === 'age'
                ? String(draft.child.age ?? '')
                : conflict.field === 'name'
                  ? name
                  : draft.storyPlace?.value ?? '';
            const heard = String(conflict.proposed);
            const question =
              conflict.field === 'age'
                ? copy.conflictAge(typed, heard)
                : conflict.field === 'name'
                  ? copy.conflictName(typed, heard)
                  : copy.conflictPlace(typed, heard);
            return (
              <div key={conflict.id} className={styles.conflict} role="group" aria-label={question}>
                <p className={styles.conflictQuestion}>{question}</p>
                {conflict.source === 'fixture' ? <p className={styles.hint}>{copy.conflictFixtureNote}</p> : null}
                <div className={styles.actionsRow}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => update((current) => resolveConflict(current, conflict.id, 'keep'))}
                  >
                    {typed}
                  </button>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => update((current) => resolveConflict(current, conflict.id, 'accept'))}
                  >
                    {heard}
                  </button>
                </div>
              </div>
            );
          })}
          <p className={styles.hint}>{copy.conflictKeepNote}</p>
        </div>
      ) : null}

      <FactsList
        draft={draft}
        update={update}
        copy={copy}
        onEditPlace={() => {
          placeRef.current?.focus();
          placeRef.current?.select();
        }}
      />

      {draft.transcript ? (
        <div className={styles.transcript}>
          <button
            type="button"
            className={styles.linkButton}
            aria-expanded={transcriptOpen}
            aria-controls="pw-transcript"
            onClick={() => setTranscriptOpen((open) => !open)}
          >
            {transcriptOpen ? TRANSCRIPT.hide : TRANSCRIPT.show}
          </button>
          {transcriptOpen ? (
            <div id="pw-transcript" className={styles.transcriptBody}>
              <h3 className={styles.factGroupTitle}>
                {draft.transcript.source === 'fixture' ? TRANSCRIPT.titleFixture : TRANSCRIPT.titleLive}
              </h3>
              {canReorganize ? (
                <>
                  <label className="sr-only" htmlFor="pw-transcript-edit">
                    {TRANSCRIPT.editLabel}
                  </label>
                  <textarea
                    id="pw-transcript-edit"
                    className={styles.textarea}
                    value={transcriptDraft}
                    maxLength={4000}
                    rows={5}
                    aria-describedby="pw-transcript-note"
                    onChange={(event) => setTranscriptDraft(event.target.value)}
                  />
                  <p id="pw-transcript-note" className={styles.hint}>
                    {TRANSCRIPT.editNote}
                  </p>
                  <div className={styles.actionsRow}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={processing || normalizeText(transcriptDraft) === normalizeText(transcriptText) || !normalizeText(transcriptDraft)}
                      onClick={() => props.onReorganize?.(transcriptDraft)}
                    >
                      {TRANSCRIPT.reorganize}
                    </button>
                  </div>
                </>
              ) : (
                <p className={styles.transcriptText}>{draft.transcript.text}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <aside className={styles.testPanel} aria-labelledby="pw-test-title">
        <h2 id="pw-test-title" className={styles.testTitle}>
          {TEST_PANEL.title}
        </h2>
        <p className={styles.hint}>{TEST_PANEL.note}</p>
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={processing}
            onClick={() => props.onStartFixture('simple')}
          >
            {TEST_PANEL.simple}
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            disabled={processing}
            onClick={() => props.onStartFixture('mixed')}
          >
            {TEST_PANEL.mixed}
          </button>
          {fixtureProcessing ? (
            <button type="button" className={styles.btnGhost} onClick={props.onCancelIntake}>
              {COMMON.cancel}
            </button>
          ) : null}
        </div>
        <p className={styles.hint}>{TEST_PANEL.delayNote}</p>
        {fixtureProcessing ? <p className={styles.processing}>{TEST_PANEL.processing}</p> : null}
        {props.lateIgnored ? <p className={styles.hint}>{TEST_PANEL.lateIgnored}</p> : null}
      </aside>

      {prompt ? (
        <div className={styles.prompt} ref={promptRef} role="group" aria-labelledby="pw-prompt-text">
          <p id="pw-prompt-text" className={styles.promptText}>
            {prompt === 'processing' ? copy.processingPrompt : copy.recordingPrompt}
          </p>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnSecondary} onClick={() => props.onPromptChoice('wait')}>
              {prompt === 'processing' ? copy.processingWait : copy.recordingResume}
            </button>
            <button type="button" className={styles.btnPrimarySmall} onClick={() => props.onPromptChoice('skip')}>
              {prompt === 'processing' ? copy.processingSkip : copy.recordingSkip}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function IntakeStatus({ notice }: { notice: IntakeNotice | null }) {
  let text = '';
  if (notice?.kind === 'added') {
    text = notice.count > 0 ? RECORDER.processedAdded(notice.count) : RECORDER.processedNothingNew;
    if (notice.suggestions > 0) text += ` ${RECORDER.suggestionNext}`;
  } else if (notice?.kind === 'nothing_new') text = RECORDER.processedNothingNew;
  else if (notice?.kind === 'not_understood') text = RECORDER.notUnderstood;
  else if (notice?.kind === 'abandoned') text = RECORDER.abandoned;
  else if (notice?.kind === 'failed') text = RECORDER.failed;
  else if (notice?.kind === 'error') text = INTAKE_ERRORS[notice.error];
  const tone = notice?.kind === 'error' || notice?.kind === 'failed' || notice?.kind === 'not_understood' ? 'attention' : undefined;
  return (
    <p className={styles.intakeStatus} data-tone={tone} role="status" aria-live="polite">
      {text}
    </p>
  );
}
