'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import { DIRECTION_LABELS, DIRECTION_ORDER } from '@/lib/web/direction-display';
import type { StoryDirection } from '@/backend/config/mvp-story-matrix';
import styles from './start.module.css';

type StartClientProps = {
  headerTitle: string;
  headerSub: string;
  categories: MvpMatrixCategoryPayload[];
};

export default function StartClient({ headerTitle, headerSub, categories }: StartClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const selectedSlot = useMemo(
    () => categories.find((c) => c.category === selectedCategory) ?? null,
    [categories, selectedCategory]
  );

  function handoffToWizard(category: string, direction: StoryDirection) {
    const params = new URLSearchParams({ category, direction });
    window.location.href = `/wizard?${params.toString()}`;
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          גיבורים קטנים
        </Link>
      </header>

      <main className={styles.main}>
        {!selectedSlot ? (
          <>
            <div className={styles.intro}>
              <h1 className={styles.title}>{headerTitle}</h1>
              <p className={styles.sub}>{headerSub}</p>
            </div>
            <div className="mvp-challenge-grid mvp-challenge-grid--start">
              {categories.map((slot) => (
                <CategoryChallengeCard
                  key={slot.category}
                  slot={slot}
                  as="button"
                  selected={selectedCategory === slot.category}
                  onClick={() => setSelectedCategory(slot.category)}
                  data-event="start_challenge_select"
                />
              ))}
            </div>
          </>
        ) : (
          <section className={styles.directionSection} aria-labelledby="direction-heading">
            <h2 id="direction-heading" className={styles.directionTitle}>
              {selectedSlot.label} — בחרו סוג חוויה
            </h2>
            <div className={styles.directionGrid}>
              {DIRECTION_ORDER.map((direction) => {
                const meta = selectedSlot.directions[direction];
                const sellable = meta?.sellable === true;
                return (
                  <button
                    key={direction}
                    type="button"
                    className={
                      styles.directionCard +
                      (sellable ? '' : ` ${styles.directionCardDisabled}`)
                    }
                    disabled={!sellable}
                    data-event={sellable ? 'start_direction_select' : 'start_direction_soon'}
                    data-category={selectedSlot.category}
                    data-direction={direction}
                    onClick={() => {
                      if (sellable) handoffToWizard(selectedSlot.category, direction);
                    }}
                  >
                    <span className={styles.directionName}>{DIRECTION_LABELS[direction]}</span>
                    <span className={styles.directionMeta}>
                      {meta?.displayPages ?? 0} עמ&apos; · ₪{meta?.priceILS ?? 0}
                    </span>
                    {!sellable ? <span className={styles.soonBadge}>בקרוב</span> : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={styles.backBtn}
              data-event="start_back_to_challenges"
              onClick={() => setSelectedCategory(null)}
            >
              ← חזרה לבחירת אתגר
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
