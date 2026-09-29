'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { COMMON, STEP_NAMES, summaryCopy, tellCopy } from '@/lib/personal-wizard/copy';
import { normalizeText, type IntakeResult } from '@/lib/personal-wizard/contract';
import {
  abandonIntakeJob,
  applyIntakeResult,
  buildReviewedRequest,
  commitChildName,
  confirmFactsReview,
  failIntakeJob,
  randomId,
  requestIssues,
  setPhotoChoice,
  startIntakeJob,
} from '@/lib/personal-wizard/draft';
import { runFixtureIntake, type FixtureExampleId } from '@/lib/personal-wizard/intake-fixture';
import {
  fetchLiveIntakeStatus,
  submitAudioIntake,
  submitTextIntake,
  type LiveIntakeResponse,
} from '@/lib/personal-wizard/intake-live-client';
import type { RecordedClip } from '@/lib/personal-wizard/recorder';

import { useDraftStore, useObjectUrl, usePlayback, useRecorder, useSoftKeyboardOpen } from './hooks';
import styles from './personal-wizard.module.css';
import { StepBook } from './StepBook';
import { StepCompanion } from './StepCompanion';
import { StepSummary, type Submission } from './StepSummary';
import { StepTell, type IntakeNotice, type TellPrompt } from './StepTell';

export type WizardOptionsView = {
  companions: Array<{ id: string; name: string; image: string; personality: string }>;
  topics: Array<{ id: string; label: string }>;
  voices: Array<{ id: string; label: string; description: string; emoji: string; sampleUrl: string | null }>;
  packages: Array<{ id: string; kicker: string; name: string; pages: number }>;
};

/** 1 = tell us (voice first, manual alternative), 2 = companion and direction, 3 = look and sound, 4 = summary. */
type Step = 1 | 2 | 3 | 4;

/** The fixture answers after a short delay so processing, cancel and "continue without" can be exercised. */
const FIXTURE_DELAY_MS = 1500;

type Props = {
  options: WizardOptionsView;
};

export function PersonalWizard({ options }: Props) {
  const { draft, update, read } = useDraftStore();
  const recorder = useRecorder();
  const playback = usePlayback();
  const [step, setStep] = useState<Step>(1);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [showErrors, setShowErrors] = useState({ tell: false, companion: false });
  const [manualOpen, setManualOpen] = useState(false);
  const [prompt, setPrompt] = useState<TellPrompt>(null);
  const [intakeNotice, setIntakeNotice] = useState<IntakeNotice | null>(null);
  const [lateIgnored, setLateIgnored] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoUrl = useObjectUrl(photoFile);
  const [submission, setSubmission] = useState<Submission>({ state: 'idle' });
  const keyboardOpen = useSoftKeyboardOpen();
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const shownStep = useRef<Step>(1);
  const allowedTopicIds = useMemo(() => new Set(options.topics.map((topic) => topic.id)), [options.topics]);
  const issues = requestIssues(draft);
  const name = normalizeText(draft.child.name);

  // Live intake (P2) is offered only when the server says this signed-in operator may use it.
  // The answer only shapes the UI; the intake routes enforce authority on every request.
  const [liveIntake, setLiveIntake] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchLiveIntakeStatus().then((live) => {
      if (active) setLiveIntake(live);
    });
    return () => {
      active = false;
    };
  }, []);
  const pendingLive = useRef<{ jobId: string; controller: AbortController } | null>(null);
  const [sentClip, setSentClip] = useState<Blob | null>(null);
  useEffect(() => () => pendingLive.current?.controller.abort(), []);

  // Only a real step change moves focus (not the initial mount, even under StrictMode re-runs).
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  // Marks hydration, so scripted QA does not type into server HTML that React will replace.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Focus scrolling keeps fields clear of the fixed bottom bar.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('scroll-padding-block-end');
    root.style.setProperty('scroll-padding-block-end', '112px');
    return () => {
      if (previous) root.style.setProperty('scroll-padding-block-end', previous);
      else root.style.removeProperty('scroll-padding-block-end');
    };
  }, []);

  const hasContent = draft.revision > 0;
  useEffect(() => {
    if (!hasContent) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasContent]);

  // P1 never submits audio. If a send request ever appears without live intake, drop it.
  const sendRequested = recorder.snapshot.sendRequested;
  const recorderController = recorder.controller;
  useEffect(() => {
    if (!liveIntake && sendRequested) recorderController()?.withdrawSendRequest();
  }, [liveIntake, sendRequested, recorderController]);

  const goTo = (target: Step) => {
    if (step === 1 && target !== 1) {
      const controller = recorder.controller();
      controller?.withdrawSendRequest();
      controller?.stop('left_step');
    }
    playback.stop();
    setPrompt(null);
    setStep(target);
  };

  const advance = () => {
    if (returnToSummary) {
      setReturnToSummary(false);
      goTo(4);
    } else {
      goTo((step + 1) as Step);
    }
  };

  const receiveIntake = (result: IntakeResult) => {
    const outcome = applyIntakeResult(read(), result, { allowedTopicIds, makeId: randomId });
    if (!outcome.applied) {
      if (result.source === 'fixture') setLateIgnored(true);
      return;
    }
    update(() => outcome.draft);
    if (!outcome.understood) setIntakeNotice({ kind: 'not_understood' });
    else if (outcome.added > 0 || outcome.suggestions > 0 || outcome.retired > 0) {
      setIntakeNotice({ kind: 'added', count: outcome.added, suggestions: outcome.suggestions, retired: outcome.retired });
    } else if (outcome.conflicts === 0) setIntakeNotice({ kind: 'nothing_new' });
    else setIntakeNotice(null);
  };

  const startFixture = (exampleId: FixtureExampleId) => {
    const current = read();
    if (current.intake?.status === 'processing') return;
    const jobId = randomId('j');
    update((latest) => startIntakeJob(latest, jobId, 'fixture'));
    setIntakeNotice(null);
    setLateIgnored(false);
    void runFixtureIntake(
      { jobId, exampleId, address: current.child.address ?? 'boy' },
      { delayMs: FIXTURE_DELAY_MS, setTimeout: (callback, ms) => window.setTimeout(callback, ms) },
    ).then(receiveIntake);
  };

  /**
   * One live job at a time; cancel and "continue without" abort it, and a late answer cannot land.
   * Returns false (and says so) when another job, live or example, is still processing.
   */
  const runLiveJob = (
    submitJob: (jobId: string, signal: AbortSignal) => Promise<LiveIntakeResponse>,
    options: { supersedesJobId?: string } = {},
  ): boolean => {
    if (read().intake?.status === 'processing') {
      setIntakeNotice({ kind: 'error', error: 'busy' });
      return false;
    }
    const jobId = randomId('j');
    const controller = new AbortController();
    pendingLive.current?.controller.abort();
    pendingLive.current = { jobId, controller };
    update((latest) => startIntakeJob(latest, jobId, 'transcript', options));
    setIntakeNotice(null);
    void submitJob(jobId, controller.signal).then((response) => {
      if (pendingLive.current?.jobId === jobId) pendingLive.current = null;
      if (response.ok) {
        receiveIntake(response.result);
        return;
      }
      if (response.error === 'aborted') return;
      update((latest) => failIntakeJob(latest, jobId));
      if (read().intake?.jobId === jobId) setIntakeNotice({ kind: 'error', error: response.error });
    });
    return true;
  };

  const sendClip = (clip: RecordedClip) => {
    if (!clip.sendable) {
      setIntakeNotice({ kind: 'error', error: 'rejected_audio' });
      return;
    }
    const started = runLiveJob((jobId, signal) =>
      submitAudioIntake({ jobId, draftId: read().draftId, audio: clip.blob, mimeType: clip.mimeType, signal }),
    );
    // Only a clip that really left is marked sent; a refused start leaves "send" available.
    if (started) setSentClip(clip.blob);
  };

  // A corrected transcript replaces the one it corrects: its stale proposals are retired, not kept.
  const reorganizeTranscript = (text: string) => {
    runLiveJob((jobId, signal) => submitTextIntake({ jobId, draftId: read().draftId, text, signal }), {
      supersedesJobId: read().transcript?.jobId,
    });
  };

  // "Done, organise the details" requests exactly one submission; the controller hands it out once.
  const recorderPhase = recorder.snapshot.phase;
  useEffect(() => {
    if (!liveIntake || !sendRequested || recorderPhase !== 'recorded') return;
    const clip = recorderController()?.takeSendRequest();
    if (clip) sendClip(clip);
    // sendClip reads the latest draft through the store ref; re-running on its identity is not wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveIntake, sendRequested, recorderPhase, recorderController]);

  const abortLive = () => {
    pendingLive.current?.controller.abort();
    pendingLive.current = null;
  };

  const cancelIntake = () => {
    abortLive();
    update(abandonIntakeJob);
    setIntakeNotice({ kind: 'abandoned' });
  };

  const focusFirstInvalid = (selector: string) => {
    window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 0);
  };

  /** Name, age and address are required before leaving step 1; the card shows what is missing. */
  const basicsReady = (): boolean => {
    const missing = requestIssues(read()).filter((issue) => issue.code.startsWith('child_'));
    if (missing.length === 0) return true;
    setShowErrors((current) => ({ ...current, tell: true }));
    const first = missing[0].code;
    focusFirstInvalid(
      first.startsWith('child_name') ? '#pw-child-name' : first === 'child_age_missing' ? 'input[name="pw-age"]' : 'input[name="pw-address"]',
    );
    return false;
  };

  /** "These are the details, continue": approves the one shared version and moves on. */
  const finishTell = () => {
    setPrompt(null);
    if (!basicsReady()) return;
    update((current) => confirmFactsReview(commitChildName(current)));
    advance();
  };

  const continueFromTell = () => {
    const { phase } = recorder.snapshot;
    if (phase === 'requesting' || phase === 'recording' || phase === 'stopping') {
      setPrompt('recording');
      return;
    }
    if (read().intake?.status === 'processing') {
      setPrompt('processing');
      return;
    }
    finishTell();
  };

  const onPromptChoice = (choice: 'wait' | 'skip') => {
    if (choice === 'wait') {
      setPrompt(null);
      return;
    }
    if (prompt === 'recording') {
      const controller = recorder.controller();
      controller?.withdrawSendRequest();
      controller?.stop('left_step');
    }
    if (prompt === 'processing' || read().intake?.status === 'processing') {
      abortLive();
      update(abandonIntakeJob);
      setIntakeNotice({ kind: 'abandoned' });
    }
    finishTell();
  };

  const submit = async () => {
    if (submission.state === 'submitting') return;
    const built = buildReviewedRequest(read());
    if (!built.ok) return;
    const revision = built.request.draftRevision;
    setSubmission({ state: 'submitting', revision });
    try {
      const response = await fetch('/api/dev/personal-wizard/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.request),
        cache: 'no-store',
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.status === 'accepted_preview' && typeof body.requestId === 'string') {
        setSubmission({
          state: 'accepted',
          revision,
          requestId: body.requestId,
          containsFixtureData: Boolean(body.containsFixtureData),
          canonical: body.canonical,
        });
      } else if (response.status === 422) {
        setSubmission({ state: 'rejected', revision, issues: Array.isArray(body?.issues) ? body.issues : [] });
      } else {
        setSubmission({ state: 'network', revision });
      }
    } catch {
      setSubmission({ state: 'network', revision });
    }
  };

  const onContinue = () => {
    if (step === 1) {
      continueFromTell();
      return;
    }
    if (step === 2) {
      if (!draft.companionId) {
        setShowErrors((current) => ({ ...current, companion: true }));
        focusFirstInvalid('input[name="pw-companion"]');
        return;
      }
      advance();
      return;
    }
    if (step === 3) {
      advance();
      return;
    }
    void submit();
  };

  const onBack = () => {
    setReturnToSummary(false);
    goTo((step - 1) as Step);
  };

  const onEdit = (target: 1 | 2 | 3) => {
    setReturnToSummary(true);
    goTo(target);
  };

  const onPhoto = (file: File | null) => {
    setPhotoFile(file);
    update((current) => setPhotoChoice(current, file ? 'local_preview_not_sent' : 'none'));
  };

  const summaryBuild = step === 4 ? buildReviewedRequest(draft) : null;
  const acceptedCurrent = submission.state === 'accepted' && submission.revision === draft.revision;
  let continueLabel = returnToSummary ? COMMON.backToSummary : COMMON.next;
  if (step === 1 && !returnToSummary) continueLabel = tellCopy(name, draft.child.address).continue;
  if (step === 4) continueLabel = summaryCopy(name, draft.child.address).finish;
  const continueDisabled =
    step === 4 && (submission.state === 'submitting' || !summaryBuild?.ok || acceptedCurrent);

  return (
    <div className={styles.page} data-ready={ready || undefined}>
      <header className={styles.topbar}>
        <span className={styles.brand}>גיבורים קטנים</span>
        <span className={styles.prototypeBadge}>{COMMON.prototypeBadge}</span>
      </header>
      <p className={styles.draftNotice}>{COMMON.draftNotice}</p>

      <div className={styles.progress}>
        <p className={styles.progressLabel}>
          {COMMON.stepOf(step)}: {STEP_NAMES[step - 1]}
        </p>
        <ol className={styles.pills} aria-hidden="true">
          {STEP_NAMES.map((stepName, index) => (
            <li
              key={stepName}
              className={styles.pill}
              data-state={index + 1 < step ? 'done' : index + 1 === step ? 'active' : undefined}
            />
          ))}
        </ol>
      </div>

      <main className={styles.main}>
        {step === 1 ? (
          <StepTell
            draft={draft}
            update={update}
            titleRef={titleRef}
            recorder={recorder}
            playback={playback}
            liveIntake={liveIntake}
            intakeNotice={intakeNotice}
            lateIgnored={lateIgnored}
            onStartFixture={startFixture}
            onCancelIntake={cancelIntake}
            onSendClip={() => {
              const clip = recorder.snapshot.clip;
              if (clip) sendClip(clip);
            }}
            clipSent={Boolean(recorder.snapshot.clip && recorder.snapshot.clip.blob === sentClip)}
            onReorganize={liveIntake ? reorganizeTranscript : undefined}
            prompt={prompt}
            onPromptChoice={onPromptChoice}
            issues={issues}
            showErrors={showErrors.tell}
            manualOpen={manualOpen}
            onToggleManual={() => setManualOpen((open) => !open)}
            topics={options.topics}
          />
        ) : null}
        {step === 2 ? (
          <StepCompanion
            draft={draft}
            update={update}
            options={options}
            showErrors={showErrors.companion}
            titleRef={titleRef}
          />
        ) : null}
        {step === 3 ? (
          <StepBook
            draft={draft}
            update={update}
            options={options}
            titleRef={titleRef}
            photoUrl={photoUrl}
            onPhoto={onPhoto}
            playback={playback}
          />
        ) : null}
        {step === 4 ? (
          <StepSummary
            draft={draft}
            options={options}
            titleRef={titleRef}
            photoUrl={photoUrl}
            submission={submission}
            onEdit={onEdit}
          />
        ) : null}
      </main>

      <nav className={styles.bottomBar} aria-label="ניווט בין השלבים" data-keyboard={keyboardOpen || undefined}>
        <div className={styles.bottomBarInner}>
          {step > 1 ? (
            <button type="button" className={styles.btnBack} onClick={onBack}>
              {COMMON.back}
            </button>
          ) : null}
          <button type="button" className={styles.btnContinue} onClick={onContinue} disabled={continueDisabled}>
            {continueLabel}
          </button>
        </div>
      </nav>
    </div>
  );
}
