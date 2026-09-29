'use client';

import { useRef, useState, type RefObject } from 'react';

import { LENGTH_COPY, bookCopy } from '@/lib/personal-wizard/copy';
import { normalizeText, type PersonalBookDraft } from '@/lib/personal-wizard/contract';
import { setLength, setVoice } from '@/lib/personal-wizard/draft';

import type { WizardOptionsView } from './PersonalWizard';
import styles from './personal-wizard.module.css';

const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

type Props = {
  draft: PersonalBookDraft;
  update: (change: (draft: PersonalBookDraft) => PersonalBookDraft) => void;
  options: WizardOptionsView;
  titleRef: RefObject<HTMLHeadingElement | null>;
  photoUrl: string | null;
  onPhoto: (file: File | null) => void;
  playback: { playingId: string | null; play: (id: string, url: string) => void; stop: () => void };
};

export function StepBook({ draft, update, options, titleRef, photoUrl, onPhoto, playback }: Props) {
  const name = normalizeText(draft.child.name);
  const copy = bookCopy(name);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  return (
    <section className={styles.step} aria-labelledby="pw-step-title">
      <h1 id="pw-step-title" className={styles.stepTitle} tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h1>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>
          {copy.photoTitle} <span className={styles.optional}>{copy.optional}</span>
        </h2>
        <div className={styles.photoRow}>
          <div className={styles.photoFrame}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.photoImage} src={photoUrl} alt={copy.photoAlt} />
            ) : (
              <span className={styles.photoPlaceholder} aria-hidden="true">
                +
              </span>
            )}
          </div>
          <div className={styles.photoActions}>
            <input
              ref={fileRef}
              id="pw-photo-input"
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="pw-photo-note"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = '';
                if (!file) return;
                if (!PHOTO_TYPES.has(file.type)) {
                  setPhotoError(copy.photoTypeError);
                  return;
                }
                if (file.size > PHOTO_MAX_BYTES) {
                  setPhotoError(copy.photoSizeError);
                  return;
                }
                setPhotoError(null);
                onPhoto(file);
              }}
            />
            <button type="button" className={styles.btnSecondary} onClick={() => fileRef.current?.click()}>
              {photoUrl ? copy.photoReplace : copy.photoPick}
            </button>
            {photoUrl ? (
              <button type="button" className={styles.btnGhost} onClick={() => onPhoto(null)}>
                {copy.photoRemove}
              </button>
            ) : null}
          </div>
        </div>
        {photoError ? <p className={styles.error}>{photoError}</p> : null}
        <p id="pw-photo-note" className={styles.hint}>
          {photoUrl ? copy.photoLocalNote : `${copy.photoNoPhoto} ${copy.photoLocalNote}`}
        </p>
      </div>

      <div className={styles.card}>
        <fieldset className={styles.fieldset} aria-describedby="pw-voice-note">
          <legend className={styles.sectionTitle}>{copy.voiceTitle}</legend>
          <div className={styles.optionGrid}>
            {options.voices.map((voice) => {
              const selected = draft.bookOptions.voiceId === voice.id;
              const playing = playback.playingId === `voice:${voice.id}`;
              return (
                <div key={voice.id} className={styles.optionCard} data-selected={selected || undefined}>
                  <label className={styles.optionLabel}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="pw-voice"
                      value={voice.id}
                      checked={selected}
                      onChange={() => update((current) => setVoice(current, voice.id))}
                    />
                    <span className={styles.optionEmoji} aria-hidden="true">
                      {voice.emoji}
                    </span>
                    <span className={styles.optionName}>{voice.label}</span>
                    <span className={styles.optionDesc}>{voice.description}</span>
                  </label>
                  {voice.sampleUrl ? (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      aria-pressed={playing}
                      onClick={() =>
                        playing ? playback.stop() : playback.play(`voice:${voice.id}`, voice.sampleUrl as string)
                      }
                    >
                      {playing ? copy.stopSample : copy.playSample}
                      <span className="sr-only">: {voice.label}</span>
                    </button>
                  ) : (
                    <span className={styles.hint}>{copy.noSample}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p id="pw-voice-note" className={styles.hint}>
            {copy.voiceNote}
          </p>
        </fieldset>
      </div>

      <div className={styles.card}>
        <fieldset className={styles.fieldset} aria-describedby="pw-length-note">
          <legend className={styles.sectionTitle}>{copy.lengthTitle}</legend>
          <div className={styles.optionGrid}>
            {options.lengths.map((length) => {
              const selected = draft.bookOptions.lengthId === length.id;
              const text = LENGTH_COPY[length.id];
              return (
                <label key={length.id} className={styles.optionCard} data-selected={selected || undefined}>
                  <input
                    className={styles.radioInput}
                    type="radio"
                    name="pw-length"
                    value={length.id}
                    checked={selected}
                    onChange={() => update((current) => setLength(current, length.id))}
                  />
                  <span className={styles.optionName}>{text?.name ?? length.id}</span>
                  <span className={styles.optionKicker}>{copy.pages(length.pages)}</span>
                  <span className={styles.optionDesc}>{text?.depth}</span>
                </label>
              );
            })}
          </div>
          {draft.bookOptions.lengthId ? (
            <button type="button" className={styles.linkButton} onClick={() => update((current) => setLength(current, null))}>
              {copy.clearChoice}
            </button>
          ) : null}
          <p id="pw-length-note" className={styles.hint}>
            {copy.lengthNote}
          </p>
        </fieldset>
      </div>
    </section>
  );
}
