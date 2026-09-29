'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

import { COMMON, INTAKE_ERRORS, RECORDER, SOURCE_BADGE, TEST_PANEL, TRANSCRIPT, tellCopy } from '@/lib/personal-wizard/copy';
import { normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { activeFacts, dismissIntentSuggestion, resolveConflict, setIntent, type RequestIssue } from '@/lib/personal-wizard/draft';
import type { FixtureExampleId } from '@/lib/personal-wizard/intake-fixture';
import type { LiveIntakeError } from '@/lib/personal-wizard/intake-live-client';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { ChildBasics } from './ChildBasics';
import { FactsList } from './FactsList';
import { ManualEntry } from './ManualEntry';
import { RecorderPanel } from './RecorderPanel';
import styles from './personal-wizard.module.css';

export type IntakeNotice =
  | { kind: 'added'; count: number; suggestions: number; retired?: number }
  | { kind: 'nothing_new' }
  | { kind: 'not_understood' }
  | { kind: 'abandoned' }
  | { kind: 'failed' }
  | { kind: 'error'; error: LiveIntakeError };

export type TellPrompt = 'processing' | 'recording' | null;

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
  prompt: TellPrompt;
  onPromptChoice: (choice: 'wait' | 'skip') => void;
  issues: RequestIssue[];
  showErrors: boolean;
  /** The manual path ("prefer to write or pick?"): secondary, and kept open across steps. */
  manualOpen: boolean;
  onToggleManual: () => void;
  topics: ReadonlyArray<{ id: string; label: string }>;
};

/**
 * Voice-first "tell us about your child". The recording is the main path; what was understood is
 * shown right under it as one editable card, and only missing or conflicting required values are
 * asked. Writing and picking are the same fields behind one visible toggle, feeding the same card.
 */
export function StepTell(props: Props) {
  const { draft, update, titleRef, recorder, playback, liveIntake, prompt } = props;
  const name = normalizeText(draft.child.name);
  const copy = tellCopy(name, draft.child.address);
  const processing = draft.intake?.status === 'processing';
  const fixtureProcessing = processing && draft.intake?.source === 'fixture';
  const transcriptProcessing = processing && draft.intake?.source === 'transcript';

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptText = draft.transcript?.text ?? '';
  const [transcriptDraft, setTranscriptDraft] = useState(transcriptText);
  useEffect(() => setTranscriptDraft(transcriptText), [transcriptText]);
  const canReorganize = Boolean(props.onReorganize) && draft.transcript?.source === 'transcript';

  // "Edit" on the place row opens the manual fields (if closed) and puts the cursor in the place field.
  const placeRef = useRef<HTMLInputElement | null>(null);
  const [focusPlace, setFocusPlace] = useState(false);
  useEffect(() => {
    if (!focusPlace || !props.manualOpen) return;
    placeRef.current?.focus();
    placeRef.current?.select();
    setFocusPlace(false);
  }, [focusPlace, props.manualOpen]);

  const promptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prompt) promptRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [prompt]);

  const facts = activeFacts(draft);
  const topicLabel = (topicId: string) => props.topics.find((topic) => topic.id === topicId)?.label ?? topicId;
  // A direction the parent asked for is part of what was understood: pending, or already approved.
  const directions = [
    ...(draft.intent?.kind === 'topic' && draft.intent.suggestedBy
      ? [
          {
            key: `intent-${draft.intent.topicId}`,
            topicId: draft.intent.topicId,
            source: draft.intent.suggestedBy,
            status: 'included' as const,
            remove: () => update((current) => setIntent(current, null)),
          },
        ]
      : []),
    ...draft.intentSuggestions.map((suggestion) => ({
      key: `suggestion-${suggestion.topicId}`,
      topicId: suggestion.topicId,
      source: suggestion.source,
      status: 'proposed' as const,
      remove: () => update((current) => dismissIntentSuggestion(current, suggestion.topicId)),
    })),
  ];
  const heard =
    draft.child.nameSource === 'transcript' ||
    draft.child.ageSource === 'transcript' ||
    facts.some((fact) => fact.source === 'transcript') ||
    draft.storyPlace?.source === 'transcript' ||
    directions.some((direction) => direction.source === 'transcript');
  const hasValues =
    Boolean(name) ||
    draft.child.age !== null ||
    draft.child.address !== null ||
    facts.length > 0 ||
    draft.storyPlace !== null ||
    draft.conflicts.length > 0 ||
    directions.length > 0;
  // No card before there is something real to show: no fields pretending to be results.
  const showCard = props.manualOpen || props.showErrors || hasValues || draft.transcript !== null;
  const listEmpty = facts.length === 0 && !draft.storyPlace && directions.length === 0;

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
        voiceCta={liveIntake ? copy.voiceCta : copy.voiceCtaLocal}
        voiceNote={liveIntake ? copy.voiceNoteLive : copy.voiceNoteLocal}
        banner={liveIntake ? null : copy.localBanner}
        hint={copy.durationHint}
        transcriptProcessing={transcriptProcessing}
        clipSent={props.clipSent}
        onCancelProcessing={props.onCancelIntake}
        onSend={props.onSendClip}
      />

      <IntakeStatus notice={props.intakeNotice} />

      {/* The area under the recording becomes the card; the manual path follows it. */}
      {showCard ? (
        <section className={styles.factsCard} aria-labelledby="pw-facts-title">
          <h2 id="pw-facts-title" className={styles.sectionTitle}>
            {heard ? copy.cardTitleHeard : copy.cardTitleOwn}
          </h2>
          {!listEmpty ? <p className={styles.hint}>{copy.cardNote}</p> : null}

          <ChildBasics draft={draft} update={update} issues={props.issues} showErrors={props.showErrors} />

          {draft.conflicts.length > 0 ? (
            <div className={styles.conflicts}>
              {draft.conflicts.map((conflict) => {
                // A corrected transcript no longer contains an already approved detail: keep or remove.
                if (conflict.field === 'stale_fact' || conflict.field === 'stale_place') {
                  const question =
                    conflict.field === 'stale_fact' ? copy.staleFact(conflict.value) : copy.stalePlace(conflict.value);
                  return (
                    <div key={conflict.id} className={styles.conflict} role="group" aria-label={question}>
                      <p className={styles.conflictQuestion}>{question}</p>
                      <div className={styles.actionsRow}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => update((current) => resolveConflict(current, conflict.id, 'keep'))}
                        >
                          {copy.staleKeep}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          onClick={() => update((current) => resolveConflict(current, conflict.id, 'accept'))}
                        >
                          {copy.staleRemove}
                        </button>
                      </div>
                    </div>
                  );
                }
                const current =
                  conflict.field === 'age'
                    ? String(draft.child.age ?? '')
                    : conflict.field === 'name'
                      ? name
                      : draft.storyPlace?.value ?? '';
                const typed =
                  conflict.field === 'age'
                    ? draft.child.ageSource === 'typed'
                    : conflict.field === 'name'
                      ? draft.child.nameSource === 'typed'
                      : draft.storyPlace?.source === 'typed';
                const heardValue = String(conflict.proposed);
                const question =
                  conflict.field === 'age'
                    ? copy.conflictAge(current, heardValue, typed)
                    : conflict.field === 'name'
                      ? copy.conflictName(current, heardValue, typed)
                      : copy.conflictPlace(current, heardValue, typed);
                return (
                  <div key={conflict.id} className={styles.conflict} role="group" aria-label={question}>
                    <p className={styles.conflictQuestion}>{question}</p>
                    {conflict.source === 'fixture' ? <p className={styles.hint}>{copy.conflictFixtureNote}</p> : null}
                    <div className={styles.actionsRow}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => update((latest) => resolveConflict(latest, conflict.id, 'keep'))}
                      >
                        {current}
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => update((latest) => resolveConflict(latest, conflict.id, 'accept'))}
                      >
                        {heardValue}
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
              if (!props.manualOpen) props.onToggleManual();
              setFocusPlace(true);
            }}
          />
          {directions.length > 0 ? (
            <div className={styles.factGroup}>
              <h3 className={styles.factGroupTitle}>{copy.directionTitle}</h3>
              <ul className={styles.factRows}>
                {directions.map((direction) => (
                  <li key={direction.key} className={styles.factRow} data-status={direction.status}>
                    <span className={styles.factText}>
                      {topicLabel(direction.topicId)}
                      <span className={styles.sourceBadge} data-source={direction.source}>
                        {SOURCE_BADGE[direction.source]}
                      </span>
                    </span>
                    <span className={styles.factActions}>
                      <button type="button" className={styles.linkButton} onClick={direction.remove}>
                        {COMMON.remove}
                        <span className="sr-only">: {topicLabel(direction.topicId)}</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {listEmpty ? <p className={styles.hint}>{copy.listEmpty}</p> : null}
        </section>
      ) : null}

      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={props.manualOpen}
        aria-controls="pw-manual"
        onClick={props.onToggleManual}
      >
        {copy.manualToggle}
      </button>
      {props.manualOpen ? <ManualEntry draft={draft} update={update} copy={copy} placeInputRef={placeRef} /> : null}

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
          {(['voice', 'simple', 'mixed'] as const).map((exampleId) => (
            <button
              key={exampleId}
              type="button"
              className={styles.btnSecondary}
              disabled={processing}
              onClick={() => props.onStartFixture(exampleId)}
            >
              {TEST_PANEL[exampleId]}
            </button>
          ))}
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
    if (notice.retired) text += ` ${RECORDER.retiredByCorrection(notice.retired)}`;
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
