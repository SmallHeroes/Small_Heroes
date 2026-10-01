'use client';

import type { RefObject } from 'react';

import {
  COMMON,
  LENGTH_COPY,
  SOURCE_BADGE,
  companionCopy,
  factLabel,
  storyPlaceLabel,
  summaryCopy,
  tellCopy,
} from '@/lib/personal-wizard/copy';
import { normalizeText, type PersonalBookDraft, type ReviewedPersonalBookRequest } from '@/lib/personal-wizard/contract';
import { buildReviewedRequest, summarizeRequest } from '@/lib/personal-wizard/draft';

import type { WizardOptionsView } from './PersonalWizard';
import styles from './personal-wizard.module.css';
import { StoryPreview } from './StoryPreview';

export type Submission =
  | { state: 'idle' }
  | { state: 'submitting'; revision: number }
  | {
      state: 'accepted';
      revision: number;
      requestId: string;
      containsFixtureData: boolean;
      canonical: ReviewedPersonalBookRequest;
    }
  | { state: 'rejected'; revision: number; issues: Array<{ path: string; code: string }> }
  | { state: 'network'; revision: number };

type Props = {
  draft: PersonalBookDraft;
  options: WizardOptionsView;
  titleRef: RefObject<HTMLHeadingElement | null>;
  photoUrl: string | null;
  submission: Submission;
  onEdit: (step: 1 | 2 | 3) => void;
};

export function StepSummary({ draft, options, titleRef, photoUrl, submission, onEdit }: Props) {
  const name = normalizeText(draft.child.name);
  const copy = summaryCopy(name, draft.child.address);
  const tell = tellCopy(name, draft.child.address);
  const build = buildReviewedRequest(draft);

  const editButton = (step: 1 | 2 | 3, section: string) => (
    <button type="button" className={styles.linkButton} onClick={() => onEdit(step)}>
      {COMMON.edit}
      <span className="sr-only">: {section}</span>
    </button>
  );

  if (!build.ok) {
    return (
      <section className={styles.step} aria-labelledby="pw-step-title">
        <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
          {copy.title}
        </h1>
        <div className={styles.card}>
          <ul className={styles.factRows}>
            {build.issues.map((issue) => (
              <li key={issue.code} className={styles.factRow}>
                <span className={styles.factText}>{copy.missing[issue.code]}</span>
                {issue.step !== 4 ? editButton(issue.step, copy.missing[issue.code]) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  const model = summarizeRequest(build.request);
  const companion = options.companions.find((candidate) => candidate.id === model.companionId);
  const voice = options.voices.find((candidate) => candidate.id === model.voiceId);
  const length = options.lengths.find((candidate) => candidate.id === model.lengthId);
  const lengthText = length ? `${LENGTH_COPY[length.id]?.name ?? length.id}, ${length.pages} עמודים` : null;
  const intentText =
    model.intent === null
      ? copy.intentNone
      : model.intent.kind === 'just_for_fun'
        ? companionCopy(name, draft.child.address).justForFun
        : copy.intentHelps(options.topics.find((topic) => topic.id === (model.intent as { topicId: string }).topicId)?.label ?? '');
  const stale = submission.state !== 'idle' && submission.revision !== draft.revision;
  // Name/age/topic accepted from a suggestion keep a visible origin, like facts do.
  const originBadge = (origin: 'fixture' | 'transcript' | null) =>
    origin ? (
      <span className={styles.sourceBadge} data-source={origin}>
        {SOURCE_BADGE[origin]}
      </span>
    ) : null;
  const heroSources = [model.child.nameSource, model.child.ageSource, model.child.addressSource];
  const childOrigin = heroSources.includes('fixture') ? 'fixture' : heroSources.includes('transcript') ? 'transcript' : null;
  const residenceSource = model.child.residenceSource;
  const residenceOrigin = residenceSource === 'fixture' || residenceSource === 'transcript' ? residenceSource : null;
  const intentOrigin = model.intent?.kind === 'topic' ? model.intent.suggestedBy ?? null : null;

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h1>

      <div className={styles.summary}>
        <section className={styles.summarySection} aria-labelledby="pw-sum-hero">
          <header className={styles.summaryHead}>
            <h2 id="pw-sum-hero" className={styles.sectionTitle}>
              {copy.sections.hero}
            </h2>
            {editButton(1, copy.sections.hero)}
          </header>
          <p className={styles.summaryText}>
            {copy.childLine(model.child.age)}
            {originBadge(childOrigin)}
          </p>
          <p className={styles.summaryText}>
            {copy.residenceLine(model.child.residence)}
            {originBadge(residenceOrigin)}
          </p>
        </section>

        <section className={styles.summarySection} aria-labelledby="pw-sum-facts">
          <header className={styles.summaryHead}>
            <h2 id="pw-sum-facts" className={styles.sectionTitle}>
              {copy.sections.facts}
            </h2>
            {editButton(1, copy.sections.facts)}
          </header>
          {model.factGroups.length === 0 && !model.storyPlace ? <p className={styles.summaryText}>{copy.noFacts}</p> : null}
          {model.storyPlace ? (
            <p className={styles.summaryText}>
              {storyPlaceLabel(model.storyPlace.value)}
              {model.storyPlace.source === 'fixture' || model.storyPlace.source === 'transcript' ? (
                <span className={styles.sourceBadge} data-source={model.storyPlace.source}>
                  {SOURCE_BADGE[model.storyPlace.source]}
                </span>
              ) : null}
            </p>
          ) : null}
          {model.noDifficulty ? (
            <div className={styles.summaryGroup}>
              <h3 className={styles.factGroupTitle}>{tell.groupTitle.hard}</h3>
              <p className={styles.summaryText}>{copy.noDifficulty}</p>
            </div>
          ) : null}
          {model.factGroups.map((group) => (
            <div key={group.group} className={styles.summaryGroup}>
              <h3 className={styles.factGroupTitle}>{tell.groupTitle[group.group]}</h3>
              <ul className={styles.summaryList}>
                {group.facts.map((fact) => (
                  <li key={fact.id}>
                    {factLabel(fact.kind, fact.value)}
                    {fact.source === 'fixture' || fact.source === 'transcript' ? (
                      <span className={styles.sourceBadge} data-source={fact.source}>
                        {SOURCE_BADGE[fact.source]}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {model.containsFixtureData ? <p className={styles.warn}>{copy.fixtureWarning}</p> : null}
        </section>

        <section className={styles.summarySection} aria-labelledby="pw-sum-companion">
          <header className={styles.summaryHead}>
            <h2 id="pw-sum-companion" className={styles.sectionTitle}>
              {copy.sections.companion}
            </h2>
            {editButton(2, copy.sections.companion)}
          </header>
          {companion ? (
            <div className={styles.summaryCompanion}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.summaryCompanionImage} src={companion.image} alt="" />
              <p className={styles.summaryText}>
                <strong>{companion.name}</strong>
              </p>
            </div>
          ) : null}
        </section>

        <section className={styles.summarySection} aria-labelledby="pw-sum-intent">
          <header className={styles.summaryHead}>
            <h2 id="pw-sum-intent" className={styles.sectionTitle}>
              {copy.sections.intent}
            </h2>
            {editButton(2, copy.sections.intent)}
          </header>
          <p className={styles.summaryText}>
            {intentText}
            {originBadge(intentOrigin)}
          </p>
          {model.avoid.length > 0 ? <p className={styles.summaryText}>{copy.avoid(model.avoid)}</p> : null}
        </section>

        <section className={styles.summarySection} aria-labelledby="pw-sum-look">
          <header className={styles.summaryHead}>
            <h2 id="pw-sum-look" className={styles.sectionTitle}>
              {copy.sections.look}
            </h2>
            {editButton(3, copy.sections.look)}
          </header>
          <div className={styles.summaryLook}>
            {photoUrl && model.photo === 'local_preview_not_sent' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.summaryPhoto} src={photoUrl} alt="" />
            ) : null}
            <ul className={styles.summaryList}>
              <li>{model.photo === 'none' ? copy.photoNone : copy.photoLocal}</li>
              <li>{copy.voice(voice ? voice.label : null)}</li>
              <li>{copy.length(lengthText)}</li>
            </ul>
          </div>
        </section>
      </div>

      <div className={styles.statusBox}>
        <p className={styles.summaryText}>{copy.connectionBody}</p>
        <div role="status" aria-live="polite" className={styles.submission}>
          {submission.state === 'submitting' ? <p>{copy.finishing}</p> : null}
          {submission.state === 'accepted' && !stale ? (
            <>
              <p className={styles.accepted}>{copy.accepted}</p>
              <p className={styles.hint}>{copy.requestId(submission.requestId.slice(0, 12))}</p>
              {submission.containsFixtureData ? <p className={styles.hint}>{copy.fixtureWarning}</p> : null}
            </>
          ) : null}
          {submission.state === 'rejected' && !stale ? (
            <>
              <p className={styles.error}>{copy.rejected}</p>
              <ul className={styles.summaryList}>
                {submission.issues.map((issue) => (
                  <li key={`${issue.path}:${issue.code}`}>
                    <code>{issue.path || 'request'}</code>: {issue.code}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {submission.state === 'network' && !stale ? <p className={styles.error}>{copy.network}</p> : null}
          {stale ? <p className={styles.hint}>{copy.changedSince}</p> : null}
        </div>
        {submission.state === 'accepted' && !stale ? (
          <details className={styles.payload}>
            <summary>{copy.payload}</summary>
            <pre dir="ltr">{JSON.stringify(submission.canonical, null, 2)}</pre>
          </details>
        ) : null}
      </div>
      {submission.state === 'accepted' ? <StoryPreview request={submission.canonical} requestId={submission.requestId} stale={stale} onEdit={() => onEdit(1)} /> : null}
    </section>
  );
}
