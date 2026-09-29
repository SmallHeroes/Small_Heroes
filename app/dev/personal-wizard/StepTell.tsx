'use client';

import { useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';

import {
  COMMON,
  HERO,
  INTAKE_ERRORS,
  MUST_HAVE_CUES,
  RECORDER,
  TEST_PANEL,
  TRANSCRIPT,
  tellCopy,
} from '@/lib/personal-wizard/copy';
import { LIMITS, normalizeText, type GrammaticalAddress, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { BONUS_GROUP_ORDER, FACT_GROUP_OF_KIND, activeFacts, resolveConflict, type RequestIssue } from '@/lib/personal-wizard/draft';
import type { FixtureExampleId } from '@/lib/personal-wizard/intake-fixture';
import type { LiveIntakeError } from '@/lib/personal-wizard/intake-live-client';
import type { MediaStreamLike, RecorderSnapshot, RecordingController } from '@/lib/personal-wizard/recorder';

import { ChildBasics } from './ChildBasics';
import { DecodingView } from './DecodingView';
import { FactsList } from './FactsList';
import { ManualEntry } from './ManualEntry';
import { MustHaves } from './MustHaves';
import { RecorderPanel } from './RecorderPanel';
import styles from './personal-wizard.module.css';

export type IntakeNotice =
  | { kind: 'added'; count: number; suggestions: number; retired?: number }
  | { kind: 'nothing_new' }
  | { kind: 'not_understood' }
  | { kind: 'abandoned' }
  | { kind: 'failed' }
  | { kind: 'error'; error: LiveIntakeError };

/** How the parent chose to tell us: talking (the default), picking chips, or writing. */
export type TellMode = 'voice' | 'chips' | 'write';

/**
 * What step 1 shows. start = only the text and the big button; recording and processing = only
 * that; write = the writing box; card = what was understood, with the missing must-haves asked.
 */
export type TellView = 'start' | 'recording' | 'processing' | 'write' | 'card';

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
  /** The card was shown once: it stays, even if the parent removes everything from it. */
  cardOpened: boolean;
}): TellView {
  if (input.draft.intake?.status === 'processing') return 'processing';
  if (input.phase === 'requesting' || input.phase === 'recording' || input.phase === 'stopping') return 'recording';
  if (input.cardOpened || input.mode === 'chips' || hasTellContent(input.draft)) return 'card';
  return input.mode === 'write' ? 'write' : 'start';
}

const MUST_HAVE_ISSUES = new Set([
  'child_name_missing',
  'child_name_invalid',
  'child_age_missing',
  'child_address_missing',
  'child_residence_missing',
  'loves_missing',
  'hard_missing',
]);

type Props = {
  view: TellView;
  mode: TellMode;
  onMode: (mode: TellMode) => void;
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
  /** Live only: organise a text the parent wrote instead of recording. */
  onSubmitWritten?: (text: string) => void;
  issues: RequestIssue[];
  showErrors: boolean;
  /** "Add another detail" (optional bonus fields): kept open across steps. */
  manualOpen: boolean;
  onToggleManual: () => void;
  topics: ReadonlyArray<{ id: string; label: string }>;
};

/**
 * Voice-first "tell us about your child". The start screen is the text and one big button, with
 * picking and writing as quiet alternatives. While recording, the five must-haves are cues; while
 * processing, only the processing shows. The result is one editable card: what was understood, and
 * right there the questions for whatever of the five is still missing.
 */
export function StepTell(props: Props) {
  const { view, draft, update, titleRef, recorder, playback, liveIntake } = props;
  const name = normalizeText(draft.child.name);
  const copy = tellCopy(name, draft.child.address);
  // Kept here, not in the writing box: the box unmounts while processing, and a failed or cancelled
  // processing must give the parent's text back, not an empty box.
  const [writtenText, setWrittenText] = useState('');

  const recorderProps = {
    snapshot: recorder.snapshot,
    stream: recorder.stream,
    controller: recorder.controller,
    playback,
    liveIntake,
    voiceCta: copy.voiceCta,
    hint: copy.durationHint,
    cuesTitle: copy.cuesTitle,
    cues: MUST_HAVE_CUES,
    recordMoreLabel: liveIntake ? copy.recordMore : copy.voiceCtaLocal,
    clipSent: props.clipSent,
    onSend: props.onSendClip,
  };

  if (view === 'processing') {
    const written = draft.intake?.medium === 'written';
    const title =
      draft.intake?.source === 'fixture' ? copy.processingFixture : written ? copy.processingWritten : copy.processingVoice;
    return (
      <DecodingView
        title={title}
        steps={copy.decodeSteps(written)}
        status={copy.processingStatus}
        cancelLabel={COMMON.cancel}
        onCancel={props.onCancelIntake}
        titleRef={titleRef}
      />
    );
  }

  if (view === 'recording') {
    return (
      <section className={styles.step} aria-labelledby="pw-step-title">
        <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
          {copy.title}
        </h1>
        <RecorderPanel view="recording" {...recorderProps} />
      </section>
    );
  }

  if (view === 'start') {
    return (
      <section className={styles.startView} aria-labelledby="pw-step-title">
        <div className={styles.startHero}>
          <div className={styles.startText}>
            <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
              {copy.title}
            </h1>
            <p className={styles.startLead}>{copy.lead}</p>
          </div>
          <div className={styles.startAction}>
            <RecorderPanel view="start" {...recorderProps} />
            <IntakeStatus notice={props.intakeNotice} />
            <div className={styles.altButtons}>
              <button type="button" className={styles.altButton} onClick={() => props.onMode('chips')}>
                <ChipsIcon />
                {copy.chipsLink}
              </button>
              <button type="button" className={styles.altButton} onClick={() => props.onMode('write')}>
                <PenIcon />
                {copy.writeLink}
              </button>
            </div>
            {liveIntake ? (
              <p className={styles.privacyLine}>{RECORDER.privacyLive}</p>
            ) : (
              <div className={styles.previewNote}>
                <p>{copy.localNote}</p>
                <button type="button" className={styles.linkButton} onClick={() => props.onStartFixture('voice')}>
                  {copy.exampleCta}
                </button>
              </div>
            )}
          </div>
        </div>
        <TestPanel {...props} />
      </section>
    );
  }

  if (view === 'write') {
    return (
      <section className={styles.step} aria-labelledby="pw-step-title">
        <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
          {copy.writeTitle}
        </h1>
        <p className={styles.stepSub}>{copy.writeLead}</p>
        <WriteBox
          copy={copy}
          text={writtenText}
          onText={setWrittenText}
          liveIntake={liveIntake}
          onSubmit={props.onSubmitWritten}
          onQuestions={() => props.onMode('chips')}
        />
        <IntakeStatus notice={props.intakeNotice} />
        <div className={styles.altLinks}>
          <button type="button" className={styles.altLink} onClick={() => props.onMode('voice')}>
            {copy.switchToVoice}
          </button>
          {liveIntake ? (
            <button type="button" className={styles.altLink} onClick={() => props.onMode('chips')}>
              {copy.chipsLink}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return <DetailsCard {...props} copy={copy} recorderProps={recorderProps} />;
}

function DetailsCard(
  props: Props & {
    copy: ReturnType<typeof tellCopy>;
    recorderProps: Omit<ComponentProps<typeof RecorderPanel>, 'view'>;
  },
) {
  const { draft, update, titleRef, copy } = props;
  const name = normalizeText(draft.child.name);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const transcriptText = draft.transcript?.text ?? '';
  const [transcriptDraft, setTranscriptDraft] = useState(transcriptText);
  useEffect(() => setTranscriptDraft(transcriptText), [transcriptText]);
  const canReorganize = Boolean(props.onReorganize) && draft.transcript?.source === 'transcript';
  const written = draft.transcript?.medium === 'written';

  // "Edit" on the place row opens the optional fields (if closed) and puts the cursor in the place field.
  const placeRef = useRef<HTMLInputElement | null>(null);
  const [focusPlace, setFocusPlace] = useState(false);
  useEffect(() => {
    if (!focusPlace || !props.manualOpen) return;
    placeRef.current?.focus();
    placeRef.current?.select();
    setFocusPlace(false);
  }, [focusPlace, props.manualOpen]);

  const facts = activeFacts(draft);
  const heard =
    [draft.child.nameSource, draft.child.ageSource, draft.child.addressSource, draft.child.residenceSource].some(
      (source) => source === 'transcript' || source === 'fixture',
    ) ||
    facts.some((fact) => fact.source === 'transcript' || fact.source === 'fixture') ||
    draft.transcript !== null;
  const missing = props.issues.filter((issue) => MUST_HAVE_ISSUES.has(issue.code)).length;
  const bonusFacts = facts.filter((fact) => BONUS_GROUP_ORDER.includes(FACT_GROUP_OF_KIND[fact.kind]));
  const title = heard ? copy.cardTitleHeard : hasTellContent(draft) ? copy.cardTitleOwn : copy.chipsTitle;

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {title}
      </h1>
      <IntakeStatus notice={props.intakeNotice} />
      {heard && missing > 0 ? <p className={styles.missingNote}>{copy.missingNote(missing)}</p> : null}
      {!hasTellContent(draft) && props.mode === 'chips' ? (
        <button type="button" className={styles.switchLink} onClick={() => props.onMode('voice')}>
          {copy.switchToVoice}
        </button>
      ) : null}

      <section className={styles.factsCard} aria-labelledby="pw-step-title">
        {facts.length > 0 ? <p className={styles.hint}>{copy.cardNote}</p> : null}
        <ChildBasics draft={draft} update={update} issues={props.issues} showErrors={props.showErrors} />
        <Conflicts draft={draft} update={update} copy={copy} name={name} />
        <MustHaves
          draft={draft}
          update={update}
          copy={copy}
          issues={props.issues}
          showErrors={props.showErrors}
          topics={props.topics}
        />
        {bonusFacts.length > 0 || draft.storyPlace ? (
          <div className={styles.mustHave} role="group" aria-labelledby="pw-bonus-title">
            <h3 id="pw-bonus-title" className={styles.mustHaveTitle}>
              {copy.bonusTitle}
            </h3>
            <FactsList
              draft={draft}
              update={update}
              copy={copy}
              groups={BONUS_GROUP_ORDER}
              onEditPlace={() => {
                if (!props.manualOpen) props.onToggleManual();
                setFocusPlace(true);
              }}
            />
          </div>
        ) : null}
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={props.manualOpen}
          aria-controls="pw-manual"
          onClick={props.onToggleManual}
        >
          {copy.bonusAdd}
        </button>
        {props.manualOpen ? <ManualEntry draft={draft} update={update} copy={copy} placeInputRef={placeRef} /> : null}
      </section>

      <div className={styles.cardFooter}>
        <RecorderPanel view="card" {...props.recorderProps} />
        {draft.transcript ? (
          <div className={styles.transcript}>
            <button
              type="button"
              className={styles.linkButton}
              aria-expanded={transcriptOpen}
              aria-controls="pw-transcript"
              onClick={() => setTranscriptOpen((open) => !open)}
            >
              {transcriptOpen ? TRANSCRIPT.hide : written ? TRANSCRIPT.showWritten : TRANSCRIPT.show}
            </button>
            {transcriptOpen ? (
              <div id="pw-transcript" className={styles.transcriptBody}>
                <h3 className={styles.factGroupTitle}>
                  {draft.transcript.source === 'fixture'
                    ? TRANSCRIPT.titleFixture
                    : written
                      ? TRANSCRIPT.titleWritten
                      : TRANSCRIPT.titleLive}
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
                      maxLength={LIMITS.transcriptMax}
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
                        disabled={
                          normalizeText(transcriptDraft) === normalizeText(transcriptText) || !normalizeText(transcriptDraft)
                        }
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
      </div>

      <TestPanel {...props} />
    </section>
  );
}

const addressLabel = (address: GrammaticalAddress | null) =>
  address === 'girl' ? HERO.addressGirl : address === 'boy' ? HERO.addressBoy : '';

/** Questions shown next to the list; none of them overwrites anything by itself. */
function Conflicts({
  draft,
  update,
  copy,
  name,
}: {
  draft: PersonalBookDraft;
  update: Props['update'];
  copy: ReturnType<typeof tellCopy>;
  name: string;
}) {
  if (draft.conflicts.length === 0) return null;
  return (
    <div className={styles.conflicts}>
      {draft.conflicts.map((conflict) => {
        // A corrected transcript no longer contains an already approved detail: keep or remove.
        if (conflict.field === 'stale_fact' || conflict.field === 'stale_place') {
          const question = conflict.field === 'stale_fact' ? copy.staleFact(conflict.value) : copy.stalePlace(conflict.value);
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
        let current: string;
        let heardValue = String(conflict.proposed);
        let typed: boolean;
        let question: string;
        if (conflict.field === 'age') {
          current = String(draft.child.age ?? '');
          typed = draft.child.ageSource === 'typed';
          question = copy.conflictAge(current, heardValue, typed);
        } else if (conflict.field === 'name') {
          current = name;
          typed = draft.child.nameSource === 'typed';
          question = copy.conflictName(current, heardValue, typed);
        } else if (conflict.field === 'address') {
          current = addressLabel(draft.child.address);
          heardValue = addressLabel(conflict.proposed === 'girl' ? 'girl' : 'boy');
          typed = draft.child.addressSource === 'typed';
          question = copy.conflictAddress(current, heardValue, typed);
        } else if (conflict.field === 'residence') {
          current = normalizeText(draft.child.residence);
          typed = draft.child.residenceSource === 'typed';
          question = copy.conflictResidence(current, heardValue, typed);
        } else {
          current = draft.storyPlace?.value ?? '';
          typed = draft.storyPlace?.source === 'typed';
          question = copy.conflictPlace(current, heardValue, typed);
        }
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
  );
}

/** Writing instead of talking: the same organising, the same card. */
function WriteBox({
  copy,
  text,
  onText,
  liveIntake,
  onSubmit,
  onQuestions,
}: {
  copy: ReturnType<typeof tellCopy>;
  text: string;
  onText: (text: string) => void;
  liveIntake: boolean;
  onSubmit?: (text: string) => void;
  onQuestions: () => void;
}) {
  return (
    <div className={styles.card}>
      <label className={styles.label} htmlFor="pw-write">
        {copy.writeLabel}
      </label>
      <p className={styles.hint} id="pw-write-cues">
        {copy.cuesTitle} {MUST_HAVE_CUES.join(' · ')}
      </p>
      <textarea
        id="pw-write"
        className={styles.textarea}
        rows={6}
        maxLength={LIMITS.transcriptMax}
        value={text}
        aria-describedby="pw-write-cues"
        onChange={(event) => onText(event.target.value)}
      />
      {liveIntake && onSubmit ? (
        <>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnPrimary} disabled={!normalizeText(text)} onClick={() => onSubmit(text)}>
              {copy.writeSend}
            </button>
          </div>
          <p className={styles.privacyLine}>{RECORDER.privacyWritten}</p>
        </>
      ) : (
        <>
          <p className={styles.hint}>{copy.writeLocalNote}</p>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.btnSecondary} onClick={onQuestions}>
              {copy.writeToQuestions}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ChipsIcon() {
  return (
    <svg className={styles.altIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h4A2.5 2.5 0 0 1 13 6.5v0A2.5 2.5 0 0 1 10.5 9h-4A2.5 2.5 0 0 1 4 6.5Zm0 11A2.5 2.5 0 0 1 6.5 15h11a2.5 2.5 0 0 1 0 5h-11A2.5 2.5 0 0 1 4 17.5Zm11-11A2.5 2.5 0 0 1 17.5 4v0a2.5 2.5 0 0 1 0 5v0A2.5 2.5 0 0 1 15 6.5Zm-11 5.5A2.5 2.5 0 0 1 6.5 9.5h6a2.5 2.5 0 0 1 0 5h-6A2.5 2.5 0 0 1 4 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className={styles.altIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The labelled examples: a quiet, closed tool at the bottom, never part of the parent's path. */
function TestPanel(props: Props) {
  return (
    <details className={styles.testPanel}>
      <summary className={styles.testTitle}>{TEST_PANEL.toggle}</summary>
      <p className={styles.hint}>{TEST_PANEL.note}</p>
      <div className={styles.actionsRow}>
        {(['voice', 'simple', 'mixed'] as const).map((exampleId) => (
          <button key={exampleId} type="button" className={styles.btnSecondary} onClick={() => props.onStartFixture(exampleId)}>
            {TEST_PANEL[exampleId]}
          </button>
        ))}
      </div>
      <p className={styles.hint}>{TEST_PANEL.delayNote}</p>
      {props.lateIgnored ? <p className={styles.hint}>{TEST_PANEL.lateIgnored}</p> : null}
    </details>
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
