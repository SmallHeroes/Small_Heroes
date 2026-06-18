'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryChallengeCard } from '@/app/category-challenge-card';
import { COMMON } from '@/content';
import type { MvpMatrixCategoryPayload } from '@/lib/web/mvp-matrix-response';
import {
  DIRECTION_EXPERIENCE_CARDS,
  DIRECTION_ORDER,
} from '@/lib/web/direction-display';
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
      <header className={styles.navbar}>
        <div className={styles.navbarInner}>
          <Link href="/" className={styles.logo} aria-label={COMMON.brand}>
            <div className={styles.logoIcon}>
              <div className={styles.logoIconSq} />
              <div className={styles.logoIconDot} />
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoBrand}>{COMMON.brand}</span>
              <span className={styles.logoTagline}>{COMMON.tagline}</span>
            </div>
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div
          className={[styles.shell, !selectedSlot ? styles.shellWide : ''].filter(Boolean).join(' ')}
          key={selectedSlot ? 'direction' : 'challenge'}
        >
          {!selectedSlot ? (
            <>
              <div className={styles.intro}>
                <h1 className={styles.title}>{headerTitle}</h1>
                <p className={styles.sub}>{headerSub}</p>
              </div>
              <div className={styles.challengeWrap}>
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
              </div>
            </>
          ) : (
            <section className={styles.directionPanel} aria-labelledby="direction-heading">
              <div className={styles.directionIntro}>
                <div className={styles.categoryPill}>
                  {selectedSlot.emoji ? `${selectedSlot.emoji} ` : ''}
                  {selectedSlot.label}
                  {selectedSlot.companion?.name ? ` · ${selectedSlot.companion.name}` : ''}
                </div>
                <h2 id="direction-heading" className={styles.directionTitle}>
                  בחרו סוג חוויה
                </h2>
                <p className={styles.directionSub}>
                  הכיוון קובע את אורך הספר והאווירה — כמו בחירת החבילה בדף הבית.
                </p>
              </div>

              <div className={styles.directionGrid}>
                {DIRECTION_ORDER.map((direction) => {
                  const meta = selectedSlot.directions[direction];
                  const sellable = meta?.sellable === true;
                  const card = DIRECTION_EXPERIENCE_CARDS[direction];
                  const featured = card.featured && sellable;

                  return (
                    <button
                      key={direction}
                      type="button"
                      className={[
                        styles.directionCard,
                        featured ? styles.directionCardFeatured : '',
                        !sellable ? styles.directionCardDisabled : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={!sellable}
                      data-event={sellable ? 'start_direction_select' : 'start_direction_soon'}
                      data-category={selectedSlot.category}
                      data-direction={direction}
                      onClick={() => {
                        if (sellable) handoffToWizard(selectedSlot.category, direction);
                      }}
                    >
                      {featured && card.launchBadge ? (
                        <span className={styles.launchBadge}>{card.launchBadge}</span>
                      ) : null}
                      {!sellable ? <span className={styles.soonBadge}>בקרוב</span> : null}

                      <div className={styles.directionKicker}>{card.kicker}</div>
                      <div className={styles.directionName}>{card.name}</div>
                      <div className={styles.directionPages}>
                        {meta?.displayPages ?? 0} עמ&apos; · ספר דיגיטלי מלא
                      </div>
                      <p className={styles.directionDesc}>{card.desc}</p>
                      <ul className={styles.directionFeatures}>
                        {card.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      <div className={styles.directionPrice}>
                        ₪<span>{meta?.priceILS ?? 0}</span>
                      </div>
                      <span className={styles.directionCta}>{sellable ? card.cta : 'בקרוב'}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.backBtn}
                  data-event="start_back_to_challenges"
                  onClick={() => setSelectedCategory(null)}
                >
                  ← חזרה לבחירת אתגר
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
